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
- Bíblia completa em 6 versões (ARA, ARC, ACF, NVI, NTLH, KJA) com troca instantânea, epígrafes e leitura offline após download
- Busca inteligente (tolerante a acentos) e busca por IA (semântica) para achar versículos por tema ou ideia
- Áudio da Bíblia (TTS) com destaque do versículo em reprodução e mini-player persistente
- Comparar versões lado a lado, letras vermelhas (palavras de Jesus), ajuste de fonte e modo escuro/claro/sépia
- Versículo do dia (rotativo, agendado em daily_verse_queue)
- Planos de leitura (admin_plans) — inscrição, progresso e sequência (streak)
- Harpa Cristã 640 hinos com letra, busca por número/tema, favoritos, histórico, modo apresentação, áudio (YouTube) e compartilhamento por link direto (/harpa/:numero)
- Descubra: posts/devocionais (admin_posts), história bíblica, quizzes
- Você: perfil, anotações, versículos salvos, sequência (streak), metas de leitura, pedidos de oração (públicos e privados)
- Ferramentas de IA por capítulo/versículo: Reflexão Devocional, Resumo do Capítulo, Significado da Palavra (original grego/hebraico), Linha do Tempo, Conexões cruzadas e "Pergunte à Bíblia"
- Compartilhamento de versículo como imagem gerada e link curto com convite ao app
- Agenda de cultos com lembretes push
- Notificações push (VAPID) para versículo do dia, cultos, planos e avisos
- Painel Atis (bot WhatsApp) integrando aniversariantes, grupos, estudos, broadcasts e comandos
- Página pública de privacidade (/privacidade) e termos (/termos); conta pode ser excluída pelo próprio usuário
- Funciona offline (Service Worker) — Bíblia e Harpa acessíveis sem internet; áudio e busca IA exigem conexão

