import { useEffect, useState } from "react";

const TOUR_KEY = "tour_completed_v1";

export function useAppTour() {
  const [shouldStart, setShouldStart] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => setShouldStart(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const finishTour = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(TOUR_KEY, new Date().toISOString());
    }
    setShouldStart(false);
  };

  const restartTour = () => {
    localStorage.removeItem(TOUR_KEY);
    setShouldStart(true);
  };

  return { shouldStart, finishTour, restartTour };
}

export function triggerAppTour() {
  localStorage.removeItem(TOUR_KEY);
  window.dispatchEvent(new CustomEvent("app-tour:restart"));
}
