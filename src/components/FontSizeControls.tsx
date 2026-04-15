import { Minus, Plus, Type } from "lucide-react";

interface FontSizeControlsProps {
  fontSize: number;
  canIncrease: boolean;
  canDecrease: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}

const FontSizeControls = ({ fontSize, canIncrease, canDecrease, onIncrease, onDecrease }: FontSizeControlsProps) => {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDecrease}
        disabled={!canDecrease}
        className="w-8 h-8 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center disabled:opacity-30 transition-opacity"
        aria-label="Diminuir fonte"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-6 text-center text-[10px] font-medium text-[hsl(var(--dark-muted))]">
        <Type className="w-3.5 h-3.5 mx-auto" />
      </span>
      <button
        onClick={onIncrease}
        disabled={!canIncrease}
        className="w-8 h-8 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center disabled:opacity-30 transition-opacity"
        aria-label="Aumentar fonte"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default FontSizeControls;
