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

const HARPA_URL = "/harpa/harpa-crista.json";

export async function loadHarpa(): Promise<HarpaHino[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch(HARPA_URL, { cache: "force-cache" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as RawFile;
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