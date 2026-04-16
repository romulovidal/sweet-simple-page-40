import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import type { BibleVerse } from "@/services/bibleApi";

interface AudioBibleProps {
  verses: BibleVerse[];
  selectedVerses?: Set<number>;
  bookName: string;
  chapter: number;
  enabled: boolean;
}

const AudioBible = ({ verses, selectedVerses, bookName, chapter, enabled }: AudioBibleProps) => {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(-1);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const versesToReadRef = useRef<BibleVerse[]>([]);
  const currentIndexRef = useRef(0);

  const displayVerses = selectedVerses && selectedVerses.size > 0
    ? verses.filter(v => selectedVerses.has(v.number))
    : verses;

  useEffect(() => {
    return () => {
      synthRef.current.cancel();
    };
  }, []);

  // Highlight active verse
  useEffect(() => {
    if (currentVerseIndex >= 0 && versesToReadRef.current[currentVerseIndex]) {
      const verseNum = versesToReadRef.current[currentVerseIndex].number;
      const el = document.getElementById(`verse-${verseNum}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "bg-primary/10");
        return () => {
          el.classList.remove("ring-2", "ring-primary", "bg-primary/10");
        };
      }
    }
  }, [currentVerseIndex]);

  const speakVerse = useCallback((index: number) => {
    const versesList = versesToReadRef.current;
    if (index >= versesList.length) {
      setPlaying(false);
      setPaused(false);
      setCurrentVerseIndex(-1);
      return;
    }

    currentIndexRef.current = index;
    setCurrentVerseIndex(index);

    const verse = versesList[index];
    const utt = new SpeechSynthesisUtterance(verse.text);
    utt.lang = "pt-BR";
    utt.rate = 0.9;

    utt.onend = () => {
      speakVerse(index + 1);
    };
    utt.onerror = () => {
      setPlaying(false);
      setPaused(false);
      setCurrentVerseIndex(-1);
    };

    utteranceRef.current = utt;
    synthRef.current.speak(utt);
  }, []);

  const handlePlay = useCallback(() => {
    if (paused) {
      synthRef.current.resume();
      setPaused(false);
      setPlaying(true);
      return;
    }

    synthRef.current.cancel();
    versesToReadRef.current = displayVerses;
    setPlaying(true);
    setPaused(false);
    speakVerse(0);
  }, [displayVerses, paused, speakVerse]);

  const handlePause = useCallback(() => {
    synthRef.current.pause();
    setPaused(true);
    setPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    synthRef.current.cancel();
    setPlaying(false);
    setPaused(false);
    setCurrentVerseIndex(-1);
  }, []);

  if (!enabled || !("speechSynthesis" in window)) return null;

  return (
    <div className="flex items-center gap-2 px-5 py-2">
      <Volume2 className="w-4 h-4 text-primary" />
      <span className="text-[10px] text-[hsl(var(--dark-muted))] flex-1">
        {playing
          ? `Lendo ${selectedVerses && selectedVerses.size > 0 ? `${selectedVerses.size} versículos` : "capítulo"}...`
          : paused
            ? "Pausado"
            : "Ouvir"}
      </span>
      {!playing && (
        <button onClick={handlePlay} className="p-2 rounded-full bg-primary/20 text-primary">
          <Play className="w-4 h-4" />
        </button>
      )}
      {playing && (
        <button onClick={handlePause} className="p-2 rounded-full bg-primary/20 text-primary">
          <Pause className="w-4 h-4" />
        </button>
      )}
      {(playing || paused) && (
        <button onClick={handleStop} className="p-2 rounded-full bg-destructive/20 text-destructive">
          <Square className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AudioBible;
