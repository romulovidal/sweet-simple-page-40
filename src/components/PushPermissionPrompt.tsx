import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { registerPushNotifications, isPushEnabled } from "@/lib/pushNotifications";

const PushPermissionPrompt = () => {
  const [show, setShow] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

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
      if (Notification.permission === "granted") {
        const enabled = await isPushEnabled();
        if (!enabled) {
          await registerPushNotifications();
        }
        return;
      }

      if (Notification.permission === "denied") return;

      // Check if dismissed recently — only 6 hours cooldown to be more persistent
      const dismissedAt = localStorage.getItem("push-prompt-dismissed");
      if (dismissedAt) {
        const diff = Date.now() - Number(dismissedAt);
        if (diff < 6 * 60 * 60 * 1000) return; // 6 hours
      }

      setTimeout(() => {
        setShow(true);
        setShowOverlay(true);
      }, 1500);
    };

    check();
  }, []);

  const handleAllow = async () => {
    setShow(false);
    setShowOverlay(false);
    const ok = await registerPushNotifications();
    if (!ok) {
      localStorage.setItem("push-prompt-dismissed", String(Date.now()));
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setShowOverlay(false);
    localStorage.setItem("push-prompt-dismissed", String(Date.now()));
  };

  if (!show) return null;

  return (
    <>
      {/* Dark overlay blocking content */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black/70 z-[99] backdrop-blur-sm" />
      )}

      {/* Modal-style prompt */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-foreground text-center">
            Fique por dentro da congregação! 🙏
          </h2>

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
            Ative as notificações para receber o <strong>versículo do dia</strong>, 
            avisos da congregação e conteúdos exclusivos diretamente no seu celular.
          </p>

          {/* Benefits list */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="text-primary">📖</span>
              <span>Versículo do dia toda manhã</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="text-primary">📢</span>
              <span>Avisos e eventos da congregação</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="text-primary">🎯</span>
              <span>Lembrete para manter sua sequência</span>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleAllow}
            className="mt-5 w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
          >
            Ativar notificações
          </button>

          {/* Dismiss - small and subtle */}
          <button
            onClick={handleDismiss}
            className="mt-2 w-full text-xs text-muted-foreground/60 py-2 hover:text-muted-foreground transition-colors"
          >
            Talvez depois
          </button>
        </div>
      </div>
    </>
  );
};

export default PushPermissionPrompt;
