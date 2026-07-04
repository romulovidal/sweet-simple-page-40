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
};

type SearchResult = { videoId: string; title: string; channel: string };

export default function HarpaMiniPlayer({ number, title, autoPlay, onEnded }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [found, setFound] = useState<SearchResult | null>(null);
  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onEndedRef = useRef<typeof onEnded>(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Reset when hymn changes
  useEffect(() => {
    stop();
    setFound(null);
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
    if (found) return found;
    const { data, error } = await supabase.functions.invoke("youtube-search", {
      body: { number, title },
    });
    if (error || !data?.videoId) {
      toast.error(data?.error || "Não foi possível encontrar o hino");
      return null;
    }
    setFound(data as SearchResult);
    return data as SearchResult;
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