"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GeolocateControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, LineStringGeometry } from "@/lib/routing/types";

/**
 * 預設用免金鑰 OSM raster。
 * 路線軌跡改以 SVG 疊加繪製（不依賴 GeoJSON line layer，避免偶發不顯示）。
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
  const [pathD, setPathD] = useState("");
  const [pathPreview, setPathPreview] = useState(false);

  onClickRef.current = onMapClick;
  waypointsRef.current = waypoints;
  geometryRef.current = geometry;

  const routePoints = useCallback((): LatLng[] => {
    const g = geometryRef.current;
    if (g && g.coordinates.length >= 2) {
      return g.coordinates.map(([lng, lat]) => ({ lat, lng }));
    }
    return waypointsRef.current;
  }, []);

  const redrawPath = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      setPathD("");
      return;
    }
    const pts = routePoints();
    if (pts.length < 2) {
      setPathD("");
      setPathPreview(false);
      return;
    }
    const g = geometryRef.current;
    setPathPreview(!(g && g.coordinates.length >= 2));

    const projected = pts.map((p) => map.project([p.lng, p.lat]));
    const d = projected
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    setPathD(d);
  }, [routePoints]);

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

    map.on("load", () => {
      setMapError(null);
      syncMarkers(map);
      redrawPath();
      map.resize();
    });

    map.on("idle", () => {
      if (!cancelled) {
        setMapReady(true);
        redrawPath();
      }
    });

    map.on("move", redrawPath);
    map.on("zoom", redrawPath);
    map.on("resize", redrawPath);

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
      redrawPath();
    });
    ro.observe(el);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        map.resize();
        requestAnimationFrame(() => {
          map.resize();
          redrawPath();
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);

    requestAnimationFrame(() => map.resize());
    const t1 = window.setTimeout(() => map.resize(), 100);
    const t2 = window.setTimeout(() => {
      map.resize();
      redrawPath();
    }, 500);
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
    redrawPath();
  }, [waypoints, geometry, redrawPath]);

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
      {/* 軌跡疊加：與地圖同尺寸，跟隨 project() 座標 */}
      <svg
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        aria-hidden
      >
        {pathD ? (
          <>
            <path
              d={pathD}
              fill="none"
              stroke="#042f2e"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
            />
            <path
              d={pathD}
              fill="none"
              stroke="#34d399"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={pathPreview ? "8 6" : undefined}
              opacity={0.95}
            />
          </>
        ) : null}
      </svg>
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
