import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiGenerateText, hasAnyAiKey } from '../_shared/ai-fetch.ts'

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

const DEFAULT_DEVOTIONAL_PROMPT =
  'Você é um pastor e escritor devocional. A partir do versículo bíblico fornecido, escreva uma REFLEXÃO DEVOCIONAL curta (2 parágrafos) que:\n' +
  '1) Conecte o texto ao cotidiano do leitor\n2) Traga uma aplicação prática e encorajadora\n' +
  'Seja caloroso e inspirador. Use markdown. Responda em português brasileiro.'

async function generateDevotional(
  admin: any,
  verseRef: string,
  verseText: string,
): Promise<string> {
  if (!hasAnyAiKey()) return ''

  // Use the same custom prompt override as the in-app "Reflexão Devocional" (ai-tools)
  let systemPrompt = DEFAULT_DEVOTIONAL_PROMPT
  try {
    const { data: promptsRow } = await admin
      .from('admin_settings')
      .select('value')
      .eq('key', 'ai_tool_prompts')
      .maybeSingle()
    const prompts = (promptsRow?.value as Record<string, string>) || {}
    const custom = prompts?.devotional
    if (typeof custom === 'string' && custom.trim().length > 0) systemPrompt = custom
  } catch (_) { /* ignore */ }

  // Reforço: não repetir o versículo (o cabeçalho da mensagem já o exibe)
  systemPrompt += '\n\nIMPORTANTE: NÃO repita nem cite o versículo nem a referência no início da resposta. Comece direto pela reflexão.'

  const userContent = `**${verseRef}**\n\n"${verseText}"`

  const text = await aiGenerateText({
    system: systemPrompt,
    user: userContent,
    temperature: 0.9,
    maxTokens: 4096,
  })
  if (!text) return ''
  // Remove repetição do versículo/ref no início (o cabeçalho já mostra)
  let cleaned = text
  const refEsc = verseRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // remove **Ref** ou *Ref* ou Ref no começo
  cleaned = cleaned.replace(new RegExp(`^\\s*\\*{1,2}${refEsc}\\*{1,2}\\s*`, 'i'), '')
  cleaned = cleaned.replace(new RegExp(`^\\s*${refEsc}\\s*`, 'i'), '')
  // remove citação entre aspas no começo (o texto do versículo)
  cleaned = cleaned.replace(/^\s*["“][\s\S]*?["”]\s*/, '')
  // Strip markdown for WhatsApp readability (keep bold via *...*)
  return cleaned
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim()
}

function titleByPeriod(period: string): string {
  if (period === 'manhã') return '☀️ Bom dia! Devocional de hoje'
  if (period === 'tarde') return '🌤️ Boa tarde! Devocional de hoje'
  if (period === 'noite') return '🌙 Boa noite! Devocional de hoje'
  return '✨ Devocional de hoje'
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
    enabled?: boolean; time?: string; group_ids?: string[]; last_sent_date?: string; last_sent_dates?: Record<string, string>
  }

  const { dateKey, timeKey, period } = brNow()

  if (!force) {
    if (!cfg.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders })
  }

  const groupIdsRaw = Array.isArray(cfg.group_ids) ? cfg.group_ids.filter(Boolean) : []
  if (!groupIdsRaw.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-groups' }), { headers: corsHeaders })

  // Respeita filtro por grupo (Atis › Grupos › Tipos de notificação).
  // Devocional diário = tipo "devotional".
  const NOTIF = 'devotional'
  const { data: gRows } = await admin
    .from('atis_groups')
    .select('wa_group_id, notification_types, notification_times, active')
    .in('wa_group_id', groupIdsRaw)
  const globalTime = cfg.time ?? '06:30'
  const lastSentMap: Record<string, string> = (cfg.last_sent_dates && typeof cfg.last_sent_dates === 'object') ? cfg.last_sent_dates : {}
  const allowed = new Set(
    (gRows ?? [])
      .filter((g: any) => g.active !== false)
      .filter((g: any) => {
        const t = Array.isArray(g.notification_types) ? g.notification_types : null
        return !t || t.length === 0 || t.includes(NOTIF)
      })
      .filter((g: any) => {
        if (force) return true
        // Skip if already sent to this group today
        if (lastSentMap[g.wa_group_id] === dateKey) return false
        // Per-group time (Fortaleza). If defined, must match now. Else use global.
        const times = g.notification_times && typeof g.notification_times === 'object' ? g.notification_times : {}
        const perGroup = typeof times[NOTIF] === 'string' ? times[NOTIF] : ''
        const target = perGroup || globalTime
        return target === timeKey
      })
      .map((g: any) => g.wa_group_id),
  )
  // Grupos não importados em atis_groups: por padrão, permite (não bloqueia envios manuais).
  const groupIds = groupIdsRaw.filter((jid) => allowed.has(jid) || !(gRows ?? []).some((g: any) => g.wa_group_id === jid))
  const skippedByFilter = groupIdsRaw.filter((jid) => !groupIds.includes(jid))
  if (!groupIds.length) return new Response(JSON.stringify({ skipped: true, reason: 'filtered-out', skippedByFilter }), { headers: corsHeaders })

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

  const devotional = await generateDevotional(admin, queueVerse.verse_ref, queueVerse.verse_text)
  const title = titleByPeriod(period)
  const text =
    `${title}\n\n` +
    `📖 *${queueVerse.verse_ref}*\n` +
    `"${queueVerse.verse_text}"\n\n` +
    `💜 *Reflexão Devocional*\n` +
    (devotional ? `${devotional}\n\n` : '_Reflita hoje sobre este versículo e permita que Deus fale ao seu coração._\n\n') +
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
      raw: { auto: !force, verse_ref: queueVerse.verse_ref, ai_devotional: !!devotional, http: r.status, body: r.body?.slice?.(0, 300) },
    })
  }

  if (!force) {
    const nextMap = { ...lastSentMap }
    for (const r of results) if (r.ok) nextMap[r.jid] = dateKey
    await admin.from('admin_settings').upsert(
      { key: 'atis_daily_devotional', value: { ...cfg, last_sent_dates: nextMap, last_sent_date: dateKey } },
      { onConflict: 'key' },
    )
  }

  return new Response(JSON.stringify({ ok: true, sent: results.length, results, preview: text.slice(0, 200) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})