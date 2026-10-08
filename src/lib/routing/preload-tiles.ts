import type { LatLng } from "./types";

/** Web Mercator → OSM tile 座標 */
function latLngToTile(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

const preloadedKeys = new Set<string>();

/**
 * 輕量預載中心附近圖磚（配合 SW Cache First，重複造訪幾乎不耗流量）。
 * 同一 zoom／tile 區只預載一次（本分頁生命週期內）。
 */
export function preloadOsmTiles(
  center: LatLng,
  options?: { zoom?: number; radius?: number },
) {
  if (typeof window === "undefined") return;
  const z = options?.zoom ?? 14;
  const radius = options?.radius ?? 1;
  const { x: cx, y: cy } = latLngToTile(center.lat, center.lng, z);
  const areaKey = `${z}:${cx}:${cy}:${radius}`;
  if (preloadedKeys.has(areaKey)) return;
  preloadedKeys.add(areaKey);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      // 用 fetch 走 SW，才能寫進 Cache Storage；Image 預載不一定被攔截
      void fetch(url, { mode: "no-cors", credentials: "omit" }).catch(() => {});
    }
  }
}
