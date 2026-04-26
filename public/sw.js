var SW_VERSION = "v11";
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
  var cache = await caches.open(SHELL_CACHE);

  for (var i = 0; i < CORE_URLS.length; i++) {
    await addUrlToCache(cache, CORE_URLS[i]);
  }

  try {
    var response = await fetch(OFFLINE_FALLBACK_URL, { cache: "no-store" });
    if (!response || !response.ok) return;

    await cache.put(OFFLINE_FALLBACK_URL, response.clone());
    await cache.put("/index.html", response.clone());

    var html = await response.text();
    var matches = html.match(/(?:href|src)=["']([^"']+)["']/g) || [];
    for (var j = 0; j < matches.length; j++) {
      var match = matches[j].match(/(?:href|src)=["']([^"']+)["']/);
      if (match && match[1] && match[1].charAt(0) === "/") {
        await addUrlToCache(cache, match[1]);
      }
    }
  } catch (error) {
    console.warn("Shell precache failed:", error);
  }
}

async function cleanupCaches() {
  var cacheNames = await caches.keys();
  var keep = [SHELL_CACHE, RUNTIME_CACHE, BIBLE_CACHE];
  var toDelete = cacheNames.filter(function(name) {
    return keep.indexOf(name) === -1;
  });
  for (var i = 0; i < toDelete.length; i++) {
    await caches.delete(toDelete[i]);
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
      return self.clients.matchAll({ type: "window" }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
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

  if (!data || data.type !== "PRECACHE_URLS" || !Array.isArray(data.urls)) return;

  event.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache) {
      var urls = data.urls;
      var chain = Promise.resolve();
      for (var i = 0; i < urls.length; i++) {
        (function(rawUrl) {
          chain = chain.then(function() {
            try {
              var url = new URL(rawUrl, self.location.origin);
              if (!isSameOrigin(url) || !isCacheableRequest(url)) return;
              return addUrlToCache(cache, url.pathname + url.search);
            } catch(e) {
              return;
            }
          });
        })(urls[i]);
      }
      return chain;
    })
  );
});

self.addEventListener("fetch", function(event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  // Navigation: always network-first
  if (request.mode === "navigate") {
    event.respondWith(
      (function() {
        return caches.open(SHELL_CACHE).then(function(shellCache) {
          return fetch(request, { cache: "no-store" }).then(function(response) {
            if (response && response.ok) {
              shellCache.put(OFFLINE_FALLBACK_URL, response.clone());
            }
            return response;
          }).catch(function() {
            return shellCache.match(request).then(function(cached) {
              return cached || shellCache.match(OFFLINE_FALLBACK_URL).then(function(fallback) {
                return fallback || shellCache.match("/index.html").then(function(index) {
                  return index || Response.error();
                });
              });
            });
          });
        });
      })()
    );
    return;
  }

  if (!isCacheableRequest(url)) return;

  // Navigation & Bible data & API: always network-first
  // This ensures the Daily Verse update check isn't trapped in cache
  if (request.mode === "navigate" || isBibleRequest(url) || url.pathname.indexOf("/functions/v1/") !== -1) {
    event.respondWith(
      (function() {
        var targetCacheName = isBibleRequest(url) ? RUNTIME_CACHE : SHELL_CACHE;
        return caches.open(targetCacheName).then(function(cache) {
          // fetch with short timeout to not hang UI if internet is very slow
          return fetch(request, { cache: "no-store" }).then(function(response) {
            if (response && response.ok) {
              cache.put(request, response.clone());
              if (request.mode === "navigate") cache.put("/index.html", response.clone());
            }
            return response;
          }).catch(function() {
            return cache.match(request).then(function(cached) {
              if (cached) return cached;
              if (request.mode === "navigate") return cache.match("/index.html");
              return Response.error();
            });
          });
        });
      })()
    );
    return;
  }

  // Hashed assets: cache-first
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(function(cache) {
        return cache.match(request).then(function(cached) {
          if (cached) return cached;
          return fetch(request).then(function(response) {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          }).catch(function() {
            return Response.error();
          });
        });
      })
    );
    return;
  }

  // Other assets: network-first
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(function(cache) {
      return fetch(request).then(function(response) {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function() {
        return cache.match(request).then(function(cached) {
          return cached || Response.error();
        });
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
