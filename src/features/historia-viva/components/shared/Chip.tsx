import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string; // aceito por compat, ignorado — sempre usa --primary
  active?: boolean;
  icon?: React.ReactNode;
}

const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ color: _color, active, icon, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all active:scale-95 border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-dark-card text-dark-text border-dark-card-hover hover:border-primary/50",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
);
Chip.displayName = "Chip";
export default Chip;
