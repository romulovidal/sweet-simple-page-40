import { BIBLE_VERSIONS, type BibleVersion } from "@/services/bibleApi";

const CACHE_NAME = "bible-offline-v1";

export async function isVersionCached(version: BibleVersion): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(`/biblias/${version.fileName}.json`);
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

export async function downloadVersion(
  version: BibleVersion,
  onProgress?: (pct: number) => void
): Promise<void> {
  const url = `/biblias/${version.fileName}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar ${version.shortName}`);

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0 && onProgress) onProgress(Math.round((received / total) * 100));
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: "application/json" });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, new Response(blob, { headers: { "Content-Type": "application/json" } }));
  onProgress?.(100);
}

export async function removeVersion(version: BibleVersion): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(`/biblias/${version.fileName}.json`);
}

export async function fetchWithOffline(url: string): Promise<Response> {
  try {
    const response = await fetch(url);
    if (response.ok) return response;
    throw new Error("Network response not ok");
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached;
    throw new Error("Sem conexão e versão não disponível offline");
  }
}
