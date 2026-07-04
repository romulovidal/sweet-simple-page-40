import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Search,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  Sparkles,
} from "lucide-react";
import { useBackHandler } from "@/hooks/useBackHandler";
import {
  BIBLE_CHARACTERS,
  type BibleCharacter,
  type CharacterCategory,
} from "@/data/bibleCharacters";
import StageShell from "./StageShell";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigateReference: (ref: string) => void;
  initialCharacterId?: string;
}

const CATEGORY_LABELS: Record<CharacterCategory | "todos", string> = {
  todos: "Todos",
  jesus: "Jesus",
  patriarca: "Patriarcas",
  lider: "Líderes",
  profeta: "Profetas",
  rei: "Reis",
  apostolo: "Apóstolos",
  outro: "Outros",
};

const CATEGORY_ORDER: (CharacterCategory | "todos")[] = [
  "todos",
  "jesus",
  "patriarca",
  "lider",
  "profeta",
  "rei",
  "apostolo",
  "outro",
];

/** Build a first-person script from bio if the character has none. */
function getPresentation(c: BibleCharacter): string[] {
  if (c.presentation && c.presentation.length > 0) return c.presentation;
  // Fallback: opening line + bio broken into sentences.
  const sentences = c.bio.split(/(?<=[.!?])\s+/).filter(Boolean);
  return [`Sou ${c.name}.`, ...sentences];
}

/** Typewriter effect for a single string. Respects reduced motion. */
function useTypewriter(text: string, active: boolean, speed = 22) {
  const [output, setOutput] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setOutput(text);
      setDone(true);
      return;
    }
    setOutput("");
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOutput(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => window.clearInterval(id);
  }, [text, active, speed]);
  return { output, done };
}

