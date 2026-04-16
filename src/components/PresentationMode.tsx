import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import type { BibleVerse } from "@/services/bibleApi";

interface PresentationModeProps {
  verses: BibleVerse[];
  bookName: string;
  chapter: number;
  selectedVerses?: Set<number>;
  onClose: () => void;
}

const PresentationMode = ({ verses, bookName, chapter, selectedVerses, onClose }: PresentationModeProps) => {
  const displayVerses = selectedVerses && selectedVerses.size > 0
    ? verses.filter(v => selectedVerses.has(v.number))
    : verses;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentVerse = displayVerses[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, displayVerses.length - 1));
  }, [displayVerses.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "Escape") { onClose(); }
      else if (e.key === "f" || e.key === "F") { toggleFullscreen(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, onClose, toggleFullscreen]);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (!currentVerse) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 opacity-60 hover:opacity-100 transition-opacity">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white">
          <X className="w-5 h-5" />
        </button>
        <p className="text-white/60 text-sm">
          {currentIndex + 1} / {displayVerses.length}
        </p>
        <button onClick={toggleFullscreen} className="p-2 rounded-full bg-white/10 text-white">
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="max-w-4xl px-8 text-center">
        <p className="text-white text-3xl md:text-5xl lg:text-6xl font-serif leading-relaxed mb-8">
          "{currentVerse.text}"
        </p>
        <p className="text-white/60 text-lg md:text-xl">
          {bookName} {chapter}:{currentVerse.number}
        </p>
      </div>

      {/* Navigation */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-white/10 text-white disabled:opacity-20 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === displayVerses.length - 1}
          className="p-3 rounded-full bg-white/10 text-white disabled:opacity-20 transition-opacity"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default PresentationMode;
