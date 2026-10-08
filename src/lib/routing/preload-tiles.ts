import type { LatLng } from "./types";
import { osmTileUrl } from "./map-style";

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
 * 輕量預載（cors fetch，禁止 no-cors／opaque，否則會毒化 SW 快取）。
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
      const url = osmTileUrl(z, cx + dx, cy + dy);
      void fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" }).catch(
        () => {},
      );
    }
  }
}
