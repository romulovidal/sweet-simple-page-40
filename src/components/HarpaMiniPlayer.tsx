import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Loader2, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadYouTubeApi } from "@/lib/youtubeApi";
import { toast } from "sonner";

type Props = {
  number: number;
  title: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  /** Optional explicit YouTube URL (admin-curated playback). When set, skips the search. */
  videoUrl?: string | null;
  /** Called ~4x/s with the playback position in seconds (only while playing). */
  onTime?: (seconds: number) => void;
  /** Receives a seek function so parents can jump to a marked cue. */
  onControls?: (controls: { seek: (seconds: number) => void } | null) => void;
};

type SearchResult = { videoId: string; title: string; channel: string };

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
    return /^[\w-]{6,}$/.test(url) ? url : null;
  }
}

export default function HarpaMiniPlayer({ number, title, autoPlay, onEnded, videoUrl, onTime, onControls }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [found, setFound] = useState<SearchResult | null>(null);
  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onEndedRef = useRef<typeof onEnded>(onEnded);
  const onTimeRef = useRef<typeof onTime>(onTime);
  const foundRef = useRef<{ number: number; video: SearchResult } | null>(null);
  const numberRef = useRef<number>(number);
  const videoUrlRef = useRef<string | null | undefined>(videoUrl);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onTimeRef.current = onTime;
  }, [onTime]);

  // Expose a seek handle to the parent (used to jump to marked cues).
  useEffect(() => {
    onControls?.({
      seek: (s: number) => {
        try {
          playerRef.current?.seekTo?.(Math.max(0, s), true);
          playerRef.current?.playVideo?.();
        } catch {}
      },
    });
    return () => onControls?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emite o tempo corrente enquanto toca — base da sincronia com as estrofes.
  useEffect(() => {
    if (state !== "playing") return;
    const id = window.setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number") onTimeRef.current?.(t);
      } catch {}
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(() => {
    numberRef.current = number;
  }, [number]);
  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);

  // Reset when hymn changes
  useEffect(() => {
    stop();
    setFound(null);
    foundRef.current = null;
    if (autoPlay) {
      const t = setTimeout(() => play(), 50);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  async function ensureVideo(): Promise<SearchResult | null> {
    const cached = foundRef.current;
    if (cached && cached.number === numberRef.current) return cached.video;
    // Admin-curated URL takes precedence over search
    const overrideId = extractYouTubeId(videoUrlRef.current);
    if (overrideId) {
      const video: SearchResult = { videoId: overrideId, title, channel: "Playback selecionado" };
      foundRef.current = { number: numberRef.current, video };
      setFound(video);
      return video;
    }
    const { data, error } = await supabase.functions.invoke("youtube-search", {
      body: { number: numberRef.current, title },
    });
    if (error || !data?.videoId) {
      toast.error(data?.error || "Não foi possível encontrar o hino");
      return null;
    }
    const video = data as SearchResult;
    foundRef.current = { number: numberRef.current, video };
    setFound(video);
    return video;
  }

  async function play() {
    try {
      setState("loading");
      const video = await ensureVideo();
      if (!video) {
        setState("idle");
        return;
      }
      const YT = await loadYouTubeApi();

      if (playerRef.current) {
        playerRef.current.playVideo();
        return;
      }
      if (!hostRef.current) return;
      // YT replaces the target element with an iframe. Create a throwaway
      // child div so React never tries to unmount the swapped node.
      const target = document.createElement("div");
      hostRef.current.appendChild(target);
      playerRef.current = new YT.Player(target, {
        height: "0",
        width: "0",
        videoId: video.videoId,
        playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            e.target.playVideo();
            setupMediaSession(video);
          },
          onStateChange: (e: any) => {
            const s = e.data;
            // 1 playing, 2 paused, 0 ended, 3 buffering
            if (s === 1) setState("playing");
            else if (s === 2) setState("paused");
            else if (s === 0) {
              setState("idle");
              try { onEndedRef.current?.(); } catch {}
            } else if (s === 3) setState("loading");
          },
          onError: () => {
            toast.error("Erro ao reproduzir vídeo");
            setState("idle");
          },
        },
      });
    } catch (e) {
      console.error(e);
      setState("idle");
      toast.error("Falha ao iniciar player");
    }
  }

  function pause() {
    try {
      playerRef.current?.pauseVideo();
    } catch {}
  }

  function stop() {
    try {
      playerRef.current?.stopVideo?.();
      playerRef.current?.destroy?.();
    } catch {}
    playerRef.current = null;
    if (hostRef.current) hostRef.current.innerHTML = "";
    setState("idle");
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      } catch {}
    }
  }

  function setupMediaSession(v: SearchResult) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${number}. ${title}`,
        artist: "Harpa Cristã Atalaia",
        album: v.channel || "YouTube",
      });
      navigator.mediaSession.setActionHandler("play", () => play());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("stop", () => stop());
    } catch {}
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">
      <Music2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      {state === "idle" && (
        <button
          onClick={play}
          className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--dark-text))] hover:text-primary transition"
          aria-label="Ouvir hino"
        >
          <Play className="w-3.5 h-3.5" fill="currentColor" />
          Ouvir
        </button>
      )}
      {state === "loading" && (
        <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--dark-muted))]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Buscando…
        </span>
      )}
      {(state === "playing" || state === "paused") && (
        <>
          <button
            onClick={state === "playing" ? pause : play}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition"
            aria-label={state === "playing" ? "Pausar" : "Continuar"}
          >
            {state === "playing" ? (
              <Pause className="w-3 h-3" fill="currentColor" />
            ) : (
              <Play className="w-3 h-3" fill="currentColor" />
            )}
          </button>
          <button
            onClick={stop}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/25 transition"
            aria-label="Parar"
          >
            <Square className="w-3 h-3" fill="currentColor" />
          </button>
          {found && (
            <span className="text-[10px] text-[hsl(var(--dark-muted))] truncate max-w-[140px]">
              {found.channel}
            </span>
          )}
        </>
      )}
      {/* Hidden YouTube iframe host */}
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}