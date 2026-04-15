import { useEffect, useState, useCallback } from "react";
import { useFontSize } from "@/hooks/useFontSize";
import FontSizeControls from "@/components/FontSizeControls";
import { useSearchParams } from "react-router-dom";
import { bibleBooks, type BibleBook } from "@/data/bible";
import {
  getChapter,
  bookNameMap,
  type BibleChapterEpigraph,
  type BibleVerse,
  DEFAULT_VERSION_ID,
  getVersionById,
} from "@/services/bibleApi";
import { isRedLetterVerse } from "@/data/redLetterVerses";
import { ChevronLeft, Search, BookmarkPlus, Share2, Loader2, ImageIcon, X, Palette, Ban, ChevronDown } from "lucide-react";
import { useLocalStorage, type SavedVerse, type ReadingProgress, type StreakData, type HighlightedVerse, updateStreak } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import BibleEpigraph from "@/components/BibleEpigraph";
import BibleVersionPicker from "@/components/BibleVersionPicker";
import VerseImageGenerator from "@/components/VerseImageGenerator";
import ShareMenu from "@/components/ShareMenu";

const APP_URL = window.location.origin;

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", value: "#fbbf24" },
  { name: "Verde", value: "#34d399" },
  { name: "Azul", value: "#60a5fa" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Roxo", value: "#a78bfa" },
  { name: "Laranja", value: "#fb923c" },
];

