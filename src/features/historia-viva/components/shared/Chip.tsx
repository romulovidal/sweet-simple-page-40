import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string; // hsl triplet
  active?: boolean;
  icon?: React.ReactNode;
}

/** Extrai lightness de "H S% L%" para escolher texto branco ou preto no estado active */
function textOn(color: string) {
  const m = color.match(/(\d+(?:\.\d+)?)%\s*$/);
  const l = m ? parseFloat(m[1]) : 50;
  return l > 62 ? "hsl(220 40% 8%)" : "#fff";
}

const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ color = "217 91% 60%", active, icon, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all active:scale-95",
        className
      )}
      style={{
        color: active ? textOn(color) : "hsl(var(--dark-text))",
        background: active ? `hsl(${color})` : `hsl(${color} / 0.15)`,
        border: `1px solid hsl(${color} / ${active ? 1 : 0.4})`,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
);
Chip.displayName = "Chip";
export default Chip;
