export interface BibleBookData {
  abbrev: string;
  chapters: string[][];
}

const AVAILABLE_VERSIONS = ["ACF", "ARA", "ARC", "KJA", "NTLH", "NVI"] as const;

function getBibleAssetUrl(fileName: string) {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return `${normalizedBaseUrl}biblias/${fileName}.json`;
}

export async function loadBundledBibleVersion(fileName: string): Promise<BibleBookData[]> {
  if (!AVAILABLE_VERSIONS.includes(fileName as (typeof AVAILABLE_VERSIONS)[number])) {
    throw new Error(`Versão bíblica não encontrada: ${fileName}. Disponíveis: ${AVAILABLE_VERSIONS.join(", ")}`);
  }

  const response = await fetch(getBibleAssetUrl(fileName), {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível carregar a versão bíblica ${fileName}.`);
  }

  const rawPayload = await response.text();

  try {
    const parsed = JSON.parse(rawPayload) as BibleBookData[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Payload vazio");
    }

    return parsed;
  } catch {
    throw new Error(`Arquivo da versão bíblica ${fileName} está inválido ou indisponível.`);
  }
}
