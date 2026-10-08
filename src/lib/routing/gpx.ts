import type { LatLng } from "./types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 由路線座標產生 GPX 字串（client 端下載用） */
export function buildGpx(
  points: LatLng[],
  options?: { name?: string; distanceKm?: number },
): string {
  const name = escapeXml(options?.name ?? "BQ揪跑路線");
  const desc =
    options?.distanceKm != null
      ? escapeXml(`距離 ${options.distanceKm.toFixed(1)} km`)
      : "";

  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"></trkpt>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BQ揪跑" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    ${desc ? `<desc>${desc}</desc>` : ""}
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function downloadGpx(gpx: string, filename = "bq-route.gpx") {
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
