const APP_SHELL_URLS = [
  "/",
  "/manifest.json",
  "/logo.png",
];

const BIBLE_VERSION_URLS = [
  "/biblias/ACF.json",
  "/biblias/ARA.json",
  "/biblias/ARC.json",
  "/biblias/KJA.json",
  "/biblias/NTLH.json",
  "/biblias/NVI.json",
];

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function collectRuntimeUrls() {
  const urls = new Set<string>([...APP_SHELL_URLS, ...BIBLE_VERSION_URLS]);

  document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>('link[href], script[src]').forEach((element) => {
    const rawUrl = element instanceof HTMLLinkElement ? element.href : element.src;
    const normalized = normalizeUrl(rawUrl);
    if (normalized) {
      urls.add(normalized);
    }
  });

  performance.getEntriesByType("resource").forEach((entry) => {
    const normalized = normalizeUrl(entry.name);
    if (normalized) {
      urls.add(normalized);
    }
  });

  return [...urls];
}

function sendPrecacheMessage(registration: ServiceWorkerRegistration) {
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) return;

  worker.postMessage({
    type: "PRECACHE_URLS",
    urls: collectRuntimeUrls(),
  });
}

export async function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    sendPrecacheMessage(registration);
    registration.update().catch(() => {});

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // When the controller changes (new SW took over), reload to get fresh code
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.localStorage.removeItem("daily-verse-cache");
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_UPDATED") {
        window.localStorage.removeItem("daily-verse-cache");
      }
    });

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed") {
          newWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    navigator.serviceWorker.ready
      .then(() => sendPrecacheMessage(registration))
      .catch(() => undefined);

    // Check for SW updates on reconnect
    window.addEventListener("online", () => {
      registration.update().catch(() => {});
      sendPrecacheMessage(registration);
    });

    // Check for SW updates when tab becomes visible
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        registration.update().catch(() => {});
      }
    });

    // Periodic check every 1 minute so installed devices pick up verse-sync fixes quickly
    setInterval(() => {
      if (navigator.onLine) {
        registration.update().catch(() => {});
      }
    }, 60 * 1000);
  } catch (error) {
    console.error("Service worker registration error:", error);
  }
}
