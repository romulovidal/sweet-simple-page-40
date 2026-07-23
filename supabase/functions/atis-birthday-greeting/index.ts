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
  const mmdd = `${g('month')}-${g('day')}`
  const hour = parseInt(g('hour'), 10)
  const period = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 18 ? 'tarde' : hour >= 18 ? 'noite' : 'madrugada'
  return { dateKey, timeKey, mmdd, hour, period }
}

async function generateGreeting(names: string[], template: string | null, period: string): Promise<string> {
  const greeting = period === 'manhã' ? 'Bom dia' : period === 'tarde' ? 'Boa tarde' : period === 'noite' ? 'Boa noite' : 'Paz do Senhor'
  const list = names.map((n) => `• ${n}`).join('\n')

  if (template && template.trim()) {
    return template
      .replaceAll('{nomes}', names.join(', '))
      .replaceAll('{lista}', list)
      .replaceAll('{saudacao}', greeting)
  }
  if (!hasAnyAiKey()) {
    return `🎉✨ ${greeting}, amada família Atalaias de Betel! ✨🎉\n\nHoje o céu se alegra e a nossa igreja também, porque Deus, em Seu infinito amor, nos presenteou com mais um ano de vida de pessoas muito especiais:\n\n${list}\n\n"O Senhor te abençoe e te guarde; o Senhor faça resplandecer o Seu rosto sobre ti e tenha misericórdia de ti; o Senhor sobre ti levante o Seu rosto e te dê a paz." (Números 6:24-26)\n\nQue este novo ciclo seja marcado por saúde, propósito, sonhos realizados e uma intimidade cada vez maior com o Senhor Jesus. Nós te amamos e celebramos com você! 🎂🙏🕊️\n\n— Com carinho, Igreja Atalaias de Betel`
  }
  const systemPrompt =
            'Você é Atis, o assistente da Igreja Atalaias de Betel. Sua missão agora é escrever UMA mensagem de aniversário CAPRICHADA, calorosa, poética e profundamente cristã, para ser enviada em um GRUPO de WhatsApp da igreja, parabenizando o(s) aniversariante(s) do dia. Nada de mensagens genéricas, chulas ou copiadas — cada mensagem precisa parecer feita à mão, com sentimento pastoral verdadeiro.\n\n' +
            'ESTRUTURA OBRIGATÓRIA (em parágrafos separados por uma linha em branco, sem títulos, sem markdown, sem asteriscos):\n' +
            `1) Abertura festiva começando com "${greeting}, amada família Atalaias de Betel!" acompanhada de 2 a 3 emojis (🎉🎂✨🕊️🙌). Depois, uma frase bonita reconhecendo que hoje é um dia especial, que o céu se alegra junto com a igreja.\n` +
            '2) Homenagem nominal: cite cada aniversariante em uma lista com "• Nome", e faça uma frase carinhosa antes ou depois da lista mencionando o valor de cada vida para o Corpo de Cristo.\n' +
            '3) UM versículo bíblico REAL, com referência EXATA (livro, capítulo e versículo), preferencialmente ARA ou ARC, escrito entre aspas, sobre vida, bênção, propósito, gratidão, alegria ou fidelidade de Deus. NUNCA invente referências. Varie o versículo a cada mensagem.\n' +
            '4) Bênção pastoral personalizada em 3 a 4 frases: fale de saúde, longevidade, propósito, sonhos, família, chamado, comunhão com Jesus e derramar do Espírito Santo. Use uma linguagem quente, próxima, como um pastor abraçando um irmão.\n' +
            '5) Encerramento em uma linha só, começando com "— Com carinho," seguido de "Igreja Atalaias de Betel" e 1 emoji discreto.\n\n' +
            'DIRETRIZES DE ESTILO:\n' +
            '- Tom: acolhedor, digno, cheio de fé, celebrativo, jamais infantil.\n' +
            '- Português do Brasil, natural e fluído. Sem clichês de cartão como "tudo de bom".\n' +
            '- Emojis usados com bom gosto (máximo 6 na mensagem inteira, bem distribuídos).\n' +
            '- NADA de markdown (nada de **negrito**, #, ou listas com "-"). Use apenas "•" para a lista de nomes.\n' +
            '- Entre 900 e 1400 caracteres.\n' +
            '- VARIE bastante a cada execução: mude o versículo, as imagens, as palavras, a ordem interna dos parágrafos 3 e 4 se quiser, mantendo a estrutura.\n' +
            '- Retorne SOMENTE o texto final da mensagem, sem comentários, sem aspas envolvendo tudo.'
  const userPrompt =
    `Aniversariante(s) de hoje (${names.length === 1 ? '1 pessoa' : `${names.length} pessoas`}): ${names.join(', ')}.\n` +
    `Período do dia: ${period} (use isso para dar naturalidade à saudação, mas mantenha "${greeting}, amada família Atalaias de Betel!" como abertura).\n` +
    'Escreva agora a mensagem de aniversário completa, caprichada e única, seguindo todas as diretrizes.'
  const text = await aiGenerateText({
    system: systemPrompt,
    user: userPrompt,
    temperature: 1.1,
    maxTokens: 4096,
  })
  if (!text) {
    return `🎂 ${greeting}, família!\n\nHoje é aniversário de:\n${list}\n\nParabéns! Que Deus abençoe grandemente. 🙏`
  }
  return text
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

function phoneVariants(to: string): string[] {
  if (to.includes('@')) return [to]
  const digits = to.replace(/\D/g, '')
  if (!digits) return []
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  const ddd = withCountry.slice(2, 4)
  const rest = withCountry.slice(4)
  const variants = new Set<string>()
  variants.add(withCountry)
  if (rest.length === 9 && rest.startsWith('9')) variants.add(`55${ddd}${rest.slice(1)}`)
  else if (rest.length === 8) variants.add(`55${ddd}9${rest}`)
  return [...variants].map((n) => `${n}@s.whatsapp.net`)
}

async function sendDirect(phone: string, text: string) {
  if (!EVO_URL || !EVO_KEY) return { ok: false, status: 0, body: 'evolution not configured' }
  const attempts = phoneVariants(phone)
  let last = { ok: false, status: 0, body: '' as any }
  for (const jid of attempts) {
    const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: jid, text }),
    })
    const body = await res.text().catch(() => '')
    last = { ok: res.ok, status: res.status, body }
    if (res.ok) return last
    if (!String(body).includes('"exists":false')) return last
  }
  return last
}

