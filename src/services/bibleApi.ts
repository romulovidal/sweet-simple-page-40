import { bibleBooks } from "@/data/bible";

// ── Bible Version Definitions ──
export interface BibleVersion {
  id: string;
  name: string;
  shortName: string;
  fileName: string; // JSON file name in /biblias/
}

export const BIBLE_VERSIONS: BibleVersion[] = [
  { id: "ara", name: "Almeida Revista e Atualizada", shortName: "ARA", fileName: "ARA" },
  { id: "arc", name: "Almeida Revista e Corrigida", shortName: "ARC", fileName: "ARC" },
  { id: "acf", name: "Almeida Corrigida Fiel", shortName: "ACF", fileName: "ACF" },
  { id: "nvi", name: "Nova Versão Internacional", shortName: "NVI", fileName: "NVI" },
  { id: "ntlh", name: "Nova Tradução na Linguagem de Hoje", shortName: "NTLH", fileName: "NTLH" },
  { id: "kja", name: "King James Atualizada", shortName: "KJA", fileName: "KJA" },
];

export const DEFAULT_VERSION_ID = "nvi";

export function getVersionById(id: string): BibleVersion {
  return BIBLE_VERSIONS.find((v) => v.id === id) || BIBLE_VERSIONS[0];
}

export interface BibleVerse {
  number: number;
  text: string;
}

export interface ChapterResponse {
  reference: string;
  verses: BibleVerse[];
}

// Map from app apiAbbrev → JSON file abbrev (lowercase)
const abbrevToJsonAbbrev: Record<string, string> = {
  gn: "gn", ex: "êx", lv: "lv", nm: "nm", dt: "dt",
  js: "js", jz: "jz", rt: "rt", "1sm": "1sm", "2sm": "2sm",
  "1rs": "1rs", "2rs": "2rs", "1cr": "1cr", "2cr": "2cr",
  ed: "ed", ne: "ne", et: "et", job: "jó", sl: "sl",
  pv: "pv", ec: "ec", ct: "ct",
  is: "is", jr: "jr", lm: "lm", ez: "ez", dn: "dn",
  os: "os", jl: "jl", am: "am", ob: "ob", jn: "jn",
  mq: "mq", na: "na", hc: "hc", sf: "sf",
  ag: "ag", zc: "zc", ml: "ml",
  mt: "mt", mc: "mc", lc: "lc", jo: "jo", at: "at",
  rm: "rm", "1co": "1co", "2co": "2co",
  gl: "gl", ef: "ef", fp: "fp", cl: "cl",
  "1ts": "1ts", "2ts": "2ts",
  "1tm": "1tn", "2tm": "2tm", tt: "tt", fm: "fm",
  hb: "hb", tg: "tg", "1pe": "1pe", "2pe": "2pe",
  "1jo": "1jo", "2jo": "2jo", "3jo": "3jo", jd: "jd", ap: "ap",
};

// ── Cache loaded Bible data ──
interface BibleBookData {
  abbrev: string;
  chapters: string[][];
}

const bibleCache = new Map<string, BibleBookData[]>();

async function loadBibleVersion(fileName: string): Promise<BibleBookData[]> {
  const cached = bibleCache.get(fileName);
  if (cached) return cached;

  const response = await fetch(`/biblias/${fileName}.json`);
  if (!response.ok) throw new Error(`Erro ao carregar versão ${fileName}`);

  const data: BibleBookData[] = await response.json();
  bibleCache.set(fileName, data);
  return data;
}

// ── Public API ──
export async function getChapter(
  abbrev: string,
  chapter: number,
  versionId?: string
): Promise<ChapterResponse> {
  const version = getVersionById(versionId || DEFAULT_VERSION_ID);
  const data = await loadBibleVersion(version.fileName);

  const jsonAbbrev = abbrevToJsonAbbrev[abbrev.toLowerCase()] || abbrev.toLowerCase();
  const book = data.find((b) => b.abbrev.toLowerCase() === jsonAbbrev);

  if (!book) {
    throw new Error(`Livro não encontrado: ${abbrev}`);
  }

  const chapterIndex = chapter - 1;
  if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
    throw new Error(`Capítulo ${chapter} não encontrado`);
  }

  const versesRaw = book.chapters[chapterIndex];
  const bookInfo = bibleBooks.find((b) => b.apiAbbrev === abbrev.toLowerCase());

  return {
    reference: `${bookInfo?.name || abbrev} ${chapter}`,
    verses: versesRaw.map((text, index) => ({
      number: index + 1,
      text: text.trim(),
    })),
  };
}

