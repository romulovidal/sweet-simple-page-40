// Versão substituída no build por scripts/stamp-sw.mjs (procura pelo literal abaixo).
var SW_VERSION = "__BUILD_VERSION__";
var SHELL_CACHE = "app-shell-" + SW_VERSION;
var RUNTIME_CACHE = "app-runtime-" + SW_VERSION;
var BIBLE_CACHE = "bible-offline-v5";
var HARPA_CACHE = "harpa-offline-v2";
var METARGUEM_CACHE = "metarguem-offline-v1";
var OFFLINE_FALLBACK_URL = "/";
var CORE_URLS = [
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
  // Precache do shell mínimo para o app abrir offline.
  // O HTML segue network-first (para pegar deploys novos), mas cai neste cache quando offline.
  var cache = await caches.open(SHELL_CACHE);
  await Promise.all(CORE_URLS.map(function(url) { return addUrlToCache(cache, url); }));
}

async function cleanupCaches() {
  // Mantém: cache atual do shell/runtime + caches offline persistentes (Bíblia, Harpa).
  // Remove apenas versões antigas do shell/runtime de deploys anteriores.
  var keep = [SHELL_CACHE, RUNTIME_CACHE, BIBLE_CACHE, HARPA_CACHE, METARGUEM_CACHE];
  var cacheNames = await caches.keys();
  for (var i = 0; i < cacheNames.length; i++) {
    if (keep.indexOf(cacheNames[i]) === -1) {
      await caches.delete(cacheNames[i]);
    }
  }
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableRequest(requestUrl) {
  return (
    requestUrl.pathname === "/" ||
    requestUrl.pathname.indexOf("/assets/") === 0 ||
    requestUrl.pathname.indexOf("/biblias/") === 0 ||
    requestUrl.pathname.indexOf("/harpa/") === 0 ||
    requestUrl.pathname.indexOf("/metarguem/") === 0 ||
    requestUrl.pathname === "/manifest.json" ||
    requestUrl.pathname === "/admin-manifest.json" ||
    requestUrl.pathname === "/logo.png" ||
    requestUrl.pathname === "/placeholder.svg"
  );
}

function isBibleRequest(requestUrl) {
  return requestUrl.pathname.indexOf("/biblias/") === 0;
}

function isHarpaRequest(requestUrl) {
  return requestUrl.pathname.indexOf("/harpa/") === 0;
}

function isMetarguemRequest(requestUrl) {
  return requestUrl.pathname.indexOf("/metarguem/") === 0;
}

function isHashedAsset(requestUrl) {
  return /\/assets\/.*-[a-zA-Z0-9]{6,}\.\w+$/.test(requestUrl.pathname);
}

self.addEventListener("install", function(event) {
  event.waitUntil(precacheShell().then(function() { return self.skipWaiting(); }));
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    cleanupCaches().then(function() { return self.clients.claim(); }).then(function() {
      return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: "SW_UPDATED", version: SW_VERSION, clearVerseCache: true });
          if (client.url && client.url.indexOf(self.location.origin) === 0) {
            client.navigate(client.url);
          }
        });
      });
    })
  );
});

self.addEventListener("message", function(event) {
  var data = event.data;

  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (!data || data.type !== "PRECACHE_URLS") return;
});

self.addEventListener("fetch", function(event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  // Navegação HTML: network-first (pega deploys novos) com fallback para o shell "/" cacheado (offline).
  if (request.mode === "navigate") {
    event.respondWith(
      (async function() {
        try {
          var fresh = await fetch(request, { cache: "no-store" });
          if (fresh && fresh.ok) {
            var cache = await caches.open(SHELL_CACHE);
            cache.put("/", fresh.clone()).catch(function() {});
          }
          return fresh;
        } catch (e) {
          var shell = await caches.match("/", { cacheName: SHELL_CACHE });
          if (shell) return shell;
          return new Response("", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  if (!isCacheableRequest(url)) return;

  // Keep Bible files available offline, but stop caching HTML/JS/CSS app shell.
  if (isBibleRequest(url)) {
    event.respondWith(
      (function() {
        return caches.open(BIBLE_CACHE).then(function(cache) {
          return fetch(request, { cache: "no-store" }).then(function(response) {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(function() {
            return cache.match(request).then(function(cached) { return cached || Response.error(); });
          });
        });
      })()
    );
    return;
  }

  // Harpa Cristã JSON — cache-first para funcionar 100% offline.
  if (isHarpaRequest(url)) {
    event.respondWith(
      caches.open(HARPA_CACHE).then(function(cache) {
        return cache.match(request).then(function(cached) {
          if (cached) {
            // revalida em segundo plano
            fetch(request, { cache: "no-store" }).then(function(response) {
              if (response && response.ok) cache.put(request, response.clone());
            }).catch(function() {});
            return cached;
          }
          return fetch(request, { cache: "no-store" }).then(function(response) {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          }).catch(function() { return Response.error(); });
        });
      })
    );
    return;
  }

  // Metarguem — cache-first para funcionar 100% offline após primeiro acesso.
  if (isMetarguemRequest(url)) {
    event.respondWith(
      caches.open(METARGUEM_CACHE).then(function(cache) {
        return cache.match(request).then(function(cached) {
          if (cached) return cached;
          return fetch(request, { cache: "no-store" }).then(function(response) {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          }).catch(function() { return Response.error(); });
        });
      })
    );
    return;
  }

  // Assets hasheados do build (/assets/xxx-<hash>.js|css|...): cache-first (imutáveis).
  // Permite abrir o app offline mesmo após uma navegação vinda do fallback.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(function(cache) {
        return cache.match(request).then(function(cached) {
          if (cached) return cached;
          return fetch(request).then(function(response) {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          }).catch(function() { return Response.error(); });
        });
      })
    );
    return;
  }

  // Demais arquivos cacheáveis (manifest, logo, etc.): stale-while-revalidate no runtime cache.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(function(cache) {
      return cache.match(request).then(function(cached) {
        var networkPromise = fetch(request, { cache: "no-store" }).then(function(response) {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        }).catch(function() { return cached || Response.error(); });
        return cached || networkPromise;
      });
    })
  );
});

self.addEventListener("push", function(event) {
  var data = { title: "Versiculo do Dia", body: "Abra o app para ler", url: "/" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error("Push parse error:", error);
  }

  if (!data || typeof data !== "object") data = {};
  if (!data.title) data.title = "Bíblia Atalaia";
  if (!data.body) data.body = "Abra o app para ler";

  var options = {
    body: data.body,
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/", title: data.title, body: data.body },
    actions: [{ action: "open", title: "Abrir" }],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  var notifData = event.notification.data || {};
  var title = notifData.title || "";
  var body = notifData.body || "";
  var targetUrl = notifData.url || "/";
  // Ensure it's a same-origin relative path
  if (targetUrl.charAt(0) !== "/") targetUrl = "/";
  var separator = targetUrl.indexOf("?") >= 0 ? "&" : "?";
  var urlWithParams = targetUrl + separator +
    "push_title=" + encodeURIComponent(title) +
    "&push_body=" + encodeURIComponent(body);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ("focus" in client && client.url.indexOf(self.location.origin) === 0) {
          client.postMessage({
            type: "PUSH_NOTIFICATION_CLICKED",
            title: title,
            body: body,
            url: targetUrl
          });
          return client.focus().then(function() {
            if ("navigate" in client && targetUrl !== "/") {
              try { return client.navigate(targetUrl); } catch (e) { /* ignore */ }
            }
          });
        }
      }
      return clients.openWindow(urlWithParams);
    })
  );
});
