import { useEffect, useState } from "react";
import { Church, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface CultoSchedule {
  id: string;
  name: string;
  day_of_week: number;
  time: string;
  is_active: boolean;
}

const formatTime = (time: string) => {
  // time vem como "HH:MM:SS"
  return time?.slice(0, 5) ?? "";
};

const CultoScheduleList = () => {
  const [schedules, setSchedules] = useState<CultoSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("culto_schedules")
        .select("id,name,day_of_week,time,is_active")
        .eq("is_active", true)
        .order("day_of_week")
        .order("time");
      if (!active) return;
      setSchedules((data as CultoSchedule[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;
  if (schedules.length === 0) return null;

  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Church className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Horários de Culto</h3>
      </div>
      <div className="space-y-1.5">
        {schedules.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-[hsl(var(--dark-bg))]"
          >
            <div className="min-w-0">
              <p className="font-semibold truncate">{s.name}</p>
              <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                {DAYS_PT[s.day_of_week] ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-1 text-primary font-semibold tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(s.time)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CultoScheduleList;
