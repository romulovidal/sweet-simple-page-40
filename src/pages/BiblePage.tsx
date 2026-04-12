import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { bibleBooks, type BibleBook } from "@/data/bible";
import { getChapter, type BibleVerse } from "@/services/bibleApi";
import { ChevronLeft, Search, BookmarkPlus, Share2, Loader2, ImageIcon, X, CheckSquare } from "lucide-react";
import { useLocalStorage, type SavedVerse, type ReadingProgress, type StreakData, updateStreak } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import VerseImageGenerator from "@/components/VerseImageGenerator";

const APP_URL = window.location.origin;

const BiblePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [testament, setTestament] = useState<"VT" | "NT">("VT");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterRequestKey, setChapterRequestKey] = useState(0);
  const [imageVerse, setImageVerse] = useState<{ text: string; reference: string } | null>(null);

  // Multi-select state
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [, setProgress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);
  const [, setStreak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });

  // Reset selection when chapter changes
  useEffect(() => {
    setSelectedVerses(new Set());
    setSelectionMode(false);
  }, [selectedChapter, selectedBook]);

  useEffect(() => {
    const bookParam = searchParams.get("book");
    const chapterParam = searchParams.get("chapter");
    const verseParam = searchParams.get("verse");

    if (!bookParam || !chapterParam) return;

    const book = bibleBooks.find((item) => item.apiAbbrev === bookParam);
    const nextChapter = Number(chapterParam);
    const nextVerse = verseParam ? Number(verseParam) : null;

    if (!book || Number.isNaN(nextChapter)) return;

    setSelectedBook(book);
    setTestament(book.testament);
    setSelectedChapter(nextChapter);
    setHighlightedVerse(nextVerse && nextVerse > 0 ? nextVerse : null);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const filteredBooks = bibleBooks.filter(
    (book) =>
      book.testament === testament &&
      book.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!selectedBook || !selectedChapter) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getChapter(selectedBook.apiAbbrev, selectedChapter)
      .then((data) => {
        if (cancelled) return;
        setVerses(data.verses);
        setProgress({
          bookAbbrev: selectedBook.apiAbbrev,
          bookName: selectedBook.name,
          chapter: selectedChapter,
          lastRead: new Date().toISOString(),
        });
        setStreak((prev) => updateStreak(prev));
      })
      .catch((err) => {
        if (cancelled) return;
        setError("Não foi possível carregar os versículos. Tente novamente.");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterRequestKey, selectedBook, selectedChapter, setProgress, setStreak]);

  useEffect(() => {
    if (!highlightedVerse || verses.length === 0 || loading) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`verse-${highlightedVerse}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightedVerse, loading, verses.length]);

  const toggleVerseSelection = useCallback((verseNumber: number) => {
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(verseNumber)) {
        next.delete(verseNumber);
      } else {
        next.add(verseNumber);
      }
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const handleVerseTap = useCallback((verse: BibleVerse) => {
    if (selectionMode) {
      toggleVerseSelection(verse.number);
    }
  }, [selectionMode, toggleVerseSelection]);

  const handleVerseLongPress = useCallback((verse: BibleVerse) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedVerses(new Set([verse.number]));
    }
  }, [selectionMode]);

  // Build share text from selected verses
  const buildShareContent = useCallback(() => {
    if (!selectedBook || !selectedChapter) return { text: "", reference: "", link: "" };

    const sortedNumbers = Array.from(selectedVerses).sort((a, b) => a - b);
    const selectedTexts = sortedNumbers
      .map((num) => verses.find((v) => v.number === num))
      .filter(Boolean) as BibleVerse[];

    // Build compact reference like "João 3:16-18" or "João 3:16,18,20"
    const ranges: string[] = [];
    let rangeStart = sortedNumbers[0];
    let rangeEnd = sortedNumbers[0];

    for (let i = 1; i < sortedNumbers.length; i++) {
      if (sortedNumbers[i] === rangeEnd + 1) {
        rangeEnd = sortedNumbers[i];
      } else {
        ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
        rangeStart = sortedNumbers[i];
        rangeEnd = sortedNumbers[i];
      }
    }
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

    const reference = `${selectedBook.name} ${selectedChapter}:${ranges.join(",")}`;
    const content = selectedTexts.map((v) => `${v.number} ${v.text}`).join(" ");
    const link = `${APP_URL}/biblia?book=${selectedBook.apiAbbrev}&chapter=${selectedChapter}&verse=${sortedNumbers[0]}`;

    return { text: content, reference, link };
  }, [selectedBook, selectedChapter, selectedVerses, verses]);

  const handleShareSelected = async () => {
    const { text, reference, link } = buildShareContent();
    if (!reference) return;

    const shareText = `${reference}\n\n"${text}"\n\n📖 Leia aqui: ${link}`;

    if (navigator.share) {
      await navigator.share({ title: reference, text: shareText }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareText);
      toast("Versículos copiados!");
    }
  };

  const handleSaveSelected = () => {
    if (!selectedBook || !selectedChapter) return;
    const sortedNumbers = Array.from(selectedVerses).sort((a, b) => a - b);

    let addedCount = 0;
    const newSaved = [...savedVerses];

    for (const num of sortedNumbers) {
      const verse = verses.find((v) => v.number === num);
      if (!verse) continue;
      const reference = `${selectedBook.name} ${selectedChapter}:${num}`;
      if (!newSaved.some((s) => s.reference === reference)) {
        newSaved.push({ text: verse.text, reference, savedAt: new Date().toISOString() });
        addedCount++;
      }
    }

    setSavedVerses(newSaved);
    toast(`${addedCount} versículo${addedCount > 1 ? "s" : ""} salvo${addedCount > 1 ? "s" : ""}!`);
    setSelectedVerses(new Set());
    setSelectionMode(false);
  };

  const handleImageSelected = () => {
    const { text, reference } = buildShareContent();
    if (reference) {
      setImageVerse({ text, reference });
    }
  };

  const handleSaveVerse = (verse: BibleVerse) => {
    if (!selectedBook || !selectedChapter) return;

    const reference = `${selectedBook.name} ${selectedChapter}:${verse.number}`;
    const alreadySaved = savedVerses.some((savedVerse) => savedVerse.reference === reference);

    if (alreadySaved) {
      setSavedVerses((prev) => prev.filter((savedVerse) => savedVerse.reference !== reference));
      toast("Versículo removido dos salvos");
      return;
    }

    setSavedVerses((prev) => [
      ...prev,
      { text: verse.text, reference, savedAt: new Date().toISOString() },
    ]);
    toast("Versículo salvo!");
  };

  const handleShareVerse = async (verse: BibleVerse) => {
    if (!selectedBook || !selectedChapter) return;

    const reference = `${selectedBook.name} ${selectedChapter}:${verse.number}`;
    const link = `${APP_URL}/biblia?book=${selectedBook.apiAbbrev}&chapter=${selectedChapter}&verse=${verse.number}`;
    const shareText = `${reference}\n\n"${verse.text}"\n\n📖 Leia aqui: ${link}`;

    if (navigator.share) {
      await navigator.share({ title: reference, text: shareText }).catch(() => {});
      return;
    }

    await navigator.clipboard.writeText(shareText);
    toast("Versículo copiado!");
  };

  const isVerseSaved = (verse: BibleVerse) => {
    if (!selectedBook || !selectedChapter) return false;
    const reference = `${selectedBook.name} ${selectedChapter}:${verse.number}`;
    return savedVerses.some((savedVerse) => savedVerse.reference === reference);
  };

  // ── Chapter view with verses ──
  if (selectedBook && selectedChapter) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 bg-dark-bg z-10">
          <button
            onClick={() => {
              setSelectedChapter(null);
              setHighlightedVerse(null);
              setVerses([]);
              setSelectedVerses(new Set());
              setSelectionMode(false);
            }}
            className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">
            {selectedBook.name} {selectedChapter}
          </h1>
          {!selectionMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className="ml-auto w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
              title="Selecionar versículos"
            >
              <CheckSquare className="w-4 h-4 text-dark-muted" />
            </button>
          )}
          {selectionMode && (
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-primary font-semibold mr-1">
                {selectedVerses.size} selecionado{selectedVerses.size !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => { setSelectionMode(false); setSelectedVerses(new Set()); }}
                className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        {/* Selection action bar */}
        {selectionMode && selectedVerses.size > 0 && (
          <div className="sticky top-[72px] z-10 mx-5 mb-2 bg-primary rounded-xl px-4 py-3 flex items-center justify-between gap-2 shadow-lg">
            <span className="text-xs font-semibold text-primary-foreground">
              {selectedVerses.size} versículo{selectedVerses.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={handleShareSelected} className="p-2 rounded-lg bg-primary-foreground/20 active:bg-primary-foreground/30">
                <Share2 className="w-4 h-4 text-primary-foreground" />
              </button>
              <button onClick={handleSaveSelected} className="p-2 rounded-lg bg-primary-foreground/20 active:bg-primary-foreground/30">
                <BookmarkPlus className="w-4 h-4 text-primary-foreground" />
              </button>
              <button onClick={handleImageSelected} className="p-2 rounded-lg bg-primary-foreground/20 active:bg-primary-foreground/30">
                <ImageIcon className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-4">
          {highlightedVerse && !loading && !error && !selectionMode && (
            <div className="mb-4 bg-primary/10 rounded-xl px-4 py-3">
              <p className="text-xs text-primary font-semibold">Versículo em destaque: {highlightedVerse}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <button
                onClick={() => setChapterRequestKey((value) => value + 1)}
                className="text-primary text-sm font-semibold"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && verses.length > 0 && (
            <div className="space-y-1">
              {verses.map((verse) => {
                const isHighlighted = highlightedVerse === verse.number && !selectionMode;
                const isSelected = selectedVerses.has(verse.number);

                return (
                  <VerseRow
                    key={verse.number}
                    verse={verse}
                    isHighlighted={isHighlighted}
                    isSelected={isSelected}
                    selectionMode={selectionMode}
                    isSaved={isVerseSaved(verse)}
                    onTap={handleVerseTap}
                    onLongPress={handleVerseLongPress}
                    onSave={handleSaveVerse}
                    onShare={handleShareVerse}
                    onImage={(v) => {
                      if (!selectedBook || !selectedChapter) return;
                      setImageVerse({
                        text: v.text,
                        reference: `${selectedBook.name} ${selectedChapter}:${v.number}`,
                      });
                    }}
                  />
                );
              })}
            </div>
          )}

          {!loading && verses.length > 0 && (
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-dark-card">
              <button
                onClick={() => {
                  if (selectedChapter <= 1) return;
                  setHighlightedVerse(null);
                  setSelectedChapter(selectedChapter - 1);
                }}
                disabled={selectedChapter <= 1}
                className="text-sm font-semibold text-primary disabled:opacity-30"
              >
                ← Capítulo {selectedChapter - 1}
              </button>
              <button
                onClick={() => {
                  if (selectedChapter >= selectedBook.chapters) return;
                  setHighlightedVerse(null);
                  setSelectedChapter(selectedChapter + 1);
                }}
                disabled={selectedChapter >= selectedBook.chapters}
                className="text-sm font-semibold text-primary disabled:opacity-30"
              >
                Capítulo {selectedChapter + 1} →
              </button>
            </div>
          )}
        </div>

        {imageVerse && (
          <VerseImageGenerator
            text={imageVerse.text}
            reference={imageVerse.reference}
            open={!!imageVerse}
            onClose={() => setImageVerse(null)}
          />
        )}
      </div>
    );
  }

  // ── Chapter picker ──
  if (selectedBook) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedBook(null);
              setHighlightedVerse(null);
            }}
            className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{selectedBook.name}</h1>
          <span className="text-xs text-dark-muted">
            {selectedBook.chapters} capítulos
          </span>
        </header>
        <div className="px-5 grid grid-cols-5 gap-2">
          {Array.from({ length: selectedBook.chapters }, (_, index) => (
            <button
              key={index + 1}
              onClick={() => {
                setHighlightedVerse(null);
                setSelectedChapter(index + 1);
              }}
              className="aspect-square rounded-xl bg-dark-card flex items-center justify-center text-sm font-semibold active:bg-primary active:text-primary-foreground transition-colors"
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Book list ──
  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold mb-4">Bíblia</h1>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar livro..."
            className="w-full bg-dark-card rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2">
          {(["VT", "NT"] as const).map((currentTestament) => (
            <button
              key={currentTestament}
              onClick={() => setTestament(currentTestament)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                testament === currentTestament
                  ? "bg-primary text-primary-foreground"
                  : "bg-dark-card text-dark-muted"
              }`}
            >
              {currentTestament === "VT" ? "Velho Testamento" : "Novo Testamento"}
            </button>
          ))}
        </div>
      </header>
      <div className="px-5 space-y-1">
        {filteredBooks.map((book) => (
          <button
            key={book.abbrev}
            onClick={() => {
              setHighlightedVerse(null);
              setSelectedBook(book);
            }}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-xl active:bg-dark-card transition-colors text-left"
          >
            <div>
              <p className="font-semibold text-sm">{book.name}</p>
              <p className="text-xs text-dark-muted">
                {book.chapters} capítulo{book.chapters > 1 ? "s" : ""}
              </p>
            </div>
            <span className="text-xs text-dark-muted">{book.abbrev}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Verse Row Component ──
interface VerseRowProps {
  verse: BibleVerse;
  isHighlighted: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  isSaved: boolean;
  onTap: (v: BibleVerse) => void;
  onLongPress: (v: BibleVerse) => void;
  onSave: (v: BibleVerse) => void;
  onShare: (v: BibleVerse) => void;
  onImage: (v: BibleVerse) => void;
}

const VerseRow = ({ verse, isHighlighted, isSelected, selectionMode, isSaved, onTap, onLongPress, onSave, onShare, onImage }: VerseRowProps) => {
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    const timer = setTimeout(() => {
      onLongPress(verse);
    }, 500);
    setPressTimer(timer);
  };

  const handlePointerUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleClick = () => {
    if (selectionMode) {
      onTap(verse);
    }
  };

  return (
    <div
      id={`verse-${verse.number}`}
      className={`group scroll-mt-24 rounded-xl transition-all py-2 px-3 ${
        isHighlighted ? "bg-primary/10" : ""
      } ${isSelected ? "bg-primary/20 ring-1 ring-primary/40" : ""} ${
        selectionMode ? "cursor-pointer active:bg-primary/15" : ""
      }`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="flex items-start gap-2">
        {selectionMode && (
          <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected ? "bg-primary border-primary" : "border-dark-muted"
          }`}>
            {isSelected && <span className="text-primary-foreground text-xs font-bold">✓</span>}
          </div>
        )}
        <p className="text-sm leading-relaxed flex-1">
          <span className="text-primary font-bold mr-2 text-xs align-super">{verse.number}</span>
          {verse.text}
        </p>
      </div>
      {!selectionMode && (
        <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onSave(verse); }} className="p-1">
            <BookmarkPlus
              className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : "text-dark-muted"}`}
            />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onShare(verse); }} className="p-1">
            <Share2 className="w-4 h-4 text-dark-muted" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onImage(verse); }} className="p-1">
            <ImageIcon className="w-4 h-4 text-dark-muted" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BiblePage;
