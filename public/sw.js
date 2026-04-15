const SHELL_CACHE = "app-shell-v7";
const RUNTIME_CACHE = "app-runtime-v7";
const BIBLE_CACHE = "bible-offline-v5";
const OFFLINE_FALLBACK_URL = "/";
const CORE_URLS = [
  "/",
  "/manifest.json",
  "/logo.png",
];

async function addUrlToCache(cache, url) {
  try {
    await cache.add(url);
  } catch (error) {
    console.warn("Cache add failed:", url, error);
  }
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);

  for (const url of CORE_URLS) {
    await addUrlToCache(cache, url);
  }

  try {
    const response = await fetch(OFFLINE_FALLBACK_URL, { cache: "no-store" });
    if (!response || !response.ok) return;

    await cache.put(OFFLINE_FALLBACK_URL, response.clone());
    await cache.put("/index.html", response.clone());

    const html = await response.text();
    const assetUrls = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((value) => value.startsWith("/"));

    for (const assetUrl of assetUrls) {
      await addUrlToCache(cache, assetUrl);
    }
  } catch (error) {
    console.warn("Shell precache failed:", error);
  }
}

async function cleanupCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => ![SHELL_CACHE, RUNTIME_CACHE, BIBLE_CACHE].includes(name))
      .map((name) => caches.delete(name))
  );
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableRequest(requestUrl) {
  return (
    requestUrl.pathname === "/" ||
    requestUrl.pathname.startsWith("/assets/") ||
    requestUrl.pathname.startsWith("/biblias/") ||
    requestUrl.pathname === "/manifest.json" ||
    requestUrl.pathname === "/logo.png" ||
    requestUrl.pathname === "/placeholder.svg"
  );
}

function isBibleRequest(requestUrl) {
  return requestUrl.pathname.startsWith("/biblias/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanupCaches().then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE_URLS" || !Array.isArray(data.urls)) return;

  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      for (const rawUrl of data.urls) {
        try {
          const url = new URL(rawUrl, self.location.origin);
          if (!isSameOrigin(url) || !isCacheableRequest(url)) continue;
          await addUrlToCache(cache, `${url.pathname}${url.search}`);
        } catch {
          continue;
        }
      }
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const shellCache = await caches.open(SHELL_CACHE);

        try {
          const response = await fetch(request);
          if (response && response.ok) {
            await shellCache.put(OFFLINE_FALLBACK_URL, response.clone());
          }
          return response;
        } catch {
          return (
            (await shellCache.match(request)) ||
            (await shellCache.match(OFFLINE_FALLBACK_URL)) ||
            (await shellCache.match("/index.html")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  if (!isCacheableRequest(url)) {
    return;
  }

  if (isBibleRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);

        try {
          const response = await fetch(request, { cache: "no-store" });
          if (response && response.ok) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await cache.match(request)) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cacheName = url.pathname.startsWith("/assets/") ? SHELL_CACHE : RUNTIME_CACHE;
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return cachedResponse || Response.error();
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Versiculo do Dia", body: "Abra o app para ler", url: "/" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error("Push parse error:", error);
  }

  const options = {
    body: data.body,
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: [{ action: "open", title: "Abrir" }],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
