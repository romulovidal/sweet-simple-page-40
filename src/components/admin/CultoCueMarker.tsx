import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, Timer, Trash2, Save, RotateCcw } from "lucide-react";
import type { HarpaHino } from "@/data/harpa";
import { loadYouTubeApi } from "@/lib/youtubeApi";
import {
  buildHarpaSlides,
  slideLabel,
  slideIndexAt,
  fmtTime,
  parseTime,
} from "@/lib/harpaSlides";
import { toast } from "sonner";

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return /^[\w-]{6,}$/.test(url || "") ? (url as string) : null;
  }
}

type Props = {
  hino: HarpaHino;
  youtubeUrl?: string | null;
  cues?: (number | null)[] | null;
  onClose: () => void;
  onSave: (cues: (number | null)[]) => void;
};

/**
 * Marcação manual dos tempos de cada estrofe contra o playback.
 * O admin toca o vídeo e clica em "Marcar" no momento em que a estrofe começa.
 */
export default function CultoCueMarker({ hino, youtubeUrl, cues, onClose, onSave }: Props) {
  const slides = useMemo(() => buildHarpaSlides(hino), [hino]);
  const [marks, setMarks] = useState<(number | null)[]>(() =>
    slides.map((_, i) => (cues && typeof cues[i] === "number" ? (cues[i] as number) : null))
  );
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const videoId = extractYouTubeId(youtubeUrl);

  useEffect(() => {
    let destroyed = false;
    if (!videoId) return;
    (async () => {
      const YT = await loadYouTubeApi();
      if (destroyed || !hostRef.current) return;
      const target = document.createElement("div");
      hostRef.current.appendChild(target);
      playerRef.current = new YT.Player(target, {
        height: "180",
        width: "320",
        videoId,
        playerVars: { controls: 1, playsinline: 1 },
        events: {
          onStateChange: (e: any) => setPlaying(e.data === 1),
        },
      });
    })();
    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number") setTime(t);
      } catch {}
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const seek = useCallback((s: number) => {
    try {
      playerRef.current?.seekTo?.(Math.max(0, s), true);
    } catch {}
  }, []);

  const togglePlay = () => {
    try {
      if (playing) playerRef.current?.pauseVideo?.();
      else playerRef.current?.playVideo?.();
    } catch {}
  };

  const markHere = () => {
    setMarks((prev) => {
      const arr = [...prev];
      arr[cursor] = Math.max(0, Math.round(time * 10) / 10);
      return arr;
    });
    setCursor((c) => Math.min(slides.length - 1, c + 1));
  };

  const clearMark = (i: number) =>
    setMarks((prev) => prev.map((m, idx) => (idx === i ? null : m)));

  const active = slideIndexAt(marks, time);

  const save = () => {
    const filled = marks.filter((m) => typeof m === "number").length;
    if (filled === 0) {
      onSave([]);
      onClose();
      return;
    }
    // Avisa (sem bloquear) se as marcações não estiverem em ordem crescente.
    const nums = marks.filter((m): m is number => typeof m === "number");
    const sorted = [...nums].sort((a, b) => a - b);
    if (nums.some((n, i) => n !== sorted[i])) {
      toast.warning("As marcações não estão em ordem crescente — confira os tempos.");
    }
    onSave(marks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[94vh] bg-[hsl(var(--dark-bg))] rounded-t-2xl sm:rounded-2xl border border-[hsl(var(--dark-card-hover))] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--dark-card-hover))]">
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate">
              Marcar tempos — {hino.number}. {hino.title}
            </h3>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">
              Toque o playback e clique em “Marcar” quando cada estrofe começar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[hsl(var(--dark-card))]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!videoId ? (
            <p className="text-sm text-[hsl(var(--destructive))]">
              Informe a URL do YouTube deste hino antes de marcar os tempos.
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div ref={hostRef} className="rounded-xl overflow-hidden bg-black" />
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25"
                    >
                      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className="font-mono text-lg tabular-nums">{fmtTime(time)}</span>
                  </div>
                  <button
                    onClick={markHere}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110"
                  >
                    <Timer className="w-4 h-4" />
                    Marcar “{slideLabel(slides[cursor], cursor)}” em {fmtTime(time)}
                  </button>
                  <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                    Próxima marcação: {cursor + 1} de {slides.length}
                  </p>
                </div>
              </div>

              <ul className="space-y-1.5">
                {slides.map((s, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                      active === i
                        ? "border-primary/60 bg-primary/10"
                        : "border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-card))]"
                    } ${cursor === i ? "ring-1 ring-primary/40" : ""}`}
                    onClick={() => setCursor(i)}
                  >
                    <span className="w-24 shrink-0 text-[11px] font-semibold text-primary">
                      {slideLabel(s, i)}
                    </span>
                    <span className="flex-1 min-w-0 text-[11px] text-[hsl(var(--dark-muted))] truncate">
                      {s.lines[0]}
                    </span>
                    <input
                      type="text"
                      value={typeof marks[i] === "number" ? fmtTime(marks[i] as number) : ""}
                      onChange={(e) => {
                        const v = parseTime(e.target.value);
                        setMarks((prev) => prev.map((m, idx) => (idx === i ? v : m)));
                      }}
                      placeholder="—:—"
                      className="w-20 h-8 px-2 rounded-lg bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] text-xs text-center font-mono focus:outline-none focus:border-primary/60"
                    />
                    <button
                      onClick={() => typeof marks[i] === "number" && seek(marks[i] as number)}
                      disabled={typeof marks[i] !== "number"}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-bg))] disabled:opacity-30"
                      title="Ouvir a partir daqui"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => clearMark(i)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/15"
                      title="Limpar marcação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[hsl(var(--dark-card-hover))] flex items-center justify-between gap-2">
          <button
            onClick={() => {
              setMarks(slides.map(() => null));
              setCursor(0);
            }}
            className="flex items-center gap-1.5 px-3 h-10 rounded-lg text-sm font-semibold text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card))]"
          >
            <RotateCcw className="w-4 h-4" /> Limpar tudo
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 h-10 rounded-lg text-sm font-semibold text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card))]"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              className="flex items-center gap-1.5 px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110"
            >
              <Save className="w-4 h-4" /> Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
