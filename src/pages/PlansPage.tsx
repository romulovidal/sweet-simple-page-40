import { useState } from "react";
import { readingPlans, bibleBooks } from "@/data/bible";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CheckCircle } from "lucide-react";

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

const PlansPage = () => {
  const [planProgress, setPlanProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const plan = selectedPlan ? readingPlans.find((p) => p.id === selectedPlan) : null;
  const progress = selectedPlan ? planProgress.find((p) => p.planId === selectedPlan) : null;

  const startPlan = (planId: string) => {
    if (!planProgress.some((p) => p.planId === planId)) {
      setPlanProgress((prev) => [...prev, { planId, completedDays: [], startedAt: new Date().toISOString() }]);
    }
    setSelectedPlan(planId);
  };

  const markDayComplete = (dayIndex: number) => {
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
  };

  const navigateToReading = (bookAbbrev: string, chapter: number) => {
    navigate(`/biblia?book=${bookAbbrev}&chapter=${chapter}`);
  };

  // Plan detail view
  if (plan) {
    const completedDays = progress?.completedDays || [];
    const progressPercent = plan.readings.length > 0 ? Math.round((completedDays.length / plan.readings.length) * 100) : 0;

    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedPlan(null)}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">{plan.title}</h1>
            <p className="text-xs text-[hsl(var(--dark-muted))]">{progressPercent}% completo</p>
          </div>
        </header>

        {/* Progress bar */}
        <div className="px-5 mb-6">
          <div className="w-full h-2 bg-[hsl(var(--dark-card))] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Readings list */}
        <div className="px-5 space-y-2">
          {plan.readings.map((reading, i) => {
            const book = bibleBooks.find(
              (b) => b.apiAbbrev === reading.bookAbbrev
            );
            const isComplete = completedDays.includes(i);
            return (
              <div key={i} className="flex items-center gap-3">
                <button
                  onClick={() => markDayComplete(i)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isComplete ? "bg-primary text-white" : "bg-[hsl(var(--dark-card))]"
                  }`}
                >
                  {isComplete ? <CheckCircle className="w-5 h-5" /> : <span className="text-xs">{i + 1}</span>}
                </button>
                <button
                  onClick={() => navigateToReading(reading.bookAbbrev, reading.chapter)}
                  className={`flex-1 py-3 px-4 rounded-xl text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors ${
                    isComplete ? "opacity-60" : ""
                  }`}
                >
                  <p className="text-sm font-semibold">
                    {book?.name || reading.bookAbbrev} {reading.chapter}
                  </p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">Dia {i + 1}</p>
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
                    <span className="text-[10px] text-[hsl(var(--dark-muted))]">{progressPercent}%</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlansPage;
