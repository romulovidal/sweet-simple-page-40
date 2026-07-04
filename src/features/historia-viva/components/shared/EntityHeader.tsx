import { ArrowLeft, Heart, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  subtitle?: string;
  color?: string; // hsl triplet
  icon?: string;
  onBack?: () => void;
  onClose?: () => void;
  onShare?: () => void;
  onToggleFav?: () => void;
  isFav?: boolean;
}

const EntityHeader = ({ title, subtitle, color = "var(--primary)", icon, onBack, onClose, onShare, onToggleFav, isFav }: Props) => (
  <div
    className="sticky top-0 z-10 px-4 py-3 backdrop-blur-lg"
    style={{
      background: `linear-gradient(180deg, hsl(${color} / 0.18) 0%, hsl(var(--background) / 0.95) 100%)`,
      borderBottom: `1px solid hsl(${color} / 0.25)`,
    }}
  >
    <div className="flex items-center gap-2">
      {onBack && (
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Voltar" className="h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {icon && (
          <span
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, hsl(${color}) 0%, hsl(${color} / 0.6) 100%)` }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-dark-muted truncate">{subtitle}</p>}
        </div>
      </div>
      {onToggleFav && (
        <Button size="icon" variant="ghost" onClick={onToggleFav} aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"} className="h-9 w-9">
          <Heart className={`w-5 h-5 ${isFav ? "fill-current" : ""}`} style={{ color: isFav ? `hsl(${color})` : undefined }} />
        </Button>
      )}
      {onShare && (
        <Button size="icon" variant="ghost" onClick={onShare} aria-label="Compartilhar" className="h-9 w-9">
          <Share2 className="w-5 h-5" />
        </Button>
      )}
      {onClose && (
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar" className="h-9 w-9">
          <X className="w-5 h-5" />
        </Button>
      )}
    </div>
  </div>
);

export default EntityHeader;
