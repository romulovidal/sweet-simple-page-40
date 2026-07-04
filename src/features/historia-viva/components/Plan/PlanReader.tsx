import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Calendar } from "lucide-react";
import { getPlan } from "../../data/plans";
import { useSession, usePlanProgress } from "../../hooks/useCloudSync";
import RefLink from "../shared/RefLink";
import Chip from "../shared/Chip";
import type { EntityRef } from "../../types";
import PlanCalendar from "./PlanCalendar";

interface Props {
  planId: string;
  onBack: () => void;
  onOpenEntity: (ref: EntityRef) => void;
}

const PlanReader = ({ planId, onBack, onOpenEntity }: Props) => {
  const plan = getPlan(planId);
  const userId = useSession();
  const { done, setCompleted } = usePlanProgress(userId, planId);
  const [dayIdx, setDayIdx] = useState(1);
  const [showCal, setShowCal] = useState(false);

  const day = plan?.days.find((d) => d.index === dayIdx);
  const total = plan?.days.length ?? 0;

  useEffect(() => {
    if (!plan) return;
    const next = plan.days.find((d) => !done.has(d.index));
    if (next) setDayIdx(next.index);
  }, [plan, done.size]); // eslint-disable-line

  const donePct = useMemo(() => (total ? done.size / total : 0), [done, total]);

  if (!plan || !day) return null;

  const isDone = done.has(dayIdx);

  return (
    <div className="min-h-full flex flex-col bg-dark-bg text-dark-text">
      <header className="px-4 pt-4 pb-3 border-b border-dark-card">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center" aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{plan.icon} {plan.title}</p>
            <p className="text-[11px] text-dark-muted">Dia {dayIdx} de {total} · {Math.round(donePct * 100)}% concluído</p>
          </div>
          <button onClick={() => setShowCal((v) => !v)} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center" aria-label="Calendário">
            <Calendar className="w-4 h-4" />
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-dark-card overflow-hidden">
          <div className="h-full transition-all bg-primary" style={{ width: `${donePct * 100}%` }} />
        </div>
      </header>

      {showCal && (
        <div className="px-4 py-3 border-b border-dark-card">
          <PlanCalendar
            total={total}
            done={done}
            current={dayIdx}
            onPick={(d) => { setDayIdx(d); setShowCal(false); }}
          />
        </div>
      )}

      <div className="flex-1 px-4 py-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-dark-text leading-snug">{day.title}</h2>
          <p className="text-[13px] text-dark-muted mt-1 leading-relaxed">{day.summary}</p>
        </div>

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Leituras</h3>
          <div className="space-y-1.5">
            {day.readings.map((r) => <RefLink key={r} reference={r} />)}
          </div>
        </div>

        {day.entities && day.entities.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Explore</h3>
            <div className="flex flex-wrap gap-1.5">
              {day.entities.map((e, i) => (
                <Chip key={`${e.kind}-${e.id}-${i}`} onClick={() => onOpenEntity(e)}>
                  {e.kind === "character" ? "👤" : e.kind === "place" ? "📍" : e.kind === "event" ? "✨" : "📖"} {e.id}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-dark-card sticky bottom-0 bg-dark-bg flex items-center gap-2">
        <button
          onClick={() => setDayIdx((d) => Math.max(1, d - 1))}
          disabled={dayIdx <= 1}
          className="w-11 h-11 rounded-xl bg-dark-card flex items-center justify-center disabled:opacity-40"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCompleted(dayIdx, !isDone)}
          className={`flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
            isDone
              ? "bg-dark-card text-dark-text border border-dark-card-hover"
              : "bg-primary text-primary-foreground"
          }`}
        >
          <Check className="w-4 h-4" /> {isDone ? "Concluído" : "Marcar como lido"}
        </button>
        <button
          onClick={() => setDayIdx((d) => Math.min(total, d + 1))}
          disabled={dayIdx >= total}
          className="w-11 h-11 rounded-xl bg-dark-card flex items-center justify-center disabled:opacity-40"
          aria-label="Próximo dia"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PlanReader;