### As 6 versões bíblicas disponíveis (para explicar quando perguntarem)
- ARA — Almeida Revista e Atualizada: linguagem clássica atualizada, equilíbrio entre fidelidade e leitura fluente. Boa para estudo devocional e pregação.
- ARC — Almeida Revista e Corrigida: texto tradicional, muito usado em igrejas históricas e evangélicas clássicas; preserva o "vós/tu".
- ACF — Almeida Corrigida Fiel: baseada no Textus Receptus, preferida por quem busca máxima proximidade com a tradição reformada/protestante clássica.
- NVI — Nova Versão Internacional: linguagem contemporânea, clara e precisa; ótima para leitura corrida e novos leitores.
- NTLH — Nova Tradução na Linguagem de Hoje: português simples e coloquial, ideal para crianças, novos convertidos e evangelismo.
- KJA — King James Atualizada: baseada na tradição da King James em português moderno, com beleza literária e reverência.
Como ajuda as pessoas: quem quer estudar profundamente compara ARA/ACF/NVI; quem está começando lê NTLH ou NVI; quem prega usa ARA/ARC; quem gosta de linguagem reverente escolhe KJA/ACF. Todas podem ser baixadas para uso offline.`

async function buildMinistryContext(admin: any): Promise<string> {
  const parts: string[] = []
  parts.push(APP_FEATURES)
  // Use America/Fortaleza (UTC-3, no DST) to compute "hoje"
  const nowFort = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const today = new Date(Date.UTC(nowFort.getUTCFullYear(), nowFort.getUTCMonth(), nowFort.getUTCDate()))
  const dow = today.getUTCDay()
  const nowMinutes = nowFort.getUTCHours() * 60 + nowFort.getUTCMinutes()
  const nowHHMM = `${String(nowFort.getUTCHours()).padStart(2,'0')}:${String(nowFort.getUTCMinutes()).padStart(2,'0')}`
  parts.push(`### Agora (America/Fortaleza)\n- Data: ${DIAS[dow]}, ${String(today.getUTCDate()).padStart(2,'0')}/${String(today.getUTCMonth()+1).padStart(2,'0')}/${today.getUTCFullYear()}\n- Hora: ${nowHHMM}`)

  // Cultos
  try {
    const { data: cultos } = await admin
      .from('culto_schedules').select('name,day_of_week,time,is_active')
      .eq('is_active', true).order('day_of_week').order('time')
    if (cultos?.length) {
      const linhas = cultos.map((c: any) => `- ${DIAS[c.day_of_week]} às ${String(c.time).slice(0,5)}: ${c.name}`).join('\n')
      parts.push(`### Cultos regulares\n${linhas}`)
      const hoje = cultos.filter((c: any) => c.day_of_week === dow)
      if (hoje.length) {
        const linhasHoje = hoje.map((c: any) => {
          const hhmm = String(c.time).slice(0,5)
          const [h, m] = hhmm.split(':').map(Number)
          const start = h * 60 + m
          const end = start + 120 // considera ~2h de duração
          let estado: string
          if (nowMinutes < start) estado = `AINDA VAI ACONTECER (futuro — faltam ${start - nowMinutes} min)`
          else if (nowMinutes <= end) estado = `ACONTECENDO AGORA (presente — começou há ${nowMinutes - start} min)`
          else estado = `JÁ ACONTECEU (passado — terminou há ${nowMinutes - end} min)`
          return `- ${c.name} às ${hhmm} — ${estado}`
        }).join('\n')
        parts.push(`### Culto de hoje (com estado em relação a agora ${nowHHMM})\n${linhasHoje}\n\nREGRA DE TEMPO VERBAL: ao falar de cada culto acima, use o tempo verbal indicado (passado / presente / futuro) conforme o estado. Ex.: "o culto foi às 19:30", "o culto está acontecendo agora", "o culto será às 19:30".`)
      }
    }
  } catch { /* ignore */ }

  // Aniversariantes hoje / próximos 7 dias
  try {
    const { data: birthdays } = await admin
      .from('atis_birthdays').select('name,birth_date').eq('active', true)
    if (birthdays?.length) {
      const mm = today.getUTCMonth() + 1
      const dd = today.getUTCDate()
      const parsed = birthdays.map((b: any) => {
        const d = new Date(b.birth_date + 'T00:00:00')
        return { name: b.name, day: d.getDate(), month: d.getMonth() + 1 }
      })
      const pad = (n: number) => String(n).padStart(2, '0')
      const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
      const DIAS_SEM = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']

      // Lista completa agrupada por mês (fonte de verdade para qualquer data)
      const porMes: Record<number, {name:string,day:number}[]> = {}
      for (const p of parsed) (porMes[p.month] ||= []).push({ name: p.name, day: p.day })
      for (const k of Object.keys(porMes)) porMes[+k].sort((a,b) => a.day - b.day)
      const listaCompleta = Object.keys(porMes).map(Number).sort((a,b) => a - b).map((m) => {
        const linhas = porMes[m].map((b) => `  • ${pad(b.day)}/${pad(m)} — ${b.name}`).join('\n')
        return `*${MESES[m-1]}*\n${linhas}`
      }).join('\n')
      parts.push(`### Lista COMPLETA de aniversariantes (fonte oficial — use SEMPRE esta lista para responder sobre qualquer dia, mês, semana, ontem, hoje, amanhã, próximo mês, etc.)\n${listaCompleta}`)

      // Resumos rápidos para janelas de tempo comuns
      const inDays = (n: number) => {
        const d = new Date(today); d.setUTCDate(d.getUTCDate() + n)
        return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, dow: d.getUTCDay() }
      }
      const matchDia = (day: number, month: number) => parsed.filter((p) => p.day === day && p.month === month)
      const fmtLista = (arr: {name:string}[]) => arr.length ? arr.map((b) => `- ${b.name}`).join('\n') : '(nenhum)'

      const ontem = inDays(-1); const hojeD = inDays(0); const amanha = inDays(1)
      parts.push(`### Atalhos de datas relativas (${DIAS_SEM[hojeD.dow]}, ${pad(hojeD.day)}/${pad(hojeD.month)})
- *Ontem* (${pad(ontem.day)}/${pad(ontem.month)}):
${fmtLista(matchDia(ontem.day, ontem.month))}
- *Hoje* (${pad(hojeD.day)}/${pad(hojeD.month)}):
${fmtLista(matchDia(hojeD.day, hojeD.month))}
- *Amanhã* (${pad(amanha.day)}/${pad(amanha.month)}):
${fmtLista(matchDia(amanha.day, amanha.month))}`)

      // Próximos 30 dias (esta semana, semana que vem, mês que vem, etc.)
      const prox30: string[] = []
      for (let i = 0; i <= 30; i++) {
        const dt = inDays(i)
        const ms = matchDia(dt.day, dt.month)
        if (!ms.length) continue
        const rotulo = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : i <= 7 ? `daqui a ${i} dias (${DIAS_SEM[dt.dow]})` : `em ${pad(dt.day)}/${pad(dt.month)} (${DIAS_SEM[dt.dow]})`
        prox30.push(`- ${pad(dt.day)}/${pad(dt.month)} — ${rotulo}: ${ms.map((m) => m.name).join(', ')}`)
      }
      if (prox30.length) parts.push(`### Próximos 30 dias\n${prox30.join('\n')}`)

      parts.push('### REGRA IMPORTANTE sobre aniversariantes\nSempre que perguntarem quem aniversaria/aniversariou em qualquer dia, semana ou mês (ontem, hoje, amanhã, semana passada, semana que vem, mês que vem, data específica, etc.), responda usando EXCLUSIVAMENTE a "Lista COMPLETA de aniversariantes" acima. Não diga que "não tem acesso" — a lista está aqui. Se ninguém aniversariar na data pedida, diga claramente "Ninguém aniversaria em <data>" de forma acolhedora.')
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

async function loadHistory(admin: any, jid: string, limit = 12): Promise<Array<{role:string,content:string}>> {
  try {
    const { data } = await admin
      .from('atis_messages_log')
      .select('direction,body,created_at')
      .or(`wa_from.eq.${jid},wa_to.eq.${jid}`)
      .in('direction', ['inbound', 'outbound'])
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!data?.length) return []
    return data.reverse()
      .filter((m: any) => m.body && m.body.trim())
      .map((m: any) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: String(m.body),
      }))
  } catch { return [] }
}

