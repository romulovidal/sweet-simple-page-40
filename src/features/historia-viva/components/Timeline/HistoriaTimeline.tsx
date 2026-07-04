import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PERIODS, formatYear } from "../../data/periods";
import { EVENTS } from "../../data/events";
import type { HistoriaEvent, Period } from "../../types";
import { ChevronDown, ChevronUp, ZoomIn, ZoomOut } from "lucide-react";
import Chip from "../shared/Chip";

interface Props {
  onOpenEvent: (id: string) => void;
  onOpenPeriod?: (id: string) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const BASE_YEAR_PX = 0.35; // pixels per year at zoom 1

const HistoriaTimeline = ({ onOpenEvent, onOpenPeriod }: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [activePeriod, setActivePeriod] = useState<Period["id"]>("principio");

  const totalStart = Math.min(...PERIODS.map((p) => p.startYear));
  const totalEnd = Math.max(...PERIODS.map((p) => p.endYear));
  const pxPerYear = BASE_YEAR_PX * zoom;
  const totalWidth = (totalEnd - totalStart) * pxPerYear;

  const yearToX = useCallback(
    (year: number) => (year - totalStart) * pxPerYear,
    [totalStart, pxPerYear]
  );

  const goToPeriod = useCallback(
    (p: Period) => {
      const el = scrollerRef.current;
      if (!el) return;
      const center = yearToX((p.startYear + p.endYear) / 2);
      el.scrollTo({ left: center - el.clientWidth / 2, behavior: "smooth" });
      setActivePeriod(p.id);
    },
    [yearToX]
  );

  // Ctrl+wheel and pinch to zoom
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.005)));
      }
    };

    let pinchStart = 0;
    let pinchZoom = 1;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStart = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchZoom = zoom;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchZoom * (d / pinchStart))));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [zoom]);

  // Track active period on scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      const year = totalStart + center / pxPerYear;
      const p = PERIODS.find((pp) => year >= pp.startYear && year <= pp.endYear);
      if (p) setActivePeriod(p.id);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pxPerYear, totalStart]);

  const [showLegend, setShowLegend] = useState(true);

  return (
    <div className="w-full">
      {/* Period quick nav */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 flex-1 no-scrollbar">
          {PERIODS.map((p) => (
            <Chip
              key={p.id}
              color={p.color}
              active={p.id === activePeriod}
              onClick={() => goToPeriod(p)}
              aria-label={`Ir para ${p.name}`}
            >
              <span>{p.icon}</span>
              {p.name}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.25))}
            aria-label="Diminuir zoom"
            className="w-8 h-8 rounded-lg bg-dark-card flex items-center justify-center"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
            aria-label="Aumentar zoom"
            className="w-8 h-8 rounded-lg bg-dark-card flex items-center justify-center"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scroller */}
      <div
        ref={scrollerRef}
        className="relative overflow-x-auto overflow-y-hidden touch-pan-x cursor-grab active:cursor-grabbing"
        style={{ scrollBehavior: "smooth" }}
        role="region"
        aria-label="Linha do tempo bíblica horizontal"
      >
        <div className="relative" style={{ width: totalWidth, height: 320 }}>
          {/* Central axis */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-dark-card-hover" />

          {/* Period bands */}
          {PERIODS.map((p, idx) => {
            const x1 = yearToX(p.startYear);
            const x2 = yearToX(p.endYear);
            const width = Math.max(x2 - x1, 60);
            const isTop = idx % 2 === 0;
            return (
              <div
                key={p.id}
                className="absolute"
                style={{ left: x1, top: isTop ? 12 : 190, width, height: 118 }}
              >
                <button
                  onClick={() => onOpenPeriod?.(p.id)}
                  className="w-full h-full rounded-2xl px-3 py-2 text-left overflow-hidden relative active:scale-[0.98] transition-transform bg-dark-card border border-dark-card-hover hover:border-primary/60"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-base">{p.icon}</span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                      {p.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-dark-muted line-clamp-2 leading-tight">{p.subtitle}</p>
                  <p className="absolute bottom-1 right-2 text-[9px] font-mono text-dark-muted">
                    {formatYear(p.startYear)} → {formatYear(p.endYear)}
                  </p>
                </button>
              </div>
            );
          })}

          {/* Event markers */}
          {EVENTS.map((e) => {
            const x = yearToX(e.year);
            return (
              <button
                key={e.id}
                onClick={() => onOpenEvent(e.id)}
                className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 group"
                style={{ left: x }}
                aria-label={`Evento: ${e.name}, ${formatYear(e.year)}`}
              >
                <div
                  className="w-3 h-3 rounded-full ring-4 ring-background transition-transform group-hover:scale-150 bg-primary"
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-4 whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus:opacity-100 pointer-events-none transition-opacity text-dark-text"
                >
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-dark-card border border-dark-card-hover shadow">
                    {e.icon} {e.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom hint */}
      <p className="px-4 pt-1 pb-2 text-[10px] text-dark-muted">
        {navigator.maxTouchPoints > 0 ? "Pinça para dar zoom · arraste para navegar" : "Ctrl + scroll para zoom · arraste para navegar"}
      </p>
    </div>
  );
};

export default HistoriaTimeline;
