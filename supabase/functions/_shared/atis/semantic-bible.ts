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

function testamentForBook(bookName: string): "OT" | "NT" {
  return NT_BOOKS.has(normalize(bookName)) ? "NT" : "OT";
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

function isSameSource(reference: string, sourceLabel: string) {
  const source = normalize(sourceLabel);
  const candidate = normalize(reference);
  if (!source || !candidate) return false;
  if (source === candidate) return true;
  return candidate.startsWith(`${source} `) && candidate.length <= source.length + 5;
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

  try {
    // Do not let a partial corpus skew canonical answers. While the indexer is
    // still filling the ARC, v45 lexical retrieval remains the exact fallback.
    if (!(await semanticIndexReady())) return [];

    const embedding = await embedText(compactSemanticPrompt(args.sourceLabel, sourceText, args.userMessage));
    const rows = await semanticRpc(
      embedding,
      args.bibleVersion ?? "ARC",
      args.matchCount ?? 18,
      args.minSimilarity ?? 0.46,
    );

    const output: SemanticBibleEvidence[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const reference = String(row?.reference ?? "").trim();
      const text = String(row?.content ?? "").trim();
      const similarity = Number(row?.similarity ?? 0);
      const bookName = String(row?.book_name ?? "").trim();
      if (!reference || !text || !Number.isFinite(similarity) || isSameSource(reference, args.sourceLabel)) continue;
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
    return output.slice(0, Math.max(1, Math.min(args.matchCount ?? 18, 24)));
  } catch (error) {
    console.warn("[atis-semantic-bible] fallback to lexical evidence", error instanceof Error ? error.message : error);
    return [];
  }
}
