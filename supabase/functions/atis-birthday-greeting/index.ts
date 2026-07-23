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
  const mmdd = `${g('month')}-${g('day')}`
  const hour = parseInt(g('hour'), 10)
  const period = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 18 ? 'tarde' : hour >= 18 ? 'noite' : 'madrugada'
  return { dateKey, timeKey, mmdd, hour, period }
}

async function generateGreeting(names: string[], template: string | null, period: string): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY')
  const greeting = period === 'manhã' ? 'Bom dia' : period === 'tarde' ? 'Boa tarde' : period === 'noite' ? 'Boa noite' : 'Paz do Senhor'
  const list = names.map((n) => `• ${n}`).join('\n')

  if (template && template.trim()) {
    return template
      .replaceAll('{nomes}', names.join(', '))
      .replaceAll('{lista}', list)
      .replaceAll('{saudacao}', greeting)
  }
  if (!key) {
    return `🎂 ${greeting}, família!\n\nHoje é dia de festa! Parabéns a:\n${list}\n\nQue o Senhor abençoe grandemente sua vida com saúde, paz e muitas alegrias. 🙏✨\n— Igreja Atalaias de Betel`
  }
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
            'Você é Atis, assistente da Igreja Atalaias de Betel. Gere UMA mensagem de aniversário calorosa, cristã e curta para ser enviada em um GRUPO de WhatsApp parabenizando o(s) aniversariante(s) do dia. Estrutura:\n' +
            `1) Saudação começando por "${greeting}, família!" com emoji de festa (🎉🎂).\n` +
            '2) Cite o(s) nome(s) claramente em uma lista.\n' +
            '3) UM versículo bíblico REAL (referência exata) sobre vida, bênção ou gratidão, entre aspas (ARA).\n' +
            '4) Bênção pastoral em 2 frases.\n' +
            'Máx. 700 caracteres. Emojis discretos. Sem markdown pesado. Varie a cada dia.',
        },
        {
          role: 'user',
          content: `Aniversariante(s) de hoje: ${names.join(', ')}. Gere a mensagem agora.`,
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('[atis-birthday-greeting] AI error', res.status, await res.text().catch(() => ''))
    return `🎂 ${greeting}, família!\n\nHoje é aniversário de:\n${list}\n\nParabéns! Que Deus abençoe grandemente. 🙏`
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

  const { data: settingRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_birthday_greeting').maybeSingle()
  const cfg = (settingRow?.value ?? {}) as {
    enabled?: boolean; time?: string; group_ids?: string[]; template?: string | null; use_ai?: boolean; last_sent_date?: string
  }

  const { dateKey, timeKey, mmdd, period } = brNow()

  if (!force) {
    if (!cfg.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders })
    if ((cfg.time ?? '08:00') !== timeKey) return new Response(JSON.stringify({ skipped: true, reason: 'not-time', now: timeKey, target: cfg.time }), { headers: corsHeaders })
    if (cfg.last_sent_date === dateKey) return new Response(JSON.stringify({ skipped: true, reason: 'already-sent-today' }), { headers: corsHeaders })
  }

  const groupIds = Array.isArray(cfg.group_ids) ? cfg.group_ids.filter(Boolean) : []
  if (!groupIds.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-groups' }), { headers: corsHeaders })

  const { data: bdays } = await admin.from('atis_birthdays').select('name,birth_date,active')
  const todays = (bdays ?? []).filter((b: any) => b.active !== false && String(b.birth_date ?? '').slice(5, 10) === mmdd)
  if (!todays.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-birthdays-today', mmdd }), { headers: corsHeaders })

  const names = todays.map((b: any) => b.name)
  const useAi = cfg.use_ai !== false && !(cfg.template && cfg.template.trim())
  const text = await generateGreeting(names, useAi ? null : (cfg.template ?? null), period)
  if (!text) return new Response(JSON.stringify({ error: 'empty-text' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const results: any[] = []
  for (const jid of groupIds) {
    const r = await sendToGroup(jid, text)
    results.push({ jid, ok: r.ok, status: r.status })
    await admin.from('atis_messages_log').insert({
      direction: 'outbound',
      wa_to: jid,
      wa_group_id: jid,
      body: text,
      command: 'birthday-greeting',
      status: r.ok ? 'sent' : 'error',
      raw: { auto: !force, ai: useAi, names, http: r.status, body: r.body?.slice?.(0, 300) },
    })
  }

  if (!force) {
    await admin.from('admin_settings').upsert(
      { key: 'atis_birthday_greeting', value: { ...cfg, last_sent_date: dateKey } },
      { onConflict: 'key' },
    )
  }

  return new Response(JSON.stringify({ ok: true, sent: results.length, names, results, preview: text.slice(0, 200) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})