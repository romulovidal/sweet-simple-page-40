import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiChatFetch } from '../_shared/ai-fetch.ts'

const EVO_URL = Deno.env.get('EVOLUTION_API_URL')!.replace(/\/$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY')!
const INSTANCE = 'atis'
const WEBHOOK_SECRET = Deno.env.get('ATIS_WEBHOOK_SECRET') ?? ''

async function sendText(jid: string, text: string) {
  return fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number: jid, text }),
  })
}

function extractText(msg: any): string {
  return (
    msg?.message?.conversation ??
    msg?.message?.extendedTextMessage?.text ??
    msg?.message?.imageMessage?.caption ??
    msg?.message?.videoMessage?.caption ??
    ''
  )
}

const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']

const APP_URL = 'https://biblia.atalaias.online'
const APP_FEATURES = `### Funções do app Bíblia Atalaia (${APP_URL})
- Bíblia completa (Almeida) com busca inteligente e busca por IA (semântica)
- Áudio da Bíblia (TTS) com destaque do versículo em reprodução
- Versículo do dia (rotativo, agendado em daily_verse_queue)
- Planos de leitura (admin_plans) — inscrição, progresso e sequência (streak)
- Harpa Cristã 640 hinos com letra, busca por número/tema, favoritos, histórico, modo apresentação, áudio (YouTube) e compartilhamento por link direto (/harpa/:numero)
- Descubra: posts/devocionais (admin_posts), história bíblica, quizzes
- Você: perfil, anotações, versículos salvos, sequência (streak), metas de leitura, pedidos de oração (públicos e privados)
- Agenda de cultos com lembretes push
- Notificações push (VAPID) para versículo do dia, cultos, planos e avisos
- Painel Atis (bot WhatsApp) integrando aniversariantes, grupos, estudos, broadcasts e comandos
- Página pública de privacidade (/privacidade) e termos (/termos); conta pode ser excluída pelo próprio usuário
- Funciona offline (Service Worker) — Bíblia e Harpa acessíveis sem internet; áudio e busca IA exigem conexão`

