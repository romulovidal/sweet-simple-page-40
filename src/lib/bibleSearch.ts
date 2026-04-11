import { bibleBooks, type BibleBook } from "@/data/bible";

export interface SmartBibleMatch {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  bookAbbrev: string;
  chapter: number;
  verse?: number;
}

export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const aliasMap = new Map<string, string>();

const registerAliases = (aliases: string[], apiAbbrev: string) => {
  aliases.forEach((alias) => aliasMap.set(normalizeSearchText(alias), apiAbbrev));
};

bibleBooks.forEach((book) => {
  registerAliases([book.name, book.abbrev, book.apiAbbrev], book.apiAbbrev);
});

Object.entries({
  genesis: "gn",
  exodus: "ex",
  leviticus: "lv",
  numbers: "nm",
  deuteronomy: "dt",
  joshua: "js",
  judges: "jz",
  ruth: "rt",
  "1 samuel": "1sm",
  "1samuel": "1sm",
  "2 samuel": "2sm",
  "2samuel": "2sm",
  "1 kings": "1rs",
  "1kings": "1rs",
  "2 kings": "2rs",
  "2kings": "2rs",
  "1 chronicles": "1cr",
  "1chronicles": "1cr",
  "2 chronicles": "2cr",
  "2chronicles": "2cr",
  ezra: "ed",
  nehemiah: "ne",
  esther: "et",
  job: "job",
  psalm: "sl",
  psalms: "sl",
  proverb: "pv",
  proverbs: "pv",
  ecclesiastes: "ec",
  "song of solomon": "ct",
  "songofsolomon": "ct",
  isaiah: "is",
  jeremiah: "jr",
  lamentations: "lm",
  ezekiel: "ez",
  daniel: "dn",
  hosea: "os",
  joel: "jl",
  amos: "am",
  obadiah: "ob",
  jonah: "jn",
  micah: "mq",
  nahum: "na",
  habakkuk: "hc",
  zephaniah: "sf",
  haggai: "ag",
  zechariah: "zc",
  malachi: "ml",
  matthew: "mt",
  mark: "mc",
  luke: "lc",
  john: "jo",
  acts: "at",
  romans: "rm",
  "1 corinthians": "1co",
  "1corinthians": "1co",
  "2 corinthians": "2co",
  "2corinthians": "2co",
  galatians: "gl",
  ephesians: "ef",
  philippians: "fp",
  colossians: "cl",
  "1 thessalonians": "1ts",
  "1thessalonians": "1ts",
  "2 thessalonians": "2ts",
  "2thessalonians": "2ts",
  "1 timothy": "1tm",
  "1timothy": "1tm",
  "2 timothy": "2tm",
  "2timothy": "2tm",
  titus: "tt",
  philemon: "fm",
  hebrews: "hb",
  james: "tg",
  "1 peter": "1pe",
  "1peter": "1pe",
  "2 peter": "2pe",
  "2peter": "2pe",
  "1 john": "1jo",
  "1john": "1jo",
  "2 john": "2jo",
  "2john": "2jo",
  "3 john": "3jo",
  "3john": "3jo",
  jude: "jd",
  revelation: "ap",
}).forEach(([alias, apiAbbrev]) => registerAliases([alias], apiAbbrev));

