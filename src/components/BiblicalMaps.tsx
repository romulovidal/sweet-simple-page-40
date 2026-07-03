import { useState, useMemo, useEffect } from "react";
import { MapPin, X, ChevronRight, BookOpen } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBackHandler } from "@/hooks/useBackHandler";
import { BIBLE_MAPS, type MapJourney, type MapPoint } from "@/data/bibleMaps";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  onNavigateReference?: (reference: string) => void;
}

// Custom colored divIcon marker
const makeIcon = (color: string, index: number) =>
  L.divIcon({
    className: "bible-map-marker",
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:hsl(${color});color:white;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.5), 0 0 0 2px hsl(${color} / 0.4);
    ">${index + 1}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const FitBounds = ({ points }: { points: MapPoint[] }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => p.coords));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
};

const BiblicalMaps = ({ onNavigateReference }: Props) => {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(BIBLE_MAPS[0].id);
  useBackHandler(open, () => setOpen(false));

  const journeys = useMemo(() => BIBLE_MAPS, []);
  const active = journeys.find((j) => j.id === activeId) ?? journeys[0];

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("open-biblical-maps", h);
    return () => window.removeEventListener("open-biblical-maps", h);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Mapas Bíblicos"
        aria-label="Mapas Bíblicos"
        className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center hover:bg-dark-card-hover transition-colors"
      >
        <MapPin className="w-4 h-4" />
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
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
                  style={{ background: `linear-gradient(135deg, hsl(${active.color}) 0%, hsl(${active.color} / 0.6) 100%)` }}
                >
                  <MapPin className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))] text-left">
                    Mapas Bíblicos
                  </SheetTitle>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest">
                    Terra Santa · Jornadas
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

          {/* Journey chips */}
          <div className="flex-shrink-0 overflow-x-auto scrollbar-none border-b border-[hsl(var(--dark-card-hover))]">
            <div className="flex gap-2 px-5 py-3 min-w-max">
              {journeys.map((j) => {
                const isActive = j.id === activeId;
                return (
                  <button
                    key={j.id}
                    onClick={() => setActiveId(j.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
                    style={{
                      background: isActive ? `hsl(${j.color} / 0.25)` : "hsl(var(--dark-card))",
                      color: isActive ? `hsl(${j.color})` : "hsl(var(--dark-muted))",
                      border: isActive ? `1px solid hsl(${j.color} / 0.5)` : "1px solid transparent",
                    }}
                  >
                    <span>{j.icon}</span>
                    <span>{j.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-[hsl(var(--dark-card-hover))]">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(${active.color})` }}>
              {active.period}
            </p>
            <p className="text-[12px] text-[hsl(var(--dark-muted))] leading-snug mt-1">{active.summary}</p>
          </div>

          {/* Map + list */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* Map */}
            <div className="h-[45vh] md:h-auto md:flex-1 relative">
              <MapContainer
                key={active.id}
                center={active.points[0].coords}
                zoom={6}
                scrollWheelZoom
                className="w-full h-full"
                style={{ background: "hsl(var(--dark-bg))" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <FitBounds points={active.points} />
                {active.drawRoute && active.points.length > 1 && (
                  <Polyline
                    positions={active.points.map((p) => p.coords)}
                    pathOptions={{
                      color: `hsl(${active.color})`,
                      weight: 3,
                      opacity: 0.85,
                      dashArray: "6 8",
                    }}
                  />
                )}
                {active.points.map((p, idx) => (
                  <Marker key={`${active.id}-${idx}`} position={p.coords} icon={makeIcon(active.color, idx)}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <strong>{p.name}</strong>
                        {p.description && <div style={{ fontSize: 12, marginTop: 4 }}>{p.description}</div>}
                        {p.reference && (
                          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>📖 {p.reference}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Points list */}
            <div className="flex-1 md:max-w-sm overflow-y-auto p-4 border-t md:border-t-0 md:border-l border-[hsl(var(--dark-card-hover))]">
              <ol className="space-y-2">
                {active.points.map((p, idx) => (
                  <li
                    key={`${active.id}-list-${idx}`}
                    className="rounded-xl p-3 bg-[hsl(var(--dark-card))]"
                    style={{ border: `1px solid hsl(${active.color} / 0.15)` }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                        style={{ background: `hsl(${active.color})` }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-bold text-[hsl(var(--dark-text))] leading-tight">{p.name}</h4>
                        {p.description && (
                          <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-snug mt-1">{p.description}</p>
                        )}
                        {p.reference && (
                          <button
                            onClick={() => {
                              onNavigateReference?.(p.reference!);
                              setOpen(false);
                            }}
                            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--dark-text))] hover:opacity-80 group"
                          >
                            <BookOpen className="w-3 h-3" style={{ color: `hsl(${active.color})` }} />
                            <span>{p.reference}</span>
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-center text-[10px] text-[hsl(var(--dark-muted)/0.6)] mt-6">
                🗺️ Mapas Bíblicos · Bíblia do Atalaia
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BiblicalMaps;