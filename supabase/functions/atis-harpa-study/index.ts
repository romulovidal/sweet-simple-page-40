import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { aiChatFetchWithProviders } from "../_shared/ai-fetch.ts";

type Json = Record<string, any>;
type ConversationMessage = { role: "user" | "assistant"; content: string };
type BibleBook = { abbrev?: string; name?: string; chapters?: string[][] };
type BibleReference = { book: BibleBook; bookName: string; chapter: number; verseStart: number; verseEnd: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,;!?()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

function clampText(value: string, max = 3600) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 45).trimEnd()}\n\n… conteúdo reduzido para WhatsApp.`;
}

function safeHistory(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ConversationMessage => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
    .slice(-12);
}

function hymnNumberFromHistory(history: ConversationMessage[]) {
  for (const item of [...history].reverse()) {
    if (item.role !== "assistant") continue;
    const match = item.content.match(/Harpa Cristã\s+(\d{1,3})\s+—/i);
    if (match) return Number(match[1]);
  }
  return null;
}

async function loadAssistantConfig(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("value").eq("key", "assistant").maybeSingle();
  if (error) throw error;
  const value = data?.value ?? {};
  return {
    baseUrl: (firstString(value.app_base_url) ?? "https://biblia.atalaias.online").replace(/\/+$/, ""),
    bibleVersion: firstString(value.bible_version) ?? "ARC",
  };
}

async function fetchJson(url: string, code: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${code}_HTTP_${response.status}`);
  return await response.json();
}

function findHymn(hymns: any[], message: string, requestedNumber: number | null, history: ConversationMessage[]) {
  const q = normalize(message);
  const numberMatch = q.match(/(?:harpa|hino)(?:\s+(?:numero|n|nº|no))?\s*(\d{1,3})/);
  const number = requestedNumber ?? (numberMatch ? Number(numberMatch[1]) : null) ?? hymnNumberFromHistory(history);

  if (number) {
    const byNumber = hymns.find((row: any) => Number(row?.numero) === number);
    if (byNumber) return byNumber;
  }

  const byTitle = hymns.find((row: any) => {
    const title = normalize(String(row?.titulo ?? ""));
    return title.length >= 5 && q.includes(title);
  });
  if (byTitle) return byTitle;

  const phraseMatch = q.match(/(?:trecho|letra|fala|diz)(?:\s+(?:que|do|da))?\s+(.{5,})$/);
  const phrase = normalize(phraseMatch?.[1] ?? "");
  if (phrase.length < 5) return null;
  return hymns.find((row: any) => {
    const sections = Array.isArray(row?.secoes) ? row.secoes : [];
    const lyrics = normalize(sections.flatMap((section: any) => Array.isArray(section?.linhas) ? section.linhas : []).join(" "));
    return lyrics.includes(phrase);
  }) ?? null;
}

function flattenLyrics(sections: any[]) {
  return sections.map((section: any) => {
    const heading = section?.tipo === "refrao" || section?.chorus === true
      ? "Refrão"
      : section?.numero ? `${section.numero}ª estrofe` : "Estrofe";
    const lines = Array.isArray(section?.linhas)
      ? section.linhas.map((line: unknown) => String(line).replace(/^\s*[-–—]+\s*/, "")).filter(Boolean)
      : [];
    return `${heading}:\n${lines.join("\n")}`;
  }).filter(Boolean).join("\n\n").slice(0, 12000);
}

function parseJsonObject(value: string): Json | null {
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveBibleReference(value: string, bible: BibleBook[]): BibleReference | null {
  const match = value.trim().match(/^(.+?)\s+(\d{1,3}):\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/u);
  if (!match) return null;
  const bookQuery = normalize(match[1]);
  const book = bible.find((candidate) => {
    const name = normalize(String(candidate?.name ?? ""));
    const abbrev = normalize(String(candidate?.abbrev ?? ""));
    return bookQuery === name || bookQuery === abbrev;
  });
  if (!book || !Array.isArray(book.chapters)) return null;

  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = match[4] ? Number(match[4]) : verseStart;
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters.length) return null;
  const verses = book.chapters[chapter - 1] ?? [];
  if (!Number.isInteger(verseStart) || !Number.isInteger(verseEnd) || verseStart < 1 || verseEnd < verseStart || verseEnd > verses.length) return null;
  if (verseEnd - verseStart > 2) return null;
  return { book, bookName: firstString(book.name, book.abbrev) ?? match[1].trim(), chapter, verseStart, verseEnd };
}

function bibleExcerpt(reference: BibleReference) {
  const verses = reference.book.chapters?.[reference.chapter - 1] ?? [];
  const lines: string[] = [];
  for (let verse = reference.verseStart; verse <= reference.verseEnd; verse++) {
    lines.push(`${verse}. ${verses[verse - 1]}`);
  }
  const label = `${reference.bookName} ${reference.chapter}:${reference.verseStart}${reference.verseEnd !== reference.verseStart ? `-${reference.verseEnd}` : ""}`;
  return { label, text: lines.join("\n") };
}

