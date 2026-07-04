import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, X as XIcon, ChevronRight } from "lucide-react";
import { getQuiz } from "../../data/quizzes";
import RefLink from "../shared/RefLink";
import { useSession, saveQuizAttempt } from "../../hooks/useCloudSync";
import type { EntityRef } from "../../types";
import QuizResult from "./QuizResult";

interface Props {
  quizId: string;
  onExit: () => void;
  onOpenEntity: (ref: EntityRef) => void;
}

const QuizPlayer = ({ quizId, onExit, onOpenEntity }: Props) => {
  const quiz = getQuiz(quizId);
  const userId = useSession();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);

  const color = quiz?.color ?? "217 91% 60%";
  const q = quiz?.questions[i];

  const score = useMemo(
    () => answers.reduce((s, a, idx) => s + (a === quiz!.questions[idx].correct ? 1 : 0), 0),
    [answers, quiz]
  );

  useEffect(() => {
    if (!finished || saved || !userId || !quiz) return;
    saveQuizAttempt(userId, {
      quiz_id: quiz.id,
      score,
      total: quiz.questions.length,
      duration_ms: Date.now() - startedAt,
      answers,
    }).finally(() => setSaved(true));
  }, [finished, userId, quiz, score, answers, startedAt, saved]);

  if (!quiz) return null;

  if (finished) {
    return (
      <QuizResult
        quiz={quiz}
        score={score}
        answers={answers}
        durationMs={Date.now() - startedAt}
        onExit={onExit}
        onRetry={() => { setI(0); setAnswers([]); setSelected(null); setFinished(false); setSaved(false); }}
        onOpenEntity={onOpenEntity}
      />
    );
  }

  const pick = (choice: number) => {
    if (selected !== null) return;
    setSelected(choice);
  };

  const next = () => {
    if (selected === null) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);
    setSelected(null);
    if (i + 1 >= quiz.questions.length) setFinished(true);
    else setI(i + 1);
  };

  const progress = ((i + (selected !== null ? 1 : 0)) / quiz.questions.length) * 100;

  return (
    <div className="min-h-full flex flex-col bg-background">
      <header className="px-4 pt-4 pb-3" style={{ background: `linear-gradient(180deg, hsl(${color} / 0.22), transparent)` }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onExit} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center" aria-label="Sair">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: `hsl(${color})` }}>{quiz.icon} {quiz.title}</p>
            <p className="text-[11px] text-dark-muted">Pergunta {i + 1} de {quiz.questions.length}</p>
          </div>
          <span className="text-xs font-bold text-dark-text">{score}/{quiz.questions.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-dark-card overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${progress}%`, background: `hsl(${color})` }} />
        </div>
      </header>

      <div className="flex-1 px-4 py-5 space-y-4">
        <h2 className="text-lg font-bold text-dark-text leading-snug">{q!.prompt}</h2>
        <div className="space-y-2">
          {q!.choices.map((c, idx) => {
            const isSel = selected === idx;
            const isCorrect = idx === q!.correct;
            const revealed = selected !== null;
            let cls = "bg-dark-card border-transparent";
            let icon: React.ReactNode = <span className="text-[11px] font-bold text-dark-muted">{String.fromCharCode(65 + idx)}</span>;
            if (revealed) {
              if (isCorrect) { cls = "border-emerald-500/60"; icon = <Check className="w-4 h-4 text-emerald-400" />; }
              else if (isSel) { cls = "border-red-500/60"; icon = <XIcon className="w-4 h-4 text-red-400" />; }
              else cls = "bg-dark-card opacity-60 border-transparent";
            } else if (isSel) {
              cls = "border-primary/60";
            }
            return (
              <button
                key={idx}
                onClick={() => pick(idx)}
                disabled={revealed}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors text-dark-text ${cls}`}
                style={revealed && isCorrect ? { background: "hsl(142 76% 40% / 0.15)" } : revealed && isSel ? { background: "hsl(0 84% 60% / 0.15)" } : undefined}
              >
                <span className="w-7 h-7 rounded-lg bg-dark-card-hover flex items-center justify-center flex-shrink-0">{icon}</span>
                <span className="text-sm font-medium">{c}</span>
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="rounded-xl p-3 bg-dark-card border border-primary/20 space-y-2" aria-live="polite">
            <p className="text-xs font-bold" style={{ color: selected === q!.correct ? "hsl(142 76% 50%)" : "hsl(0 84% 65%)" }}>
              {selected === q!.correct ? "Correto!" : "Não foi dessa vez."}
            </p>
            <p className="text-[13px] text-dark-text leading-relaxed">{q!.explanation}</p>
            {q!.ref && <RefLink reference={q!.ref} color={color} />}
            {q!.entityRef && (
              <button
                onClick={() => onOpenEntity(q!.entityRef!)}
                className="text-[11px] font-bold text-primary underline underline-offset-2"
              >Explorar entidade relacionada →</button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-dark-card sticky bottom-0 bg-background">
        <button
          onClick={next}
          disabled={selected === null}
          className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: `hsl(${color})`, color: textOn(color) }}
        >
          {i + 1 >= quiz.questions.length ? "Finalizar" : "Próxima"} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default QuizPlayer;