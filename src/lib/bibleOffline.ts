import { BIBLE_VERSIONS, type BibleVersion } from "@/services/bibleApi";
import {
  getBibleAssetUrl,
  isBibleBookData,
  parseBibleBookData,
  loadBundledBibleVersion,
  type BibleBookData,
} from "@/services/bibleDataLoader";

const CACHE_NAME = "bible-offline-v5";
const LEGACY_CACHE_NAMES = ["bible-offline-v1", "bible-offline-v2", "bible-offline-v3", "bible-offline-v4"];
// Mesma chave que o service worker usa ao cachear /biblias/*.json na leitura:
// download e leitura normal compartilham UMA única cópia por versão.
const cacheKeyForVersion = (fileName: string) => `/biblias/${fileName}.json`;
// Chave antiga (versões baixadas antes desta unificação): lida na migração.
const legacyCacheKeyForVersion = (fileName: string) => `/offline-bibles/${fileName}.json`;
let cacheSetupPromise: Promise<void> | null = null;

async function ensureBibleCacheReady(): Promise<void> {
  if (!("caches" in globalThis)) return;

  if (!cacheSetupPromise) {
    cacheSetupPromise = (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        LEGACY_CACHE_NAMES
          .filter((name) => cacheNames.includes(name))
          .map((name) => caches.delete(name))
      );
    })();
  }

  await cacheSetupPromise;
}

function getOfflineSupportError() {
  return new Error("Seu navegador nao suportou o armazenamento offline da Biblia.");
}

function getOfflineDownloadError(version: BibleVersion, error: unknown) {
  if (error instanceof Error) {
    if (error.name === "QuotaExceededError") {
      return new Error(`Sem espaco suficiente para baixar ${version.shortName} offline.`);
    }

    return error;
  }

  return new Error(`Nao foi possivel baixar ${version.shortName} offline.`);
}

export async function isVersionCached(version: BibleVersion): Promise<boolean> {
  // Checagem leve: só verifica se a entrada existe no cache, SEM baixar nem
  // processar o JSON inteiro (a versão antiga fazia isso para cada versão).
  try {
    if (!("caches" in globalThis)) return false;

    await ensureBibleCacheReady();
    const cache = await caches.open(CACHE_NAME);
    const hit =
      (await cache.match(cacheKeyForVersion(version.fileName))) ||
      (await cache.match(legacyCacheKeyForVersion(version.fileName)));
    return !!hit;
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
    if (!("caches" in globalThis)) return null;

    await ensureBibleCacheReady();
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = cacheKeyForVersion(fileName);
    let response = await cache.match(cacheKey);
    if (!response) {
      // Migração: versão baixada com a chave antiga passa para a chave unificada.
      const legacy = await cache.match(legacyCacheKeyForVersion(fileName));
      if (legacy) {
        await cache.put(cacheKey, legacy.clone());
        await cache.delete(legacyCacheKeyForVersion(fileName));
        response = legacy;
      }
    }
    if (!response) return null;

    const rawPayload = await response.text();
    const data = parseBibleBookData(rawPayload, fileName) as unknown;

    if (!isBibleBookData(data)) {
      await cache.delete(cacheKey);
      return null;
    }

    return data;
  } catch {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(cacheKeyForVersion(fileName));
      await cache.delete(legacyCacheKeyForVersion(fileName));
    } catch {
      // Ignore secondary cleanup failures.
    }
    return null;
  }
}

export async function downloadVersion(
  version: BibleVersion,
  onProgress?: (pct: number) => void
): Promise<void> {
  if (!("caches" in globalThis)) {
    throw getOfflineSupportError();
  }

  await ensureBibleCacheReady();

  try {
    onProgress?.(10);
    const response = await fetch(getBibleAssetUrl(version.fileName), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Nao foi possivel carregar a versao biblica ${version.fileName}.`);
    }

    onProgress?.(40);
    const rawPayload = await response.text();
    parseBibleBookData(rawPayload, version.fileName);

    onProgress?.(75);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      cacheKeyForVersion(version.fileName),
      new Response(rawPayload, { headers: { "Content-Type": "application/json" } })
    );
    // Remove a cópia duplicada da chave antiga, se existir.
    await cache.delete(legacyCacheKeyForVersion(version.fileName));

    onProgress?.(90);
    const cachedData = await getCachedVersionData(version.fileName);
    if (!cachedData) {
      throw new Error(`Falha ao validar o download offline de ${version.shortName}.`);
    }

    onProgress?.(100);
  } catch (error) {
    throw getOfflineDownloadError(version, error);
  }
}

export async function removeVersion(version: BibleVersion): Promise<void> {
  if (!("caches" in globalThis)) return;

  await ensureBibleCacheReady();
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(cacheKeyForVersion(version.fileName));
  await cache.delete(legacyCacheKeyForVersion(version.fileName));
}

export async function fetchWithOffline(url: string): Promise<Response> {
  const fileName = url.split("/").pop()?.replace(".json", "");
  if (!fileName) {
    throw new Error("URL invalida para leitura offline");
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
