// Schema interno + loader para /harpa-crista.json (Harpa Cristã Atalaia, 524 hinos).
// O JSON fica em public/ e é carregado sob demanda para não inflar o bundle.

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
interface RawSecao {
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

function normalize(raw: RawFile): HarpaHino[] {
  return raw.hinos.map((h) => ({
    number: h.numero,
    title: h.titulo,
    strophes: h.secoes.map((s) => ({
      chorus: s.tipo === "refrao",
      index: s.tipo === "estrofe" ? s.numero : undefined,
      lines: s.linhas,
    })),
  }));
}

let cache: HarpaHino[] | null = null;
let inflight: Promise<HarpaHino[]> | null = null;

export async function loadHarpa(): Promise<HarpaHino[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/harpa-crista.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<RawFile>;
    })
    .then((raw) => {
      cache = normalize(raw);
      inflight = null;
      return cache;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}