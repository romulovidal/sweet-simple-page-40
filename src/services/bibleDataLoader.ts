export interface BibleEpigraphData {
  title: string;
  start: {
    chapter: number;
    verse: number;
  };
  end: {
    chapter: number;
    verse: number;
  };
}

export interface BibleBookData {
  abbrev: string;
  chapters: string[][];
  name?: string;
  epigraphs?: BibleEpigraphData[];
}

const AVAILABLE_VERSIONS = ["ACF", "ARA", "ARC", "KJA", "NTLH", "NVI"] as const;

function isBibleEpigraphData(payload: unknown): payload is BibleEpigraphData {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as BibleEpigraphData;

  return (
    typeof candidate.title === "string" &&
    !!candidate.start &&
    typeof candidate.start.chapter === "number" &&
    typeof candidate.start.verse === "number" &&
    !!candidate.end &&
    typeof candidate.end.chapter === "number" &&
    typeof candidate.end.verse === "number"
  );
}

export function isBibleBookData(payload: unknown): payload is BibleBookData[] {
  return Array.isArray(payload) && payload.length > 0 && payload.every((book) => {
    if (!book || typeof book !== "object") return false;

    const candidate = book as BibleBookData;

    return (
      typeof candidate.abbrev === "string" &&
      Array.isArray(candidate.chapters) &&
      candidate.chapters.every((chapter) =>
        Array.isArray(chapter) && chapter.every((verse) => typeof verse === "string")
      ) &&
      (candidate.name === undefined || typeof candidate.name === "string") &&
      (candidate.epigraphs === undefined ||
        (Array.isArray(candidate.epigraphs) &&
          candidate.epigraphs.every((epigraph) => isBibleEpigraphData(epigraph))))
    );
  });
}

export function getBibleAssetUrl(fileName: string) {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost";

  return new URL(`${normalizedBaseUrl}biblias/${fileName}.json`, origin).toString();
}

export function parseBibleBookData(rawPayload: string, fileName: string): BibleBookData[] {
  try {
    const parsed = JSON.parse(rawPayload) as unknown;

    if (!isBibleBookData(parsed)) {
      throw new Error("Payload vazio");
    }

    return parsed;
  } catch {
    throw new Error(`Arquivo da versao biblica ${fileName} esta invalido ou indisponivel.`);
  }
}

export async function loadBundledBibleVersion(fileName: string): Promise<BibleBookData[]> {
  if (!AVAILABLE_VERSIONS.includes(fileName as (typeof AVAILABLE_VERSIONS)[number])) {
    throw new Error(`Versao biblica nao encontrada: ${fileName}. Disponiveis: ${AVAILABLE_VERSIONS.join(", ")}`);
  }

  const assetUrl = getBibleAssetUrl(fileName);
  const response = await fetch(assetUrl, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar a versao biblica ${fileName}.`);
  }

  const rawPayload = await response.text();

  try {
    return parseBibleBookData(rawPayload, fileName);
  } catch (initialError) {
    const retryUrl = new URL(assetUrl);
    retryUrl.searchParams.set("v", Date.now().toString());

    const retryResponse = await fetch(retryUrl.toString(), {
      cache: "no-store",
    });

    if (!retryResponse.ok) {
      throw initialError;
    }

    return parseBibleBookData(await retryResponse.text(), fileName);
  }
}
