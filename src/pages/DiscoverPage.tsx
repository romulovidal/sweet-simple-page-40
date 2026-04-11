import { Search, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { searchVerses } from "@/services/bibleApi";
import { bibleBooks } from "@/data/bible";
import { useNavigate } from "react-router-dom";

const categories = [
  { emoji: "🙏", label: "Oração", query: "oração" },
  { emoji: "💪", label: "Fé", query: "fé" },
  { emoji: "❤️", label: "Amor", query: "amor" },
  { emoji: "😌", label: "Paz", query: "paz" },
  { emoji: "📖", label: "Sabedoria", query: "sabedoria" },
  { emoji: "🎵", label: "Louvor", query: "louvor" },
  { emoji: "👨‍👩‍👧‍👦", label: "Família", query: "família" },
  { emoji: "✨", label: "Graça", query: "graça" },
];

const popularVerses = [
  { ref: "João 3:16", bookAbbrev: "jo", chapter: 3 },
  { ref: "Salmos 23", bookAbbrev: "sl", chapter: 23 },
  { ref: "Filipenses 4:13", bookAbbrev: "fp", chapter: 4 },
  { ref: "Romanos 8:28", bookAbbrev: "rm", chapter: 8 },
  { ref: "Isaías 41:10", bookAbbrev: "is", chapter: 41 },
  { ref: "Josué 1:9", bookAbbrev: "js", chapter: 1 },
];

const DiscoverPage = () => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ book: { name: string }; chapter: number; number: number; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchVerses(query);
      setResults(data.slice(0, 20));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCategoryClick = (query: string) => {
    setSearch(query);
    handleSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch(search);
  };

  const navigateToChapter = (bookAbbrev: string, chapter: number) => {
    // Navigate to Bible page - we'll use URL state
    navigate(`/biblia?book=${bookAbbrev}&chapter=${chapter}`);
  };

  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold">Descubra</h1>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar na Bíblia... (ex: amor, fé)"
            className="w-full bg-[hsl(var(--dark-card))] rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </header>

      {/* Search Results */}
      {searched && (
        <div className="px-5 mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <>
              <p className="text-xs text-[hsl(var(--dark-muted))] mb-3">{results.length} resultados</p>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/biblia`)}
                    className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                  >
                    <p className="text-xs font-semibold text-primary mb-1">
                      {r.book.name} {r.chapter}:{r.number}
                    </p>
                    <p className="text-sm text-[hsl(var(--dark-text))]">{r.text}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-6">
              Nenhum resultado encontrado para "{search}"
            </p>
          )}
        </div>
      )}

      {/* Categories */}
      {!searched && (
        <>
          <div className="px-5 mb-6">
            <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
              Categorias
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => handleCategoryClick(cat.query)}
                  className="bg-[hsl(var(--dark-card))] rounded-xl p-3 flex flex-col items-center gap-1 active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[10px] font-medium text-[hsl(var(--dark-muted))]">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Popular Passages */}
          <div className="px-5">
            <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
              Passagens populares
            </h2>
            <div className="space-y-2">
              {popularVerses.map((v) => (
                <button
                  key={v.ref}
                  onClick={() => navigateToChapter(v.bookAbbrev, v.chapter)}
                  className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors text-left"
                >
                  <p className="text-sm font-semibold text-primary">{v.ref}</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">Toque para ler</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DiscoverPage;
