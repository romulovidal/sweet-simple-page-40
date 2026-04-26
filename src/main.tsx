import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "@/lib/registerServiceWorker";
import { initErrorMonitor } from "@/lib/errorMonitor";

initErrorMonitor();

createRoot(document.getElementById("root")!).render(<App />);

void registerAppServiceWorker();
