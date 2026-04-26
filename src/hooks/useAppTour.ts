import { useEffect, useState, useCallback } from "react";

const TOUR_KEY = "tour_completed_v1";

/** Detecta se o prompt de notificação está visível na tela. */
function isPushPromptVisible() {
  return !!document.querySelector('[data-push-prompt="true"]') || !!document.querySelector('[data-onboarding-active="true"]');
}

export function useAppTour() {
  const [shouldStart, setShouldStart] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (completed) return;

    let timer: number | null = null;
    let pollTimer: number | null = null;
    let cancelled = false;

    const tryStart = () => {
      if (cancelled) return;
      if (isPushPromptVisible()) {
        // Tenta novamente em breve enquanto o prompt estiver visível
        pollTimer = window.setTimeout(tryStart, 500);
        return;
      }
      setShouldStart(true);
    };

    // Tenta após 1.5s; se prompt estiver aberto, segue tentando + escuta evento
    timer = window.setTimeout(tryStart, 1500);

    const handlePromptClosed = () => {
      window.setTimeout(tryStart, 400);
    };
    
    window.addEventListener("push-prompt:closed", handlePromptClosed);
    window.addEventListener("onboarding:closed", handlePromptClosed);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (pollTimer) window.clearTimeout(pollTimer);
      window.removeEventListener("push-prompt:closed", handlePromptClosed);
      window.removeEventListener("onboarding:closed", handlePromptClosed);
    };
  }, []);

  const finishTour = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(TOUR_KEY, new Date().toISOString());
    }
    setShouldStart(false);
  }, []);

  const restartTour = useCallback(() => {
    localStorage.removeItem(TOUR_KEY);
    setShouldStart(true);
  }, []);

  return { shouldStart, finishTour, restartTour };
}

export function triggerAppTour() {
  localStorage.removeItem(TOUR_KEY);
  window.dispatchEvent(new CustomEvent("app-tour:restart"));
}
