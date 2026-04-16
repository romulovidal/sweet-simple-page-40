import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { registerPushNotifications, isPushEnabled } from "@/lib/pushNotifications";

type PromptPhase = "hidden" | "modal" | "waiting-system" | "done";

function isPreviewEnv() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  );
}

const PushPermissionPrompt = () => {
  const [phase, setPhase] = useState<PromptPhase>("hidden");

  useEffect(() => {
    if (isPreviewEnv()) return;
    if (!("Notification" in window) || !("PushManager" in window)) return;

    const check = async () => {
      // If already granted, silently ensure subscription exists
      if (Notification.permission === "granted") {
        const enabled = await isPushEnabled();
        if (!enabled) {
          await registerPushNotifications();
        }
        return;
      }

      // If denied, nothing we can do
      if (Notification.permission === "denied") return;

      // Show modal immediately — no cooldown, every visit until they allow
      setTimeout(() => setPhase("modal"), 800);
    };

    check();
  }, []);

  const notifyClosed = () => {
    window.dispatchEvent(new CustomEvent("push-prompt:closed"));
  };

  const handleAllow = async () => {
    setPhase("waiting-system");
    const ok = await registerPushNotifications();
    if (ok) {
      setPhase("done");
    } else {
      // If they dismissed the browser prompt, hide but show again next visit
      setPhase("hidden");
    }
    notifyClosed();
  };

  const handleDismiss = () => {
    // Only hide for this session — will show again on next app open
    setPhase("hidden");
    notifyClosed();
  };

  if (phase === "hidden" || phase === "done") return null;

  if (phase === "waiting-system") {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 z-[99] backdrop-blur-sm" />
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

  // Main modal — more aggressive styling, tiny dismiss
  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-[99] backdrop-blur-sm" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-foreground text-center">
            🔔 Ative as notificações!
          </h2>

          <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
            Para receber o <strong>versículo do dia</strong> e avisos importantes
            da congregação, ative as notificações agora.
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
            className="mt-5 w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl text-base active:scale-[0.98] transition-transform"
          >
            Ativar notificações
          </button>

          <button
            onClick={handleDismiss}
            className="mt-2 w-full text-[10px] text-muted-foreground/40 py-1 hover:text-muted-foreground/60 transition-colors"
          >
            agora não
          </button>
        </div>
      </div>
    </>
  );
};

export default PushPermissionPrompt;
