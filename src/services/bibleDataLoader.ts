export interface BibleBookData {
  abbrev: string;
  chapters: string[][];
}

const AVAILABLE_VERSIONS = ["ACF", "ARA", "ARC", "KJA", "NTLH", "NVI"] as const;
type AvailableVersion = (typeof AVAILABLE_VERSIONS)[number];

const versionModuleLoaders: Record<AvailableVersion, () => Promise<BibleBookData[]>> = {
  ACF: () => import("@/data/bibles/ACF.json").then((module) => module.default as BibleBookData[]),
  ARA: () => import("@/data/bibles/ARA.json").then((module) => module.default as BibleBookData[]),
  ARC: () => import("@/data/bibles/ARC.json").then((module) => module.default as BibleBookData[]),
  KJA: () => import("@/data/bibles/KJA.json").then((module) => module.default as BibleBookData[]),
  NTLH: () => import("@/data/bibles/NTLH.json").then((module) => module.default as BibleBookData[]),
  NVI: () => import("@/data/bibles/NVI.json").then((module) => module.default as BibleBookData[]),
};

function getBibleAssetUrl(fileName: string) {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost";

  return new URL(`${normalizedBaseUrl}biblias/${fileName}.json`, origin).toString();
}

function validateBiblePayload(payload: unknown, fileName: string): BibleBookData[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`Arquivo da versão bíblica ${fileName} está inválido ou indisponível.`);
  }

  return payload as BibleBookData[];
}

async function loadBibleFromModule(fileName: AvailableVersion): Promise<BibleBookData[]> {
  const loader = versionModuleLoaders[fileName];
  return validateBiblePayload(await loader(), fileName);
}

export async function loadBundledBibleVersion(fileName: string): Promise<BibleBookData[]> {
  if (!AVAILABLE_VERSIONS.includes(fileName as AvailableVersion)) {
    throw new Error(`Versão bíblica não encontrada: ${fileName}. Disponíveis: ${AVAILABLE_VERSIONS.join(", ")}`);
  }

  const normalizedFileName = fileName as AvailableVersion;

  try {
    const response = await fetch(getBibleAssetUrl(normalizedFileName), {
      cache: "force-cache",
    });

    if (response.ok) {
      const rawPayload = await response.text();

      try {
        const parsed = JSON.parse(rawPayload) as BibleBookData[];
        return validateBiblePayload(parsed, normalizedFileName);
      } catch {
        console.warn(`Falha ao ler ${normalizedFileName}.json via asset público; usando fallback interno.`);
      }
    }
  } catch {
    console.warn(`Falha ao buscar ${normalizedFileName}.json; usando fallback interno.`);
  }

  try {
    return await loadBibleFromModule(normalizedFileName);
  } catch {
    throw new Error(`Arquivo da versão bíblica ${normalizedFileName} está inválido ou indisponível.`);
  }
}
