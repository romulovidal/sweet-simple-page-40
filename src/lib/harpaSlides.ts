import type { HarpaHino } from "@/data/harpa";

export type HarpaSlide = {
  kind: "title" | "chorus" | "verse";
  /** número da estrofe (quando for estrofe) */
  index?: number;
  /** índice da seção original em hino.strophes (-1 para o slide de título) */
  stropheIdx: number;
  lines: string[];
};

/**
 * Sequência de telas usada tanto no modo apresentação quanto na marcação
 * de tempos do culto: título + estrofes (com o coro repetido entre elas).
 * A ordem é determinística — os índices são a base das marcações (cues).
 */
export function buildHarpaSlides(hino: HarpaHino): HarpaSlide[] {
  const arr: HarpaSlide[] = [{ kind: "title", lines: [hino.title], stropheIdx: -1 }];
  const chorusIdxs = hino.strophes
    .map((s, i) => (s.chorus ? i : -1))
    .filter((i) => i >= 0);

  if (chorusIdxs.length > 1) {
    hino.strophes.forEach((s, i) => {
      if (s.chorus) arr.push({ kind: "chorus", lines: s.lines, stropheIdx: i });
      else arr.push({ kind: "verse", index: s.index, lines: s.lines, stropheIdx: i });
    });
  } else {
    const ci = chorusIdxs[0];
    const chorus = ci !== undefined ? hino.strophes[ci] : undefined;
    hino.strophes.forEach((s, i) => {
      if (s.chorus) return;
      arr.push({ kind: "verse", index: s.index, lines: s.lines, stropheIdx: i });
      if (chorus) arr.push({ kind: "chorus", lines: chorus.lines, stropheIdx: ci! });
    });
    if (arr.length === 1 && chorus) {
      arr.push({ kind: "chorus", lines: chorus.lines, stropheIdx: ci! });
    }
  }
  return arr;
}

/** Rótulo curto de um slide (ex.: "Título", "Estrofe 2", "Coro"). */
export function slideLabel(s: HarpaSlide, i: number): string {
  if (s.kind === "title") return "Título";
  if (s.kind === "chorus") return "Coro";
  return `Estrofe ${s.index ?? i}`;
}

/** Índice do slide ativo para um dado tempo (segundos). -1 se nenhum. */
export function slideIndexAt(cues: (number | null | undefined)[], time: number): number {
  let active = -1;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (typeof c === "number" && c >= 0 && time + 0.15 >= c) active = i;
  }
  return active;
}

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTime(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const mm = Number(m);
    const ss = Number(s);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    return mm * 60 + ss;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
