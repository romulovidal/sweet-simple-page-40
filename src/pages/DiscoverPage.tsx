import { Search } from "lucide-react";
import { useState } from "react";

const categories = [
  { emoji: "🙏", label: "Oração" },
  { emoji: "💪", label: "Fé" },
  { emoji: "❤️", label: "Amor" },
  { emoji: "😌", label: "Paz" },
  { emoji: "📖", label: "Estudo" },
  { emoji: "🎵", label: "Louvor" },
  { emoji: "👨‍👩‍👧‍👦", label: "Família" },
  { emoji: "💼", label: "Trabalho" },
];

const popularVerses = [
  { ref: "João 3:16", text: "Porque Deus amou o mundo de tal maneira..." },
  { ref: "Salmos 23:1", text: "O Senhor é o meu pastor; nada me faltará." },
  { ref: "Filipenses 4:13", text: "Tudo posso naquele que me fortalece." },
  { ref: "Romanos 8:28", text: "Todas as coisas cooperam para o bem..." },
  { ref: "Isaías 41:10", text: "Não temas, porque eu sou contigo..." },
  { ref: "Josué 1:9", text: "Sê forte e corajoso; não temas..." },
];

const DiscoverPage = () => {
  const [search, setSearch] = useState("");

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
            placeholder="Buscar versículos, temas..."
            className="w-full bg-[hsl(var(--dark-card))] rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-[hsl(var(--dark-muted))] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </header>

      {/* Categories */}
      <div className="px-5 mb-6">
        <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
          Categorias
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.label}
              className="bg-[hsl(var(--dark-card))] rounded-xl p-3 flex flex-col items-center gap-1 active:bg-[hsl(var(--dark-card-hover))] transition-colors"
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-[10px] font-medium text-[hsl(var(--dark-muted))]">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Verses */}
      <div className="px-5">
        <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
          Versículos populares
        </h2>
        <div className="space-y-2">
          {popularVerses.map((v) => (
            <div
              key={v.ref}
              className="bg-[hsl(var(--dark-card))] rounded-xl p-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors"
            >
              <p className="text-xs font-semibold text-primary mb-1">{v.ref}</p>
              <p className="text-sm text-[hsl(var(--dark-text))]">{v.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
