/** v2：不快取 opaque（會讓 MapLibre 讀圖磚 Failed to fetch (0)） */
const TILE_CACHE = "bq-map-tiles-v2";
const TILE_MAX_ENTRIES = 800;

function isMapTileRequest(url) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  if (
    host === "tile.openstreetmap.org" ||
    host.endsWith(".tile.openstreetmap.org") ||
    host === "tile.openstreetmap.de" ||
    host.endsWith(".tile.openstreetmap.fr") ||
    host === "a.tile.openstreetmap.fr" ||
    host === "b.tile.openstreetmap.fr" ||
    host === "c.tile.openstreetmap.fr" ||
    host === "tiles.openfreemap.org" ||
    host.endsWith(".openfreemap.org")
  ) {
    return true;
  }
  return /\/\d+\/\d+\/\d+(\.png|\.jpg|\.jpeg|\.webp)?$/i.test(url.pathname);
}

function isUsableTileResponse(res) {
  // MapLibre 需要可讀取的 CORS／basic 回應；opaque 會造成 AJAXError 0
  return res && res.ok && (res.type === "basic" || res.type === "cors");
}

async function trimTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_MAX_ENTRIES) return;
  const removeCount = keys.length - TILE_MAX_ENTRIES;
  await Promise.all(keys.slice(0, removeCount).map((k) => cache.delete(k)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("bq-map-tiles-") && n !== TILE_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * 圖磚：可用快取優先；略過 opaque；失敗時直接網路（勿丟出阻斷）。
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (!isMapTileRequest(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(req, { ignoreVary: true });
      if (cached && isUsableTileResponse(cached)) {
        return cached;
      }
      // 清掉壞掉的 opaque 快取
      if (cached) {
        try {
          await cache.delete(req);
        } catch {
          // ignore
        }
      }

      try {
        const res = await fetch(req);
        if (isUsableTileResponse(res)) {
          try {
            await cache.put(req, res.clone());
            await trimTileCache(cache);
          } catch {
            // Quota／隱私模式略過
          }
        }
        return res;
      } catch {
        const fallback = await cache.match(req, {
          ignoreSearch: true,
          ignoreVary: true,
        });
        if (fallback && isUsableTileResponse(fallback)) return fallback;
        // 讓瀏覽器／MapLibre 自行處理失敗，不要拋出造成整頁卡死
        return Response.error();
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "板橋約跑", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "板橋約跑", {
      body: data.body || "",
      data: { url: data.url || "/" },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(url);
          }
          return;
        }
      }
      await clients.openWindow(url);
    })(),
  );
});
