import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const INSTANCE = 'atis'
const BRAZIL_TZ = 'America/Fortaleza'

function normalizeJid(to: string): string {
  if (to.includes('@')) return to
  const digits = to.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `${withCountry}@s.whatsapp.net`
}

function phoneVariants(to: string): string[] {
  if (to.includes('@')) return [to]
  const digits = to.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  // BR mobile: after DDD (2 digits) may or may not have leading 9
  // withCountry format: 55 + DD + rest
  const ddd = withCountry.slice(2, 4)
  const rest = withCountry.slice(4)
  const variants = new Set<string>()
  variants.add(withCountry)
  if (rest.length === 9 && rest.startsWith('9')) {
    variants.add(`55${ddd}${rest.slice(1)}`) // drop leading 9
  } else if (rest.length === 8) {
    variants.add(`55${ddd}9${rest}`) // add leading 9
  }
  return [...variants].map((n) => `${n}@s.whatsapp.net`)
}

async function sendText(to: string, text: string) {
  const attempts = phoneVariants(to)
  let last: { ok: boolean; status: number; json: any } = { ok: false, status: 0, json: null }
  for (const jid of attempts) {
    const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: jid, text }),
    })
    const raw = await res.text()
    let json: any = null
    try { json = raw ? JSON.parse(raw) : null } catch { json = { raw } }
    last = { ok: res.ok, status: res.status, json }
    if (res.ok) return last
    // if Evolution says the number doesn't exist, try next variant
    const notExists = JSON.stringify(json ?? '').includes('"exists":false')
    if (!notExists) return last
  }
  return last
}

function todayBR(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

async function resolveVerseOfDay(admin: any): Promise<string> {
  try {
    const { data } = await admin
      .from('daily_verse_queue')
      .select('verse_ref, verse_text')
      .eq('scheduled_date', todayBR())
      .maybeSingle()
    if (data?.verse_ref) return `*${data.verse_ref}*\n_"${data.verse_text}"_`
  } catch (_) { /* ignore */ }
  return ''
}

async function resolveBirthdaysToday(admin: any): Promise<string> {
  try {
    const mmdd = todayBR().slice(5) // MM-DD
    const { data } = await admin.from('atis_birthdays').select('name, birth_date').eq('active', true)
    const list = (data ?? [])
      .filter((b: any) => typeof b.birth_date === 'string' && b.birth_date.slice(5) === mmdd)
      .map((b: any) => `• ${b.name}`)
    return list.length ? list.join('\n') : '(nenhum aniversariante hoje)'
  } catch (_) { return '' }
}

const DEFAULT_DEVOTIONAL_PROMPT =
  'Você é um pastor e escritor devocional. A partir do versículo bíblico fornecido, escreva uma REFLEXÃO DEVOCIONAL curta (2 parágrafos) que:\n' +
  '1) Conecte o texto ao cotidiano do leitor\n2) Traga uma aplicação prática e encorajadora\n' +
  'Seja caloroso e inspirador. Use markdown. Responda em português brasileiro.'

async function resolveDevotional(admin: any): Promise<string> {
  try {
    const { data: qv } = await admin
      .from('daily_verse_queue')
      .select('verse_text, verse_ref')
      .eq('scheduled_date', todayBR())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!qv?.verse_ref) return ''
    if (!hasAnyAiKey()) return ''
    let systemPrompt = DEFAULT_DEVOTIONAL_PROMPT
    try {
      const { data: promptsRow } = await admin
        .from('admin_settings').select('value').eq('key', 'ai_tool_prompts').maybeSingle()
      const custom = (promptsRow?.value as Record<string, string> | null)?.devotional
      if (typeof custom === 'string' && custom.trim().length > 0) systemPrompt = custom
    } catch (_) { /* ignore */ }
    systemPrompt += '\n\nIMPORTANTE: NÃO repita nem cite o versículo nem a referência no início da resposta. Comece direto pela reflexão.'
    let text = await aiGenerateText({
      system: systemPrompt,
      user: `**${qv.verse_ref}**\n\n"${qv.verse_text}"`,
      temperature: 0.9,
      maxTokens: 4096,
    })
    if (!text) return ''
    const refEsc = qv.verse_ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(`^\\s*\\*{1,2}${refEsc}\\*{1,2}\\s*`, 'i'), '')
    text = text.replace(new RegExp(`^\\s*${refEsc}\\s*`, 'i'), '')
    text = text.replace(/^\s*["“][\s\S]*?["”]\s*/, '')
    text = text.replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^\s*[-*]\s+/gm, '• ').trim()
    if (!text) return ''
    return `📖 *${qv.verse_ref}*\n"${qv.verse_text}"\n\n💜 *Reflexão Devocional*\n${text}`
  } catch (_) { return '' }
}

function firstName(n: string | null | undefined): string {
  if (!n) return 'irmão(ã)'
  return String(n).trim().split(/\s+/)[0] || 'irmão(ã)'
}

