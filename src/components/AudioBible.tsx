import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, Loader2, Headphones } from "lucide-react";
import type { BibleVerse } from "@/services/bibleApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AudioBibleProps {
  verses: BibleVerse[];
  selectedVerses?: Set<number>;
  bookName: string;
  chapter: number;
  enabled: boolean;
}

const VOICE = "alloy";

// In-memory cache of blob URLs per verse for the current session.
const audioCache = new Map<string, string>();

async function fetchVerseAudio(cacheKey: string, text: string): Promise<string> {
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke("tts-verse", {
    body: { text, voice: VOICE },
  });
  if (error) throw error;
  // supabase-js returns a Blob for binary responses.
  const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  audioCache.set(cacheKey, url);
  return url;
}

const AudioBible = ({ verses, selectedVerses, bookName, chapter, enabled }: AudioBibleProps) => {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const versesToReadRef = useRef<BibleVerse[]>([]);
  const stoppedRef = useRef(false);

  const displayVerses =
    selectedVerses && selectedVerses.size > 0
      ? verses.filter((v) => selectedVerses.has(v.number))
      : verses;

  const keyFor = useCallback(
    (verseNum: number) => `${bookName}|${chapter}|${verseNum}|${VOICE}`,
    [bookName, chapter],
  );

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Highlight active verse
  useEffect(() => {
    if (currentVerseIndex < 0) return;
    const verse = versesToReadRef.current[currentVerseIndex];
    if (!verse) return;
    const el = document.getElementById(`verse-${verse.number}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "bg-primary/10", "rounded-lg");
    return () => {
      el.classList.remove("ring-2", "ring-primary", "bg-primary/10", "rounded-lg");
    };
  }, [currentVerseIndex]);

  const playIndex = useCallback(
    async (index: number) => {
      const list = versesToReadRef.current;
      if (stoppedRef.current) return;
      if (index >= list.length) {
        setPlaying(false);
        setPaused(false);
        setLoading(false);
        setCurrentVerseIndex(-1);
        return;
      }

      setCurrentVerseIndex(index);
      const verse = list[index];
      try {
        setLoading(true);
        const url = await fetchVerseAudio(keyFor(verse.number), verse.text);
        if (stoppedRef.current) return;
        setLoading(false);

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          // pré-fetch do próximo já rola em paralelo abaixo
          playIndex(index + 1);
        };
        audio.onerror = () => {
          toast.error("Erro ao reproduzir áudio.");
          setPlaying(false);
          setLoading(false);
          setCurrentVerseIndex(-1);
        };
        await audio.play();

        // Pré-carrega o próximo versículo enquanto este toca
        const next = list[index + 1];
        if (next) {
          fetchVerseAudio(keyFor(next.number), next.text).catch(() => {});
        }
      } catch (err: any) {
        setLoading(false);
        setPlaying(false);
        setCurrentVerseIndex(-1);
        const msg = err?.message || "";
        if (msg.includes("429")) {
          toast.error("Limite de uso atingido. Tente novamente em instantes.");
        } else if (msg.includes("402")) {
          toast.error("Créditos de IA esgotados.");
        } else {
          toast.error("Não foi possível gerar o áudio.");
        }
      }
    },
    [keyFor],
  );

  const handlePlay = useCallback(async () => {
    if (paused && audioRef.current) {
      await audioRef.current.play();
      setPaused(false);
      setPlaying(true);
      return;
    }
    stoppedRef.current = false;
    versesToReadRef.current = displayVerses;
    if (displayVerses.length === 0) return;
    setPlaying(true);
    setPaused(false);
    await playIndex(0);
  }, [displayVerses, paused, playIndex]);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    setPaused(true);
    setPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setPlaying(false);
    setPaused(false);
    setLoading(false);
    setCurrentVerseIndex(-1);
  }, []);

  if (!enabled) return null;

  const active = playing || paused || loading;
  const currentVerseNum =
    currentVerseIndex >= 0 ? versesToReadRef.current[currentVerseIndex]?.number : null;

  return (
    <>
      {/* Botão inline no topo do capítulo */}
      <div className="flex items-center gap-2 px-5 py-2">
        <Headphones className="w-4 h-4 text-primary" />
        <span className="text-[11px] text-[hsl(var(--dark-muted))] flex-1">
          {loading
            ? "Gerando áudio..."
            : playing
              ? `Ouvindo ${selectedVerses && selectedVerses.size > 0 ? `${selectedVerses.size} versículos` : "capítulo"}`
              : paused
                ? "Pausado"
                : "Ouvir capítulo (IA)"}
        </span>
        {!playing && !loading && (
          <button
            onClick={handlePlay}
            className="p-2 rounded-full bg-primary/20 text-primary"
            aria-label="Ouvir capítulo"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <button disabled className="p-2 rounded-full bg-primary/20 text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
          </button>
        )}
        {playing && (
          <button
            onClick={handlePause}
            className="p-2 rounded-full bg-primary/20 text-primary"
            aria-label="Pausar"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        {(playing || paused) && (
          <button
            onClick={handleStop}
            className="p-2 rounded-full bg-destructive/20 text-destructive"
            aria-label="Parar"
          >
            <Square className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mini-player flutuante persistente */}
      {active && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,420px)]">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-background/95 backdrop-blur border border-primary/30 shadow-lg shadow-primary/10">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : playing ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[hsl(var(--dark-muted))] leading-tight truncate">
                {bookName} {chapter}
              </div>
              <div className="text-xs font-medium leading-tight truncate">
                {loading
                  ? "Gerando áudio..."
                  : currentVerseNum
                    ? `Versículo ${currentVerseNum}`
                    : paused
                      ? "Pausado"
                      : "Ouvindo"}
              </div>
            </div>
            {playing ? (
              <button
                onClick={handlePause}
                className="p-1.5 rounded-full hover:bg-primary/10 text-primary"
                aria-label="Pausar"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              !loading && (
                <button
                  onClick={handlePlay}
                  className="p-1.5 rounded-full hover:bg-primary/10 text-primary"
                  aria-label="Continuar"
                >
                  <Play className="w-4 h-4" />
                </button>
              )
            )}
            <button
              onClick={handleStop}
              className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive"
              aria-label="Parar"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AudioBible;
