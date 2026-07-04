import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { ROUTES } from "../../data/routes";
import { PLACES } from "../../data/places";
import type { EntityRef } from "../../types";
import Chip from "../shared/Chip";
import RefLink from "../shared/RefLink";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  onOpenPlace: (id: string) => void;
  onNavigate: (ref: EntityRef) => void;
}

const DEFAULT_CENTER: LatLngExpression = [33, 33];
const DEFAULT_BOUNDS: LatLngBoundsExpression = [
  [24, 10],
  [45, 50],
];

// Tiles por tema — CARTO (uso livre com atribuição)
const TILES: Record<string, { url: string; attribution: string; filter?: string }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  sepia: {
    url: "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    filter: "sepia(0.55) saturate(1.05) contrast(0.95) brightness(1.02)",
  },
};

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.flyToBounds(points as [number, number][], { padding: [40, 40], duration: 0.8 });
    } else if (points.length === 1) {
      map.flyTo(points[0] as [number, number], 6, { duration: 0.6 });
    } else {
      map.flyToBounds(DEFAULT_BOUNDS, { padding: [20, 20], duration: 0.6 });
    }
  }, [points, map]);
  return null;
}

const HistoriaMap = ({ onOpenPlace }: Props) => {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const { theme } = useTheme();
  const tile = TILES[theme] ?? TILES.dark;

  // Lê --primary do tema atual para pintar rotas/marcadores (Leaflet usa atributos SVG e não resolve var()).
  const [primary, setPrimary] = useState("hsl(220 70% 50%)");
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    if (v) setPrimary(`hsl(${v})`);
  }, [theme]);

  const route = useMemo(() => ROUTES.find((r) => r.id === selectedRoute) ?? null, [selectedRoute]);

  const routePoints = useMemo(() => {
    if (!route) return [];
    return route.stops
      .map((s) => {
        if (s.lat && s.lng) return { label: s.label ?? s.placeId ?? "", lat: s.lat, lng: s.lng, placeId: s.placeId };
        const place = PLACES.find((p) => p.id === s.placeId);
        if (place?.lat && place?.lng) return { label: place.name, lat: place.lat, lng: place.lng, placeId: place.id };
        return null;
      })
      .filter(Boolean) as { label: string; lat: number; lng: number; placeId?: string }[];
  }, [route]);

  const routeLatLngs: LatLngExpression[] = routePoints.map((p) => [p.lat, p.lng]);
  const placesWithCoords = PLACES.filter((p) => p.lat && p.lng);

  return (
    <div className="w-full">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-2">
        <Chip active={selectedRoute === null} onClick={() => setSelectedRoute(null)}>
          Todas cidades
        </Chip>
        {ROUTES.map((r) => (
          <Chip key={r.id} active={selectedRoute === r.id} onClick={() => setSelectedRoute(r.id)}>
            {r.icon} {r.name}
          </Chip>
        ))}
      </div>

      <div
        className="mx-4 rounded-2xl overflow-hidden border border-dark-card-hover"
        style={{ height: 420, background: "hsl(var(--dark-card))" }}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={5}
          minZoom={3}
          maxZoom={10}
          scrollWheelZoom
          worldCopyJump
          style={{ height: "100%", width: "100%", background: "hsl(var(--dark-card))" }}
        >
          <TileLayer
            key={theme}
            url={tile.url}
            attribution={tile.attribution}
            className={tile.filter ? "hv-tiles-filtered" : undefined}
          />

          <FitBounds points={routeLatLngs} />

          {/* Cidades bíblicas — sempre visíveis, mais fracas quando há rota */}
          {placesWithCoords.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat!, p.lng!]}
              radius={selectedRoute ? 3.5 : 5}
              pathOptions={{
                color: primary,
                weight: 1.5,
                fillColor: primary,
                fillOpacity: selectedRoute ? 0.35 : 0.85,
              }}
              eventHandlers={{ click: () => onOpenPlace(p.id) }}
            >
              {!selectedRoute && (
                <Tooltip direction="right" offset={[6, 0]} opacity={1} permanent className="hv-tooltip">
                  {p.name}
                </Tooltip>
              )}
            </CircleMarker>
          ))}

          {/* Rota selecionada */}
          {route && routeLatLngs.length > 1 && (
            <>
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: primary, weight: 6, opacity: 0.25, lineCap: "round", lineJoin: "round" }}
              />
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: primary, weight: 3, opacity: 1, lineCap: "round", lineJoin: "round", dashArray: "1 8" }}
                className="hv-route-animated"
              />
            </>
          )}

          {/* Paradas numeradas da rota */}
          {route &&
            routePoints.map((p, i) => (
              <CircleMarker
                key={`stop-${i}`}
                center={[p.lat, p.lng]}
                radius={7}
                pathOptions={{
                  color: "hsl(var(--dark-bg))",
                  weight: 2,
                  fillColor: primary,
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => p.placeId && onOpenPlace(p.placeId) }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent className="hv-tooltip hv-tooltip-strong">
                  {i + 1}. {p.label}
                </Tooltip>
              </CircleMarker>
            ))}
        </MapContainer>
      </div>

      {route && (
        <div className="mx-4 mt-3 rounded-xl p-3 bg-dark-card border border-dark-card-hover border-l-4 border-l-primary">
          <p className="text-sm font-bold text-dark-text">{route.icon} {route.name}</p>
          <p className="text-[12px] text-dark-muted mt-0.5">{route.description}</p>
          <div className="grid grid-cols-1 gap-1.5 mt-2">
            {route.references.map((r) => <RefLink key={r} reference={r} />)}
          </div>
          <p className="text-[10px] text-dark-muted mt-2">
            Toque em um ponto numerado para ver detalhes da cidade. Arraste e use o zoom para explorar.
          </p>
        </div>
      )}

      <style>{`
        .hv-tiles-filtered { filter: ${TILES.sepia.filter}; }
        .hv-tooltip {
          background: hsl(var(--dark-card)) !important;
          color: hsl(var(--dark-text)) !important;
          border: 1px solid hsl(var(--dark-card-hover)) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 2px 6px !important;
          border-radius: 6px !important;
        }
        .hv-tooltip::before { display: none !important; }
        .hv-tooltip-strong { font-weight: 700 !important; font-size: 12px !important; }
        .leaflet-container { font-family: inherit; }
        .leaflet-control-attribution {
          background: hsl(var(--dark-card) / 0.85) !important;
          color: hsl(var(--dark-muted)) !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: hsl(var(--primary)) !important; }
        .leaflet-control-zoom a {
          background: hsl(var(--dark-card)) !important;
          color: hsl(var(--dark-text)) !important;
          border-color: hsl(var(--dark-card-hover)) !important;
        }
        .leaflet-control-zoom a:hover { background: hsl(var(--dark-card-hover)) !important; }
        @keyframes hv-route-dash { to { stroke-dashoffset: -80; } }
        .hv-route-animated { animation: hv-route-dash 2s linear infinite; }
      `}</style>
    </div>
  );
};

export default HistoriaMap;
