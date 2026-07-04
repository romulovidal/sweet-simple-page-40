// Classificação temática dos hinos por palavras-chave no título e no corpo.
// Cada hino pode pertencer a vários temas (louvor + adoração, por ex.).

import type { HarpaHino } from "@/data/harpa";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export interface HarpaTheme {
  id: string;
  label: string;
  emoji: string;
  // termos que casam no título (peso maior) ou no corpo (peso menor)
  keywords: string[];
}

export const HARPA_THEMES: HarpaTheme[] = [
  {
    id: "louvor",
    label: "Louvor",
    emoji: "🎵",
    keywords: ["louvor", "louva", "cantai", "canto", "hosana", "aleluia", "gloria a deus"],
  },
  {
    id: "adoracao",
    label: "Adoração",
    emoji: "🙌",
    keywords: ["adora", "santo", "santo es tu", "majestade", "trono", "digno"],
  },
  {
    id: "jesus",
    label: "Cristo / Cruz",
    emoji: "✝️",
    keywords: ["jesus", "cristo", "cruz", "calvario", "sangue", "cordeiro", "salvador", "redent"],
  },
  {
    id: "salvacao",
    label: "Salvação",
    emoji: "💫",
    keywords: ["salva", "salvo", "salvac", "redenc", "redim", "perdao", "graca"],
  },
  {
    id: "consagracao",
    label: "Consagração",
    emoji: "🕊️",
    keywords: ["consagr", "entrego", "rendido", "servir", "vontade", "obedec"],
  },
  {
    id: "oracao",
    label: "Oração",
    emoji: "🙏",
    keywords: ["ora", "oracao", "prece", "suplica", "clamar", "clamor"],
  },
  {
    id: "espirito",
    label: "Espírito Santo",
    emoji: "🔥",
    keywords: ["espirito santo", "espirito", "consolador", "pentecost"],
  },
  {
    id: "ceu",
    label: "Céu / Pátria",
    emoji: "🏞️",
    keywords: ["ceu", "patria", "mansao", "eternidade", "sion", "canaa", "gloria eterna"],
  },
  {
    id: "vinda",
    label: "Segunda vinda",
    emoji: "⛅",
    keywords: ["vem senhor", "voltar", "volta de cristo", "arrebat", "vinda", "maranata"],
  },
  {
    id: "natal",
    label: "Natal",
    emoji: "⭐",
    keywords: ["natal", "belem", "nasce", "menino jesus", "manjedoura"],
  },
  {
    id: "ceia",
    label: "Santa Ceia",
    emoji: "🍞",
    keywords: ["ceia", "corpo do senhor", "pao e o vinho", "memorial"],
  },
  {
    id: "batismo",
    label: "Batismo",
    emoji: "💧",
    keywords: ["batismo", "batiza", "aguas do jordao"],
  },
  {
    id: "missoes",
    label: "Missões",
    emoji: "🌍",
    keywords: ["missao", "missoes", "missionario", "evangel", "ide por todo", "colheita", "seara"],
  },
  {
    id: "conforto",
    label: "Conforto / Fé",
    emoji: "💛",
    keywords: ["conforto", "consola", "fe ", " fe", "confia", "esperanca", "paz", "descanso"],
  },
];

export interface HymnIndex {
  hino: HarpaHino;
  titleN: string;
  bodyN: string;
}

export function buildIndex(hinos: HarpaHino[]): HymnIndex[] {
  return hinos.map((h) => ({
    hino: h,
    titleN: " " + normalize(h.title) + " ",
    bodyN: " " + normalize(h.strophes.flatMap((s) => s.lines).join(" ")) + " ",
  }));
}

/** Retorna hinos do tema, ordenados por relevância (título > corpo). */
export function hymnsByTheme(index: HymnIndex[], theme: HarpaTheme): HarpaHino[] {
  const scored: { h: HarpaHino; score: number }[] = [];
  for (const it of index) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (it.titleN.includes(kw)) score += 3;
      else if (it.bodyN.includes(kw)) score += 1;
    }
    if (score > 0) scored.push({ h: it.hino, score });
  }
  scored.sort((a, b) => b.score - a.score || a.h.number - b.h.number);
  return scored.map((s) => s.h);
}