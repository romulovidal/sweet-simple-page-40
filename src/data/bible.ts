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

export function getDailyVerse(): { text: string; ref: string } {
  const verses = [
    { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", ref: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
    { text: "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", ref: "Provérbios 3:5" },
    { text: "Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais.", ref: "Jeremias 29:11" },
    { text: "Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias.", ref: "Isaías 40:31" },
    { text: "Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.", ref: "Salmos 119:105" },
    { text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.", ref: "Isaías 41:10" },
    { text: "E conhecereis a verdade, e a verdade vos libertará.", ref: "João 8:32" },
    { text: "Busquei o Senhor, e ele me respondeu; livrou-me de todos os meus temores.", ref: "Salmos 34:4" },
    { text: "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.", ref: "Romanos 8:28" },
    { text: "Esforçai-vos e animai-vos; não temais, nem vos espanteis, porque o Senhor, vosso Deus, é convosco.", ref: "Josué 1:9" },
    { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", ref: "Mateus 11:28" },
    { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
    { text: "E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento.", ref: "Romanos 12:2" },
    { text: "Ora, a fé é o firme fundamento das coisas que se esperam e a prova das coisas que se não veem.", ref: "Hebreus 11:1" },
    { text: "O Senhor é a minha luz e a minha salvação; a quem temerei?", ref: "Salmos 27:1" },
    { text: "O nome do Senhor é uma torre forte; o justo corre para ela e está em segurança.", ref: "Provérbios 18:10" },
    { text: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", ref: "1 Pedro 5:7" },
    { text: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus.", ref: "Efésios 2:8" },
    { text: "Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança.", ref: "Gálatas 5:22" },
    { text: "Tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens.", ref: "Colossenses 3:23" },
    { text: "Se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente.", ref: "Tiago 1:5" },
    { text: "Assim que, se alguém está em Cristo, nova criatura é: as coisas velhas já passaram; eis que tudo se fez novo.", ref: "2 Coríntios 5:17" },
    { text: "Deleita-te também no Senhor, e ele te concederá os desejos do teu coração.", ref: "Salmos 37:4" },
    { text: "Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará.", ref: "Salmos 91:1" },
    { text: "Mas buscai primeiro o Reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas.", ref: "Mateus 6:33" },
    { text: "Disse-lhe Jesus: Eu sou o caminho, e a verdade, e a vida. Ninguém vem ao Pai senão por mim.", ref: "João 14:6" },
    { text: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", ref: "1 Coríntios 13:4" },
    { text: "Levantarei os meus olhos para os montes; de onde me vem o socorro? O meu socorro vem do Senhor, que fez o céu e a terra.", ref: "Salmos 121:1-2" },
  ];
  const today = new Date();
  const year = today.getFullYear();
  const dayOfYear = Math.floor((today.getTime() - new Date(year, 0, 0).getTime()) / 86400000);

  // A simple pseudo-random generator based on the year to shuffle the verses differently every year
  // but keep it stable for the same day of the same year.
  // This prevents the same sequence of verses from repeating on the same day next month or next year.
  const shuffle = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // We use the day of the year and year as seed to pick a unique verse for each day of the century.
  // Formula: (dayOfYear + some_constant_from_year) % total_verses
  // We want to avoid day % length because if length is ~30, it repeats every month.
  // If length is 20 (current), it repeats every 20 days.
  
  // Use a more robust distribution:
  // Using prime numbers for offsets helps avoid overlapping cycles.
  const seed = (year * 366) + dayOfYear;
  const index = Math.floor(shuffle(seed) * verses.length);
  
  return verses[index];
}
