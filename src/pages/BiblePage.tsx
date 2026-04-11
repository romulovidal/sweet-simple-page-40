import { useState, useEffect } from "react";
import { bibleBooks, type BibleBook } from "@/data/bible";
import { getChapter, type BibleVerse } from "@/services/bibleApi";
import { ChevronLeft, Search, Heart, BookmarkPlus, Share2, Loader2 } from "lucide-react";
import { useLocalStorage, type SavedVerse, type ReadingProgress, type StreakData, updateStreak, getToday } from "@/hooks/useLocalStorage";
import { toast } from "sonner";

const BiblePage = () => {
  const [testament, setTestament] = useState<"VT" | "NT">("VT");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [, setProgress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);
  const [streak, setStreak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });

  const filteredBooks = bibleBooks.filter(
    (b) =>
      b.testament === testament &&
      b.name.toLowerCase().includes(search.toLowerCase())
  );

  // Fetch chapter from API
  useEffect(() => {
    if (!selectedBook || !selectedChapter) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getChapter(selectedBook.apiAbbrev, selectedChapter)
      .then((data) => {
        if (!cancelled) {
          setVerses(data.verses);
          // Update reading progress
          setProgress({
            bookAbbrev: selectedBook.apiAbbrev,
            bookName: selectedBook.name,
            chapter: selectedChapter,
            lastRead: new Date().toISOString(),
          });
          // Update streak
          setStreak((prev) => updateStreak(prev));
        }
      })
      .catch((err) => {
        if (!cancelled) setError("Não foi possível carregar os versículos. Tente novamente.");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedBook, selectedChapter]);

  const handleSaveVerse = (verse: BibleVerse) => {
    const reference = `${selectedBook!.name} ${selectedChapter}:${verse.number}`;
    const alreadySaved = savedVerses.some((v) => v.reference === reference);
    if (alreadySaved) {
      setSavedVerses((prev) => prev.filter((v) => v.reference !== reference));
      toast("Versículo removido dos salvos");
    } else {
      setSavedVerses((prev) => [...prev, { text: verse.text, reference, savedAt: new Date().toISOString() }]);
      toast("Versículo salvo!");
    }
  };

  const handleShareVerse = async (verse: BibleVerse) => {
    const reference = `${selectedBook!.name} ${selectedChapter}:${verse.number}`;
    const shareText = `"${verse.text}" — ${reference} (ARC)`;
    if (navigator.share) {
      await navigator.share({ title: reference, text: shareText }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareText);
      toast("Versículo copiado!");
    }
  };

  const isVerseSaved = (verse: BibleVerse) => {
    const reference = `${selectedBook!.name} ${selectedChapter}:${verse.number}`;
    return savedVerses.some((v) => v.reference === reference);
  };

  // Chapter view with real verses
  if (selectedBook && selectedChapter) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 bg-[hsl(var(--dark-bg))] z-10">
          <button
            onClick={() => { setSelectedChapter(null); setVerses([]); }}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">
            {selectedBook.name} {selectedChapter}
          </h1>
          <span className="text-[10px] text-[hsl(var(--dark-muted))] ml-auto">ARC</span>
        </header>

        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <p className="text-sm text-red-400 mb-4">{error}</p>
              <button
                onClick={() => { setVerses([]); setSelectedChapter(selectedChapter); }}
                className="text-primary text-sm font-semibold"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && verses.length > 0 && (
            <div className="space-y-4">
              {verses.map((verse) => (
                <div key={verse.number} className="group">
                  <p className="text-sm leading-relaxed">
                    <span className="text-primary font-bold mr-2 text-xs align-super">{verse.number}</span>
                    {verse.text}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                    <button onClick={() => handleSaveVerse(verse)} className="p-1">
                      <BookmarkPlus className={`w-4 h-4 ${isVerseSaved(verse) ? "fill-primary text-primary" : "text-[hsl(var(--dark-muted))]"}`} />
                    </button>
                    <button onClick={() => handleShareVerse(verse)} className="p-1">
                      <Share2 className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chapter navigation */}
          {!loading && verses.length > 0 && (
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-[hsl(var(--dark-card))]">
              <button
                onClick={() => selectedChapter > 1 && setSelectedChapter(selectedChapter - 1)}
                disabled={selectedChapter <= 1}
                className="text-sm font-semibold text-primary disabled:opacity-30"
              >
                ← Capítulo {selectedChapter - 1}
              </button>
              <button
                onClick={() => selectedChapter < selectedBook.chapters && setSelectedChapter(selectedChapter + 1)}
                disabled={selectedChapter >= selectedBook.chapters}
                className="text-sm font-semibold text-primary disabled:opacity-30"
              >
                Capítulo {selectedChapter + 1} →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chapter selection
  if (selectedBook) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedBook(null)}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{selectedBook.name}</h1>
          <span className="text-xs text-[hsl(var(--dark-muted))]">
            {selectedBook.chapters} capítulos
          </span>
        </header>
        <div className="px-5 grid grid-cols-5 gap-2">
          {Array.from({ length: selectedBook.chapters }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setSelectedChapter(i + 1)}
              className="aspect-square rounded-xl bg-[hsl(var(--dark-card))] flex items-center justify-center text-sm font-semibold active:bg-primary active:text-white transition-colors"
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Book list
  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold mb-4">Bíblia</h1>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar livro..."
            className="w-full bg-[hsl(var(--dark-card))] rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2">
          {(["VT", "NT"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTestament(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                testament === t
                  ? "bg-primary text-white"
                  : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
              }`}
            >
              {t === "VT" ? "Velho Testamento" : "Novo Testamento"}
            </button>
          ))}
        </div>
      </header>
      <div className="px-5 space-y-1">
        {filteredBooks.map((book) => (
          <button
            key={book.abbrev}
            onClick={() => setSelectedBook(book)}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-xl active:bg-[hsl(var(--dark-card))] transition-colors text-left"
          >
            <div>
              <p className="font-semibold text-sm">{book.name}</p>
              <p className="text-xs text-[hsl(var(--dark-muted))]">
                {book.chapters} capítulo{book.chapters > 1 ? "s" : ""}
              </p>
            </div>
            <span className="text-xs text-[hsl(var(--dark-muted))]">{book.abbrev}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BiblePage;
