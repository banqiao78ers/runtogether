"use client";

import { useEffect, useRef } from "react";
import {
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, LineStringGeometry } from "@/lib/routing/types";

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";

const SOURCE_ID = "route-line";
const LAYER_ID = "route-line-layer";
const WP_SOURCE = "waypoints";
const WP_LAYER = "waypoints-layer";

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
  const onClickRef = useRef(onMapClick);
  onClickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
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
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: emptyLine(),
      });
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#34d399",
          "line-width": 4.5,
          "line-opacity": 0.9,
        },
      });

      map.addSource(WP_SOURCE, {
        type: "geojson",
        data: emptyPoints(),
      });
      map.addLayer({
        id: WP_LAYER,
        type: "circle",
        source: WP_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": "#a7f3d0",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#064e3b",
        },
      });
    });

    map.on("click", (e: MapMouseEvent) => {
      onClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: Math.max(map.getZoom(), 14) });
  }, [flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const line = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      const wps = map.getSource(WP_SOURCE) as GeoJSONSource | undefined;
      if (!line || !wps) return;

      line.setData(
        geometry
          ? { type: "Feature", properties: {}, geometry }
          : emptyLine(),
      );

      wps.setData({
        type: "FeatureCollection",
        features: waypoints.map((p, i) => ({
          type: "Feature" as const,
          properties: { i },
          geometry: {
            type: "Point" as const,
            coordinates: [p.lng, p.lat],
          },
        })),
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [waypoints, geometry]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full [&_.maplibregl-ctrl-group]:overflow-hidden [&_.maplibregl-ctrl-group]:rounded-lg [&_.maplibregl-ctrl-group]:border [&_.maplibregl-ctrl-group]:border-emerald-800/40 [&_.maplibregl-ctrl-group]:bg-[#0c1812]/90"
      role="application"
      aria-label="路線規劃地圖，點擊新增途經點"
    />
  );
}

function emptyLine() {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: [] as [number, number][] },
  };
}

function emptyPoints() {
  return {
    type: "FeatureCollection" as const,
    features: [] as Array<{
      type: "Feature";
      properties: { i: number };
      geometry: { type: "Point"; coordinates: [number, number] };
    }>,
  };
}
