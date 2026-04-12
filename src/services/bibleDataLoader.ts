export interface BibleBookData {
  abbrev: string;
  chapters: string[][];
}

const bundledBibleModules = import.meta.glob<BibleBookData[]>("@/data/bibles/*.json", {
  import: "default",
});

export async function loadBundledBibleVersion(fileName: string): Promise<BibleBookData[]> {
  const directKey = `../data/bibles/${fileName}.json`;
  const aliasKey = `/src/data/bibles/${fileName}.json`;
  const altAliasKey = `@/data/bibles/${fileName}.json`;
  const loader = bundledBibleModules[directKey] ?? bundledBibleModules[aliasKey] ?? bundledBibleModules[altAliasKey];

  if (!loader) {
    throw new Error(`Versão bíblica não encontrada no bundle: ${fileName}`);
  }

  return loader();
}
