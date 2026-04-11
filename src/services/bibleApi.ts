const BASE_URL = "https://bible-api.com";
const TRANSLATION = "almeida";

export interface BibleVerse {
  number: number;
  text: string;
}

export interface ChapterResponse {
  reference: string;
  verses: BibleVerse[];
}

// Map Portuguese book names to bible-api.com English names
const bookNameMap: Record<string, string> = {
  gn: "genesis", ex: "exodus", lv: "leviticus", nm: "numbers", dt: "deuteronomy",
  js: "joshua", jz: "judges", rt: "ruth", "1sm": "1samuel", "2sm": "2samuel",
  "1rs": "1kings", "2rs": "2kings", "1cr": "1chronicles", "2cr": "2chronicles",
  ed: "ezra", ne: "nehemiah", et: "esther", job: "job", sl: "psalms",
  pv: "proverbs", ec: "ecclesiastes", ct: "song of solomon",
  is: "isaiah", jr: "jeremiah", lm: "lamentations", ez: "ezekiel", dn: "daniel",
  os: "hosea", jl: "joel", am: "amos", ob: "obadiah", jn: "jonah",
  mq: "micah", na: "nahum", hc: "habakkuk", sf: "zephaniah",
  ag: "haggai", zc: "zechariah", ml: "malachi",
  mt: "matthew", mc: "mark", lc: "luke", jo: "john", at: "acts",
  rm: "romans", "1co": "1corinthians", "2co": "2corinthians",
  gl: "galatians", ef: "ephesians", fp: "philippians", cl: "colossians",
  "1ts": "1thessalonians", "2ts": "2thessalonians",
  "1tm": "1timothy", "2tm": "2timothy", tt: "titus", fm: "philemon",
  hb: "hebrews", tg: "james", "1pe": "1peter", "2pe": "2peter",
  "1jo": "1john", "2jo": "2john", "3jo": "3john", jd: "jude", ap: "revelation",
};

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function cachedFetch<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data as T;
}

export async function getChapter(abbrev: string, chapter: number): Promise<ChapterResponse> {
  const englishName = bookNameMap[abbrev.toLowerCase()];
  if (!englishName) throw new Error(`Livro não encontrado: ${abbrev}`);

  const url = `${BASE_URL}/${encodeURIComponent(englishName)}+${chapter}?translation=${TRANSLATION}`;
  const data = await cachedFetch<{
    reference: string;
    verses: { verse: number; text: string }[];
  }>(url);

  return {
    reference: data.reference,
    verses: (data.verses || []).map((v) => ({
      number: v.verse,
      text: v.text.trim(),
    })),
  };
}

export async function getRandomVerse(): Promise<{
  book: { name: string };
  chapter: number;
  number: number;
  text: string;
}> {
  // Pick a random well-known verse
  const favorites = [
    "john+3:16", "psalms+23:1", "philippians+4:13", "proverbs+3:5-6",
    "jeremiah+29:11", "isaiah+40:31", "psalms+119:105", "isaiah+41:10",
    "john+8:32", "psalms+34:4", "romans+8:28", "joshua+1:9",
    "matthew+11:28", "psalms+46:1", "2timothy+1:7", "romans+12:2",
    "hebrews+11:1", "psalms+27:1", "proverbs+18:10", "1peter+5:7",
  ];
  const pick = favorites[Math.floor(Math.random() * favorites.length)];
  const url = `${BASE_URL}/${pick}?translation=${TRANSLATION}`;

  const data = await cachedFetch<{
    reference: string;
    verses: { book_name: string; chapter: number; verse: number; text: string }[];
  }>(url);

  const v = data.verses[0];
  return {
    book: { name: v.book_name },
    chapter: v.chapter,
    number: v.verse,
    text: v.text.trim(),
  };
}

export async function searchVerses(query: string): Promise<
  { book: { name: string }; chapter: number; number: number; text: string }[]
> {
  // bible-api.com doesn't support search, so we search known passages
  // by fetching chapters that likely contain the keyword
  const chapters = [
    "psalms+23", "psalms+91", "john+3", "romans+8", "1corinthians+13",
    "matthew+5", "proverbs+3", "isaiah+40", "philippians+4", "hebrews+11",
  ];

  const queryLower = query.toLowerCase();
  const results: { book: { name: string }; chapter: number; number: number; text: string }[] = [];

  // Fetch a few chapters and filter by keyword
  const fetches = chapters.slice(0, 4).map(async (ch) => {
    try {
      const url = `${BASE_URL}/${ch}?translation=${TRANSLATION}`;
      const data = await cachedFetch<{
        verses: { book_name: string; chapter: number; verse: number; text: string }[];
      }>(url);
      return data.verses
        .filter((v) => v.text.toLowerCase().includes(queryLower))
        .map((v) => ({
          book: { name: v.book_name },
          chapter: v.chapter,
          number: v.verse,
          text: v.text.trim(),
        }));
    } catch {
      return [];
    }
  });

  const allResults = await Promise.all(fetches);
  allResults.forEach((r) => results.push(...r));

  return results.slice(0, 20);
}
