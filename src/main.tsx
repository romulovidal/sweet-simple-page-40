import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "@/lib/registerServiceWorker";
import { initErrorMonitor } from "@/lib/errorMonitor";

initErrorMonitor();

// Ensure the app is free to rotate; a previously-cached PWA manifest may have
// locked orientation. This is a no-op on browsers that don't support it.
try {
  (screen.orientation as any)?.unlock?.();
} catch {
  /* noop */
}

createRoot(document.getElementById("root")!).render(<App />);

void registerAppServiceWorker();
