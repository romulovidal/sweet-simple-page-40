import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const UpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        setShowUpdate(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSWMessage);

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
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    // Small delay to let the new SW activate
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-300">
      <button
        onClick={handleUpdate}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity text-sm font-medium"
      >
        <RefreshCw className="w-4 h-4" />
        Nova versão disponível — Atualizar
      </button>
    </div>
  );
};

export default UpdatePrompt;
