import { useEffect, useState, useCallback } from "react";

const TOUR_KEY = "tour_completed_v1";

export function useAppTour() {
  const [shouldStart, setShouldStart] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = window.setTimeout(() => setShouldStart(true), 1500);
      return () => window.clearTimeout(timer);
    }
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
