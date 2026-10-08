import type { StyleSpecification } from "maplibre-gl";

/**
 * 免金鑰 raster 底圖。
 * 不用 tile.openstreetmap.org（易限流／Blocked）；改用德／法社群鏡像。
 */
export function buildOsmRasterStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
          "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

export function osmTileUrl(z: number, x: number, y: number) {
  return `https://tile.openstreetmap.de/${z}/${x}/${y}.png`;
}
