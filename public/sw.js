const TILE_CACHE = "bq-map-tiles-v1";
const TILE_MAX_ENTRIES = 800;

/** OpenStreetMap／常用 raster 圖磚（路線規劃底圖） */
function isMapTileRequest(url) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  if (
    host === "tile.openstreetmap.org" ||
    host.endsWith(".tile.openstreetmap.org") ||
    host === "tiles.openfreemap.org" ||
    host.endsWith(".openfreemap.org")
  ) {
    return true;
  }
  // /{z}/{x}/{y}.png 形式
  return /\/\d+\/\d+\/\d+(\.png|\.jpg|\.jpeg|\.webp)?$/i.test(url.pathname);
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
 * 圖磚：Cache First（命中快取不打網路）
 * 其餘請求不攔截，避免影響 App／API／推播
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
      if (cached) return cached;

      try {
        const res = await fetch(req);
        // 成功或 opaque（no-cors 圖磚）都可入庫
        if (res.ok || res.type === "opaque") {
          try {
            await cache.put(req, res.clone());
            await trimTileCache(cache);
          } catch {
            // Quota／隱私模式略過
          }
        }
        return res;
      } catch (err) {
        // 離線時再試一次 match（忽略 search 差異）
        const fallback = await cache.match(req, {
          ignoreSearch: true,
          ignoreVary: true,
        });
        if (fallback) return fallback;
        throw err;
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