const BiblePage = () => {
  const { fontSize, increase: incFont, decrease: decFont, canIncrease: canIncFont, canDecrease: canDecFont } = useFontSize();
  const [searchParams, setSearchParams] = useSearchParams();
  const [testament, setTestament] = useState<"VT" | "NT">("VT");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [epigraphs, setEpigraphs] = useState<BibleChapterEpigraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterRequestKey, setChapterRequestKey] = useState(0);
  const [imageVerse, setImageVerse] = useState<{ text: string; reference: string } | null>(null);
  const [bibleVersion, setBibleVersion] = useLocalStorage<string>("bible-version", DEFAULT_VERSION_ID);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Multi-select state
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareMenuText, setShareMenuText] = useState("");

  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [highlights, setHighlights] = useLocalStorage<HighlightedVerse[]>("highlighted-verses", []);
  const [progress, setProgress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);
  const [, setStreak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });

  // On mount, restore last reading position if no search params
  useEffect(() => {
    const hasParams = searchParams.get("book") && searchParams.get("chapter");
    if (!hasParams && !selectedBook && progress) {
      const book = bibleBooks.find((b) => b.apiAbbrev === progress.bookAbbrev);
      if (book) {
        setSelectedBook(book);
        setTestament(book.testament);
        setSelectedChapter(progress.chapter);
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset selection when chapter changes
  useEffect(() => {
    setSelectedVerses(new Set());
    setShowColorPicker(false);
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

  const versionPickerModal = (
    <BibleVersionPicker
      open={showVersionPicker}
      selectedVersionId={bibleVersion}
      onClose={() => setShowVersionPicker(false)}
      onSelect={(versionId) => {
        setBibleVersion(versionId);
        setShowVersionPicker(false);
      }}
    />
  );

  useEffect(() => {
    if (!selectedBook || !selectedChapter) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getChapter(selectedBook.apiAbbrev, selectedChapter, bibleVersion)
      .then((data) => {
        if (cancelled) return;
        setVerses(data.verses);
        setEpigraphs(data.epigraphs);
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
        setEpigraphs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterRequestKey, selectedBook, selectedChapter, bibleVersion, setProgress, setStreak]);

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
      return next;
    });
  }, []);

  const getVerseHighlight = useCallback((verseNumber: number) => {
    if (!selectedBook || !selectedChapter) return undefined;
    const ref = `${selectedBook.name} ${selectedChapter}:${verseNumber}`;
    return highlights.find((h) => h.reference === ref)?.color;
  }, [selectedBook, selectedChapter, highlights]);

  // Build share text from selected verses
  const buildShareContent = useCallback(() => {
    if (!selectedBook || !selectedChapter) return { text: "", reference: "", link: "" };

    const sortedNumbers = Array.from(selectedVerses).sort((a, b) => a - b);
    const selectedTexts = sortedNumbers
      .map((num) => verses.find((v) => v.number === num))
      .filter(Boolean) as BibleVerse[];

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const handleShareSelected = async () => {
    const { text, reference, link } = buildShareContent();
    if (!reference) return;
    const shareText = `${reference}\n\n"${text}"\n\n📖 Leia aqui: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: reference, text: shareText });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    setShareMenuText(shareText);
    setShowShareMenu(true);
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
  };

  const handleHighlightSelected = (color: string) => {
    if (!selectedBook || !selectedChapter) return;
    const sortedNumbers = Array.from(selectedVerses).sort((a, b) => a - b);

    const newHighlights = [...highlights];
    const newSaved = [...savedVerses];
    let addedCount = 0;

    for (const num of sortedNumbers) {
      const verse = verses.find((v) => v.number === num);
      if (!verse) continue;
      const reference = `${selectedBook.name} ${selectedChapter}:${num}`;

      // Update or add highlight
      const existingIdx = newHighlights.findIndex((h) => h.reference === reference);
      if (existingIdx >= 0) {
        newHighlights[existingIdx] = { reference, color };
      } else {
        newHighlights.push({ reference, color });
      }

      // Also save if not already saved
      if (!newSaved.some((s) => s.reference === reference)) {
        newSaved.push({ text: verse.text, reference, savedAt: new Date().toISOString(), highlightColor: color });
        addedCount++;
      } else {
        // Update highlight color on saved verse
        const savedIdx = newSaved.findIndex((s) => s.reference === reference);
        if (savedIdx >= 0) newSaved[savedIdx] = { ...newSaved[savedIdx], highlightColor: color };
      }
    }

    setHighlights(newHighlights);
    setSavedVerses(newSaved);
    setShowColorPicker(false);
    setSelectedVerses(new Set());
    toast(`${sortedNumbers.length} versículo${sortedNumbers.length > 1 ? "s" : ""} destacado${sortedNumbers.length > 1 ? "s" : ""}!`);
  };

  const handleRemoveHighlight = (verseNumber: number) => {
    if (!selectedBook || !selectedChapter) return;
    const reference = `${selectedBook.name} ${selectedChapter}:${verseNumber}`;
    setHighlights((prev) => prev.filter((h) => h.reference !== reference));
    setSavedVerses((prev) => prev.filter((s) => s.reference !== reference));
  };

  const handleRemoveHighlightSelected = () => {
    if (!selectedBook || !selectedChapter) return;
    const sortedNumbers = Array.from(selectedVerses).sort((a, b) => a - b);

    const refsToRemove = sortedNumbers.map((num) => `${selectedBook.name} ${selectedChapter}:${num}`);
    setHighlights((prev) => prev.filter((h) => !refsToRemove.includes(h.reference)));
    setSavedVerses((prev) => prev.filter((s) => !refsToRemove.includes(s.reference)));

    setShowColorPicker(false);
    setSelectedVerses(new Set());
    toast("Destaque removido!");
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
      handleRemoveHighlight(verse.number);
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
    try {
      if (navigator.share) {
        await navigator.share({ title: reference, text: shareText });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    setShareMenuText(shareText);
    setShowShareMenu(true);
  };

  const isVerseSaved = (verse: BibleVerse) => {
    if (!selectedBook || !selectedChapter) return false;
    const reference = `${selectedBook.name} ${selectedChapter}:${verse.number}`;
    return savedVerses.some((savedVerse) => savedVerse.reference === reference);
  };

  // ── Chapter view with verses ──
  if (selectedBook && selectedChapter) {
    const hasSelection = selectedVerses.size > 0;

    const currentVersion = getVersionById(bibleVersion);

    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 bg-dark-bg z-10">
          <button
            onClick={() => {
              setSelectedChapter(null);
              setHighlightedVerse(null);
              setVerses([]);
              setEpigraphs([]);
              setSelectedVerses(new Set());
            }}
            className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1 truncate">
            {selectedBook.name} {selectedChapter}
          </h1>
          {hasSelection ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-primary font-semibold mr-1">
                {selectedVerses.size}
              </span>
              <button
                onClick={() => setSelectedVerses(new Set())}
                className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FontSizeControls fontSize={fontSize} canIncrease={canIncFont} canDecrease={canDecFont} onIncrease={incFont} onDecrease={decFont} />
              <button
                onClick={() => setShowVersionPicker(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-dark-card text-xs font-semibold"
              >
                {currentVersion.shortName}
                <ChevronDown className="w-3 h-3 text-dark-muted" />
              </button>
            </div>
          )}
        </header>

        {/* Floating action bar */}
        {hasSelection && (
          <div className="sticky top-[72px] z-10 mx-5 mb-2">
            <div className="bg-primary rounded-xl px-4 py-3 flex items-center justify-between gap-2 shadow-lg">
              <span className="text-xs font-semibold text-primary-foreground">
                {selectedVerses.size} versículo{selectedVerses.size !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-2 rounded-lg bg-primary-foreground/20 active:bg-primary-foreground/30">
                  <Palette className="w-4 h-4 text-primary-foreground" />
                </button>
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

            {/* Color picker */}
            {showColorPicker && (
              <div className="mt-2 bg-dark-card rounded-xl p-4 shadow-lg animate-fade-up">
                <p className="text-xs text-dark-muted font-semibold mb-3">Escolha uma cor para destacar</p>
                <div className="flex items-center gap-3 justify-center">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => handleHighlightSelected(c.value)}
                      className="w-9 h-9 rounded-full border-2 border-transparent hover:border-white/50 active:scale-90 transition-all"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                  <button
                    onClick={handleRemoveHighlightSelected}
                    className="w-9 h-9 rounded-full border-2 border-dark-muted bg-white/10 flex items-center justify-center hover:border-white/50 active:scale-90 transition-all"
                    title="Remover destaque"
                  >
                    <Ban className="w-5 h-5 text-dark-muted" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-4">
          {highlightedVerse && !loading && !error && !hasSelection && (
            <div className="mb-4 bg-primary/10 rounded-xl px-4 py-3">
              <p className="text-xs text-primary font-semibold">Versículo em destaque: {highlightedVerse}</p>
            </div>
          )}

          {!loading && !error && verses.length > 0 && !currentVersion.supportsEpigraphs && (
            <div className="mb-4 rounded-xl border border-dark-card bg-dark-card/60 px-4 py-3">
              <p className="text-xs text-dark-muted">
                A edicao {currentVersion.shortName} disponivel aqui nao inclui epigrafes no arquivo fonte.
              </p>
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
            <div className="space-y-0.5">
              {verses.map((verse) => {
                const verseEpigraphs = epigraphs.filter((epigraph) => epigraph.displayVerse === verse.number);
                const isUrlHighlighted = highlightedVerse === verse.number && !hasSelection;
                const isSelected = selectedVerses.has(verse.number);
                const highlightColor = getVerseHighlight(verse.number);
                const isRedLetter = isRedLetterVerse(selectedBook.apiAbbrev, selectedChapter, verse.number);

                return (
                  <div key={verse.number}>
                    {verseEpigraphs.map((epigraph) => (
                      <BibleEpigraph
                        key={`${epigraph.title}-${epigraph.start.chapter}-${epigraph.start.verse}`}
                        title={epigraph.title}
                        continuesFromPreviousChapter={epigraph.continuesFromPreviousChapter}
                      />
                    ))}
                    <VerseRow
                      verse={verse}
                      isHighlighted={isUrlHighlighted}
                      isSelected={isSelected}
                      highlightColor={highlightColor}
                      isRedLetter={isRedLetter}
                      isSaved={isVerseSaved(verse)}
                      onTap={toggleVerseSelection}
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
                  </div>
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
        {versionPickerModal}
        <ShareMenu text={shareMenuText} open={showShareMenu} onClose={() => setShowShareMenu(false)} />
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
        {versionPickerModal}
      </div>
    );
  }

  // ── Book list ──
  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Bíblia</h1>
          <button
            onClick={() => setShowVersionPicker(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-card text-xs font-semibold"
          >
            {getVersionById(bibleVersion).shortName}
            <ChevronDown className="w-3 h-3 text-dark-muted" />
          </button>
        </div>
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
      {versionPickerModal}
      <ShareMenu text={shareMenuText} open={showShareMenu} onClose={() => setShowShareMenu(false)} />
    </div>
  );
};

// ── Verse Row Component ──
interface VerseRowProps {
  verse: BibleVerse;
  isHighlighted: boolean;
  isSelected: boolean;
  highlightColor?: string;
  isRedLetter?: boolean;
  isSaved: boolean;
  onTap: (verseNumber: number) => void;
  onSave: (v: BibleVerse) => void;
  onShare: (v: BibleVerse) => void;
  onImage: (v: BibleVerse) => void;
}

const VerseRow = ({ verse, isHighlighted, isSelected, highlightColor, isRedLetter, isSaved, onTap, onSave, onShare, onImage }: VerseRowProps) => {
  return (
    <div
      id={`verse-${verse.number}`}
      className={`group scroll-mt-24 rounded-lg transition-all py-2.5 px-3 cursor-pointer active:scale-[0.99] ${
        isHighlighted ? "bg-primary/10" : ""
      } ${isSelected ? "bg-primary/20 ring-1 ring-primary/40" : ""}`}
      style={
        highlightColor && !isSelected
          ? { backgroundColor: `${highlightColor}18`, borderLeft: `3px solid ${highlightColor}` }
          : undefined
      }
      onClick={() => onTap(verse.number)}
    >
      <p className={`text-sm leading-relaxed ${isRedLetter ? "text-red-400" : ""}`}>
        <span
          className="font-bold mr-2 text-xs align-super"
          style={highlightColor ? { color: highlightColor } : isRedLetter ? { color: "#ef4444" } : undefined}
        >
          {verse.number}
        </span>
        {verse.text}
      </p>
      {!isSelected && (
        <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
