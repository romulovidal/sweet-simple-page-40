import { aiChatFetchWithProviders } from "../ai-fetch.ts";

type Json = Record<string, any>;
export type AtisAssistantRoute =
  | "ask_bible"
  | "exegetai"
  | "chapter_summary"
  | "word_meaning"
  | "connections"
  | "timeline"
  | "devotional"
  | "daily_verse"
  | "birthdays"
  | "bible_lookup"
  | "harpa_lookup";

export type AtisAssistantResult = {
  text: string;
  route: AtisAssistantRoute;
  source: "app" | "database" | "ai";
  reference?: string | null;
};

export type AtisAssistantOptions = {
  allowedAiRoutes?: string[] | null;
};

type BibleBook = { abbrev: string; name?: string; chapters: string[][] };
type BibleReference = { book: BibleBook; bookName: string; chapter: number; verseStart?: number; verseEnd?: number };

const DEFAULT_BASE_URL = "https://biblia.atalaias.online";
const DEFAULT_ATIS_PROMPT = "Você é Atis, assistente virtual ministerial. Responda em português brasileiro, de forma acolhedora, concisa e fiel às Escrituras. Nunca invente dados que devam ser consultados no aplicativo.";
const AI_ROUTES = new Set<AtisAssistantRoute>(["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional"]);
const CANONICAL_BOOKS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel", "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];
const EXTRA_ALIASES: Record<string, string[]> = {
  "Gênesis": ["genesis", "gn"], "Êxodo": ["exodo", "ex"], "Levítico": ["levitico", "lv"], "Números": ["numeros", "nm"],
  "Deuteronômio": ["deuteronomio", "dt"], "Josué": ["josue", "js"], "Juízes": ["juizes", "jz"], "Rute": ["rt"],
  "1 Samuel": ["1samuel", "1 sm", "1sm"], "2 Samuel": ["2samuel", "2 sm", "2sm"], "1 Reis": ["1reis", "1 rs", "1rs"], "2 Reis": ["2reis", "2 rs", "2rs"],
  "1 Crônicas": ["1cronicas", "1 cr", "1cr"], "2 Crônicas": ["2cronicas", "2 cr", "2cr"], "Esdras": ["ed"], "Neemias": ["ne"], "Ester": ["et"],
  "Jó": ["jo livro", "jó"], "Salmos": ["salmo", "sl"], "Provérbios": ["proverbios", "pv"], "Eclesiastes": ["ec"], "Cantares": ["cantico dos canticos", "ct"],
  "Isaías": ["isaias", "is"], "Jeremias": ["jr"], "Lamentações": ["lamentacoes", "lm"], "Ezequiel": ["ez"], "Daniel": ["dn"], "Oséias": ["oseias", "os"],
  "Joel": ["jl"], "Amós": ["amos", "am"], "Obadias": ["ob"], "Jonas": ["jn"], "Miquéias": ["miqueias", "mq"], "Naum": ["na"], "Habacuque": ["hc"],
  "Sofonias": ["sf"], "Ageu": ["ag"], "Zacarias": ["zc"], "Malaquias": ["ml"], "Mateus": ["mt"], "Marcos": ["mc"], "Lucas": ["lc"],
  "João": ["joao", "jo"], "Atos": ["at"], "Romanos": ["rm"], "1 Coríntios": ["1corintios", "1 co", "1co"], "2 Coríntios": ["2corintios", "2 co", "2co"],
  "Gálatas": ["galatas", "gl"], "Efésios": ["efesios", "ef"], "Filipenses": ["fp"], "Colossenses": ["cl"], "1 Tessalonicenses": ["1tessalonicenses", "1 ts", "1ts"],
  "2 Tessalonicenses": ["2tessalonicenses", "2 ts", "2ts"], "1 Timóteo": ["1timoteo", "1 tm", "1tm"], "2 Timóteo": ["2timoteo", "2 tm", "2tm"],
  "Tito": ["tt"], "Filemom": ["fm"], "Hebreus": ["hb"], "Tiago": ["tg"], "1 Pedro": ["1pedro", "1 pe", "1pe"], "2 Pedro": ["2pedro", "2 pe", "2pe"],
  "1 João": ["1joao", "1 jo", "1jo"], "2 João": ["2joao", "2 jo", "2jo"], "3 João": ["3joao", "3 jo", "3jo"], "Judas": ["jd"], "Apocalipse": ["apocalipse", "ap"],
};
const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