// ============================================================
// Ferramentas de IA da Bíblia Atalaia acessíveis pelo WhatsApp
// (mesma mecânica do app: exegese, conexões, palavra original,
//  linha do tempo, devocional, resumo)
// ============================================================
const TOOL_PROMPTS: Record<string, string> = {
  exegese:
    'Você é um exegeta bíblico acadêmico respondendo por WhatsApp. Sobre a referência fornecida, faça uma exegese COMPLETA e organizada com:\n' +
    '1) *Contexto histórico e cultural*\n2) *Palavras-chave no original* (hebraico/grego com transliteração)\n3) *Gênero literário e estrutura*\n4) *Significado teológico e aplicação*\n5) *Referências cruzadas*\n\n' +
    'Use formatação amigável ao WhatsApp: *negrito* com asteriscos simples, quebras de linha claras, sem markdown de header (#). Português brasileiro. Seja profundo mas acessível (800-1400 caracteres).',
  conexoes:
    'Você é estudioso bíblico especialista em intertextualidade, respondendo por WhatsApp. Sobre a referência fornecida:\n' +
    '1) Liste 4-6 *referências cruzadas* relevantes com a citação exata\n2) Para cada uma, explique em 1-2 frases a conexão\n3) Agrupe por tipo: paralelo direto, profecia/cumprimento, tema recorrente\n\n' +
    'Use *negrito* com asteriscos e quebras de linha. Português brasileiro.',
  palavra:
    'Você é linguista bíblico especialista em hebraico e grego, respondendo por WhatsApp. Sobre a referência fornecida:\n' +
    '1) Identifique 3-5 *palavras-chave* teologicamente significativas\n2) Para cada uma: palavra original (hebraico/grego), transliteração, significado literal e uso no contexto\n3) Explique nuances que se perdem na tradução\n\n' +
    'Formate como mini-dicionário usando *negrito* com asteriscos simples e quebras de linha. Português brasileiro.',
  linha_tempo:
    'Você é historiador bíblico respondendo por WhatsApp. Sobre a referência fornecida:\n' +
    '1) Situe no *período histórico* (data aproximada, império dominante, contexto social)\n2) Liste 4-6 eventos históricos relevantes em ordem cronológica\n3) Para cada evento: data, o que aconteceu, e como se relaciona ao texto\n\n' +
    'Formate como linha do tempo com emojis de época. Use *negrito* com asteriscos e quebras de linha. Português brasileiro.',
  devocional:
    'Você é pastor e escritor devocional respondendo por WhatsApp. A partir da referência fornecida, escreva uma *reflexão devocional* (2 parágrafos) que:\n' +
    '1) Conecte o texto ao cotidiano do leitor\n2) Traga uma aplicação prática e encorajadora\n\n' +
    'Seja caloroso. NÃO repita a citação do versículo no início — comece direto pela reflexão. Use *negrito* com asteriscos e quebras de linha. Português brasileiro.',
  resumo:
    'Você é teólogo acadêmico respondendo por WhatsApp. Sobre o capítulo/passagem fornecido, produza um *resumo conciso* (3-4 frases) destacando:\n' +
    '1) Tema principal\n2) Contexto narrativo/teológico\n3) Mensagem central\n\n' +
    'Direto e acessível. Use *negrito* com asteriscos. Português brasileiro.',
}

