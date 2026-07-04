import { textOn } from "../../lib/contrast";

interface Props {
  total: number;
  done: Set<number>;
  current: number;
  color: string;
  onPick: (day: number) => void;
}

const PlanCalendar = ({ total, done, current, color, onPick }: Props) => {
  const days = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const isDone = done.has(d);
        const isCurrent = d === current;
        return (
          <button
            key={d}
            onClick={() => onPick(d)}
            className="aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold transition-all"
            style={{
              background: isDone ? `hsl(${color})` : "hsl(var(--dark-card))",
              color: isDone ? textOn(color) : "hsl(var(--dark-text))",
              border: isCurrent ? `2px solid hsl(${color})` : "2px solid transparent",
              opacity: isDone || isCurrent ? 1 : 0.85,
            }}
            aria-label={`Dia ${d}${isDone ? " concluído" : ""}`}
          >
            {isDone ? "✓" : d}
          </button>
        );
      })}
    </div>
  );
};

export default PlanCalendar;