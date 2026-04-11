const BASE_URL = "https://www.abibliadigital.com.br/api";
const VERSION = "acf"; // Almeida Corrigida Fiel

export interface BibleVerse {
  number: number;
  text: string;
}

export interface ChapterResponse {
  book: {
    abbrev: { pt: string; en: string };
    name: string;
    author: string;
    group: string;
    version: string;
  };
  chapter: {
    number: number;
    verses: number;
  };
  verses: BibleVerse[];
}

export interface RandomVerseResponse {
  book: {
    abbrev: { pt: string; en: string };
    name: string;
  };
  chapter: number;
  number: number;
  text: string;
}

export interface SearchResult {
  book: {
    abbrev: { pt: string; en: string };
    name: string;
  };
  chapter: number;
  number: number;
  text: string;
}

// Simple in-memory cache to avoid hitting rate limits
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

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
  return cachedFetch<ChapterResponse>(
    `${BASE_URL}/verses/${VERSION}/${abbrev}/${chapter}`
  );
}

export async function getRandomVerse(): Promise<RandomVerseResponse> {
  // Don't cache random verse
  const response = await fetch(`${BASE_URL}/verses/${VERSION}/random`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function searchVerses(query: string): Promise<SearchResult[]> {
  const response = await fetch(`${BASE_URL}/verses/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: VERSION, search: query }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.verses || [];
}