let bibleCache: { url: string; data: BibleBook[] } | null = null;
let harpaCache: { url: string; data: any } | null = null;

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,;!?()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

function clampText(value: string, max = 3800) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 55).trimEnd()}\n\n… conteúdo reduzido para envio no WhatsApp.`;
}

function normalizedQuote(value: string) {
  return normalize(value).replace(/\s+/g, " ");
}

function guardUngroundedBibleQuotes(value: string, bibleContext: string | null) {
  const source = bibleContext ? normalizedQuote(bibleContext) : "";
  const replacement = "📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*";
  const protect = (full: string, quoted: string) => {
    if (quoted.trim().length < 24) return full;
    if (source && source.includes(normalizedQuote(quoted))) return full;
    return replacement;
  };
  return value
    .replace(/“([^”\n]{24,})”/g, protect)
    .replace(/"([^"\n]{24,})"/g, protect);
}

async function fetchJsonCached(url: string, kind: "bible" | "harpa") {
  const cached = kind === "bible" ? bibleCache : harpaCache;
  if (cached?.url === url) return cached.data;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`APP_CONTENT_HTTP_${response.status}`);
  const data = await response.json();
  if (kind === "bible") bibleCache = { url, data };
  else harpaCache = { url, data };
  return data;
}

async function loadAssistantConfig(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("value").eq("key", "assistant").maybeSingle();
  if (error) throw error;
  const value = data?.value ?? {};
  return {
    enabled: value.enabled !== false,
    systemPrompt: firstString(value.system_prompt) ?? DEFAULT_ATIS_PROMPT,
    baseUrl: (firstString(value.app_base_url) ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    bibleVersion: firstString(value.bible_version) ?? "ARC",
  };
}

async function loadSpecialistPrompts(supabase: any) {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("key,value")
    .in("key", ["ai_tool_prompts", "ask_bible_prompt", "exegetai_prompt"]);
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value ?? {}]));
  return {
    tools: map.ai_tool_prompts ?? {},
    askBible: firstString(map.ask_bible_prompt?.prompt),
    exegetai: firstString(map.exegetai_prompt?.prompt),
  };
}

function deterministicIntent(message: string): AtisAssistantRoute | null {
  const q = normalize(message);
  if (/aniversari/.test(q)) return "birthdays";
  if (/\b(harpa|hino)\b/.test(q)) return "harpa_lookup";
  if (/versiculo do dia|verso do dia/.test(q)) return "daily_verse";
  if (/significado original|etimolog|hebraic|grego|aramaic|raiz da palavra/.test(q)) return "word_meaning";
  if (/conex(ao|oes)|referenc(ia|ias) cruzad|profecia.*cumpr|cumprimento.*profecia|interligad/.test(q)) return "connections";
  if (/linha do tempo|contexto histor|cronolog|imperio|costume da epoca|periodo histor/.test(q)) return "timeline";
  if (/\b(resumo|resuma|sintese|sintetize|pontos[- ]?chave)\b/.test(q)) return "chapter_summary";
  if (/\b(exegese|exeget|estudo aprofundado|analise teologica|teologia profunda)\b/.test(q)) return "exegetai";
  if (/\b(devocional|reflexao devocional)\b/.test(q)) return "devotional";
  if (/\b(mostre|leia|texto de|o que diz|qual diz|versiculo)\b/.test(q) && /\d/.test(q)) return "bible_lookup";
  return null;
}

async function classifyWithAi(systemPrompt: string, message: string): Promise<AtisAssistantRoute> {
  const allowed: AtisAssistantRoute[] = ["ask_bible", "exegetai", "chapter_summary", "word_meaning", "connections", "timeline", "devotional", "daily_verse", "birthdays", "bible_lookup", "harpa_lookup"];
  const response = await aiChatFetchWithProviders({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: `${systemPrompt}\n\nVocê está apenas classificando intenção. Retorne SOMENTE um identificador desta lista: ${allowed.join(", ")}. Não responda a pergunta.` },
      { role: "user", content: message },
    ],
    temperature: 0,
    max_tokens: 40,
  }, ["groq", "gemini"]);
  if (!response.ok) return "ask_bible";
  const body = await response.json().catch(() => null) as any;
  const route = String(body?.choices?.[0]?.message?.content ?? "").trim().replace(/[`"']/g, "") as AtisAssistantRoute;
  return allowed.includes(route) ? route : "ask_bible";
}

