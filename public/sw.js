// __BUILD_VERSION__ é substituído automaticamente por scripts/stamp-sw.mjs no build.
// Em dev o valor "dev" fica, mas o SW nem se registra fora de produção.
var SW_VERSION = "__BUILD_VERSION__";
var SHELL_CACHE = "app-shell-" + SW_VERSION;
var RUNTIME_CACHE = "app-runtime-" + SW_VERSION;
var BIBLE_CACHE = "bible-offline-v5";
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
  // App-shell precache intentionally disabled. The installed app must always fetch
  // the latest HTML/JS so removed automatic daily-verse code cannot remain alive.
  return Promise.resolve();
}

async function cleanupCaches() {
  var cacheNames = await caches.keys();
  for (var i = 0; i < cacheNames.length; i++) {
    await caches.delete(cacheNames[i]);
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
    requestUrl.pathname === "/manifest.json" ||
    requestUrl.pathname === "/admin-manifest.json" ||
    requestUrl.pathname === "/logo.png" ||
    requestUrl.pathname === "/placeholder.svg"
  );
}

function isBibleRequest(requestUrl) {
  return requestUrl.pathname.indexOf("/biblias/") === 0;
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

  // Navigation: always network-first, never app-shell-cache-first. This prevents old installed apps
  // from keeping the removed automatic daily verse bundle alive.
  if (request.mode === "navigate") {
    event.respondWith(
      (function() {
        return fetch(request, { cache: "no-store" }).catch(function() {
          return new Response("", { status: 503, statusText: "Offline" });
        });
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

  // App assets/control files: network-only so stale bundles cannot survive deploys.
  event.respondWith(
    fetch(request, { cache: "no-store" }).catch(function() {
      return Response.error();
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

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      // Try to find an existing window and post message to it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ("focus" in client && client.url.indexOf(self.location.origin) === 0) {
          client.postMessage({
            type: "PUSH_NOTIFICATION_CLICKED",
            title: title,
            body: body
          });
          return client.focus();
        }
      }
      // No window open — open with query params so the app can show the modal
      var url = "/?push_title=" + encodeURIComponent(title) + "&push_body=" + encodeURIComponent(body);
      return clients.openWindow(url);
    })
  );
});
