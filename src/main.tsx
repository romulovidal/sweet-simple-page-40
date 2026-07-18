import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "@/lib/registerServiceWorker";
import { initErrorMonitor } from "@/lib/errorMonitor";
import { initSentry } from "@/lib/sentry";
import { initNative } from "@/lib/nativeBootstrap";

initSentry();
initErrorMonitor();

// Lock the app in portrait; fullscreen videos handle their own landscape lock.
const lockPortraitOrientation = () => {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLockType) => Promise<void>;
  };
  orientation?.lock?.("portrait").catch(() => {
    /* browser may block outside fullscreen/installed contexts */
  });
};

lockPortraitOrientation();
window.addEventListener("pageshow", lockPortraitOrientation);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

void registerAppServiceWorker();
void initNative();
