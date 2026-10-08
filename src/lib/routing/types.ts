export type LatLng = {
  lat: number;
  lng: number;
};

export type RouteDraft = {
  distance_km: number;
  destination?: string;
  waypoint_count?: number;
  route_id?: string;
  title?: string;
};

export const ROUTE_DRAFT_KEY = "routeDraft";

/** 路線規劃地圖上次視窗（中心＋縮放） */
export const LAST_MAP_VIEW_KEY = "bq_last_map_view";

export const TARGET_DISTANCES_KM = [5, 10, 15] as const;

/** 尚無上次視窗且定位失敗時的冷啟動中心（板橋車站附近） */
export const DEFAULT_CENTER: LatLng = { lat: 25.0143, lng: 121.467 };

export type MapView = LatLng & { zoom: number };

export function readLastMapView(): MapView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_MAP_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<MapView>;
    if (
      typeof v.lat !== "number" ||
      typeof v.lng !== "number" ||
      !Number.isFinite(v.lat) ||
      !Number.isFinite(v.lng)
    ) {
      return null;
    }
    const zoom =
      typeof v.zoom === "number" && Number.isFinite(v.zoom) ? v.zoom : 14;
    return { lat: v.lat, lng: v.lng, zoom: Math.min(18, Math.max(10, zoom)) };
  } catch {
    return null;
  }
}

export function writeLastMapView(view: MapView) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LAST_MAP_VIEW_KEY,
      JSON.stringify({
        lat: view.lat,
        lng: view.lng,
        zoom: view.zoom,
      }),
    );
  } catch {
    // quota / private mode
  }
}

export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
};

export type RouteResult = {
  distance_m: number;
  geometry: LineStringGeometry;
  coordinates: LatLng[];
};
