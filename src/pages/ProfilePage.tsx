import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookmarkCheck,
  BookOpenText,
  ChevronRight,
  Clock3,
  Compass,
  Flame,
  RotateCcw,
  Settings,
  Trash2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLocalStorage, type ReadingProgress, type SavedVerse, type StreakData, type DailyVerseEntry } from "@/hooks/useLocalStorage";

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

type ProfileView = "overview" | "saved" | "history" | "verse-history" | "settings";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [streak, setStreak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });
  const [progress, setProgress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);
  const [planProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);
  const [verseHistory] = useLocalStorage<DailyVerseEntry[]>("daily-verse-history", []);
  const [view, setView] = useState<ProfileView>("overview");

  const activePlansCount = useMemo(
    () => planProgress.filter((plan) => plan.completedDays.length > 0).length,
    [planProgress]
  );

  const readingHistory = useMemo(
    () => [...new Set(streak.history)].sort((first, second) => second.localeCompare(first)),
    [streak.history]
  );

  const recentSavedVerses = useMemo(
    () => [...savedVerses].sort((first, second) => second.savedAt.localeCompare(first.savedAt)).slice(0, 3),
    [savedVerses]
  );

  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const handleContinueReading = () => {
    if (progress) {
      navigate(`/biblia?book=${progress.bookAbbrev}&chapter=${progress.chapter}`);
      return;
    }

    navigate(`/biblia?book=gn&chapter=1`);
  };

  const clearSavedVerses = () => {
    if (savedVerses.length === 0) {
      toast("Você ainda não salvou nenhum versículo.");
      return;
    }

    if (!window.confirm("Deseja apagar todos os versículos salvos?")) return;
    setSavedVerses([]);
    toast.success("Versículos salvos removidos.");
  };

  const resetReadingData = () => {
    if (!window.confirm("Deseja reiniciar seu progresso de leitura e sequência?")) return;

    setProgress(null);
    setStreak({ current: 0, lastDate: "", history: [] });
    toast.success("Seu progresso foi reiniciado.");
  };

  if (view === "verse-history") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">
            ← Voltar
          </button>
          <h1 className="text-lg font-bold">Versículos do Dia</h1>
        </header>
        <div className="px-5 space-y-3">
          {verseHistory.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-10">
              Nenhum versículo do dia registrado ainda. Volte à tela inicial todos os dias!
            </p>
          ) : (
            verseHistory.map((entry) => (
              <div key={entry.date} className="bg-dark-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-primary">{entry.ref}</span>
                  <span className="text-[10px] text-dark-muted">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">"{entry.text}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "saved") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">
            ← Voltar
          </button>
          <h1 className="text-lg font-bold">Versículos Salvos</h1>
        </header>
        <div className="px-5 space-y-3">
          {savedVerses.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-10">
              Nenhum versículo salvo ainda. Salve versículos durante a leitura!
            </p>
          ) : (
            [...savedVerses]
              .sort((first, second) => second.savedAt.localeCompare(first.savedAt))
              .map((verse) => (
                <div key={`${verse.reference}-${verse.savedAt}`} className="bg-dark-card rounded-xl p-4">
                  <p className="text-xs font-semibold text-primary mb-2">{verse.reference}</p>
                  <p className="text-sm leading-relaxed">“{verse.text}”</p>
                  <button
                    onClick={() =>
                      setSavedVerses((prev) => prev.filter((item) => item.savedAt !== verse.savedAt))
                    }
                    className="mt-3 flex items-center gap-1 text-xs text-destructive"
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

  if (view === "history") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">
            ← Voltar
          </button>
          <h1 className="text-lg font-bold">Histórico de Leitura</h1>
        </header>
        <div className="px-5 space-y-4">
          <div className="bg-dark-card rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-dark-muted mb-2">Última leitura</p>
            <p className="font-semibold text-sm">
              {progress ? `${progress.bookName} ${progress.chapter}` : "Nenhuma leitura recente"}
            </p>
            <p className="text-xs text-dark-muted mt-1">
              {progress ? new Date(progress.lastRead).toLocaleString("pt-BR") : "Abra um capítulo para começar"}
            </p>
          </div>

          <div className="bg-dark-card rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-dark-muted mb-3">Dias lidos</p>
            {readingHistory.length === 0 ? (
              <p className="text-sm text-dark-muted">Seu histórico vai aparecer aqui conforme você for lendo.</p>
            ) : (
              <div className="space-y-2">
                {readingHistory.slice(0, 30).map((date) => (
                  <div key={date} className="flex items-center justify-between rounded-xl bg-dark-bg px-3 py-3">
                    <span className="text-sm">{formatDate(date)}</span>
                    <span className="text-xs text-primary font-semibold">Lido</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">
            ← Voltar
          </button>
          <h1 className="text-lg font-bold">Configurações</h1>
        </header>
        <div className="px-5 space-y-3">
          <button
            onClick={handleContinueReading}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors"
          >
            <p className="font-semibold text-sm">Continuar leitura</p>
            <p className="text-xs text-dark-muted mt-1">Retomar exatamente de onde você parou.</p>
          </button>

          <button
            onClick={() => navigate("/descubra")}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors"
          >
            <p className="font-semibold text-sm">Explorar temas</p>
            <p className="text-xs text-dark-muted mt-1">Abrir a busca inteligente de versículos e capítulos.</p>
          </button>

          <button
            onClick={() => navigate("/planos")}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors"
          >
            <p className="font-semibold text-sm">Meus planos</p>
            <p className="text-xs text-dark-muted mt-1">Ver os planos iniciados e acompanhar o progresso.</p>
          </button>

          <button
            onClick={clearSavedVerses}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors"
          >
            <p className="font-semibold text-sm text-destructive">Apagar versículos salvos</p>
            <p className="text-xs text-dark-muted mt-1">Limpar sua lista de versículos guardados.</p>
          </button>

          <button
            onClick={resetReadingData}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors"
          >
            <p className="font-semibold text-sm text-destructive">Reiniciar progresso</p>
            <p className="text-xs text-dark-muted mt-1">Zerar sequência e última leitura do aplicativo.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Você</h1>
      </header>

      <div className="px-5 mb-6">
        <div className="bg-dark-card rounded-2xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center text-2xl">
            🙏
          </div>
          <div>
            <p className="font-bold text-lg">Leitor da Palavra</p>
            <p className="text-sm text-dark-muted">
              {savedVerses.length} versículo{savedVerses.length !== 1 ? "s" : ""} salvo{savedVerses.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Sequência</span>
          </div>
          <p className="text-2xl font-bold">{streak.current}</p>
          <p className="text-xs text-dark-muted mt-1">dia{streak.current !== 1 ? "s" : ""} seguidos</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <BookOpenText className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Última leitura</span>
          </div>
          <p className="text-sm font-bold line-clamp-1">{progress ? `${progress.bookName} ${progress.chapter}` : "Nenhuma"}</p>
          <p className="text-xs text-dark-muted mt-1">{progress ? "Pronto para continuar" : "Comece hoje"}</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <BookmarkCheck className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Salvos</span>
          </div>
          <p className="text-2xl font-bold">{savedVerses.length}</p>
          <p className="text-xs text-dark-muted mt-1">versículos guardados</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Compass className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Planos</span>
          </div>
          <p className="text-2xl font-bold">{activePlansCount}</p>
          <p className="text-xs text-dark-muted mt-1">em andamento</p>
        </div>
      </div>

      <div className="px-5 mb-6">
        <button
          onClick={handleContinueReading}
          className="w-full bg-primary text-primary-foreground rounded-2xl p-4 text-left active:opacity-90 transition-opacity"
        >
          <p className="font-semibold text-sm">Continuar leitura</p>
          <p className="text-xs opacity-90 mt-1">
            {progress ? `${progress.bookName} ${progress.chapter}` : "Abrir Gênesis 1 agora"}
          </p>
        </button>
      </div>

      {recentSavedVerses.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Recentes</h2>
            <button onClick={() => setView("saved")} className="text-xs text-primary font-semibold">
              Ver todos
            </button>
          </div>
          <div className="space-y-2">
            {recentSavedVerses.map((verse) => (
              <div key={verse.savedAt} className="bg-dark-card rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-1">{verse.reference}</p>
                <p className="text-sm text-dark-muted line-clamp-2">“{verse.text}”</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 space-y-1">
        {[
          { key: "saved", label: "Versículos salvos", icon: BookmarkCheck, value: String(savedVerses.length) },
          { key: "verse-history", label: "Versículos do dia", icon: Sparkles, value: verseHistory.length ? `${verseHistory.length} dias` : "Vazio" },
          { key: "history", label: "Histórico de leitura", icon: Clock3, value: readingHistory.length ? formatDate(readingHistory[0]) : "Vazio" },
          { key: "settings", label: "Configurações", icon: Settings, value: "Gerenciar" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key as ProfileView)}
            className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-dark-card transition-colors text-left"
          >
            <item.icon className="w-5 h-5 text-dark-muted" />
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            <span className="text-xs text-dark-muted">{item.value}</span>
            <ChevronRight className="w-4 h-4 text-dark-muted" />
          </button>
        ))}

        <button
          onClick={() => navigate("/descubra")}
          className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-dark-card transition-colors text-left"
        >
          <Compass className="w-5 h-5 text-dark-muted" />
          <span className="flex-1 text-sm font-medium">Descobrir versículos</span>
          <ChevronRight className="w-4 h-4 text-dark-muted" />
        </button>
      </div>

      <div className="px-5 mt-6 text-center">
        <button
          onClick={resetReadingData}
          className="inline-flex items-center gap-2 text-xs text-dark-muted font-semibold"
        >
          <RotateCcw className="w-3 h-3" /> Reiniciar meus dados locais
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
