import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, BookOpen, ChevronRight } from "lucide-react";
import { BIBLE_MAPS, type MapJourney, type MapPoint } from "@/data/bibleMaps";
import StageShell from "./StageShell";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigateReference: (ref: string) => void;
}

// SVG world viewbox spans lat 24..44 and lng 10..50 (Mediterranean + ANE)
const VIEW = { w: 1000, h: 620 };
const BOUNDS = { latMin: 24, latMax: 44, lngMin: 10, lngMax: 50 };

function project([lat, lng]: [number, number]): { x: number; y: number } {
  const x =
    ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * VIEW.w;
  const y =
    ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * VIEW.h;
  return { x, y };
}

/** Stylized hand-drawn continental blobs (rough approximations, not political). */
const LAND_PATHS = [
  // Europe / Balkans / Greece / Italy top
  "M-20,120 Q80,100 180,130 T340,110 Q420,120 500,90 T700,110 L800,140 L820,180 L750,200 L640,190 L560,220 L470,205 L400,240 L330,220 L260,255 L180,240 L120,270 L60,260 L-10,285 Z",
  // Turkey / Asia Minor
  "M540,215 Q640,200 730,215 T900,220 L960,240 L980,275 L900,290 L820,275 L720,290 L620,275 L540,285 Z",
  // Levant + Arabia (narrow strip)
  "M600,300 Q640,295 680,310 L700,340 L720,400 L740,470 L760,540 L720,590 L680,600 L640,580 L620,520 L610,450 L600,380 Z",
  // Egypt / North Africa
  "M120,340 Q200,320 300,340 T500,350 L560,380 L580,430 L560,490 L500,540 L420,555 L320,545 L220,555 L120,545 L60,510 L40,450 L60,390 Z",
  // Mesopotamia (below Turkey, east of Levant)
  "M760,290 Q820,285 880,300 T980,320 L1000,360 L980,410 L940,450 L880,470 L820,455 L780,420 L760,370 Z",
];

