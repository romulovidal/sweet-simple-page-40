import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { registerPushNotifications, isPushEnabled } from "@/lib/pushNotifications";

type PromptPhase = "hidden" | "modal" | "waiting-system" | "done";

const DISMISS_KEY = "push-prompt:dismissed-forever";
const SNOOZE_KEY = "push-prompt:dismissed-at";
const SNOOZE_DAYS = 7;

function isPreviewEnv() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return (
    window.location.hostname.includes("id-preview--")
  );
}

const PushPermissionPrompt = () => {
  const [phase, setPhase] = useState<PromptPhase>("hidden");
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    if (isPreviewEnv()) return;
    if (!("Notification" in window) || !("PushManager" in window)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

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

      const checkAndShow = async () => {
        // If Onboarding hasn't been completed yet, don't show the separate prompt.
        const onboardingCompleted = localStorage.getItem("show-onboarding-v1") === "false";
        if (!onboardingCompleted) return;

        // Respect a permanent dismissal
        if (localStorage.getItem(DISMISS_KEY) === "true") return;

        // Respect a recent "Agora não" (snooze for 7 days)
        const dismissedAt = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        if (dismissedAt && Date.now() - dismissedAt < SNOOZE_DAYS * 24 * 60 * 60 * 1000) return;

        // Check if browser already has permission (no need to show modal)
        if (Notification.permission === "granted" || Notification.permission === "denied") return;

        // Double check with service worker if push is enabled
        const enabled = await isPushEnabled();
        if (enabled) return;

        // Show modal after a delay if not in onboarding and push is truly missing
        timer = setTimeout(() => {
          if (!cancelled) setPhase("modal");
        }, 3000);
      };

      checkAndShow();
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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
      // If they dismissed the browser prompt, snooze instead of nagging again
      try {
        localStorage.setItem(SNOOZE_KEY, String(Date.now()));
      } catch {}
      setPhase("hidden");
    }
    notifyClosed();
  };

  const handleDismiss = () => {
    // If user opted out permanently, persist that choice
    if (dontAskAgain) {
      try {
        localStorage.setItem(DISMISS_KEY, "true");
      } catch {}
    }
    // "Agora não" silencia por 7 dias (não volta a cada visita)
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {}
    setPhase("hidden");
    notifyClosed();
  };

  if (phase === "hidden" || phase === "done") return null;

  if (phase === "waiting-system") {
    return (
      <>
        <div data-push-prompt="true" className="fixed inset-0 bg-black/80 z-[99] backdrop-blur-sm" />
        <div data-push-prompt="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
      <div data-push-prompt="true" className="fixed inset-0 bg-black/80 z-[99] backdrop-blur-sm" />
      <div data-push-prompt="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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

          <label className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
            />
            Não perguntar novamente
          </label>

          <button
            onClick={handleDismiss}
            className="mt-2 w-full text-xs text-muted-foreground/60 py-1.5 hover:text-muted-foreground transition-colors"
          >
            {dontAskAgain ? "Fechar" : "Agora não"}
          </button>
        </div>
      </div>
    </>
  );
};

export default PushPermissionPrompt;
