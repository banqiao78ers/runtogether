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

/** 每次建圖都回傳新物件，避免 MapLibre 改壞共用 style 導致切頁後空白 */
function buildOsmRasterStyle(): StyleSpecification {
  return {
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
}

const CUSTOM_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || "";

type Props = {
  center: LatLng;
  zoom?: number;
  waypoints: LatLng[];
  geometry: LineStringGeometry | null;
  onMapClick?: (point: LatLng) => void;
  flyTo?: LatLng | null;
  readOnly?: boolean;
  fitToRoute?: boolean;
};

function waitForContainerSize(
  el: HTMLElement,
  timeoutMs = 3000,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const ready = () => el.clientWidth > 0 && el.clientHeight > 0;
    if (ready()) {
      resolve({ w: el.clientWidth, h: el.clientHeight });
      return;
    }
    const ro = new ResizeObserver(() => {
      if (ready()) {
        ro.disconnect();
        resolve({ w: el.clientWidth, h: el.clientHeight });
      }
    });
    ro.observe(el);
    window.setTimeout(() => {
      ro.disconnect();
      resolve({ w: el.clientWidth, h: el.clientHeight });
    }, timeoutMs);
  });
}

export function RoutePlannerMap({
  center,
  zoom = 14,
  waypoints,
  geometry,
  onMapClick,
  flyTo,
  readOnly = false,
  fitToRoute = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onClickRef = useRef(onMapClick);
  const waypointsRef = useRef(waypoints);
  const geometryRef = useRef(geometry);
  const readOnlyRef = useRef(readOnly);
  const fitDoneRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [pathD, setPathD] = useState("");
  const [pathPreview, setPathPreview] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  onClickRef.current = onMapClick;
  waypointsRef.current = waypoints;
  geometryRef.current = geometry;
  readOnlyRef.current = readOnly;

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

  const kickResize = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
    redrawPath();
  }, [redrawPath]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let fellBack = false;
    let map: MapLibreMap | null = null;
    const timers: number[] = [];

    setMapReady(false);
    setMapError(null);
    fitDoneRef.current = false;

    (async () => {
      await waitForContainerSize(el);
      if (cancelled || !containerRef.current) return;

      const initialStyle: string | StyleSpecification = CUSTOM_STYLE_URL
        ? CUSTOM_STYLE_URL
        : buildOsmRasterStyle();

      map = new MapLibreMap({
        container: containerRef.current,
        style: initialStyle,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      mapRef.current = map;

      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      if (!readOnly) {
        map.addControl(
          new GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
          }),
          "top-right",
        );
      }

      const afterReady = () => {
        if (cancelled || !map) return;
        setMapError(null);
        syncMarkers(map);
        kickResize();
        if (fitToRoute) fitRouteBounds(map);
        // 切頁回來時常需多踢幾次 resize，否則 canvas 維持 0×0
        timers.push(
          window.setTimeout(kickResize, 0),
          window.setTimeout(kickResize, 50),
          window.setTimeout(kickResize, 200),
          window.setTimeout(kickResize, 500),
          window.setTimeout(kickResize, 1000),
        );
      };

      map.on("load", afterReady);
      map.on("idle", () => {
        if (!cancelled) {
          setMapReady(true);
          kickResize();
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
          map &&
          !map.isStyleLoaded()
        ) {
          console.warn("[RoutePlannerMap] custom style failed, OSM raster", msg);
          fellBack = true;
          setMapError(null);
          setMapReady(false);
          map.setStyle(buildOsmRasterStyle());
          return;
        }
        if (map && !map.isStyleLoaded()) {
          console.error("[RoutePlannerMap]", msg, e.error);
          setMapError(msg);
        }
      });

      map.on("click", (e: MapMouseEvent) => {
        if (readOnlyRef.current) return;
        onClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setMapReady(true);
        }, 5000),
      );
    })();

    const ro = new ResizeObserver(() => {
      kickResize();
    });
    ro.observe(el);
    if (wrapRef.current) ro.observe(wrapRef.current);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        kickResize();
        requestAnimationFrame(kickResize);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);

    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      ro.disconnect();
      clearMarkers(markersRef);
      if (map) {
        map.remove();
      }
      mapRef.current = null;
      setPathD("");
    };
    // remountKey：使用者手動重載；其餘只在掛載時建圖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remountKey]);

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
    if (fitToRoute && !fitDoneRef.current) {
      fitRouteBounds(map);
    }
  }, [waypoints, geometry, redrawPath, fitToRoute]);

  function fitRouteBounds(map: MapLibreMap) {
    const pts = routePoints();
    if (pts.length < 1) return;
    if (pts.length === 1) {
      map.jumpTo({
        center: [pts[0].lng, pts[0].lat],
        zoom: Math.max(map.getZoom(), 14),
      });
      fitDoneRef.current = true;
      return;
    }
    let minLng = pts[0].lng;
    let maxLng = pts[0].lng;
    let minLat = pts[0].lat;
    let maxLat = pts[0].lat;
    for (const p of pts) {
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 56, maxZoom: 16, duration: 0 },
    );
    fitDoneRef.current = true;
    requestAnimationFrame(() => redrawPath());
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

  function reloadMap() {
    setMapReady(false);
    setMapError(null);
    setRemountKey((k) => k + 1);
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full min-h-[240px] bg-[#1a2e24]"
    >
      <div
        ref={containerRef}
        className={`absolute inset-0 h-full w-full [&_.maplibregl-canvas]:outline-none [&_.maplibregl-ctrl-top-right]:top-3 [&_.maplibregl-ctrl-top-right]:right-2 [&_.maplibregl-ctrl-group]:overflow-hidden [&_.maplibregl-ctrl-group]:rounded-lg [&_.maplibregl-ctrl-group]:border [&_.maplibregl-ctrl-group]:border-emerald-800/40 [&_.maplibregl-ctrl-group]:bg-[#0c1812]/90 ${
          readOnly ? "cursor-grab" : "cursor-crosshair"
        }`}
        role="application"
        aria-label={
          readOnly ? "路線分享地圖" : "路線規劃地圖，點擊設定起點與途經點"
        }
      />
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
      {(mapError || (mapReady && !pathD && waypoints.length === 0)) && (
        <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col items-stretch gap-2">
          {mapError && (
            <p className="rounded-lg bg-amber-950/90 px-3 py-2 text-xs text-amber-100">
              地圖載入失敗：{mapError}
            </p>
          )}
        </div>
      )}
      {mapReady && (
        <button
          type="button"
          onClick={reloadMap}
          className="absolute bottom-3 left-3 z-10 rounded-md border border-emerald-800/50 bg-[#0c1812]/90 px-2 py-1 text-[11px] text-emerald-100/70"
        >
          重新載入地圖
        </button>
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
