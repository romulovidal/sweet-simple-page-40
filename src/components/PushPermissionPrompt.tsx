import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { registerPushNotifications, isPushEnabled } from "@/lib/pushNotifications";

const PushPermissionPrompt = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show in iframe/preview
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }
    if (
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com")
    ) {
      return;
    }

    if (!("Notification" in window) || !("PushManager" in window)) return;

    const check = async () => {
      // Already granted
      if (Notification.permission === "granted") {
        const enabled = await isPushEnabled();
        if (!enabled) {
          // Has permission but not subscribed — register silently
          await registerPushNotifications();
        }
        return;
      }

      // Already denied — don't bother
      if (Notification.permission === "denied") return;

      // Check if dismissed recently
      const dismissedAt = localStorage.getItem("push-prompt-dismissed");
      if (dismissedAt) {
        const diff = Date.now() - Number(dismissedAt);
        if (diff < 3 * 24 * 60 * 60 * 1000) return; // 3 days
      }

      // Show after a short delay so it's not jarring
      setTimeout(() => setShow(true), 3000);
    };

    check();
  }, []);

  const handleAllow = async () => {
    setShow(false);
    const ok = await registerPushNotifications();
    if (!ok) {
      // Permission was denied or failed
      localStorage.setItem("push-prompt-dismissed", String(Date.now()));
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("push-prompt-dismissed", String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 left-2 right-2 max-w-lg mx-auto z-50 animate-in slide-in-from-top-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            Receber versículo do dia? 🙏
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ative as notificações para receber o versículo diário e nunca perder sua leitura.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAllow}
              className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg active:opacity-90"
            >
              Ativar notificações
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-muted-foreground px-3 py-2"
            >
              Agora não
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PushPermissionPrompt;
