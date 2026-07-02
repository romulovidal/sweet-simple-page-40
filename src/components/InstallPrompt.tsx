import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  });

  useEffect(() => {
    const checkStatus = async () => {
      const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      setIsInstalled(installed);
      if (installed) return;

      // Check if user previously dismissed
      const dismissedAt = localStorage.getItem("install-prompt-dismissed");
      if (dismissedAt) {
        const diff = Date.now() - Number(dismissedAt);
        // Show again after 3 days
        if (diff < 3 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
          return;
        }
      }

      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener("beforeinstallprompt", handler);
      window.addEventListener("appinstalled", () => setIsInstalled(true));

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
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("install-prompt-dismissed", String(Date.now()));
  };

  // Don't show if installed, dismissed, or no prompt available
  // On iOS, show manual instructions since beforeinstallprompt isn't supported
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Show if not installed, not dismissed
  // On Android/Chrome we wait for deferredPrompt, on iOS we show instructions
  const showIOSHint = isIOS && !isInstalled && !dismissed;
  const showAndroidPrompt = !isIOS && !isInstalled && !dismissed; // Keep it true to show something even if deferredPrompt hasn't fired yet

  if (!showAndroidPrompt && !showIOSHint) return null;

  return (
    <div className="fixed bottom-20 left-2 right-2 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs lg:left-6 lg:right-auto lg:bottom-6">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instalar Bíblia do Atalaia</p>
          {showIOSHint ? (
            <p className="text-xs text-muted-foreground mt-1">
              Toque em <span className="font-semibold">Compartilhar</span> (ícone ↑) e depois em{" "}
              <span className="font-semibold">Adicionar à Tela de Início</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Acesse offline, receba notificações e tenha acesso rápido na tela inicial.
            </p>
          )}
          {!isIOS && !isInstalled && (
             <button
               onClick={handleInstall}
               disabled={!deferredPrompt}
               className="mt-2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg active:opacity-90 disabled:opacity-50"
             >
               {deferredPrompt ? "Instalar agora" : "Aguardando navegador..."}
             </button>
          )}
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
