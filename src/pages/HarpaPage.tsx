import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Search,
  Music2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Share2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHead from "@/components/PageHead";
import harpaIcon from "@/assets/harpa-atalaia-icon.png";
import { loadHarpa, type HarpaHino } from "@/data/harpa";
import { toast } from "sonner";
import HarpaMiniPlayer from "@/components/HarpaMiniPlayer";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const FONT_KEY = "harpa:font-size";
const MIN_FONT = 14;
const MAX_FONT = 26;

const HarpaPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HarpaHino | null>(null);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const readerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected && readerRef.current) {
      readerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [selected]);
  const [hinos, setHinos] = useState<HarpaHino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = typeof window !== "undefined" ? Number(localStorage.getItem(FONT_KEY)) : 0;
    return stored >= MIN_FONT && stored <= MAX_FONT ? stored : 17;
  });

  useEffect(() => {
    try {
      localStorage.setItem(FONT_KEY, String(fontSize));
    } catch {}
  }, [fontSize]);

  useEffect(() => {
    let alive = true;
    loadHarpa()
      .then((data) => {
        if (!alive) return;
        setHinos(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message ?? "Falha ao carregar hinário");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Índice de busca por trecho: hino + linha normalizada concatenada
  const searchIndex = useMemo(
    () =>
      hinos.map((h) => ({
        hino: h,
        titleN: normalize(h.title),
        bodyN: normalize(
          h.strophes.flatMap((s) => s.lines).join(" \n ")
        ),
      })),
    [hinos]
  );

  const results = useMemo(() => {
    const raw = query.trim();
    if (!raw) return hinos.map((h) => ({ hino: h, match: null as string | null }));
    const q = normalize(raw);
    const asNumber = Number(raw);
    const numericOnly = /^\d+$/.test(raw);
    return searchIndex
      .filter((it) => {
        if (numericOnly && String(it.hino.number) === raw) return true;
        if (numericOnly && String(it.hino.number).startsWith(raw)) return true;
        if (!Number.isNaN(asNumber) && String(it.hino.number).includes(q)) return true;
        if (it.titleN.includes(q)) return true;
        return it.bodyN.includes(q);
      })
      .map((it) => {
        // Se casou por conteúdo (não por número/título), retorna a linha original que casou
        if (it.titleN.includes(q)) return { hino: it.hino, match: null };
        const line = it.hino.strophes
          .flatMap((s) => s.lines)
          .find((l) => normalize(l).includes(q));
        return { hino: it.hino, match: line ?? null };
      });
  }, [query, hinos, searchIndex]);

  const empty = !loading && hinos.length === 0;

  const goToHymn = (delta: number) => {
    if (!selected) return;
    const idx = hinos.findIndex((h) => h.number === selected.number);
    const next = hinos[idx + delta];
    if (next) {
      setAutoPlayNext(false);
      setSelected(next);
    }
  };

  const shareHymn = async (h: HarpaHino) => {
    const text = [
      `Harpa Cristã Atalaia — ${h.number}. ${h.title}`,
      "",
      ...h.strophes.flatMap((s) => {
        const header = s.chorus ? "Coro:" : s.index ? `${s.index}.` : "";
        return [header, ...s.lines, ""].filter(Boolean);
      }),
    ].join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `Harpa ${h.number} — ${h.title}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Hino copiado");
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] pb-24">
      <PageHead
        title="Harpa Cristã Atalaia — Hinário"
        description="Hinário Harpa Cristã Atalaia para uso congregacional: consulte hinos por número ou título."
        path="/harpa"
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-b border-[hsl(var(--dark-card))]">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={harpaIcon} alt="" width={32} height={32} className="w-8 h-8 object-contain" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight truncate">Harpa Cristã Atalaia</h1>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-tight">
              {loading ? "Carregando…" : empty ? "Hinário indisponível" : `${hinos.length} hinos`}
            </p>
          </div>
        </div>

        {!empty && !loading && (
          <div className="px-4 pb-3 max-w-3xl mx-auto">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--dark-card))] border border-transparent focus-within:border-primary/40">
              <Search className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
              <input
                type="search"
                inputMode="search"
                placeholder="Buscar por número, título ou trecho…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[hsl(var(--dark-muted))]"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Limpar busca">
                  <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                </button>
              )}
            </label>
            {query && (
              <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1.5 px-1">
                {results.length} resultado{results.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[hsl(var(--dark-muted))]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando hinário…
          </div>
        ) : error ? (
          <p className="text-center text-sm text-[hsl(var(--destructive))] py-16">
            Não foi possível carregar o hinário: {error}
          </p>
        ) : empty ? (
          <div className="text-center py-16">
            <img src={harpaIcon} alt="" width={96} height={96} className="w-24 h-24 mx-auto opacity-80" />
            <h2 className="mt-4 text-lg font-semibold">Hinário ainda não carregado</h2>
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-16">
            Nenhum hino encontrado para "{query}".
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.map(({ hino: h, match }) => (
              <li key={h.number}>
                <button
                  onClick={() => setSelected(h)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] border border-transparent hover:border-primary/20 active:scale-[0.99] transition"
                >
                  <span className="w-11 h-11 flex-shrink-0 rounded-lg bg-primary/15 text-primary font-bold flex items-center justify-center text-sm">
                    {h.number}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate text-sm">{h.title}</span>
                    {match && (
                      <span className="block truncate text-[11px] text-[hsl(var(--dark-muted))] italic">
                        “{match}”
                      </span>
                    )}
                  </span>
                  <Music2 className="w-4 h-4 text-[hsl(var(--dark-muted))] flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Leitor de hino */}
      {selected && (
        <div ref={readerRef} className="fixed inset-0 z-50 bg-[hsl(var(--dark-bg))] overflow-y-auto animate-fade-in">
          <header className="sticky top-0 z-10 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-b border-[hsl(var(--dark-card))]">
            <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label="Fechar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary font-bold flex items-center justify-center text-xs">
                {selected.number}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">{selected.title}</h2>
                <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-tight">
                  Hino {selected.number} de {hinos.length}
                </p>
              </div>
              <button
                onClick={() => shareHymn(selected)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label="Compartilhar hino"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Controles: tamanho da fonte + navegação */}
            <div className="flex items-center justify-between gap-2 px-4 pb-3 max-w-3xl mx-auto">
              <div className="flex items-center gap-1 bg-[hsl(var(--dark-card))] rounded-full p-1">
                <button
                  onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition"
                  aria-label="Diminuir fonte"
                  disabled={fontSize <= MIN_FONT}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-[hsl(var(--dark-muted))] w-8 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition"
                  aria-label="Aumentar fonte"
                  disabled={fontSize >= MAX_FONT}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-[hsl(var(--dark-card))] rounded-full p-1">
                <button
                  onClick={() => goToHymn(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Hino anterior"
                  disabled={hinos.findIndex((h) => h.number === selected.number) === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToHymn(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Próximo hino"
                  disabled={hinos.findIndex((h) => h.number === selected.number) === hinos.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-4 pb-3 max-w-3xl mx-auto flex justify-center">
              <HarpaMiniPlayer
                number={selected.number}
                title={selected.title}
                autoPlay={autoPlayNext}
                onEnded={() => {
                  const idx = hinos.findIndex((h) => h.number === selected.number);
                  const next = hinos[idx + 1];
                  if (next) {
                    setAutoPlayNext(true);
                    setSelected(next);
                  }
                }}
              />
            </div>
          </header>

          <article
            className="max-w-2xl mx-auto px-5 py-6 pb-24 space-y-6 text-[hsl(var(--dark-text))] leading-relaxed"
            style={{ fontSize: `${fontSize}px` }}
          >
            {selected.strophes.map((s, i) => (
              <div
                key={i}
                className={
                  s.chorus
                    ? "pl-3 border-l-2 border-[hsl(var(--destructive))]/70 rounded-r-md bg-[hsl(var(--destructive))]/5 py-2 pr-2"
                    : ""
                }
              >
                {!s.chorus && s.index !== undefined && (
                  <span className="block text-xs text-primary/80 font-semibold mb-1">
                    {s.index}
                  </span>
                )}
                {s.chorus && (
                  <span className="block text-[11px] uppercase tracking-wider text-[hsl(var(--destructive))] font-bold mb-1">
                    Coro
                  </span>
                )}
                {s.lines.map((line, j) => (
                  <p
                    key={j}
                    className={s.chorus ? "text-[hsl(var(--destructive))] font-medium" : ""}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ))}

            {/* Navegação de rodapé */}
            <div className="flex items-center justify-between pt-6 border-t border-[hsl(var(--dark-card))]">
              <button
                onClick={() => goToHymn(-1)}
                disabled={hinos.findIndex((h) => h.number === selected.number) === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))] disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => goToHymn(1)}
                disabled={hinos.findIndex((h) => h.number === selected.number) === hinos.length - 1}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))] disabled:opacity-40 transition"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
};

export default HarpaPage;