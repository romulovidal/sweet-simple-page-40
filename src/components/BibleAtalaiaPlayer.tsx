import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw, Loader2, BookOpen } from "lucide-react";
import {
  clearVideoProgress,
  getVideoProgress,
  loadYouTubeApi,
  saveVideoProgress,
} from "@/lib/youtubeApi";

interface Props {
  videoId: string;
  title: string;
  /** Autoplay when mounted (used inside modal). */
  autoplay?: boolean;
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

const BibleAtalaiaPlayer = ({ videoId, title, autoplay = false }: Props) => {
  const [mounted, setMounted] = useState(autoplay);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerElRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const persistRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const saved = getVideoProgress(videoId);
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playerRef.current && playing) setControlsVisible(false);
    }, 2500);
  }, [playing]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // Persist progress periodically & on state changes
  const persistNow = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const t = p.getCurrentTime?.() ?? 0;
      const d = p.getDuration?.() ?? 0;
      saveVideoProgress(videoId, t, d);
    } catch {
      /* noop */
    }
  }, [videoId]);

  // Mount YT player when `mounted` becomes true
  useEffect(() => {
    if (!mounted) return;
    let disposed = false;

    loadYouTubeApi().then((YT) => {
      if (disposed || !playerElRef.current) return;

      const startAt = saved && saved.t > 5 ? Math.max(0, saved.t - 2) : 0;

      playerRef.current = new YT.Player(playerElRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 1,
          start: Math.floor(startAt),
        },
        events: {
          onReady: (e: any) => {
            if (disposed) return;
            setReady(true);
            try {
              const d = e.target.getDuration?.() ?? 0;
              setDuration(d);
              setMuted(!!e.target.isMuted?.());
              if (startAt > 0) {
                // Ensure seek even if start param was ignored
                e.target.seekTo(startAt, true);
                setResumeFrom(startAt);
                window.setTimeout(() => setResumeFrom(null), 3500);
              }
            } catch {
              /* noop */
            }
          },
          onStateChange: (e: any) => {
            const state = e.data;
            // 1 playing, 2 paused, 3 buffering, 0 ended
            if (state === 1) {
              setPlaying(true);
              setBuffering(false);
              scheduleHide();
              try {
                const d = e.target.getDuration?.() ?? 0;
                if (d > 0) setDuration(d);
              } catch {
                /* noop */
              }
            } else if (state === 2) {
              setPlaying(false);
              setControlsVisible(true);
              persistNow();
            } else if (state === 3) {
              setBuffering(true);
            } else if (state === 0) {
              setPlaying(false);
              setControlsVisible(true);
              clearVideoProgress(videoId);
            }
          },
        },
      });
    });

    // Progress polling
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") return;
      try {
        setCurrent(p.getCurrentTime());
        if (!duration) {
          const d = p.getDuration?.() ?? 0;
          if (d > 0) setDuration(d);
        }
      } catch {
        /* noop */
      }
    }, 500);

    // Persist every 3s
    persistRef.current = window.setInterval(persistNow, 3000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") persistNow();
    };
    const onBeforeUnload = () => persistNow();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onBeforeUnload);
    window.addEventListener("beforeunload", onBeforeUnload);

    const onFsChange = () => {
      if (!document.fullscreenElement) {
        try { (screen.orientation as any)?.unlock?.(); } catch { /* noop */ }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      disposed = true;
      persistNow();
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (persistRef.current) window.clearInterval(persistRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onBeforeUnload);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("fullscreenchange", onFsChange);
      try { (screen.orientation as any)?.unlock?.(); } catch { /* noop */ }
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, videoId]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo?.();
    else p.playVideo?.();
    revealControls();
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute?.();
      setMuted(false);
    } else {
      p.mute?.();
      setMuted(true);
    }
    revealControls();
  };

  const requestFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    const anyEl = el as any;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      try { (screen.orientation as any)?.unlock?.(); } catch { /* noop */ }
    } else {
      const enter = (el.requestFullscreen && el.requestFullscreen.bind(el)) || (anyEl.webkitRequestFullscreen && anyEl.webkitRequestFullscreen.bind(el));
      if (enter) {
        Promise.resolve(enter()).then(() => {
          try { (screen.orientation as any)?.lock?.("landscape").catch(() => {}); } catch { /* noop */ }
        }).catch(() => {});
      } else if (anyEl.webkitEnterFullscreen) {
        anyEl.webkitEnterFullscreen();
      }
    }
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = playerRef.current;
    if (!p) return;
    const val = Number(e.target.value);
    p.seekTo?.(val, true);
    setCurrent(val);
    persistNow();
    revealControls();
  };

  const restart = () => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo?.(0, true);
    p.playVideo?.();
    clearVideoProgress(videoId);
  };

  if (!mounted) {
    return (
      <div className="relative aspect-video bg-black overflow-hidden rounded-xl">
        <button
          type="button"
          onClick={() => setMounted(true)}
          className="group absolute inset-0 w-full h-full"
          aria-label={`Reproduzir ${title}`}
        >
          <img src={thumb} alt={title} loading="lazy" className="w-full h-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
          <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur px-2 py-1 rounded-md">
            <BookOpen className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white">Bíblia Atalaia</span>
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-primary/95 flex items-center justify-center shadow-2xl group-active:scale-95 transition-transform ring-4 ring-white/20">
              <Play className="w-7 h-7 text-primary-foreground fill-current ml-1" />
            </span>
          </span>
          {saved && saved.t > 5 && (
            <span className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-white/90 bg-black/60 backdrop-blur px-2 py-1 rounded">
                Continuar em {formatTime(saved.t)}
              </span>
              {saved.d ? (
                <span className="flex-1 h-1 bg-white/20 rounded overflow-hidden">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${Math.min(100, (saved.t / saved.d) * 100)}%` }}
                  />
                </span>
              ) : null}
            </span>
          )}
        </button>
      </div>
    );
  }

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black overflow-hidden rounded-xl select-none group/player"
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      onTouchStart={revealControls}
    >
      {/* YT iframe target */}
      <div ref={playerElRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Click layer for play/pause */}
      <button
        type="button"
        onClick={togglePlay}
        className="absolute inset-0 w-full h-full z-10"
        aria-label={playing ? "Pausar" : "Reproduzir"}
      />

      {/* Brand badge */}
      <div
        className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur px-2 py-1 rounded-md transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <BookOpen className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">Bíblia Atalaia</span>
      </div>

      {/* Resume toast */}
      {resumeFrom !== null && (
        <div className="absolute top-3 right-3 z-20 bg-primary/90 text-primary-foreground text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-lg">
          Retomado em {formatTime(resumeFrom)}
        </div>
      )}

      {/* Center loading / big play */}
      {(!ready || buffering) && (
        <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 animate-spin text-white/90" />
        </div>
      )}
      {ready && !playing && !buffering && (
        <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
          <span className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl ring-4 ring-white/20">
            <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 px-3 pt-6 pb-2 bg-gradient-to-t from-black/90 to-transparent transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber */}
        <div className="relative w-full h-4 flex items-center mb-1">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/20" />
          <div
            className="absolute left-0 h-1 rounded-full bg-primary"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.floor(current)}
            onChange={onScrub}
            className="relative w-full appearance-none bg-transparent h-4 cursor-pointer accent-primary z-10 opacity-0"
            aria-label="Progresso do vídeo"
          />
          <div
            className="absolute w-3 h-3 rounded-full bg-primary shadow ring-2 ring-white pointer-events-none"
            style={{ left: `calc(${progressPct}% - 6px)` }}
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition"
            aria-label={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={restart}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition"
            aria-label="Reiniciar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition"
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="text-[11px] font-mono tabular-nums text-white/90">
            {formatTime(current)} <span className="text-white/50">/ {formatTime(duration)}</span>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={requestFullscreen}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition"
            aria-label="Tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BibleAtalaiaPlayer;