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
  Church,
  Calendar as CalendarIcon,
  Pencil,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import PageHead from "@/components/PageHead";
import harpaIcon from "@/assets/harpa-atalaia-icon.png";
import { loadHarpa, type HarpaHino } from "@/data/harpa";
import { toast } from "sonner";
import HarpaMiniPlayer from "@/components/HarpaMiniPlayer";
import HarpaPresenter from "@/components/HarpaPresenter";
import HarpaReportButton from "@/components/HarpaReportButton";
import HarpaEditorDialog from "@/components/HarpaEditorDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
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
import { createShortCultoLink } from "@/lib/cultoShare";
import { buildHarpaSlides, slideIndexAt } from "@/lib/harpaSlides";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const FONT_KEY = "harpa:font-size";
const MIN_FONT = 14;
const MAX_FONT = 26;

type TabKey = "todos" | "cultos" | "favoritos" | "historico" | "temas";

type CultoItem = {
  hino_number: number;
  youtube_url?: string | null;
  note?: string | null;
  cues?: (number | null)[] | null;
};
type CultoSelection = {
  id: string;
  title: string;
  culto_date: string;
  items: CultoItem[];
  is_active: boolean;
};

const fmtCultoDate = (iso: string) => {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
};

const HarpaPage = () => {
  const navigate = useNavigate();
  const { number: routeNumber, cultoId: routeCultoId } = useParams();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HarpaHino | null>(null);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [presenting, setPresenting] = useState<HarpaHino | null>(null);
  const [tab, setTab] = useState<TabKey>("todos");
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
  const [history, setHistory] = useState<HarpaHistoryEntry[]>(() => getHistory());
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [cultoSelections, setCultoSelections] = useState<CultoSelection[]>([]);
  const [activeCulto, setActiveCulto] = useState<CultoSelection | null>(null);
  const [editing, setEditing] = useState<HarpaHino | null>(null);
  const [playTime, setPlayTime] = useState(0);
  const [followCues, setFollowCues] = useState(true);
  const { isAdmin } = useIsAdmin();
  const readerRef = useRef<HTMLDivElement | null>(null);
  const stropheRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selected && readerRef.current) {
      readerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
    if (selected) pushHistory(selected.number);
    const basePath = activeCulto ? `/harpa/culto/${activeCulto.id}` : "/harpa";
    if (selected) {
      const target = activeCulto ? basePath : `/harpa/${selected.number}`;
      if (window.location.pathname !== target) {
        window.history.replaceState(null, "", target);
      }
    } else if (window.location.pathname !== basePath) {
      window.history.replaceState(null, "", basePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeCulto]);

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

  // Fetch admin-curated culto selections (visible to all users)
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("culto_selections")
        .select("id,title,culto_date,items,is_active")
        .eq("is_active", true)
        .order("culto_date", { ascending: false })
        .limit(30);
      if (data) setCultoSelections(data as CultoSelection[]);
    })();
  }, []);

  // Map hymn number → admin YouTube URL for the currently-open culto
  const cultoUrlMap = useMemo(() => {
    const m = new Map<number, string | null>();
    if (activeCulto) {
      for (const it of activeCulto.items) m.set(it.hino_number, it.youtube_url || null);
    }
    return m;
  }, [activeCulto]);

  const activeSequence = useMemo(
    () => (activeCulto ? activeCulto.items.map((it) => it.hino_number) : []),
    [activeCulto]
  );

  // Marcações (segundos por estrofe) definidas pelo admin no culto
  const cultoCuesMap = useMemo(() => {
    const m = new Map<number, (number | null)[]>();
    if (activeCulto) {
      for (const it of activeCulto.items) {
        if (it.cues && it.cues.some((c) => typeof c === "number")) m.set(it.hino_number, it.cues);
      }
    }
    return m;
  }, [activeCulto]);

  const shareCulto = async (c: CultoSelection) => {
    const fallback = `${window.location.origin}/harpa/culto/${c.id}`;
    const url = await createShortCultoLink(c.id, fallback);
    const lista = c.items.map((it) => `• Hino ${it.hino_number}`).join("\n");
    const text = `🎵 ${c.title} — ${fmtCultoDate(c.culto_date)}\n\n${lista}\n\nAbra a seleção completa na Harpa Atalaia:\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: c.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Link da seleção copiado!");
    } catch {
      /* cancelado pelo usuário */
    }
  };

  // Abrir seleção de culto automaticamente a partir da URL /harpa/culto/:id
  useEffect(() => {
    if (!routeCultoId || activeCulto?.id === routeCultoId) return;
    let alive = true;
    (async () => {
      const local = cultoSelections.find((c) => c.id === routeCultoId);
      if (local) {
        setTab("cultos");
        setActiveCulto(local);
        return;
      }
      const { data } = await (supabase as any)
        .from("culto_selections")
        .select("id,title,culto_date,items,is_active")
        .eq("id", routeCultoId)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setTab("cultos");
        setActiveCulto(data as CultoSelection);
      } else {
        toast.error("Seleção de culto não encontrada");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCultoId, cultoSelections]);

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
    if (tab === "cultos" && activeCulto) {
      const map = new Map(hinos.map((h) => [h.number, h] as const));
      return activeCulto.items
        .map((it) => map.get(it.hino_number))
        .filter(Boolean) as HarpaHino[];
    }
    return hinos;
  }, [tab, hinos, favorites, history, activeTheme, themeIndex, activeCulto]);

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
    // Inside a culto: navigate through the curated sequence
    if (activeCulto && activeSequence.length > 0) {
      const idx = activeSequence.indexOf(selected.number);
      if (idx >= 0) {
        const nextNum = activeSequence[idx + delta];
        if (nextNum) {
          const next = hinos.find((h) => h.number === nextNum);
          if (next) {
            setAutoPlayNext(false);
            setSelected(next);
          }
        }
        // Always return when inside a culto — never fall through to the
        // global hymn list, otherwise navigation escapes the curated set.
        return;
      }
    }
    const idx = hinos.findIndex((h) => h.number === selected.number);
    const next = hinos[idx + delta];
    if (next) {
      setAutoPlayNext(false);
      setSelected(next);
    }
  };

  // For the currently-open hymn, resolve the admin YouTube URL if in a culto
  const currentVideoUrl = selected ? cultoUrlMap.get(selected.number) ?? null : null;
  const currentCues = selected ? cultoCuesMap.get(selected.number) ?? null : null;

  // Estrofe ativa segundo as marcações do culto (sincronia com o playback)
  const activeStropheIdx = useMemo(() => {
    if (!selected || !currentCues || !followCues) return -1;
    const slides = buildHarpaSlides(selected);
    const i = slideIndexAt(currentCues, playTime);
    return i >= 0 ? slides[i]?.stropheIdx ?? -1 : -1;
  }, [selected, currentCues, followCues, playTime]);

  useEffect(() => {
    setPlayTime(0);
    setFollowCues(true);
  }, [selected]);

  useEffect(() => {
    if (activeStropheIdx < 0) return;
    const el = stropheRefs.current[activeStropheIdx];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeStropheIdx]);

  // Navigation boundaries — inside a culto, boundaries follow the curated
  // sequence; otherwise they follow the global hymn list.
  const cultoIdx =
    selected && activeCulto && activeSequence.length > 0
      ? activeSequence.indexOf(selected.number)
      : -1;
  const atFirst =
    cultoIdx >= 0
      ? cultoIdx === 0
      : selected
      ? hinos.findIndex((h) => h.number === selected.number) === 0
      : true;
  const atLast =
    cultoIdx >= 0
      ? cultoIdx === activeSequence.length - 1
      : selected
      ? hinos.findIndex((h) => h.number === selected.number) === hinos.length - 1
      : true;

  // In presenter, when audio ends, jump to the next hino of the culto sequence
  const presenterVideoUrl = presenting ? cultoUrlMap.get(presenting.number) ?? null : null;
  const advancePresenterFromCulto = () => {
    if (!presenting || !activeCulto || activeSequence.length === 0) return;
    const idx = activeSequence.indexOf(presenting.number);
    if (idx < 0) return;
    const nextNum = activeSequence[idx + 1];
    if (!nextNum) return;
    const next = hinos.find((h) => h.number === nextNum);
    if (next) setPresenting(next);
  };

  const handleToggleFav = (n: number) => {
    const now = toggleFavorite(n);
    toast.success(now ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const showThemeGrid = tab === "temas" && !activeTheme;
  const showCultoGrid = tab === "cultos" && !activeCulto;

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
          <button
            onClick={() => navigate("/canticos")}
            className="h-9 px-3 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-1.5 shrink-0"
            aria-label="Abrir Cânticos"
          >
            <Music2 className="w-3.5 h-3.5" />
            Cânticos
          </button>
        </div>

        {!empty && !loading && (
          <div className="px-4 pb-2 max-w-3xl mx-auto">
            <div className="flex gap-1 p-1 rounded-full bg-[hsl(var(--dark-card))] text-xs">
              {(
                [
                  { id: "todos", label: "Todos", Icon: ListMusic },
                  { id: "cultos", label: "Cultos", Icon: Church },
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
                    setActiveCulto(null);
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

        {!empty && !loading && !showThemeGrid && !showCultoGrid && (
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
              ) : activeCulto ? (
                <button
                  onClick={() => setActiveCulto(null)}
                  className="text-[11px] text-primary flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Voltar aos cultos
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
            {tab === "cultos" && activeCulto && baseList.length > 0 && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    const first = baseList[0];
                    if (first) setPresenting(first);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition"
                >
                  <Presentation className="w-3.5 h-3.5" />
                  Apresentar culto (auto-avança)
                </button>
                <button
                  onClick={() => shareCulto(activeCulto)}
                  aria-label="Compartilhar seleção do culto"
                  className="px-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Compartilhar
                </button>
              </div>
            )}
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
        ) : showCultoGrid ? (
          cultoSelections.length === 0 ? (
            <div className="text-center py-16 text-[hsl(var(--dark-muted))]">
              <Church className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma seleção de culto disponível ainda.</p>
              <p className="text-xs mt-1">O admin pode criar em Administração → Seleção de Hinos.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {cultoSelections.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center gap-1 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] border border-transparent hover:border-primary/30 transition pr-2">
                    <button
                      onClick={() => setActiveCulto(c)}
                      className="flex-1 min-w-0 text-left p-4 flex items-center gap-3 active:scale-[0.99] transition"
                    >
                      <span className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                        <Church className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{c.title}</p>
                        <p className="text-[11px] text-[hsl(var(--dark-muted))] flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {fmtCultoDate(c.culto_date)} · {c.items.length} hino
                          {c.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                    </button>
                    <button
                      onClick={() => shareCulto(c)}
                      aria-label={`Compartilhar ${c.title}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--dark-muted))] hover:text-primary hover:bg-primary/10 transition flex-shrink-0"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
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
                  {tab === "cultos" && activeCulto && cultoUrlMap.get(h.number) ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
                      ♪
                    </span>
                  ) : favorites.includes(h.number) ? (
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
              {isAdmin && (
                <button
                  onClick={() => setEditing(selected)}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-primary hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                  aria-label="Editar hino"
                  title="Editar hino"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
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
                  disabled={atFirst}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToHymn(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Próximo hino"
                  disabled={atLast}
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
                videoUrl={currentVideoUrl}
                onEnded={() => {
                  // In a culto: advance through the curated sequence first
                  if (activeCulto && activeSequence.length > 0) {
                    const idx = activeSequence.indexOf(selected.number);
                    const nextNum = idx >= 0 ? activeSequence[idx + 1] : undefined;
                    if (nextNum) {
                      const next = hinos.find((h) => h.number === nextNum);
                      if (next) {
                        setAutoPlayNext(true);
                        setSelected(next);
                        return;
                      }
                    }
                    return; // end of culto sequence — do not jump to next global hymn
                  }
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
                disabled={atFirst}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))] disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => goToHymn(1)}
                disabled={atLast}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))] disabled:opacity-40 transition"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-center pt-2">
              <HarpaReportButton
                hinoNumber={selected.number}
                hinoTitle={selected.title}
              />
            </div>
          </article>
        </div>
      )}

      {presenting && (
        <HarpaPresenter
          hino={presenting}
          videoUrl={presenterVideoUrl}
          onAudioEnded={advancePresenterFromCulto}
          onClose={() => setPresenting(null)}
        />
      )}

      {editing && isAdmin && (
        <HarpaEditorDialog
          hino={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setHinos((list) => list.map((h) => (h.number === updated.number ? updated : h)));
            setSelected((cur) => (cur && cur.number === updated.number ? updated : cur));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default HarpaPage;