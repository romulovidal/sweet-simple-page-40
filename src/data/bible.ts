export interface BibleBook {
  name: string;
  abbrev: string;
  apiAbbrev: string; // abbreviation for ABibliaDigital API
  chapters: number;
  testament: "VT" | "NT";
}

export const bibleBooks: BibleBook[] = [
  // Velho Testamento
  { name: "Gênesis", abbrev: "Gn", apiAbbrev: "gn", chapters: 50, testament: "VT" },
  { name: "Êxodo", abbrev: "Êx", apiAbbrev: "ex", chapters: 40, testament: "VT" },
  { name: "Levítico", abbrev: "Lv", apiAbbrev: "lv", chapters: 27, testament: "VT" },
  { name: "Números", abbrev: "Nm", apiAbbrev: "nm", chapters: 36, testament: "VT" },
  { name: "Deuteronômio", abbrev: "Dt", apiAbbrev: "dt", chapters: 34, testament: "VT" },
  { name: "Josué", abbrev: "Js", apiAbbrev: "js", chapters: 24, testament: "VT" },
  { name: "Juízes", abbrev: "Jz", apiAbbrev: "jz", chapters: 21, testament: "VT" },
  { name: "Rute", abbrev: "Rt", apiAbbrev: "rt", chapters: 4, testament: "VT" },
  { name: "1 Samuel", abbrev: "1Sm", apiAbbrev: "1sm", chapters: 31, testament: "VT" },
  { name: "2 Samuel", abbrev: "2Sm", apiAbbrev: "2sm", chapters: 24, testament: "VT" },
  { name: "1 Reis", abbrev: "1Rs", apiAbbrev: "1rs", chapters: 22, testament: "VT" },
  { name: "2 Reis", abbrev: "2Rs", apiAbbrev: "2rs", chapters: 25, testament: "VT" },
  { name: "1 Crônicas", abbrev: "1Cr", apiAbbrev: "1cr", chapters: 29, testament: "VT" },
  { name: "2 Crônicas", abbrev: "2Cr", apiAbbrev: "2cr", chapters: 36, testament: "VT" },
  { name: "Esdras", abbrev: "Ed", apiAbbrev: "ed", chapters: 10, testament: "VT" },
  { name: "Neemias", abbrev: "Ne", apiAbbrev: "ne", chapters: 13, testament: "VT" },
  { name: "Ester", abbrev: "Et", apiAbbrev: "et", chapters: 10, testament: "VT" },
  { name: "Jó", abbrev: "Jó", apiAbbrev: "job", chapters: 42, testament: "VT" },
  { name: "Salmos", abbrev: "Sl", apiAbbrev: "sl", chapters: 150, testament: "VT" },
  { name: "Provérbios", abbrev: "Pv", apiAbbrev: "pv", chapters: 31, testament: "VT" },
  { name: "Eclesiastes", abbrev: "Ec", apiAbbrev: "ec", chapters: 12, testament: "VT" },
  { name: "Cantares", abbrev: "Ct", apiAbbrev: "ct", chapters: 8, testament: "VT" },
  { name: "Isaías", abbrev: "Is", apiAbbrev: "is", chapters: 66, testament: "VT" },
  { name: "Jeremias", abbrev: "Jr", apiAbbrev: "jr", chapters: 52, testament: "VT" },
  { name: "Lamentações", abbrev: "Lm", apiAbbrev: "lm", chapters: 5, testament: "VT" },
  { name: "Ezequiel", abbrev: "Ez", apiAbbrev: "ez", chapters: 48, testament: "VT" },
  { name: "Daniel", abbrev: "Dn", apiAbbrev: "dn", chapters: 12, testament: "VT" },
  { name: "Oséias", abbrev: "Os", apiAbbrev: "os", chapters: 14, testament: "VT" },
  { name: "Joel", abbrev: "Jl", apiAbbrev: "jl", chapters: 3, testament: "VT" },
  { name: "Amós", abbrev: "Am", apiAbbrev: "am", chapters: 9, testament: "VT" },
  { name: "Obadias", abbrev: "Ob", apiAbbrev: "ob", chapters: 1, testament: "VT" },
  { name: "Jonas", abbrev: "Jn", apiAbbrev: "jn", chapters: 4, testament: "VT" },
  { name: "Miquéias", abbrev: "Mq", apiAbbrev: "mq", chapters: 7, testament: "VT" },
  { name: "Naum", abbrev: "Na", apiAbbrev: "na", chapters: 3, testament: "VT" },
  { name: "Habacuque", abbrev: "Hc", apiAbbrev: "hc", chapters: 3, testament: "VT" },
  { name: "Sofonias", abbrev: "Sf", apiAbbrev: "sf", chapters: 3, testament: "VT" },
  { name: "Ageu", abbrev: "Ag", apiAbbrev: "ag", chapters: 2, testament: "VT" },
  { name: "Zacarias", abbrev: "Zc", apiAbbrev: "zc", chapters: 14, testament: "VT" },
  { name: "Malaquias", abbrev: "Ml", apiAbbrev: "ml", chapters: 4, testament: "VT" },
  // Novo Testamento
  { name: "Mateus", abbrev: "Mt", apiAbbrev: "mt", chapters: 28, testament: "NT" },
  { name: "Marcos", abbrev: "Mc", apiAbbrev: "mc", chapters: 16, testament: "NT" },
  { name: "Lucas", abbrev: "Lc", apiAbbrev: "lc", chapters: 24, testament: "NT" },
  { name: "João", abbrev: "Jo", apiAbbrev: "jo", chapters: 21, testament: "NT" },
  { name: "Atos", abbrev: "At", apiAbbrev: "at", chapters: 28, testament: "NT" },
  { name: "Romanos", abbrev: "Rm", apiAbbrev: "rm", chapters: 16, testament: "NT" },
  { name: "1 Coríntios", abbrev: "1Co", apiAbbrev: "1co", chapters: 16, testament: "NT" },
  { name: "2 Coríntios", abbrev: "2Co", apiAbbrev: "2co", chapters: 13, testament: "NT" },
  { name: "Gálatas", abbrev: "Gl", apiAbbrev: "gl", chapters: 6, testament: "NT" },
  { name: "Efésios", abbrev: "Ef", apiAbbrev: "ef", chapters: 6, testament: "NT" },
  { name: "Filipenses", abbrev: "Fp", apiAbbrev: "fp", chapters: 4, testament: "NT" },
  { name: "Colossenses", abbrev: "Cl", apiAbbrev: "cl", chapters: 4, testament: "NT" },
  { name: "1 Tessalonicenses", abbrev: "1Ts", apiAbbrev: "1ts", chapters: 5, testament: "NT" },
  { name: "2 Tessalonicenses", abbrev: "2Ts", apiAbbrev: "2ts", chapters: 3, testament: "NT" },
  { name: "1 Timóteo", abbrev: "1Tm", apiAbbrev: "1tm", chapters: 6, testament: "NT" },
  { name: "2 Timóteo", abbrev: "2Tm", apiAbbrev: "2tm", chapters: 4, testament: "NT" },
  { name: "Tito", abbrev: "Tt", apiAbbrev: "tt", chapters: 3, testament: "NT" },
  { name: "Filemom", abbrev: "Fm", apiAbbrev: "fm", chapters: 1, testament: "NT" },
  { name: "Hebreus", abbrev: "Hb", apiAbbrev: "hb", chapters: 13, testament: "NT" },
  { name: "Tiago", abbrev: "Tg", apiAbbrev: "tg", chapters: 5, testament: "NT" },
  { name: "1 Pedro", abbrev: "1Pe", apiAbbrev: "1pe", chapters: 5, testament: "NT" },
  { name: "2 Pedro", abbrev: "2Pe", apiAbbrev: "2pe", chapters: 3, testament: "NT" },
  { name: "1 João", abbrev: "1Jo", apiAbbrev: "1jo", chapters: 5, testament: "NT" },
  { name: "2 João", abbrev: "2Jo", apiAbbrev: "2jo", chapters: 1, testament: "NT" },
  { name: "3 João", abbrev: "3Jo", apiAbbrev: "3jo", chapters: 1, testament: "NT" },
  { name: "Judas", abbrev: "Jd", apiAbbrev: "jd", chapters: 1, testament: "NT" },
  { name: "Apocalipse", abbrev: "Ap", apiAbbrev: "ap", chapters: 22, testament: "NT" },
];

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  days: number;
  category: string;
  image: string;
  readings: { bookAbbrev: string; chapter: number }[];
}

