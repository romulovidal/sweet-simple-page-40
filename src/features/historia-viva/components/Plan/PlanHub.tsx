import { useEffect, useState } from "react";
import { PLANS } from "../../data/plans";
import { useSession, fetchAllPlanProgress } from "../../hooks/useCloudSync";
import ProgressRing from "../shared/ProgressRing";
import { Play } from "lucide-react";

interface Props { onOpen: (planId: string) => void }

const PlanHub = ({ onOpen }: Props) => {
  const userId = useSession();
  const [progress, setProgress] = useState<Record<string, Set<number>>>({});

  useEffect(() => {
    if (!userId) { setProgress({}); return; }
    fetchAllPlanProgress(userId).then((rows) => {
      const m: Record<string, Set<number>> = {};
      rows.forEach((r: any) => {
        if (!m[r.plan_id]) m[r.plan_id] = new Set();
        m[r.plan_id].add(r.day_index);
      });
      setProgress(m);
    });
  }, [userId]);

  return (
    <div className="p-4 space-y-3">
      {!userId && (
        <div className="rounded-xl bg-dark-card p-3 text-[12px] text-dark-muted border border-primary/20">
          Entre com sua conta para salvar seu progresso na nuvem.
        </div>
      )}
      {PLANS.map((p) => {
        const done = progress[p.id]?.size ?? 0;
        const pct = done / p.days.length;
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors bg-dark-card active:bg-dark-card-hover border border-dark-card-hover"
          >
            <ProgressRing value={pct} size={54}>
              <span className="text-lg">{p.icon}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-dark-text truncate">{p.title}</p>
              <p className="text-[11px] text-dark-muted line-clamp-2">{p.description}</p>
              <p className="text-[10px] font-bold mt-1 text-primary">
                {done}/{p.days.length} dias · {Math.round(pct * 100)}%
              </p>
            </div>
            <Play className="w-5 h-5 text-dark-muted flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export default PlanHub;