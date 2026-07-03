// Coordenadas aproximadas (lat, lng) de locais bíblicos.
// Baseadas em identificações históricas tradicionais — algumas rotas são debatidas.

export type LatLng = [number, number];

export interface MapPoint {
  name: string;
  coords: LatLng;
  description?: string;
  reference?: string;
}

export interface MapJourney {
  id: string;
  name: string;
  icon: string;
  color: string; // HSL string like "38 92% 50%"
  period: string;
  summary: string;
  points: MapPoint[];
  /** Se true, desenha uma linha (polyline) entre os pontos na ordem. */
  drawRoute: boolean;
}

export const BIBLE_MAPS: MapJourney[] = [
  {
    id: "exodus",
    name: "Êxodo",
    icon: "🏜️",
    color: "38 92% 50%",
    period: "~1446 a.C.",
    summary: "A jornada de Israel do Egito até a Terra Prometida sob a liderança de Moisés.",
    drawRoute: true,
    points: [
      { name: "Ramessés", coords: [30.799, 31.833], description: "Ponto de partida no Egito.", reference: "Êxodo 12:37" },
      { name: "Sucote", coords: [30.55, 32.25], reference: "Êxodo 12:37" },
      { name: "Mar Vermelho", coords: [29.5, 32.55], description: "Travessia milagrosa.", reference: "Êxodo 14" },
      { name: "Mara", coords: [28.9, 33.15] },
      { name: "Elim", coords: [28.75, 33.25], reference: "Êxodo 15:27" },
      { name: "Monte Sinai", coords: [28.539, 33.975], description: "Entrega dos Dez Mandamentos.", reference: "Êxodo 19—20" },
      { name: "Cades-Barnéia", coords: [30.683, 34.5], description: "Envio dos 12 espias.", reference: "Números 13" },
      { name: "Monte Hor", coords: [30.316, 35.406], reference: "Números 20:22" },
      { name: "Planícies de Moabe", coords: [31.833, 35.65], reference: "Números 22:1" },
      { name: "Jericó", coords: [31.87, 35.444], description: "Entrada em Canaã.", reference: "Josué 6" },
    ],
  },
  {
    id: "paul",
    name: "Viagens de Paulo",
    icon: "⛵",
    color: "217 91% 60%",
    period: "~46—62 d.C.",
    summary: "As três viagens missionárias do apóstolo e sua viagem final a Roma.",
    drawRoute: true,
    points: [
      { name: "Antioquia da Síria", coords: [36.2, 36.16], description: "Ponto de partida das missões.", reference: "Atos 13:1" },
      { name: "Chipre", coords: [35.126, 33.429], reference: "Atos 13:4" },
      { name: "Perge", coords: [36.96, 30.85], reference: "Atos 13:13" },
      { name: "Antioquia da Pisídia", coords: [38.31, 31.19], reference: "Atos 13:14" },
      { name: "Icônio", coords: [37.87, 32.49], reference: "Atos 14:1" },
      { name: "Listra", coords: [37.58, 32.45], reference: "Atos 14:6" },
      { name: "Filipos", coords: [41.013, 24.286], description: "Primeira igreja na Europa.", reference: "Atos 16:12" },
      { name: "Tessalônica", coords: [40.640, 22.944], reference: "Atos 17:1" },
      { name: "Atenas", coords: [37.983, 23.729], description: "Discurso no Areópago.", reference: "Atos 17:22" },
      { name: "Corinto", coords: [37.906, 22.879], reference: "Atos 18:1" },
      { name: "Éfeso", coords: [37.949, 27.363], reference: "Atos 19" },
      { name: "Jerusalém", coords: [31.778, 35.235], description: "Prisão de Paulo.", reference: "Atos 21" },
      { name: "Cesareia", coords: [32.5, 34.892], reference: "Atos 23:33" },
      { name: "Malta", coords: [35.898, 14.514], description: "Naufrágio.", reference: "Atos 28:1" },
      { name: "Roma", coords: [41.902, 12.496], description: "Prisão domiciliar.", reference: "Atos 28:16" },
    ],
  },
  {
    id: "tribes",
    name: "12 Tribos",
    icon: "🏛️",
    color: "142 71% 45%",
    period: "~1400 a.C.",
    summary: "Divisão da Terra Prometida entre as doze tribos de Israel após a conquista.",
    drawRoute: false,
    points: [
      { name: "Aser", coords: [33.0, 35.15], description: "Norte, faixa litorânea." },
      { name: "Naftali", coords: [33.05, 35.5], description: "Norte, Mar da Galileia." },
      { name: "Zebulom", coords: [32.75, 35.3] },
      { name: "Issacar", coords: [32.6, 35.45] },
      { name: "Manassés", coords: [32.4, 35.3], description: "Meia-tribo oeste." },
      { name: "Efraim", coords: [32.1, 35.2] },
      { name: "Dã", coords: [31.95, 34.85] },
      { name: "Benjamim", coords: [31.85, 35.2] },
      { name: "Judá", coords: [31.5, 35.0], description: "Sul, inclui Jerusalém." },
      { name: "Simeão", coords: [31.25, 34.8], description: "Enclave dentro de Judá." },
      { name: "Rúben", coords: [31.7, 35.75], description: "Leste do Jordão." },
      { name: "Gade", coords: [32.1, 35.75], description: "Leste do Jordão." },
    ],
  },
  {
    id: "jesus",
    name: "Vida de Jesus",
    icon: "✝️",
    color: "0 84% 60%",
    period: "~4 a.C. — 33 d.C.",
    summary: "Os principais lugares do ministério terreno de Jesus Cristo.",
    drawRoute: true,
    points: [
      { name: "Belém", coords: [31.705, 35.202], description: "Nascimento.", reference: "Lucas 2" },
      { name: "Nazaré", coords: [32.702, 35.298], description: "Infância e juventude.", reference: "Lucas 2:39" },
      { name: "Rio Jordão", coords: [31.837, 35.549], description: "Batismo por João.", reference: "Mateus 3" },
      { name: "Cafarnaum", coords: [32.881, 35.573], description: "Base do ministério na Galileia.", reference: "Mateus 4:13" },
      { name: "Mar da Galileia", coords: [32.833, 35.583], description: "Milagres e ensinos.", reference: "Marcos 4" },
      { name: "Cesareia de Filipe", coords: [33.248, 35.694], description: "Confissão de Pedro.", reference: "Mateus 16:13" },
      { name: "Jericó", coords: [31.87, 35.444], reference: "Lucas 19:1" },
      { name: "Betânia", coords: [31.771, 35.263], description: "Ressurreição de Lázaro.", reference: "João 11" },
      { name: "Jerusalém", coords: [31.778, 35.235], description: "Paixão, morte e ressurreição.", reference: "Mateus 21—28" },
    ],
  },
];