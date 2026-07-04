import { useEffect, useMemo, useRef, useState } from "react";
import { History, BookOpen, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { BIBLE_TIMELINE } from "@/data/bibleTimeline";
import StageShell from "./StageShell";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigateReference: (ref: string) => void;
  onOpenCharacter: (name: string) => void;
}

const TimelineStage = ({
  open,
  onOpenChange,
  onNavigateReference,
  onOpenCharacter,
}: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const eraRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [currentEraIdx, setCurrentEraIdx] = useState(0);

  const eras = BIBLE_TIMELINE;
  const currentEra = eras[currentEraIdx];

  // Detect current era while scrolling horizontally.
  useEffect(() => {
    if (!open) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const handler = () => {
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      eras.forEach((era, idx) => {
        const el = eraRefs.current[era.id];
        if (!el) return;
        const middle = el.offsetLeft + el.offsetWidth / 2;
        const d = Math.abs(middle - center);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      setCurrentEraIdx(bestIdx);
    };
    handler();
    scroller.addEventListener("scroll", handler, { passive: true });
    return () => scroller.removeEventListener("scroll", handler);
  }, [open, eras]);

  const scrollToEra = (idx: number) => {
    const era = eras[idx];
    if (!era) return;
    const el = eraRefs.current[era.id];
    if (!el || !scrollerRef.current) return;
    scrollerRef.current.scrollTo({
      left: el.offsetLeft - 16,
      behavior: "smooth",
    });
  };

  const totalEvents = useMemo(
    () => eras.reduce((sum, e) => sum + e.events.length, 0),
    [eras]
  );

  return (
    <StageShell
      open={open}
      onOpenChange={onOpenChange}
      title="Linha do Tempo"
      subtitle={`${eras.length} eras · ${totalEvents} eventos`}
      accentColor={currentEra?.color}
      headerIcon={<History className="w-5 h-5 text-white" />}
      headerRight={
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => scrollToEra(Math.max(0, currentEraIdx - 1))}
            className="p-2 rounded-xl bg-[hsl(var(--dark-card))]"
            aria-label="Era anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollToEra(Math.min(eras.length - 1, currentEraIdx + 1))}
            className="p-2 rounded-xl bg-[hsl(var(--dark-card))]"
            aria-label="Próxima era"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {/* Era hero */}
        <div
          className="flex-shrink-0 px-5 py-4 border-b border-[hsl(var(--dark-card-hover))] transition-colors duration-500"
          style={{
            background: `linear-gradient(180deg, hsl(${currentEra?.color} / 0.22) 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: `hsl(${currentEra?.color})` }}
              >
                Era {currentEraIdx + 1} de {eras.length}
              </p>
              <h2 className="text-xl font-black text-[hsl(var(--dark-text))] mt-1 flex items-center gap-2">
                <span className="text-2xl">{currentEra?.icon}</span>
                <span>{currentEra?.name}</span>
              </h2>
              <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">
                {currentEra?.period}
              </p>
            </div>
          </div>
          <p className="text-[12px] text-[hsl(var(--dark-muted))] mt-2 leading-relaxed">
            {currentEra?.summary}
          </p>
        </div>

        {/* Horizontal scroller */}
        <div
          ref={scrollerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden scroll-smooth"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex h-full items-stretch">
            {eras.map((era) => (
              <div
                key={era.id}
                ref={(el) => (eraRefs.current[era.id] = el)}
                className="flex-shrink-0 h-full flex flex-col px-5 py-4"
                style={{ scrollSnapAlign: "start", width: "min(88vw, 480px)" }}
              >
                {/* Era column header (colored strip) */}
                <div
                  className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
                  style={{
                    background: `linear-gradient(135deg, hsl(${era.color} / 0.3) 0%, hsl(${era.color} / 0.05) 100%)`,
                    border: `1px solid hsl(${era.color} / 0.35)`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, hsl(${era.color}) 0%, hsl(${era.color} / 0.6) 100%)`,
                    }}
                  >
                    {era.icon}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: `hsl(${era.color})` }}
                    >
                      {era.period}
                    </p>
                    <h3 className="text-sm font-bold text-[hsl(var(--dark-text))] leading-tight truncate">
                      {era.name}
                    </h3>
                  </div>
                </div>
                {/* Events */}
                <ol className="relative pl-5 border-l-2 space-y-3 flex-1 overflow-y-auto pb-6"
                  style={{ borderColor: `hsl(${era.color} / 0.35)` }}
                >
                  {era.events.map((ev, i) => (
                    <li
                      key={i}
                      className="relative rounded-2xl p-3 bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors"
                      style={{ border: `1px solid hsl(${era.color} / 0.18)` }}
                    >
                      <span
                        className="absolute -left-[27px] top-3 w-3 h-3 rounded-full ring-4 ring-[hsl(var(--dark-bg))]"
                        style={{ background: `hsl(${era.color})` }}
                      />
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: `hsl(${era.color})` }}
                      >
                        {ev.year}
                      </p>
                      <h4 className="text-[14px] font-bold text-[hsl(var(--dark-text))] leading-tight mt-0.5">
                        {ev.title}
                      </h4>
                      <p className="text-[12px] text-[hsl(var(--dark-muted))] leading-snug mt-1">
                        {ev.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ev.reference && (
                          <button
                            onClick={() => onNavigateReference(ev.reference!)}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
                            style={{
                              background: `linear-gradient(135deg, hsl(${era.color}) 0%, hsl(${era.color} / 0.7) 100%)`,
                            }}
                          >
                            <BookOpen className="w-3 h-3" />
                            {ev.reference}
                          </button>
                        )}
                        {ev.characters?.slice(0, 3).map((name) => (
                          <button
                            key={name}
                            onClick={() => onOpenCharacter(name)}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-bg))] transition-colors"
                          >
                            <Users className="w-3 h-3" style={{ color: `hsl(${era.color})` }} />
                            {name}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>

        {/* Mini map footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))]">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {eras.map((era, idx) => {
              const active = idx === currentEraIdx;
              return (
                <button
                  key={era.id}
                  onClick={() => scrollToEra(idx)}
                  className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold whitespace-nowrap transition-all"
                  style={{
                    background: active
                      ? `hsl(${era.color} / 0.25)`
                      : "hsl(var(--dark-card))",
                    color: active
                      ? `hsl(${era.color})`
                      : "hsl(var(--dark-muted))",
                    border: active
                      ? `1px solid hsl(${era.color} / 0.5)`
                      : "1px solid transparent",
                  }}
                >
                  {era.icon} {era.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </StageShell>
  );
};

export default TimelineStage;