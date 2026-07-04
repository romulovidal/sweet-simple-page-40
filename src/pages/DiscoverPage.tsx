import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, Sparkles } from "lucide-react";
import { searchVerses } from "@/services/bibleApi";
import { getSmartBibleMatches, normalizeSearchText, parseBibleReference, resolveBookAbbrev } from "@/lib/bibleSearch";
import { useAppFeatures } from "@/hooks/useAppFeatures";
import AskBible from "@/components/AskBible";
import StudyHub from "@/components/study/StudyHub";
type DiscoverResult = {
  id: string;
  type: "referencia" | "tema" | "versiculo" | "ai-sugestao";
  title: string;
  subtitle: string;
  excerpt: string;
  bookAbbrev: string;
  chapter: number;
  verse?: number;
};

const categories = [
  { emoji: "🙏", label: "Oração", query: "oração" },
  { emoji: "💪", label: "Fé", query: "fé" },
  { emoji: "❤️", label: "Amor", query: "amor" },
  { emoji: "😌", label: "Paz", query: "paz" },
  { emoji: "📖", label: "Sabedoria", query: "sabedoria" },
  { emoji: "🛡️", label: "Proteção", query: "proteção" },
  { emoji: "✨", label: "Propósito", query: "propósito" },
  { emoji: "🔥", label: "Coragem", query: "coragem" },
];

const popularVerses = [
  { ref: "João 3:16", bookAbbrev: "jo", chapter: 3, verse: 16 },
  { ref: "Salmos 23", bookAbbrev: "sl", chapter: 23 },
  { ref: "Filipenses 4:6", bookAbbrev: "fp", chapter: 4, verse: 6 },
  { ref: "Romanos 8:28", bookAbbrev: "rm", chapter: 8, verse: 28 },
  { ref: "Isaías 41:10", bookAbbrev: "is", chapter: 41, verse: 10 },
  { ref: "Josué 1:9", bookAbbrev: "js", chapter: 1, verse: 9 },
];

const quickPrompts = ["joão 3:16", "salmos 23", "ansiedade", "cura", "propósito"];

const dedupeResults = (items: DiscoverResult[]) =>
  items.filter(
    (item, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.bookAbbrev === item.bookAbbrev &&
          candidate.chapter === item.chapter &&
          candidate.verse === item.verse &&
          candidate.type === item.type
      ) === index
  );

const semanticSearch = async (query: string): Promise<DiscoverResult[]> => {
  try {
    const { data, error } = await supabase.functions.invoke("ai-tools", {
      body: { tool: "semantic-search", text: query },
    });
    if (error || !data?.result) return [];
    const suggestions = JSON.parse(data.result);
    if (!Array.isArray(suggestions)) return [];

    return suggestions.map((s: any, idx: number) => {
      const ref = parseBibleReference(s.ref);
      return {
        id: `ai-${idx}-${Date.now()}`,
        type: "ai-sugestao",
        title: s.ref,
        subtitle: "Sugestão da IA",
        excerpt: s.explanation || s.text,
        bookAbbrev: ref?.book.apiAbbrev || "jo",
        chapter: ref?.chapter || 1,
        verse: ref?.verse,
      };
    });
  } catch (e) {
    console.error("Semantic search failed:", e);
    return [];
  }
};

