import { Check, X, Download } from "lucide-react";
import { BIBLE_VERSIONS } from "@/services/bibleApi";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      setIsInstalled(installed);
      if (installed) return;

      const handler = (e: Event) => {
        console.log("Install prompt event captured");
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener("beforeinstallprompt", handler);
      window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => window.removeEventListener("beforeinstallprompt", handler);
    };

    checkStatus();
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback or manual instruction check
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert("Para instalar: toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início'.");
      }
    }
  };

  if (!open) return null;

  // ALWAYS show the prompt for debugging/visibility if not in standalone mode
  // Using a more robust check for standalone mode
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                      (navigator as any).standalone === true ||
                      document.referrer.includes('android-app://');
  
  const showInstallPrompt = !isStandalone;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Versão da Bíblia"
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/5 bg-dark-card shadow-2xl sm:max-h-[min(80vh,32rem)]"
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

        {showInstallPrompt && (
          <div className="px-5 py-4 bg-primary/10 border-b border-primary/20 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Instale o app para a melhor utilização</p>
                <p className="text-xs text-dark-muted mt-0.5">
                  Acesso rápido, offline e melhor performance.
                </p>
              </div>
            </div>
            <Button onClick={handleInstall} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-10">
              Instalar App
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
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
