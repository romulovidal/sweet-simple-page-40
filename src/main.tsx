import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "@/lib/registerServiceWorker";

createRoot(document.getElementById("root")!).render(<App />);

void registerAppServiceWorker();
