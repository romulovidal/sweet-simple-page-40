import { useMemo, useState } from "react";
import { ArrowLeft, Search, Music2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHead from "@/components/PageHead";
import harpaIcon from "@/assets/harpa-atalaia-icon.png";
import { HARPA_HINOS, type HarpaHino } from "@/data/harpa";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const HarpaPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HarpaHino | null>(null);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return HARPA_HINOS;
    const asNumber = Number(q);
    return HARPA_HINOS.filter((h) => {
      if (!Number.isNaN(asNumber) && String(h.number).includes(q)) return true;
      return normalize(h.title).includes(q);
    });
  }, [query]);

  const empty = HARPA_HINOS.length === 0;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--dark-text))] pb-24">
      <PageHead
        title="Harpa Cristã Atalaia — Hinário"
        description="Hinário Harpa Cristã Atalaia para uso congregacional: consulte hinos por número ou título."
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[hsl(var(--background))]/95 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 active:scale-95 transition"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={harpaIcon} alt="" width={32} height={32} className="w-8 h-8 object-contain" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight truncate">Harpa Cristã Atalaia</h1>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-tight">
              {empty ? "Hinário aguardando carregamento" : `${HARPA_HINOS.length} hinos`}
            </p>
          </div>
        </div>

        {!empty && (
          <div className="px-4 pb-3 max-w-3xl mx-auto">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--dark-card))] border border-white/5 focus-within:border-amber-500/40">
              <Search className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
              <input
                type="search"
                inputMode="search"
                placeholder="Buscar por número ou título…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[hsl(var(--dark-muted))]"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Limpar busca">
                  <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                </button>
              )}
            </label>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4">
        {empty ? (
          <div className="text-center py-16">
            <img src={harpaIcon} alt="" width={96} height={96} className="w-24 h-24 mx-auto opacity-80" />
            <h2 className="mt-4 text-lg font-semibold">Hinário ainda não carregado</h2>
            <p className="mt-2 text-sm text-[hsl(var(--dark-muted))] max-w-sm mx-auto">
              Envie o JSON da Harpa Cristã Atalaia para que os hinos apareçam aqui,
              com busca por número/título e leitura em tela cheia.
            </p>
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-16">
            Nenhum hino encontrado para "{query}".
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.map((h) => (
              <li key={h.number}>
                <button
                  onClick={() => setSelected(h)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] border border-white/5 active:scale-[0.99] transition"
                >
                  <span className="w-11 h-11 flex-shrink-0 rounded-lg bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-sm">
                    {h.number}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate text-sm">{h.title}</span>
                    {h.author && (
                      <span className="block text-[11px] text-[hsl(var(--dark-muted))] truncate">
                        {h.author}
                      </span>
                    )}
                  </span>
                  <Music2 className="w-4 h-4 text-[hsl(var(--dark-muted))] flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Leitor de hino */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-[hsl(var(--background))] overflow-y-auto animate-fade-in">
          <header className="sticky top-0 z-10 bg-[hsl(var(--background))]/95 backdrop-blur border-b border-white/5">
            <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 active:scale-95 transition"
                aria-label="Fechar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-xs">
                {selected.number}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">{selected.title}</h2>
                {(selected.author || selected.key) && (
                  <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-tight truncate">
                    {[selected.author, selected.key].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            </div>
          </header>

          <article className="max-w-2xl mx-auto px-5 py-6 space-y-6 text-[hsl(var(--dark-text))] leading-relaxed">
            {selected.reference && (
              <p className="text-xs text-[hsl(var(--dark-muted))] italic">{selected.reference}</p>
            )}
            {selected.strophes.map((s, i) => (
              <div
                key={i}
                className={
                  s.chorus
                    ? "pl-3 border-l-2 border-amber-500/60 italic"
                    : ""
                }
              >
                {!s.chorus && (
                  <span className="block text-xs text-amber-400/70 font-semibold mb-1">
                    {i + 1}
                  </span>
                )}
                {s.chorus && (
                  <span className="block text-xs text-amber-400/70 font-semibold mb-1">
                    Coro
                  </span>
                )}
                {s.lines.map((line, j) => (
                  <p key={j} className="text-[15px]">{line}</p>
                ))}
              </div>
            ))}
            {selected.composer && (
              <p className="text-xs text-[hsl(var(--dark-muted))] pt-4 border-t border-white/5">
                Melodia: {selected.composer}
              </p>
            )}
          </article>
        </div>
      )}
    </div>
  );
};

export default HarpaPage;