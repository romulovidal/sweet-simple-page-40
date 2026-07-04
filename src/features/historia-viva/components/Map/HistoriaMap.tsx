import { useEffect, useMemo, useRef, useState } from "react";
import { ROUTES } from "../../data/routes";
import { PLACES } from "../../data/places";
import type { EntityRef } from "../../types";
import Chip from "../shared/Chip";
import RefLink from "../shared/RefLink";

const BOUNDS = { minLat: 26, maxLat: 45, minLng: 10, maxLng: 50 };
const W = 900;
const H = 520;

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
  const y = H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
  return { x, y };
}

interface Props {
  onOpenPlace: (id: string) => void;
  onNavigate: (ref: EntityRef) => void;
}

const HistoriaMap = ({ onOpenPlace }: Props) => {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => setAnimKey((k) => k + 1), [selectedRoute]);

  const route = useMemo(() => ROUTES.find((r) => r.id === selectedRoute) ?? null, [selectedRoute]);

  const projectedPlaces = PLACES.filter((p) => p.lat && p.lng).map((p) => ({ ...p, ...project(p.lat!, p.lng!) }));

  const routePoints = useMemo(() => {
    if (!route) return [];
    return route.stops
      .map((s) => {
        if (s.lat && s.lng) return { label: s.label ?? s.placeId ?? "", ...project(s.lat, s.lng), placeId: s.placeId };
        const place = PLACES.find((p) => p.id === s.placeId);
        if (place?.lat && place?.lng) return { label: place.name, ...project(place.lat, place.lng), placeId: place.id };
        return null;
      })
      .filter(Boolean) as { label: string; x: number; y: number; placeId?: string }[];
  }, [route]);

  const pathD = routePoints.length > 1
    ? routePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
    : "";

  return (
    <div className="w-full">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-2">
        <Chip active={selectedRoute === null} onClick={() => setSelectedRoute(null)}>
          Todas cidades
        </Chip>
        {ROUTES.map((r) => (
          <Chip key={r.id} color={r.color} active={selectedRoute === r.id} onClick={() => setSelectedRoute(r.id)}>
            {r.icon} {r.name}
          </Chip>
        ))}
      </div>

      <div className="mx-4 rounded-2xl overflow-hidden border border-dark-card-hover">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Mapa bíblico interativo">
          <defs>
            <pattern id="hv-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--hv-map-grid))" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="hv-sea" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="hsl(var(--hv-map-sea-inner))" />
              <stop offset="100%" stopColor="hsl(var(--hv-map-sea-outer))" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#hv-sea)" />
          <rect width={W} height={H} fill="url(#hv-grid)" />

          <path
            d="M 0 220 Q 120 200 200 240 T 380 260 Q 440 220 500 250 Q 560 210 640 240 Q 720 200 820 230 L 900 210 L 900 520 L 0 520 Z"
            fill="hsl(var(--hv-map-land))"
            style={{ opacity: "var(--hv-map-land-opacity)" }}
          />
          <path
            d="M 0 100 Q 200 80 400 110 Q 600 90 900 120 L 900 0 L 0 0 Z"
            fill="hsl(var(--hv-map-land))"
            style={{ opacity: "calc(var(--hv-map-land-opacity) * 0.82)" }}
          />

          {projectedPlaces.map((p) => (
            <circle key={`bg-${p.id}`} cx={p.x} cy={p.y} r={3} fill="hsl(var(--hv-map-dot))" opacity={selectedRoute ? 0.35 : 0.85} />
          ))}

          {route && (
            <>
              <path key={`glow-${animKey}`} d={pathD} fill="none" stroke={`hsl(${route.color})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
              <path
                key={`main-${animKey}`}
                d={pathD}
                fill="none"
                stroke={`hsl(${route.color})`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1500"
                strokeDashoffset="1500"
                style={{ animation: "hv-draw 2.5s ease-out forwards" }}
              />
              {routePoints.map((p, i) => (
                <g key={`pt-${i}`} className="cursor-pointer" onClick={() => p.placeId && onOpenPlace(p.placeId)} role="button" aria-label={`Ponto ${i + 1}: ${p.label}`}>
                  <circle cx={p.x} cy={p.y} r={9} fill={`hsl(${route.color})`} opacity="0.25" style={{ animation: `hv-pulse 2s ${i * 0.2}s ease-in-out infinite` }} />
                  <circle cx={p.x} cy={p.y} r={4.5} fill={`hsl(${route.color})`} stroke="hsl(var(--hv-map-label))" strokeWidth="1.5" />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="hsl(var(--hv-map-label))" style={{ paintOrder: "stroke", stroke: "hsl(var(--hv-map-label-stroke))", strokeWidth: 3 }}>
                    {p.label}
                  </text>
                </g>
              ))}
            </>
          )}

          {!selectedRoute && projectedPlaces.map((p) => (
            <g key={p.id} className="cursor-pointer" onClick={() => onOpenPlace(p.id)} role="button" aria-label={p.name}>
              <circle cx={p.x} cy={p.y} r={5} fill="hsl(var(--hv-map-marker))" stroke="hsl(var(--hv-map-label))" strokeWidth="1.2" />
              <text x={p.x + 7} y={p.y + 3} fontSize="10" fontWeight="600" fill="hsl(var(--hv-map-label))" style={{ paintOrder: "stroke", stroke: "hsl(var(--hv-map-label-stroke))", strokeWidth: 3 }}>
                {p.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {route && (
        <div className="mx-4 mt-3 rounded-xl p-3" style={{ background: `hsl(${route.color} / 0.15)`, border: `1px solid hsl(${route.color} / 0.35)` }}>
          <p className="text-sm font-bold text-dark-text">{route.icon} {route.name}</p>
          <p className="text-[12px] text-dark-muted mt-0.5">{route.description}</p>
          <div className="grid grid-cols-1 gap-1.5 mt-2">
            {route.references.map((r) => <RefLink key={r} reference={r} color={route.color} />)}
          </div>
          <p className="text-[10px] text-dark-muted mt-2">Toque nos pontos do mapa para ver detalhes da cidade.</p>
        </div>
      )}

      <style>{`
        @keyframes hv-draw { to { stroke-dashoffset: 0; } }
        @keyframes hv-pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default HistoriaMap;
