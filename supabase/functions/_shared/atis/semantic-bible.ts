import { aiChatFetchWithProviders } from "../ai-fetch.ts";

export type SemanticBibleEvidence = {
  reference: string;
  text: string;
  score: number;
  testament: "OT" | "NT";
  matchedEntities: string[];
  matchedTerms: string[];
};

const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;
const NT_BOOKS = new Set([
  "mateus", "marcos", "lucas", "joao", "atos", "romanos", "1 corintios", "2 corintios", "galatas", "efesios",
  "filipenses", "colossenses", "1 tessalonicenses", "2 tessalonicenses", "1 timoteo", "2 timoteo", "tito", "filemom",
  "hebreus", "tiago", "1 pedro", "2 pedro", "1 joao", "2 joao", "3 joao", "judas", "apocalipse",
]);

function normalize(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function testamentForBook(bookName: string): "OT" | "NT" {
  return NT_BOOKS.has(normalize(bookName)) ? "NT" : "OT";
}

function sourceTestament(sourceLabel: string): "OT" | "NT" {
  const book = sourceLabel.replace(/\s+\d[\s\S]*$/, "").trim();
  return testamentForBook(book);
}

function compactSemanticPrompt(sourceLabel: string, sourceText: string, userMessage: string) {
  const cleanText = String(sourceText ?? "").replace(/\s+/g, " ").trim().slice(0, 6000);
  const cleanQuestion = String(userMessage ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  return [
    "Representação semântica bíblica em português para recuperar passagens relacionadas no cânon.",
    `Passagem-base: ${sourceLabel}`,
    cleanText,
    cleanQuestion ? `Pergunta do leitor: ${cleanQuestion}` : "",
  ].filter(Boolean).join("\n");
}

function serverConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) throw new Error("SEMANTIC_BIBLE_SUPABASE_CONFIG_MISSING");
  return { supabaseUrl, serviceKey };
}

async function semanticIndexReady() {
  const { supabaseUrl, serviceKey } = serverConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/atis_bible_semantic_progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: "{}",
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok || !Array.isArray(body) || !body.length) return false;
  const total = Number(body[0]?.total ?? 0);
  const pending = Number(body[0]?.pending ?? total);
  return total > 0 && pending === 0;
}

async function embedText(input: string): Promise<number[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("SEMANTIC_BIBLE_GEMINI_KEY_MISSING");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: input }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  const body = await response.json().catch(() => null) as any;
  const values = body?.embedding?.values;
  if (!response.ok || !Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    const detail = String(body?.error?.message ?? `HTTP_${response.status}`).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`SEMANTIC_BIBLE_EMBED_FAILED:${detail}`);
  }
  return values.map((value: unknown) => Number(value));
}

async function semanticRpc(embedding: number[], bibleVersion: string, matchCount: number, minSimilarity: number) {
  const { supabaseUrl, serviceKey } = serverConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/atis_bible_semantic_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      _embedding: embedding,
      _match_count: Math.max(1, Math.min(matchCount, 40)),
      _min_similarity: Math.max(0, Math.min(minSimilarity, 1)),
      _bible_version: bibleVersion || "ARC",
    }),
  });

  const body = await response.json().catch(() => null) as any;
  if (!response.ok || !Array.isArray(body)) {
    const detail = String(body?.message ?? body?.error ?? `HTTP_${response.status}`).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`SEMANTIC_BIBLE_RPC_FAILED:${detail}`);
  }
  return body;
}

