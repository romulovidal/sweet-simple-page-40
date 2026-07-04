import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Search, X, Clock, Users, MapPin, BookOpen, Sparkles, Map as MapIcon, GitBranch, Heart, Trophy, Calendar, Scale, BarChart3 } from "lucide-react";
import HistoriaTimeline from "./components/Timeline/HistoriaTimeline";
import HistoriaMap from "./components/Map/HistoriaMap";
import ParallelsView from "./components/Parallels/ParallelsView";
import EntityDetail from "./components/EntityDetail";
import Chip from "./components/shared/Chip";
import QuizHub from "./components/Quiz/QuizHub";
import QuizPlayer from "./components/Quiz/QuizPlayer";
import PlanHub from "./components/Plan/PlanHub";
import PlanReader from "./components/Plan/PlanReader";
import CompareView from "./components/Compare/CompareView";
import StatsView from "./components/Stats/StatsView";
import { PERIODS } from "./data/periods";
import { CHARACTERS } from "./data/characters";
import { EVENTS } from "./data/events";
import { PLACES } from "./data/places";
import { BOOKS } from "./data/books";
import { useHistoriaSearch } from "./hooks/useHistoriaSearch";
import { useHistoryNav } from "./hooks/useHistoryNav";
import { useFavorites } from "./hooks/useFavorites";
import type { CharacterTag, EntityRef } from "./types";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

type Tab = "timeline" | "characters" | "events" | "places" | "map" | "parallels" | "books" | "plan" | "quiz" | "compare" | "stats";

const CHAR_FILTERS: { id: CharacterTag; label: string; icon: string }[] = [
  { id: "patriarca", label: "Patriarcas", icon: "🌟" },
  { id: "profeta", label: "Profetas", icon: "📖" },
  { id: "rei", label: "Reis", icon: "👑" },
  { id: "juiz", label: "Juízes", icon: "⚖️" },
  { id: "mulher", label: "Mulheres", icon: "💜" },
  { id: "apostolo", label: "Apóstolos", icon: "✉️" },
  { id: "sacerdote", label: "Sacerdotes", icon: "🕎" },
];