async function buildMinistryContext(admin: any): Promise<string> {
  const parts: string[] = []
  parts.push(APP_FEATURES)
  // Use America/Fortaleza (UTC-3, no DST) to compute "hoje"
  const nowFort = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const today = new Date(Date.UTC(nowFort.getUTCFullYear(), nowFort.getUTCMonth(), nowFort.getUTCDate()))
  const dow = today.getUTCDay()

  // Cultos
  try {
    const { data: cultos } = await admin
      .from('culto_schedules').select('name,day_of_week,time,is_active')
      .eq('is_active', true).order('day_of_week').order('time')
    if (cultos?.length) {
      const linhas = cultos.map((c: any) => `- ${DIAS[c.day_of_week]} às ${String(c.time).slice(0,5)}: ${c.name}`).join('\n')
      parts.push(`### Cultos regulares\n${linhas}`)
      const hoje = cultos.filter((c: any) => c.day_of_week === dow)
      if (hoje.length) parts.push(`### Culto de hoje\n${hoje.map((c: any) => `- ${c.name} às ${String(c.time).slice(0,5)}`).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Aniversariantes hoje / próximos 7 dias
  try {
    const { data: birthdays } = await admin
      .from('atis_birthdays').select('name,birth_date').eq('active', true)
    if (birthdays?.length) {
      const mm = today.getUTCMonth() + 1
      const dd = today.getUTCDate()
      const hoje = birthdays.filter((b: any) => {
        const d = new Date(b.birth_date + 'T00:00:00')
        return d.getMonth() + 1 === mm && d.getDate() === dd
      })
      const proximos = birthdays.filter((b: any) => {
        const d = new Date(b.birth_date + 'T00:00:00')
        const daqui = new Date(today); daqui.setDate(dd + 7)
        const thisYear = new Date(today.getUTCFullYear(), d.getMonth(), d.getDate())
        return thisYear > today && thisYear <= daqui
      }).slice(0, 10)
      if (hoje.length) parts.push(`### Aniversariantes de hoje 🎂\n${hoje.map((b: any) => `- ${b.name}`).join('\n')}`)
      if (proximos.length) parts.push(`### Próximos aniversariantes (7 dias)\n${proximos.map((b: any) => {
        const d = new Date(b.birth_date + 'T00:00:00')
        return `- ${b.name} — ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
      }).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Estudos publicados (últimos 5)
  try {
    const { data: studies } = await admin
      .from('atis_studies').select('title,theme,base_text,refs').eq('published', true)
      .order('updated_at', { ascending: false }).limit(5)
    if (studies?.length) {
      parts.push(`### Estudos disponíveis\n${studies.map((s: any) => `- ${s.title}${s.theme ? ` (${s.theme})` : ''}${s.base_text ? ` — base: ${s.base_text}` : ''}`).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Planos de leitura ativos
  try {
    const { data: plans } = await admin
      .from('admin_plans').select('title,description,days,is_active')
      .eq('is_active', true).order('created_at', { ascending: false }).limit(10)
    if (plans?.length) {
      parts.push(`### Planos de leitura ativos\n${plans.map((p: any) => `- ${p.title}${p.days ? ` (${p.days} dias)` : ''}${p.description ? ` — ${String(p.description).slice(0,120)}` : ''}`).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Posts/devocionais recentes
  try {
    const { data: posts } = await admin
      .from('admin_posts').select('title,summary,category,published_at,is_published')
      .eq('is_published', true).order('published_at', { ascending: false }).limit(5)
    if (posts?.length) {
      parts.push(`### Posts/devocionais recentes\n${posts.map((p: any) => `- ${p.title}${p.category ? ` [${p.category}]` : ''}${p.summary ? ` — ${String(p.summary).slice(0,140)}` : ''}`).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Pedidos de oração públicos recentes (só título/resumo, respeitando privacidade)
  try {
    const { data: prayers } = await admin
      .from('prayer_requests').select('content,created_at')
      .eq('is_public', true).order('created_at', { ascending: false }).limit(5)
    if (prayers?.length) {
      parts.push(`### Pedidos de oração públicos recentes\n${prayers.map((p: any) => `- ${String(p.content).slice(0,120)}`).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Próximos lembretes de culto
  try {
    const todayStr2 = today.toISOString().slice(0,10)
    const { data: reminders } = await admin
      .from('culto_reminders').select('title,body,scheduled_for,is_sent')
      .gte('scheduled_for', todayStr2).order('scheduled_for').limit(5)
    if (reminders?.length) {
      parts.push(`### Próximos lembretes de culto\n${reminders.map((r: any) => `- ${r.title} — ${new Date(r.scheduled_for).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`).join('\n')}`)
    }
  } catch { /* ignore */ }

  // Info institucional a partir de admin_settings
  try {
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth()+1).padStart(2,'0')}-${String(today.getUTCDate()).padStart(2,'0')}`
    const { data: dv } = await admin
      .from('daily_verse_queue')
      .select('verse_ref,verse_text')
      .eq('scheduled_date', todayStr)
      .maybeSingle()
    if (dv?.verse_ref) {
      parts.push(`### Versículo de hoje\n${dv.verse_ref}\n${(dv.verse_text ?? '').trim()}`)
    }
  } catch { /* ignore */ }

  try {
    const { data: settings } = await admin
      .from('admin_settings').select('key,value')
      .in('key', ['church_info','ministry_info','contact_info'])
    for (const s of settings ?? []) {
      const v = s.value
      if (v && typeof v === 'object') {
        parts.push(`### ${s.key}\n${JSON.stringify(v, null, 2)}`)
      } else if (typeof v === 'string' && v.trim()) {
        parts.push(`### ${s.key}\n${v}`)
      }
    }
  } catch { /* ignore */ }

  return parts.length ? parts.join('\n\n') : '(Nenhuma informação institucional cadastrada ainda.)'
}

async function generateReply(persona: string, userText: string, ministryCtx: string, botName: string): Promise<string> {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
  const system = `${persona}\n\n---\nCONTEXTO DO MINISTÉRIO (dados oficiais atuais do sistema — use como fonte primária, cite apenas o que está aqui):\n${ministryCtx}\n\nData/hora atual (America/Fortaleza): ${now}\nSeu nome é ${botName || 'Atis'}.`
  const res = await aiChatFetch({
    model: 'google/gemini-2.5-flash',
    temperature: 0.6,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error(`[atis-webhook] AI ${res.status}: ${err.slice(0, 300)}`)
    return '🙏 Desculpe, não consegui responder agora. Tente novamente em instantes.'
  }
  const json = await res.json().catch(() => null) as any
  const reply = json?.choices?.[0]?.message?.content?.trim()
  return reply || '🙏 Desculpe, não consegui gerar uma resposta agora.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('ok')

  // Optional secret check (Evolution can forward custom headers)
  const providedSecret = req.headers.get('x-webhook-secret') ?? ''
  const secretOk = !WEBHOOK_SECRET || providedSecret === WEBHOOK_SECRET

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const payload = await req.json().catch(() => ({} as any))

  try {
    const event = payload?.event ?? payload?.type ?? 'unknown'

    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      const data = payload?.data ?? payload
      const messages = Array.isArray(data?.messages) ? data.messages : (data ? [data] : [])

      for (const msg of messages) {
        if (msg?.key?.fromMe) continue
        const jid: string = msg?.key?.remoteJid ?? ''
        const isGroup = jid.endsWith('@g.us')
        const text = extractText(msg).trim()
        if (!jid || !text) continue

        await admin.from('atis_messages_log').insert({
          direction: 'inbound',
          wa_from: jid,
          wa_group_id: isGroup ? jid : null,
          body: text,
          status: 'received',
          raw: { isGroup, secretOk },
        })

        if (!secretOk) continue

        const { data: cfg } = await admin.from('atis_config').select('*').eq('id', 1).maybeSingle()
        if (!cfg?.active) continue

        // Group behavior
        if (isGroup) {
          const { data: group } = await admin.from('atis_groups').select('*').eq('wa_group_id', jid).maybeSingle()
          const mode = group?.respond_mode ?? (cfg.mention_only_default ? 'mention_only' : 'always')
          if (mode === 'off' || (group && !group.active)) continue

          if (mode === 'mention_only') {
            const botNumber = (cfg.bot_number ?? '').replace(/\D/g, '')
            const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []
            const isMentioned = botNumber && mentioned.some((m: string) => m.includes(botNumber))
            const triggers: string[] = cfg.trigger_words ?? []
            const lower = text.toLowerCase()
            const hasTrigger = triggers.some((t) => t && lower.includes(t.toLowerCase()))
            if (!isMentioned && !hasTrigger) continue
          }
        }

        // Conversa natural com IA — usa persona configurada + contexto do ministério
        const persona: string = (cfg.persona ?? '').trim() || 'Você é Atis, assistente do Ministério Atalaias de Betel.'
        const ministryCtx = await buildMinistryContext(admin)
        const reply = await generateReply(persona, text, ministryCtx, cfg.bot_name ?? 'Atis')

        const sendRes = await sendText(jid, reply)
        await admin.from('atis_messages_log').insert({
          direction: 'outbound',
          wa_to: jid,
          wa_group_id: isGroup ? jid : null,
          body: reply,
          command: null,
          status: sendRes.ok ? 'sent' : 'error',
          raw: { ai: true, status: sendRes.status },
        })
      }
    } else if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      await admin.from('atis_messages_log').insert({
        direction: 'system',
        body: `connection: ${payload?.data?.state ?? payload?.state ?? '?'}`,
        status: 'info',
        raw: payload,
      })
    }
  } catch (e) {
    await admin.from('atis_messages_log').insert({
      direction: 'system',
      body: `webhook error: ${String((e as any)?.message ?? e)}`,
      status: 'error',
      raw: payload,
    }).catch(() => null)
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})