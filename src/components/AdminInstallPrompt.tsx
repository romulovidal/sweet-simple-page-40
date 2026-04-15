import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const AdminInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    if ((navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Check dismissal
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
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
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
    localStorage.setItem("admin-install-dismissed", String(Date.now()));
  };

  if (isInstalled || dismissed) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white">Instalar Admin Atalaia</p>
          {isIOS ? (
            <p className="text-xs text-slate-400 mt-1">
              Toque em <span className="font-semibold text-slate-300">Compartilhar</span> (ícone ↑) e depois em{" "}
              <span className="font-semibold text-slate-300">Adicionar à Tela de Início</span>
            </p>
          ) : deferredPrompt ? (
            <>
              <p className="text-xs text-slate-400 mt-1">
                Instale o painel admin como app para acesso rápido.
              </p>
              <button
                onClick={handleInstall}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors active:opacity-90 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar agora
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              Para instalar, acesse{" "}
              <span className="font-semibold text-slate-300">o site publicado</span> no navegador do celular,
              toque no menu (⋮) e selecione{" "}
              <span className="font-semibold text-slate-300">Instalar aplicativo</span> ou{" "}
              <span className="font-semibold text-slate-300">Adicionar à tela inicial</span>.
            </p>
          )}
        </div>
        <button onClick={handleDismiss} className="text-slate-500 hover:text-slate-300 p-1 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AdminInstallPrompt;
