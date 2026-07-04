// História Viva da Bíblia — tipos compartilhados
// Prontos para consumo via JSON/API sem alteração de shape.

export type PeriodId =
  | "principio"
  | "patriarcas"
  | "exodo"
  | "juizes"
  | "reino-unido"
  | "reino-dividido"
  | "exilio"
  | "intertestamentario"
  | "vida-jesus"
  | "igreja-primitiva";

export interface Period {
  id: PeriodId;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  /** Ano aproximado de início (negativo = aC) */
  startYear: number;
  /** Ano aproximado de fim */
  endYear: number;
  bookIds?: string[];
}

export type CharacterTag =
  | "patriarca"
  | "profeta"
  | "rei"
  | "juiz"
  | "apostolo"
  | "mulher"
  | "sacerdote"
  | "lider"
  | "jesus"
  | "outro";

export interface HistoriaCharacter {
  id: string;
  name: string;
  meaning?: string;
  periodId: PeriodId;
  tags: CharacterTag[];
  /** Ano aproximado (nascimento/atuação) */
  year: number;
  icon: string;
  bio: string;
  family?: { fathers?: string[]; mothers?: string[]; spouses?: string[]; children?: string[]; siblings?: string[] };
  curiosities?: string[];
  lessons?: string[];
  contemporaryKings?: string[];
  contemporaryProphets?: string[];
  placeIds?: string[];
  eventIds?: string[];
  bookIds?: string[];
  /** Referências bíblicas principais, ex: "Gênesis 12" */
  keyVerses?: { ref: string; note?: string }[];
}

export type EventTag =
  | "criacao"
  | "aliança"
  | "milagre"
  | "batalha"
  | "profecia"
  | "cumprimento"
  | "parabola"
  | "viagem"
  | "templo"
  | "juizo"
  | "messianico";

export interface HistoriaEvent {
  id: string;
  name: string;
  periodId: PeriodId;
  /** Ano aproximado */
  year: number;
  approximate?: boolean;
  description: string;
  context?: string;
  application?: string;
  tags: EventTag[];
  characterIds?: string[];
  placeIds?: string[];
  references: string[]; // Bible refs
  curiosities?: string[];
  icon: string;
}

export interface HistoriaPlace {
  id: string;
  name: string;
  description: string;
  region?: string;
  /** Coordenadas aproximadas para futuros mapas */
  lat?: number;
  lng?: number;
  eventIds?: string[];
  characterIds?: string[];
}

export interface HistoriaBook {
  id: string; // ex: "genesis"
  name: string; // "Gênesis"
  abbrev: string; // "gn" (compatível com bibleNav)
  author?: string;
  theme?: string;
  periodId: PeriodId;
  intro?: string;
  order: number;
  keyEvents?: string[];
  keyProphecies?: { ref: string; note: string }[];
  keyMiracles?: string[];
  characters?: string[];
  chapters?: number;
}

export type EntityKind = "character" | "event" | "place" | "book" | "period";
export interface EntityRef { kind: EntityKind; id: string }

// ---------------- Quiz ----------------
export type QuizDifficulty = "facil" | "medio" | "dificil";

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[]; // length 4
  correct: number; // 0..3
  explanation: string;
  ref?: string;
  entityRef?: EntityRef;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: QuizDifficulty;
  periodId?: PeriodId;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id?: string;
  quiz_id: string;
  score: number;
  total: number;
  duration_ms: number;
  answers?: number[];
  created_at?: string;
}

// ---------------- Plans ----------------
export interface PlanDay {
  index: number; // 1-based
  title: string;
  summary: string;
  readings: string[]; // bible refs
  entities?: EntityRef[];
}

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  icon: string;
  periodId?: PeriodId;
  days: PlanDay[];
}