const HistoriaVivaHub = ({ open, onOpenChange }: Props) => {
  const [tab, setTab] = useState<Tab>("timeline");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [showFavs, setShowFavs] = useState(false);
  const nav = useHistoryNav();
  const hits = useHistoriaSearch(query, filters);
  const { list: favList } = useFavorites();

  const openRef = (ref: EntityRef) => nav.push(ref);
  const back = () => (nav.canBack ? nav.back() : nav.reset());

  const toggleFilter = (id: string) =>
    setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[100dvh] p-0 flex flex-col bg-background border-0">
        {/* Header */}
        <header
          className="px-4 pt-4 pb-2 relative"
          style={{
            background: "linear-gradient(180deg, hsl(var(--primary) / 0.18) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-center justify-between mb-2 pr-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">História Viva</p>
              <h1 className="text-xl font-black leading-tight">A Bíblia contada em ordem</h1>
            </div>
            <button
              onClick={() => setShowFavs(true)}
              className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center relative"
              aria-label="Meus favoritos"
            >
              <Heart className="w-4 h-4 text-primary" />
              {favList().length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center px-1">
                  {favList().length}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar personagem, evento, cidade, livro…"
              className="w-full bg-dark-card rounded-xl pl-10 pr-9 py-2.5 text-sm placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-dark-card-hover flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tabs */}
          {!query && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {([
                { id: "timeline", label: "Linha do tempo", icon: <Clock className="w-3.5 h-3.5" /> },
                { id: "map", label: "Mapa", icon: <MapIcon className="w-3.5 h-3.5" /> },
                { id: "parallels", label: "Paralelas", icon: <GitBranch className="w-3.5 h-3.5" /> },
                { id: "characters", label: `Personagens`, icon: <Users className="w-3.5 h-3.5" /> },
                { id: "events", label: `Eventos`, icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: "places", label: `Lugares`, icon: <MapPin className="w-3.5 h-3.5" /> },
                { id: "books", label: `Livros`, icon: <BookOpen className="w-3.5 h-3.5" /> },
                { id: "plan", label: "Plano", icon: <Calendar className="w-3.5 h-3.5" /> },
                { id: "quiz", label: "Quiz", icon: <Trophy className="w-3.5 h-3.5" /> },
                { id: "compare", label: "Comparar", icon: <Scale className="w-3.5 h-3.5" /> },
                { id: "stats", label: "Estatísticas", icon: <BarChart3 className="w-3.5 h-3.5" /> },
              ] as const).map((t) => (
                <Chip
                  key={t.id}
                  active={tab === t.id}
                  onClick={() => setTab(t.id)}
                  icon={t.icon}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          )}

          {/* Character filters */}
          {!query && tab === "characters" && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {CHAR_FILTERS.map((f) => (
                <Chip
                  key={f.id}
                  active={filters.includes(f.id)}
                  onClick={() => toggleFilter(f.id)}
                >
                  {f.icon} {f.label}
                </Chip>
              ))}
              {filters.length > 0 && (
                <Chip onClick={() => setFilters([])}>Limpar</Chip>
              )}
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {query ? (
            <div className="px-4 py-3 space-y-1.5">
              {hits.length === 0 ? (
                <p className="text-sm text-dark-muted text-center py-10">Nenhum resultado para "{query}"</p>
              ) : (
                hits.map((h) => (
                  <button
                    key={`${h.kind}-${h.id}`}
                    onClick={() => { openRef({ kind: h.kind, id: h.id }); setQuery(""); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-card active:bg-dark-card-hover text-left transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl bg-dark-card-hover flex items-center justify-center text-lg flex-shrink-0">
                      {h.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{h.label}</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">{tagFor(h.kind)}</span>
                      </div>
                      {h.sub && <p className="text-[11px] text-dark-muted line-clamp-1">{h.sub}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : tab === "timeline" ? (
            <>
              <HistoriaTimeline
                onOpenEvent={(id) => openRef({ kind: "event", id })}
                onOpenPeriod={(id) => openRef({ kind: "period", id })}
              />
              <div className="px-4 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Períodos</h3>
                <div className="grid grid-cols-1 gap-2">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openRef({ kind: "period", id: p.id })}
                      className="flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.99] transition-transform"
                      style={{
                        background: `linear-gradient(135deg, hsl(${p.color} / 0.22), hsl(var(--dark-card)) 60%)`,
                        border: `1px solid hsl(${p.color} / 0.35)`,
                      }}
                    >
                      <span
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg shadow-lg flex-shrink-0"
                        style={{ background: `hsl(${p.color})` }}
                      >{p.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-dark-text">{p.name}</p>
                        <p className="text-[11px] text-dark-muted line-clamp-1">{p.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : tab === "characters" ? (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CHARACTERS
                .filter((c) => !filters.length || c.tags.some((t) => filters.includes(t)))
                .map((c) => {
                  const period = PERIODS.find((p) => p.id === c.periodId);
                  const color = c.color ?? period?.color ?? "217 91% 60%";
                  return (
                    <button
                      key={c.id}
                      onClick={() => openRef({ kind: "character", id: c.id })}
                      className="relative aspect-[3/4] rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform"
                      style={{
                        background: `linear-gradient(160deg, hsl(${color} / 0.35) 0%, hsl(var(--dark-card)) 65%)`,
                        border: `1px solid hsl(${color} / 0.4)`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-90">{c.icon}</div>
                      <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent">
                        <p className="text-sm font-bold text-white truncate">{c.name}</p>
                        <p className="text-[10px] text-white/70 truncate">{period?.name}</p>
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : tab === "map" ? (
            <HistoriaMap onOpenPlace={(id) => openRef({ kind: "place", id })} onNavigate={openRef} />
          ) : tab === "parallels" ? (
            <ParallelsView onNavigate={openRef} />
          ) : tab === "quiz" ? (
            <QuizHub onStart={(id) => setActiveQuiz(id)} />
          ) : tab === "plan" ? (
            <PlanHub onOpen={(id) => setActivePlan(id)} />
          ) : tab === "compare" ? (
            <CompareView onOpen={openRef} />
          ) : tab === "stats" ? (
            <StatsView />
          ) : tab === "events" ? (
            <div className="p-4 space-y-2">
              {EVENTS.sort((a, b) => a.year - b.year).map((e) => {
                const period = PERIODS.find((p) => p.id === e.periodId)!;
                return (
                  <button
                    key={e.id}
                    onClick={() => openRef({ kind: "event", id: e.id })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-card active:bg-dark-card-hover text-left transition-colors"
                    style={{ borderLeft: `3px solid hsl(${period.color})` }}
                  >
                    <span className="text-xl flex-shrink-0">{e.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{e.name}</p>
                      <p className="text-[11px] text-dark-muted line-clamp-1">{e.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-dark-muted flex-shrink-0">
                      {e.year < 0 ? `${Math.abs(e.year)}aC` : `${e.year}dC`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : tab === "places" ? (
            <div className="p-4 grid grid-cols-2 gap-2">
              {PLACES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openRef({ kind: "place", id: p.id })}
                  className="p-3 rounded-xl bg-dark-card active:bg-dark-card-hover text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-sm font-bold truncate">{p.name}</p>
                  </div>
                  <p className="text-[11px] text-dark-muted line-clamp-2">{p.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BOOKS.map((b) => {
                const period = PERIODS.find((p) => p.id === b.periodId);
                const color = period?.color ?? "217 91% 60%";
                return (
                  <button
                    key={b.id}
                    onClick={() => openRef({ kind: "book", id: b.id })}
                    className="p-3 rounded-xl text-left transition-transform active:scale-[0.98]"
                    style={{
                      background: "hsl(var(--dark-card))",
                      borderLeft: `3px solid hsl(${color})`,
                    }}
                  >
                    <p className="text-sm font-bold text-dark-text truncate">📖 {b.name}</p>
                    {b.theme && <p className="text-[11px] text-dark-muted line-clamp-2 mt-0.5">{b.theme}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail overlay */}
        <Sheet open={!!nav.current} onOpenChange={(v) => !v && nav.reset()}>
          <SheetContent side="bottom" className="h-[100dvh] p-0 bg-background border-0 overflow-y-auto">
            {nav.current && (
              <EntityDetail
                target={nav.current}
                onBack={nav.canBack ? back : undefined}
                onClose={() => nav.reset()}
                onNavigate={openRef}
              />
            )}
          </SheetContent>
        </Sheet>
      </SheetContent>
    </Sheet>
  );
};

function tagFor(k: string) {
  return k === "character" ? "Personagem" : k === "event" ? "Evento" : k === "place" ? "Lugar" : k === "book" ? "Livro" : "Período";
}

export default HistoriaVivaHub;
