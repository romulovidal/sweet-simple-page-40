// Schema interno + loader para o hinário Harpa Cristã Atalaia.
// O JSON é code-split via dynamic import — só carrega quando /harpa abre.

export interface HarpaStrophe {
  /** true quando é o refrão/coro do hino */
  chorus?: boolean;
  /** número da estrofe quando não é refrão */
  index?: number;
  /** linhas da estrofe */
  lines: string[];
}

export interface HarpaHino {
  number: number;
  title: string;
  strophes: HarpaStrophe[];
}

// Formato bruto vindo do JSON público.
export interface RawSecao {
  tipo: "estrofe" | "refrao";
  numero?: number;
  linhas: string[];
}
interface RawHino {
  numero: number;
  titulo: string;
  secoes: RawSecao[];
}
interface RawFile {
  nome: string;
  fonte: string;
  total: number;
  hinos: RawHino[];
}

// Remove traços/hifens soltos no início de linhas — artefatos da conversão
// do PDF original que aparecem em vários hinos (ex.: 467).
function cleanLine(line: string): string {
  return line.replace(/^\s*[-–—]+\s*/, "");
}

function normalize(raw: RawFile): HarpaHino[] {
  return raw.hinos.map((h) => ({
    number: h.numero,
    title: h.titulo,
    strophes: h.secoes.map((s) => ({
      chorus: s.tipo === "refrao",
      index: s.tipo === "estrofe" ? s.numero : undefined,
      lines: s.linhas.map(cleanLine).filter((l) => l.length > 0),
    })),
  }));
}

let cache: HarpaHino[] | null = null;
let inflight: Promise<HarpaHino[]> | null = null;

const HARPA_URL = "/harpa/harpa-crista.json";
const OVERRIDES_KEY = "harpa:overrides:v1";

type OverrideRow = { number: number; title: string; secoes: RawSecao[] };

function normalizeHino(number: number, title: string, secoes: RawSecao[]): HarpaHino {
  return {
    number,
    title,
    strophes: secoes.map((s) => ({
      chorus: s.tipo === "refrao",
      index: s.tipo === "estrofe" ? s.numero : undefined,
      lines: (s.linhas || []).map(cleanLine).filter((l) => l.length > 0),
    })),
  };
}

/** Converte um hino normalizado de volta ao formato bruto (para edição/salvamento). */
export function toRawSecoes(hino: HarpaHino): RawSecao[] {
  let n = 0;
  return hino.strophes.map((s) => {
    if (s.chorus) return { tipo: "refrao" as const, linhas: s.lines };
    n += 1;
    return { tipo: "estrofe" as const, numero: n, linhas: s.lines };
  });
}

function readCachedOverrides(): OverrideRow[] {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as OverrideRow[]) : [];
  } catch {
    return [];
  }
}

function applyOverrides(list: HarpaHino[], rows: OverrideRow[]): HarpaHino[] {
  if (!rows.length) return list;
  const map = new Map(rows.map((r) => [r.number, r]));
  return list.map((h) => {
    const o = map.get(h.number);
    return o ? normalizeHino(o.number, o.title, o.secoes || []) : h;
  });
}

/** Atualiza (ou cria) um hino no cache em memória + cache local de edições. */
export function applyLocalOverride(row: OverrideRow): HarpaHino {
  const hino = normalizeHino(row.number, row.title, row.secoes || []);
  if (cache) cache = cache.map((h) => (h.number === row.number ? hino : h));
  try {
    const rows = readCachedOverrides().filter((r) => r.number !== row.number);
    rows.push(row);
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(rows));
  } catch {}
  return hino;
}

// Busca as edições feitas pelo admin. Offline-safe: usa o cache local quando falha.
async function fetchOverrides(): Promise<OverrideRow[]> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await (supabase as any)
      .from("harpa_overrides")
      .select("number,title,secoes");
    if (error || !data) return readCachedOverrides();
    const rows = data as OverrideRow[];
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(rows));
    } catch {}
    return rows;
  } catch {
    return readCachedOverrides();
  }
}

export async function loadHarpa(): Promise<HarpaHino[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch(HARPA_URL, { cache: "force-cache" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as RawFile;
      const base = normalize(raw);
      // Aplica primeiro o cache local (instantâneo/offline), depois o servidor.
      const overrides = await fetchOverrides();
      cache = applyOverrides(base, overrides);
      inflight = null;
      return cache;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}