function bookAliases(book: BibleBook, index: number) {
  const canonical = CANONICAL_BOOKS[index] ?? book.name ?? book.abbrev;
  const values = [canonical, book.name, book.abbrev, ...(EXTRA_ALIASES[canonical] ?? [])].filter(Boolean) as string[];
  return [...new Set(values.map(normalize).filter((value) => value.length >= 2))].sort((a, b) => b.length - a.length);
}

function parseBibleReference(message: string, bible: BibleBook[]): BibleReference | null {
  const q = normalize(message);
  const candidates: Array<{ alias: string; book: BibleBook; bookName: string }> = [];
  bible.forEach((book, index) => {
    const bookName = book.name || CANONICAL_BOOKS[index] || book.abbrev;
    for (const alias of bookAliases(book, index)) candidates.push({ alias, book, bookName });
  });
  candidates.sort((a, b) => b.alias.length - a.alias.length);

  for (const candidate of candidates) {
    const escaped = candidate.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = q.match(new RegExp(`(?:^|\\s)${escaped}\\s+(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?(?:\\s|$)`));
    if (!match) continue;
    const chapter = Number(match[1]);
    const verseStart = match[2] ? Number(match[2]) : undefined;
    const verseEnd = match[3] ? Number(match[3]) : verseStart;
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > candidate.book.chapters.length) return null;
    const chapterVerses = candidate.book.chapters[chapter - 1] ?? [];
    if (verseStart && (verseStart < 1 || verseStart > chapterVerses.length)) return null;
    if (verseEnd && (verseEnd < (verseStart ?? 1) || verseEnd > chapterVerses.length)) return null;
    return { book: candidate.book, bookName: candidate.bookName, chapter, verseStart, verseEnd };
  }
  return null;
}

function bibleText(reference: BibleReference, wholeChapter = false) {
  const verses = reference.book.chapters[reference.chapter - 1] ?? [];
  const start = wholeChapter || !reference.verseStart ? 1 : reference.verseStart;
  const end = wholeChapter || !reference.verseStart ? verses.length : Math.min(reference.verseEnd ?? reference.verseStart, verses.length);
  const lines = [];
  for (let verse = start; verse <= end; verse++) lines.push(`${verse}. ${verses[verse - 1]}`);
  const label = reference.verseStart
    ? `${reference.bookName} ${reference.chapter}:${reference.verseStart}${end !== reference.verseStart ? `-${end}` : ""}`
    : `${reference.bookName} ${reference.chapter}`;
  return { label, text: lines.join("\n") };
}

async function loadBible(config: any) {
  const url = `${config.baseUrl}/biblias/${encodeURIComponent(config.bibleVersion)}.json`;
  const data = await fetchJsonCached(url, "bible");
  if (!Array.isArray(data)) throw new Error("APP_BIBLE_INVALID");
  return data as BibleBook[];
}

