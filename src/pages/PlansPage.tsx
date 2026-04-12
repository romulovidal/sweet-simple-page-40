import { useState, useEffect, useCallback } from "react";
import { bibleBooks } from "@/data/bible";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ChevronLeft, CheckCircle, Circle, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getChapter, type BibleVerse, DEFAULT_VERSION_ID } from "@/services/bibleApi";

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

interface DBPlan {
  id: string;
  title: string;
  description: string;
  image_emoji: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  devotional?: string;
  total_days?: number;
}

interface DBReading {
  id: string;
  plan_id: string;
  day_number: number;
  book_abbrev: string;
  chapter: number;
  title?: string;
  verse_start?: number;
  verse_end?: number;
}

const PlansPage = () => {
  const [planProgress, setPlanProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);
  const [selectedPlan, setSelectedPlan] = useLocalStorage<string | null>("selected-plan", null);
  const [plans, setPlans] = useState<DBPlan[]>([]);
  const [readings, setReadings] = useState<DBReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [dayVerses, setDayVerses] = useState<BibleVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [bibleVersion] = useLocalStorage<string>("bible-version", DEFAULT_VERSION_ID);

  useEffect(() => {
    supabase.from("admin_plans").select("*").eq("is_active", true).order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setPlans(data as unknown as DBPlan[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedPlan) { setReadings([]); return; }
    setLoadingReadings(true);
    supabase.from("admin_plan_readings").select("*").eq("plan_id", selectedPlan).order("day_number", { ascending: true })
      .then(({ data }) => {
        if (data) setReadings(data as unknown as DBReading[]);
        setLoadingReadings(false);
      });
  }, [selectedPlan]);

  const plan = selectedPlan ? plans.find((p) => p.id === selectedPlan) : null;
  const progress = selectedPlan ? planProgress.find((p) => p.planId === selectedPlan) : null;

  const startPlan = (planId: string) => {
    if (!planProgress.some((p) => p.planId === planId)) {
      setPlanProgress((prev) => [...prev, { planId, completedDays: [], startedAt: new Date().toISOString() }]);
    }
    setSelectedPlan(planId);
  };

  const toggleDayComplete = (dayIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCompleting = !progress?.completedDays.includes(dayIndex);
    setPlanProgress((prev) =>
      prev.map((p) =>
        p.planId === selectedPlan
          ? { ...p, completedDays: p.completedDays.includes(dayIndex) ? p.completedDays.filter((d) => d !== dayIndex) : [...p.completedDays, dayIndex] }
          : p
      )
    );
    if (isCompleting) toast.success("Leitura concluída! ✅");
    else toast("Leitura desmarcada");
  };

  const handleReadingClick = (bookAbbrev: string, chapter: number, dayIndex: number, verseStart?: number) => {
    if (!progress?.completedDays.includes(dayIndex)) {
      setPlanProgress((prev) =>
        prev.map((p) => p.planId === selectedPlan ? { ...p, completedDays: [...p.completedDays, dayIndex] } : p)
      );
      toast.success("Leitura concluída! ✅");
    }
    const params = new URLSearchParams({ book: bookAbbrev, chapter: String(chapter) });
    if (verseStart) params.set("verse", String(verseStart));
    navigate(`/biblia?${params.toString()}`);
  };

  // Plan detail view
  if (plan) {
    const completedDays = progress?.completedDays || [];
    const totalReadings = readings.length;
    const totalDays = plan.total_days || totalReadings;
    const completedCount = completedDays.length;
    const progressPercent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => setSelectedPlan(null)}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{plan.title}</h1>
            <p className="text-xs text-[hsl(var(--dark-muted))]">
              {completedCount}/{totalDays} leituras • {progressPercent}%
            </p>
          </div>
        </header>

        {/* Progress bar */}
        <div className="px-5 mb-4">
          <div className="w-full h-2.5 bg-[hsl(var(--dark-card))] rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          {progressPercent === 100 && (
            <p className="text-center text-sm text-primary font-semibold mt-3">🎉 Plano concluído! Parabéns!</p>
          )}
        </div>

        {/* Devotional */}
        {plan.devotional && (
          <div className="px-5 mb-4">
            <div className="bg-primary/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary mb-2">📖 Devocional</p>
              <p className="text-sm text-dark-text/80 leading-relaxed whitespace-pre-line">{plan.devotional}</p>
            </div>
          </div>
        )}

        {/* Readings list */}
        {loadingReadings ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-5 space-y-1.5">
            {readings.map((reading, i) => {
              const book = bibleBooks.find((b) => b.apiAbbrev === reading.book_abbrev);
              const isComplete = completedDays.includes(i);
              const verseRange = reading.verse_start
                ? `${reading.verse_start}${reading.verse_end ? `-${reading.verse_end}` : ""}`
                : "";
              return (
                <div key={reading.id} className={`flex items-center gap-3 rounded-xl transition-all ${isComplete ? "opacity-70" : ""}`}>
                  <button onClick={(e) => toggleDayComplete(i, e)} className="flex-shrink-0 transition-transform active:scale-90">
                    {isComplete
                      ? <CheckCircle className="w-7 h-7 text-primary" />
                      : <Circle className="w-7 h-7 text-[hsl(var(--dark-muted))]" />}
                  </button>
                  <button
                    onClick={() => handleReadingClick(reading.book_abbrev, reading.chapter, i, reading.verse_start)}
                    className="flex-1 py-3 px-4 rounded-xl text-left active:bg-[hsl(var(--dark-card))] transition-colors">
                    {reading.title && (
                      <p className="text-[10px] font-semibold text-primary mb-0.5">{reading.title}</p>
                    )}
                    <p className={`text-sm font-semibold ${isComplete ? "line-through text-[hsl(var(--dark-muted))]" : ""}`}>
                      {book?.name || reading.book_abbrev} {reading.chapter}
                      {verseRange && <span className="font-normal text-[hsl(var(--dark-muted))]">:{verseRange}</span>}
                    </p>
                    <p className="text-xs text-[hsl(var(--dark-muted))]">
                      {isComplete ? "✓ Lido" : `Dia ${reading.day_number}`}
                    </p>
                  </button>
                </div>
              );
            })}
            {readings.length === 0 && (
              <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-10">
                Este plano ainda não tem leituras cadastradas.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Plans list
  if (loading) {
    return (
      <div className="pb-20 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold">Planos de Leitura</h1>
        <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">Escolha um plano e cresça na Palavra</p>
      </header>

      {plans.length === 0 ? (
        <div className="px-5 text-center py-16">
          <p className="text-4xl mb-4">📖</p>
          <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum plano disponível ainda.</p>
          <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Os planos são criados pelo administrador.</p>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {plans.map((plan) => {
            const prog = planProgress.find((p) => p.planId === plan.id);
            const isStarted = !!prog;
            const totalDays = plan.total_days || 0;
            const progressPercent = prog && totalDays > 0
              ? Math.round((prog.completedDays.length / totalDays) * 100)
              : 0;

            return (
              <button key={plan.id} onClick={() => startPlan(plan.id)}
                className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors text-left">
                <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center text-2xl flex-shrink-0">
                  {plan.image_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{plan.title}</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5 line-clamp-2">{plan.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                      {totalDays} dias
                    </span>
                    <span className="text-[10px] text-[hsl(var(--dark-muted))]">{plan.category}</span>
                    {isStarted && (
                      <>
                        <span className="text-[10px] text-primary font-bold">{progressPercent}%</span>
                        {progressPercent >= 100 && <span className="text-[10px]">🎉</span>}
                      </>
                    )}
                  </div>
                  {isStarted && (
                    <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlansPage;
