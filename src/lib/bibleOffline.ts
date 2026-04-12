import { BIBLE_VERSIONS, type BibleVersion } from "@/services/bibleApi";
import { loadBundledBibleVersion, type BibleBookData } from "@/services/bibleDataLoader";

const CACHE_NAME = "bible-offline-v1";
const cacheKeyForVersion = (fileName: string) => `/offline-bibles/${fileName}.json`;

export async function isVersionCached(version: BibleVersion): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cacheKeyForVersion(version.fileName));
    return !!response;
  } catch {
    return false;
  }
}

export async function getCachedVersions(): Promise<string[]> {
  const cached: string[] = [];
  for (const v of BIBLE_VERSIONS) {
    if (await isVersionCached(v)) cached.push(v.id);
  }
  return cached;
}

export async function getCachedVersionData(fileName: string): Promise<BibleBookData[] | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cacheKeyForVersion(fileName));
    if (!response) return null;
    return (await response.json()) as BibleBookData[];
  } catch {
    return null;
  }
}

export async function downloadVersion(
  version: BibleVersion,
  onProgress?: (pct: number) => void
): Promise<void> {
  onProgress?.(10);
  const data = await loadBundledBibleVersion(version.fileName);
  onProgress?.(80);

  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    cacheKeyForVersion(version.fileName),
    new Response(blob, { headers: { "Content-Type": "application/json" } })
  );

  onProgress?.(100);
}

export async function removeVersion(version: BibleVersion): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(cacheKeyForVersion(version.fileName));
}

export async function fetchWithOffline(url: string): Promise<Response> {
  const fileName = url.split("/").pop()?.replace(".json", "");
  if (!fileName) {
    throw new Error("URL inválida para leitura offline");
  }

  const cached = await getCachedVersionData(fileName);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const bundled = await loadBundledBibleVersion(fileName);
  return new Response(JSON.stringify(bundled), {
    headers: { "Content-Type": "application/json" },
  });
}
