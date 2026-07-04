import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string; // hsl triplet
  active?: boolean;
  icon?: React.ReactNode;
}

const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ color = "var(--primary)", active, icon, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all active:scale-95",
        className
      )}
      style={{
        color: active ? "#fff" : `hsl(${color})`,
        background: active ? `hsl(${color})` : `hsl(${color} / 0.15)`,
        border: `1px solid hsl(${color} / ${active ? 1 : 0.35})`,
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
