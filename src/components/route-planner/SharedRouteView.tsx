"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiErrorMessage } from "@/lib/api-errors";
import { formatKm, metersToKm } from "@/lib/routing/format";
import {
  DEFAULT_CENTER,
  type LatLng,
  type LineStringGeometry,
} from "@/lib/routing/types";
import { RoutePlannerMap } from "./RoutePlannerMap";

type SharedRoute = {
  id: string;
  title: string;
  distance_m: number;
  geometry: LineStringGeometry;
  waypoints: LatLng[];
  creator_name: string | null;
  created_at: string;
};

function normalizeWaypoints(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const lat = Number((p as { lat?: unknown }).lat);
    const lng = Number((p as { lng?: unknown }).lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ lat, lng });
    }
  }
  return out;
}

function normalizeGeometry(raw: unknown): LineStringGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as { type?: unknown; coordinates?: unknown };
  if (g.type !== "LineString" || !Array.isArray(g.coordinates)) return null;
  const coordinates: [number, number][] = [];
  for (const c of g.coordinates) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      coordinates.push([lng, lat]);
    }
  }
  if (coordinates.length < 2) return null;
  return { type: "LineString", coordinates };
}

export function SharedRouteView({ routeId }: { routeId: string }) {
  const [route, setRoute] = useState<SharedRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/routes/share/${encodeURIComponent(routeId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setError(apiErrorMessage(json.error, "找不到此分享路線"));
            setRoute(null);
          }
          return;
        }
        const raw = json.route;
        if (!raw || typeof raw !== "object") {
          if (!cancelled) {
            setError("路線資料格式錯誤");
            setRoute(null);
          }
          return;
        }
        const waypoints = normalizeWaypoints(raw.waypoints);
        const geometry =
          normalizeGeometry(raw.geometry) ??
          (waypoints.length >= 2
            ? {
                type: "LineString" as const,
                coordinates: waypoints.map(
                  (p) => [p.lng, p.lat] as [number, number],
                ),
              }
            : null);
        if (!geometry || waypoints.length < 1) {
          if (!cancelled) {
            setError("此分享路線沒有可用的軌跡資料");
            setRoute(null);
          }
          return;
        }
        if (!cancelled) {
          setRoute({
            id: String(raw.id ?? routeId),
            title: String(raw.title ?? "未命名路線"),
            distance_m: Number(raw.distance_m) || 0,
            geometry,
            waypoints,
            creator_name:
              typeof raw.creator_name === "string" ? raw.creator_name : null,
            created_at: String(raw.created_at ?? ""),
          });
        }
      } catch {
        if (!cancelled) setError("載入失敗，請稍後再試");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const waypoints = useMemo(() => route?.waypoints ?? [], [route]);
  const geometry = route?.geometry ?? null;
  const center = waypoints[0] ?? DEFAULT_CENTER;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-emerald-100/50">
        載入路線中…
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-amber-300">{error ?? "找不到此分享路線"}</p>
        <Link
          href="/routes/plan"
          className="text-sm text-emerald-300 underline-offset-2 hover:underline"
        >
          前往路線規劃
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 pr-14">
        <div className="pointer-events-auto max-w-[calc(100%-0.5rem)] rounded-xl border border-emerald-800/50 bg-[#0c1812]/92 px-3 py-2 shadow-lg backdrop-blur">
          <p className="text-[11px] tracking-wide text-emerald-300/70">
            板橋約跑 · 分享路線
          </p>
          <h1 className="text-lg font-bold text-white">{route.title}</h1>
          <p className="mt-0.5 text-xs text-emerald-100/60">
            {formatKm(metersToKm(route.distance_m))} km
            {route.creator_name ? ` · ${route.creator_name}` : ""}
          </p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <RoutePlannerMap
            key={route.id}
            center={center}
            waypoints={waypoints}
            geometry={geometry}
            readOnly
            fitToRoute
            visible
          />
        </div>
      </div>

      <div className="z-20 border-t border-emerald-900/50 bg-[#0c1812]/98 px-4 py-3">
        <div className="mx-auto flex max-w-lg gap-2">
          <Link
            href="/routes/plan"
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-emerald-800/60 text-sm text-emerald-100"
          >
            自己規劃
          </Link>
          <Link
            href="/"
            className="flex h-11 flex-1 items-center justify-center rounded-lg bg-emerald-400 text-sm font-semibold text-emerald-950"
          >
            看揪團
          </Link>
        </div>
      </div>
    </div>
  );
}
