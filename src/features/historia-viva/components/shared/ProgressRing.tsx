interface Props {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string; // hsl triplet
  trackOpacity?: number;
  children?: React.ReactNode;
}

const ProgressRing = ({ value, size = 56, stroke = 5, color = "217 91% 60%", trackOpacity = 0.2, children }: Props) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const offset = c * (1 - pct);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`hsl(${color} / ${trackOpacity})`} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`hsl(${color})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-dark-text">
        {children ?? `${Math.round(pct * 100)}%`}
      </div>
    </div>
  );
};

export default ProgressRing;