function applyPlaceholders(body: string, ctx: { nome?: string; verse?: string; birthdays?: string; devotional?: string }) {
  return body
    .replaceAll('{nome}', ctx.nome ?? '')
    .replaceAll('{versiculo_do_dia}', ctx.verse ?? '')
    .replaceAll('{aniversariantes_hoje}', ctx.birthdays ?? '')
    .replaceAll('{devocional_ia}', ctx.devotional ?? '')
}

async function resolveRecipients(admin: any, target_type: string, target_ref: string | null) {
  // returns array of { to: string, name?: string, kind: 'contact'|'group' }
  if (target_type === 'group') {
    if (!target_ref) return []
    return [{ to: target_ref, kind: 'group' as const }]
  }
  if (target_type === 'contact') {
    if (!target_ref) return []
    // target_ref may be a contact.id (uuid) or a raw phone
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target_ref)
    if (isUuid) {
      const { data } = await admin.from('atis_contacts').select('phone,name,opt_in').eq('id', target_ref).maybeSingle()
      if (!data || !data.opt_in) return []
      return [{ to: data.phone, name: data.name, kind: 'contact' as const }]
    }
    return [{ to: target_ref, kind: 'contact' as const }]
  }
  if (target_type === 'tag') {
    if (!target_ref) return []
    const { data } = await admin.from('atis_contacts').select('phone,name,tags,opt_in').eq('opt_in', true)
    return (data ?? [])
      .filter((c: any) => Array.isArray(c.tags) && c.tags.includes(target_ref))
      .map((c: any) => ({ to: c.phone, name: c.name, kind: 'contact' as const }))
  }
  // 'all'
  const { data } = await admin.from('atis_contacts').select('phone,name,opt_in').eq('opt_in', true)
  return (data ?? []).map((c: any) => ({ to: c.phone, name: c.name, kind: 'contact' as const }))
}

function nextScheduled(fromISO: string, recurrence: string | null): string | null {
  if (!recurrence || recurrence === 'once') return null
  const d = new Date(fromISO)
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else return null
  return d.toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const { data: due, error } = await admin
      .from('atis_broadcasts')
      .select('*')
      .eq('status', 'pending')
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order('scheduled_at', { ascending: true, nullsFirst: true })
      .limit(20)
    if (error) throw error

    const results: any[] = []
    const verse = await resolveVerseOfDay(admin)
    const birthdays = await resolveBirthdaysToday(admin)
    // Lazily resolve devotional only if any broadcast uses the placeholder
    let devotionalCache: string | null = null
    const getDevotional = async () => {
      if (devotionalCache !== null) return devotionalCache
      devotionalCache = await resolveDevotional(admin)
      return devotionalCache
    }

    for (const b of due ?? []) {
      try {
        const recipients = await resolveRecipients(admin, b.target_type, b.target_ref)
        if (recipients.length === 0) {
          await admin.from('atis_broadcasts').update({
            status: 'failed', error: 'sem destinatários', sent_at: new Date().toISOString(),
          }).eq('id', b.id)
          results.push({ id: b.id, ok: false, error: 'no recipients' })
          continue
        }

        let okCount = 0, failCount = 0
        const errors: string[] = []
        for (const r of recipients) {
          const nome = r.kind === 'contact' ? firstName(r.name) : ''
          const devotional = (b.body ?? '').includes('{devocional_ia}') ? await getDevotional() : ''
          const text = applyPlaceholders(b.body, { nome, verse, birthdays, devotional })
          const out = await sendText(r.to, text)
          if (out.ok) okCount++
          else { failCount++; errors.push(`${r.to}: ${out.status}`) }
          await admin.from('atis_messages_log').insert({
            direction: 'outbound',
            wa_to: r.to,
            body: text,
            status: out.ok ? 'sent' : 'error',
            raw: out.json,
          })
        }

        const status = okCount > 0 ? 'sent' : 'failed'
        const next = nextScheduled(b.scheduled_at ?? new Date().toISOString(), b.recurrence)
        if (next) {
          // reschedule: bump scheduled_at and keep pending
          await admin.from('atis_broadcasts').update({
            scheduled_at: next, status: 'pending', sent_at: new Date().toISOString(),
            error: failCount > 0 ? errors.join('; ').slice(0, 500) : null,
          }).eq('id', b.id)
        } else {
          await admin.from('atis_broadcasts').update({
            status, sent_at: new Date().toISOString(),
            error: failCount > 0 ? errors.join('; ').slice(0, 500) : null,
          }).eq('id', b.id)
        }
        results.push({ id: b.id, ok: okCount, fail: failCount, next })
      } catch (e: any) {
        await admin.from('atis_broadcasts').update({
          status: 'failed', error: String(e?.message ?? e).slice(0, 500), sent_at: new Date().toISOString(),
        }).eq('id', b.id)
        results.push({ id: b.id, ok: false, error: String(e?.message ?? e) })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})