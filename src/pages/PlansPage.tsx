import { useState, useEffect } from "react";
import { readingPlans, bibleBooks } from "@/data/bible";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CheckCircle, Circle } from "lucide-react";
import { toast } from "sonner";

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

const PlansPage = () => {
  const [planProgress, setPlanProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);
  const [selectedPlan, setSelectedPlan] = useLocalStorage<string | null>("selected-plan", null);
  const navigate = useNavigate();

  const plan = selectedPlan ? readingPlans.find((p) => p.id === selectedPlan) : null;
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
          ? {
              ...p,
              completedDays: p.completedDays.includes(dayIndex)
                ? p.completedDays.filter((d) => d !== dayIndex)
                : [...p.completedDays, dayIndex],
            }
          : p
      )
    );

    if (isCompleting) {
      toast.success("Leitura concluída! ✅");
    } else {
      toast("Leitura desmarcada");
    }
  };

  const handleReadingClick = (bookAbbrev: string, chapter: number, dayIndex: number) => {
    // Mark as complete automatically when opening
    if (!progress?.completedDays.includes(dayIndex)) {
      setPlanProgress((prev) =>
        prev.map((p) =>
          p.planId === selectedPlan
            ? { ...p, completedDays: [...p.completedDays, dayIndex] }
            : p
        )
      );
      toast.success("Leitura concluída! ✅");
    }
    navigate(`/biblia?book=${bookAbbrev}&chapter=${chapter}`);
  };

  // Plan detail view
  if (plan) {
    const completedDays = progress?.completedDays || [];
    const totalReadings = plan.readings.length;
    const completedCount = completedDays.length;
    const progressPercent = totalReadings > 0 ? Math.round((completedCount / totalReadings) * 100) : 0;

    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedPlan(null)}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{plan.title}</h1>
            <p className="text-xs text-[hsl(var(--dark-muted))]">
              {completedCount}/{totalReadings} leituras • {progressPercent}%
            </p>
          </div>
        </header>

        {/* Progress bar */}
        <div className="px-5 mb-6">
          <div className="w-full h-2.5 bg-[hsl(var(--dark-card))] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-center text-sm text-primary font-semibold mt-3">🎉 Plano concluído! Parabéns!</p>
          )}
        </div>

        {/* Readings list */}
        <div className="px-5 space-y-1.5">
          {plan.readings.map((reading, i) => {
            const book = bibleBooks.find((b) => b.apiAbbrev === reading.bookAbbrev);
            const isComplete = completedDays.includes(i);
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl transition-all ${
                  isComplete ? "opacity-70" : ""
                }`}
              >
                {/* Check button */}
                <button
                  onClick={(e) => toggleDayComplete(i, e)}
                  className="flex-shrink-0 transition-transform active:scale-90"
                >
                  {isComplete ? (
                    <CheckCircle className="w-7 h-7 text-primary" />
                  ) : (
                    <Circle className="w-7 h-7 text-[hsl(var(--dark-muted))]" />
                  )}
                </button>

                {/* Reading info - click to open */}
                <button
                  onClick={() => handleReadingClick(reading.bookAbbrev, reading.chapter, i)}
                  className={`flex-1 py-3 px-4 rounded-xl text-left active:bg-[hsl(var(--dark-card))] transition-colors`}
                >
                  <p className={`text-sm font-semibold ${isComplete ? "line-through text-[hsl(var(--dark-muted))]" : ""}`}>
                    {book?.name || reading.bookAbbrev} {reading.chapter}
                  </p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">
                    {isComplete ? "✓ Lido" : `Dia ${i + 1}`}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Plans list
  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold">Planos de Leitura</h1>
        <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">
          Escolha um plano e cresça na Palavra
        </p>
      </header>

      <div className="px-5 space-y-3">
        {readingPlans.map((plan) => {
          const prog = planProgress.find((p) => p.planId === plan.id);
          const isStarted = !!prog;
          const progressPercent = prog && plan.readings.length > 0
            ? Math.round((prog.completedDays.length / plan.readings.length) * 100)
            : 0;

          return (
            <button
              key={plan.id}
              onClick={() => startPlan(plan.id)}
              className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center text-2xl flex-shrink-0">
                {plan.image}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{plan.title}</p>
                <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">{plan.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                    {plan.readings.length} leituras
                  </span>
                  {isStarted && (
                    <>
                      <span className="text-[10px] text-primary font-bold">{progressPercent}%</span>
                      {progressPercent === 100 && <span className="text-[10px]">🎉</span>}
                    </>
                  )}
                </div>
                {isStarted && (
                  <div className="w-full h-1 bg-[hsl(var(--dark-bg))] rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlansPage;
