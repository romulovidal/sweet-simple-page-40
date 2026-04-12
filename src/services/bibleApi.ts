import { bibleBooks } from "@/data/bible";

const BASE_URL = "https://bible-api.com";
const TRANSLATION = "almeida";

export interface BibleVerse {
  number: number;
  text: string;
}

export interface ChapterResponse {
  reference: string;
  verses: BibleVerse[];
}

export const bookNameMap: Record<string, string> = {
  gn: "genesis", ex: "exodus", lv: "leviticus", nm: "numbers", dt: "deuteronomy",
  js: "joshua", jz: "judges", rt: "ruth", "1sm": "1samuel", "2sm": "2samuel",
  "1rs": "1kings", "2rs": "2kings", "1cr": "1chronicles", "2cr": "2chronicles",
  ed: "ezra", ne: "nehemiah", et: "esther", job: "job", sl: "psalms",
  pv: "proverbs", ec: "ecclesiastes", ct: "song of solomon",
  is: "isaiah", jr: "jeremiah", lm: "lamentations", ez: "ezekiel", dn: "daniel",
  os: "hosea", jl: "joel", am: "amos", ob: "obadiah", jn: "jonah",
  mq: "micah", na: "nahum", hc: "habakkuk", sf: "zephaniah",
  ag: "haggai", zc: "zechariah", ml: "malachi",
  mt: "matthew", mc: "mark", lc: "luke", jo: "john", at: "acts",
  rm: "romans", "1co": "1corinthians", "2co": "2corinthians",
  gl: "galatians", ef: "ephesians", fp: "philippians", cl: "colossians",
  "1ts": "1thessalonians", "2ts": "2thessalonians",
  "1tm": "1timothy", "2tm": "2timothy", tt: "titus", fm: "philemon",
  hb: "hebrews", tg: "james", "1pe": "1peter", "2pe": "2peter",
  "1jo": "1john", "2jo": "2john", "3jo": "3john", jd: "jude", ap: "revelation",
};

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Broad topic-to-chapters mapping covering many keywords
const SEARCH_CHAPTERS_BY_TOPIC: { keywords: string[]; chapters: string[] }[] = [
  { keywords: ["amor", "amar", "ama", "amado", "amou"], chapters: ["1corinthians+13", "john+15", "john+3", "romans+12", "1john+4", "song of solomon+2"] },
  { keywords: ["fe", "crer", "creia", "milagre", "milagres", "creu"], chapters: ["hebrews+11", "mark+11", "romans+8", "mark+9", "john+11", "john+20"] },
  { keywords: ["paz", "descanso", "ansiedade", "preocupacao", "calma", "tranquilo"], chapters: ["philippians+4", "john+14", "psalms+23", "matthew+11", "isaiah+26", "psalms+4"] },
  { keywords: ["oracao", "orar", "ora", "clama", "clamor", "suplica", "intercede"], chapters: ["matthew+6", "psalms+91", "luke+11", "luke+18", "1thessalonians+5", "james+5"] },
  { keywords: ["sabedoria", "conselho", "direcao", "sabio", "entendimento", "prudencia"], chapters: ["proverbs+3", "proverbs+4", "james+1", "proverbs+1", "proverbs+2", "ecclesiastes+3"] },
  { keywords: ["coragem", "forca", "animo", "forte", "valente", "guerreiro"], chapters: ["joshua+1", "isaiah+41", "2timothy+1", "deuteronomy+31", "psalms+27", "ephesians+6"] },
  { keywords: ["esperanca", "proposito", "futuro", "plano", "destino"], chapters: ["jeremiah+29", "romans+8", "isaiah+40", "psalms+37", "lamentations+3", "romans+15"] },
  { keywords: ["cura", "restauracao", "saude", "curar", "curado", "doenca", "enfermidade"], chapters: ["psalms+103", "isaiah+53", "mark+5", "james+5", "matthew+8", "luke+4"] },
  { keywords: ["protecao", "protege", "refug", "escudo", "abrigo", "livramento", "guarda"], chapters: ["psalms+91", "psalms+121", "psalms+46", "psalms+23", "psalms+34", "2thessalonians+3"] },
  { keywords: ["perdao", "perdoar", "perdoa", "misericordia", "misericordioso", "compaixao"], chapters: ["matthew+18", "psalms+51", "colossians+3", "ephesians+4", "luke+15", "1john+1"] },
  { keywords: ["graca", "favor", "bondade"], chapters: ["ephesians+2", "romans+5", "2corinthians+12", "titus+2", "hebrews+4", "psalms+103"] },
  { keywords: ["pecado", "pecar", "tentacao", "tentado", "cai"], chapters: ["romans+3", "romans+6", "1john+1", "james+1", "matthew+4", "genesis+3"] },
  { keywords: ["salvacao", "salvar", "salvo", "redentor", "redencao", "resgate"], chapters: ["ephesians+2", "romans+10", "john+3", "acts+4", "titus+3", "psalms+27"] },
  { keywords: ["morte", "morrer", "morto", "luto", "consolo", "consolar"], chapters: ["1corinthians+15", "john+11", "revelation+21", "psalms+23", "2corinthians+1", "1thessalonians+4"] },
  { keywords: ["alegria", "alegre", "gozo", "feliz", "felicidade", "contentamento"], chapters: ["philippians+4", "psalms+16", "nehemiah+8", "james+1", "john+15", "psalms+126"] },
  { keywords: ["jesus", "cristo", "messias", "senhor", "filho"], chapters: ["john+1", "john+3", "matthew+1", "luke+2", "colossians+1", "hebrews+1"] },
  { keywords: ["espirito", "santo", "espiritual", "dons", "dom", "fruto"], chapters: ["galatians+5", "1corinthians+12", "acts+2", "romans+8", "john+14", "john+16"] },
  { keywords: ["deus", "criador", "soberano", "todopoderoso", "onipotente"], chapters: ["genesis+1", "psalms+139", "isaiah+40", "psalms+8", "romans+11", "job+38"] },
  { keywords: ["familia", "filh", "pai", "mae", "pais", "crianca", "obediencia"], chapters: ["ephesians+6", "proverbs+22", "deuteronomy+6", "psalms+127", "colossians+3", "proverbs+31"] },
  { keywords: ["casamento", "esposa", "marido", "casal", "matrimonio"], chapters: ["ephesians+5", "1corinthians+7", "genesis+2", "song of solomon+4", "proverbs+31", "hebrews+13"] },
  { keywords: ["trabalho", "servir", "servico", "emprego", "prosperidade", "prosperar"], chapters: ["colossians+3", "proverbs+10", "ecclesiastes+9", "2thessalonians+3", "psalms+1", "deuteronomy+28"] },
  { keywords: ["dinheiro", "riqueza", "dizimo", "oferta", "generosidade", "dar"], chapters: ["malachi+3", "2corinthians+9", "matthew+6", "1timothy+6", "proverbs+11", "luke+6"] },
  { keywords: ["palavra", "biblia", "escritura", "lei", "mandamento", "mandamentos"], chapters: ["psalms+119", "2timothy+3", "hebrews+4", "joshua+1", "psalms+1", "matthew+5"] },
  { keywords: ["igreja", "corpo", "irmaos", "comunhao", "unidade"], chapters: ["1corinthians+12", "ephesians+4", "acts+2", "hebrews+10", "colossians+3", "romans+12"] },
  { keywords: ["batalha", "guerra", "luta", "inimigo", "diabo", "mal", "armadura"], chapters: ["ephesians+6", "2corinthians+10", "james+4", "1peter+5", "psalms+144", "exodus+14"] },
  { keywords: ["louvor", "adoracao", "adorar", "cantar", "cantico", "musica"], chapters: ["psalms+150", "psalms+100", "psalms+95", "2chronicles+20", "revelation+5", "psalms+33"] },
  { keywords: ["agua", "rio", "mar", "fonte", "sede"], chapters: ["john+4", "revelation+22", "isaiah+55", "ezekiel+47", "psalms+42", "john+7"] },
  { keywords: ["luz", "trevas", "escuridao", "brilhar"], chapters: ["john+1", "john+8", "matthew+5", "1john+1", "isaiah+60", "psalms+27"] },
  { keywords: ["pastor", "ovelha", "rebanho", "guia", "guiar"], chapters: ["john+10", "psalms+23", "ezekiel+34", "1peter+5", "isaiah+40", "psalms+100"] },
  { keywords: ["pao", "alimento", "fome", "comer", "sustento"], chapters: ["john+6", "matthew+4", "exodus+16", "deuteronomy+8", "matthew+6", "psalms+37"] },
  { keywords: ["vida", "viver", "etern", "imortalidade", "ressurreicao", "ressuscit"], chapters: ["john+11", "john+14", "1corinthians+15", "john+3", "john+6", "romans+6"] },
  { keywords: ["cruz", "sangue", "sacrificio", "cordeiro", "expiacao"], chapters: ["isaiah+53", "john+19", "hebrews+9", "romans+5", "1peter+1", "revelation+5"] },
  { keywords: ["ceu", "paraiso", "celestial", "morada", "mansao"], chapters: ["revelation+21", "john+14", "2corinthians+5", "philippians+3", "hebrews+11", "1thessalonians+4"] },
  { keywords: ["fim", "apocalipse", "juizo", "julgamento", "volta", "vinda", "arrebatamento"], chapters: ["revelation+1", "matthew+24", "1thessalonians+4", "2peter+3", "revelation+21", "daniel+7"] },
  { keywords: ["batismo", "batizar", "batizado"], chapters: ["matthew+3", "acts+2", "romans+6", "acts+8", "matthew+28", "mark+1"] },
  { keywords: ["anjo", "anjos", "querubim", "serafim"], chapters: ["hebrews+1", "psalms+91", "revelation+5", "isaiah+6", "luke+1", "matthew+1"] },
  { keywords: ["criacao", "criar", "mundo", "terra", "natureza"], chapters: ["genesis+1", "genesis+2", "psalms+8", "psalms+19", "job+38", "romans+1"] },
  { keywords: ["arrependimento", "arrepend", "voltar", "conversao", "converter"], chapters: ["acts+3", "joel+2", "luke+15", "2chronicles+7", "psalms+51", "isaiah+55"] },
  { keywords: ["justica", "justo", "justos", "retidao", "reto"], chapters: ["matthew+5", "psalms+37", "proverbs+21", "micah+6", "isaiah+1", "amos+5"] },
  { keywords: ["obediencia", "obedecer", "obediente", "submissao"], chapters: ["john+14", "deuteronomy+28", "1samuel+15", "james+1", "romans+13", "hebrews+13"] },
  { keywords: ["paciencia", "esperar", "aguardar", "perseverar", "perseveranca"], chapters: ["james+1", "isaiah+40", "lamentations+3", "romans+5", "hebrews+12", "psalms+40"] },
  { keywords: ["humildade", "humilde", "mansidao", "manso"], chapters: ["philippians+2", "matthew+5", "1peter+5", "james+4", "matthew+11", "proverbs+22"] },
  { keywords: ["medo", "temer", "temor", "assombro"], chapters: ["isaiah+41", "psalms+23", "psalms+27", "2timothy+1", "joshua+1", "psalms+56"] },
  { keywords: ["sofrimento", "sofrer", "dor", "tribulacao", "aflicao", "angustia"], chapters: ["romans+8", "2corinthians+4", "james+1", "1peter+4", "psalms+34", "isaiah+43"] },
  { keywords: ["santidade", "santificacao", "santo", "pureza", "puro", "limpo"], chapters: ["1peter+1", "1thessalonians+4", "hebrews+12", "psalms+51", "leviticus+19", "2corinthians+7"] },
  { keywords: ["promessa", "promessas", "alianca", "pacto", "juramento"], chapters: ["2peter+1", "hebrews+6", "genesis+12", "genesis+15", "2corinthians+1", "deuteronomy+7"] },
];

