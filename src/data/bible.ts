export interface BibleBook {
  name: string;
  abbrev: string;
  chapters: number;
  testament: "VT" | "NT";
}

export const bibleBooks: BibleBook[] = [
  // Velho Testamento
  { name: "Gênesis", abbrev: "Gn", chapters: 50, testament: "VT" },
  { name: "Êxodo", abbrev: "Êx", chapters: 40, testament: "VT" },
  { name: "Levítico", abbrev: "Lv", chapters: 27, testament: "VT" },
  { name: "Números", abbrev: "Nm", chapters: 36, testament: "VT" },
  { name: "Deuteronômio", abbrev: "Dt", chapters: 34, testament: "VT" },
  { name: "Josué", abbrev: "Js", chapters: 24, testament: "VT" },
  { name: "Juízes", abbrev: "Jz", chapters: 21, testament: "VT" },
  { name: "Rute", abbrev: "Rt", chapters: 4, testament: "VT" },
  { name: "1 Samuel", abbrev: "1Sm", chapters: 31, testament: "VT" },
  { name: "2 Samuel", abbrev: "2Sm", chapters: 24, testament: "VT" },
  { name: "1 Reis", abbrev: "1Rs", chapters: 22, testament: "VT" },
  { name: "2 Reis", abbrev: "2Rs", chapters: 25, testament: "VT" },
  { name: "1 Crônicas", abbrev: "1Cr", chapters: 29, testament: "VT" },
  { name: "2 Crônicas", abbrev: "2Cr", chapters: 36, testament: "VT" },
  { name: "Esdras", abbrev: "Ed", chapters: 10, testament: "VT" },
  { name: "Neemias", abbrev: "Ne", chapters: 13, testament: "VT" },
  { name: "Ester", abbrev: "Et", chapters: 10, testament: "VT" },
  { name: "Jó", abbrev: "Jó", chapters: 42, testament: "VT" },
  { name: "Salmos", abbrev: "Sl", chapters: 150, testament: "VT" },
  { name: "Provérbios", abbrev: "Pv", chapters: 31, testament: "VT" },
  { name: "Eclesiastes", abbrev: "Ec", chapters: 12, testament: "VT" },
  { name: "Cantares", abbrev: "Ct", chapters: 8, testament: "VT" },
  { name: "Isaías", abbrev: "Is", chapters: 66, testament: "VT" },
  { name: "Jeremias", abbrev: "Jr", chapters: 52, testament: "VT" },
  { name: "Lamentações", abbrev: "Lm", chapters: 5, testament: "VT" },
  { name: "Ezequiel", abbrev: "Ez", chapters: 48, testament: "VT" },
  { name: "Daniel", abbrev: "Dn", chapters: 12, testament: "VT" },
  { name: "Oséias", abbrev: "Os", chapters: 14, testament: "VT" },
  { name: "Joel", abbrev: "Jl", chapters: 3, testament: "VT" },
  { name: "Amós", abbrev: "Am", chapters: 9, testament: "VT" },
  { name: "Obadias", abbrev: "Ob", chapters: 1, testament: "VT" },
  { name: "Jonas", abbrev: "Jn", chapters: 4, testament: "VT" },
  { name: "Miquéias", abbrev: "Mq", chapters: 7, testament: "VT" },
  { name: "Naum", abbrev: "Na", chapters: 3, testament: "VT" },
  { name: "Habacuque", abbrev: "Hc", chapters: 3, testament: "VT" },
  { name: "Sofonias", abbrev: "Sf", chapters: 3, testament: "VT" },
  { name: "Ageu", abbrev: "Ag", chapters: 2, testament: "VT" },
  { name: "Zacarias", abbrev: "Zc", chapters: 14, testament: "VT" },
  { name: "Malaquias", abbrev: "Ml", chapters: 4, testament: "VT" },
  // Novo Testamento
  { name: "Mateus", abbrev: "Mt", chapters: 28, testament: "NT" },
  { name: "Marcos", abbrev: "Mc", chapters: 16, testament: "NT" },
  { name: "Lucas", abbrev: "Lc", chapters: 24, testament: "NT" },
  { name: "João", abbrev: "Jo", chapters: 21, testament: "NT" },
  { name: "Atos", abbrev: "At", chapters: 28, testament: "NT" },
  { name: "Romanos", abbrev: "Rm", chapters: 16, testament: "NT" },
  { name: "1 Coríntios", abbrev: "1Co", chapters: 16, testament: "NT" },
  { name: "2 Coríntios", abbrev: "2Co", chapters: 13, testament: "NT" },
  { name: "Gálatas", abbrev: "Gl", chapters: 6, testament: "NT" },
  { name: "Efésios", abbrev: "Ef", chapters: 6, testament: "NT" },
  { name: "Filipenses", abbrev: "Fp", chapters: 4, testament: "NT" },
  { name: "Colossenses", abbrev: "Cl", chapters: 4, testament: "NT" },
  { name: "1 Tessalonicenses", abbrev: "1Ts", chapters: 5, testament: "NT" },
  { name: "2 Tessalonicenses", abbrev: "2Ts", chapters: 3, testament: "NT" },
  { name: "1 Timóteo", abbrev: "1Tm", chapters: 6, testament: "NT" },
  { name: "2 Timóteo", abbrev: "2Tm", chapters: 4, testament: "NT" },
  { name: "Tito", abbrev: "Tt", chapters: 3, testament: "NT" },
  { name: "Filemom", abbrev: "Fm", chapters: 1, testament: "NT" },
  { name: "Hebreus", abbrev: "Hb", chapters: 13, testament: "NT" },
  { name: "Tiago", abbrev: "Tg", chapters: 5, testament: "NT" },
  { name: "1 Pedro", abbrev: "1Pe", chapters: 5, testament: "NT" },
  { name: "2 Pedro", abbrev: "2Pe", chapters: 3, testament: "NT" },
  { name: "1 João", abbrev: "1Jo", chapters: 5, testament: "NT" },
  { name: "2 João", abbrev: "2Jo", chapters: 1, testament: "NT" },
  { name: "3 João", abbrev: "3Jo", chapters: 1, testament: "NT" },
  { name: "Judas", abbrev: "Jd", chapters: 1, testament: "NT" },
  { name: "Apocalipse", abbrev: "Ap", chapters: 22, testament: "NT" },
];

export const dailyVerses = [
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
];

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  days: number;
  category: string;
  image: string;
}

export const readingPlans: ReadingPlan[] = [
  { id: "1", title: "Bíblia em 1 Ano", description: "Leia toda a Bíblia em 365 dias", days: 365, category: "Completo", image: "📖" },
  { id: "2", title: "Salmos de Conforto", description: "30 dias nos Salmos que trazem paz", days: 30, category: "Devocionais", image: "🕊️" },
  { id: "3", title: "Vida de Jesus", description: "Conheça Jesus nos 4 Evangelhos", days: 40, category: "Temáticos", image: "✝️" },
  { id: "4", title: "Provérbios em 31 Dias", description: "Um capítulo por dia de sabedoria", days: 31, category: "Sabedoria", image: "💡" },
  { id: "5", title: "Cartas de Paulo", description: "Explore as epístolas paulinas", days: 60, category: "Estudo", image: "📜" },
  { id: "6", title: "Gênesis a Apocalipse", description: "Os grandes marcos da história bíblica", days: 90, category: "Panorama", image: "🌍" },
];

export function getDailyVerse(): { text: string; ref: string } {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return dailyVerses[dayOfYear % dailyVerses.length];
}
