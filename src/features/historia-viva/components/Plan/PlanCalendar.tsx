interface Props {
  total: number;
  done: Set<number>;
  current: number;
  onPick: (day: number) => void;
}

const PlanCalendar = ({ total, done, current, onPick }: Props) => {
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
            className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold transition-all border-2 ${
              isDone
                ? "bg-primary text-primary-foreground border-primary"
                : isCurrent
                ? "bg-dark-card text-dark-text border-primary"
                : "bg-dark-card text-dark-text border-transparent opacity-85"
            }`}
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