import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import type { EntityRef, Quiz } from "../../types";
import RefLink from "../shared/RefLink";

interface Props {
  quiz: Quiz;
  score: number;
  answers: number[];
  durationMs: number;
  onExit: () => void;
  onRetry: () => void;
  onOpenEntity: (ref: EntityRef) => void;
}

function medal(pct: number) {
  if (pct >= 90) return { icon: "🥇", label: "Ouro" };
  if (pct >= 70) return { icon: "🥈", label: "Prata" };
  if (pct >= 50) return { icon: "🥉", label: "Bronze" };
  return { icon: "📖", label: "Continue estudando" };
}

const QuizResult = ({ quiz, score, answers, durationMs, onExit, onRetry, onOpenEntity }: Props) => {
  const total = quiz.questions.length;
  const pct = Math.round((score / total) * 100);
  const m = medal(pct);
  const color = quiz.color ?? "217 91% 60%";
  const wrong = quiz.questions.map((q, i) => ({ q, i, chosen: answers[i] })).filter((x) => x.chosen !== x.q.correct);
  const seconds = Math.round(durationMs / 1000);

  return (
    <div className="min-h-full flex flex-col bg-background">
      <header className="px-4 pt-4 pb-6 text-center" style={{ background: `linear-gradient(180deg, hsl(${color} / 0.28), transparent)` }}>
        <div className="flex items-center mb-4">
          <button onClick={onExit} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center" aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="text-6xl mb-2">{m.icon}</div>
        <p className="text-[10px] font-black uppercase tracking-widest text-dark-muted">{m.label}</p>
        <h1 className="text-4xl font-black text-dark-text mt-1">{score}<span className="text-dark-muted text-2xl">/{total}</span></h1>
        <p className="text-xs text-dark-muted mt-1">{pct}% em {seconds}s</p>
      </header>

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <button onClick={onRetry} className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-dark-card active:bg-dark-card-hover text-dark-text">
            <RotateCcw className="w-4 h-4" /> Refazer
          </button>
          <button onClick={onExit} className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: `hsl(${color})`, color: "#fff" }}>
            <Sparkles className="w-4 h-4" /> Ver outros
          </button>
        </div>

        {wrong.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2 mt-3">Revisar erradas ({wrong.length})</h3>
            <div className="space-y-2">
              {wrong.map(({ q, chosen }) => (
                <div key={q.id} className="rounded-xl p-3 bg-dark-card space-y-2 border border-red-500/20">
                  <p className="text-[13px] font-semibold text-dark-text">{q.prompt}</p>
                  <p className="text-[11px] text-red-400">Sua resposta: {q.choices[chosen] ?? "—"}</p>
                  <p className="text-[11px] text-emerald-400">Correta: {q.choices[q.correct]}</p>
                  <p className="text-[11px] text-dark-muted">{q.explanation}</p>
                  {q.ref && <RefLink reference={q.ref} color={color} />}
                  {q.entityRef && (
                    <button onClick={() => onOpenEntity(q.entityRef!)} className="text-[11px] font-bold text-primary underline underline-offset-2">
                      Explorar →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizResult;