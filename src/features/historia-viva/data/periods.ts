import type { Period } from "../types";

export const PERIODS: Period[] = [
  {
    id: "principio",
    name: "O Princípio",
    subtitle: "Criação · Queda · Dilúvio",
    description: "A origem de todas as coisas: Deus cria o cosmos, o homem cai, e o dilúvio traz um novo começo com Noé.",
    icon: "🌌",
    startYear: -4000,
    endYear: -2200,
    bookIds: ["genesis"],
  },
  {
    id: "patriarcas",
    name: "Patriarcas",
    subtitle: "Abraão · Isaque · Jacó · José",
    description: "Deus faz aliança com Abraão e forma o povo de Israel através da linhagem dos patriarcas.",
    icon: "🌟",
    startYear: -2166,
    endYear: -1805,
    bookIds: ["genesis"],
  },
  {
    id: "exodo",
    name: "Êxodo",
    subtitle: "Moisés · Lei · Deserto",
    description: "Deus liberta Israel do Egito pela mão de Moisés, entrega a Lei no Sinai e conduz o povo pelo deserto até Canaã.",
    icon: "🔥",
    startYear: -1526,
    endYear: -1406,
    bookIds: ["exodo", "levitico", "numeros", "deuteronomio", "josue"],
  },
  {
    id: "juizes",
    name: "Juízes",
    subtitle: "Ciclos de queda e libertação",
    description: "Sem rei, Israel oscila entre apostasia e arrependimento. Deus levanta juízes libertadores.",
    icon: "⚖️",
    startYear: -1375,
    endYear: -1050,
    bookIds: ["juizes", "rute", "1samuel"],
  },
  {
    id: "reino-unido",
    name: "Reino Unido",
    subtitle: "Saul · Davi · Salomão",
    description: "Israel se torna monarquia. Davi conquista Jerusalém; Salomão constrói o Templo.",
    icon: "👑",
    startYear: -1050,
    endYear: -930,
    bookIds: ["1samuel", "2samuel", "1reis", "salmos", "proverbios", "eclesiastes", "cantares"],
  },
  {
    id: "reino-dividido",
    name: "Reino Dividido",
    subtitle: "Israel · Judá · Profetas",
    description: "Após Salomão, o reino se divide. Profetas clamam por arrependimento até a queda de Samaria e Jerusalém.",
    icon: "⚔️",
    startYear: -930,
    endYear: -586,
    bookIds: ["1reis", "2reis", "isaias", "jeremias", "oseias", "amos", "miqueias"],
  },
  {
    id: "exilio",
    name: "Exílio",
    subtitle: "Babilônia · Retorno",
    description: "Judá é levada cativa a Babilônia. Deus preserva um remanescente e traz de volta com Esdras e Neemias.",
    icon: "🏛️",
    startYear: -586,
    endYear: -400,
    bookIds: ["ezequiel", "daniel", "esdras", "neemias", "ester", "ageu", "zacarias", "malaquias"],
  },
  {
    id: "intertestamentario",
    name: "Intertestamentário",
    subtitle: "400 anos de silêncio",
    description: "Entre o AT e o NT: domínio persa, grego e romano. O palco é preparado para o Messias.",
    icon: "🕯️",
    startYear: -400,
    endYear: -4,
  },
  {
    id: "vida-jesus",
    name: "Vida de Jesus",
    subtitle: "Encarnação · Cruz · Ressurreição",
    description: "O Verbo se fez carne. Jesus prega o Reino, morre pelos pecadores e ressuscita ao terceiro dia.",
    icon: "✝️",
    startYear: -4,
    endYear: 33,
    bookIds: ["mateus", "marcos", "lucas", "joao"],
  },
  {
    id: "igreja-primitiva",
    name: "Igreja Primitiva",
    subtitle: "Pentecostes · Missões · Revelação",
    description: "O Espírito é derramado. O Evangelho avança até os confins da terra. João recebe o Apocalipse.",
    icon: "🕊️",
    startYear: 30,
    endYear: 100,
    bookIds: ["atos", "romanos", "1corintios", "2corintios", "galatas", "efesios", "filipenses", "colossenses", "1tessalonicenses", "2tessalonicenses", "1timoteo", "2timoteo", "tito", "filemom", "hebreus", "tiago", "1pedro", "2pedro", "1joao", "2joao", "3joao", "judas", "apocalipse"],
  },
];

export const getPeriod = (id: string) => PERIODS.find((p) => p.id === id);

/** Formata ano: negativo → "aC", positivo → "dC" */
export const formatYear = (y: number) => {
  if (y < 0) return `${Math.abs(y)} aC`;
  if (y === 0) return "1 aC/dC";
  return `${y} dC`;
};
