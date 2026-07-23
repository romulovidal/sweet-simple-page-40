import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiChatFetch } from '../_shared/ai-fetch.ts'
import { evolutionSendText, evolutionSendButtons } from '../_shared/atis-evolution.ts'

const EVO_URL = Deno.env.get('EVOLUTION_API_URL')!.replace(/\/$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY')!
const INSTANCE = 'atis'
const WEBHOOK_SECRET = Deno.env.get('ATIS_WEBHOOK_SECRET') ?? ''

// ============================================================
// Detecção de crise — palavras-chave locais + acompanhamento de crise ativa
// ============================================================
const DEFAULT_CRISIS_KEYWORDS = [
  // Ideação suicida — verbos "matar/morrer"
  'me matar', 'me matando', 'me mato', 'vou me matar', 'quero me matar', 'pensando em me matar',
  'quero morrer', 'queria morrer', 'quero estar morto', 'quero estar morta',
  'preferia estar morto', 'preferia estar morta', 'melhor morrer', 'melhor estar morto', 'melhor estar morta',
  'tirar minha vida', 'tirar a minha vida', 'dar fim a minha vida', 'dar fim na minha vida', 'dar fim a vida',
  'acabar com minha vida', 'acabar com a minha vida', 'acabar comigo', 'acabar com tudo', 'por fim a tudo', 'pôr fim a tudo',
  'suicid', 'me suicidar', 'cometer suicidio', 'cometer suicídio', 'tentativa de suicidio', 'tentativa de suicídio',
  // Desaparecer / desistir
  'quero sumir', 'sumir do mundo', 'sumir daqui', 'quero desaparecer', 'desaparecer do mundo',
  'não quero mais viver', 'nao quero mais viver', 'não quero viver', 'nao quero viver',
  'cansei de viver', 'cansada de viver', 'cansado de viver',
  'não vejo saída', 'nao vejo saida', 'sem saída', 'sem saida', 'não tem saída', 'nao tem saida',
  'sem esperança', 'sem esperanca', 'perdi a esperança', 'perdi a esperanca', 'sem futuro',
  'não aguento mais', 'nao aguento mais', 'não aguento mais viver', 'nao aguento mais viver',
  'não vale a pena', 'nao vale a pena', 'ninguém vai sentir minha falta', 'ninguem vai sentir minha falta',
  'seria melhor sem mim', 'todos ficariam melhor sem mim', 'sou um peso',
  // Planejamento
  'como me matar', 'jeito de me matar', 'me jogar', 'me enforcar', 'enforcamento',
  'tomar veneno', 'tomar remedio pra morrer', 'tomar remédio pra morrer',
  'overdose', 'engolir remedios', 'engolir remédios', 'cortar os pulsos',
  'carta de despedida', 'ultima mensagem', 'última mensagem',
  // Autolesão
  'me machucar', 'me machuco', 'me cortar', 'me corto', 'me ferir', 'me ferindo',
  'me bater', 'me punir', 'me queimar',
  // Abuso / violência
  'sofri abuso', 'fui abusad', 'fui estuprad', 'estupro',
  'apanhei', 'estão me batendo', 'estao me batendo',
  'sofro violência', 'sofro violencia', 'violência doméstica', 'violencia domestica',
  // Depressão severa
  'depressão profunda', 'depressao profunda', 'depressão severa', 'depressao severa',
  'crise de panico', 'crise de pânico', 'crise suicida',
]

// Rodapé com CVV/188 — anexado à resposta empática gerada pela IA.
const CRISIS_FOOTER = `\n\n━━━━━━━━━━━━━━\n📞 *CVV — 188* (24h, gratuito, sigiloso)\n💬 https://www.cvv.org.br (chat online)\n\n"Perto está o Senhor dos que têm o coração quebrantado, e salva os contritos de espírito." (Salmos 34:18)`

const CRISIS_FALLBACK_REPLY = `🕊️ Ouvi você. Você não está sozinho(a) — o que sente importa e Deus se importa profundamente com sua dor.\n\nRespire fundo. Sua vida tem valor imenso. Se você está em risco imediato, procure ajuda agora mesmo:${CRISIS_FOOTER}`

async function generateCrisisReply(userText: string): Promise<string> {
  try {
    const system = `Você é um assistente pastoral cristão respondendo a alguém que acabou de expressar sofrimento emocional intenso, ideação suicida ou dor profunda. Seu papel:

1. ACOLHER com empatia genuína e sem julgamento (2-4 frases curtas).
2. VALIDAR o sentimento — nunca minimize ("vai passar", "poderia ser pior" são PROIBIDOS).
3. TRAZER esperança suave em Cristo, sem sermão longo nem culpa espiritual.
4. NÃO diga "estou avisando um pastor" nem revele qualquer ação de bastidor. NÃO peça dados.
5. NÃO cite CVV/188 no corpo (será anexado automaticamente).

Tom: pastor amigo, calmo, próximo. Português brasileiro. Use *negrito* com asteriscos. Máximo 6 linhas curtas. Pode incluir 1 versículo pequeno se couber naturalmente.`
    const res = await aiChatFetch({
      model: 'google/gemini-2.5-flash',
      temperature: 0.6,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText.slice(0, 800) },
      ],
    })
    if (!res.ok) return CRISIS_FALLBACK_REPLY
    const json = await res.json().catch(() => null) as any
    const body = json?.choices?.[0]?.message?.content?.trim()
    if (!body) return CRISIS_FALLBACK_REPLY
    return `${body}${CRISIS_FOOTER}`
  } catch {
    return CRISIS_FALLBACK_REPLY
  }
}