export const smartBibleMatches: SmartBibleMatch[] = [
  {
    id: "ansiedade",
    label: "Ansiedade e descanso",
    description: "Encontre consolo e paz quando o coração estiver acelerado.",
    keywords: ["ansiedade", "preocupacao", "medo", "descanso", "calma"],
    bookAbbrev: "fp",
    chapter: 4,
    verse: 6,
  },
  {
    id: "amor",
    label: "Amor verdadeiro",
    description: "Versículos sobre amor, entrega e relacionamento com Deus e com o próximo.",
    keywords: ["amor", "amar", "casamento", "relacionamento", "familia"],
    bookAbbrev: "1co",
    chapter: 13,
    verse: 4,
  },
  {
    id: "fe",
    label: "Fé para continuar",
    description: "Textos para fortalecer sua confiança mesmo nos dias difíceis.",
    keywords: ["fe", "confianca", "crer", "milagre", "esperar"],
    bookAbbrev: "hb",
    chapter: 11,
    verse: 1,
  },
  {
    id: "paz",
    label: "Paz em Deus",
    description: "Palavras de Jesus para aquietar a alma e renovar o coração.",
    keywords: ["paz", "calma", "descanso", "seguranca"],
    bookAbbrev: "jo",
    chapter: 14,
    verse: 27,
  },
  {
    id: "coragem",
    label: "Coragem e força",
    description: "Promessas para enfrentar batalhas com confiança.",
    keywords: ["coragem", "forca", "animo", "batalha", "vencer"],
    bookAbbrev: "js",
    chapter: 1,
    verse: 9,
  },
  {
    id: "proposito",
    label: "Propósito e futuro",
    description: "Lembre-se de que Deus continua guiando sua história.",
    keywords: ["proposito", "futuro", "chamado", "destino", "plano"],
    bookAbbrev: "jr",
    chapter: 29,
    verse: 11,
  },
  {
    id: "oracao",
    label: "Vida de oração",
    description: "Aprenda a orar e permanecer na presença de Deus.",
    keywords: ["oracao", "orar", "intimidade", "presenca", "clamor"],
    bookAbbrev: "mt",
    chapter: 6,
    verse: 6,
  },
  {
    id: "protecao",
    label: "Proteção do Senhor",
    description: "Capítulos muito lidos quando se busca abrigo, cuidado e livramento.",
    keywords: ["protecao", "livramento", "abrigo", "seguranca", "refugio"],
    bookAbbrev: "sl",
    chapter: 91,
    verse: 1,
  },
  {
    id: "esperanca",
    label: "Esperança renovada",
    description: "Promessas para lembrar que Deus continua trabalhando em tudo.",
    keywords: ["esperanca", "promessa", "futuro", "renovo"],
    bookAbbrev: "rm",
    chapter: 8,
    verse: 28,
  },
  {
    id: "sabedoria",
    label: "Sabedoria prática",
    description: "Busque direção para decisões do dia a dia.",
    keywords: ["sabedoria", "direcao", "decisao", "conselho", "prudencia"],
    bookAbbrev: "pv",
    chapter: 3,
    verse: 5,
  },
];

export function findBibleBook(term: string): BibleBook | null {
  const normalizedTerm = normalizeSearchText(term);
  const apiAbbrev = aliasMap.get(normalizedTerm);
  if (!apiAbbrev) return null;
  return bibleBooks.find((book) => book.apiAbbrev === apiAbbrev) ?? null;
}

export function resolveBookAbbrev(bookName: string): string | null {
  return findBibleBook(bookName)?.apiAbbrev ?? null;
}

export function parseBibleReference(query: string): { book: BibleBook; chapter: number; verse?: number } | null {
  const normalizedQuery = normalizeSearchText(query);
  const match = normalizedQuery.match(/^((?:[123]\s*)?[a-z ]+?)\s+(\d{1,3})(?::(\d{1,3}))?$/);
  if (!match) return null;

  const [, bookPart, chapterPart, versePart] = match;
  const book = findBibleBook(bookPart);
  const chapter = Number(chapterPart);
  const verse = versePart ? Number(versePart) : undefined;

  if (!book || Number.isNaN(chapter) || chapter < 1 || chapter > book.chapters) {
    return null;
  }

  return {
    book,
    chapter,
    verse: verse && verse > 0 ? verse : undefined,
  };
}

export function getSmartBibleMatches(query: string): SmartBibleMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return smartBibleMatches.filter((match) =>
    [match.label, match.description, ...match.keywords].some((value) =>
      normalizeSearchText(value).includes(normalizedQuery) || normalizedQuery.includes(normalizeSearchText(value))
    )
  );
}
