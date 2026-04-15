import { Check, X } from "lucide-react";
import { BIBLE_VERSIONS } from "@/services/bibleApi";

interface BibleVersionPickerProps {
  open: boolean;
  selectedVersionId: string;
  onClose: () => void;
  onSelect: (versionId: string) => void;
}

const BibleVersionPicker = ({
  open,
  selectedVersionId,
  onClose,
  onSelect,
}: BibleVersionPickerProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Versão da Bíblia"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/5 bg-dark-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-dark-card/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="text-base font-bold">Versão da Bíblia</h3>
            <p className="text-xs text-dark-muted">Escolha a tradução para leitura</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-dark-muted transition-colors hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(68vh,28rem)] overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="space-y-1">
            {BIBLE_VERSIONS.map((version) => {
              const isSelected = selectedVersionId === version.id;

              return (
                <button
                  key={version.id}
                  onClick={() => onSelect(version.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/20 ring-1 ring-primary/40"
                      : "hover:bg-dark-card-hover active:bg-dark-card-hover"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{version.shortName}</p>
                      <p className="truncate text-xs text-dark-muted">{version.name}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleVersionPicker;