async function generatePersonalGreeting(name: string, period: string): Promise<string> {
  const saud = period === 'manhã' ? 'Bom dia' : period === 'tarde' ? 'Boa tarde' : period === 'noite' ? 'Boa noite' : 'Paz do Senhor'
  const fallback = `🎂 ${saud}, ${name}! Hoje é o seu dia, e toda a família Atalaias de Betel celebra com você. 🎉\n\n"O Senhor te abençoe e te guarde." (Números 6:24)\n\nQue este novo ano de vida seja repleto de saúde, propósito e uma comunhão cada vez mais profunda com Jesus. Nós te amamos! 🙏🕊️\n\n— Igreja Atalaias de Betel`
  if (!hasAnyAiKey()) return fallback
  const system =
    'Você é Atis, assistente da Igreja Atalaias de Betel. Escreva uma mensagem PESSOAL de aniversário para ser enviada por WhatsApp DIRETAMENTE ao aniversariante (não em grupo). ' +
    'Estrutura: 1) saudação carinhosa começando com o nome; 2) reconhecimento pastoral do valor da vida do irmão(ã); 3) UM versículo bíblico REAL com referência exata (nunca invente), sobre vida/bênção/propósito, entre aspas; 4) bênção pessoal em 2-3 frases falando de saúde, sonhos e comunhão com Jesus; 5) assinatura em uma linha só: "— Igreja Atalaias de Betel" com 1 emoji discreto. ' +
    'Tom acolhedor, digno, português do Brasil, sem markdown, sem asteriscos, sem títulos. Até 6 emojis bem distribuídos. Entre 500 e 900 caracteres. Retorne SOMENTE a mensagem final.'
  const text = await aiGenerateText({
    system,
    user: `Aniversariante: ${name}. Período: ${period}. Escreva a mensagem pessoal agora.`,
    temperature: 1.1,
    maxTokens: 2048,
  })
  return text || fallback
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

  const { data: bdays } = await admin.from('atis_birthdays').select('name,birth_date,active,phone')
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

  // DM pessoal ao(s) aniversariante(s) que têm telefone cadastrado
  const dms: any[] = []
  for (const b of todays) {
    const phone = String((b as any).phone ?? '').trim()
    if (!phone) continue
    const personal = await generatePersonalGreeting(b.name, period)
    const r = await sendDirect(phone, personal)
    dms.push({ name: b.name, phone, ok: r.ok, status: r.status })
    await admin.from('atis_messages_log').insert({
      direction: 'outbound',
      wa_to: phone,
      body: personal,
      command: 'birthday-greeting-dm',
      status: r.ok ? 'sent' : 'error',
      raw: { auto: !force, ai: true, name: b.name, http: r.status, body: r.body?.slice?.(0, 300) },
    })
  }

  if (!force) {
    await admin.from('admin_settings').upsert(
      { key: 'atis_birthday_greeting', value: { ...cfg, last_sent_date: dateKey } },
      { onConflict: 'key' },
    )
  }

  return new Response(JSON.stringify({ ok: true, sent: results.length, dms_sent: dms.length, names, results, dms, preview: text.slice(0, 200) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})