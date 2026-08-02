import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Search,
  Music2,
  Loader2,
  Play,
  Tag,
  User,
  Settings,
  BookOpen,
  HandHeart,
  Star,
  Share2,
  Presentation,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHead from "@/components/PageHead";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AdminCanticos from "@/components/admin/AdminCanticos";
import AdminCanticosMinistros from "@/components/admin/AdminCanticosMinistros";
import HarpaMiniPlayer from "@/components/HarpaMiniPlayer";
import HarpaPresenter from "@/components/HarpaPresenter";
import type { HarpaHino } from "@/data/harpa";
import { canticoRef, canticoToHino as adaptCantico } from "@/lib/canticoAdapt";
import { buildHarpaSlides, slideIndexAt } from "@/lib/harpaSlides";
import {
  getFavorites as getCanticoFavs,
  toggleFavorite as toggleCanticoFav,
} from "@/lib/canticoUserData";
import { toast } from "sonner";

type LetraBloco = { tipo: "verso" | "refrao" | "ponte"; numero?: number; linhas: string[] };
type Playback = { label: string; url: string; cues?: (number | null)[] | null };
type Cantico = {
  id: string;
  numero: number;
  titulo: string;
  letra_json: LetraBloco[];
  categoria: string | null;
  tom: string | null;
  capotraste: number | null;
  playbacks: Playback[];
  referencia_biblica: string | null;
};
type Ministro = { id: string; nome: string };

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const FONT_KEY = "canticos:font-size";
const MIN_FONT = 14;
const MAX_FONT = 26;

const canticoToHino = (c: Cantico): HarpaHino => adaptCantico(c);