async function harpaLookup(supabase: any, config: any, message: string) {
  const url = `${config.baseUrl}/harpa/harpa-crista.json`;
  const raw = await fetchJsonCached(url, "harpa") as any;
  const hymns = Array.isArray(raw?.hinos) ? raw.hinos : [];
  const q = normalize(message);
  const numberMatch = q.match(/(?:harpa|hino)(?:\s+(?:numero|n|nº|no))?\s*(\d{1,3})/);
  let hymn = numberMatch ? hymns.find((row: any) => Number(row?.numero) === Number(numberMatch[1])) : null;
  if (!hymn) {
    hymn = hymns.find((row: any) => {
      const title = normalize(String(row?.titulo ?? ""));
      return title.length >= 5 && q.includes(title);
    });
  }
  if (!hymn) return { text: "🎵 Não encontrei esse hino na Harpa Cristã cadastrada no app.", reference: null };

  const { data: override } = await supabase.from("harpa_overrides").select("number,title,secoes").eq("number", hymn.numero).maybeSingle();
  const title = firstString(override?.title, hymn?.titulo) ?? `Hino ${hymn.numero}`;
  const sections = Array.isArray(override?.secoes) ? override.secoes : Array.isArray(hymn?.secoes) ? hymn.secoes : [];
  const body = sections.map((section: any) => {
    const heading = section?.tipo === "refrao" ? "Refrão" : section?.numero ? `${section.numero}ª estrofe` : "Estrofe";
    const lines = Array.isArray(section?.linhas) ? section.linhas.map((line: any) => String(line).replace(/^\s*[-–—]+\s*/, "")).filter(Boolean) : [];
    return `*${heading}*\n${lines.join("\n")}`;
  }).filter(Boolean).join("\n\n");
  return { text: clampText(`🎵 *Harpa Cristã ${hymn.numero} — ${title}*\n\n${body}`), reference: `Harpa ${hymn.numero}` };
}

function requestedMonth(message: string, timezone = "America/Fortaleza") {
  const q = normalize(message);
  for (const [name, month] of Object.entries(MONTHS)) if (q.includes(normalize(name))) return month;
  return Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: timezone }).format(new Date()));
}

async function birthdaysLookup(supabase: any, message: string) {
  const timezone = "America/Fortaleza";
  const month = requestedMonth(message, timezone);
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, month - 1, 1)));
  const { data, error } = await supabase.from("atis_birthdays").select("name,birth_date").eq("is_active", true).order("birth_date");
  if (error) throw error;
  const rows = (data ?? []).filter((row: any) => Number(String(row.birth_date).slice(5, 7)) === month)
    .sort((a: any, b: any) => Number(String(a.birth_date).slice(8, 10)) - Number(String(b.birth_date).slice(8, 10)) || a.name.localeCompare(b.name, "pt-BR"));
  if (!rows.length) return `🎂 Não há aniversariantes cadastrados para ${monthName}.`;
  return `🎂 *Aniversariantes de ${monthName}*\n${rows.map((row: any) => `• Dia ${String(row.birth_date).slice(8, 10)} — ${row.name}`).join("\n")}`;
}

async function dailyVerseLookup(supabase: any) {
  const { data, error } = await supabase.from("current_daily_verse").select("verse_text,verse_ref,scheduled_date").maybeSingle();
  if (error) throw error;
  if (!data?.verse_text) return "📖 O versículo do dia ainda não está disponível no app.";
  return `📖 *${data.verse_ref ?? "Versículo do dia"}*\n“${data.verse_text}”`;
}

function specialistPrompt(route: AtisAssistantRoute, prompts: any) {
  if (route === "ask_bible") return prompts.askBible;
  if (route === "exegetai") return prompts.exegetai;
  const map: Partial<Record<AtisAssistantRoute, string>> = {
    chapter_summary: "summary",
    word_meaning: "word-meaning",
    connections: "connections",
    timeline: "timeline",
    devotional: "devotional",
  };
  const key = map[route];
  return key ? firstString(prompts.tools?.[key]) : null;
}