async function detectCrisis(admin: any, text: string): Promise<{ matched: string[]; extras: string[] }> {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const lower = norm(text)
  let extras: string[] = []
  try {
    const { data: cfgRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_crisis_alert').maybeSingle()
    const custom = (cfgRow?.value as any)?.custom_keywords
    if (Array.isArray(custom)) extras = custom.filter((k) => typeof k === 'string' && k.trim())
  } catch { /* ignore */ }
  const all = Array.from(new Set([...DEFAULT_CRISIS_KEYWORDS, ...extras].map(norm).filter(Boolean)))
  const matched = Array.from(new Set(all.filter((k) => lower.includes(k))))
  return { matched, extras }
}

async function getRecentActiveCrisis(admin: any, phone: string): Promise<{ id: string; created_at: string } | null> {
  try {
    const phoneDigits = String(phone).split('@')[0].replace(/\D/g, '')
    const candidates = Array.from(new Set([phone, phoneDigits].filter(Boolean)))
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('atis_crisis_alerts')
      .select('id,created_at')
      .in('contact_phone', candidates)
      .eq('handled', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
    return data?.[0] ?? null
  } catch {
    return null
  }
}

// Crise já RESOLVIDA recentemente (últimas 72h). Usado para detectar REINCIDÊNCIA:
// se a pessoa volta a mostrar sinais logo após um "resolvido", tratamos como risco
// automaticamente (sem filtro de IA) e sinalizamos aos pastores.
async function getRecentResolvedCrisis(admin: any, phone: string): Promise<{ id: string; created_at: string; handled_at: string | null } | null> {
  try {
    const phoneDigits = String(phone).split('@')[0].replace(/\D/g, '')
    const candidates = Array.from(new Set([phone, phoneDigits].filter(Boolean)))
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('atis_crisis_alerts')
      .select('id,created_at,handled_at')
      .in('contact_phone', candidates)
      .eq('handled', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
    return data?.[0] ?? null
  } catch {
    return null
  }
}

// Classificação por IA: só dispara alerta se o CONTEXTO indicar risco real,
// evitando falsos positivos (ex.: "não me mate de rir", citação bíblica,
// pergunta teórica, letra de música, terceira pessoa hipotética).
async function classifyCrisisContext(text: string): Promise<{ risk: boolean; reason: string; confidence: number }> {
  try {
    const system = `Você é um classificador clínico-pastoral. Sua tarefa: analisar UMA mensagem de WhatsApp e decidir se ela indica que a PRÓPRIA pessoa está em risco emocional REAL agora (ideação suicida, autolesão, abuso sofrido, violência doméstica sofrida, depressão severa em primeira pessoa, desespero real).\n\nResponda APENAS em JSON: {"risk": boolean, "confidence": 0-1, "reason": "curta"}.\n\nDIGA risk=false quando:\n- Expressão figurativa/humorística ("morri de rir", "tô morta de cansaço", "me mata de rir")\n- Citação bíblica, letra de música, versículo, pregação, comentário teológico\n- Fala sobre TERCEIROS ("meu amigo quer se matar" → risk=true só se pedir ajuda para si; caso genérico → false)\n- Pergunta acadêmica/teórica ("o que a Bíblia diz sobre suicídio?")\n- Frustração leve ("quero sumir dessa reunião")\n- Testes do sistema ("teste", "oi", palavra isolada sem contexto emocional)\n\nDIGA risk=true quando:\n- Primeira pessoa expressando dor real ("eu não aguento mais", "quero morrer", "vou me matar")\n- Relato de abuso ou violência que a pessoa está sofrendo\n- Desespero, desesperança, ausência de sentido em tom pessoal\n- Pedido de ajuda emocional urgente\n- Menção a método/plano de autolesão`
    const res = await aiChatFetch({
      model: 'google/gemini-2.5-flash',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Mensagem: """${text.slice(0, 800)}"""` },
      ],
    })
    if (!res.ok) return { risk: true, reason: 'ai_error_fail_safe', confidence: 0 }
    const json = await res.json().catch(() => null) as any
    const raw = json?.choices?.[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''))
    return {
      risk: !!parsed.risk,
      reason: String(parsed.reason ?? '').slice(0, 200),
      confidence: Number(parsed.confidence ?? 0),
    }
  } catch (e) {
    console.error('[atis-webhook] classifyCrisisContext error', e)
    // Fail-safe: em caso de erro do classificador, dispara mesmo assim (segurança primeiro).
    return { risk: true, reason: 'parse_error_fail_safe', confidence: 0 }
  }
}

async function handleCrisis(admin: any, phone: string, name: string | null, text: string, matched: string[], recurrence: boolean = false): Promise<void> {
  const { data: cfgRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_crisis_alert').maybeSingle()
  const cfg = (cfgRow?.value ?? {}) as { enabled?: boolean; pastor_phones?: string[]; alert_template?: string }
  const enabled = cfg.enabled !== false
  const allPastors = Array.isArray(cfg.pastor_phones) ? cfg.pastor_phones.filter(Boolean) : []

  // Remove pastores que silenciaram esta pessoa (aceita variação 12↔13 do 9º dígito)
  const contactDigits = String(phone).split('@')[0].replace(/\D/g, '')
  const brVar = (d: string): string[] => {
    const out = new Set<string>([d])
    if (d.startsWith('55')) {
      const ddd = d.slice(2, 4); const rest = d.slice(4)
      if (rest.length === 9 && rest.startsWith('9')) out.add(`55${ddd}${rest.slice(1)}`)
      if (rest.length === 8) out.add(`55${ddd}9${rest}`)
    }
    return [...out]
  }
  let mutedPastors: string[] = []
  try {
    const { data: mutes } = await admin
      .from('atis_crisis_mutes')
      .select('pastor_phone,contact_phone')
      .in('contact_phone', brVar(contactDigits))
    mutedPastors = (mutes ?? []).flatMap((m: any) => brVar(String(m.pastor_phone).replace(/\D/g, '')))
  } catch { /* ignore */ }
  const pastors = allPastors.filter((p) => !brVar(String(p).replace(/\D/g, '')).some((v) => mutedPastors.includes(v)))

  const snippet = text.slice(0, 220)
  const nameStr = name ?? '(sem nome)'
  const phoneDigits = String(phone).split('@')[0].replace(/\D/g, '')
  const phonePretty = phoneDigits ? `+${phoneDigits}` : phone
  const nowStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date())
  const helpLine = `\n\n_Vote na enquete abaixo ou responda por texto: "resolvido ${phonePretty}" (encerra p/ todos) · "silenciar ${phonePretty}" (para só de te avisar)._`
  const recurrenceBadge = recurrence ? `⚠️ *REINCIDÊNCIA — crise reaberta em menos de 72h*\n\n` : ''
  const renderedAlert = (cfg.alert_template && cfg.alert_template.trim())
    ? cfg.alert_template
        .replaceAll('{nome}', nameStr)
        .replaceAll('{numero}', phonePretty)
        .replaceAll('{mensagem}', snippet)
        .replaceAll('{palavras}', matched.join(', '))
        .replaceAll('{horario}', nowStr)
    : `🚨 *ALERTA PASTORAL — Atis*\n\nUma pessoa enviou uma mensagem que pode indicar crise ou risco:\n\n👤 *${nameStr}*\n📱 ${phonePretty}\n🔑 Palavras detectadas: _${matched.join(', ')}_\n\n💬 Mensagem:\n"${snippet}"\n\nRecomenda-se contato pastoral o quanto antes. 🙏`
  // Inclui horário para auditoria e para evitar bloqueio/deduplicação de mensagens idênticas pelo provedor.
  const alertMsg = `${recurrenceBadge}${renderedAlert.trim()}\n\n🕒 ${nowStr}${helpLine}`

  let notified = false
  if (enabled && pastors.length) {
    for (const p of pastors) {
      // Envia alerta já com os botões de ação. O helper faz fallback para texto
      // puro automaticamente se o provedor rejeitar o formato de botões.
      const r = await evolutionSendButtons(
        p,
        alertMsg,
        [
          { id: `resolvido ${phoneDigits}`, displayText: '✅ Resolvido' },
          { id: `silenciar ${phoneDigits}`, displayText: '🔕 Silenciar' },
        ],
        { footer: 'Toque em um botão para agir sobre este alerta.' },
      )
      if (r.ok) notified = true
      await admin.from('atis_messages_log').insert({
        direction: 'outbound', wa_to: p, body: alertMsg,
        command: 'crisis-alert', status: r.ok ? 'sent' : 'error',
        raw: { auto: true, contact: phone, http: r.status, jid: r.jid, provider_body: r.body },
      })
    }
  }

  await admin.from('atis_crisis_alerts').insert({
    contact_phone: phone, contact_name: name,
    matched_keywords: matched,
    severity: recurrence ? 'high' : (matched.some((k) => k.includes('mat') || k.includes('suicid') || k.includes('sumir')) ? 'high' : 'medium'),
    snippet, pastor_notified: notified,
  })
}

async function sendText(jid: string, text: string) {
  return fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number: jid, text, linkPreview: true }),
  })
}

async function sendMediaImage(jid: string, imageUrl: string, caption: string) {
  return fetch(`${EVO_URL}/message/sendMedia/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({
      number: jid,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: imageUrl,
      caption,
      linkPreview: true,
    }),
  })
}

function extractText(msg: any): string {
  // Voto em enquete (poll) — Evolution v2 pode emitir em vários shapes.
  const pollOpt =
    msg?.message?.pollUpdateMessage?.vote?.selectedOptions?.[0]?.optionName ??
    msg?.message?.pollUpdateMessage?.vote?.selectedOptions?.[0]?.name ??
    msg?.pollUpdate?.selectedOptions?.[0]?.optionName ??
    msg?.pollUpdate?.selectedOptions?.[0]?.name ??
    msg?.message?.pollVoteMessage?.selectedOptions?.[0]?.optionName ??
    null;
  if (pollOpt && typeof pollOpt === 'string') {
    // As opções seguem o formato "<label> • <comando>". Extrai só o comando.
    const parts = pollOpt.split('•');
    return (parts.length > 1 ? parts.slice(1).join('•') : pollOpt).trim();
  }
  return (
    msg?.message?.conversation ??
    msg?.message?.extendedTextMessage?.text ??
    msg?.message?.imageMessage?.caption ??
    msg?.message?.videoMessage?.caption ??
    msg?.message?.buttonsResponseMessage?.selectedButtonId ??
    msg?.message?.templateButtonReplyMessage?.selectedId ??
    msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
    msg?.message?.interactiveResponseMessage?.body?.text ??
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

### REGRA CRÍTICA — Hinos da Harpa Cristã
NUNCA invente letra, título ou número de hino. Se o usuário pedir um hino específico (por número ou por título), o sistema tem um handler dedicado que responde ANTES da IA lendo o JSON oficial (${APP_URL}/harpa/harpa-crista.json) — você NÃO deve responder pedidos de hino. Se por algum motivo chegar até você um pedido de hino, apenas oriente: "Abra a Harpa Cristã no app: ${APP_URL}/harpa (ou ${APP_URL}/harpa/NÚMERO)". Nunca escreva estrofes ou títulos que você não tenha certeza — não temos os hinos como texto no seu contexto.
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

      const anteontem = inDays(-2); const ontem = inDays(-1); const hojeD = inDays(0); const amanha = inDays(1); const depoisAmanha = inDays(2)
      parts.push(`### Atalhos de datas relativas (${DIAS_SEM[hojeD.dow]}, ${pad(hojeD.day)}/${pad(hojeD.month)})
- *Anteontem* (${pad(anteontem.day)}/${pad(anteontem.month)}):
${fmtLista(matchDia(anteontem.day, anteontem.month))}
- *Ontem* (${pad(ontem.day)}/${pad(ontem.month)}):
${fmtLista(matchDia(ontem.day, ontem.month))}
- *Hoje* (${pad(hojeD.day)}/${pad(hojeD.month)}):
${fmtLista(matchDia(hojeD.day, hojeD.month))}
- *Amanhã* (${pad(amanha.day)}/${pad(amanha.month)}):
${fmtLista(matchDia(amanha.day, amanha.month))}
- *Depois de amanhã* (${pad(depoisAmanha.day)}/${pad(depoisAmanha.month)}):
${fmtLista(matchDia(depoisAmanha.day, depoisAmanha.month))}`)

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

      parts.push(`### REGRAS RÍGIDAS sobre aniversariantes (NÃO VIOLAR)
1. Use EXCLUSIVAMENTE os dados acima. Nunca invente, deduza ou "arredonde" datas.
2. Cada pergunta refere-se a UM único dia (ou intervalo explícito). NUNCA misture pessoas de dias diferentes na mesma resposta.
   - "ontem" = APENAS a data ${pad(ontem.day)}/${pad(ontem.month)}. Não inclua ${pad(anteontem.day)}/${pad(anteontem.month)} nem ${pad(hojeD.day)}/${pad(hojeD.month)}.
   - "hoje" = APENAS ${pad(hojeD.day)}/${pad(hojeD.month)}.
   - "amanhã" = APENAS ${pad(amanha.day)}/${pad(amanha.month)}.
   - "anteontem" = APENAS ${pad(anteontem.day)}/${pad(anteontem.month)}.
3. Antes de responder, cite mentalmente a data exata (dd/mm) que a pergunta cobre e liste APENAS os nomes que estão na linha daquela data nos "Atalhos de datas relativas" acima. Se a linha estiver vazia ou "(nenhum)", responda: "Ninguém aniversaria em <data>" de forma acolhedora.
4. Se a pergunta for por semana/mês/intervalo, use a "Lista COMPLETA" e liste TODOS que caem no intervalo — sem misturar com datas fora dele.`)
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
const REF_REGEX = new RegExp(`\\b(?:${BOOK_ALTS})\\s+\\d+(?::\\d+(?:\\s*[-–]\\s*\\d+)?(?:\\s*,\\s*\\d+(?:\\s*[-–]\\s*\\d+)?)*)?`, 'i')

// ============================================================
// Harpa Cristã — busca REAL no JSON oficial (sem invenção da IA)
// ============================================================
type HarpaSecao = { tipo: string; numero?: number; linhas: string[] }
type HarpaHino = { numero: number; titulo: string; secoes: HarpaSecao[] }
let HARPA_CACHE: HarpaHino[] | null = null

async function loadHarpa(): Promise<HarpaHino[]> {
  if (HARPA_CACHE) return HARPA_CACHE
  try {
    const res = await fetch(`${APP_URL}/harpa/harpa-crista.json`)
    if (!res.ok) return []
    const j = await res.json() as any
    HARPA_CACHE = Array.isArray(j?.hinos) ? j.hinos : []
    return HARPA_CACHE ?? []
  } catch (e) {
    console.error('[harpa] load failed:', (e as Error)?.message)
    return []
  }
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// Detecta pedido de hino. Retorna { numero } ou { titulo } ou null.
function detectHarpaIntent(text: string): { numero?: number; titulo?: string } | null {
  const t = text.trim()
  const low = normalize(t)
  // Precisa mencionar hino/harpa/cântico OU vir de um pedido curto explícito
  const hasKeyword = /\b(hino|harpa|c[aâ]ntico|cantico|harpa\s+crist[ãa])\b/i.test(t)
  if (!hasKeyword) return null
  // Ignora se for pergunta sobre a Harpa como funcionalidade (contém "funciona", "como usar" etc.)
  if (/\b(como\s+funciona|o\s+que\s+e|como\s+usar|quantos\s+hinos|quantos\s+t[eê]m)\b/i.test(low)) return null

  // 1) Número explícito
  const mNum = t.match(/\b(?:hino|harpa|c[aâ]ntico|cantico|n[uú]mero|nº|no\.?)\s*(?:de\s+)?n?[°º]?\s*(\d{1,3})\b/i)
    ?? t.match(/\b(\d{1,3})\s*(?:da\s+harpa|hino)\b/i)
  if (mNum) {
    const n = parseInt(mNum[1], 10)
    if (n >= 1 && n <= 640) return { numero: n }
  }
  // 2) Título após "hino"/"harpa": ex. "quero o hino Chuvas de Graça"
  const mTit = t.match(/\b(?:hino|harpa|c[aâ]ntico|cantico)\s+(?:chamado\s+|intitulado\s+|de\s+t[ií]tulo\s+)?["“']?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s'’\-]{2,60}?)["”']?\s*(?:[?!.]|$)/i)
  if (mTit) {
    const titulo = mTit[1].trim()
    // Descarta se for palavra muito genérica
    if (!/^(de|da|do|para|pra|com|em|é|e|o|a|os|as|um|uma|isso|aqui|ai|ali|ele|ela|voce|você|q|que|quer|quero|hoje|amanha|amanhã|ontem|agora)$/i.test(titulo)) {
      return { titulo }
    }
  }
  return null
}

function similarity(a: string, b: string): number {
  const A = normalize(a); const B = normalize(b)
  if (A === B) return 1
  if (B.includes(A) || A.includes(B)) return 0.85
  const wa = new Set(A.split(/\s+/).filter(Boolean))
  const wb = new Set(B.split(/\s+/).filter(Boolean))
  let hit = 0
  for (const w of wa) if (wb.has(w)) hit++
  return hit / Math.max(wa.size, 1)
}

function findByTitle(hinos: HarpaHino[], titulo: string): HarpaHino | null {
  let best: { h: HarpaHino; score: number } | null = null
  for (const h of hinos) {
    const score = similarity(titulo, h.titulo)
    if (score >= 0.6 && (!best || score > best.score)) best = { h, score }
  }
  return best?.h ?? null
}

async function fetchYoutubeLink(numero: number, titulo: string): Promise<string | null> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL || !SERVICE_KEY) return null
    const r = await fetch(`${SUPABASE_URL}/functions/v1/youtube-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ number: numero, title: titulo }),
    })
    if (!r.ok) return null
    const j = await r.json().catch(() => null) as any
    if (!j?.videoId) return null
    return `https://www.youtube.com/watch?v=${j.videoId}`
  } catch (e) {
    console.error('[harpa] youtube lookup failed:', (e as Error)?.message)
    return null
  }
}

type HarpaReply = { text: string; youtubeUrl: string | null }

function youtubeVideoId(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ?? url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)
  return match?.[1] ?? null
}

async function formatHino(h: HarpaHino): Promise<HarpaReply> {
  const chunks: string[] = [`🎵 *Hino ${h.numero} — ${h.titulo}*`]
  // Mostra até 2 estrofes + refrão (ou tudo se for curto) para não estourar mensagem
  const est = h.secoes.filter(s => s.tipo === 'estrofe')
  const ref = h.secoes.find(s => s.tipo === 'refrao' || s.tipo === 'coro')
  const partes: HarpaSecao[] = []
  for (let i = 0; i < Math.min(est.length, 2); i++) partes.push(est[i])
  if (ref) partes.push(ref)
  for (const s of partes) {
    const label = s.tipo === 'estrofe' ? `*${s.numero ?? ''}ª estrofe*`.trim() : `*Coro*`
    chunks.push(`${label}\n${s.linhas.join('\n')}`)
  }
  const totalEst = est.length
  if (totalEst > 2) chunks.push(`_(hino completo com ${totalEst} estrofes)_`)
  const yt = await fetchYoutubeLink(h.numero, h.titulo)
  const tail: string[] = []
  if (yt) tail.push(`▶️ Enviando a prévia do YouTube abaixo...`)
  tail.push(`_Harpa Cristã — Bíblia Atalaia_`)
  chunks.push(tail.join('\n'))
  return { text: chunks.join('\n\n'), youtubeUrl: yt }
}

async function runHarpa(intent: { numero?: number; titulo?: string }): Promise<HarpaReply | null> {
  const hinos = await loadHarpa()
  if (!hinos.length) return null
  let hino: HarpaHino | undefined | null
  if (intent.numero) {
    hino = hinos.find(h => h.numero === intent.numero)
    if (!hino) return { text: `🎵 Não encontrei o hino ${intent.numero} na Harpa Cristã. A Harpa Atalaia vai do 1 ao 640.`, youtubeUrl: null }
  } else if (intent.titulo) {
    hino = findByTitle(hinos, intent.titulo)
    if (!hino) return { text: `🎵 Não encontrei nenhum hino com título parecido com *"${intent.titulo}"*. Tente pelo número (ex.: "hino 117").`, youtubeUrl: null }
  }
  if (!hino) return null
  return await formatHino(hino)
}

// ============================================================
// Bíblia — leitura REAL do JSON oficial por versão (sem IA)
// ============================================================
type BibleBook = { abbrev: string; name: string; chapters: string[][] }
const BIBLE_CACHE = new Map<string, BibleBook[]>()
const BIBLE_VERSIONS = ['ARC', 'ARA', 'ACF', 'NVI', 'NTLH', 'KJA'] as const
type BibleVersion = typeof BIBLE_VERSIONS[number]
const DEFAULT_BIBLE: BibleVersion = 'ARC'

async function loadBible(v: BibleVersion): Promise<BibleBook[]> {
  const c = BIBLE_CACHE.get(v)
  if (c) return c
  try {
    const r = await fetch(`${APP_URL}/biblias/${v}.json`)
    if (!r.ok) return []
    const j = await r.json() as BibleBook[]
    BIBLE_CACHE.set(v, j)
    return j
  } catch (e) {
    console.error('[bible] load failed', v, (e as Error)?.message)
    return []
  }
}

// Ordem canônica dos 66 livros — casa com posição no JSON
const BOOK_INDEX: Array<{ i: number; name: string; keys: string[] }> = [
  { i:0, name:'Gênesis', keys:['genesis','gn'] },{ i:1, name:'Êxodo', keys:['exodo','ex'] },
  { i:2, name:'Levítico', keys:['levitico','lv'] },{ i:3, name:'Números', keys:['numeros','nm'] },
  { i:4, name:'Deuteronômio', keys:['deuteronomio','dt'] },{ i:5, name:'Josué', keys:['josue','js'] },
  { i:6, name:'Juízes', keys:['juizes','jz'] },{ i:7, name:'Rute', keys:['rute','rt'] },
  { i:8, name:'1 Samuel', keys:['1 samuel','1samuel','1sm'] },{ i:9, name:'2 Samuel', keys:['2 samuel','2samuel','2sm'] },
  { i:10, name:'1 Reis', keys:['1 reis','1reis','1rs'] },{ i:11, name:'2 Reis', keys:['2 reis','2reis','2rs'] },
  { i:12, name:'1 Crônicas', keys:['1 cronicas','1cronicas','1cr'] },{ i:13, name:'2 Crônicas', keys:['2 cronicas','2cronicas','2cr'] },
  { i:14, name:'Esdras', keys:['esdras','ed'] },{ i:15, name:'Neemias', keys:['neemias','ne'] },
  { i:16, name:'Ester', keys:['ester','et'] },{ i:17, name:'Jó', keys:['jo','job'] },
  { i:18, name:'Salmos', keys:['salmos','salmo','sl'] },{ i:19, name:'Provérbios', keys:['proverbios','pv'] },
  { i:20, name:'Eclesiastes', keys:['eclesiastes','ec'] },{ i:21, name:'Cânticos', keys:['canticos','cantico','ct'] },
  { i:22, name:'Isaías', keys:['isaias','is'] },{ i:23, name:'Jeremias', keys:['jeremias','jr'] },
  { i:24, name:'Lamentações', keys:['lamentacoes','lm'] },{ i:25, name:'Ezequiel', keys:['ezequiel','ez'] },
  { i:26, name:'Daniel', keys:['daniel','dn'] },{ i:27, name:'Oséias', keys:['oseias','os'] },
  { i:28, name:'Joel', keys:['joel','jl'] },{ i:29, name:'Amós', keys:['amos','am'] },
  { i:30, name:'Obadias', keys:['obadias','ob'] },{ i:31, name:'Jonas', keys:['jonas','jn'] },
  { i:32, name:'Miquéias', keys:['miqueias','mq'] },{ i:33, name:'Naum', keys:['naum','na'] },
  { i:34, name:'Habacuque', keys:['habacuque','hc'] },{ i:35, name:'Sofonias', keys:['sofonias','sf'] },
  { i:36, name:'Ageu', keys:['ageu','ag'] },{ i:37, name:'Zacarias', keys:['zacarias','zc'] },
  { i:38, name:'Malaquias', keys:['malaquias','ml'] },
  { i:39, name:'Mateus', keys:['mateus','mt'] },{ i:40, name:'Marcos', keys:['marcos','mc'] },
  { i:41, name:'Lucas', keys:['lucas','lc'] },{ i:42, name:'João', keys:['joao'] },
  { i:43, name:'Atos', keys:['atos','at'] },{ i:44, name:'Romanos', keys:['romanos','rm'] },
  { i:45, name:'1 Coríntios', keys:['1 corintios','1corintios','1co'] },{ i:46, name:'2 Coríntios', keys:['2 corintios','2corintios','2co'] },
  { i:47, name:'Gálatas', keys:['galatas','gl'] },{ i:48, name:'Efésios', keys:['efesios','ef'] },
  { i:49, name:'Filipenses', keys:['filipenses','fp'] },{ i:50, name:'Colossenses', keys:['colossenses','cl'] },
  { i:51, name:'1 Tessalonicenses', keys:['1 tessalonicenses','1tessalonicenses','1ts'] },
  { i:52, name:'2 Tessalonicenses', keys:['2 tessalonicenses','2tessalonicenses','2ts'] },
  { i:53, name:'1 Timóteo', keys:['1 timoteo','1timoteo','1tm'] },{ i:54, name:'2 Timóteo', keys:['2 timoteo','2timoteo','2tm'] },
  { i:55, name:'Tito', keys:['tito','tt'] },{ i:56, name:'Filemom', keys:['filemom','fm'] },
  { i:57, name:'Hebreus', keys:['hebreus','hb'] },{ i:58, name:'Tiago', keys:['tiago','tg'] },
  { i:59, name:'1 Pedro', keys:['1 pedro','1pedro','1pe'] },{ i:60, name:'2 Pedro', keys:['2 pedro','2pedro','2pe'] },
  { i:61, name:'1 João', keys:['1 joao','1joao','1jo'] },{ i:62, name:'2 João', keys:['2 joao','2joao','2jo'] },
  { i:63, name:'3 João', keys:['3 joao','3joao','3jo'] },{ i:64, name:'Judas', keys:['judas','jd'] },
  { i:65, name:'Apocalipse', keys:['apocalipse','ap'] },
]

function findBookIndex(bookRaw: string): number | null {
  const k = normalize(bookRaw).replace(/\s+/g,' ').trim()
  for (const b of BOOK_INDEX) {
    if (b.keys.includes(k)) return b.i
  }
  // tenta sem espaço (ex.: "1joao")
  const k2 = k.replace(/\s+/g,'')
  for (const b of BOOK_INDEX) {
    if (b.keys.map(x=>x.replace(/\s+/g,'')).includes(k2)) return b.i
  }
  return null
}

// Detecta versão pedida no texto (padrão ARC)
function detectBibleVersion(text: string): BibleVersion {
  const t = text.toUpperCase()
  for (const v of BIBLE_VERSIONS) {
    if (new RegExp(`\\b${v}\\b`).test(t)) return v
  }
  return DEFAULT_BIBLE
}

type ParsedRef = { bookIdx: number; bookName: string; chapter: number; verses?: number[] }

// Mapa bookIdx → apiAbbrev usado no verse_shares/rota /v e /bible
const BOOK_API_ABBREV: string[] = [
  'gn','ex','lv','nm','dt','js','jz','rt','1sm','2sm',
  '1rs','2rs','1cr','2cr','ed','ne','et','job','sl','pv',
  'ec','ct','is','jr','lm','ez','dn','os','jl','am',
  'ob','jn','mq','na','hc','sf','ag','zc','ml',
  'mt','mc','lc','jo','at','rm','1co','2co','gl','ef',
  'fp','cl','1ts','2ts','1tm','2tm','tt','fm','hb','tg',
  '1pe','2pe','1jo','2jo','3jo','jd','ap',
]

const APP_ORIGIN = Deno.env.get('APP_PUBLIC_URL') || 'https://biblia.atalaias.online'

async function createVerseShareLink(params: {
  bookIdx: number
  chapter: number
  verses: number[]
  bookName: string
  version: string
  snippet?: string
}): Promise<string | null> {
  try {
    const bookAbbrev = BOOK_API_ABBREV[params.bookIdx]
    if (!bookAbbrev) return null
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resp = await fetch(`${supabaseUrl}/functions/v1/create-verse-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        book_abbrev: bookAbbrev,
        chapter: params.chapter,
        verses: params.verses.slice(0, 50),
        text_snippet: params.snippet?.slice(0, 600),
        book_name: params.bookName,
        version: params.version,
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json().catch(() => null) as { slug?: string } | null
    if (!data?.slug) return null
    return `${APP_ORIGIN}/v/${data.slug}`
  } catch (e) {
    console.error('createVerseShareLink error:', e)
    return null
  }
}

function parseReference(ref: string): ParsedRef | null {
  // Ex.: "João 3:16", "1 Coríntios 13:4-8", "Salmo 23", "Jo 3", "João 8:31,32", "Sl 1:1-3,6"
  const m = ref.match(/^([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)(?::(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*))?$/i)
  if (!m) return null
  const bookIdx = findBookIndex(m[1].trim())
  if (bookIdx == null) return null
  const chapter = parseInt(m[2],10)
  let verses: number[] | undefined
  if (m[3]) {
    const set = new Set<number>()
    for (const part of m[3].split(',')) {
      const range = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/)
      if (!range) continue
      const a = parseInt(range[1],10)
      const b = range[2] ? parseInt(range[2],10) : a
      const lo = Math.min(a,b), hi = Math.max(a,b)
      for (let i = lo; i <= hi; i++) set.add(i)
    }
    verses = [...set].sort((x,y) => x - y)
  }
  return { bookIdx, bookName: BOOK_INDEX[bookIdx].name, chapter, verses }
}

// Só intercepta quando o usuário quer o TEXTO — não quando pede análise/ferramenta.
function detectBibleTextIntent(text: string, toolDetected: boolean): { ref: string; version: BibleVersion } | null {
  if (toolDetected) return null
  const ref = text.match(REF_REGEX)?.[0]
  if (!ref) return null
  // gatilhos para envio do texto literal
  const wantsText = /\b(me\s+manda|manda|envia|envie|mande|leia|le|lê|quero\s+ler|texto\s+de|vers[ií]culo|versiculos|passagem|capitulo|cap[ií]tulo|escreva|escreve|copia|copie|qual\s+[eé]\s+o\s+texto|como\s+diz|o\s+que\s+diz)\b/i
  // se a mensagem for só a referência ("João 3:16"), também considera pedido de texto
  const isBareRef = new RegExp(`^\\s*${REF_REGEX.source}\\s*[?.!]?\\s*$`, 'i').test(text)
  if (!wantsText.test(text) && !isBareRef) return null
  return { ref: ref.replace(/\s+/g,' ').trim(), version: detectBibleVersion(text) }
}

const MAX_VERSES = 25

function formatVerseList(nums: number[]): string {
  // Compacta [31,32,33,36] em "31-33,36"
  const parts: string[] = []
  let i = 0
  while (i < nums.length) {
    let j = i
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++
    parts.push(i === j ? `${nums[i]}` : `${nums[i]}-${nums[j]}`)
    i = j + 1
  }
  return parts.join(',')
}

async function runBibleVerse(intent: { ref: string; version: BibleVersion }): Promise<string | null> {
  const parsed = parseReference(intent.ref)
  if (!parsed) return null
  const books = await loadBible(intent.version)
  if (!books.length) return null
  const book = books[parsed.bookIdx]
  if (!book) return null
  const chapterArr = book.chapters?.[parsed.chapter - 1]
  if (!chapterArr) return `📖 Não encontrei ${parsed.bookName} ${parsed.chapter} na versão ${intent.version}.`
  const total = chapterArr.length
  let verses = parsed.verses ?? Array.from({ length: total }, (_, i) => i + 1)
  verses = verses.filter((n) => n >= 1 && n <= total)
  if (!verses.length) return `📖 ${parsed.bookName} ${parsed.chapter} tem ${total} versículos na versão ${intent.version}.`
  let truncated = false
  if (verses.length > MAX_VERSES) { verses = verses.slice(0, MAX_VERSES); truncated = true }
  const single = verses.length === 1
  const lines: string[] = []
  for (const n of verses) {
    const txt = chapterArr[n - 1]
    if (!txt) continue
    lines.push(single ? txt : `*${n}* ${txt}`)
  }
  const refLabel = single
    ? `${parsed.bookName} ${parsed.chapter}:${verses[0]}`
    : (parsed.verses ? `${parsed.bookName} ${parsed.chapter}:${formatVerseList(verses)}` : `${parsed.bookName} ${parsed.chapter}`)
  const header = `📖 *${refLabel}* _(${intent.version})_`
  const footer = truncated
    ? `\n\n_(exibindo ${MAX_VERSES} versículos — peça um trecho menor para ver o restante)_`
    : ''
  const snippet = lines.join(' ').replace(/\*/g, '').slice(0, 500)
  const shareLink = await createVerseShareLink({
    bookIdx: parsed.bookIdx,
    chapter: parsed.chapter,
    verses,
    bookName: parsed.bookName,
    version: intent.version,
    snippet,
  })
  const linkLine = shareLink ? `\n\n🔗 ${shareLink}` : ''
  return `${header}\n\n${lines.join('\n')}${footer}${linkLine}`
}

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

// Mapeia cada ferramenta ao toggle correspondente em cfg.commands.
// Ferramentas ligadas a referência bíblica caem sob "versiculo".
const TOOL_TO_COMMAND: Record<keyof typeof TOOL_PROMPTS, string> = {
  exegese: 'versiculo',
  conexoes: 'versiculo',
  palavra: 'versiculo',
  linha_tempo: 'versiculo',
  resumo: 'versiculo',
  devocional: 'devocional',
}

function isCommandEnabled(cfg: any, cmd: string): boolean {
  const c = cfg?.commands
  // Se o objeto de comandos não existir/estiver vazio, considera tudo habilitado (compat retroativa).
  if (!c || typeof c !== 'object' || Object.keys(c).length === 0) return true
  return c[cmd] !== false && !!c[cmd]
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

        // ============================================================
        // Comandos de PASTOR (DM apenas) — resolver / silenciar alertas de crise.
        // "resolvido" / "resolver" [telefone opcional] → marca crise(s) como tratada(s)
        // "silenciar" / "parar" <telefone> → este pastor não recebe mais alertas dessa pessoa
        // ============================================================
        if (!isGroup) {
          const senderDigits = jid.replace(/@.*/, '').replace(/\D/g, '')
          const { data: crisisCfgRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_crisis_alert').maybeSingle()
          const crisisCfg = (crisisCfgRow?.value ?? {}) as { pastor_phones?: string[] }
          const pastorList = (crisisCfg.pastor_phones ?? []).map((p) => String(p).replace(/\D/g, ''))
          // Aceita variação com/sem 9º dígito em AMBAS direções (12↔13)
          const brVariants = (d: string): string[] => {
            const out = new Set<string>([d])
            if (d.startsWith('55')) {
              const ddd = d.slice(2, 4); const rest = d.slice(4)
              if (rest.length === 9 && rest.startsWith('9')) out.add(`55${ddd}${rest.slice(1)}`)
              if (rest.length === 8) out.add(`55${ddd}9${rest}`)
            }
            return [...out]
          }
          const senderVariants = new Set<string>(brVariants(senderDigits))
          const isPastor = pastorList.some((p) => brVariants(p).some((v) => senderVariants.has(v)))
          if (isPastor) {
            const norm = text.trim().toLowerCase().replace(/[.!?]+$/, '')
            const mResolve = norm.match(/^(resolvido|resolver|encerrar|ok)\s*(.*)$/)
            const mMute = norm.match(/^(silenciar|silencia|parar|nao avisar|não avisar|mute)\s+(.+)$/)
            const digitsOnly = (s: string) => s.replace(/\D/g, '')
            const contactCandidates = (digits: string): string[] => {
              const out = new Set<string>()
              for (const d of brVariants(digits)) {
                out.add(d)
                out.add(`${d}@s.whatsapp.net`)
              }
              return [...out]
            }
            if (mResolve) {
              const targetDigits = digitsOnly(mResolve[2])
              const q = admin.from('atis_crisis_alerts').update({ handled: true, handled_at: new Date().toISOString() }).eq('handled', false)
              const { data: updated, error } = targetDigits
                ? await q.in('contact_phone', contactCandidates(targetDigits)).select('id')
                : await q.select('id')
              const count = updated?.length ?? 0
              const reply = error
                ? `⚠️ Não consegui marcar como resolvido: ${error.message}`
                : count > 0
                  ? `✅ ${count} alerta(s)${targetDigits ? ` de +${targetDigits}` : ''} marcado(s) como *resolvido(s)*. Novas mensagens desta pessoa deixarão de ser tratadas como continuação de crise.`
                  : `ℹ️ Não havia alertas ativos${targetDigits ? ` para +${targetDigits}` : ''}.`
              const r = await sendText(jid, reply)
              await admin.from('atis_messages_log').insert({
                direction: 'outbound', wa_to: jid, body: reply,
                command: 'pastor-resolve', status: r.ok ? 'sent' : 'error',
                raw: { auto: true, target: targetDigits, updated: count },
              })
              continue
            }
            if (mMute) {
              const targetDigits = digitsOnly(mMute[2])
              if (!targetDigits) {
                const reply = `ℹ️ Use: *silenciar <telefone>* (ex.: silenciar 5585999999999).`
                const r = await sendText(jid, reply)
                await admin.from('atis_messages_log').insert({ direction: 'outbound', wa_to: jid, body: reply, command: 'pastor-mute-help', status: r.ok ? 'sent' : 'error', raw: { auto: true } })
                continue
              }
              const { error } = await admin.from('atis_crisis_mutes').upsert(
                { contact_phone: targetDigits, pastor_phone: senderDigits },
                { onConflict: 'contact_phone,pastor_phone' }
              )
              const reply = error
                ? `⚠️ Não consegui silenciar: ${error.message}`
                : `🔕 Pronto. Você *não receberá mais alertas* sobre +${targetDigits}. Os outros pastores cadastrados continuam recebendo normalmente.\n\nPara reativar: envie *reativar ${targetDigits}*`
              const r = await sendText(jid, reply)
              await admin.from('atis_messages_log').insert({
                direction: 'outbound', wa_to: jid, body: reply,
                command: 'pastor-mute', status: r.ok ? 'sent' : 'error',
                raw: { auto: true, target: targetDigits, pastor: senderDigits },
              })
              continue
            }
            const mUnmute = norm.match(/^(reativar|desmutar|voltar)\s+(.+)$/)
            if (mUnmute) {
              const targetDigits = digitsOnly(mUnmute[2])
              await admin.from('atis_crisis_mutes').delete().in('pastor_phone', brVariants(senderDigits)).in('contact_phone', contactCandidates(targetDigits))
              const reply = `🔔 Alertas de +${targetDigits} *reativados* para você.`
              const r = await sendText(jid, reply)
              await admin.from('atis_messages_log').insert({ direction: 'outbound', wa_to: jid, body: reply, command: 'pastor-unmute', status: r.ok ? 'sent' : 'error', raw: { auto: true, target: targetDigits } })
              continue
            }
          }
        }

        // ============================================================
        // Opt-out ("sair") — apenas em DM. Cancela todos os envios automáticos.
        // ============================================================
        if (!isGroup) {
          const norm = text.trim().toLowerCase().replace(/[.!?]+$/, '')
          const OPT_OUT = ['sair', 'cancelar', 'parar', 'stop', 'descadastrar', 'unsubscribe', 'nao quero mais', 'não quero mais', 'remover me', 'remover-me']
          if (OPT_OUT.includes(norm)) {
            const phoneOnly = jid.replace(/@.*/, '').replace(/\D/g, '')
            // Variações do 9º dígito para casar com todos os registros
            const variants = new Set<string>([phoneOnly])
            if (phoneOnly.length === 13 && phoneOnly.startsWith('55')) {
              const ddd = phoneOnly.slice(2, 4); const rest = phoneOnly.slice(4)
              if (rest.length === 9 && rest.startsWith('9')) variants.add(`55${ddd}${rest.slice(1)}`)
              if (rest.length === 8) variants.add(`55${ddd}9${rest}`)
            }
            const list = Array.from(variants)

            const results = await Promise.allSettled([
              admin.from('atis_contacts').update({ opt_in: false }).in('phone', list),
              admin.from('profiles').update({ whatsapp_opt_in: false }).in('whatsapp', list),
              admin.from('atis_series_subscribers').update({ active: false }).in('phone', list),
              admin.from('atis_plan_subscribers').update({ active: false }).in('phone', list),
            ])
            const okCount = results.filter(r => r.status === 'fulfilled').length

            const reply = `✅ Pronto! Você foi removido(a) da lista de envios automáticos do Atis.\n\nVocê não receberá mais versículos diários, devocionais, séries ou lembretes.\n\nSe mudar de ideia, é só reativar o WhatsApp no seu perfil dentro do app, ou pedir para um administrador te adicionar de novo. 💜\n\n— Bíblia Atalaia`
            const r = await sendText(jid, reply)
            await admin.from('atis_messages_log').insert({
              direction: 'outbound', wa_to: jid, body: reply,
              command: 'opt-out', status: r.ok ? 'sent' : 'error',
              raw: { auto: true, variants: list, updates_ok: okCount, http: r.status },
            })
            continue
          }
        }

        // Detecção de crise (aplica a DMs — em grupo evita alarmar em conversa aberta)
        if (!isGroup) {
          const crisis = await detectCrisis(admin, text)
          const recentCrisis = crisis.matched.length ? null : await getRecentActiveCrisis(admin, jid)
          const recentResolved = await getRecentResolvedCrisis(admin, jid)
          if (crisis.matched.length || recentCrisis) {
            const matched = crisis.matched.length ? crisis.matched : ['continuação de crise recente']
            // Só classifica/dispara resposta de crise quando há palavras de risco NESTA mensagem.
            // Se existe crise ativa recente mas a mensagem atual não tem sinal de risco,
            // encaminhamos silenciosamente aos pastores (follow-up) e deixamos o fluxo normal responder.
            const ctx = (recentResolved && crisis.matched.length)
              ? { risk: true, reason: `recurrence_within_72h:${recentResolved.id}`, confidence: 1 }
              : crisis.matched.length
                ? await classifyCrisisContext(text)
                : { risk: false, reason: `active_crisis_follow_up_no_keywords:${recentCrisis?.id}`, confidence: 0 }
            if (!ctx.risk) {
              // Follow-up silencioso ao(s) pastor(es) se há crise ativa, sem enviar CVV ao contato
              if (recentCrisis) {
                let contactName: string | null = null
                try {
                  const phoneOnly = jid.replace(/@.*/, '').replace(/\D/g, '')
                  const { data: c } = await admin.from('atis_contacts').select('name').eq('phone', phoneOnly).maybeSingle()
                  contactName = c?.name ?? null
                } catch { /* ignore */ }
                await handleCrisis(admin, jid, contactName, text, matched, false)
              }
              await admin.from('atis_messages_log').insert({
                direction: 'inbound', wa_from: jid, body: text.slice(0, 500),
                command: 'crisis-skip', status: 'ignored',
                raw: { reason: ctx.reason, confidence: ctx.confidence, matched },
              })
              // não continua — deixa o fluxo normal (comando/IA) responder
            } else {
            let contactName: string | null = null
            try {
              const phoneOnly = jid.replace(/@.*/, '').replace(/\D/g, '')
              const { data: c } = await admin.from('atis_contacts').select('name').eq('phone', phoneOnly).maybeSingle()
              contactName = c?.name ?? null
              if (!contactName) {
                const { data: p } = await admin.from('profiles').select('display_name').eq('whatsapp', phoneOnly).maybeSingle()
                contactName = p?.display_name ?? null
              }
            } catch { /* ignore */ }
            const isRecurrence = !!recentResolved && !recentCrisis
            await handleCrisis(admin, jid, contactName, text, matched, isRecurrence)
            const crisisReply = await generateCrisisReply(text)
            const r = await sendText(jid, crisisReply)
            await admin.from('atis_messages_log').insert({
              direction: 'outbound', wa_to: jid, body: crisisReply,
              command: isRecurrence ? 'crisis-reply-recurrence' : 'crisis-reply',
              status: r.ok ? 'sent' : 'error',
              raw: { auto: true, matched, http: r.status, ai_confidence: ctx.confidence, ai_reason: ctx.reason, recurrence: isRecurrence },
            })
            continue
            }
          }
        }

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

        // 0) Pedido de HINO da Harpa Cristã — resposta 100% baseada no JSON oficial (sem IA).
        const harpaIntent = detectHarpaIntent(text)
        if (harpaIntent) {
          const harpaReply = await runHarpa(harpaIntent)
          if (harpaReply) {
            const r = await sendText(jid, harpaReply.text)
            let previewStatus: { ok: boolean; status: number } | null = null
            if (harpaReply.youtubeUrl) {
              // Envia o link em mensagem separada (sem miniatura de imagem).
              // O WhatsApp gera o preview nativo do YouTube automaticamente.
              const linkRes = await sendText(jid, harpaReply.youtubeUrl)
              previewStatus = { ok: linkRes.ok, status: linkRes.status }
            }
            await admin.from('atis_messages_log').insert({
              direction: 'outbound', wa_to: jid, wa_group_id: isGroup ? jid : null,
              body: harpaReply.text, command: 'harpa', status: r.ok ? 'sent' : 'error',
              raw: { auto: true, intent: harpaIntent, http: r.status, youtube_preview: previewStatus },
            })
            continue
          }
        }

        // Primeiro tenta detectar se o usuário pediu uma ferramenta da Bíblia Atalaia
        // (exegese, conexões, palavra original, linha do tempo, devocional, resumo).
        // Detecção 100% local — sem custo de IA.
        const intent = detectToolIntent(text, history)

        // 0.5) Pedido de TEXTO bíblico — responde 100% pelo JSON oficial (zero token de IA).
        //     Só entra quando NÃO houver ferramenta de análise pedida.
        const bibleIntent = detectBibleTextIntent(text, intent.tool !== 'nenhum')
        if (bibleIntent) {
          const bibleReply = await runBibleVerse(bibleIntent)
          if (bibleReply) {
            const r = await sendText(jid, bibleReply)
            await admin.from('atis_messages_log').insert({
              direction: 'outbound', wa_to: jid, wa_group_id: isGroup ? jid : null,
              body: bibleReply, command: 'biblia', status: r.ok ? 'sent' : 'error',
              raw: { auto: true, intent: bibleIntent, http: r.status },
            })
            continue
          }
        }

        let reply: string
        let usedTool: string | null = null
        const cmdKey = intent.tool !== 'nenhum' ? TOOL_TO_COMMAND[intent.tool as keyof typeof TOOL_PROMPTS] : null
        if (intent.tool !== 'nenhum' && intent.reference && cmdKey && isCommandEnabled(cfg, cmdKey)) {
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