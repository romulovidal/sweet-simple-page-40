import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const AdminInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if we're already running in standalone (either user or admin app)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem("admin-install-dismissed");
    if (dismissedAt) {
      const diff = Date.now() - Number(dismissedAt);
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("admin-install-dismissed", String(Date.now()));
  };

  if (dismissed) return null;

  // If running inside standalone (user app already installed), 
  // the browser won't fire beforeinstallprompt for the same origin.
  // Show manual instructions instead.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // If we're in standalone mode, the admin is already accessible 
  // via the installed app — no need to show anything
  if (isStandalone) return null;

  // Native install available
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-lg flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Instalar Admin Atalaia</p>
            <p className="text-xs text-muted-foreground mt-1">
              Instale o painel admin como app separado na tela inicial.
            </p>
            <button
              onClick={handleInstall}
              className="mt-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg active:opacity-90"
            >
              Instalar agora
            </button>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // No native prompt (user app may be installed already or iOS)
  // Show manual instructions
  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">Instalar Admin Atalaia</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-1">
              Toque em <span className="font-semibold">Compartilhar</span> (ícone ↑) e depois em{" "}
              <span className="font-semibold">Adicionar à Tela de Início</span> para instalar o painel admin.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Abra o menu do navegador (⋮) e toque em{" "}
              <span className="font-semibold">Instalar app</span> ou{" "}
              <span className="font-semibold">Adicionar à tela inicial</span>.
            </p>
          )}
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AdminInstallPrompt;