const TOOL_LABELS: Record<string, string> = {
  exegese: '📖 Exegese',
  conexoes: '🔗 Conexões bíblicas',
  palavra: '🔤 Significado original',
  linha_tempo: '🕰️ Linha do tempo',
  devocional: '💛 Reflexão devocional',
  resumo: '📝 Resumo do capítulo',
}

type ToolIntent = { tool: keyof typeof TOOL_PROMPTS | 'nenhum'; reference: string | null }

// Detecção 100% local (sem custo de IA) — palavras-chave + regex de referência bíblica.
const TOOL_KEYWORDS: Array<{ tool: keyof typeof TOOL_PROMPTS; patterns: RegExp[] }> = [
  { tool: 'exegese',     patterns: [/\bexeges[ei]/i, /exegeta[ií]/i, /estud[oa]\s+profund/i, /explica[çc][aã]o\s+profunda/i, /an[aá]lise\s+te[oó]l[oó]gica/i] },
  { tool: 'conexoes',    patterns: [/conex[oõ]es?\s+b[ií]blic/i, /refer[eê]ncias?\s+cruzad/i, /vers[ií]culos?\s+relacionad/i, /paralel[oa]s?\s+b[ií]blic/i, /outros?\s+vers[ií]culos/i] },
  { tool: 'palavra',     patterns: [/significad[oa]\s+(da\s+palavra|no\s+original|em\s+hebra|em\s+greg)/i, /\bhebrai[cç]/i, /\bgreg[oa]\b/i, /transliter/i, /etimolog/i, /palavra\s+original/i, /no\s+original/i] },
  { tool: 'linha_tempo', patterns: [/linha\s+do\s+tempo/i, /contexto\s+hist[oó]ric/i, /contexto\s+cultural/i, /[eé]poca/i, /cronolog/i, /quando\s+(aconteceu|foi\s+escrit)/i] },
  { tool: 'devocional',  patterns: [/devociona/i, /reflex[aã]o/i, /medita[çc][aã]o/i, /aplica[çc][aã]o\s+pr[aá]tic/i] },
  { tool: 'resumo',      patterns: [/\bresum[oai]/i, /sintetiz/i, /do\s+que\s+(fala|trata)/i, /sobre\s+o\s+que\s+[eé]/i] },
]

// Livros da Bíblia (nome + abreviações). Suporta "João 3:16", "Jo 3", "1 Coríntios 13:4-8", "Salmo 23".
const BOOK_ALTS = [
  'g[eê]nesis|gn','[eê]xodo|ex','lev[ií]tico|lv','n[uú]meros|nm','deuteron[oô]mio|dt',
  'josu[eé]|js','ju[ií]zes|jz','rute|rt','1\\s*samuel|1sm','2\\s*samuel|2sm',
  '1\\s*reis|1rs','2\\s*reis|2rs','1\\s*cr[oô]nicas|1cr','2\\s*cr[oô]nicas|2cr',
  'esdras|ed','neemias|ne','ester|et','j[oó]|j[oó]b','salm[oa]s?|sl',
  'prov[eé]rbios|pv','eclesiastes|ec','c[aâ]nticos?|ct','isa[ií]as|is','jeremias|jr',
  'lamenta[çc][oõ]es|lm','ezequiel|ez','daniel|dn','os[eé]ias|os','joel|jl',
  'am[oó]s|am','obadias|ob','jonas|jn','miqu[eé]ias|mq','naum|na','habacuque|hc',
  'sofonias|sf','ageu|ag','zacarias|zc','malaquias|ml',
  'mateus|mt','marcos|mc','lucas|lc','jo[aã]o|jo','atos|at','romanos|rm',
  '1\\s*cor[ií]ntios|1co','2\\s*cor[ií]ntios|2co','g[aá]latas|gl','ef[eé]sios|ef',
  'filipenses|fp','colossenses|cl','1\\s*tessalonicenses|1ts','2\\s*tessalonicenses|2ts',
  '1\\s*tim[oó]teo|1tm','2\\s*tim[oó]teo|2tm','tito|tt','filemom|fm','hebreus|hb',
  'tiago|tg','1\\s*pedro|1pe','2\\s*pedro|2pe','1\\s*jo[aã]o|1jo','2\\s*jo[aã]o|2jo',
  '3\\s*jo[aã]o|3jo','judas|jd','apocalipse|ap',
].join('|')
const REF_REGEX = new RegExp(`\\b(?:${BOOK_ALTS})\\s+\\d+(?::\\d+(?:\\s*[-–]\\s*\\d+)?)?`, 'i')

