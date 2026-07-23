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

async function generateMotivational(period: string, dayName: string, hour: number): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY')
  if (!key) return ''
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
            'Você é um mentor espiritual cristão, acolhedor e criativo. Gere UMA frase curta (máx. 130 caracteres), original e inspiradora, para lembrar a pessoa de ler a Bíblia agora. Nunca repita fórmulas prontas. Use linguagem natural e adapte o tom ao período do dia. Sem hashtags, sem aspas, sem emojis no início. Retorne APENAS a frase.',
        },
        {
          role: 'user',
          content:
            `Contexto: hoje é ${dayName}, período do dia = ${period} (hora local ${hour}h em Fortaleza-CE). ` +
            (period === 'manhã'
              ? 'Convide a pessoa a começar o dia na Palavra.'
              : period === 'tarde'
              ? 'Convide a pessoa a fazer uma pausa e voltar à Palavra.'
              : period === 'noite'
              ? 'Convide a pessoa a encerrar o dia meditando na Palavra antes de dormir.'
              : 'Convide a pessoa a se aquietar com Deus neste momento silencioso.') +
            ' Gere agora a frase (diferente das anteriores).',
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

function titleByPeriod(period: string): string {
  if (period === 'manhã') return '☀️ Bom dia! Não deixe de ler hoje'
  if (period === 'tarde') return '🌤️ Boa tarde! Uma pausa na Palavra'
  if (period === 'noite') return '🌙 Boa noite! Encerre o dia com Deus'
  return '✨ Um momento com Deus agora'
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
    enabled?: boolean; time?: string; group_ids?: string[]; last_sent_date?: string
  }

  const { dateKey, timeKey, hour, period, dayName } = brNow()

  if (!force) {
    if (!cfg.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders })
    if ((cfg.time ?? '06:30') !== timeKey) return new Response(JSON.stringify({ skipped: true, reason: 'not-time', now: timeKey, target: cfg.time }), { headers: corsHeaders })
    if (cfg.last_sent_date === dateKey) return new Response(JSON.stringify({ skipped: true, reason: 'already-sent-today' }), { headers: corsHeaders })
  }

  const groupIds = Array.isArray(cfg.group_ids) ? cfg.group_ids.filter(Boolean) : []
  if (!groupIds.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-groups' }), { headers: corsHeaders })

  // Busca o versículo do dia agendado (mesma fonte da Bíblia Atalaia — daily-verse-push)
  const { data: queueVerse } = await admin
    .from('daily_verse_queue')
    .select('verse_text, verse_ref')
    .eq('scheduled_date', dateKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!queueVerse) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no-verse-scheduled', date: dateKey }), { headers: corsHeaders })
  }

  const motivational = await generateMotivational(period, dayName, hour)
  const title = titleByPeriod(period)
  const text =
    `📖 *${queueVerse.verse_ref}*\n` +
    `"${queueVerse.verse_text}"\n\n` +
    `${title}\n` +
    (motivational ? `${motivational}\n\n` : '\n') +
    `— Bíblia Atalaia`

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
      raw: { auto: !force, verse_ref: queueVerse.verse_ref, ai_motivational: !!motivational, http: r.status, body: r.body?.slice?.(0, 300) },
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