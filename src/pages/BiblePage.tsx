import { useState } from "react";
import { bibleBooks, type BibleBook } from "@/data/bible";
import { ChevronLeft, Search } from "lucide-react";

const BiblePage = () => {
  const [testament, setTestament] = useState<"VT" | "NT">("VT");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filteredBooks = bibleBooks.filter(
    (b) =>
      b.testament === testament &&
      b.name.toLowerCase().includes(search.toLowerCase())
  );

  // Chapter view
  if (selectedBook && selectedChapter) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedChapter(null)}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">
            {selectedBook.name} {selectedChapter}
          </h1>
        </header>
        <div className="px-5 py-4">
          <p className="text-[hsl(var(--dark-muted))] text-sm leading-relaxed">
            Conteúdo de {selectedBook.name} capítulo {selectedChapter} será exibido aqui quando conectado a uma API da Bíblia.
          </p>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 10 }, (_, i) => (
              <p key={i} className="text-sm leading-relaxed">
                <span className="text-primary font-bold mr-2 text-xs">{i + 1}</span>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            ))}
          </div>
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

        {/* Search */}
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

        {/* Testament tabs */}
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
