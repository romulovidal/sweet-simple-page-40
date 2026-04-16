import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { BIBLE_VERSIONS, getChapter, type BibleVerse } from "@/services/bibleApi";
import { useBackHandler } from "@/hooks/useBackHandler";

interface VerseCompareProps {
  open: boolean;
  onClose: () => void;
  bookAbbrev: string;
  bookName: string;
  chapter: number;
  verseNumbers: number[];
  currentVersionId: string;
}

interface VersionVerses {
  versionId: string;
  shortName: string;
  verses: BibleVerse[];
  error?: boolean;
}

const VerseCompare = ({
  open,
  onClose,
  bookAbbrev,
  bookName,
  chapter,
  verseNumbers,
  currentVersionId,
}: VerseCompareProps) => {
  const [results, setResults] = useState<VersionVerses[]>([]);
  const [loading, setLoading] = useState(true);
  useBackHandler(open, onClose);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    // Sort current version first, then the rest
    const sorted = [...BIBLE_VERSIONS].sort((a, b) => {
      if (a.id === currentVersionId) return -1;
      if (b.id === currentVersionId) return 1;
      return 0;
    });

    Promise.all(
      sorted.map(async (version) => {
        try {
          const data = await getChapter(bookAbbrev, chapter, version.id);
          const filtered = data.verses.filter((v) => verseNumbers.includes(v.number));
          return { versionId: version.id, shortName: version.shortName, verses: filtered };
        } catch {
          return { versionId: version.id, shortName: version.shortName, verses: [], error: true };
        }
      })
    ).then((all) => {
      if (!cancelled) {
        setResults(all);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, bookAbbrev, chapter, verseNumbers, currentVersionId]);

  if (!open) return null;

  const verseLabel =
    verseNumbers.length === 1
      ? `${bookName} ${chapter}:${verseNumbers[0]}`
      : `${bookName} ${chapter}:${verseNumbers[0]}-${verseNumbers[verseNumbers.length - 1]}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3">
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h2 className="text-sm font-bold">Comparar Versões</h2>
            <p className="text-xs text-white/50">{verseLabel}</p>
          </div>
          <div className="w-9" />
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20" style={{ WebkitOverflowScrolling: "touch" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-0">
              {results.map((result, idx) => {
                const isCurrent = result.versionId === currentVersionId;
                return (
                  <div
                    key={result.versionId}
                    className={`border-b border-white/5 px-5 py-5 ${idx === 0 ? "" : ""}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        {result.shortName}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] text-white/40">atual</span>
                      )}
                    </div>
                    {result.error ? (
                      <p className="text-sm italic text-white/30">
                        Não foi possível carregar esta versão.
                      </p>
                    ) : result.verses.length === 0 ? (
                      <p className="text-sm italic text-white/30">
                        Versículo não encontrado nesta versão.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {result.verses.map((v) => (
                          <p key={v.number} className="text-sm leading-relaxed text-white/85">
                            <span className="mr-1 text-xs font-bold text-primary/60">
                              {v.number}
                            </span>
                            {v.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerseCompare;
