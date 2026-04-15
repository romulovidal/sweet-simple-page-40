import { useState, useEffect, useCallback } from "react";
import { useFontSize } from "@/hooks/useFontSize";
import FontSizeControls from "@/components/FontSizeControls";
import { bibleBooks } from "@/data/bible";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ChevronLeft, CheckCircle, Circle, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getChapter,
  type BibleChapterEpigraph,
  type BibleVerse,
  DEFAULT_VERSION_ID,
  getVersionById,
} from "@/services/bibleApi";
import { isRedLetterVerse } from "@/data/redLetterVerses";
import { readJsonStorage, writeJsonStorage } from "@/lib/localData";
import BibleEpigraph from "@/components/BibleEpigraph";
import BibleVersionPicker from "@/components/BibleVersionPicker";

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

const PLANS_CACHE_KEY = "cached-admin-plans";
const planReadingsCacheKey = (planId: string) => `cached-admin-plan-readings:${planId}`;

const PlansPage = () => {
  const { fontSize, increase: incFont, decrease: decFont, canIncrease: canIncFont, canDecrease: canDecFont } = useFontSize();
  const [planProgress, setPlanProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);
  const [selectedPlan, setSelectedPlan] = useLocalStorage<string | null>("selected-plan", null);
  const [plans, setPlans] = useState<DBPlan[]>(() => readJsonStorage<DBPlan[]>(PLANS_CACHE_KEY, []));
  const [readings, setReadings] = useState<DBReading[]>([]);
  const [loading, setLoading] = useState(() => readJsonStorage<DBPlan[]>(PLANS_CACHE_KEY, []).length === 0);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [bibleVersion, setBibleVersion] = useLocalStorage<string>("bible-version", DEFAULT_VERSION_ID);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Day reading state: which day is open, which reading index within that day
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [readingIndexInDay, setReadingIndexInDay] = useState(0);
  const [dayVerses, setDayVerses] = useState<BibleVerse[]>([]);
  const [dayEpigraphs, setDayEpigraphs] = useState<BibleChapterEpigraph[]>([]);

  useEffect(() => {
    let cancelled = false;

    supabase.from("admin_plans").select("*").eq("is_active", true).order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const nextPlans = data as unknown as DBPlan[];
        setPlans(nextPlans);
        writeJsonStorage(PLANS_CACHE_KEY, nextPlans, false, "cache");
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      }, () => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlan) {
      setReadings([]);
      setLoadingVerses(false);
      return;
    }

    const cachedReadings = readJsonStorage<DBReading[]>(planReadingsCacheKey(selectedPlan), []);
    setReadings(cachedReadings);
    setLoadingVerses(cachedReadings.length === 0);

    let cancelled = false;

    supabase.from("admin_plan_readings").select("*").eq("plan_id", selectedPlan).order("day_number", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const nextReadings = data as unknown as DBReading[];
        setReadings(nextReadings);
        writeJsonStorage(planReadingsCacheKey(selectedPlan), nextReadings, false, "cache");
      })
      .then(() => {
        if (!cancelled) setLoadingVerses(false);
      }, () => {
        if (!cancelled) setLoadingVerses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlan]);

  // Group readings by day_number
  const dayGroups = readings.reduce<Record<number, DBReading[]>>((acc, r) => {
    if (!acc[r.day_number]) acc[r.day_number] = [];
    acc[r.day_number].push(r);
    return acc;
  }, {});
  const dayNumbers = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);

  const plan = selectedPlan ? plans.find((p) => p.id === selectedPlan) : null;
  const progress = selectedPlan ? planProgress.find((p) => p.planId === selectedPlan) : null;

  const startPlan = (planId: string) => {
    if (!planProgress.some((p) => p.planId === planId)) {
      setPlanProgress((prev) => [...prev, { planId, completedDays: [], startedAt: new Date().toISOString() }]);
    }
    setSelectedPlan(planId);
  };

  const toggleDayComplete = (dayNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCompleting = !progress?.completedDays.includes(dayNum);
    setPlanProgress((prev) =>
      prev.map((p) =>
        p.planId === selectedPlan
          ? { ...p, completedDays: p.completedDays.includes(dayNum) ? p.completedDays.filter((d) => d !== dayNum) : [...p.completedDays, dayNum] }
          : p
      )
    );
    if (isCompleting) toast.success("Dia concluído! ✅");
    else toast("Dia desmarcado");
  };

  const loadReadingVerses = useCallback(async (reading: DBReading, versionOverride?: string) => {
    setLoadingVerses(true);
    try {
      const result = await getChapter(reading.book_abbrev, reading.chapter, versionOverride || bibleVersion);
      let filtered = result.verses;
      let filteredEpigraphs = result.epigraphs;
      if (reading.verse_start) {
        filtered = filtered.filter(
          (v) => v.number >= reading.verse_start! && (!reading.verse_end || v.number <= reading.verse_end)
        );

        const rangeStart = reading.verse_start;
        const rangeEnd = reading.verse_end ?? Number.MAX_SAFE_INTEGER;
        filteredEpigraphs = filteredEpigraphs.filter((epigraph) => {
          const epigraphStartVerse = epigraph.start.chapter === reading.chapter ? epigraph.start.verse : 1;
          const epigraphEndVerse = epigraph.end.chapter === reading.chapter ? epigraph.end.verse : Number.MAX_SAFE_INTEGER;
          return epigraphEndVerse >= rangeStart && epigraphStartVerse <= rangeEnd;
        });
      }
      setDayVerses(filtered);
      setDayEpigraphs(filteredEpigraphs);
    } catch {
      setDayVerses([]);
      setDayEpigraphs([]);
      toast.error("Erro ao carregar texto");
    }
    setLoadingVerses(false);
  }, [bibleVersion]);

  const openDay = (dayNum: number) => {
    setSelectedDay(dayNum);
    setReadingIndexInDay(0);
    const dayReadings = dayGroups[dayNum];
    if (dayReadings?.[0]) loadReadingVerses(dayReadings[0]);
  };

  const handleNext = () => {
    if (selectedDay === null) return;
    const dayReadings = dayGroups[selectedDay] || [];
    const nextIndex = readingIndexInDay + 1;
    if (nextIndex < dayReadings.length) {
      // Go to next reading within the same day
      setReadingIndexInDay(nextIndex);
      loadReadingVerses(dayReadings[nextIndex]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Last reading — mark day complete and go back
      if (!progress?.completedDays.includes(selectedDay)) {
        setPlanProgress((prev) =>
          prev.map((p) => p.planId === selectedPlan ? { ...p, completedDays: [...p.completedDays, selectedDay] } : p)
        );
        toast.success("Dia concluído! ✅");
      }
      setSelectedDay(null);
      setDayVerses([]);
      setDayEpigraphs([]);
      setReadingIndexInDay(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Reading detail view
  if (plan && selectedDay !== null) {
    const dayReadings = dayGroups[selectedDay] || [];
    const reading = dayReadings[readingIndexInDay];
    const book = reading ? bibleBooks.find((b) => b.apiAbbrev === reading.book_abbrev) : null;
    const verseRange = reading?.verse_start
      ? `${reading.verse_start}${reading.verse_end ? `-${reading.verse_end}` : ""}`
      : "";
    const refLabel = `${book?.name || reading?.book_abbrev} ${reading?.chapter}${verseRange ? `:${verseRange}` : ""}`;
    const isLastReading = readingIndexInDay >= dayReadings.length - 1;
    const currentVersion = getVersionById(bibleVersion);

    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => { setSelectedDay(null); setDayVerses([]); setDayEpigraphs([]); setReadingIndexInDay(0); }}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Dia {String(selectedDay).padStart(2, "0")}</h1>
            <p className="text-xs text-[hsl(var(--dark-muted))]">
              {refLabel} • {readingIndexInDay + 1}/{dayReadings.length}
            </p>
          </div>
          <button
            onClick={() => setShowVersionPicker(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--dark-card))] text-xs font-semibold"
          >
            {currentVersion.shortName}
            <ChevronDown className="w-3 h-3" />
          </button>
        </header>

        {reading?.title && (
          <div className="px-5 mb-3">
            <p className="text-sm font-semibold text-primary">{reading.title}</p>
          </div>
        )}

        {!loadingVerses && dayVerses.length > 0 && !currentVersion.supportsEpigraphs && (
          <div className="px-5 mb-3">
            <div className="rounded-xl border border-[hsl(var(--dark-card))] bg-[hsl(var(--dark-card))]/60 px-4 py-3">
              <p className="text-xs text-[hsl(var(--dark-muted))]">
                A edicao {currentVersion.shortName} disponivel aqui nao inclui epigrafes no arquivo fonte.
              </p>
            </div>
          </div>
        )}

        {loadingVerses ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-5 space-y-3">
            {dayVerses.map((v) => {
              const verseEpigraphs = dayEpigraphs.filter((epigraph) => epigraph.displayVerse === v.number);
              const isRed = reading ? isRedLetterVerse(reading.book_abbrev, reading.chapter, v.number) : false;
              return (
                <div key={v.number}>
                  {verseEpigraphs.map((epigraph) => (
                    <BibleEpigraph
                      key={`${epigraph.title}-${epigraph.start.chapter}-${epigraph.start.verse}`}
                      title={epigraph.title}
                      continuesFromPreviousChapter={epigraph.continuesFromPreviousChapter}
                    />
                  ))}
                  <p className={`text-sm leading-relaxed ${isRed ? "text-red-400" : ""}`}>
                    <span className={`text-xs font-bold mr-1.5 ${isRed ? "text-red-400" : "text-primary"}`}>{v.number}</span>
                    {v.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 mt-8 pb-4">
          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-4 font-semibold text-sm active:opacity-90 transition-opacity"
          >
            {isLastReading ? (
              "Encerrar dia ✅"
            ) : (
              <>Próximo <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        <BibleVersionPicker
          open={showVersionPicker}
          selectedVersionId={bibleVersion}
          onClose={() => setShowVersionPicker(false)}
          onSelect={(versionId) => {
            setBibleVersion(versionId);
            setShowVersionPicker(false);
            if (reading) loadReadingVerses(reading, versionId);
          }}
        />
      </div>
    );
  }

  // Plan detail view — simplified day list
  if (plan) {
    const completedDays = progress?.completedDays || [];
    const totalDays = plan.total_days || dayNumbers.length;
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
              {completedCount}/{totalDays} dias • {progressPercent}%
            </p>
          </div>
        </header>

        <div className="px-5 mb-4">
          <div className="w-full h-2.5 bg-[hsl(var(--dark-card))] rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          {progressPercent === 100 && (
            <p className="text-center text-sm text-primary font-semibold mt-3">🎉 Plano concluído! Parabéns!</p>
          )}
        </div>

        {plan.devotional && (
          <div className="px-5 mb-4">
            <div className="bg-primary/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary mb-2">📖 Devocional</p>
              <p className="text-sm text-dark-text/80 leading-relaxed whitespace-pre-line">{plan.devotional}</p>
            </div>
          </div>
        )}

        {loadingVerses && readings.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-5 space-y-2">
            {dayNumbers.map((dayNum) => {
              const isComplete = completedDays.includes(dayNum);
              const dayReadings = dayGroups[dayNum];
              const chaptersCount = dayReadings.length;
              return (
                <div key={dayNum} className={`flex items-center gap-3 rounded-xl transition-all ${isComplete ? "opacity-70" : ""}`}>
                  <button onClick={(e) => toggleDayComplete(dayNum, e)} className="flex-shrink-0 transition-transform active:scale-90">
                    {isComplete
                      ? <CheckCircle className="w-7 h-7 text-primary" />
                      : <Circle className="w-7 h-7 text-[hsl(var(--dark-muted))]" />}
                  </button>
                  <button
                    onClick={() => openDay(dayNum)}
                    className="flex-1 py-3 px-4 rounded-xl text-left active:bg-[hsl(var(--dark-card))] transition-colors"
                  >
                    <p className={`text-sm font-semibold ${isComplete ? "line-through text-[hsl(var(--dark-muted))]" : ""}`}>
                      Dia {String(dayNum).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-[hsl(var(--dark-muted))]">
                      {isComplete ? "✓ Concluído" : `${chaptersCount} leitura${chaptersCount > 1 ? "s" : ""}`}
                    </p>
                  </button>
                </div>
              );
            })}
            {dayNumbers.length === 0 && (
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
