import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { registerPushNotifications, isPushEnabled } from "@/lib/pushNotifications";

type PromptPhase = "hidden" | "modal" | "waiting-system" | "done";

const PushPermissionPrompt = () => {
  const [phase, setPhase] = useState<PromptPhase>("hidden");

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

      const dismissedAt = localStorage.getItem("push-prompt-dismissed");
      if (dismissedAt) {
        const diff = Date.now() - Number(dismissedAt);
        if (diff < 6 * 60 * 60 * 1000) return;
      }

      setTimeout(() => setPhase("modal"), 1500);
    };

    check();
  }, []);

  const handleAllow = async () => {
    // Step 1: Dismiss the modal and show helper text
    setPhase("waiting-system");

    // Step 2: Wait a moment for the UI to clear, then trigger the native OS dialog
    await new Promise((r) => setTimeout(r, 400));

    const ok = await registerPushNotifications();
    if (ok) {
      setPhase("done");
    } else {
      localStorage.setItem("push-prompt-dismissed", String(Date.now()));
      setPhase("hidden");
    }
  };

  const handleDismiss = () => {
    setPhase("hidden");
    localStorage.setItem("push-prompt-dismissed", String(Date.now()));
  };

  if (phase === "hidden" || phase === "done") return null;

  // Phase: waiting for the system dialog
  if (phase === "waiting-system") {
    return (
      <>
        <div className="fixed inset-0 bg-black/70 z-[99] backdrop-blur-sm" />
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center animate-pulse">
                <Bell className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground text-center">
              Permita as notificações ☝️
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
              Toque em <strong>"Permitir"</strong> na mensagem que apareceu no topo da tela 
              para receber notificações no seu celular.
            </p>
            <div className="mt-4 flex justify-center">
              <div className="flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-4 py-2 rounded-full">
                <span className="animate-bounce">↑</span>
                Olhe no topo da tela
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Phase: main modal
  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[99] backdrop-blur-sm" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-foreground text-center">
            Fique por dentro da congregação! 🙏
          </h2>

          <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
            Ative as notificações para receber o <strong>versículo do dia</strong>, 
            avisos da congregação e conteúdos exclusivos diretamente no seu celular.
          </p>

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

          <button
            onClick={handleAllow}
            className="mt-5 w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
          >
            Ativar notificações
          </button>

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
