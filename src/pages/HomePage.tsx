import { useState, useEffect } from "react";
import { Search, Bell } from "lucide-react";
import StreakBadge from "@/components/StreakBadge";
import VerseCard from "@/components/VerseCard";
import { getDailyVerse, readingPlans } from "@/data/bible";
import { getRandomVerse } from "@/services/bibleApi";
import { useNavigate } from "react-router-dom";
import { useLocalStorage, type ReadingProgress, type StreakData } from "@/hooks/useLocalStorage";

const HomePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"hoje" | "comunidade">("hoje");
  const [streak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });
  const [progress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);

  // Try to get a random verse from API, fallback to local
  const [verse, setVerse] = useState(getDailyVerse());
  const [verseLoading, setVerseLoading] = useState(true);

  useEffect(() => {
    // Check if we already fetched today's verse
    const cached = localStorage.getItem("daily-verse-cache");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const today = new Date().toISOString().split("T")[0];
        if (parsed.date === today) {
          setVerse(parsed.verse);
          setVerseLoading(false);
          return;
        }
      } catch {}
    }

    getRandomVerse()
      .then((data) => {
        const v = {
          text: data.text,
          ref: `${data.book.name} ${data.chapter}:${data.number}`,
        };
        setVerse(v);
        localStorage.setItem("daily-verse-cache", JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          verse: v,
        }));
      })
      .catch(() => {
        // Keep fallback
      })
      .finally(() => setVerseLoading(false));
  }, []);

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between">
        <StreakBadge days={streak.current} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/descubra")}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <Search className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
          <button className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center">
            <Bell className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 flex gap-6 border-b border-[hsl(var(--dark-card))]">
        {(["hoje", "comunidade"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "text-[hsl(var(--dark-text))] border-b-2 border-[hsl(var(--dark-text))]"
                : "text-[hsl(var(--dark-muted))]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-5 pt-6 space-y-6">
        {activeTab === "hoje" ? (
          <>
            {/* Greeting */}
            <div>
              <h1 className="text-2xl font-bold">Olá! 👋</h1>
              <p className="text-[hsl(var(--dark-muted))] text-sm mt-1">
                {streak.current > 0
                  ? `Você está numa ofensiva de ${streak.current} dia${streak.current > 1 ? "s" : ""}!`
                  : "Comece sua leitura de hoje!"}
              </p>
            </div>

            {/* Verse of the Day */}
            <div>
              <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
                Versículo do dia
              </h2>
              <VerseCard text={verse.text} reference={verse.ref} />
            </div>

            {/* Continue Reading */}
            <div>
              <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
                Continuar lendo
              </h2>
              <button
                onClick={() => navigate("/biblia")}
                className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-lg">
                  📖
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {progress ? `${progress.bookName} ${progress.chapter}` : "Gênesis 1"}
                  </p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">
                    {progress ? "Continue de onde parou" : "Comece a ler agora"}
                  </p>
                </div>
                <span className="text-xs text-[hsl(var(--dark-muted))]">→</span>
              </button>
            </div>

            {/* Reading Plans */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                  Planos de Leitura
                </h2>
                <button
                  onClick={() => navigate("/planos")}
                  className="text-xs text-primary font-semibold"
                >
                  Ver todos
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
                {readingPlans.slice(0, 4).map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => navigate("/planos")}
                    className="flex-shrink-0 w-36 bg-[hsl(var(--dark-card))] rounded-xl p-4 text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                  >
                    <span className="text-2xl mb-2 block">{plan.image}</span>
                    <p className="font-semibold text-xs leading-tight">{plan.title}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">{plan.days} dias</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🤝</p>
            <h2 className="text-lg font-bold mb-2">Comunidade</h2>
            <p className="text-sm text-[hsl(var(--dark-muted))] max-w-xs mx-auto">
              Em breve você poderá compartilhar versículos e devocionais com amigos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
