import { useEffect, useState } from "react";
import { RefreshCw, X, Sparkles } from "lucide-react";

const UpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Check for waiting service worker on load
    navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
            setDismissed(false);
          }
        });
      });
    });

    // Periodically check for updates (every 30 min)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
        reg?.update().catch(() => {});
      });
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    setUpdating(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    // controllerchange in registerServiceWorker triggers reload automatically.
    // Fallback reload in case the swap takes too long.
    setTimeout(() => window.location.reload(), 1500);
  };

  if (!showUpdate || dismissed) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-1.5rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 p-3 pl-4 rounded-2xl bg-[hsl(var(--dark-card))] border border-primary/30 shadow-2xl backdrop-blur">
        <span className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--dark-text))] leading-tight">Nova versão disponível</p>
          <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">Atualize sem reinstalar o app</p>
        </div>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition disabled:opacity-70"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${updating ? "animate-spin" : ""}`} />
          {updating ? "Atualizando..." : "Atualizar"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-[hsl(var(--dark-muted))] hover:bg-white/5 flex-shrink-0"
          aria-label="Dispensar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
