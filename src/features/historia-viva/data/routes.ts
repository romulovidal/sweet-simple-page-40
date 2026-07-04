import type { PeriodId } from "../types";

export interface Route {
  id: string;
  name: string;
  description: string;
  periodId: PeriodId;
  color: string; // hsl triplet
  icon: string;
  /** IDs de lugares em ordem (usa PLACES.lat/lng). Pontos avulsos com {lat,lng,label} também aceitos. */
  stops: Array<{ placeId?: string; label?: string; lat?: number; lng?: number }>;
  references: string[];
}

export const ROUTES: Route[] = [
  {
    id: "abraao-canaa",
    name: "A jornada de Abraão",
    description: "De Ur dos Caldeus a Canaã, pela promessa de Deus.",
    periodId: "patriarcas",
    color: "38 92% 55%",
    icon: "🌟",
    stops: [
      { placeId: "ur" },
      { label: "Harã", lat: 36.86, lng: 39.03 },
      { placeId: "canaa", lat: 32.0, lng: 35.0 },
      { placeId: "hebrom" },
    ],
    references: ["Gênesis 12", "Gênesis 13"],
  },
  {
    id: "exodo",
    name: "O Êxodo",
    description: "Do Egito ao Sinai até Canaã.",
    periodId: "exodo",
    color: "18 88% 55%",
    icon: "🔥",
    stops: [
      { placeId: "egito" },
      { label: "Mar Vermelho", lat: 29.5, lng: 32.9 },
      { placeId: "sinai" },
      { label: "Cades-Barneia", lat: 30.66, lng: 34.5 },
      { placeId: "jerico" },
    ],
    references: ["Êxodo 12", "Êxodo 14", "Êxodo 19", "Números 33"],
  },
  {
    id: "exilio-babilonia",
    name: "Exílio para Babilônia",
    description: "Judá é levada cativa por Nabucodonosor.",
    periodId: "reino-dividido",
    color: "217 45% 55%",
    icon: "🏛️",
    stops: [
      { placeId: "jerusalem" },
      { label: "Rebla", lat: 34.44, lng: 36.53 },
      { placeId: "babilonia" },
    ],
    references: ["2 Reis 25", "Jeremias 52"],
  },
  {
    id: "retorno-exilio",
    name: "Retorno do exílio",
    description: "Os judeus voltam com Zorobabel, Esdras e Neemias.",
    periodId: "exilio",
    color: "142 60% 45%",
    icon: "🚪",
    stops: [
      { placeId: "babilonia" },
      { placeId: "jerusalem" },
    ],
    references: ["Esdras 1", "Neemias 2"],
  },
  {
    id: "vida-jesus",
    name: "Ministério de Jesus",
    description: "Belém, Nazaré, Galileia e Jerusalém.",
    periodId: "vida-jesus",
    color: "352 78% 55%",
    icon: "✝️",
    stops: [
      { placeId: "belem" },
      { placeId: "nazare" },
      { placeId: "galileia" },
      { placeId: "jordao", lat: 31.85, lng: 35.55 },
      { placeId: "jerusalem" },
    ],
    references: ["Lucas 2", "Mateus 3", "Mateus 4", "Lucas 19"],
  },
  {
    id: "paulo-1",
    name: "1ª viagem missionária de Paulo",
    description: "Antioquia → Chipre → Ásia Menor → volta.",
    periodId: "igreja-primitiva",
    color: "199 89% 55%",
    icon: "⛵",
    stops: [
      { placeId: "antioquia" },
      { label: "Salamina (Chipre)", lat: 35.18, lng: 33.9 },
      { label: "Pafos", lat: 34.77, lng: 32.42 },
      { label: "Perge", lat: 36.96, lng: 30.85 },
      { label: "Antioquia da Pisídia", lat: 38.31, lng: 31.19 },
      { label: "Icônio", lat: 37.87, lng: 32.49 },
      { label: "Listra", lat: 37.58, lng: 32.29 },
      { label: "Derbe", lat: 37.35, lng: 33.32 },
      { placeId: "antioquia" },
    ],
    references: ["Atos 13", "Atos 14"],
  },
  {
    id: "paulo-2",
    name: "2ª viagem missionária de Paulo",
    description: "Alcance do Evangelho à Europa.",
    periodId: "igreja-primitiva",
    color: "271 76% 62%",
    icon: "🚢",
    stops: [
      { placeId: "antioquia" },
      { label: "Trôade", lat: 39.75, lng: 26.16 },
      { label: "Filipos", lat: 41.01, lng: 24.29 },
      { label: "Tessalônica", lat: 40.64, lng: 22.94 },
      { label: "Atenas", lat: 37.98, lng: 23.72 },
      { placeId: "corinto" },
      { placeId: "efeso" },
      { placeId: "antioquia" },
    ],
    references: ["Atos 15", "Atos 16", "Atos 17", "Atos 18"],
  },
  {
    id: "paulo-3",
    name: "3ª viagem missionária de Paulo",
    description: "Ministério intenso em Éfeso.",
    periodId: "igreja-primitiva",
    color: "45 95% 55%",
    icon: "✉️",
    stops: [
      { placeId: "antioquia" },
      { placeId: "efeso" },
      { placeId: "corinto" },
      { placeId: "jerusalem" },
    ],
    references: ["Atos 18", "Atos 19", "Atos 20"],
  },
  {
    id: "paulo-roma",
    name: "Viagem de Paulo a Roma",
    description: "Prisioneiro, mas testemunhando até no naufrágio.",
    periodId: "igreja-primitiva",
    color: "0 78% 55%",
    icon: "⚓",
    stops: [
      { placeId: "jerusalem" },
      { label: "Cesareia", lat: 32.5, lng: 34.9 },
      { label: "Creta", lat: 35.24, lng: 24.81 },
      { label: "Malta", lat: 35.9, lng: 14.51 },
      { placeId: "roma" },
    ],
    references: ["Atos 27", "Atos 28"],
  },
  {
    id: "sete-igrejas",
    name: "As sete igrejas do Apocalipse",
    description: "As cartas de Jesus à Sua igreja.",
    periodId: "igreja-primitiva",
    color: "142 71% 45%",
    icon: "📜",
    stops: [
      { label: "Éfeso", lat: 37.94, lng: 27.34 },
      { label: "Esmirna", lat: 38.42, lng: 27.14 },
      { label: "Pérgamo", lat: 39.13, lng: 27.18 },
      { label: "Tiatira", lat: 38.92, lng: 27.85 },
      { label: "Sardes", lat: 38.49, lng: 28.04 },
      { label: "Filadélfia", lat: 38.35, lng: 28.52 },
      { label: "Laodiceia", lat: 37.84, lng: 29.11 },
    ],
    references: ["Apocalipse 2", "Apocalipse 3"],
  },
];

export const routesByPeriod = (periodId: string) => ROUTES.filter((r) => r.periodId === periodId);
export const getRoute = (id: string) => ROUTES.find((r) => r.id === id);
