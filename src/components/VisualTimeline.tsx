import { useState, useMemo, useRef, useEffect } from "react";
import { History, X, ChevronRight, BookOpen, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBackHandler } from "@/hooks/useBackHandler";
import { BIBLE_TIMELINE, type TimelineEra, type TimelineEvent } from "@/data/bibleTimeline";

interface Props {
  onNavigateReference?: (reference: string) => void;
  onCharacterClick?: (name: string) => void;
}

const VisualTimeline = ({ onNavigateReference, onCharacterClick }: Props) => {
  const [open, setOpen] = useState(false);
  const [activeEraId, setActiveEraId] = useState<string>(BIBLE_TIMELINE[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eraRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useBackHandler(open, () => setOpen(false));

  const eras = useMemo(() => BIBLE_TIMELINE, []);

  // Highlight active era while scrolling
  useEffect(() => {
    if (!open) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const handler = () => {
      const scrollTop = scroller.scrollTop;
      let current = eras[0].id;
      for (const era of eras) {
        const el = eraRefs.current[era.id];
        if (el && el.offsetTop - 120 <= scrollTop) current = era.id;
      }
      setActiveEraId(current);
    };
    scroller.addEventListener("scroll", handler, { passive: true });
    return () => scroller.removeEventListener("scroll", handler);
  }, [open, eras]);

  const jumpToEra = (id: string) => {
    const el = eraRefs.current[id];
    const scroller = scrollRef.current;
    if (el && scroller) {
      scroller.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Linha do Tempo Bíblica"
        aria-label="Linha do Tempo Bíblica"
        className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center hover:bg-dark-card-hover transition-colors"
      >
        <History className="w-4 h-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[92vh] rounded-t-[2rem] p-0 flex flex-col border-0 [&>button.absolute]:hidden"
          style={{ background: "linear-gradient(180deg, hsl(var(--dark-bg)) 0%, hsl(var(--dark-card) / 0.4) 100%)" }}
        >
          <SheetHeader className="relative px-5 pt-5 pb-4 flex-shrink-0 border-b border-[hsl(var(--dark-card-hover))]">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[hsl(var(--dark-muted)/0.3)]" />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_2px_12px_rgba(245,158,11,0.3)]">
                  <History className="w-[18px] h-[18px] text-amber-950" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))] text-left">
                    Linha do Tempo Bíblica
                  </SheetTitle>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest">
                    Da Criação ao Apocalipse
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl bg-[hsl(var(--dark-card))]"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
              </button>
            </div>
          </SheetHeader>

          {/* Era chips (horizontal quick nav) */}
          <div className="flex-shrink-0 overflow-x-auto scrollbar-none border-b border-[hsl(var(--dark-card-hover))]">
            <div className="flex gap-2 px-5 py-3 min-w-max">
              {eras.map((era) => {
                const active = era.id === activeEraId;
                return (
                  <button
                    key={era.id}
                    onClick={() => jumpToEra(era.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
                    style={{
                      background: active ? `hsl(${era.color} / 0.25)` : "hsl(var(--dark-card))",
                      color: active ? `hsl(${era.color})` : "hsl(var(--dark-muted))",
                      border: active ? `1px solid hsl(${era.color} / 0.5)` : "1px solid transparent",
                    }}
                  >
                    <span>{era.icon}</span>
                    <span>{era.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable timeline */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
            <div className="relative max-w-2xl mx-auto">
              {eras.map((era) => (
                <EraBlock
                  key={era.id}
                  era={era}
                  onRef={(el) => (eraRefs.current[era.id] = el)}
                  onNavigateReference={(ref) => {
                    onNavigateReference?.(ref);
                    setOpen(false);
                  }}
                  onCharacterClick={onCharacterClick}
                />
              ))}
              <p className="text-center text-[10px] text-[hsl(var(--dark-muted)/0.6)] mt-8 pb-4">
                ✨ Linha do Tempo • Bíblia do Atalaia
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

interface EraBlockProps {
  era: TimelineEra;
  onRef: (el: HTMLDivElement | null) => void;
  onNavigateReference: (reference: string) => void;
  onCharacterClick?: (name: string) => void;
}

const EraBlock = ({ era, onRef, onNavigateReference, onCharacterClick }: EraBlockProps) => {
  return (
    <div ref={onRef} className="mb-10">
      {/* Era header */}
      <div
        className="sticky top-0 z-10 -mx-5 px-5 py-3 mb-4 backdrop-blur-md"
        style={{ background: `linear-gradient(180deg, hsl(var(--dark-bg)) 60%, transparent 100%)` }}
      >
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(${era.color} / 0.2) 0%, hsl(${era.color} / 0.05) 100%)`,
            border: `1px solid hsl(${era.color} / 0.3)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: `hsl(${era.color} / 0.2)` }}
            >
              {era.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[hsl(var(--dark-text))] leading-tight">{era.name}</h3>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: `hsl(${era.color})` }}>
                {era.period}
              </p>
            </div>
          </div>
          <p className="text-[12px] text-[hsl(var(--dark-muted))] leading-relaxed mt-3">{era.summary}</p>
        </div>
      </div>

      {/* Events */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div
          className="absolute left-[9px] top-2 bottom-2 w-[2px] rounded-full"
          style={{ background: `linear-gradient(180deg, hsl(${era.color} / 0.6) 0%, hsl(${era.color} / 0.1) 100%)` }}
        />
        {era.events.map((event, idx) => (
          <EventCard
            key={idx}
            event={event}
            color={era.color}
            onNavigateReference={onNavigateReference}
            onCharacterClick={onCharacterClick}
          />
        ))}
      </div>
    </div>
  );
};

interface EventCardProps {
  event: TimelineEvent;
  color: string;
  onNavigateReference: (reference: string) => void;
  onCharacterClick?: (name: string) => void;
}

const EventCard = ({ event, color, onNavigateReference, onCharacterClick }: EventCardProps) => {
  return (
    <div className="relative mb-4">
      {/* Dot */}
      <div
        className="absolute -left-[22px] top-3 w-3 h-3 rounded-full ring-4"
        style={{
          background: `hsl(${color})`,
          boxShadow: `0 0 12px hsl(${color} / 0.6)`,
        }}
      />
      <div
        className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors"
        style={{ border: `1px solid hsl(${color} / 0.15)` }}
      >
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(${color})` }}>
            {event.year}
          </span>
        </div>
        <h4 className="text-[14px] font-bold text-[hsl(var(--dark-text))] leading-tight mb-1.5">{event.title}</h4>
        <p className="text-[12px] text-[hsl(var(--dark-muted))] leading-relaxed">{event.description}</p>

        {/* Characters */}
        {event.characters && event.characters.length > 0 && (
          <div className="mt-3 flex items-start gap-1.5 flex-wrap">
            <Users className="w-3 h-3 text-[hsl(var(--dark-muted))] mt-1 flex-shrink-0" />
            {event.characters.map((char) => (
              <button
                key={char}
                onClick={() => onCharacterClick?.(char)}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `hsl(${color} / 0.15)`,
                  color: `hsl(${color})`,
                  border: `1px solid hsl(${color} / 0.3)`,
                }}
              >
                {char}
              </button>
            ))}
          </div>
        )}

        {/* Reference */}
        {event.reference && event.reference !== "—" && (
          <button
            onClick={() => onNavigateReference(event.reference!)}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--dark-text))] hover:opacity-80 transition-opacity group"
          >
            <BookOpen className="w-3 h-3" style={{ color: `hsl(${color})` }} />
            <span>{event.reference}</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
};

export default VisualTimeline;