export async function getRandomVerse(): Promise<{
  book: { name: string };
  chapter: number;
  number: number;
  text: string;
}> {
  const favorites = [
    { abbrev: "jo", chapter: 3, verse: 16 },
    { abbrev: "sl", chapter: 23, verse: 1 },
    { abbrev: "fp", chapter: 4, verse: 13 },
    { abbrev: "pv", chapter: 3, verse: 5 },
    { abbrev: "jr", chapter: 29, verse: 11 },
    { abbrev: "is", chapter: 40, verse: 31 },
    { abbrev: "sl", chapter: 119, verse: 105 },
    { abbrev: "is", chapter: 41, verse: 10 },
    { abbrev: "jo", chapter: 8, verse: 32 },
    { abbrev: "sl", chapter: 34, verse: 4 },
    { abbrev: "rm", chapter: 8, verse: 28 },
    { abbrev: "js", chapter: 1, verse: 9 },
    { abbrev: "mt", chapter: 11, verse: 28 },
    { abbrev: "sl", chapter: 46, verse: 1 },
    { abbrev: "rm", chapter: 12, verse: 2 },
    { abbrev: "hb", chapter: 11, verse: 1 },
    { abbrev: "sl", chapter: 27, verse: 1 },
    { abbrev: "pv", chapter: 18, verse: 10 },
    { abbrev: "1pe", chapter: 5, verse: 7 },
  ];

  const pick = favorites[Math.floor(Math.random() * favorites.length)];

  try {
    const result = await getChapter(pick.abbrev, pick.chapter, DEFAULT_VERSION_ID);
    const verse = result.verses.find((v) => v.number === pick.verse) || result.verses[0];
    const bookInfo = bibleBooks.find((b) => b.apiAbbrev === pick.abbrev);

    return {
      book: { name: bookInfo?.name || pick.abbrev },
      chapter: pick.chapter,
      number: verse.number,
      text: verse.text,
    };
  } catch {
    return {
      book: { name: "João" },
      chapter: 3,
      number: 16,
      text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.",
    };
  }
}

// ── Search ──
const normalizeText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function searchBible(
  query: string,
  versionId?: string
): Promise<{ reference: string; text: string; bookAbbrev: string; chapter: number; verse: number }[]> {
  if (!query || query.length < 3) return [];

  const version = getVersionById(versionId || DEFAULT_VERSION_ID);
  const data = await loadBibleVersion(version.fileName);
  const normalizedQuery = normalizeText(query);
  const results: { reference: string; text: string; bookAbbrev: string; chapter: number; verse: number }[] = [];

  for (const book of data) {
    // Find the app apiAbbrev for this JSON book
    const appAbbrev = Object.entries(abbrevToJsonAbbrev).find(
      ([, jsonAb]) => jsonAb === book.abbrev.toLowerCase()
    )?.[0];
    if (!appAbbrev) continue;

    const bookInfo = bibleBooks.find((b) => b.apiAbbrev === appAbbrev);
    if (!bookInfo) continue;

    for (let ci = 0; ci < book.chapters.length; ci++) {
      for (let vi = 0; vi < book.chapters[ci].length; vi++) {
        const verseText = book.chapters[ci][vi];
        if (normalizeText(verseText).includes(normalizedQuery)) {
          results.push({
            reference: `${bookInfo.name} ${ci + 1}:${vi + 1}`,
            text: verseText.trim(),
            bookAbbrev: appAbbrev,
            chapter: ci + 1,
            verse: vi + 1,
          });
          if (results.length >= 50) return results;
        }
      }
    }
  }

  return results;
}

// Alias for DiscoverPage compatibility
export async function searchVerses(
  query: string,
  versionId?: string
): Promise<{ book: { name: string }; chapter: number; number: number; text: string }[]> {
  const results = await searchBible(query, versionId);
  return results.map((r) => ({
    book: { name: r.reference.split(" ").slice(0, -1).join(" ") },
    chapter: r.chapter,
    number: r.verse,
    text: r.text,
  }));
}

// Keep bookNameMap export for compatibility
export const bookNameMap: Record<string, string> = Object.fromEntries(
  bibleBooks.map((b) => [b.apiAbbrev, b.name])
);
