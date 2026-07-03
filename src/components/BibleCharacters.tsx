import { useState, useMemo, useEffect } from "react";
import { Users, X, ChevronRight, BookOpen, Sparkles, Search, ArrowLeft, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBackHandler } from "@/hooks/useBackHandler";
import { BIBLE_CHARACTERS, findCharacterByName, type BibleCharacter, type CharacterCategory } from "@/data/bibleCharacters";

interface Props {
  onNavigateReference?: (reference: string) => void;
}

const CATEGORY_LABELS: Record<CharacterCategory | "todos", string> = {
  todos: "Todos",
  patriarca: "Patriarcas",
  lider: "Líderes",
  profeta: "Profetas",
  rei: "Reis",
  apostolo: "Apóstolos",
  jesus: "Jesus",
  outro: "Outros",
};

const CATEGORY_ORDER: (CharacterCategory | "todos")[] = [
  "todos",
  "jesus",
  "patriarca",
  "lider",
  "profeta",
  "rei",
  "apostolo",
  "outro",
];

const BibleCharacters = ({ onNavigateReference }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BibleCharacter | null>(null);
  const [filter, setFilter] = useState<CharacterCategory | "todos">("todos");
  const [search, setSearch] = useState("");

  useBackHandler(open, () => {
    if (selected) setSelected(null);
    else setOpen(false);
  });

  // Escutar evento global para abrir personagem por nome (vindo da Timeline)
  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name;
      if (!name) return;
      const char = findCharacterByName(name);
      if (char) {
        setSelected(char);
        setOpen(true);
      }
    };
    window.addEventListener("open-bible-character", handler);
    return () => window.removeEventListener("open-bible-character", handler);
  }, []);

  // Abrir a galeria (sem personagem específico) via evento
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("open-bible-characters", h);
    return () => window.removeEventListener("open-bible-characters", h);
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return BIBLE_CHARACTERS.filter((c) => {
      if (filter !== "todos" && c.category !== filter) return false;
      if (!s) return true;
      return c.name.toLowerCase().includes(s) || c.aka?.some((a) => a.toLowerCase().includes(s));
    });
  }, [filter, search]);

  const askAI = (char: BibleCharacter) => {
    const question = `Quem foi ${char.name} na Bíblia? Fale sobre sua vida, seu papel na história da salvação e o que podemos aprender com ele.`;
    window.dispatchEvent(new CustomEvent("open-ask-bible", { detail: { prefill: question } }));
    setOpen(false);
  };

  const goToReference = (ref: string) => {
    onNavigateReference?.(ref);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Personagens Bíblicos"
        aria-label="Personagens Bíblicos"
        className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center hover:bg-dark-card-hover transition-colors"
      >
        <Users className="w-4 h-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[92vh] rounded-t-[2rem] p-0 flex flex-col border-0 [&>button.absolute]:hidden"
          style={{ background: "linear-gradient(180deg, hsl(var(--dark-bg)) 0%, hsl(var(--dark-card) / 0.4) 100%)" }}
        >
          <SheetHeader className="relative px-5 pt-5 pb-4 flex-shrink-0 border-b border-[hsl(var(--dark-card-hover))]">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[hsl(var(--dark-muted)/0.3)]" />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                {selected && (
                  <button
                    onClick={() => setSelected(null)}
                    className="p-2 rounded-xl bg-[hsl(var(--dark-card))]"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                  </button>
                )}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.3)] text-lg"
                  style={{
                    background: selected
                      ? `linear-gradient(135deg, hsl(${selected.color}) 0%, hsl(${selected.color} / 0.5) 100%)`
                      : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.6) 100%)",
                  }}
                >
                  {selected ? selected.icon : <Users className="w-[18px] h-[18px] text-white" />}
                </div>
                <div className="text-left">
                  <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))]">
                    {selected ? selected.name : "Personagens Bíblicos"}
                  </SheetTitle>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest">
                    {selected ? selected.role : "Perfis · Vidas · Momentos"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl bg-[hsl(var(--dark-card))]"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
              </button>
            </div>
          </SheetHeader>

          {!selected ? (
            <>
              {/* Search */}
              <div className="flex-shrink-0 px-5 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar personagem..."
                    className="w-full bg-[hsl(var(--dark-card))] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[hsl(var(--dark-text))] placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Category chips */}
              <div className="flex-shrink-0 overflow-x-auto scrollbar-none border-b border-[hsl(var(--dark-card-hover))]">
                <div className="flex gap-2 px-5 py-3 min-w-max">
                  {CATEGORY_ORDER.map((cat) => {
                    const active = filter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
                        style={{
                          background: active ? "hsl(var(--primary) / 0.2)" : "hsl(var(--dark-card))",
                          color: active ? "hsl(var(--primary))" : "hsl(var(--dark-muted))",
                          border: active ? "1px solid hsl(var(--primary) / 0.5)" : "1px solid transparent",
                        }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Character grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-[hsl(var(--dark-muted))] mt-8">
                    Nenhum personagem encontrado.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filtered.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="text-left rounded-2xl p-3 bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors"
                        style={{ border: `1px solid hsl(${c.color} / 0.2)` }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, hsl(${c.color}) 0%, hsl(${c.color} / 0.5) 100%)` }}
                          >
                            {c.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-bold text-[hsl(var(--dark-text))] leading-tight truncate">{c.name}</h4>
                            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: `hsl(${c.color})` }}>
                              {CATEGORY_LABELS[c.category]}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-[hsl(var(--dark-muted))] leading-snug line-clamp-2">{c.role}</p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-center text-[10px] text-[hsl(var(--dark-muted)/0.6)] mt-6">
                  👤 Personagens Bíblicos · Bíblia do Atalaia
                </p>
              </div>
            </>
          ) : (
            /* ── Character detail ── */
            <div className="flex-1 overflow-y-auto">
              {/* Hero */}
              <div
                className="px-5 py-5 border-b border-[hsl(var(--dark-card-hover))]"
                style={{
                  background: `linear-gradient(180deg, hsl(${selected.color} / 0.15) 0%, transparent 100%)`,
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(${selected.color})` }}>
                  {selected.era} · {CATEGORY_LABELS[selected.category]}
                </p>
                {selected.aka && selected.aka.length > 0 && (
                  <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">
                    Também: {selected.aka.join(", ")}
                  </p>
                )}
                <p className="text-[13px] text-[hsl(var(--dark-text))] leading-relaxed mt-3">{selected.bio}</p>
                <button
                  onClick={() => askAI(selected)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, hsl(${selected.color}) 0%, hsl(${selected.color} / 0.7) 100%)` }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Perguntar à IA sobre {selected.name}
                </button>
              </div>

              {/* Momentos marcantes */}
              <div className="px-5 py-4 border-b border-[hsl(var(--dark-card-hover))]">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-3">
                  <Clock className="w-3 h-3" />
                  Momentos marcantes
                </h3>
                <ol className="relative border-l-2 space-y-3 pl-4" style={{ borderColor: `hsl(${selected.color} / 0.35)` }}>
                  {selected.moments.map((m, idx) => (
                    <li key={idx} className="relative">
                      <span
                        className="absolute -left-[22px] top-1 w-3 h-3 rounded-full ring-4 ring-[hsl(var(--dark-bg))]"
                        style={{ background: `hsl(${selected.color})` }}
                      />
                      {m.year && (
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(${selected.color})` }}>
                          {m.year}
                        </p>
                      )}
                      <h4 className="text-[13px] font-bold text-[hsl(var(--dark-text))] leading-tight mt-0.5">{m.title}</h4>
                      <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-snug mt-1">{m.description}</p>
                      {m.reference && (
                        <button
                          onClick={() => goToReference(m.reference!)}
                          className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--dark-text))] hover:opacity-80 group"
                        >
                          <BookOpen className="w-3 h-3" style={{ color: `hsl(${selected.color})` }} />
                          <span>{m.reference}</span>
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Versículos-chave */}
              <div className="px-5 py-4">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-3">
                  <BookOpen className="w-3 h-3" />
                  Versículos-chave
                </h3>
                <ul className="space-y-2">
                  {selected.keyVerses.map((v, idx) => (
                    <li key={idx}>
                      <button
                        onClick={() => goToReference(v.reference)}
                        className="w-full text-left rounded-xl p-3 bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors group"
                        style={{ border: `1px solid hsl(${selected.color} / 0.15)` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-[hsl(var(--dark-text))]">{v.reference}</span>
                          <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))] group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-snug mt-1">{v.note}</p>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-center text-[10px] text-[hsl(var(--dark-muted)/0.6)] mt-6">
                  👤 {selected.name} · Bíblia do Atalaia
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BibleCharacters;