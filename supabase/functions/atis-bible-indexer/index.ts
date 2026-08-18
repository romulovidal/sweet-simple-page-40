import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 8;
const CHUNK_STRIDE = 6;
const EMBEDDING_BATCH_SIZE = 48;
const BATCHES_PER_RUN = 2;
const DEFAULT_BASE_URL = "https://biblia.atalaias.online";
const CANONICAL_BOOKS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel", "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];

type BibleBook = { abbrev: string; name?: string; chapters: string[][] };
type ChunkRow = {
  bible_version: string;
  book_name: string;
  book_abbrev: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  reference: string;
  content: string;
  content_hash: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jwtRole(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return "";
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return String(payload?.role ?? "");
  } catch {
    return "";
  }
}

function simpleHash(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function interleave<T>(groups: T[][]) {
  const out: T[] = [];
  let cursor = 0;
  while (true) {
    let added = false;
    for (const group of groups) {
      if (cursor < group.length) {
        out.push(group[cursor]);
        added = true;
      }
    }
    if (!added) break;
    cursor++;
  }
  return out;
}

function buildChunks(bible: BibleBook[], bibleVersion: string): ChunkRow[] {
  const perBook: ChunkRow[][] = bible.map((book, bookIndex) => {
    const bookName = String(book.name || CANONICAL_BOOKS[bookIndex] || book.abbrev || `Livro ${bookIndex + 1}`).trim();
    const abbrev = String(book.abbrev || bookName).trim();
    const rows: ChunkRow[] = [];
    for (let chapterIndex = 0; chapterIndex < (book.chapters?.length ?? 0); chapterIndex++) {
      const verses = book.chapters[chapterIndex] ?? [];
      for (let startIndex = 0; startIndex < verses.length; startIndex += CHUNK_STRIDE) {
        const endIndex = Math.min(verses.length, startIndex + CHUNK_SIZE);
        const verseStart = startIndex + 1;
        const verseEnd = endIndex;
        const lines: string[] = [];
        for (let i = startIndex; i < endIndex; i++) {
          const verse = String(verses[i] ?? "").trim();
          if (verse) lines.push(`${i + 1}. ${verse}`);
        }
        if (!lines.length) continue;
        const reference = `${bookName} ${chapterIndex + 1}:${verseStart}-${verseEnd}`;
        const content = lines.join("\n");
        rows.push({
          bible_version: bibleVersion,
          book_name: bookName,
          book_abbrev: abbrev,
          chapter: chapterIndex + 1,
          verse_start: verseStart,
          verse_end: verseEnd,
          reference,
          content,
          content_hash: simpleHash(`${bibleVersion}|${reference}|${content}`),
        });
        if (endIndex >= verses.length) break;
      }
    }
    return rows;
  });
  return interleave(perBook);
}

async function loadAssistantConfig(supabase: any) {
  const { data, error } = await supabase.from("atis_settings").select("value").eq("key", "assistant").maybeSingle();
  if (error) throw error;
  const value = data?.value ?? {};
  return {
    baseUrl: String(value.app_base_url || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    bibleVersion: String(value.bible_version || "ARC").trim() || "ARC",
  };
}

async function seedIfNeeded(supabase: any, config: { baseUrl: string; bibleVersion: string }) {
  const { count, error: countError } = await supabase
    .from("atis_bible_semantic_chunks")
    .select("id", { count: "exact", head: true })
    .eq("bible_version", config.bibleVersion);
  if (countError) throw countError;
  if ((count ?? 0) > 0) return { seeded: false, total: count ?? 0 };

  const response = await fetch(`${config.baseUrl}/biblias/${encodeURIComponent(config.bibleVersion)}.json`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`BIBLE_ASSET_HTTP_${response.status}`);
  const bible = await response.json() as BibleBook[];
  if (!Array.isArray(bible) || !bible.length) throw new Error("BIBLE_ASSET_INVALID");

  const chunks = buildChunks(bible, config.bibleVersion);
  for (let offset = 0; offset < chunks.length; offset += 400) {
    const batch = chunks.slice(offset, offset + 400);
    const { error } = await supabase
      .from("atis_bible_semantic_chunks")
      .upsert(batch, { onConflict: "bible_version,book_abbrev,chapter,verse_start,verse_end", ignoreDuplicates: true });
    if (error) throw error;
  }
  return { seeded: true, total: chunks.length };
}

function documentEmbeddingText(row: any) {
  return [
    "Representação semântica bíblica em português para recuperar passagens relacionadas no cânon.",
    `Passagem: ${row.reference}`,
    String(row.content ?? "").slice(0, 7000),
  ].join("\n");
}

async function batchEmbed(rows: any[], apiKey: string): Promise<number[][]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      requests: rows.map((row) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: documentEmbeddingText(row) }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
  });

  const body = await response.json().catch(() => null) as any;
  const embeddings = body?.embeddings;
  if (!response.ok || !Array.isArray(embeddings) || embeddings.length !== rows.length) {
    const detail = String(body?.error?.message ?? `HTTP_${response.status}`).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`EMBED_BATCH_FAILED:${detail}`);
  }
  const vectors = embeddings.map((item: any) => item?.values);
  if (vectors.some((values: unknown) => !Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error("EMBED_BATCH_DIMENSION_MISMATCH");
  }
  return vectors as number[][];
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !serviceKey || !geminiKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);
  if (!bearer || (bearer !== serviceKey && jwtRole(bearer) !== "service_role")) return json({ error: "FORBIDDEN" }, 403);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const config = await loadAssistantConfig(supabase);
    const seed = await seedIfNeeded(supabase, config);
    let embeddedThisRun = 0;
    let rateLimited = false;

    for (let batchNo = 0; batchNo < BATCHES_PER_RUN; batchNo++) {
      const { data: pending, error } = await supabase
        .from("atis_bible_semantic_chunks")
        .select("id,reference,content")
        .eq("bible_version", config.bibleVersion)
        .is("embedding", null)
        .order("id", { ascending: true })
        .limit(EMBEDDING_BATCH_SIZE);
      if (error) throw error;
      if (!pending?.length) break;

      let vectors: number[][];
      try {
        vectors = await batchEmbed(pending, geminiKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/quota|rate.?limit|resource_exhausted|429/i.test(message)) {
          rateLimited = true;
          console.warn("[atis-bible-indexer] embedding quota reached; continuing on next scheduled run", message.slice(0, 220));
          break;
        }
        throw error;
      }

      const payload = pending.map((row: any, index: number) => ({
        id: row.id,
        embedding: vectors[index],
        model: EMBEDDING_MODEL,
      }));
      const { data: stored, error: storeError } = await supabase.rpc("atis_bible_semantic_store_embeddings", { _rows: payload });
      if (storeError) throw storeError;
      embeddedThisRun += Number(stored ?? payload.length);
    }

    const { data: progress, error: progressError } = await supabase.rpc("atis_bible_semantic_progress");
    if (progressError) throw progressError;
    const state = Array.isArray(progress) ? progress[0] : progress;
    return json({
      ok: true,
      bible_version: config.bibleVersion,
      embedding_model: EMBEDDING_MODEL,
      seeded: seed.seeded,
      embedded_this_run: embeddedThisRun,
      rate_limited: rateLimited,
      progress: state ?? null,
    });
  } catch (error) {
    console.error("[atis-bible-indexer]", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "INDEXER_FAILED" }, 500);
  }
});
