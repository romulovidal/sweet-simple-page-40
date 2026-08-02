// Ponte entre Cânticos e a infraestrutura da Harpa (player, cues, apresentação).
// Cânticos recebem um "número virtual" com offset para conviverem com os hinos
// dentro de uma mesma seleção de culto sem colidir com a numeração da Harpa.
import type { HarpaHino } from "@/data/harpa";

export const CANTICO_OFFSET = 100000;

export const isCanticoRef = (n: number) => n >= CANTICO_OFFSET;
export const canticoRef = (numero: number) => CANTICO_OFFSET + numero;
export const displayNumber = (n: number) => (isCanticoRef(n) ? n - CANTICO_OFFSET : n);

export type LetraBloco = { tipo: "verso" | "refrao" | "ponte"; numero?: number; linhas: string[] };
export type CanticoPlayback = { label: string; url: string; cues?: (number | null)[] | null };

export type CanticoLite = {
  id: string;
  numero: number;
  titulo: string;
  letra_json: LetraBloco[];
  playbacks?: CanticoPlayback[] | null;
};

/** Converte um cântico no formato de hino usado pelo leitor/apresentador. */
export function canticoToHino(c: CanticoLite): HarpaHino {
  const strophes = (c.letra_json || []).map((b, i) => ({
    chorus: b.tipo === "refrao",
    index: b.tipo === "verso" ? b.numero ?? i + 1 : undefined,
    lines: b.linhas || [],
  }));
  return {
    number: canticoRef(c.numero),
    displayNumber: c.numero,
    kind: "cantico",
    title: c.titulo,
    strophes,
  };
}
