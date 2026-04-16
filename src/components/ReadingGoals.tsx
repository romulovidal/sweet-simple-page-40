import { useState, useEffect, useCallback } from "react";
import { Target, Loader2, Plus, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface ReadingGoal {
  id: string;
  year: number;
  target_chapters: number;
  completed_chapters: { book: string; chapter: number }[];
}

interface ReadingGoalsProps {
  enabled: boolean;
}

const TOTAL_BIBLE_CHAPTERS = 1189;

const ReadingGoals = ({ enabled }: ReadingGoalsProps) => {
  const { user } = useAuth();
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetInput, setTargetInput] = useState("1189");
  const [showCreate, setShowCreate] = useState(false);

  const currentYear = new Date().getFullYear();

  const fetchGoal = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("reading_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("year", currentYear)
      .single();

    if (data) {
      setGoal({
        ...data,
        completed_chapters: Array.isArray(data.completed_chapters)
          ? data.completed_chapters as { book: string; chapter: number }[]
          : [],
      });
    } else {
      setGoal(null);
    }
    setLoading(false);
  }, [user, currentYear]);

  useEffect(() => {
    if (enabled) fetchGoal();
  }, [enabled, fetchGoal]);

  const createGoal = async () => {
    if (!user) return;
    const target = parseInt(targetInput) || TOTAL_BIBLE_CHAPTERS;
    const { error } = await supabase.from("reading_goals").insert({
      user_id: user.id,
      year: currentYear,
      target_chapters: Math.min(Math.max(target, 1), TOTAL_BIBLE_CHAPTERS),
      completed_chapters: [],
    });
    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe uma meta para este ano");
      } else {
        toast.error("Erro ao criar meta");
      }
    } else {
      toast.success("Meta criada! 📖");
      setShowCreate(false);
      fetchGoal();
    }
  };

  if (!enabled || !user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-5 h-5 text-orange-400" />
          <h3 className="font-bold">Meta de Leitura {currentYear}</h3>
        </div>
        {showCreate ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">
                Quantos capítulos quer ler este ano?
              </label>
              <Input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                min={1}
                max={TOTAL_BIBLE_CHAPTERS}
                className="bg-[hsl(var(--dark-bg))] border-none"
              />
              <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">
                A Bíblia tem {TOTAL_BIBLE_CHAPTERS} capítulos no total
              </p>
            </div>
            <div className="flex gap-2">
              {[365, 730, TOTAL_BIBLE_CHAPTERS].map(v => (
                <button
                  key={v}
                  onClick={() => setTargetInput(String(v))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    targetInput === String(v) ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"
                  }`}
                >
                  {v === TOTAL_BIBLE_CHAPTERS ? "Bíblia Toda" : `${v} cap.`}
                </button>
              ))}
            </div>
            <Button onClick={createGoal} className="w-full">
              <Target className="w-4 h-4 mr-1" /> Definir Meta
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-[hsl(var(--dark-muted))] mb-3">
              Defina sua meta de leitura para {currentYear}
            </p>
            <Button onClick={() => setShowCreate(true)} variant="outline"
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] hover:text-[hsl(var(--dark-text))]">
              <Plus className="w-4 h-4 mr-1" /> Criar Meta
            </Button>
          </div>
        )}
      </div>
    );
  }

  const completedCount = goal.completed_chapters.length;
  const progressPercent = Math.min(Math.round((completedCount / goal.target_chapters) * 100), 100);
  const daysInYear = 365;
  const dayOfYear = Math.ceil((Date.now() - new Date(currentYear, 0, 0).getTime()) / 86400000);
  const expectedProgress = Math.round((dayOfYear / daysInYear) * goal.target_chapters);
  const isAhead = completedCount >= expectedProgress;

  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-orange-400" />
          <h3 className="font-bold text-sm">Meta {currentYear}</h3>
        </div>
        {progressPercent >= 100 && <Trophy className="w-5 h-5 text-yellow-400" />}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-primary">{completedCount}</p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))]">de {goal.target_chapters} capítulos</p>
          </div>
          <p className="text-2xl font-bold">{progressPercent}%</p>
        </div>

        <Progress value={progressPercent} className="h-3" />

        <div className="flex items-center justify-between text-[10px]">
          <span className={isAhead ? "text-green-400" : "text-amber-400"}>
            {isAhead ? "✅ Você está adiantado!" : `⚠️ Esperado: ${expectedProgress} capítulos`}
          </span>
          <span className="text-[hsl(var(--dark-muted))]">
            Faltam {Math.max(goal.target_chapters - completedCount, 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReadingGoals;
