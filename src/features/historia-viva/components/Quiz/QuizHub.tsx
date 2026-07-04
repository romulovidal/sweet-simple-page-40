import { useMemo } from "react";
import { QUIZZES } from "../../data/quizzes";
import { useSession, useQuizAttempts } from "../../hooks/useCloudSync";
import { Trophy, Play } from "lucide-react";

interface Props {
  onStart: (quizId: string) => void;
}

const DIFF_LABEL: Record<string, string> = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };

const QuizHub = ({ onStart }: Props) => {
  const userId = useSession();
  const { attempts } = useQuizAttempts(userId);

  const stats = useMemo(() => {
    const m: Record<string, { best: number; runs: number }> = {};
    attempts.forEach((a) => {
      const key = a.quiz_id;
      const pct = Math.round((a.score / Math.max(1, a.total)) * 100);
      if (!m[key]) m[key] = { best: pct, runs: 1 };
      else { m[key].best = Math.max(m[key].best, pct); m[key].runs += 1; }
    });
    return m;
  }, [attempts]);

  return (
    <div className="p-4 space-y-3">
      {!userId && (
        <div className="rounded-xl bg-dark-card p-3 text-[12px] text-dark-muted border border-primary/20">
          Entre com sua conta para salvar suas pontuações na nuvem.
        </div>
      )}
      {QUIZZES.map((q) => {
        const s = stats[q.id];
        return (
          <button
            key={q.id}
            onClick={() => onStart(q.id)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors bg-dark-card active:bg-dark-card-hover border border-dark-card-hover"
          >
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-dark-card-hover">
              {q.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-dark-text truncate">{q.title}</p>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {DIFF_LABEL[q.difficulty]}
                </span>
              </div>
              <p className="text-[11px] text-dark-muted line-clamp-1">{q.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-dark-muted">{q.questions.length} perguntas</span>
                {s && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <Trophy className="w-3 h-3" /> {s.best}% · {s.runs}x
                  </span>
                )}
              </div>
            </div>
            <Play className="w-5 h-5 text-dark-muted flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export default QuizHub;