function compactField(value: unknown, fallback: string, max: number) {
  const text = firstString(value) ?? fallback;
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, supabaseUrl, serviceKey);
  if (!auth.authorized) return json({ error: "UNAUTHORIZED", message: auth.error }, 401);

  let input: Json = {};
  try { input = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }

  const message = firstString(input.message, input.text) ?? "Explique o tema deste hino e suas conexões bíblicas.";
  const history = safeHistory(input.history);
  const requestedNumberRaw = Number(input.hymn_number ?? input.number);
  const requestedNumber = Number.isInteger(requestedNumberRaw) && requestedNumberRaw > 0 && requestedNumberRaw <= 999 ? requestedNumberRaw : null;
  const conversationMode = input.conversation_mode === "study" ? "study" : input.conversation_mode === "concise" ? "concise" : "normal";

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const config = await loadAssistantConfig(supabase);
    const rawHarpa = await fetchJson(`${config.baseUrl}/harpa/harpa-crista.json`, "HARPA_SOURCE");
    const hymns = Array.isArray(rawHarpa?.hinos) ? rawHarpa.hinos : [];
    const hymn = findHymn(hymns, message, requestedNumber, history);
    if (!hymn) return json({ error: "HARPA_HYMN_NOT_FOUND" }, 404);

    const { data: override, error: overrideError } = await supabase
      .from("harpa_overrides")
      .select("number,title,secoes")
      .eq("number", hymn.numero)
      .maybeSingle();
    if (overrideError) throw overrideError;

    const title = firstString(override?.title, hymn?.titulo) ?? `Hino ${hymn.numero}`;
    const sections = Array.isArray(override?.secoes) ? override.secoes : Array.isArray(hymn?.secoes) ? hymn.secoes : [];
    const lyrics = flattenLyrics(sections);
    if (!lyrics) return json({ error: "HARPA_LYRICS_EMPTY" }, 422);

    const aiResponse = await aiChatFetchWithProviders({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Você é Atis, assistente ministerial da Bíblia do Atalaia. Analise SOMENTE a letra da Harpa fornecida como fonte primária. Não invente autoria, data, origem histórica, intenção do compositor ou fatos externos. Não copie nem cite literalmente a letra; explique por paráfrase. Não transcreva texto bíblico. Sugira apenas referências bíblicas específicas (livro capítulo:versículo) claramente coerentes com o conteúdo do hino; o backend verificará cada uma. Responda SOMENTE JSON válido no formato {"theme":"frase curta","explanation":"explicação natural","application":"aplicação opcional","hymn_type":"classificação curta do tipo de hino","biblical_assessment":"avaliação direta e equilibrada sobre a coerência bíblica da mensagem","references":["João 3:16"]}. Os campos devem ser texto corrido, sem markdown, listas, aspas de letra ou placeholders. Use português brasileiro. ${conversationMode === "study" ? "A explicação pode ser mais aprofundada." : conversationMode === "concise" ? "Seja muito conciso." : "Seja claro, pastoral e conversacional."}`,
        },
        {
          role: "user",
          content: `Harpa Cristã ${hymn.numero} — ${title}\n\nLETRA RECUPERADA DO APP:\n${lyrics}\n\nPEDIDO DO USUÁRIO:\n${message}`,
        },
      ],
      temperature: 0.35,
      max_tokens: conversationMode === "study" ? 1400 : conversationMode === "concise" ? 650 : 1000,
    }, ["groq", "gemini"]);

    if (!aiResponse.ok) {
      console.error("[atis-harpa-study] AI unavailable", aiResponse.status, (await aiResponse.text().catch(() => "")).slice(0, 300));
      return json({ error: "AI_PROVIDER_UNAVAILABLE" }, 503);
    }

    const aiBody = await aiResponse.json().catch(() => null) as any;
    const aiText = firstString(aiBody?.choices?.[0]?.message?.content);
    const analysis = aiText ? parseJsonObject(aiText) : null;
    if (!analysis) return json({ error: "AI_INVALID_STRUCTURED_RESPONSE" }, 502);

    const rawTheme = compactField(analysis.theme, "Tema central não identificado com segurança.", 320);
    const rawExplanation = compactField(analysis.explanation, "A letra aponta para uma mensagem cristã que deve ser lida à luz das Escrituras.", conversationMode === "study" ? 1500 : 900);
    const rawApplication = compactField(analysis.application, "Use a mensagem do hino como convite à reflexão e à prática da fé cristã.", 700);
    const rawHymnType = compactField(analysis.hymn_type, "hino cristocêntrico de fé e confiança", 240);
    const rawBiblicalAssessment = compactField(analysis.biblical_assessment, "A mensagem deve ser avaliada pelas afirmações da própria letra e pelas conexões bíblicas verificadas.", 500);

    const rawReferences = Array.isArray(analysis.references) ? analysis.references.filter((item: unknown) => typeof item === "string").slice(0, 6) : [];
    let bible: BibleBook[] = [];
    try {
      const rawBible = await fetchJson(`${config.baseUrl}/biblias/${encodeURIComponent(config.bibleVersion)}.json`, "BIBLE_SOURCE");
      bible = Array.isArray(rawBible) ? rawBible : [];
    } catch (error) {
      console.error("[atis-harpa-study] Bible source unavailable", error instanceof Error ? error.message : error);
    }

    const verified: Array<{ label: string; text: string }> = [];
    const seen = new Set<string>();
    for (const candidate of rawReferences) {
      const reference = resolveBibleReference(candidate, bible);
      if (!reference) continue;
      const excerpt = bibleExcerpt(reference);
      const key = normalize(excerpt.label);
      if (seen.has(key)) continue;
      seen.add(key);
      verified.push(excerpt);
      if (verified.length >= 3) break;
    }

    const verifiedKeys = new Set(verified.map((item) => normalize(item.label)));
    const sanitizeNarrative = (value: string) => {
      const withoutLongQuotes = value
        .replace(/“[^”\n]{24,}”/g, "")
        .replace(/"[^"\n]{24,}"/g, "");
      return withoutLongQuotes
        .replace(/\b(?:[1-3]\s+)?[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3}\s+\d{1,3}:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?/gu, (candidate) => {
          const reference = resolveBibleReference(candidate, bible);
          if (!reference) return "";
          const canonical = bibleExcerpt(reference).label;
          return verifiedKeys.has(normalize(canonical)) ? canonical : "";
        })
        .replace(/\(\s*\)/g, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    };

    const theme = sanitizeNarrative(rawTheme);
    const explanation = sanitizeNarrative(rawExplanation);
    const application = sanitizeNarrative(rawApplication);
    const hymnType = sanitizeNarrative(rawHymnType);
    const biblicalAssessment = sanitizeNarrative(rawBiblicalAssessment);
    const q = normalize(message);
    const asksType = /\b(?:tipo|categoria|classifica\w*|genero|estilo)\b/.test(q);
    const asksBiblical = /\b(?:biblic\w*|doutrin\w*|teolog\w*)\b/.test(q);
    const asksApplication = /\b(?:aplica\w*|pratica|como viver|como aplicar)\b/.test(q);
    const asksConnections = /\b(?:conex\w*|passagens?|referencias?|versiculos?|textos?)\b/.test(q);
    const wantsLiteralConnections = conversationMode === "study" || /\b(?:mostre|mostrar|cite|citar|passagens?|versiculos?|textos?)\b/.test(q);
    const referencesInline = verified.length
      ? `As conexões bíblicas mais diretas são ${verified.map((item) => item.label).join(", ")}.`
      : "";

    let answer = "";
    if (conversationMode === "study") {
      const studyConnections = verified.length
        ? `\n\n*Conexões bíblicas:* ${verified.map((item) => item.label).join(", ")}.`
        : "";
      answer = `🎵 *Harpa Cristã ${hymn.numero} — ${title}*\n\n*Tema:* ${theme}\n\n${explanation}\n\n*Aplicação:* ${application}${studyConnections}`;
    } else {
      const paragraphs: string[] = [];
      if (asksBiblical && biblicalAssessment) paragraphs.push(biblicalAssessment);
      if (asksType && hymnType) paragraphs.push(`Quanto ao tipo, este é ${hymnType.replace(/[.!?]+$/u, "")}.`);
      if (!asksBiblical && !asksType) paragraphs.push(`O hino ${hymn.numero}, “${title}”, tem como tema ${theme.replace(/[.!?]+$/u, "")}.`);
      if (explanation) paragraphs.push(explanation);
      if (asksApplication && application) paragraphs.push(application);
      if ((asksBiblical || asksConnections) && referencesInline) paragraphs.push(referencesInline);
      answer = paragraphs.filter(Boolean).join("\n\n");
    }

    if (wantsLiteralConnections && verified.length) {
      const literalBlocks = verified.slice(0, 2).map((item) => `📖 *${item.label}*\n${item.text}`).join("\n\n");
      answer = `${answer.trimEnd()}\n\n${literalBlocks}`;
    }

    answer = clampText(answer
      .replace(/trecho literal omitido[^)]*\)?/gi, "")
      .replace(/uma passagem bíblica relacionada(?:-\d+)?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim());

    return json({
      ok: true,
      route: "harpa_study",
      source: "ai_grounded",
      reference: `Harpa ${hymn.numero}`,
      hymn: { number: Number(hymn.numero), title },
      grounding: {
        harpa_source: "app",
        override_used: Boolean(override),
        bible_version: config.bibleVersion,
        verified_bible_references: verified.map((item) => item.label),
      },
      answer,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "ATIS_HARPA_STUDY_ERROR";
    console.error("[atis-harpa-study] failed", messageText);
    return json({ error: "ATIS_HARPA_STUDY_ERROR", message: messageText }, 500);
  }
});
