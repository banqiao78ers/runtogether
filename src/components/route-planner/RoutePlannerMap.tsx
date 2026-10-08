"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GeolocateControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildOsmRasterStyle } from "@/lib/routing/map-style";
import type { LatLng, LineStringGeometry } from "@/lib/routing/types";

const SOURCE_ID = "bq-route-line";
const LAYER_CASING = "bq-route-casing";
const LAYER_LINE = "bq-route-line";

type Props = {
  center: LatLng;
  zoom?: number;
  waypoints: LatLng[];
  geometry: LineStringGeometry | null;
  onMapClick?: (point: LatLng) => void;
  flyTo?: LatLng | null;
  readOnly?: boolean;
  fitToRoute?: boolean;
  visible?: boolean;
};

function waitForContainerSize(el: HTMLElement, timeoutMs = 3000) {
  return new Promise<void>((resolve) => {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      resolve();
      return;
    }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(el);
    window.setTimeout(() => {
      ro.disconnect();
      resolve();
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
  visible = true,
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
  const dragMovedRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  onClickRef.current = onMapClick;
  waypointsRef.current = waypoints;
  geometryRef.current = geometry;
  readOnlyRef.current = readOnly;

  const ensureRouteLayer = useCallback((map: MapLibreMap) => {
    if (!map.isStyleLoaded()) return false;
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(LAYER_CASING)) {
        map.addLayer({
          id: LAYER_CASING,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#042f2e",
            "line-width": 8,
            "line-opacity": 0.4,
          },
        });
      }
      if (!map.getLayer(LAYER_LINE)) {
        map.addLayer({
          id: LAYER_LINE,
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
      return true;
    } catch (err) {
      console.warn("[RoutePlannerMap] ensureRouteLayer", err);
      return false;
    }
  }, []);

  const syncRoute = useCallback(
    (map: MapLibreMap) => {
      if (!ensureRouteLayer(map)) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;

      try {
        const g = geometryRef.current;
        if (g && g.coordinates.length >= 2) {
          src.setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: g }],
          });
          return;
        }
        const pts = waypointsRef.current;
        if (pts.length >= 2) {
          src.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: pts.map((p) => [p.lng, p.lat] as [number, number]),
                },
              },
            ],
          });
          return;
        }
        src.setData({ type: "FeatureCollection", features: [] });
      } catch (err) {
        console.warn("[RoutePlannerMap] syncRoute", err);
      }
    },
    [ensureRouteLayer],
  );

  const syncMarkers = useCallback((map: MapLibreMap) => {
    try {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
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
    } catch (err) {
      console.warn("[RoutePlannerMap] syncMarkers", err);
    }
  }, []);

  const applyOverlays = useCallback(
    (map: MapLibreMap) => {
      syncMarkers(map);
      syncRoute(map);
    },
    [syncMarkers, syncRoute],
  );

  const kickResize = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.resize();
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.touchZoomRotate.disableRotation();
      map.dragRotate.disable();
      map.touchPitch.disable();
      map.triggerRepaint();
    } catch {
      // ignore
    }
  }, []);

  const fitRouteBounds = useCallback(
    (map: MapLibreMap) => {
      const g = geometryRef.current;
      const pts =
        g && g.coordinates.length >= 2
          ? g.coordinates.map(([lng, lat]) => ({ lat, lng }))
          : waypointsRef.current;
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
    },
    [],
  );

  // Keep-Alive 顯示時重繪
  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    kickResize();
    if (map?.isStyleLoaded()) applyOverlays(map);
    const timers = [0, 80, 250].map((ms) => window.setTimeout(kickResize, ms));
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [visible, kickResize, applyOverlays]);

  // 建圖
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    const timers: number[] = [];

    setMapReady(false);
    setMapError(null);
    fitDoneRef.current = false;

    (async () => {
      await waitForContainerSize(el);
      if (cancelled || !containerRef.current) return;

      containerRef.current.replaceChildren();

      map = new MapLibreMap({
        container: containerRef.current,
        style: buildOsmRasterStyle(),
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        fadeDuration: 0,
        dragPan: true,
        touchZoomRotate: true,
        dragRotate: false,
        pitchWithRotate: false,
        doubleClickZoom: true,
      });
      mapRef.current = map;
      map.dragRotate.disable();
      map.touchPitch.disable();
      map.touchZoomRotate.disableRotation();

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
        applyOverlays(map);
        kickResize();
        if (fitToRoute) fitRouteBounds(map);
        setMapReady(true);
      };

      map.on("load", afterReady);
      map.on("idle", () => {
        if (!cancelled) {
          setMapReady(true);
          kickResize();
        }
      });

      // 區分拖曳 vs 點擊加點
      map.on("dragstart", () => {
        dragMovedRef.current = true;
      });
      map.on("mousedown", () => {
        dragMovedRef.current = false;
      });
      map.on("touchstart", () => {
        dragMovedRef.current = false;
      });

      map.on("click", (e: MapMouseEvent) => {
        if (readOnlyRef.current) return;
        if (dragMovedRef.current) return;
        onClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      map.on("error", (e) => {
        const msg = e.error?.message ?? "";
        if (
          /Failed to fetch|AJAXError|tile\./i.test(msg) ||
          /\/\d+\/\d+\/\d+\.png/i.test(msg)
        ) {
          console.warn("[RoutePlannerMap] tile error", msg);
          return;
        }
        if (map && !map.isStyleLoaded()) {
          console.error("[RoutePlannerMap]", msg, e.error);
          setMapError(msg || "地圖載入失敗");
        }
      });

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setMapReady(true);
        }, 4000),
      );
    })();

    const ro = new ResizeObserver(() => kickResize());
    ro.observe(el);
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
      ro.disconnect();
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      if (map) map.remove();
      mapRef.current = null;
    };
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

  // 途經點／路線變更 → 一定重畫圖釘與線（style 未好則等 load）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const run = () => {
      applyOverlays(map);
      if (fitToRoute && !fitDoneRef.current) fitRouteBounds(map);
    };

    if (map.isStyleLoaded()) {
      run();
    } else {
      map.once("load", run);
    }
  }, [waypoints, geometry, applyOverlays, fitToRoute, fitRouteBounds]);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full min-h-[240px] bg-[#1a2e24]"
    >
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full [&_.maplibregl-canvas]:outline-none [&_.maplibregl-ctrl-top-right]:top-3 [&_.maplibregl-ctrl-top-right]:right-2 [&_.maplibregl-ctrl-group]:overflow-hidden [&_.maplibregl-ctrl-group]:rounded-lg [&_.maplibregl-ctrl-group]:border [&_.maplibregl-ctrl-group]:border-emerald-800/40 [&_.maplibregl-ctrl-group]:bg-[#0c1812]/90"
        role="application"
        aria-label={
          readOnly ? "路線分享地圖" : "路線規劃地圖，點擊設定起點與途經點"
        }
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
      {mapReady && (
        <button
          type="button"
          onClick={() => {
            setMapReady(false);
            setMapError(null);
            setRemountKey((k) => k + 1);
          }}
          className="absolute bottom-3 left-3 z-10 rounded-md border border-emerald-800/50 bg-[#0c1812]/90 px-2 py-1 text-[11px] text-emerald-100/70"
        >
          重新載入地圖
        </button>
      )}
    </div>
  );
}

function createPinElement(
  kind: "start" | "via" | "end",
  index: number,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "bq-route-pin";
  el.style.pointerEvents = "none";
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