function extractReference(text: string, history: Array<{role:string,content:string}>): string | null {
  const m = text.match(REF_REGEX)
  if (m) return m[0].replace(/\s+/g, ' ').trim()
  // fallback: se o usuário usar "desse versículo/capítulo", pega da última resposta do assistente
  if (/\b(desse|desta|esse|essa|nesse|nessa|nesta|deste|neste)\s+(vers[ií]culo|cap[ií]tulo|passagem|texto)/i.test(text)) {
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? ''
    const m2 = lastAssistant.match(REF_REGEX)
    if (m2) return m2[0].replace(/\s+/g, ' ').trim()
  }
  return null
}

function detectToolIntent(userText: string, history: Array<{role:string,content:string}>): ToolIntent {
  const reference = extractReference(userText, history)
  if (!reference) return { tool: 'nenhum', reference: null }
  for (const { tool, patterns } of TOOL_KEYWORDS) {
    if (patterns.some((p) => p.test(userText))) return { tool, reference }
  }
  return { tool: 'nenhum', reference: null }
}

async function runTool(tool: keyof typeof TOOL_PROMPTS, reference: string): Promise<string> {
  const system = TOOL_PROMPTS[tool]
  const res = await aiChatFetch({
    model: 'google/gemini-2.5-flash',
    temperature: 0.5,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Referência: *${reference}*\n\nUse seu conhecimento do texto bíblico (versões brasileiras — ARA/ARC/NVI) para responder sobre essa passagem.` },
    ],
  })
  if (!res.ok) return '🙏 Não consegui gerar essa análise agora. Tente novamente em instantes.'
  const json = await res.json().catch(() => null) as any
  const body = json?.choices?.[0]?.message?.content?.trim()
  if (!body) return '🙏 Não consegui gerar essa análise agora.'
  const label = TOOL_LABELS[tool]
  return `${label} — *${reference}*\n\n${body}\n\n_Ferramenta da Bíblia Atalaia — ${APP_URL}_`
}

async function generateReply(persona: string, userText: string, ministryCtx: string, botName: string, history: Array<{role:string,content:string}>): Promise<string> {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
  const system = `${persona}\n\n---\nCONTEXTO OFICIAL DO APP E DO MINISTÉRIO (dados atuais do sistema — use SEMPRE como fonte primária para qualquer pergunta sobre o app, funções, planos, hinos, cultos, aniversariantes, versículo do dia, posts, pedidos de oração, estudos etc. Nunca diga que "não tem essa função" sem antes checar aqui):\n${ministryCtx}\n\nData/hora atual (America/Fortaleza): ${now}\nSeu nome é ${botName || 'Atis'}. Quando o usuário perguntar sobre alguma função do app, responda com base neste contexto e indique o link ${'https://biblia.atalaias.online'} quando útil.\n\nMEMÓRIA DA CONVERSA: mensagens anteriores desta conversa foram fornecidas abaixo — mantenha continuidade e NÃO se apresente novamente a cada resposta. Só se apresente na primeira interação ou se o usuário pedir.`
  const res = await aiChatFetch({
    model: 'google/gemini-2.5-flash',
    temperature: 0.6,
    messages: [
      { role: 'system', content: system },
      ...history,
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
        const history = await loadHistory(admin, jid, 12)

        // Primeiro tenta detectar se o usuário pediu uma ferramenta da Bíblia Atalaia
        // (exegese, conexões, palavra original, linha do tempo, devocional, resumo).
        // Detecção 100% local — sem custo de IA.
        const intent = detectToolIntent(text, history)
        let reply: string
        let usedTool: string | null = null
        if (intent.tool !== 'nenhum' && intent.reference) {
          reply = await runTool(intent.tool as keyof typeof TOOL_PROMPTS, intent.reference)
          usedTool = intent.tool
        } else {
          const ministryCtx = await buildMinistryContext(admin)
          reply = await generateReply(persona, text, ministryCtx, cfg.bot_name ?? 'Atis', history)
        }

        const sendRes = await sendText(jid, reply)
        await admin.from('atis_messages_log').insert({
          direction: 'outbound',
          wa_to: jid,
          wa_group_id: isGroup ? jid : null,
          body: reply,
          command: usedTool,
          status: sendRes.ok ? 'sent' : 'error',
          raw: { ai: true, status: sendRes.status, tool: usedTool, reference: intent.reference },
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