const CharacterStage = ({
  open,
  onOpenChange,
  onNavigateReference,
  initialCharacterId,
}: Props) => {
  const [filter, setFilter] = useState<CharacterCategory | "todos">("todos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const portraitRef = useRef<HTMLDivElement>(null);

  // Apply initial selection when opened
  useEffect(() => {
    if (open && initialCharacterId) {
      setSelectedId(initialCharacterId);
      setSlideIdx(0);
    }
  }, [open, initialCharacterId]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setSlideIdx(0);
      setSearch("");
    }
  }, [open]);

  useBackHandler(open, () => {
    if (selectedId) setSelectedId(null);
    else onOpenChange(false);
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return BIBLE_CHARACTERS.filter((c) => {
      if (filter !== "todos" && c.category !== filter) return false;
      if (!s) return true;
      return (
        c.name.toLowerCase().includes(s) ||
        c.aka?.some((a) => a.toLowerCase().includes(s))
      );
    });
  }, [filter, search]);

  const selected = useMemo(
    () => BIBLE_CHARACTERS.find((c) => c.id === selectedId) || null,
    [selectedId]
  );

  const script = useMemo(
    () => (selected ? getPresentation(selected) : []),
    [selected]
  );
  const currentLine = script[slideIdx] || "";
  const { output, done } = useTypewriter(currentLine, !!selected && !paused, 24);

  // Auto-advance after each line finishes typing (with reading pause)
  useEffect(() => {
    if (!selected || paused || !done) return;
    if (slideIdx >= script.length - 1) return;
    const wait = Math.min(3500, 1200 + currentLine.length * 22);
    const id = window.setTimeout(() => setSlideIdx((i) => i + 1), wait);
    return () => window.clearTimeout(id);
  }, [done, paused, selected, slideIdx, script.length, currentLine.length]);

  // Reset slide index when character changes
  useEffect(() => {
    setSlideIdx(0);
    setPaused(false);
  }, [selectedId]);

  // Parallax on pointer move (desktop)
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = portraitRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setParallax({ x, y });
  }, []);
  const onPointerLeave = useCallback(() => setParallax({ x: 0, y: 0 }), []);

  const goPrevChar = () => {
    if (!selected) return;
    const idx = filtered.findIndex((c) => c.id === selected.id);
    if (idx > 0) setSelectedId(filtered[idx - 1].id);
  };
  const goNextChar = () => {
    if (!selected) return;
    const idx = filtered.findIndex((c) => c.id === selected.id);
    if (idx >= 0 && idx < filtered.length - 1) setSelectedId(filtered[idx + 1].id);
  };

  const askAI = (char: BibleCharacter) => {
    const question = `Quem foi ${char.name} na Bíblia? Fale sobre sua vida, seu papel na história da salvação e o que podemos aprender com ele.`;
    window.dispatchEvent(
      new CustomEvent("open-ask-bible", { detail: { prefill: question } })
    );
    onOpenChange(false);
  };

  return (
    <StageShell
      open={open}
      onOpenChange={onOpenChange}
      title={selected ? selected.name : "Personagens Bíblicos"}
      subtitle={selected ? selected.role : `${BIBLE_CHARACTERS.length} perfis · Vidas que falam`}
      accentColor={selected?.color}
      headerIcon={
        selected ? (
          <span className="text-lg">{selected.icon}</span>
        ) : (
          <Users className="w-5 h-5 text-white" />
        )
      }
      onBack={selected ? () => setSelectedId(null) : undefined}
    >
      {!selected ? (
        <div className="h-full flex flex-col">
          {/* Search */}
          <div className="flex-shrink-0 px-5 pt-3 pb-2 lg:max-w-7xl lg:mx-auto lg:w-full lg:px-8 lg:pt-6">
            <div className="relative lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar personagem..."
                className="w-full bg-[hsl(var(--dark-card))] rounded-xl pl-10 pr-4 py-2.5 lg:py-3 text-sm text-[hsl(var(--dark-text))] placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          {/* Categories */}
          <div className="flex-shrink-0 overflow-x-auto scrollbar-none border-b border-[hsl(var(--dark-card-hover))] lg:overflow-visible">
            <div className="flex gap-2 px-5 py-3 min-w-max lg:min-w-0 lg:flex-wrap lg:max-w-7xl lg:mx-auto lg:w-full lg:px-8 lg:py-4">
              {CATEGORY_ORDER.map((cat) => {
                const active = filter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
                    style={{
                      background: active
                        ? "hsl(var(--primary) / 0.2)"
                        : "hsl(var(--dark-card))",
                      color: active
                        ? "hsl(var(--primary))"
                        : "hsl(var(--dark-muted))",
                      border: active
                        ? "1px solid hsl(var(--primary) / 0.5)"
                        : "1px solid transparent",
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4 lg:px-8 lg:py-6">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-[hsl(var(--dark-muted))] mt-8">
                Nenhum personagem encontrado.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-4 lg:max-w-7xl lg:mx-auto">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="group relative text-left rounded-2xl p-3 lg:p-4 bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-all active:scale-[0.98] hover:-translate-y-0.5 overflow-hidden"
                    style={{ border: `1px solid hsl(${c.color} / 0.2)` }}
                  >
                    <div
                      className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity"
                      style={{ background: `hsl(${c.color} / 0.5)` }}
                    />
                    <div className="relative flex items-center gap-2 lg:gap-3 mb-2 lg:mb-3">
                      <div
                        className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center text-lg lg:text-xl flex-shrink-0 shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, hsl(${c.color}) 0%, hsl(${c.color} / 0.5) 100%)`,
                        }}
                      >
                        {c.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] lg:text-sm font-bold text-[hsl(var(--dark-text))] leading-tight truncate">
                          {c.name}
                        </h4>
                        <p
                          className="text-[9px] lg:text-[10px] uppercase tracking-wider font-semibold truncate"
                          style={{ color: `hsl(${c.color})` }}
                        >
                          {CATEGORY_LABELS[c.category]}
                        </p>
                      </div>
                    </div>
                    <p className="relative text-[10px] lg:text-xs text-[hsl(var(--dark-muted))] leading-snug line-clamp-2 lg:line-clamp-3">
                      {c.role}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── Presentation ─── */
        <div className="h-full flex flex-col">
          {/* Progress bar (stories) */}
          <div className="flex-shrink-0 flex gap-1 px-4 pt-3 pb-2">
            {script.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[3px] rounded-full overflow-hidden bg-[hsl(var(--dark-card-hover))]"
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width:
                      i < slideIdx
                        ? "100%"
                        : i === slideIdx
                          ? done
                            ? "100%"
                            : `${Math.min(100, (output.length / Math.max(1, currentLine.length)) * 100)}%`
                          : "0%",
                    background: `hsl(${selected.color})`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Portrait stage */}
            <div
              ref={portraitRef}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              className="relative mx-4 mt-2 rounded-3xl overflow-hidden aspect-[4/5] max-h-[440px] flex items-center justify-center select-none"
              style={{
                background: `radial-gradient(120% 100% at 50% 20%, hsl(${selected.color} / 0.35) 0%, hsl(var(--dark-bg)) 70%)`,
                border: `1px solid hsl(${selected.color} / 0.35)`,
              }}
            >
              {/* Ambient shapes */}
              <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at ${50 + parallax.x * 20}% ${30 + parallax.y * 15}%, hsl(${selected.color} / 0.55) 0%, transparent 55%)`,
                  transition: "background 200ms ease-out",
                }}
              />
              <div
                className="absolute -inset-8 pointer-events-none opacity-30"
                style={{
                  background: `conic-gradient(from ${slideIdx * 45}deg at 50% 50%, transparent 0%, hsl(${selected.color} / 0.4) 20%, transparent 40%, hsl(${selected.color} / 0.4) 60%, transparent 80%)`,
                  filter: "blur(40px)",
                  transition: "background 800ms ease-out",
                }}
              />
              {/* Portrait avatar */}
              <div
                className="relative flex items-center justify-center"
                style={{
                  transform: `translate3d(${parallax.x * -10}px, ${parallax.y * -8}px, 0) scale(1.02)`,
                  transition: "transform 200ms ease-out",
                }}
              >
                <div
                  className="w-40 h-40 sm:w-52 sm:h-52 rounded-full flex items-center justify-center shadow-2xl"
                  style={{
                    background: `linear-gradient(135deg, hsl(${selected.color}) 0%, hsl(${selected.color} / 0.4) 100%)`,
                    boxShadow: `0 20px 60px -20px hsl(${selected.color} / 0.7), inset 0 0 40px hsl(${selected.color} / 0.4)`,
                  }}
                >
                  <span className="text-6xl sm:text-7xl drop-shadow-lg">
                    {selected.icon}
                  </span>
                </div>
                {/* Ring */}
                <div
                  className="absolute inset-[-14px] rounded-full pointer-events-none"
                  style={{
                    border: `2px dashed hsl(${selected.color} / 0.5)`,
                    animation: "spin 30s linear infinite",
                  }}
                />
              </div>
              {/* Nameplate */}
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: `hsl(${selected.color})` }}
                >
                  {selected.era}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-[hsl(var(--dark-text))] leading-tight mt-1">
                  {selected.name}
                </h2>
                {selected.aka && selected.aka.length > 0 && (
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">
                    Também: {selected.aka.join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Speech bubble */}
            <div className="mx-4 mt-3">
              <div
                className="relative rounded-2xl p-4 min-h-[110px]"
                style={{
                  background: `linear-gradient(180deg, hsl(${selected.color} / 0.12) 0%, hsl(var(--dark-card)) 100%)`,
                  border: `1px solid hsl(${selected.color} / 0.3)`,
                }}
              >
                <div
                  className="absolute -top-2 left-8 w-4 h-4 rotate-45"
                  style={{
                    background: `hsl(${selected.color} / 0.2)`,
                    borderTop: `1px solid hsl(${selected.color} / 0.3)`,
                    borderLeft: `1px solid hsl(${selected.color} / 0.3)`,
                  }}
                />
                <p className="text-[15px] leading-relaxed text-[hsl(var(--dark-text))] font-medium">
                  “{output}
                  {!done && (
                    <span
                      className="inline-block w-[2px] h-[1em] align-middle ml-0.5 animate-pulse"
                      style={{ background: `hsl(${selected.color})` }}
                    />
                  )}
                  {done && "”"}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="mx-4 mt-3 flex items-center gap-2">
              <button
                onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                disabled={slideIdx === 0}
                className="p-3 rounded-xl bg-[hsl(var(--dark-card))] disabled:opacity-30"
                aria-label="Fala anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPaused((p) => !p)}
                className="p-3 rounded-xl bg-[hsl(var(--dark-card))]"
                aria-label={paused ? "Continuar" : "Pausar"}
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  setSlideIdx(0);
                  setPaused(false);
                }}
                className="p-3 rounded-xl bg-[hsl(var(--dark-card))]"
                aria-label="Recomeçar"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (slideIdx < script.length - 1) setSlideIdx((i) => i + 1);
                  else goNextChar();
                }}
                className="flex-1 px-4 py-3 rounded-xl text-[13px] font-semibold text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, hsl(${selected.color}) 0%, hsl(${selected.color} / 0.7) 100%)`,
                }}
              >
                {slideIdx < script.length - 1 ? "Próxima fala" : "Próximo personagem"}
              </button>
            </div>

            {/* Bio */}
            <div className="mx-4 mt-5 rounded-2xl p-4 bg-[hsl(var(--dark-card))]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-2">
                Quem foi
              </p>
              <p className="text-[13px] text-[hsl(var(--dark-text))] leading-relaxed">
                {selected.bio}
              </p>
              <button
                onClick={() => askAI(selected)}
                className="mt-3 flex items-center gap-2 text-[12px] font-semibold"
                style={{ color: `hsl(${selected.color})` }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Perguntar à IA sobre {selected.name}
              </button>
            </div>

            {/* Moments */}
            <div className="mx-4 mt-4">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-3 px-1">
                <Clock className="w-3 h-3" />
                Momentos marcantes
              </h3>
              <ol
                className="relative border-l-2 space-y-3 pl-4"
                style={{ borderColor: `hsl(${selected.color} / 0.35)` }}
              >
                {selected.moments.map((m, idx) => (
                  <li key={idx} className="relative">
                    <span
                      className="absolute -left-[22px] top-1 w-3 h-3 rounded-full ring-4 ring-[hsl(var(--dark-bg))]"
                      style={{ background: `hsl(${selected.color})` }}
                    />
                    {m.year && (
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: `hsl(${selected.color})` }}
                      >
                        {m.year}
                      </p>
                    )}
                    <h4 className="text-[13px] font-bold text-[hsl(var(--dark-text))] leading-tight mt-0.5">
                      {m.title}
                    </h4>
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-snug mt-1">
                      {m.description}
                    </p>
                    {m.reference && (
                      <button
                        onClick={() => onNavigateReference(m.reference!)}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--dark-text))] hover:opacity-80 group"
                      >
                        <BookOpen
                          className="w-3 h-3"
                          style={{ color: `hsl(${selected.color})` }}
                        />
                        <span>{m.reference}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Verses */}
            <div className="mx-4 mt-5 mb-6">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-3 px-1">
                <BookOpen className="w-3 h-3" />
                Versículos-chave
              </h3>
              <ul className="space-y-2">
                {selected.keyVerses.map((v, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => onNavigateReference(v.reference)}
                      className="w-full text-left rounded-xl p-3 bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors group"
                      style={{ border: `1px solid hsl(${selected.color} / 0.15)` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-[hsl(var(--dark-text))]">
                          {v.reference}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-snug mt-1">
                        {v.note}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Character nav footer */}
            <div className="mx-4 mb-6 flex items-center gap-2">
              <button
                onClick={goPrevChar}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-[hsl(var(--dark-card))] text-[12px] font-semibold text-[hsl(var(--dark-muted))]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
              <button
                onClick={goNextChar}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-[hsl(var(--dark-card))] text-[12px] font-semibold text-[hsl(var(--dark-muted))]"
              >
                Próximo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </StageShell>
  );
};

export default CharacterStage;