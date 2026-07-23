import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const INSTANCE = 'atis'
const BRAZIL_TZ = 'America/Fortaleza'

function brNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const dateKey = `${g('year')}-${g('month')}-${g('day')}`
  const timeKey = `${g('hour')}:${g('minute')}`
  const hour = parseInt(g('hour'), 10)
  const period = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 18 ? 'tarde' : hour >= 18 ? 'noite' : 'madrugada'
  const dayName = new Intl.DateTimeFormat('pt-BR', { timeZone: BRAZIL_TZ, weekday: 'long' }).format(new Date())
  return { dateKey, timeKey, hour, period, dayName }
}

async function generateDevotional(theme: string | null, period: string, dayName: string, hour: number): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY')
  if (!key) return ''
  const greeting = period === 'manhã' ? 'Bom dia' : period === 'tarde' ? 'Boa tarde' : period === 'noite' ? 'Boa noite' : 'Paz do Senhor'
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 1.0,
      messages: [
        {
          role: 'system',
          content:
            'Você é Atis, assistente devocional da Igreja Atalaias de Betel. Gere UM devocional cristão diário, curto e edificante, para ser enviado em um GRUPO de WhatsApp. Estrutura obrigatória:\n' +
            `1) Saudação natural começando por "${greeting}, família!" (adapte ao período do dia).\n` +
            '2) UM versículo bíblico real (referência exata — livro, capítulo e versículo) com o texto entre aspas na versão Almeida Revista e Atualizada. NUNCA invente referências.\n' +
            '3) Reflexão pastoral de 3 a 5 frases, aplicada à vida cotidiana.\n' +
            '4) Uma frase final de bênção/convite à oração.\n' +
            'Use quebras de linha simples, emojis discretos (📖 🙏 ✨), sem hashtags, sem markdown pesado (nada de **negrito** ou títulos com #). Máx. 900 caracteres. Varie a cada dia — não repita fórmulas.',
        },
        {
          role: 'user',
          content:
            `Hoje é ${dayName}, período: ${period} (${hour}h em Fortaleza-CE).` +
            (theme ? ` Tema sugerido: ${theme}.` : ' Escolha um tema bíblico relevante para o dia.') +
            ' Gere agora o devocional (original, diferente dos anteriores).',
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('[atis-daily-devotional] AI error', res.status, await res.text().catch(() => ''))
    return ''
  }
  const j = await res.json().catch(() => null) as any
  return (j?.choices?.[0]?.message?.content ?? '').trim().replace(/^"|"$/g, '')
}

async function sendToGroup(jid: string, text: string) {
  if (!EVO_URL || !EVO_KEY) return { ok: false, status: 0, body: 'evolution not configured' }
  const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number: jid, text }),
  })
  const body = await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, body }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({} as any))
  const force = body?.force === true

  const { data: settingRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_daily_devotional').maybeSingle()
  const cfg = (settingRow?.value ?? {}) as {
    enabled?: boolean; time?: string; group_ids?: string[]; theme?: string | null; last_sent_date?: string
  }

  const { dateKey, timeKey, hour, period, dayName } = brNow()

  if (!force) {
    if (!cfg.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders })
    if ((cfg.time ?? '06:30') !== timeKey) return new Response(JSON.stringify({ skipped: true, reason: 'not-time', now: timeKey, target: cfg.time }), { headers: corsHeaders })
    if (cfg.last_sent_date === dateKey) return new Response(JSON.stringify({ skipped: true, reason: 'already-sent-today' }), { headers: corsHeaders })
  }

  const groupIds = Array.isArray(cfg.group_ids) ? cfg.group_ids.filter(Boolean) : []
  if (!groupIds.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-groups' }), { headers: corsHeaders })

  const text = await generateDevotional(cfg.theme ?? null, period, dayName, hour)
  if (!text) return new Response(JSON.stringify({ error: 'ai-failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const results: any[] = []
  for (const jid of groupIds) {
    const r = await sendToGroup(jid, text)
    results.push({ jid, ok: r.ok, status: r.status })
    await admin.from('atis_messages_log').insert({
      direction: 'outbound',
      wa_to: jid,
      wa_group_id: jid,
      body: text,
      command: 'daily-devotional',
      status: r.ok ? 'sent' : 'error',
      raw: { auto: !force, ai: true, http: r.status, body: r.body?.slice?.(0, 300) },
    })
  }

  if (!force) {
    await admin.from('admin_settings').upsert(
      { key: 'atis_daily_devotional', value: { ...cfg, last_sent_date: dateKey } },
      { onConflict: 'key' },
    )
  }

  return new Response(JSON.stringify({ ok: true, sent: results.length, results, preview: text.slice(0, 200) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})