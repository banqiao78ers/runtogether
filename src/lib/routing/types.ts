export type LatLng = {
  lat: number;
  lng: number;
};

export type RouteDraft = {
  distance_km: number;
  destination?: string;
  waypoint_count?: number;
};

export const ROUTE_DRAFT_KEY = "routeDraft";

export const TARGET_DISTANCES_KM = [5, 10, 15] as const;

/** 板橋車站附近，定位失敗時的預設中心 */
export const DEFAULT_CENTER: LatLng = { lat: 25.0143, lng: 121.467 };

export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
};

export type RouteResult = {
  distance_m: number;
  geometry: LineStringGeometry;
  coordinates: LatLng[];
};