// All the major Bible chapters to search as fallback — covers OT and NT broadly
const BROAD_SEARCH_CHAPTERS = [
  // Torah / Pentateuco
  "genesis+1", "genesis+3", "genesis+12", "genesis+22", "exodus+14", "exodus+20",
  "deuteronomy+6", "deuteronomy+28", "deuteronomy+31",
  // Historical
  "joshua+1", "1samuel+17", "2samuel+22", "1kings+18", "2chronicles+20",
  "nehemiah+8", "esther+4",
  // Poetry/Wisdom
  "job+38", "job+42", "psalms+1", "psalms+8", "psalms+16", "psalms+19", "psalms+23",
  "psalms+27", "psalms+34", "psalms+37", "psalms+40", "psalms+42", "psalms+46",
  "psalms+51", "psalms+56", "psalms+91", "psalms+100", "psalms+103", "psalms+119",
  "psalms+121", "psalms+126", "psalms+127", "psalms+139", "psalms+150",
  "proverbs+1", "proverbs+2", "proverbs+3", "proverbs+4", "proverbs+10",
  "proverbs+22", "proverbs+31", "ecclesiastes+3", "ecclesiastes+12",
  // Prophets
  "isaiah+1", "isaiah+6", "isaiah+9", "isaiah+40", "isaiah+41", "isaiah+43",
  "isaiah+53", "isaiah+55", "isaiah+60", "isaiah+61",
  "jeremiah+1", "jeremiah+29", "jeremiah+31", "lamentations+3",
  "ezekiel+34", "ezekiel+37", "daniel+3", "daniel+6", "daniel+7",
  "hosea+6", "joel+2", "amos+5", "micah+6", "habakkuk+3", "malachi+3",
  // Gospels
  "matthew+1", "matthew+3", "matthew+4", "matthew+5", "matthew+6", "matthew+7",
  "matthew+8", "matthew+11", "matthew+18", "matthew+24", "matthew+28",
  "mark+1", "mark+4", "mark+5", "mark+9", "mark+10", "mark+11",
  "luke+1", "luke+2", "luke+4", "luke+6", "luke+10", "luke+11",
  "luke+15", "luke+18", "luke+24",
  "john+1", "john+3", "john+4", "john+6", "john+8", "john+10",
  "john+11", "john+13", "john+14", "john+15", "john+16", "john+17", "john+19", "john+20",
  // Acts
  "acts+1", "acts+2", "acts+4", "acts+8", "acts+9", "acts+16",
  // Epistles
  "romans+1", "romans+3", "romans+5", "romans+6", "romans+8", "romans+10",
  "romans+12", "romans+13", "romans+15",
  "1corinthians+7", "1corinthians+12", "1corinthians+13", "1corinthians+15",
  "2corinthians+1", "2corinthians+4", "2corinthians+5", "2corinthians+9", "2corinthians+12",
  "galatians+5", "galatians+6", "ephesians+2", "ephesians+3", "ephesians+4",
  "ephesians+5", "ephesians+6", "philippians+2", "philippians+3", "philippians+4",
  "colossians+1", "colossians+3",
  "1thessalonians+4", "1thessalonians+5", "2thessalonians+3",
  "1timothy+6", "2timothy+1", "2timothy+3", "titus+2", "titus+3",
  "hebrews+1", "hebrews+4", "hebrews+6", "hebrews+9", "hebrews+10",
  "hebrews+11", "hebrews+12", "hebrews+13",
  "james+1", "james+2", "james+4", "james+5",
  "1peter+1", "1peter+2", "1peter+5", "2peter+1", "2peter+3",
  "1john+1", "1john+3", "1john+4",
  "jude+1",
  // Revelation
  "revelation+1", "revelation+3", "revelation+5", "revelation+21", "revelation+22",
];

