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
import { ChevronLeft, Search, BookmarkPlus, Share2, Loader2, ImageIcon, X, Palette, Ban, ChevronDown, GitCompareArrows, Monitor, Settings, StickyNote } from "lucide-react";
import { useLocalStorage, type SavedVerse, type ReadingProgress, type StreakData, type HighlightedVerse, updateStreak } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import BibleEpigraph from "@/components/BibleEpigraph";
import BibleVersionPicker from "@/components/BibleVersionPicker";
import VerseImageGenerator from "@/components/VerseImageGenerator";
import VerseCompare from "@/components/VerseCompare";
import ShareMenu from "@/components/ShareMenu";
import ExegetAI from "@/components/ExegetAI";
import AIChapterSummary from "@/components/ai/AIChapterSummary";
import AIConnections from "@/components/ai/AIConnections";
import AIWordMeaning from "@/components/ai/AIWordMeaning";
import AITimeline from "@/components/ai/AITimeline";
import PageHead from "@/components/PageHead";
import { createShortVerseLink } from "@/lib/verseShare";
import { useAIFeatures } from "@/hooks/useAIFeatures";
import { useAppFeatures } from "@/hooks/useAppFeatures";
import PresentationMode from "@/components/PresentationMode";
import AudioBible from "@/components/AudioBible";
import PersonalNotes from "@/components/PersonalNotes";
import { useBackHandler } from "@/hooks/useBackHandler";
import ScheduleDailyVerseButton from "@/components/ScheduleDailyVerseButton";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const APP_URL = window.location.origin;

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", value: "#fbbf24" },
  { name: "Verde", value: "#34d399" },
  { name: "Azul", value: "#60a5fa" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Roxo", value: "#a78bfa" },
  { name: "Laranja", value: "#fb923c" },
];

type BibleNavigationView =
  | { kind: "books" }
  | { kind: "chapters"; bookAbbrev: string }
  | { kind: "chapter"; bookAbbrev: string; chapter: number };

const findBibleBookByAbbrev = (bookAbbrev: string) =>
  bibleBooks.find((book) => book.apiAbbrev === bookAbbrev || book.abbrev === bookAbbrev);

const isBibleNavigationView = (value: unknown): value is BibleNavigationView => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BibleNavigationView>;
  if (candidate.kind === "books") return true;
  if (candidate.kind === "chapters" && typeof candidate.bookAbbrev === "string") {
    return !!findBibleBookByAbbrev(candidate.bookAbbrev);
  }
  if (
    candidate.kind === "chapter" &&
    typeof candidate.bookAbbrev === "string" &&
    typeof candidate.chapter === "number"
  ) {
    const book = findBibleBookByAbbrev(candidate.bookAbbrev);
    return !!book && candidate.chapter >= 1 && candidate.chapter <= book.chapters;
  }
  return false;
};

const getBibleNavigationView = (
  book: BibleBook | null,
  chapter: number | null
): BibleNavigationView => {
  if (!book) return { kind: "books" };
  if (!chapter) return { kind: "chapters", bookAbbrev: book.apiAbbrev };
  return { kind: "chapter", bookAbbrev: book.apiAbbrev, chapter };
};

const isSameBibleNavigationView = (a: unknown, b: BibleNavigationView) => {
  if (!isBibleNavigationView(a)) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "books") return true;
  if (b.kind === "books") return true;
  if (a.bookAbbrev !== b.bookAbbrev) return false;
  return a.kind === "chapters" || a.chapter === (b as { kind: "chapter"; chapter: number }).chapter;
};

const writeBibleHistory = (view: BibleNavigationView, mode: "push" | "replace") => {
  const state = { ...(window.history.state || {}), __bibleView: view };
  if (mode === "replace") {
    window.history.replaceState(state, "", window.location.href);
  } else {
    window.history.pushState(state, "", window.location.href);
  }
};

