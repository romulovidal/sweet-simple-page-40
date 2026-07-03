import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "@/lib/registerServiceWorker";
import { initErrorMonitor } from "@/lib/errorMonitor";

initErrorMonitor();

const allowLandscapeOrientation = () => {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLockType) => Promise<void>;
    unlock?: () => void;
  };

  orientation?.lock?.("any").catch(() => {
    try {
      orientation?.unlock?.();
    } catch {
      /* noop */
    }
  });
};

allowLandscapeOrientation();
window.addEventListener("pageshow", allowLandscapeOrientation);
window.addEventListener("focus", allowLandscapeOrientation);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") allowLandscapeOrientation();
});
document.addEventListener("pointerdown", allowLandscapeOrientation, { once: true, passive: true });

createRoot(document.getElementById("root")!).render(<App />);

void registerAppServiceWorker();
