import { useEffect, useState, useCallback } from "react";

const TOUR_KEY = "tour_completed_v1";

/** Detecta se o prompt de notificação está visível na tela. */
function isPushPromptVisible() {
  // O prompt usa z-[100] e cobre a tela inteira; checamos pelo overlay/dialog
  return !!document.querySelector('[class*="z-[100]"]');
}

export function useAppTour() {
  const [shouldStart, setShouldStart] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (completed) return;

    let timer: number | null = null;
    let cancelled = false;

    const tryStart = () => {
      if (cancelled) return;
      if (isPushPromptVisible()) {
        // Aguarda o prompt fechar
        return;
      }
      setShouldStart(true);
    };

    // Tenta após 1.5s; se prompt estiver aberto, espera evento de fechamento
    timer = window.setTimeout(tryStart, 1500);

    const handlePromptClosed = () => {
      // Pequeno delay para a animação de saída
      window.setTimeout(tryStart, 400);
    };
    window.addEventListener("push-prompt:closed", handlePromptClosed);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("push-prompt:closed", handlePromptClosed);
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
