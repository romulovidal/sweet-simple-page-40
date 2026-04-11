import { Settings, BookmarkCheck, Heart, Clock, ChevronRight, Flame, Trash2 } from "lucide-react";
import { useLocalStorage, type SavedVerse, type StreakData, getToday } from "@/hooks/useLocalStorage";
import { useState } from "react";

const ProfilePage = () => {
  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [streak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });
  const [showSaved, setShowSaved] = useState(false);

  const today = getToday();
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const todayIndex = new Date().getDay();

  // Calculate which days of the current week have been read
  const getWeekHistory = () => {
    const result: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - todayIndex + i);
      const dateStr = d.toISOString().split("T")[0];
      result.push(streak.history.includes(dateStr));
    }
    return result;
  };

  const weekHistory = getWeekHistory();

  if (showSaved) {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setShowSaved(false)} className="text-primary text-sm font-semibold">
            ← Voltar
          </button>
          <h1 className="text-lg font-bold">Versículos Salvos</h1>
        </header>
        <div className="px-5 space-y-3">
          {savedVerses.length === 0 ? (
            <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-10">
              Nenhum versículo salvo ainda. Salve versículos durante a leitura!
            </p>
          ) : (
            savedVerses.map((v, i) => (
              <div key={i} className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-2">{v.reference}</p>
                <p className="text-sm leading-relaxed">"{v.text}"</p>
                <button
                  onClick={() => setSavedVerses((prev) => prev.filter((_, idx) => idx !== i))}
                  className="mt-2 flex items-center gap-1 text-xs text-red-400"
                >
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Você</h1>
      </header>

      {/* Profile card */}
      <div className="px-5 mb-6">
        <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
            🙏
          </div>
          <div>
            <p className="font-bold text-lg">Leitor da Palavra</p>
            <p className="text-sm text-[hsl(var(--dark-muted))]">
              {savedVerses.length} versículo{savedVerses.length !== 1 ? "s" : ""} salvo{savedVerses.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Streak card */}
      <div className="px-5 mb-6">
        <div className="bg-gradient-to-r from-[hsl(25,95%,50%)] to-[hsl(35,95%,55%)] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-6 h-6" />
            <span className="text-2xl font-bold">{streak.current} dia{streak.current !== 1 ? "s" : ""}</span>
          </div>
          <p className="text-sm opacity-90">Sua ofensiva de leitura</p>
          <div className="flex gap-1 mt-3">
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  weekHistory[i] ? "bg-white/30" : "bg-white/10"
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-1">
        <button
          onClick={() => setShowSaved(true)}
          className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-[hsl(var(--dark-card))] transition-colors text-left"
        >
          <BookmarkCheck className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          <span className="flex-1 text-sm font-medium">Versículos salvos</span>
          <span className="text-xs text-[hsl(var(--dark-muted))]">{savedVerses.length}</span>
          <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
        </button>
        <button className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-[hsl(var(--dark-card))] transition-colors text-left">
          <Clock className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          <span className="flex-1 text-sm font-medium">Histórico de leitura</span>
          <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
        </button>
        <button className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-[hsl(var(--dark-card))] transition-colors text-left">
          <Settings className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
          <span className="flex-1 text-sm font-medium">Configurações</span>
          <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
