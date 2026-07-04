import { useMemo, useState } from "react";
import { CHARACTERS } from "../../data/characters";
import { EVENTS } from "../../data/events";
import { PERIODS, formatYear } from "../../data/periods";
import type { EntityRef } from "../../types";
import Chip from "../shared/Chip";

interface Props {
  onNavigate: (ref: EntityRef) => void;
}

type Lane = "reis" | "profetas" | "sacerdotes" | "eventos";

const LANES: { id: Lane; label: string; icon: string; color: string }[] = [
  { id: "reis", label: "Reis", icon: "👑", color: "38 92% 50%" },
  { id: "profetas", label: "Profetas", icon: "📖", color: "271 76% 62%" },
  { id: "sacerdotes", label: "Sacerdotes/Líderes", icon: "🕎", color: "142 60% 45%" },
  { id: "eventos", label: "Eventos", icon: "✨", color: "38 92% 55%" },
];

const START = -2200;
const END = 100;
const YEAR_PX = 0.5;

const ParallelsView = ({ onNavigate }: Props) => {
  const [activeLanes, setActiveLanes] = useState<Lane[]>(["reis", "profetas", "eventos"]);
  const totalWidth = (END - START) * YEAR_PX;

  const items = useMemo(() => {
    const byLane: Record<Lane, Array<{ id: string; name: string; icon: string; year: number; color: string; kind: "character" | "event" }>> = {
      reis: [], profetas: [], sacerdotes: [], eventos: [],
    };
    for (const c of CHARACTERS) {
      const period = PERIODS.find((p) => p.id === c.periodId);
      const col = c.color ?? period?.color ?? "217 91% 60%";
      if (c.tags.includes("rei")) byLane.reis.push({ id: c.id, name: c.name, icon: c.icon, year: c.year, color: col, kind: "character" });
      if (c.tags.includes("profeta")) byLane.profetas.push({ id: c.id, name: c.name, icon: c.icon, year: c.year, color: col, kind: "character" });
      if (c.tags.includes("sacerdote") || c.tags.includes("juiz") || c.tags.includes("lider"))
        byLane.sacerdotes.push({ id: c.id, name: c.name, icon: c.icon, year: c.year, color: col, kind: "character" });
    }
    for (const e of EVENTS) {
      const period = PERIODS.find((p) => p.id === e.periodId);
      byLane.eventos.push({ id: e.id, name: e.name, icon: e.icon, year: e.year, color: period?.color ?? "217 91% 60%", kind: "event" });
    }
    return byLane;
  }, []);

  const yearToX = (y: number) => (y - START) * YEAR_PX;

  return (
    <div className="w-full">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-2">
        {LANES.map((l) => (
          <Chip
            key={l.id}
            color={l.color}
            active={activeLanes.includes(l.id)}
            onClick={() =>
              setActiveLanes((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]))
            }
          >
            {l.icon} {l.label}
          </Chip>
        ))}
      </div>

      <div className="overflow-x-auto touch-pan-x px-4 pb-6">
        <div className="relative" style={{ width: totalWidth }}>
          {/* Period bands (top) */}
          <div className="relative h-6 mb-2">
            {PERIODS.filter((p) => p.startYear >= START && p.endYear <= END).map((p) => {
              const x1 = yearToX(Math.max(p.startYear, START));
              const x2 = yearToX(Math.min(p.endYear, END));
              return (
                <div
                  key={p.id}
                  className="absolute top-0 h-6 rounded-lg flex items-center px-2 overflow-hidden"
                  style={{
                    left: x1,
                    width: Math.max(x2 - x1, 40),
                    background: `hsl(${p.color} / 0.22)`,
                    border: `1px solid hsl(${p.color} / 0.4)`,
                  }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider truncate text-dark-text">
                    {p.icon} {p.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Year ticks */}
          <div className="relative h-4 mb-1">
            {Array.from({ length: Math.floor((END - START) / 200) + 1 }, (_, i) => {
              const year = START + i * 200;
              const x = yearToX(year);
              return (
                <div key={year} className="absolute top-0" style={{ left: x }}>
                  <div className="w-px h-2 bg-dark-card-hover" />
                  <span className="text-[9px] font-mono text-dark-muted">{formatYear(year)}</span>
                </div>
              );
            })}
          </div>

          {/* Lanes */}
          {LANES.filter((l) => activeLanes.includes(l.id)).map((l) => (
            <div key={l.id} className="relative h-14 mt-2">
              <div
                className="absolute inset-x-0 top-1/2 h-px"
                style={{ background: `hsl(${l.color} / 0.4)` }}
              />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold px-2 py-0.5 rounded"
                style={{
                  background: `hsl(${l.color})`,
                  color: "white",
                  position: "sticky",
                  left: 0,
                }}
              >
                {l.icon} {l.label}
              </div>
              {items[l.id].map((it) => {
                const x = yearToX(it.year);
                return (
                  <button
                    key={`${l.id}-${it.id}`}
                    onClick={() => onNavigate({ kind: it.kind, id: it.id })}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                    style={{ left: x }}
                    aria-label={`${it.name} (${formatYear(it.year)})`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg text-sm transition-transform group-hover:scale-125"
                      style={{
                        background: `hsl(${it.color})`,
                        border: "2px solid hsl(var(--background))",
                      }}
                    >
                      {it.icon}
                    </div>
                    <span
                      className="absolute left-1/2 -translate-x-1/2 top-9 whitespace-nowrap text-[9px] font-semibold px-1 rounded opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: "hsl(var(--background) / 0.95)", color: "hsl(var(--foreground))" }}
                    >
                      {it.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="px-4 pb-2 text-[10px] text-dark-muted">
        Arraste horizontalmente para percorrer os séculos.
      </p>
    </div>
  );
};

export default ParallelsView;