const DiscoverPage = () => {
  const { features: appFeatures } = useAppFeatures();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const latestRequest = useRef(0);
  const navigate = useNavigate();

  const openBibleReference = useCallback(
    (bookAbbrev: string, chapter: number, verse?: number) => {
      const params = new URLSearchParams({
        book: bookAbbrev,
        chapter: String(chapter),
      });

      if (verse) {
        params.set("verse", String(verse));
      }

      navigate(`/biblia?${params.toString()}`);
    },
    [navigate]
  );

  const openReferenceByString = useCallback(
    (ref: string) => {
      const parsed = parseBibleReference(ref);
      if (parsed) {
        openBibleReference(parsed.book.apiAbbrev, parsed.chapter, parsed.verse);
        return;
      }
      // Fallback: "Livro 12" or "Livro 7—12"
      const match = ref.match(/^(.+?)\s+(\d+)/);
      if (!match) return;
      const bookAbbrev = resolveBookAbbrev(match[1].trim());
      if (!bookAbbrev) return;
      openBibleReference(bookAbbrev, parseInt(match[2], 10));
    },
    [openBibleReference],
  );

  const handleSearch = useCallback(async (rawQuery: string) => {
    const normalizedQuery = normalizeSearchText(rawQuery);

    if (normalizedQuery.length < 2) {
      latestRequest.current += 1;
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const requestId = Date.now();
    latestRequest.current = requestId;
    setSearched(true);

    const directReference = parseBibleReference(rawQuery);
    const smartMatches = getSmartBibleMatches(rawQuery).map<DiscoverResult>((match) => ({
      id: `tema-${match.id}`,
      type: "tema",
      title: match.label,
      subtitle: "Sugestão inteligente",
      excerpt: match.description,
      bookAbbrev: match.bookAbbrev,
      chapter: match.chapter,
      verse: match.verse,
    }));

    if (directReference) {
      setLoading(false);
      setResults(
        dedupeResults([
          {
            id: `referencia-${directReference.book.apiAbbrev}-${directReference.chapter}-${directReference.verse ?? 0}`,
            type: "referencia",
            title: `${directReference.book.name} ${directReference.chapter}${
              directReference.verse ? `:${directReference.verse}` : ""
            }`,
            subtitle: "Referência direta",
            excerpt: "Abrir capítulo da Bíblia exatamente no trecho buscado.",
            bookAbbrev: directReference.book.apiAbbrev,
            chapter: directReference.chapter,
            verse: directReference.verse,
          },
          ...smartMatches,
        ])
      );
      return;
    }

    if (normalizedQuery.length < 2) {
      setLoading(false);
      setResults(dedupeResults(smartMatches));
      return;
    }

    setLoading(true);

    try {
      const remoteResults = await searchVerses(rawQuery);
      if (latestRequest.current !== requestId) return;

      const verseResults = remoteResults
        .map<DiscoverResult | null>((item) => {
          const bookAbbrev = resolveBookAbbrev(item.book.name);
          if (!bookAbbrev) return null;

          return {
            id: `versiculo-${bookAbbrev}-${item.chapter}-${item.number}`,
            type: "versiculo",
            title: `${item.book.name} ${item.chapter}:${item.number}`,
            subtitle: "Resultado encontrado",
            excerpt: item.text,
            bookAbbrev,
            chapter: item.chapter,
            verse: item.number,
          };
        })
        .filter((item): item is DiscoverResult => !!item);

      let aiResults: DiscoverResult[] = [];
      // Se não for uma referência direta e for uma busca por "sentimento" (frases mais longas ou palavras semânticas)
      if (rawQuery.split(" ").length >= 2 || ["triste", "feliz", "ansiedade", "medo", "amor", "paz"].includes(normalizedQuery)) {
        aiResults = await semanticSearch(rawQuery);
      }

      setResults(dedupeResults([...aiResults, ...smartMatches, ...verseResults]).slice(0, 25));
    } catch {
      if (latestRequest.current !== requestId) return;
      setResults(dedupeResults(smartMatches));
    } finally {
      if (latestRequest.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const trimmedSearch = search.trim();

    if (!trimmedSearch) {
      latestRequest.current += 1;
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void handleSearch(trimmedSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [handleSearch, search]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      void handleSearch(search);
    }
  };

  const handleCategoryClick = (query: string) => {
    setSearch(query);
  };

  return (
    <div className="pb-20 min-h-screen max-w-6xl mx-auto lg:px-8">
      <header className="px-5 pt-12 pb-4 max-w-4xl mx-auto lg:pt-8">
         <h1 className="text-2xl font-bold">Explore</h1>
        <p className="text-sm text-dark-muted mt-1">
          Busque por tema, capítulo ou referência como João 3:16.
        </p>

        <div className="relative mt-4" data-tour="discover-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar na Bíblia..."
            className="w-full bg-dark-card rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pt-3 -mx-5 px-5" data-tour="discover-prompts">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setSearch(prompt)}
              className="flex-shrink-0 rounded-full bg-dark-card px-3 py-1.5 text-xs text-dark-muted active:bg-dark-card-hover transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </header>

      {searched && (
        <div className="px-5 mb-6 max-w-2xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <>
              <p className="text-xs text-dark-muted mb-3">{results.length} resultado{results.length > 1 ? "s" : ""}</p>
              <div className="space-y-2">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => openBibleReference(result.bookAbbrev, result.chapter, result.verse)}
                    className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {result.type === "referencia"
                          ? "Referência"
                          : result.type === "tema"
                            ? "Tema"
                            : "Versículo"}
                      </span>
                      <span className="text-[10px] text-dark-muted">{result.subtitle}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1">{result.title}</p>
                    <p className="text-sm text-dark-muted leading-relaxed">{result.excerpt}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="text-sm text-dark-muted">
                Não encontrei nada para "{search}". Tente buscar por tema ou uma referência bíblica.
              </p>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <>
          {/* Ask Bible */}
          <div className="px-5 mb-8 max-w-2xl mx-auto">
            <AskBible enabled={appFeatures.ask_bible} />
          </div>

          {/* Estudos Bíblicos */}
          <div className="px-5 mb-10 max-w-4xl mx-auto">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
                Estudos Bíblicos
              </h2>
              <span className="text-[10px] text-dark-muted/70">
                Aprenda tocando
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {studyCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    onClick={() => window.dispatchEvent(new CustomEvent(card.event))}
                    className="group relative overflow-hidden rounded-2xl p-4 text-left bg-dark-card active:scale-[0.98] transition-all"
                    style={{
                      border: `1px solid hsl(${card.color} / 0.25)`,
                      boxShadow: `0 12px 30px -18px hsl(${card.color} / 0.55)`,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-40"
                      style={{ background: `hsl(${card.color} / 0.55)` }}
                    />
                    <div className="relative flex items-start justify-between mb-6">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, hsl(${card.color}) 0%, hsl(${card.color} / 0.6) 100%)`,
                        }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <ChevronRight
                        className="w-4 h-4 mt-2 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                        style={{ color: `hsl(${card.color})` }}
                      />
                    </div>
                    <p className="relative text-sm font-bold text-dark-text leading-tight">
                      {card.label}
                    </p>
                    <p className="relative text-[11px] text-dark-muted mt-0.5 leading-snug">
                      {card.sub}
                    </p>
                    <p
                      className="relative mt-3 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: `hsl(${card.color})` }}
                    >
                      {card.count} {card.countLabel}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-5 mb-10 max-w-4xl mx-auto" data-tour="discover-categories">
            <h2 className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-3">
              Categorias
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {categories.map((category) => (
                <button
                  key={category.label}
                  onClick={() => handleCategoryClick(category.query)}
                  className="bg-dark-card rounded-xl p-3 flex flex-col items-center gap-1 active:bg-dark-card-hover transition-colors"
                >
                  <span className="text-xl">{category.emoji}</span>
                  <span className="text-[10px] font-medium text-dark-muted">{category.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 mb-10 max-w-4xl mx-auto" data-tour="discover-popular">
            <h2 className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-3">
              Passagens populares
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {popularVerses.map((verse) => (
                <button
                  key={verse.ref}
                  onClick={() => openBibleReference(verse.bookAbbrev, verse.chapter, verse.verse)}
                  className="w-full bg-dark-card rounded-xl p-4 active:bg-dark-card-hover transition-colors text-left"
                >
                  <p className="text-sm font-semibold text-primary">{verse.ref}</p>
                  <p className="text-xs text-dark-muted mt-0.5">Toque para ler com destaque no trecho</p>
                </button>
              ))}
            </div>
          </div>

        </>
      )}

      {/* Sheets that listen to global open-* events. Triggers hidden — the study cards above open them. */}
      <VisualTimeline
        hideTrigger
        onNavigateReference={openReferenceByString}
        onCharacterClick={(name) =>
          window.dispatchEvent(new CustomEvent("open-bible-character", { detail: { name } }))
        }
      />
      <BiblicalMaps hideTrigger onNavigateReference={openReferenceByString} />
      <BibleCharacters hideTrigger onNavigateReference={openReferenceByString} />
    </div>
  );
};

export default DiscoverPage;
