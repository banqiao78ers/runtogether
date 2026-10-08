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

/**
 * 預載中心附近 OSM raster 圖磚，降低進規劃頁偶發空白。
 * 失敗可忽略（瀏覽器快取／網路不穩時仍由 MapLibre 自行載入）。
 */
export function preloadOsmTiles(
  center: LatLng,
  options?: { zoom?: number; radius?: number },
) {
  if (typeof window === "undefined") return;
  const z = options?.zoom ?? 14;
  const radius = options?.radius ?? 1;
  const { x: cx, y: cy } = latLngToTile(center.lat, center.lng, z);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  }
}
