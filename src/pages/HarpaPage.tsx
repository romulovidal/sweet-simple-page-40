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
  Star,
  Clock,
  Tag,
  ListMusic,
  Presentation,
  Trash2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import PageHead from "@/components/PageHead";
import harpaIcon from "@/assets/harpa-atalaia-icon.png";
import { loadHarpa, type HarpaHino } from "@/data/harpa";
import { toast } from "sonner";
import HarpaMiniPlayer from "@/components/HarpaMiniPlayer";
import HarpaPresenter from "@/components/HarpaPresenter";
import {
  getFavorites,
  isFavorite,
  toggleFavorite,
  getHistory,
  pushHistory,
  clearHistory,
  type HarpaHistoryEntry,
} from "@/lib/harpaUserData";
import { HARPA_THEMES, buildIndex, hymnsByTheme } from "@/lib/harpaThemes";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const FONT_KEY = "harpa:font-size";
const MIN_FONT = 14;
const MAX_FONT = 26;

type TabKey = "todos" | "favoritos" | "historico" | "temas";

const HarpaPage = () => {
  const navigate = useNavigate();
  const { number: routeNumber } = useParams();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HarpaHino | null>(null);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [presenting, setPresenting] = useState<HarpaHino | null>(null);
  const [tab, setTab] = useState<TabKey>("todos");
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
  const [history, setHistory] = useState<HarpaHistoryEntry[]>(() => getHistory());
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected && readerRef.current) {
      readerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
    if (selected) pushHistory(selected.number);
    if (selected) {
      const target = `/harpa/${selected.number}`;
      if (window.location.pathname !== target) {
        window.history.replaceState(null, "", target);
      }
    } else if (window.location.pathname !== "/harpa") {
      window.history.replaceState(null, "", "/harpa");
    }
  }, [selected]);

  useEffect(() => {
    const onFav = () => setFavorites(getFavorites());
    const onHist = () => setHistory(getHistory());
    window.addEventListener("harpa:favorites-changed", onFav);
    window.addEventListener("harpa:history-changed", onHist);
    return () => {
      window.removeEventListener("harpa:favorites-changed", onFav);
      window.removeEventListener("harpa:history-changed", onHist);
    };
  }, []);

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

  // Abrir hino automaticamente a partir da URL /harpa/:number
  useEffect(() => {
    if (!routeNumber || hinos.length === 0) return;
    const n = Number(routeNumber);
    if (!Number.isFinite(n)) return;
    if (selected?.number === n) return;
    const found = hinos.find((h) => h.number === n);
    if (found) {
      setAutoPlayNext(false);
      setSelected(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeNumber, hinos]);

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

  const themeIndex = useMemo(() => buildIndex(hinos), [hinos]);

  const baseList = useMemo<HarpaHino[]>(() => {
    if (tab === "favoritos") {
      const set = new Set(favorites);
      return hinos.filter((h) => set.has(h.number));
    }
    if (tab === "historico") {
      const map = new Map(hinos.map((h) => [h.number, h] as const));
      return history.map((e) => map.get(e.number)).filter(Boolean) as HarpaHino[];
    }
    if (tab === "temas" && activeTheme) {
      const theme = HARPA_THEMES.find((t) => t.id === activeTheme);
      if (!theme) return [];
      return hymnsByTheme(themeIndex, theme);
    }
    return hinos;
  }, [tab, hinos, favorites, history, activeTheme, themeIndex]);

  const results = useMemo(() => {
    const raw = query.trim();
    if (!raw) return baseList.map((h) => ({ hino: h, match: null as string | null }));
    const q = normalize(raw);
    const asNumber = Number(raw);
    const numericOnly = /^\d+$/.test(raw);
    const baseSet = new Set(baseList.map((h) => h.number));
    return searchIndex
      .filter((it) => {
        if (!baseSet.has(it.hino.number)) return false;
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
  }, [query, baseList, searchIndex]);

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

  const handleToggleFav = (n: number) => {
    const now = toggleFavorite(n);
    toast.success(now ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const showThemeGrid = tab === "temas" && !activeTheme;

  const shareHymn = async (h: HarpaHino) => {
    const url = `${window.location.origin}/harpa/${h.number}`;
    const text = [
      `🎵 Harpa Cristã Atalaia — ${h.number}. ${h.title}`,
      "",
      ...h.strophes.flatMap((s) => {
        const header = s.chorus ? "Coro:" : s.index ? `${s.index}.` : "";
        return [header, ...s.lines, ""].filter(Boolean);
      }),
      "",
      "🎶 Cante e leia este hino no app Atalaia:",
      url,
    ].join("\n");
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Harpa ${h.number} — ${h.title}`,
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Hino e link copiados");
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
      <header className="sticky top-0 z-10 bg-dark-bg/95 backdrop-blur-sm max-w-6xl mx-auto w-full border-b border-[hsl(var(--dark-card-hover))]">
        <div className="px-5 pt-12 pb-4 flex items-center gap-3 lg:px-8 lg:pt-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">Harpa Cristã</h1>
            <p className="text-[10px] text-dark-muted font-medium uppercase tracking-wider">
              {loading ? "Carregando…" : empty ? "Hinário indisponível" : `${hinos.length} hinos`}
            </p>
          </div>
        </div>

        {!empty && !loading && (
          <div className="px-4 pb-2 max-w-3xl mx-auto">
            <div className="flex gap-1 p-1 rounded-full bg-[hsl(var(--dark-card))] text-xs">
              {(
                [
                  { id: "todos", label: "Todos", Icon: ListMusic },
                  { id: "favoritos", label: "Favoritos", Icon: Star },
                  { id: "historico", label: "Recentes", Icon: Clock },
                  { id: "temas", label: "Temas", Icon: Tag },
                ] as { id: TabKey; label: string; Icon: typeof Star }[]
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setActiveTheme(null);
                    setQuery("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition font-medium ${
                    tab === id
                      ? "bg-primary text-primary-foreground"
                      : "text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!empty && !loading && !showThemeGrid && (
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
            <div className="flex items-center justify-between mt-1.5 px-1">
              {activeTheme ? (
                <button
                  onClick={() => setActiveTheme(null)}
                  className="text-[11px] text-primary flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Voltar aos temas
                </button>
              ) : (
                <span />
              )}
              <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                {query
                  ? `${results.length} resultado${results.length === 1 ? "" : "s"}`
                  : `${baseList.length} hino${baseList.length === 1 ? "" : "s"}`}
              </p>
            </div>
            {tab === "historico" && history.length > 0 && (
              <button
                onClick={() => {
                  clearHistory();
                  toast.success("Histórico limpo");
                }}
                className="mt-2 text-[11px] text-[hsl(var(--destructive))] flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Limpar histórico
              </button>
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
        ) : showThemeGrid ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HARPA_THEMES.map((t) => {
              const count = hymnsByTheme(themeIndex, t).length;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTheme(t.id)}
                    className="w-full text-left p-4 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] border border-transparent hover:border-primary/20 active:scale-[0.99] transition"
                  >
                    <div className="text-2xl mb-1">{t.emoji}</div>
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-[11px] text-[hsl(var(--dark-muted))]">
                      {count} hino{count === 1 ? "" : "s"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : tab === "favoritos" && favorites.length === 0 ? (
          <div className="text-center py-16 text-[hsl(var(--dark-muted))]">
            <Star className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum favorito ainda.</p>
            <p className="text-xs mt-1">Toque na estrela ao abrir um hino para salvá-lo.</p>
          </div>
        ) : tab === "historico" && history.length === 0 ? (
          <div className="text-center py-16 text-[hsl(var(--dark-muted))]">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum hino aberto recentemente.</p>
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
                  onClick={() => { setAutoPlayNext(false); setSelected(h); }}
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
                  {favorites.includes(h.number) ? (
                    <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" />
                  ) : (
                    <Music2 className="w-4 h-4 text-[hsl(var(--dark-muted))] flex-shrink-0" />
                  )}
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
                onClick={() => { setAutoPlayNext(false); setSelected(null); }}
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
                onClick={() => handleToggleFav(selected.number)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label={favorites.includes(selected.number) ? "Remover favorito" : "Adicionar favorito"}
              >
                <Star
                  className={`w-4 h-4 ${favorites.includes(selected.number) ? "text-yellow-400" : ""}`}
                  fill={favorites.includes(selected.number) ? "currentColor" : "none"}
                />
              </button>
              <button
                onClick={() => setPresenting(selected)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label="Modo apresentação"
                title="Apresentar"
              >
                <Presentation className="w-4 h-4" />
              </button>
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

      {presenting && (
        <HarpaPresenter hino={presenting} onClose={() => setPresenting(null)} />
      )}
    </div>
  );
};

export default HarpaPage;