const BiblePage = () => {
  const { features: aiFeatures } = useAIFeatures();
  const { features: appFeatures } = useAppFeatures();
  const { isAdmin } = useIsAdmin();
  const [showPresentation, setShowPresentation] = useState(false);
  const { fontSize, increase: incFont, decrease: decFont, canIncrease: canIncFont, canDecrease: canDecFont } = useFontSize();
  const [searchParams, setSearchParams] = useSearchParams();
  const [testament, setTestament] = useState<"VT" | "NT">("VT");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [highlightedVerses, setHighlightedVerses] = useState<Set<number>>(new Set());
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
  const [showCompare, setShowCompare] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareMenuText, setShareMenuText] = useState("");

  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [highlights, setHighlights] = useLocalStorage<HighlightedVerse[]>("highlighted-verses", []);
  const [progress, setProgress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);
  const [, setStreak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });

  // Native-like back behavior: closes overlays/modals before navigating away.
  useBackHandler(showColorPicker, () => setShowColorPicker(false));
  useBackHandler(showShareMenu, () => setShowShareMenu(false));
  useBackHandler(showCompare, () => setShowCompare(false));
  useBackHandler(showVersionPicker, () => setShowVersionPicker(false));
  useBackHandler(showPresentation, () => setShowPresentation(false));
  useBackHandler(!!imageVerse, () => setImageVerse(null));

  const applyBibleNavigationView = useCallback((nextView: BibleNavigationView) => {
    if (nextView.kind === "books") {
      setSelectedBook(null);
      setSelectedChapter(null);
      setHighlightedVerse(null);
      setVerses([]);
      setEpigraphs([]);
      setSelectedVerses(new Set());
      return;
    }

    const book = findBibleBookByAbbrev(nextView.bookAbbrev);
    if (!book) return;

    setSelectedBook(book);
    setTestament(book.testament);
    setHighlightedVerse(null);
    setSelectedVerses(new Set());

    if (nextView.kind === "chapters") {
      setSelectedChapter(null);
      setVerses([]);
      setEpigraphs([]);
      return;
    }

    setSelectedChapter(nextView.chapter);
  }, []);

  useEffect(() => {
    const currentHistoryView = window.history.state?.__bibleView;
    if (isBibleNavigationView(currentHistoryView)) {
      applyBibleNavigationView(currentHistoryView);
    } else {
      writeBibleHistory(getBibleNavigationView(selectedBook, selectedChapter), "replace");
    }

    const onPop = (event: PopStateEvent) => {
      const nextView = event.state?.__bibleView;
      if (isBibleNavigationView(nextView)) applyBibleNavigationView(nextView);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Only bind once on mount; selected state changes are mirrored below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyBibleNavigationView]);

  useEffect(() => {
    const nextView = getBibleNavigationView(selectedBook, selectedChapter);
    if (!isSameBibleNavigationView(window.history.state?.__bibleView, nextView)) {
      writeBibleHistory(nextView, "push");
    }
  }, [selectedBook, selectedChapter]);

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
    const versesParam = searchParams.get("verses");

    if (!bookParam || !chapterParam) return;

    const book = bibleBooks.find((item) => item.apiAbbrev === bookParam);
    const nextChapter = Number(chapterParam);
    const nextVerse = verseParam ? Number(verseParam) : null;

    if (!book || Number.isNaN(nextChapter)) return;

    // Parse "1,3-5" → Set([1,3,4,5])
    const parsedVerses = new Set<number>();
    if (versesParam) {
      for (const part of versesParam.split(",")) {
        const bits = part.split("-").map((n) => Number(n.trim()));
        const a = bits[0];
        const b = bits[1];
        if (!Number.isFinite(a)) continue;
        const end = Number.isFinite(b) ? b : a;
        for (let i = a; i <= end; i++) parsedVerses.add(i);
      }
    }

    setSelectedBook(book);
    setTestament(book.testament);
    setSelectedChapter(nextChapter);
    setHighlightedVerse(
      nextVerse && nextVerse > 0
        ? nextVerse
        : parsedVerses.size > 0
          ? Math.min(...parsedVerses)
          : null,
    );
    setHighlightedVerses(parsedVerses);
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
    const versionShort = getVersionById(bibleVersion).shortName;
    const sortedNumbers = Array.from(selectedVerses).sort((a, b) => a - b);
    const shortLink = await createShortVerseLink({
      bookAbbrev: selectedBook!.apiAbbrev,
      chapter: selectedChapter!,
      verses: sortedNumbers,
      fallbackLong: link,
    });
    const shareText = `${reference} (${versionShort})\n\n"${text}"\n\n📖 Leia aqui: ${shortLink}`;
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
    const versionShort = getVersionById(bibleVersion).shortName;
    const longLink = `${APP_URL}/biblia?book=${selectedBook.apiAbbrev}&chapter=${selectedChapter}&verses=${verse.number}`;
    const shortLink = await createShortVerseLink({
      bookAbbrev: selectedBook.apiAbbrev,
      chapter: selectedChapter,
      verses: [verse.number],
      fallbackLong: longLink,
    });
    const shareText = `${reference} (${versionShort})\n\n"${verse.text}"\n\n📖 Leia aqui: ${shortLink}`;
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

    // Build dynamic meta if user is viewing highlighted verses
    const highlightedList = highlightedVerses.size > 0
      ? Array.from(highlightedVerses).sort((a, b) => a - b)
      : highlightedVerse
        ? [highlightedVerse]
        : [];
    const highlightedTexts = highlightedList
      .map((n) => verses.find((v) => v.number === n)?.text)
      .filter(Boolean) as string[];
    const metaVerseLabel = highlightedList.length
      ? `${selectedBook.name} ${selectedChapter}:${highlightedList[0]}${
          highlightedList.length > 1 ? `-${highlightedList[highlightedList.length - 1]}` : ""
        }`
      : null;
    const metaTitle = metaVerseLabel
      ? `${metaVerseLabel} — A Bíblia do Atalaia`
      : `${selectedBook.name} ${selectedChapter} — Bíblia do Atalaia`;
    const metaDesc = highlightedTexts.length
      ? `"${highlightedTexts.join(" ").slice(0, 200)}${highlightedTexts.join(" ").length > 200 ? "…" : ""}" — ${currentVersion.shortName}`
      : `Leia ${selectedBook.name} capítulo ${selectedChapter} na versão ${currentVersion.shortName}, com destaques, notas e compartilhamento.`;
    const metaPath = highlightedList.length
      ? `/biblia?book=${selectedBook.apiAbbrev}&chapter=${selectedChapter}&verses=${highlightedList.join(",")}`
      : `/biblia?book=${selectedBook.abbrev}&chapter=${selectedChapter}`;

    return (
      <div className="pb-20 min-h-screen">
        <PageHead
          title={metaTitle}
          description={metaDesc}
          path={metaPath}
          type="article"
        />
        <header className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 bg-dark-bg/95 backdrop-blur-sm z-10 max-w-6xl mx-auto w-full border-b border-[hsl(var(--dark-card-hover))] lg:px-8 lg:pt-8">
          <button
            onClick={() => {
              window.history.back();
            }}
            className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">
              {selectedBook.name} {selectedChapter}
            </h1>
            <p className="text-[10px] text-dark-muted font-medium uppercase tracking-wider">
              {verses.length} Versículos disponíveis
            </p>
          </div>
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
            <div className="flex items-center gap-2" data-tour="bible-header-tools">
              {appFeatures.presentation_mode && (
                <button
                  onClick={() => setShowPresentation(true)}
                  data-tour="bible-presentation"
                  className="hidden lg:flex w-8 h-8 rounded-full bg-dark-card items-center justify-center"
                  title="Modo Apresentação"
                >
                  <Monitor className="w-4 h-4" />
                </button>
              )}
              <div data-tour="bible-fontsize">
                <FontSizeControls fontSize={fontSize} canIncrease={canIncFont} canDecrease={canDecFont} onIncrease={incFont} onDecrease={decFont} />
              </div>
              <button
                onClick={() => setShowVersionPicker(true)}
                data-tour="bible-version"
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
          <div className="sticky top-[72px] z-10 mx-4 mb-2 lg:max-w-3xl lg:mx-auto" data-tour="bible-action-bar">
            <div
              className="relative rounded-3xl overflow-hidden animate-fade-up"
              style={{
                background:
                  "linear-gradient(160deg, hsl(var(--dark-card)) 0%, hsl(var(--dark-bg)) 100%)",
                boxShadow:
                  "0 20px 50px -20px hsl(var(--primary) / 0.35), 0 0 0 1px hsl(var(--primary) / 0.15) inset",
              }}
            >
              {/* Soft glow accent */}
              <div
                className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl opacity-40"
                style={{ background: "hsl(var(--primary) / 0.5)" }}
              />
              <div className="relative flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full text-primary-foreground text-xs font-bold shadow-md"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 100%)",
                      boxShadow: "0 4px 12px hsl(var(--primary) / 0.4)",
                    }}
                  >
                    {selectedVerses.size}
                  </span>
                  <span className="text-[13px] font-semibold text-dark-text">
                    versículo{selectedVerses.size !== 1 ? "s" : ""} selecionado{selectedVerses.size !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedVerses(new Set())}
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center border border-white/10"
                  title="Limpar seleção"
                  aria-label="Limpar seleção"
                >
                  <X className="w-4 h-4 text-foreground/80" />
                </button>
              </div>
              <div className="relative px-3 pb-3 pt-1 lg:px-5 lg:pb-5">
                <div className="flex flex-wrap items-start justify-center gap-2 lg:gap-4">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button onClick={() => setShowColorPicker(!showColorPicker)} data-tour="bible-action-color" title="Destacar" aria-label="Destacar" className="h-11 w-11 rounded-xl bg-primary/15 hover:bg-primary/25 active:scale-95 transition-all flex items-center justify-center">
                      <Palette className="w-[18px] h-[18px] text-primary" />
                    </button>
                    <span className="hidden lg:inline text-[10px] font-medium text-dark-text">Destacar</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button onClick={handleShareSelected} data-tour="bible-action-share" title="Compartilhar" aria-label="Compartilhar" className="h-11 w-11 rounded-xl bg-primary/15 hover:bg-primary/25 active:scale-95 transition-all flex items-center justify-center">
                      <Share2 className="w-[18px] h-[18px] text-primary" />
                    </button>
                    <span className="hidden lg:inline text-[10px] font-medium text-dark-text">Compartilhar</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button onClick={handleImageSelected} data-tour="bible-action-image" title="Gerar imagem" aria-label="Gerar imagem" className="h-11 w-11 rounded-xl bg-primary/15 hover:bg-primary/25 active:scale-95 transition-all flex items-center justify-center">
                      <ImageIcon className="w-[18px] h-[18px] text-primary" />
                    </button>
                    <span className="hidden lg:inline text-[10px] font-medium text-dark-text">Imagem</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button onClick={() => setShowCompare(true)} data-tour="bible-action-compare" title="Comparar versões" aria-label="Comparar versões" className="h-11 w-11 rounded-xl bg-primary/15 hover:bg-primary/25 active:scale-95 transition-all flex items-center justify-center">
                      <GitCompareArrows className="w-[18px] h-[18px] text-primary" />
                    </button>
                    <span className="hidden lg:inline text-[10px] font-medium text-dark-text">Comparar</span>
                  </div>
                  {appFeatures.presentation_mode && (
                    <div className="hidden lg:flex flex-col items-center gap-1 shrink-0">
                      <button onClick={() => setShowPresentation(true)} title="Modo Apresentação" aria-label="Modo Apresentação" className="h-11 w-11 rounded-xl bg-primary/15 hover:bg-primary/25 active:scale-95 transition-all flex items-center justify-center">
                        <Monitor className="w-[18px] h-[18px] text-primary" />
                      </button>
                      <span className="hidden lg:inline text-[10px] font-medium text-dark-text">Apresentar</span>
                    </div>
                  )}
                  {/* Anotações — exclusivo desktop */}
                  {appFeatures.personal_notes && (
                    <div className="hidden lg:flex">
                      <PersonalNotes
                        bookAbbrev={selectedBook.apiAbbrev}
                        chapter={selectedChapter}
                        verse={Array.from(selectedVerses).sort((a, b) => a - b)[0]}
                        enabled={appFeatures.personal_notes}
                        variant="action-bar"
                        label="Anotações"
                      />
                    </div>
                  )}
                  {(() => {
                    const sortedSel = Array.from(selectedVerses).sort((a, b) => a - b);
                    const selTexts = sortedSel.map((n) => verses.find((v) => v.number === n)).filter(Boolean) as BibleVerse[];
                    const selRanges: string[] = [];
                    let s = sortedSel[0], e = sortedSel[0];
                    for (let i = 1; i < sortedSel.length; i++) {
                      if (sortedSel[i] === e + 1) { e = sortedSel[i]; }
                      else { selRanges.push(s === e ? `${s}` : `${s}-${e}`); s = e = sortedSel[i]; }
                    }
                    selRanges.push(s === e ? `${s}` : `${s}-${e}`);
                    const selRef = `${selectedBook.name} ${selectedChapter}:${selRanges.join(",")}`;
                    const selText = selTexts.map((v) => `${v.number} ${v.text}`).join("\n");
                    return (
                      <>
                        <AIConnections reference={selRef} text={selText} enabled={aiFeatures.connections} label="Conexões" />
                        <AIWordMeaning reference={selRef} text={selText} enabled={aiFeatures.word_meaning} label="Significado" />
                        <AITimeline reference={selRef} text={selText} enabled={aiFeatures.timeline} label="Linha do Tempo" />
                        {isAdmin && (
                          <ScheduleDailyVerseButton
                            reference={selRef}
                            text={selText}
                            label="Agendar"
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Color picker */}
            {showColorPicker && (
              <div
                className="mt-2 rounded-3xl p-5 animate-fade-up relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(160deg, hsl(var(--dark-card)) 0%, hsl(var(--dark-bg)) 100%)",
                  boxShadow:
                    "0 20px 50px -20px rgba(0,0,0,0.6), 0 0 0 1px hsl(var(--primary) / 0.15) inset",
                }}
              >
                <p className="text-[11px] uppercase tracking-wider text-dark-muted font-bold mb-4 text-center">
                  Escolha uma cor para destacar
                </p>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => handleHighlightSelected(c.value)}
                      className="group flex flex-col items-center gap-1.5 active:scale-90 transition-all"
                      title={c.name}
                      aria-label={c.name}
                    >
                      <span
                        className="w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-white/10 group-hover:ring-white/40 transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${c.value} 0%, ${c.value}cc 100%)`,
                          boxShadow: `0 6px 20px ${c.value}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
                        }}
                      />
                      <span className="text-[10px] text-dark-muted font-medium">{c.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={handleRemoveHighlightSelected}
                    className="group flex flex-col items-center gap-1.5 active:scale-90 transition-all"
                    title="Remover destaque"
                    aria-label="Remover destaque"
                  >
                    <span className="w-11 h-11 rounded-full bg-white/5 border border-dashed border-white/20 flex items-center justify-center group-hover:border-white/40 transition-all">
                      <Ban className="w-5 h-5 text-dark-muted" />
                    </span>
                    <span className="text-[10px] text-dark-muted font-medium">Remover</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio Bible */}
        {!loading && !error && verses.length > 0 && (
          <AudioBible
            verses={verses}
            selectedVerses={selectedVerses}
            bookName={selectedBook.name}
            chapter={selectedChapter}
            enabled={appFeatures.audio_bible}
          />
        )}

        {/* AI Chapter Summary */}
        {!loading && !error && verses.length > 0 && (
          <AIChapterSummary
            bookName={selectedBook.name}
            chapter={selectedChapter}
            text={verses.map((v) => `${v.number} ${v.text}`).join("\n")}
            enabled={aiFeatures.summary}
          />
        )}

        <div className="px-5 py-4 max-w-6xl mx-auto lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:px-8">
          <div className="space-y-4">
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
                const isUrlHighlighted =
                  !hasSelection &&
                  (highlightedVerse === verse.number || highlightedVerses.has(verse.number));
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
                      fontSize={fontSize}
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
                  window.scrollTo({ top: 0, behavior: "smooth" });
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
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={selectedChapter >= selectedBook.chapters}
                className="text-sm font-semibold text-primary disabled:opacity-30"
              >
                Capítulo {selectedChapter + 1} →
              </button>
            </div>
            )}
          </div>

          {/* Desktop Sidebar Tools */}
          {!loading && verses.length > 0 && (
            <aside className="hidden lg:block space-y-6 sticky top-24 self-start">
              <div className="bg-dark-card rounded-2xl p-5 border border-white/5">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" /> Opções de Estudo
                </h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowVersionPicker(true)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-dark-bg hover:bg-dark-card-hover transition-colors text-xs font-semibold"
                  >
                    <span>Versão: {currentVersion.shortName}</span>
                    <ChevronDown className="w-4 h-4 opacity-40" />
                  </button>
                  <div className="p-3 rounded-xl bg-dark-bg">
                    <p className="text-[10px] uppercase tracking-wider text-dark-muted mb-2">Tamanho da Fonte</p>
                    <FontSizeControls fontSize={fontSize} canIncrease={canIncFont} canDecrease={canDecFont} onIncrease={incFont} onDecrease={decFont} />
                  </div>
                </div>
              </div>
              <div className="bg-dark-card rounded-2xl p-5 border border-white/5">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-dark-text">
                  <StickyNote className="w-4 h-4 text-yellow-500" /> Suas Anotações
                </h3>
                <PersonalNotes
                  bookAbbrev={selectedBook.apiAbbrev}
                  chapter={selectedChapter}
                  enabled={appFeatures.personal_notes}
                  variant="inline"
                />
              </div>
            </aside>
          )}
        </div>

        {imageVerse && (
          <VerseImageGenerator
            text={imageVerse.text}
            reference={imageVerse.reference}
            version={getVersionById(bibleVersion).shortName}
            open={!!imageVerse}
            onClose={() => setImageVerse(null)}
          />
        )}
        {showCompare && selectedBook && selectedChapter && (
          <VerseCompare
            open={showCompare}
            onClose={() => setShowCompare(false)}
            bookAbbrev={selectedBook.apiAbbrev}
            bookName={selectedBook.name}
            chapter={selectedChapter}
            verseNumbers={[...selectedVerses].sort((a, b) => a - b)}
            currentVersionId={bibleVersion}
          />
        )}
        {versionPickerModal}
        <ShareMenu text={shareMenuText} open={showShareMenu} onClose={() => setShowShareMenu(false)} />
        {!loading && verses.length > 0 && selectedBook && selectedChapter && (() => {
          const sortedSel = Array.from(selectedVerses).sort((a, b) => a - b);
          const hasSelection = sortedSel.length > 0;
          const targetVerses = hasSelection
            ? sortedSel.map((n) => verses.find((v) => v.number === n)).filter(Boolean) as BibleVerse[]
            : verses;
          const ranges: string[] = [];
          if (hasSelection) {
            let start = sortedSel[0], end = sortedSel[0];
            for (let i = 1; i < sortedSel.length; i++) {
              if (sortedSel[i] === end + 1) { end = sortedSel[i]; }
              else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = end = sortedSel[i]; }
            }
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
          }
          const ref = hasSelection
            ? `${selectedBook.name} ${selectedChapter}:${ranges.join(",")}`
            : `${selectedBook.name} ${selectedChapter}`;
          return aiFeatures.exegetai ? (
              <ExegetAI
                reference={ref}
                text={targetVerses.map((v) => `${v.number} ${v.text}`).join("\n")}
                version={getVersionById(bibleVersion).shortName}
              />
            ) : null;
        })()}
        {showPresentation && selectedBook && selectedChapter && (
          <PresentationMode
            verses={verses}
            bookName={selectedBook.name}
            chapter={selectedChapter}
            selectedVerses={selectedVerses.size > 0 ? selectedVerses : undefined}
            onClose={() => setShowPresentation(false)}
          />
        )}
      </div>
    );
  }

  // ── Chapter picker ──
  if (selectedBook) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3 max-w-4xl mx-auto">
          <button
            onClick={() => {
              window.history.back();
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
        <div className="px-5 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-w-4xl mx-auto">
          {Array.from({ length: selectedBook.chapters }, (_, index) => (
            <button
              key={index + 1}
              onClick={() => {
                setHighlightedVerse(null);
                setSelectedChapter(index + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
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
    <div className="pb-20 min-h-screen max-w-4xl mx-auto">
      <PageHead
        title="Bíblia Online — Todos os Livros | A Bíblia do Atalaia"
        description="Escolha o livro e capítulo. 66 livros da Bíblia disponíveis nas versões ARC, ACF, NVI e mais, com leitura offline."
        path="/biblia"
      />
      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Bíblia</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersionPicker(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-card text-xs font-semibold"
            >
              {getVersionById(bibleVersion).shortName}
              <ChevronDown className="w-3 h-3 text-dark-muted" />
            </button>
          </div>
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
      <div className="px-5 space-y-1 grid grid-cols-1 md:grid-cols-2 gap-x-6">
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
  fontSize?: number;
  onTap: (verseNumber: number) => void;
  onSave: (v: BibleVerse) => void;
  onShare: (v: BibleVerse) => void;
  onImage: (v: BibleVerse) => void;
}

const VerseRow = ({ verse, isHighlighted, isSelected, highlightColor, isRedLetter, isSaved, fontSize = 16, onTap, onSave, onShare, onImage }: VerseRowProps) => {
  return (
    <div
      id={`verse-${verse.number}`}
      className={`group scroll-mt-24 rounded-lg transition-all py-2.5 px-3 cursor-pointer active:scale-[0.99] ${
        isHighlighted ? "bg-primary/10" : ""
      } ${isSelected ? "verse-selected" : ""}`}
      style={
        highlightColor && !isSelected
          ? {
              background: `linear-gradient(90deg, ${highlightColor}38 0%, ${highlightColor}14 100%)`,
              borderLeft: `4px solid ${highlightColor}`,
              boxShadow: `inset 0 0 0 1px ${highlightColor}22`,
            }
          : undefined
      }
      onClick={() => onTap(verse.number)}
    >
      <p className={`leading-relaxed ${isRedLetter ? "text-red-400" : ""}`} style={{ fontSize: `${fontSize}px` }}>
        <span
          className="font-bold mr-2 text-xs align-super"
          style={
            highlightColor
              ? { color: highlightColor, textShadow: `0 0 8px ${highlightColor}66` }
              : isRedLetter
                ? { color: "#ef4444" }
                : undefined
          }
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
