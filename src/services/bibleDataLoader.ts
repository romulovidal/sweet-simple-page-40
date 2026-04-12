export interface BibleBookData {
  abbrev: string;
  chapters: string[][];
}

const versionLoaders: Record<string, () => Promise<BibleBookData[]>> = {
  ACF: () => import("@/data/bibles/ACF.json").then(m => m.default as unknown as BibleBookData[]),
  ARA: () => import("@/data/bibles/ARA.json").then(m => m.default as unknown as BibleBookData[]),
  ARC: () => import("@/data/bibles/ARC.json").then(m => m.default as unknown as BibleBookData[]),
  KJA: () => import("@/data/bibles/KJA.json").then(m => m.default as unknown as BibleBookData[]),
  NTLH: () => import("@/data/bibles/NTLH.json").then(m => m.default as unknown as BibleBookData[]),
  NVI: () => import("@/data/bibles/NVI.json").then(m => m.default as unknown as BibleBookData[]),
};

export async function loadBundledBibleVersion(fileName: string): Promise<BibleBookData[]> {
  const loader = versionLoaders[fileName];
  if (!loader) {
    throw new Error(`Versão bíblica não encontrada: ${fileName}. Disponíveis: ${Object.keys(versionLoaders).join(", ")}`);
  }
  return loader();
}
