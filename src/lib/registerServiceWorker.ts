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

function applyWaitingUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

export async function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    sendPrecacheMessage(registration);
    applyWaitingUpdate(registration);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          applyWaitingUpdate(registration);
        }
      });
    });

    navigator.serviceWorker.ready
      .then(() => sendPrecacheMessage(registration))
      .catch(() => undefined);

    window.addEventListener("online", () => {
      registration.update().catch(() => {});
      sendPrecacheMessage(registration);
      applyWaitingUpdate(registration);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        registration.update().catch(() => {});
        applyWaitingUpdate(registration);
      }
    });
  } catch (error) {
    console.error("Service worker registration error:", error);
  }
}