export default function CanticosPage() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [adminView, setAdminView] = useState<null | "canticos" | "ministros">(null);
  const [list, setList] = useState<Cantico[]>([]);
  const [ministros, setMinistros] = useState<Ministro[]>([]);
  const [linksByCantico, setLinksByCantico] = useState<Record<string, string[]>>({});
  const [linksByMinistro, setLinksByMinistro] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterMinistro, setFilterMinistro] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [playbackIdx, setPlaybackIdx] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(() => {
    const s = typeof window !== "undefined" ? Number(localStorage.getItem(FONT_KEY)) : 0;
    return s >= MIN_FONT && s <= MAX_FONT ? s : 17;
  });
  const [favorites, setFavorites] = useState<string[]>(() => getCanticoFavs());
  const [presenting, setPresenting] = useState<Cantico | null>(null);
  const [playTime, setPlayTime] = useState(0);
  const [followCues, setFollowCues] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  /** Biblioteca global de playbacks/marcações (compartilhada com a Harpa). */
  const [lib, setLib] = useState<Record<number, { youtube_url: string | null; cues: (number | null)[] | null }>>({});
  const readerRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setPlaybackIdx(0);
    setPlayTime(0);
    setFollowCues(true);
    if (readerRef.current) readerRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [openId]);

  useEffect(() => {
    try { localStorage.setItem(FONT_KEY, String(fontSize)); } catch {}
  }, [fontSize]);

  useEffect(() => {
    const onFav = () => setFavorites(getCanticoFavs());
    window.addEventListener("canticos:favorites-changed", onFav);
    return () => window.removeEventListener("canticos:favorites-changed", onFav);
  }, []);

  useEffect(() => {
    (async () => {
      const [c, m, l] = await Promise.all([
        supabase.from("canticos").select("id, numero, titulo, letra_json, categoria, tom, capotraste, playbacks, referencia_biblica").eq("publicado", true).order("numero"),
        supabase.from("canticos_ministros").select("id, nome").eq("ativo", true).order("sort_order").order("nome"),
        supabase.from("canticos_ministros_link").select("cantico_id, ministro_id"),
      ]);
      setList(((c.data as unknown) as Cantico[]) || []);
      setMinistros(((m.data as unknown) as Ministro[]) || []);
      const byC: Record<string, string[]> = {};
      const byM: Record<string, string[]> = {};
      ((l.data as any[]) || []).forEach((r) => {
        byC[r.cantico_id] = [...(byC[r.cantico_id] || []), r.ministro_id];
        byM[r.ministro_id] = [...(byM[r.ministro_id] || []), r.cantico_id];
      });
      setLinksByCantico(byC);
      setLinksByMinistro(byM);
      setLoading(false);
    })();
  }, []);

  // Biblioteca de playbacks/marcações salvos (mesma usada nas seleções de culto)
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("harpa_playbacks")
        .select("hino_number, youtube_url, cues")
        .gte("hino_number", 100000);
      if (!data) return;
      const map: Record<number, { youtube_url: string | null; cues: (number | null)[] | null }> = {};
      (data as any[]).forEach((r) => {
        map[r.hino_number] = { youtube_url: r.youtube_url, cues: r.cues };
      });
      setLib(map);
    })();
  }, []);

  const categorias = useMemo(() => {
    const s = new Set<string>();
    list.forEach((c) => c.categoria && s.add(c.categoria));
    return Array.from(s).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const qn = normalize(q.trim());
    return list.filter((c) => {
      if (filterCat && c.categoria !== filterCat) return false;
      if (filterMinistro) {
        const ids = linksByMinistro[filterMinistro] || [];
        if (!ids.includes(c.id)) return false;
      }
      if (!qn) return true;
      if (String(c.numero).includes(qn)) return true;
      if (normalize(c.titulo).includes(qn)) return true;
      const letra = (c.letra_json || []).map((b) => b.linhas.join(" ")).join(" ");
      if (normalize(letra).includes(qn)) return true;
      return false;
    });
  }, [list, q, filterCat, filterMinistro, linksByMinistro]);

  const open = list.find((c) => c.id === openId) || null;
  const openMinistros = open ? (linksByCantico[open.id] || []).map((id) => ministros.find((m) => m.id === id)?.nome).filter(Boolean) : [];

  const openIdxInFiltered = open ? filtered.findIndex((c) => c.id === open.id) : -1;
  const atFirst = openIdxInFiltered <= 0;
  const atLast = openIdxInFiltered < 0 || openIdxInFiltered >= filtered.length - 1;
  const goToCantico = (delta: number) => {
    if (!open || openIdxInFiltered < 0) return;
    const next = filtered[openIdxInFiltered + delta];
    if (next) setOpenId(next.id);
  };
  const handleToggleFav = (id: string) => {
    const now = toggleCanticoFav(id);
    toast.success(now ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };
  const shareCantico = async (c: Cantico) => {
    const url = `${window.location.origin}/canticos`;
    const text = [
      `🎵 Cânticos Atalaia — ${c.numero}. ${c.titulo}`,
      "",
      ...(c.letra_json || []).flatMap((b) => {
        const header = b.tipo === "refrao" ? "Refrão:" : b.tipo === "ponte" ? "Ponte:" : `${b.numero ?? ""}.`;
        return [header, ...b.linhas, ""].filter(Boolean);
      }),
      "",
      "🎶 Cante no app Atalaia:",
      url,
    ].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: `${c.numero} — ${c.titulo}`, text, url });
      else { await navigator.clipboard.writeText(text); toast.success("Cântico copiado"); }
    } catch {}
  };

  if (isAdmin && adminView) {
    return (
      <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] pb-24">
        <PageHead title="Cânticos — Admin" description="Gestão de cânticos" path="/canticos" />
        <header className="sticky top-0 z-10 bg-[hsl(var(--dark-bg))]/95 backdrop-blur-sm max-w-6xl mx-auto w-full border-b border-[hsl(var(--dark-card-hover))]">
          <div className="px-5 pt-12 pb-4 flex items-center gap-3 lg:px-8 lg:pt-8">
            <button
              onClick={() => setAdminView(null)}
              className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">
                {adminView === "canticos" ? "Gerenciar Cânticos" : "Gerenciar Ministros"}
              </h1>
              <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-wider">
                Painel de administração
              </p>
            </div>
          </div>
          <div className="px-4 pb-2 max-w-3xl mx-auto">
            <div className="flex gap-1 p-1 rounded-full bg-[hsl(var(--dark-card))] text-xs">
              {([
                { id: "canticos", label: "Cânticos", Icon: BookOpen },
                { id: "ministros", label: "Ministros", Icon: HandHeart },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setAdminView(id)}
                  className={`flex-1 h-8 px-3 rounded-full font-medium flex items-center justify-center gap-1.5 transition ${
                    adminView === id
                      ? "bg-primary text-primary-foreground"
                      : "text-[hsl(var(--dark-muted))]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="p-4">
          {adminView === "canticos" ? <AdminCanticos /> : <AdminCanticosMinistros />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] pb-24">
      <PageHead title="Cânticos" description="Repertório de cânticos com playbacks" path="/canticos" />

      <header className="sticky top-0 z-10 bg-[hsl(var(--dark-bg))]/95 backdrop-blur-sm max-w-6xl mx-auto w-full border-b border-[hsl(var(--dark-card-hover))]">
        <div className="px-5 pt-12 pb-4 flex items-center gap-3 lg:px-8 lg:pt-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">Cânticos</h1>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-wider">
              {loading ? "Carregando…" : `${list.length} cântico${list.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setAdminView("canticos")}
              className="h-9 px-3 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-1.5 shrink-0"
              aria-label="Gerenciar"
            >
              <Settings className="w-3.5 h-3.5" /> Gerenciar
            </button>
          )}
        </div>

        <div className="px-4 pb-3 space-y-2 max-w-3xl mx-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, título ou trecho da letra…"
              className="w-full h-10 pl-9 pr-3 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="h-9 px-3 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-xs shrink-0"
            >
              <option value="">Todas categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterMinistro}
              onChange={(e) => setFilterMinistro(e.target.value)}
              className="h-9 px-3 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-xs shrink-0"
            >
              <option value="">Todos ministros</option>
              {ministros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-[hsl(var(--dark-muted))]">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Nenhum cântico {list.length ? "encontrado" : "cadastrado ainda"}
        </div>
      ) : (
        <ul className="p-4 space-y-2 max-w-3xl mx-auto">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setOpenId(c.id)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-left hover:bg-[hsl(var(--dark-card-hover))] transition"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {c.numero}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.titulo}</div>
                  <div className="text-xs text-[hsl(var(--dark-muted))] flex items-center gap-2 flex-wrap mt-0.5">
                    {c.categoria && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{c.categoria}</span>}
                    {c.tom && <span>Tom {c.tom}</span>}
                    {(c.playbacks?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{c.playbacks.length}</span>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div ref={readerRef} className="fixed inset-0 z-50 bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] overflow-y-auto animate-fade-in">
          <header className="sticky top-0 z-10 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-b border-[hsl(var(--dark-card))]">
            <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
              <button
                onClick={() => setOpenId(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label="Fechar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary font-bold flex items-center justify-center text-xs">
                {open.numero}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">{open.titulo}</h2>
                <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-tight">
                  Cântico {open.numero}{list.length ? ` de ${list.length}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleToggleFav(open.id)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label={favorites.includes(open.id) ? "Remover favorito" : "Adicionar favorito"}
              >
                <Star
                  className={`w-4 h-4 ${favorites.includes(open.id) ? "text-yellow-400" : ""}`}
                  fill={favorites.includes(open.id) ? "currentColor" : "none"}
                />
              </button>
              <button
                onClick={() => setPresenting(open)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label="Modo apresentação"
                title="Apresentar"
              >
                <Presentation className="w-4 h-4" />
              </button>
              <button
                onClick={() => shareCantico(open)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card))] active:scale-95 transition"
                aria-label="Compartilhar"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Controles: tamanho da fonte + navegação */}
            <div className="flex items-center justify-between gap-2 px-4 pb-3 max-w-3xl mx-auto">
              <div className="flex items-center gap-1 bg-[hsl(var(--dark-card))] rounded-full p-1">
                <button
                  onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 1))}
                  disabled={fontSize <= MIN_FONT}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Diminuir fonte"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-[hsl(var(--dark-muted))] w-8 text-center">{fontSize}</span>
                <button
                  onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 1))}
                  disabled={fontSize >= MAX_FONT}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Aumentar fonte"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-[hsl(var(--dark-card))] rounded-full p-1">
                <button
                  onClick={() => goToCantico(-1)}
                  disabled={atFirst}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Cântico anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToCantico(1)}
                  disabled={atLast}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition disabled:opacity-40"
                  aria-label="Próximo cântico"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(open.playbacks?.length ?? 0) > 0 && (
              <div className="px-4 pb-3 max-w-3xl mx-auto flex flex-col items-center gap-2">
                {open.playbacks.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {open.playbacks.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPlaybackIdx(i)}
                        className={`h-7 px-2.5 rounded-full text-xs font-medium border transition ${
                          i === playbackIdx
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-muted))]"
                        }`}
                      >
                        {p.label || `Playback ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
                <HarpaMiniPlayer
                  key={`${open.id}-${playbackIdx}`}
                  number={open.numero}
                  title={open.titulo}
                  videoUrl={open.playbacks[playbackIdx]?.url ?? null}
                />
              </div>
            )}
          </header>

          <article
            className="max-w-2xl mx-auto px-5 py-6 pb-24 space-y-6 text-[hsl(var(--dark-text))] leading-relaxed"
            style={{ fontSize: `${fontSize}px` }}
          >
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {open.categoria && <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium">{open.categoria}</span>}
              {open.tom && <span className="px-2.5 py-1 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">Tom {open.tom}</span>}
              {open.capotraste != null && <span className="px-2.5 py-1 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">Capo {open.capotraste}</span>}
              {open.referencia_biblica && <span className="px-2.5 py-1 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">📖 {open.referencia_biblica}</span>}
            </div>

            {openMinistros.length > 0 && (
              <div className="text-xs text-[hsl(var(--dark-muted))] flex items-center gap-1.5 flex-wrap">
                <User className="w-3.5 h-3.5" /> {openMinistros.join(", ")}
              </div>
            )}

            {(open.letra_json || []).map((b, i) => (
              <div
                key={i}
                className={
                  b.tipo === "refrao"
                    ? "pl-3 border-l-2 border-[hsl(var(--destructive))]/70 rounded-r-md bg-[hsl(var(--destructive))]/5 py-2 pr-2"
                    : ""
                }
              >
                {b.tipo === "verso" && (
                  <span className="block text-xs text-primary/80 font-semibold mb-1">
                    {b.numero ?? i + 1}
                  </span>
                )}
                {b.tipo === "refrao" && (
                  <span className="block text-[11px] uppercase tracking-wider text-[hsl(var(--destructive))] font-bold mb-1">
                    Refrão
                  </span>
                )}
                {b.tipo === "ponte" && (
                  <span className="block text-[11px] uppercase tracking-wider text-primary font-bold mb-1">
                    Ponte
                  </span>
                )}
                {b.linhas.map((l, j) => (
                  <p key={j} className={b.tipo === "refrao" ? "text-[hsl(var(--destructive))] font-medium" : ""}>
                    {l}
                  </p>
                ))}
              </div>
            ))}

            <div className="flex items-center justify-between pt-6 border-t border-[hsl(var(--dark-card))]">
              <button
                onClick={() => goToCantico(-1)}
                disabled={atFirst}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))] disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => goToCantico(1)}
                disabled={atLast}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))] disabled:opacity-40 transition"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </article>
        </div>
      )}

      {presenting && (
        <HarpaPresenter
          hino={canticoToHino(presenting)}
          videoUrl={presenting.playbacks?.[playbackIdx]?.url ?? presenting.playbacks?.[0]?.url ?? null}
          onClose={() => setPresenting(null)}
        />
      )}
    </div>
  );
}