async function generateSpecialistAnswer(
  route: AtisAssistantRoute,
  config: any,
  prompts: any,
  message: string,
  bibleContext: { label: string; text: string } | null,
) {
  const specialist = specialistPrompt(route, prompts) ?? "Responda fielmente à solicitação usando somente informações que você possa sustentar.";
  const context = bibleContext ? `\n\nCONTEXTO BÍBLICO RECUPERADO DO APP (${config.bibleVersion})\n${bibleContext.label}\n${bibleContext.text}` : "";
  const system = `${config.systemPrompt}\n\nFERRAMENTA ESPECIALIZADA SELECIONADA\n${specialist}\n\nREGRAS DE SAÍDA DO ATIS\n- Sua identidade pública continua sendo Atis; não diga que você é ExegettAI ou outro motor.\n- Não mencione roteamento, provider ou ferramenta interna.\n- Não invente texto bíblico. Quando houver CONTEXTO BÍBLICO RECUPERADO DO APP, trate-o como fonte do texto citado.\n- Fora do CONTEXTO BÍBLICO RECUPERADO DO APP, cite apenas a referência bíblica, nunca o texto literal.\n- Seja conciso para WhatsApp, salvo quando o usuário pedir estudo aprofundado.${context}`;
  const response = await aiChatFetchWithProviders({
    model: route === "exegetai" || route === "timeline" ? "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: system },
      { role: "user", content: message },
    ],
    temperature: 0.55,
    max_tokens: route === "exegetai" ? 2600 : 1800,
  }, ["groq", "gemini"]);
  if (!response.ok) {
    console.error("[atis-assistant] AI provider failed", response.status, (await response.text().catch(() => "")).slice(0, 300));
    throw new Error("AI_PROVIDER_UNAVAILABLE");
  }
  const body = await response.json().catch(() => null) as any;
  const text = firstString(body?.choices?.[0]?.message?.content);
  if (!text) throw new Error("AI_EMPTY_RESPONSE");
  return clampText(guardUngroundedBibleQuotes(text, bibleContext?.text ?? null));
}

export async function runAtisAssistant(supabase: any, message: string, options: AtisAssistantOptions = {}): Promise<AtisAssistantResult> {
  const input = firstString(message);
  if (!input) return { text: "Como posso ajudar? 😊", route: "ask_bible", source: "ai" };

  const config = await loadAssistantConfig(supabase);
  if (!config.enabled) return { text: "O atendimento inteligente do Atis está temporariamente indisponível.", route: "ask_bible", source: "database" };

  let route = deterministicIntent(input);
  if (!route) route = await classifyWithAi(config.systemPrompt, input);

  if (AI_ROUTES.has(route) && Array.isArray(options.allowedAiRoutes) && !options.allowedAiRoutes.includes(route)) {
    return {
      text: "🔒 Este recurso de IA não está habilitado para esta conversa. Um administrador pode ativá-lo nas configurações deste destinatário.",
      route,
      source: "database",
    };
  }

  if (route === "birthdays") {
    return { text: await birthdaysLookup(supabase, input), route, source: "database" };
  }
  if (route === "daily_verse") {
    return { text: await dailyVerseLookup(supabase), route, source: "database" };
  }
  if (route === "harpa_lookup") {
    const result = await harpaLookup(supabase, config, input);
    return { text: result.text, route, source: "app", reference: result.reference };
  }

  let bible: BibleBook[] | null = null;
  let reference: BibleReference | null = null;
  try {
    bible = await loadBible(config);
    reference = parseBibleReference(input, bible);
  } catch (error) {
    console.error("[atis-assistant] Bible asset lookup failed", error instanceof Error ? error.message : error);
  }

  if (route === "bible_lookup") {
    if (!reference) {
      return { text: "📖 Não consegui identificar uma referência bíblica completa. Envie, por exemplo: *João 3:16*.", route, source: "app" };
    }
    const content = bibleText(reference, !reference.verseStart);
    return { text: clampText(`📖 *${content.label} — ${config.bibleVersion}*\n${content.text}`), route, source: "app", reference: content.label };
  }

  const prompts = await loadSpecialistPrompts(supabase);
  let context: { label: string; text: string } | null = null;
  if (reference) {
    const wholeChapter = route === "chapter_summary" || route === "exegetai" || route === "timeline";
    context = bibleText(reference, wholeChapter && !reference.verseStart);
  }
  const text = await generateSpecialistAnswer(route, config, prompts, input, context);
  return { text, route, source: "ai", reference: context?.label ?? null };
}
