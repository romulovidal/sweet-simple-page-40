import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

interface CronometroProps {
  /** Prazo final (ISO) vindo do servidor. */
  prazoEm: string;
  /** Chamado uma única vez quando o tempo zera. */
  onExpire: () => void;
}

function formatarRestante(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/** Cronômetro regressivo visível da tentativa (exercício/prova). */
const Cronometro = ({ prazoEm, onExpire }: CronometroProps) => {
  const [restante, setRestante] = useState(() => new Date(prazoEm).getTime() - Date.now());
  const expirouRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const ms = new Date(prazoEm).getTime() - Date.now();
      setRestante(ms);
      if (ms <= 0 && !expirouRef.current) {
        expirouRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [prazoEm]);

  const critico = restante <= 60_000;
  const atencao = restante <= 5 * 60_000;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
        critico
          ? "bg-destructive/15 text-destructive"
          : atencao
            ? "bg-amber-500/15 text-amber-500"
            : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-text))]"
      }`}
      aria-live="off"
    >
      <Timer className="w-4 h-4" />
      {formatarRestante(restante)}
    </div>
  );
};

export default Cronometro;