export const readingPlans: ReadingPlan[] = [
  {
    id: "1",
    title: "Salmos de Conforto",
    description: "30 Salmos que trazem paz e esperança",
    days: 30,
    category: "Devocionais",
    image: "🕊️",
    readings: [
      { bookAbbrev: "sl", chapter: 1 }, { bookAbbrev: "sl", chapter: 4 }, { bookAbbrev: "sl", chapter: 8 },
      { bookAbbrev: "sl", chapter: 16 }, { bookAbbrev: "sl", chapter: 18 }, { bookAbbrev: "sl", chapter: 19 },
      { bookAbbrev: "sl", chapter: 23 }, { bookAbbrev: "sl", chapter: 25 }, { bookAbbrev: "sl", chapter: 27 },
      { bookAbbrev: "sl", chapter: 30 }, { bookAbbrev: "sl", chapter: 32 }, { bookAbbrev: "sl", chapter: 34 },
      { bookAbbrev: "sl", chapter: 37 }, { bookAbbrev: "sl", chapter: 40 }, { bookAbbrev: "sl", chapter: 42 },
      { bookAbbrev: "sl", chapter: 46 }, { bookAbbrev: "sl", chapter: 51 }, { bookAbbrev: "sl", chapter: 62 },
      { bookAbbrev: "sl", chapter: 63 }, { bookAbbrev: "sl", chapter: 84 }, { bookAbbrev: "sl", chapter: 86 },
      { bookAbbrev: "sl", chapter: 90 }, { bookAbbrev: "sl", chapter: 91 }, { bookAbbrev: "sl", chapter: 100 },
      { bookAbbrev: "sl", chapter: 103 }, { bookAbbrev: "sl", chapter: 119 }, { bookAbbrev: "sl", chapter: 121 },
      { bookAbbrev: "sl", chapter: 139 }, { bookAbbrev: "sl", chapter: 145 }, { bookAbbrev: "sl", chapter: 150 },
    ],
  },
  {
    id: "2",
    title: "Vida de Jesus",
    description: "Conheça Jesus nos 4 Evangelhos em 40 dias",
    days: 40,
    category: "Temáticos",
    image: "✝️",
    readings: [
      { bookAbbrev: "lc", chapter: 1 }, { bookAbbrev: "lc", chapter: 2 }, { bookAbbrev: "mt", chapter: 1 },
      { bookAbbrev: "mt", chapter: 2 }, { bookAbbrev: "mt", chapter: 3 }, { bookAbbrev: "mt", chapter: 4 },
      { bookAbbrev: "mt", chapter: 5 }, { bookAbbrev: "mt", chapter: 6 }, { bookAbbrev: "mt", chapter: 7 },
      { bookAbbrev: "mt", chapter: 8 }, { bookAbbrev: "mc", chapter: 1 }, { bookAbbrev: "mc", chapter: 2 },
      { bookAbbrev: "mc", chapter: 3 }, { bookAbbrev: "mc", chapter: 4 }, { bookAbbrev: "mc", chapter: 5 },
      { bookAbbrev: "mc", chapter: 6 }, { bookAbbrev: "lc", chapter: 10 }, { bookAbbrev: "lc", chapter: 15 },
      { bookAbbrev: "jo", chapter: 1 }, { bookAbbrev: "jo", chapter: 2 }, { bookAbbrev: "jo", chapter: 3 },
      { bookAbbrev: "jo", chapter: 4 }, { bookAbbrev: "jo", chapter: 5 }, { bookAbbrev: "jo", chapter: 6 },
      { bookAbbrev: "jo", chapter: 10 }, { bookAbbrev: "jo", chapter: 11 }, { bookAbbrev: "jo", chapter: 13 },
      { bookAbbrev: "jo", chapter: 14 }, { bookAbbrev: "jo", chapter: 15 }, { bookAbbrev: "jo", chapter: 16 },
      { bookAbbrev: "jo", chapter: 17 }, { bookAbbrev: "mt", chapter: 26 }, { bookAbbrev: "mt", chapter: 27 },
      { bookAbbrev: "mc", chapter: 14 }, { bookAbbrev: "mc", chapter: 15 }, { bookAbbrev: "lc", chapter: 22 },
      { bookAbbrev: "lc", chapter: 23 }, { bookAbbrev: "jo", chapter: 18 }, { bookAbbrev: "jo", chapter: 19 },
      { bookAbbrev: "jo", chapter: 20 },
    ],
  },
  {
    id: "3",
    title: "Provérbios em 31 Dias",
    description: "Um capítulo de sabedoria por dia",
    days: 31,
    category: "Sabedoria",
    image: "💡",
    readings: Array.from({ length: 31 }, (_, i) => ({ bookAbbrev: "pv", chapter: i + 1 })),
  },
  {
    id: "4",
    title: "Cartas de Paulo",
    description: "Todas as epístolas paulinas em 60 leituras",
    days: 60,
    category: "Estudo",
    image: "📜",
    readings: [
      // Romanos (16 cap)
      ...Array.from({ length: 16 }, (_, i) => ({ bookAbbrev: "rm", chapter: i + 1 })),
      // 1 Coríntios (16 cap)
      ...Array.from({ length: 16 }, (_, i) => ({ bookAbbrev: "1co", chapter: i + 1 })),
      // 2 Coríntios (13 cap)
      ...Array.from({ length: 13 }, (_, i) => ({ bookAbbrev: "2co", chapter: i + 1 })),
      // Gálatas (6 cap)
      ...Array.from({ length: 6 }, (_, i) => ({ bookAbbrev: "gl", chapter: i + 1 })),
      // Efésios (6 cap)
      ...Array.from({ length: 6 }, (_, i) => ({ bookAbbrev: "ef", chapter: i + 1 })),
      // Filipenses (4 cap)
      ...Array.from({ length: 4 }, (_, i) => ({ bookAbbrev: "fp", chapter: i + 1 })),
      // Colossenses, 1/2 Ts ficam como bônus
      { bookAbbrev: "cl", chapter: 1 }, { bookAbbrev: "cl", chapter: 2 }, { bookAbbrev: "cl", chapter: 3 },
    ],
  },
  {
    id: "5",
    title: "Gênesis — As Origens",
    description: "Toda a história de Gênesis em 50 dias",
    days: 50,
    category: "Panorama",
    image: "🌍",
    readings: Array.from({ length: 50 }, (_, i) => ({ bookAbbrev: "gn", chapter: i + 1 })),
  },
  {
    id: "6",
    title: "Evangelho de João",
    description: "O evangelho do discípulo amado em 21 dias",
    days: 21,
    category: "Evangelhos",
    image: "📖",
    readings: Array.from({ length: 21 }, (_, i) => ({ bookAbbrev: "jo", chapter: i + 1 })),
  },
];

