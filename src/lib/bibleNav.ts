import { parseBibleReference, resolveBookAbbrev } from "@/lib/bibleSearch";

/**
 * Given a reference like "Gênesis 12", "João 3:16" or "1 Samuel 17",
 * returns the URL path that opens it on the Bible page.
 */
export function bibleUrlFromReference(ref: string): string | null {
  const parsed = parseBibleReference(ref);
  if (parsed) {
    const p = new URLSearchParams({
      book: parsed.book.apiAbbrev,
      chapter: String(parsed.chapter),
    });
    if (parsed.verse) p.set("verse", String(parsed.verse));
    return `/biblia?${p.toString()}`;
  }
  // Fallback: "Livro 12" or "Livro 7—12"
  const match = ref.match(/^(.+?)\s+(\d+)/);
  if (!match) return null;
  const bookAbbrev = resolveBookAbbrev(match[1].trim());
  if (!bookAbbrev) return null;
  const p = new URLSearchParams({ book: bookAbbrev, chapter: match[2] });
  return `/biblia?${p.toString()}`;
}