function parseJsonObject(value: string) {
  const stripped = String(value ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function sanitizeConceptTerms(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as any).concepts)
    ? (raw as any).concepts
    : [];

  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const source = typeof item === "string" ? item : typeof item?.term === "string" ? item.term : "";
    const term = source.replace(/\s+/g, " ").trim();
    if (term.length < 2 || term.length > 80) continue;
    // The expansion model is allowed to propose concepts only. Any string that
    // looks like a Bible citation is rejected before it can reach retrieval.
    if (/\d|:|https?:\/\//i.test(term)) continue;
    const key = normalize(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(term);
    if (output.length >= 14) break;
  }
  return output;
}

async function expandConceptTerms(sourceLabel: string, sourceText: string, userMessage: string) {
  const response = await aiChatFetchWithProviders({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Você é um expansor de consulta para pesquisa bíblica. NÃO responda a pergunta e NÃO forneça referências bíblicas, nomes de livros com capítulo/verso, citações ou links. Produza apenas conceitos, entidades, símbolos, ações e expressões curtas em português que possam aparecer em outras passagens relacionadas. Inclua sinônimos ou formulações canônicas úteis quando ajudarem a encontrar relações que não repetem exatamente as palavras da passagem-base. Retorne SOMENTE JSON válido: {"concepts":["termo curto","expressão curta"]}. Gere de 6 a 12 conceitos.`,
      },
      {
        role: "user",
        content: `PASSAGEM-BASE: ${sourceLabel}\n${String(sourceText ?? "").slice(0, 6000)}\n\nPERGUNTA: ${String(userMessage ?? "").slice(0, 1200)}`,
      },
    ],
    temperature: 0.15,
    reasoning_effort: "low",
    reasoning_format: "hidden",
    max_tokens: 360,
  }, ["groq", "gemini"]);

  if (!response.ok) return [];
  const body = await response.json().catch(() => null) as any;
  const text = typeof body?.choices?.[0]?.message?.content === "string" ? body.choices[0].message.content : "";
  return sanitizeConceptTerms(parseJsonObject(text));
}

async function conceptRpc(terms: string[], bibleVersion: string, matchCount: number) {
  if (!terms.length) return [];
  const { supabaseUrl, serviceKey } = serverConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/atis_bible_concept_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      _terms: terms,
      _bible_version: bibleVersion || "ARC",
      _match_count: Math.max(1, Math.min(matchCount, 64)),
    }),
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok || !Array.isArray(body)) {
    const detail = String(body?.message ?? body?.error ?? `HTTP_${response.status}`).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`SEMANTIC_BIBLE_CONCEPT_RPC_FAILED:${detail}`);
  }
  return body;
}

function chapterKey(reference: string) {
  const match = /^(.+?)\s+(\d{1,3})(?::\d{1,3})?/u.exec(String(reference ?? "").trim());
  return match ? `${normalize(match[1])}:${match[2]}` : normalize(reference);
}

function isSameSource(reference: string, sourceLabel: string) {
  const source = normalize(sourceLabel);
  const candidate = normalize(reference);
  if (!source || !candidate) return false;
  if (source === candidate) return true;
  if (chapterKey(reference) === chapterKey(sourceLabel)) return true;
  return candidate.startsWith(`${source} `) && candidate.length <= source.length + 5;
}

export function conceptRowsToEvidence(args: {
  rows: any[];
  terms: string[];
  sourceLabel: string;
  matchCount?: number;
}): SemanticBibleEvidence[] {
  const output: SemanticBibleEvidence[] = [];
  const seen = new Set<string>();
  const sourceIsOt = sourceTestament(args.sourceLabel) === "OT";
  const normalizedTerms = args.terms.map((term) => ({ original: term, normalized: normalize(term) })).filter((item) => item.normalized);

  for (const row of Array.isArray(args.rows) ? args.rows : []) {
    const reference = String(row?.reference ?? "").trim();
    const text = String(row?.content ?? "").trim();
    const bookName = String(row?.book_name ?? "").trim();
    const rank = Number(row?.rank ?? 0);
    if (!reference || !text || !bookName || !Number.isFinite(rank) || isSameSource(reference, args.sourceLabel)) continue;
    const key = normalize(reference);
    if (!key || seen.has(key)) continue;

    const normalizedText = normalize(text);
    const matchedTerms = normalizedTerms
      .filter((item) => normalizedText.includes(item.normalized))
      .map((item) => item.original)
      .slice(0, 6);
    const testament = testamentForBook(bookName);
    const score = 7 + Math.max(0, rank) * 18 + Math.min(matchedTerms.length, 4) * 1.5 + (sourceIsOt && testament === "NT" ? 4 : 0);

    seen.add(key);
    output.push({
      reference,
      text,
      score,
      testament,
      matchedEntities: [],
      matchedTerms: unique(["conceptual", ...matchedTerms]),
    });
  }

  return output
    .sort((a, b) => b.score - a.score || (a.testament === "NT" ? -1 : 1) || a.reference.localeCompare(b.reference, "pt-BR"))
    .slice(0, Math.max(1, Math.min(args.matchCount ?? 18, 24)));
}

async function retrieveConceptBridgeEvidence(args: {
  sourceLabel: string;
  sourceText: string;
  userMessage: string;
  bibleVersion: string;
  matchCount: number;
}) {
  try {
    const terms = await expandConceptTerms(args.sourceLabel, args.sourceText, args.userMessage);
    if (!terms.length) return [];
    const rows = await conceptRpc(terms, args.bibleVersion, Math.max(args.matchCount * 2, 32));
    return conceptRowsToEvidence({ rows, terms, sourceLabel: args.sourceLabel, matchCount: args.matchCount });
  } catch (error) {
    console.warn("[atis-semantic-bible] concept bridge unavailable", error instanceof Error ? error.message : error);
    return [];
  }
}

function vectorRowsToEvidence(rows: any[], sourceLabel: string, matchCount: number): SemanticBibleEvidence[] {
  const output: SemanticBibleEvidence[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const reference = String(row?.reference ?? "").trim();
    const text = String(row?.content ?? "").trim();
    const similarity = Number(row?.similarity ?? 0);
    const bookName = String(row?.book_name ?? "").trim();
    if (!reference || !text || !Number.isFinite(similarity) || isSameSource(reference, sourceLabel)) continue;
    const key = normalize(reference);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({
      reference,
      text,
      // Explicit names/references from the lexical engine retain priority.
      // Semantic similarity extends recall; it does not override direct text.
      score: 8 + similarity * 16,
      testament: testamentForBook(bookName),
      matchedEntities: [],
      matchedTerms: ["semantic"],
    });
  }
  return output.slice(0, Math.max(1, Math.min(matchCount, 24)));
}

function mergeEvidence(...groups: SemanticBibleEvidence[][]) {
  const merged = new Map<string, SemanticBibleEvidence>();
  for (const group of groups) {
    for (const item of group) {
      const key = normalize(item.reference);
      if (!key) continue;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, item);
        continue;
      }
      merged.set(key, {
        ...existing,
        score: Math.max(existing.score, item.score) + 1.5,
        text: existing.text.length >= item.text.length ? existing.text : item.text,
        matchedEntities: unique([...existing.matchedEntities, ...item.matchedEntities]),
        matchedTerms: unique([...existing.matchedTerms, ...item.matchedTerms]),
      });
    }
  }
  return [...merged.values()].sort((a, b) => b.score - a.score || (a.testament === "NT" ? -1 : 1) || a.reference.localeCompare(b.reference, "pt-BR"));
}

export async function retrieveSemanticBibleEvidence(args: {
  sourceLabel: string;
  sourceText: string;
  userMessage: string;
  bibleVersion?: string;
  matchCount?: number;
  minSimilarity?: number;
}): Promise<SemanticBibleEvidence[]> {
  const sourceText = String(args.sourceText ?? "").trim();
  if (!sourceText) return [];

  const bibleVersion = args.bibleVersion ?? "ARC";
  const matchCount = Math.max(1, Math.min(args.matchCount ?? 18, 24));

  // This bridge works over the complete seeded ARC text and is independent of
  // embedding quota. The model can suggest search concepts, but references are
  // accepted only when Postgres finds the corresponding text in the app corpus.
  const conceptual = await retrieveConceptBridgeEvidence({
    sourceLabel: args.sourceLabel,
    sourceText,
    userMessage: args.userMessage,
    bibleVersion,
    matchCount,
  });

  let vector: SemanticBibleEvidence[] = [];
  try {
    // A partial vector corpus must never skew canonical answers. Vector search
    // joins the bridge only after all seeded chunks have embeddings.
    if (await semanticIndexReady()) {
      const embedding = await embedText(compactSemanticPrompt(args.sourceLabel, sourceText, args.userMessage));
      const rows = await semanticRpc(
        embedding,
        bibleVersion,
        matchCount,
        args.minSimilarity ?? 0.46,
      );
      vector = vectorRowsToEvidence(rows, args.sourceLabel, matchCount);
    }
  } catch (error) {
    console.warn("[atis-semantic-bible] vector layer unavailable; concept bridge remains active", error instanceof Error ? error.message : error);
  }

  return mergeEvidence(conceptual, vector).slice(0, matchCount);
}
