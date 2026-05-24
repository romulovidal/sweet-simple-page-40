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

export { BIBLE_VERSIONS };