async function cachedFetch<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data as T;
}

const ALL_SEARCH_CHAPTERS = bibleBooks.flatMap((book) => {
  const englishName = bookNameMap[book.apiAbbrev];
  if (!englishName) return [];

  return Array.from({ length: book.chapters }, (_, index) => `${englishName}+${index + 1}`);
});

function getSearchChapters(query: string): string[] {
  const normalizedQuery = normalizeText(query);

  const topicalMatches = SEARCH_CHAPTERS_BY_TOPIC
    .filter((entry) => entry.keywords.some((keyword) => normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)))
    .flatMap((entry) => entry.chapters);

  const priority = Array.from(new Set([...topicalMatches, ...BROAD_SEARCH_CHAPTERS]));
  const prioritySet = new Set(priority);
  const remaining = ALL_SEARCH_CHAPTERS.filter((chapterKey) => !prioritySet.has(chapterKey));

  return [...priority, ...remaining];
}

function scoreVerseMatch(verseText: string, normalizedQuery: string): number {
  const normalizedText = normalizeText(verseText);
  const words = normalizedQuery.split(/\s+/).filter((word) => word.length >= 2);

  if (!words.length) return 0;

  let score = 0;

  if (normalizedText.includes(normalizedQuery)) {
    score += 120;
  }

  const exactWordRegex = new RegExp(`(^|\\s)${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
  if (exactWordRegex.test(normalizedText)) {
    score += 80;
  }

  const matchedWords = words.filter((word) => normalizedText.includes(word));
  score += matchedWords.length * 25;

  if (matchedWords.length === words.length) {
    score += 40;
  }

  return score;
}

export async function getChapter(abbrev: string, chapter: number): Promise<ChapterResponse> {
  const englishName = bookNameMap[abbrev.toLowerCase()];
  if (!englishName) throw new Error(`Livro não encontrado: ${abbrev}`);

  const url = `${BASE_URL}/${encodeURIComponent(englishName)}+${chapter}?translation=${TRANSLATION}`;
  const data = await cachedFetch<{
    reference: string;
    verses: { verse: number; text: string }[];
  }>(url);

  return {
    reference: data.reference,
    verses: (data.verses || []).map((v) => ({
      number: v.verse,
      text: v.text.trim(),
    })),
  };
}

export async function getRandomVerse(): Promise<{
  book: { name: string };
  chapter: number;
  number: number;
  text: string;
}> {
  const favorites = [
    "john+3:16", "psalms+23:1", "philippians+4:13", "proverbs+3:5-6",
    "jeremiah+29:11", "isaiah+40:31", "psalms+119:105", "isaiah+41:10",
    "john+8:32", "psalms+34:4", "romans+8:28", "joshua+1:9",
    "matthew+11:28", "psalms+46:1", "2timothy+1:7", "romans+12:2",
    "hebrews+11:1", "psalms+27:1", "proverbs+18:10", "1peter+5:7",
  ];
  const pick = favorites[Math.floor(Math.random() * favorites.length)];
  const url = `${BASE_URL}/${pick}?translation=${TRANSLATION}`;

  const data = await cachedFetch<{
    reference: string;
    verses: { book_name: string; chapter: number; verse: number; text: string }[];
  }>(url);

  const v = data.verses[0];
  return {
    book: { name: v.book_name },
    chapter: v.chapter,
    number: v.verse,
    text: v.text.trim(),
  };
}

export async function searchVerses(query: string): Promise<
  { book: { name: string }; chapter: number; number: number; text: string }[]
> {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 2) return [];

  const chapters = getSearchChapters(query);
  const batchSize = 10;
  const allResults: ({ book: { name: string }; chapter: number; number: number; text: string } & { score: number })[] = [];

  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    const fetches = batch.map(async (chapterKey) => {
      try {
        const url = `${BASE_URL}/${chapterKey}?translation=${TRANSLATION}`;
        const data = await cachedFetch<{
          verses: { book_name: string; chapter: number; verse: number; text: string }[];
        }>(url);

        return data.verses
          .map((verse) => {
            const score = scoreVerseMatch(verse.text, normalizedQuery);
            if (score <= 0) return null;

            return {
              book: { name: verse.book_name },
              chapter: verse.chapter,
              number: verse.verse,
              text: verse.text.trim(),
              score,
            };
          })
          .filter((verse): verse is { book: { name: string }; chapter: number; number: number; text: string; score: number } => !!verse);
      } catch {
        return [];
      }
    });

    const batchResults = (await Promise.all(fetches)).flat();
    allResults.push(...batchResults);

    if (allResults.length >= 30) {
      break;
    }
  }

  const uniqueResults = allResults.filter(
    (result, index, array) =>
      array.findIndex(
        (item) =>
          item.book.name === result.book.name &&
          item.chapter === result.chapter &&
          item.number === result.number
      ) === index
  );

  return uniqueResults
    .sort((a, b) => b.score - a.score || a.book.name.localeCompare(b.book.name) || a.chapter - b.chapter || a.number - b.number)
    .slice(0, 30)
    .map(({ score: _score, ...result }) => result);
}
