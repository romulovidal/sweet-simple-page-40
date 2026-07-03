import { loadBundledBibleVersion } from "@/services/bibleDataLoader";
import { BIBLE_VERSIONS, getVersionById } from "@/services/bibleApi";

export const DAILY_VERSE_VERSION_KEY = "daily_verse_version";
export const DEFAULT_DAILY_VERSION = "arc"; // Fallback per requirements

const versionCache = new Map<string, Awaited<ReturnType<typeof loadBundledBibleVersion>>>();

async function loadVersion(fileName: string) {
  const cached = versionCache.get(fileName);
  if (cached) return cached;
  const data = await loadBundledBibleVersion(fileName);
  versionCache.set(fileName, data);
  return data;
}

/**
 * Parse a reference like "João 3:16" or "1 Coríntios 13:4" into parts.
 */
export function parseReference(ref: string): { bookName: string; chapter: number; verse: number } | null {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)/);
  if (!match) return null;
  return {
    bookName: match[1].trim(),
    chapter: parseInt(match[2], 10),
    verse: parseInt(match[3], 10),
  };
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Fetch a verse text from a specific Bible version using its reference string.
 * Falls back to ARC if the chosen version doesn't have it. Returns null if all fail.
 */
export async function getVerseTextByReference(
  ref: string,
  versionId: string
): Promise<string | null> {
  const parsed = parseReference(ref);
  if (!parsed) return null;

  const tryVersion = async (vId: string) => {
    const version = getVersionById(vId);
    try {
      const data = await loadVersion(version.fileName);
      const target = norm(parsed.bookName);
      const book = data.find((b) => norm(b.name) === target);
      if (!book) return null;
      const chapter = book.chapters[parsed.chapter - 1];
      if (!chapter) return null;
      const text = chapter[parsed.verse - 1];
      return text ? text.trim() : null;
    } catch {
      return null;
    }
  };

  const primary = await tryVersion(versionId);
  if (primary) return primary;
  if (versionId !== DEFAULT_DAILY_VERSION) {
    return await tryVersion(DEFAULT_DAILY_VERSION);
  }
  return null;
}

/**
 * Get the total number of verses in a specific book and chapter.
 */
export async function getVerseCount(
  bookName: string,
  chapter: number,
  versionId: string = DEFAULT_DAILY_VERSION
): Promise<number> {
  const version = getVersionById(versionId);
  try {
    const data = await loadVersion(version.fileName);
    const target = norm(bookName);
    const book = data.find((b) => norm(b.name) === target);
    if (!book) return 0;
    const chapterData = book.chapters[chapter - 1];
    return chapterData ? chapterData.length : 0;
  } catch {
    return 0;
  }
}

export { BIBLE_VERSIONS };

/**
 * Load all verses of a chapter (1-based index in output not applied; array is 0-based).
 */
export async function getChapterVerses(
  bookName: string,
  chapter: number,
  versionId: string = DEFAULT_DAILY_VERSION
): Promise<string[]> {
  const tryVersion = async (vId: string) => {
    const version = getVersionById(vId);
    try {
      const data = await loadVersion(version.fileName);
      const target = norm(bookName);
      const book = data.find((b) => norm(b.name) === target);
      if (!book) return null;
      const chapterData = book.chapters[chapter - 1];
      return chapterData ?? null;
    } catch {
      return null;
    }
  };
  const primary = await tryVersion(versionId);
  if (primary) return primary;
  if (versionId !== DEFAULT_DAILY_VERSION) {
    const fb = await tryVersion(DEFAULT_DAILY_VERSION);
    if (fb) return fb;
  }
  return [];
}

/**
 * Format a set of verse numbers as a compact reference range.
 * [1,2,3] -> "1-3"   [1,3,5] -> "1,3,5"   [1,2,4,5,6] -> "1-2,4-6"
 */
export function formatVerseRange(verses: number[]): string {
  if (verses.length === 0) return "";
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
    }
    prev = cur;
  }
  return parts.join(",");
}

/**
 * Compose the display text for multiple verses of the same chapter.
 * Prepends each verse number in superscript style, e.g. "¹ No princípio... ² A terra..."
 */
export async function getVersesTextByNumbers(
  bookName: string,
  chapter: number,
  verseNumbers: number[],
  versionId: string
): Promise<string> {
  if (verseNumbers.length === 0) return "";
  const verses = await getChapterVerses(bookName, chapter, versionId);
  const sorted = [...new Set(verseNumbers)].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return (verses[sorted[0] - 1] || "").trim();
  }
  return sorted
    .map((n) => {
      const t = (verses[n - 1] || "").trim();
      return t ? `${n} ${t}` : "";
    })
    .filter(Boolean)
    .join(" ");
}
