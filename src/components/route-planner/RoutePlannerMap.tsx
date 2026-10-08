"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeolocateControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, LineStringGeometry } from "@/lib/routing/types";

/**
 * 預設用免金鑰 OSM raster（內嵌 style，不依賴第三方 style JSON／Carto）。
 * 若要向量底圖可設 NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
 */
const FREE_OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const CUSTOM_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || "";

const SOURCE_ID = "route-line";
const LAYER_ID = "route-line-layer";

type Props = {
  center: LatLng;
  zoom?: number;
  waypoints: LatLng[];
  geometry: LineStringGeometry | null;
  onMapClick: (point: LatLng) => void;
  flyTo?: LatLng | null;
};

export function RoutePlannerMap({
  center,
  zoom = 14,
  waypoints,
  geometry,
  onMapClick,
  flyTo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onClickRef = useRef(onMapClick);
  const waypointsRef = useRef(waypoints);
  const geometryRef = useRef(geometry);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  onClickRef.current = onMapClick;
  waypointsRef.current = waypoints;
  geometryRef.current = geometry;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;
    let fellBack = false;

    const initialStyle: string | StyleSpecification = CUSTOM_STYLE_URL
      ? CUSTOM_STYLE_URL
      : FREE_OSM_RASTER_STYLE;

    setMapReady(false);

    const map = new MapLibreMap({
      container: el,
      style: initialStyle,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
      fadeDuration: 0,
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right",
    );

    const ensureRouteLayer = () => {
      if (cancelled) return;
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: emptyLine(),
        });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#34d399",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });
      }
      syncRoute(map);
      syncMarkers(map);
      map.resize();
    };

    map.on("load", () => {
      setMapError(null);
      ensureRouteLayer();
    });

    map.on("idle", () => {
      if (!cancelled) setMapReady(true);
    });

    // setStyle／重建後若路線圖層消失，補回一次
    map.on("styledata", () => {
      if (!map.isStyleLoaded()) return;
      if (!map.getSource(SOURCE_ID) || !map.getLayer(LAYER_ID)) {
        ensureRouteLayer();
      }
    });

    map.on("error", (e) => {
      const msg = e.error?.message ?? "地圖載入失敗";
      if (
        CUSTOM_STYLE_URL &&
        !fellBack &&
        !cancelled &&
        !map.isStyleLoaded()
      ) {
        console.warn("[RoutePlannerMap] custom style failed, OSM raster", msg);
        fellBack = true;
        setMapError(null);
        setMapReady(false);
        map.setStyle(FREE_OSM_RASTER_STYLE);
        return;
      }
      if (!map.isStyleLoaded()) {
        console.error("[RoutePlannerMap]", msg, e.error);
        setMapError(msg);
      }
    });

    map.on("click", (e: MapMouseEvent) => {
      onClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(el);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        map.resize();
        requestAnimationFrame(() => map.resize());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);

    requestAnimationFrame(() => map.resize());
    const t1 = window.setTimeout(() => map.resize(), 100);
    const t2 = window.setTimeout(() => map.resize(), 500);
    // 最長等待後仍顯示地圖區（避免一直卡在「載入中」）
    const t3 = window.setTimeout(() => {
      if (!cancelled) setMapReady(true);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      ro.disconnect();
      clearMarkers(markersRef);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: Math.max(map.getZoom(), 14),
    });
  }, [flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncMarkers(map);
    if (map.isStyleLoaded()) {
      ensureSource(map);
      syncRoute(map);
    }
  }, [waypoints, geometry]);

  function ensureSource(map: MapLibreMap) {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: emptyLine() });
    }
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#34d399",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      });
    }
  }

  function syncRoute(map: MapLibreMap) {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    const g = geometryRef.current;
    if (g && g.coordinates.length >= 2) {
      src.setData({ type: "Feature", properties: {}, geometry: g });
      return;
    }
    // 貼路結果尚未回來時，先畫途經點直線預覽
    const pts = waypointsRef.current;
    if (pts.length >= 2) {
      src.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: pts.map((p) => [p.lng, p.lat] as [number, number]),
        },
      });
      return;
    }
    src.setData(emptyLine());
  }

  function syncMarkers(map: MapLibreMap) {
    clearMarkers(markersRef);
    const pts = waypointsRef.current;
    pts.forEach((p, i) => {
      const kind =
        pts.length === 1
          ? "start"
          : i === 0
            ? "start"
            : i === pts.length - 1
              ? "end"
              : "via";
      const el = createPinElement(kind, i + 1);
      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }

  return (
    <div className="relative h-full w-full min-h-[240px] bg-[#1a2e24]">
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full cursor-crosshair [&_.maplibregl-canvas]:outline-none [&_.maplibregl-ctrl-top-right]:top-3 [&_.maplibregl-ctrl-top-right]:right-2 [&_.maplibregl-ctrl-group]:overflow-hidden [&_.maplibregl-ctrl-group]:rounded-lg [&_.maplibregl-ctrl-group]:border [&_.maplibregl-ctrl-group]:border-emerald-800/40 [&_.maplibregl-ctrl-group]:bg-[#0c1812]/90"
        role="application"
        aria-label="路線規劃地圖，點擊設定起點與途經點"
      />
      {!mapReady && !mapError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#1a2e24]/55">
          <p className="rounded-lg bg-[#0c1812]/90 px-3 py-2 text-sm text-emerald-100/80">
            地圖載入中…
          </p>
        </div>
      )}
      {mapError && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-lg bg-amber-950/90 px-3 py-2 text-xs text-amber-100">
          地圖載入失敗：{mapError}
        </div>
      )}
    </div>
  );
}

function clearMarkers(markersRef: { current: Marker[] }) {
  for (const m of markersRef.current) m.remove();
  markersRef.current = [];
}

function createPinElement(
  kind: "start" | "via" | "end",
  index: number,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "bq-route-pin";
  const label =
    kind === "start" ? "起" : kind === "end" ? "終" : String(index);
  const bg =
    kind === "start" ? "#34d399" : kind === "end" ? "#fbbf24" : "#a7f3d0";
  const fg = kind === "end" ? "#422006" : "#064e3b";
  el.innerHTML = `<div style="
    display:flex;flex-direction:column;align-items:center;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));
    pointer-events:none;user-select:none;
  ">
    <div style="
      width:28px;height:28px;border-radius:9999px;
      background:${bg};color:${fg};
      border:2px solid #042f2e;
      display:flex;align-items:center;justify-content:center;
      font:700 12px/1 sans-serif;
    ">${label}</div>
    <div style="
      width:0;height:0;
      border-left:7px solid transparent;
      border-right:7px solid transparent;
      border-top:10px solid ${bg};
      margin-top:-2px;
    "></div>
  </div>`;
  return el;
}

function emptyLine() {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: [] as [number, number][],
    },
  };
}
