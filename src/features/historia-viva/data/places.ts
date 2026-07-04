import type { HistoriaPlace } from "../types";

export const PLACES: HistoriaPlace[] = [
  { id: "eden", name: "Éden", description: "O jardim onde o homem foi colocado no princípio.", region: "Oriente" },
  { id: "ur", name: "Ur dos Caldeus", description: "Cidade de origem de Abraão, na Mesopotâmia.", region: "Mesopotâmia", lat: 30.96, lng: 46.10 },
  { id: "canaa", name: "Canaã", description: "A Terra Prometida a Abraão e seus descendentes.", region: "Levante" },
  { id: "hebrom", name: "Hebrom", description: "Local onde Abraão viveu e foi sepultado.", region: "Judá", lat: 31.53, lng: 35.09 },
  { id: "berseba", name: "Berseba", description: "Poço de Isaque; extremo sul de Israel.", region: "Neguebe", lat: 31.25, lng: 34.79 },
  { id: "betel", name: "Betel", description: "'Casa de Deus' — local da escada de Jacó.", region: "Efraim", lat: 31.93, lng: 35.22 },
  { id: "peniel", name: "Peniel", description: "Onde Jacó lutou com o Anjo do Senhor.", region: "Transjordânia" },
  { id: "egito", name: "Egito", description: "Terra da escravidão e do refúgio; palco da Páscoa.", region: "África do Norte", lat: 30.05, lng: 31.24 },
  { id: "sinai", name: "Monte Sinai", description: "Onde a Lei foi entregue a Moisés.", region: "Península do Sinai", lat: 28.54, lng: 33.97 },
  { id: "jerico", name: "Jericó", description: "Primeira cidade conquistada por Josué em Canaã.", region: "Vale do Jordão", lat: 31.87, lng: 35.44 },
  { id: "belem", name: "Belém", description: "Cidade de Davi e local do nascimento de Jesus.", region: "Judá", lat: 31.70, lng: 35.20 },
  { id: "jerusalem", name: "Jerusalém", description: "Capital de Israel; local do Templo e da cruz.", region: "Judá", lat: 31.78, lng: 35.22 },
  { id: "samaria", name: "Samaria", description: "Capital do reino do Norte.", region: "Israel", lat: 32.28, lng: 35.19 },
  { id: "babilonia", name: "Babilônia", description: "Império que destruiu o Templo e levou Judá cativa.", region: "Mesopotâmia", lat: 32.54, lng: 44.42 },
  { id: "nazare", name: "Nazaré", description: "Cidade onde Jesus cresceu.", region: "Galileia", lat: 32.70, lng: 35.30 },
  { id: "galileia", name: "Galileia", description: "Região do ministério público de Jesus.", region: "Norte de Israel", lat: 32.83, lng: 35.50 },
  { id: "jordao", name: "Rio Jordão", description: "Onde Jesus foi batizado por João.", region: "Vale do Jordão" },
  { id: "damasco", name: "Damasco", description: "Onde Saulo se converteu.", region: "Síria", lat: 33.51, lng: 36.29 },
  { id: "antioquia", name: "Antioquia", description: "Base das viagens missionárias de Paulo.", region: "Síria", lat: 36.20, lng: 36.16 },
  { id: "corinto", name: "Corinto", description: "Cidade grega onde Paulo fundou igreja.", region: "Grécia", lat: 37.94, lng: 22.93 },
  { id: "efeso", name: "Éfeso", description: "Grande centro do ministério de Paulo e João.", region: "Ásia Menor", lat: 37.94, lng: 27.34 },
  { id: "patmos", name: "Patmos", description: "Ilha onde João recebeu o Apocalipse.", region: "Mar Egeu", lat: 37.32, lng: 26.55 },
  { id: "roma", name: "Roma", description: "Capital do Império; destino final de Paulo.", region: "Itália", lat: 41.90, lng: 12.50 },
];

export const getPlace = (id: string) => PLACES.find((p) => p.id === id);
