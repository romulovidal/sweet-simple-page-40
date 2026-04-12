export interface BibleBookData {
  abbrev: string;
  chapters: string[][];
}

const bundledBibleModules = import.meta.glob<BibleBookData[]>("../data/bibles/*.json", {
  import: "default",
});

export async function loadBundledBibleVersion(fileName: string): Promise<BibleBookData[]> {
  const loader = bundledBibleModules[`../data/bibles/${fileName}.json`];

  if (!loader) {
    throw new Error(`Versão bíblica não encontrada no bundle: ${fileName}`);
  }

  return loader();
}