const MapStage = ({ open, onOpenChange, onNavigateReference }: Props) => {
  const [journeyId, setJourneyId] = useState<string>(BIBLE_MAPS[0].id);
  const [selectedPoint, setSelectedPoint] = useState<{
    point: MapPoint;
    journey: MapJourney;
  } | null>(null);
  const journey = useMemo(
    () => BIBLE_MAPS.find((j) => j.id === journeyId) || BIBLE_MAPS[0],
    [journeyId]
  );

  // Animated route: build dashoffset animation on change.
  const routeRef = useRef<SVGPathElement>(null);
  const [routeLen, setRouteLen] = useState(0);
  useEffect(() => {
    const el = routeRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    setRouteLen(len);
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    // Trigger animation on next frame
    const raf = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 1600ms ease-out";
      el.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(raf);
  }, [journeyId, open]);

  useEffect(() => {
    if (!open) setSelectedPoint(null);
  }, [open]);

  const routeD = useMemo(() => {
    if (!journey.drawRoute || journey.points.length < 2) return "";
    return journey.points
      .map((p, i) => {
        const { x, y } = project(p.coords);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [journey]);

  return (
    <StageShell
      open={open}
      onOpenChange={onOpenChange}
      title="Mapas Bíblicos"
      subtitle={`${BIBLE_MAPS.length} jornadas · Terra Santa`}
      accentColor={journey.color}
      headerIcon={<MapPin className="w-5 h-5 text-white" />}
    >
      <div className="h-full flex flex-col">
        {/* Journey selector */}
        <div className="flex-shrink-0 overflow-x-auto scrollbar-none border-b border-[hsl(var(--dark-card-hover))]">
          <div className="flex gap-2 px-4 py-3 min-w-max">
            {BIBLE_MAPS.map((j) => {
              const active = j.id === journeyId;
              return (
                <button
                  key={j.id}
                  onClick={() => {
                    setJourneyId(j.id);
                    setSelectedPoint(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
                  style={{
                    background: active
                      ? `hsl(${j.color} / 0.22)`
                      : "hsl(var(--dark-card))",
                    color: active ? `hsl(${j.color})` : "hsl(var(--dark-muted))",
                    border: active
                      ? `1px solid hsl(${j.color} / 0.5)`
                      : "1px solid transparent",
                  }}
                >
                  <span>{j.icon}</span>
                  <span>{j.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map viewport */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 60% 40%, hsl(${journey.color} / 0.15) 0%, hsl(var(--dark-bg)) 70%)`,
            }}
          />
          <svg
            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="hsl(var(--dark-card-hover))"
                  strokeWidth="0.5"
                  opacity="0.3"
                />
              </pattern>
              <radialGradient id="landGrad">
                <stop offset="0%" stopColor={`hsl(${journey.color} / 0.12)`} />
                <stop offset="100%" stopColor="hsl(var(--dark-card))" />
              </radialGradient>
            </defs>
            <rect width={VIEW.w} height={VIEW.h} fill="url(#grid)" />
            {/* Land */}
            {LAND_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="url(#landGrad)"
                stroke={`hsl(${journey.color} / 0.4)`}
                strokeWidth={1.2}
              />
            ))}
            {/* Route */}
            {journey.drawRoute && routeD && (
              <path
                ref={routeRef}
                d={routeD}
                fill="none"
                stroke={`hsl(${journey.color})`}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: `drop-shadow(0 0 6px hsl(${journey.color} / 0.6))`,
                }}
              />
            )}
            {/* Points */}
            {journey.points.map((p, i) => {
              const { x, y } = project(p.coords);
              const active =
                selectedPoint?.point.name === p.name &&
                selectedPoint?.journey.id === journey.id;
              return (
                <g
                  key={`${p.name}-${i}`}
                  onClick={() => setSelectedPoint({ point: p, journey })}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 14 : 10}
                    fill={`hsl(${journey.color} / 0.25)`}
                  >
                    <animate
                      attributeName="r"
                      values={active ? "14;20;14" : "10;14;10"}
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    fill={`hsl(${journey.color})`}
                    stroke="hsl(var(--dark-bg))"
                    strokeWidth={2}
                  />
                  <text
                    x={x + 9}
                    y={y + 4}
                    fontSize={12}
                    fontWeight={700}
                    fill="hsl(var(--dark-text))"
                    style={{ pointerEvents: "none" }}
                  >
                    {p.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Journey overlay caption */}
          <div className="absolute top-3 left-3 right-3 pointer-events-none">
            <div
              className="inline-block rounded-2xl px-3 py-2 backdrop-blur-md"
              style={{
                background: `hsl(var(--dark-card) / 0.85)`,
                border: `1px solid hsl(${journey.color} / 0.4)`,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: `hsl(${journey.color})` }}
              >
                {journey.icon} {journey.period}
              </p>
              <h2 className="text-sm font-black text-[hsl(var(--dark-text))] mt-0.5">
                {journey.name}
              </h2>
              <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-snug mt-1 max-w-xs">
                {journey.summary}
              </p>
            </div>
          </div>

          {/* Bottom point list — always visible for touch */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[42%] overflow-y-auto bg-[hsl(var(--dark-bg)/0.92)] backdrop-blur-md border-t border-[hsl(var(--dark-card-hover))]">
            {selectedPoint ? (
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: `linear-gradient(135deg, hsl(${selectedPoint.journey.color}) 0%, hsl(${selectedPoint.journey.color} / 0.6) 100%)`,
                    }}
                  >
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: `hsl(${selectedPoint.journey.color})` }}
                    >
                      {selectedPoint.journey.name}
                    </p>
                    <h3 className="text-[15px] font-black text-[hsl(var(--dark-text))] leading-tight">
                      {selectedPoint.point.name}
                    </h3>
                    {selectedPoint.point.description && (
                      <p className="text-[12px] text-[hsl(var(--dark-muted))] leading-snug mt-1">
                        {selectedPoint.point.description}
                      </p>
                    )}
                    {selectedPoint.point.reference && (
                      <button
                        onClick={() =>
                          onNavigateReference(selectedPoint.point.reference!)
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-md"
                        style={{
                          background: `linear-gradient(135deg, hsl(${selectedPoint.journey.color}) 0%, hsl(${selectedPoint.journey.color} / 0.7) 100%)`,
                        }}
                      >
                        <BookOpen className="w-3 h-3" />
                        {selectedPoint.point.reference}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))] mb-2 px-1">
                  Pontos desta jornada · toque para detalhes
                </p>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {journey.points.map((p, i) => (
                    <button
                      key={`${p.name}-${i}`}
                      onClick={() => setSelectedPoint({ point: p, journey })}
                      className="flex-shrink-0 rounded-xl px-3 py-2 text-left bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors"
                      style={{ border: `1px solid hsl(${journey.color} / 0.2)` }}
                    >
                      <p
                        className="text-[10px] font-bold"
                        style={{ color: `hsl(${journey.color})` }}
                      >
                        {i + 1}
                      </p>
                      <p className="text-[12px] font-semibold text-[hsl(var(--dark-text))]">
                        {p.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StageShell>
  );
};

export default MapStage;