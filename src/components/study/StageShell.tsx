import { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  accentColor?: string; // hsl triplet
  headerIcon?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}

/**
 * Fullscreen bottom-sheet shell used across the Study Hub modules.
 * Provides a consistent header with optional back button, icon, and accent.
 */
const StageShell = ({
  open,
  onOpenChange,
  title,
  subtitle,
  onBack,
  accentColor,
  headerIcon,
  headerRight,
  children,
}: Props) => {
  const accent = accentColor || "220 90% 60%";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[96vh] rounded-t-[2rem] p-0 flex flex-col border-0 [&>button.absolute]:hidden"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--dark-bg)) 0%, hsl(var(--dark-card) / 0.5) 100%)",
        }}
      >
        <SheetHeader
          className="relative px-5 pt-5 pb-4 flex-shrink-0 border-b border-[hsl(var(--dark-card-hover))]"
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[hsl(var(--dark-muted)/0.3)]" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 0%, hsl(${accent} / 0.35) 0%, transparent 70%)`,
            }}
          />
          <div className="relative flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 min-w-0">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-xl bg-[hsl(var(--dark-card))] flex-shrink-0"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
                </button>
              )}
              {headerIcon && (
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${accent}) 0%, hsl(${accent} / 0.55) 100%)`,
                  }}
                >
                  {headerIcon}
                </div>
              )}
              <div className="text-left min-w-0">
                <SheetTitle className="text-base font-bold text-[hsl(var(--dark-text))] truncate">
                  {title}
                </SheetTitle>
                {subtitle && (
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] font-medium uppercase tracking-widest truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerRight}
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-xl bg-[hsl(var(--dark-card))]"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
              </button>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  );
};

export default StageShell;