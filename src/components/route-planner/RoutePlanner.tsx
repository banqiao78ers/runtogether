"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/api-errors";
import { formatKm, metersToKm, remainingLabel } from "@/lib/routing/format";
import { buildGpx, downloadGpx } from "@/lib/routing/gpx";
import {
  DEFAULT_CENTER,
  ROUTE_DRAFT_KEY,
  TARGET_DISTANCES_KM,
  type LatLng,
  type LineStringGeometry,
  type RouteDraft,
} from "@/lib/routing/types";
import { RoutePlannerMap } from "./RoutePlannerMap";

type SearchHit = { id: string; label: string; lat: number; lng: number };
type LocateStatus = "pending" | "granted" | "denied" | "unavailable";

export function RoutePlanner() {
  const router = useRouter();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [flyTo, setFlyTo] = useState<LatLng | null>(null);
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [geometry, setGeometry] = useState<LineStringGeometry | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [targetKm, setTargetKm] = useState<number | null>(5);
  const [targetMode, setTargetMode] = useState<"preset" | "custom">("preset");
  const [customTargetInput, setCustomTargetInput] = useState("");
  const [locateStatus, setLocateStatus] = useState<LocateStatus>("pending");
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const routeAbort = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const distanceKm = metersToKm(distanceM);
  const remain = remainingLabel(distanceKm, targetKm);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocateStatus("unavailable");
      setShowSearch(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(p);
        setFlyTo(p);
        setLocateStatus("granted");
      },
      () => {
        setLocateStatus("denied");
        setShowSearch(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  }, []);

  const fetchRoute = useCallback(async (pts: LatLng[]) => {
    if (pts.length < 2) {
      setGeometry(null);
      setRouteCoords([]);
      setDistanceM(0);
      return;
    }

    routeAbort.current?.abort();
    const ac = new AbortController();
    routeAbort.current = ac;
    setRouting(true);
    setError(null);

    try {
      const res = await fetch("/api/routing/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: pts }),
        signal: ac.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(json.error, "路線計算失敗"));
        setGeometry(null);
        setRouteCoords([]);
        setDistanceM(0);
        return;
      }
      setGeometry(json.geometry);
      setRouteCoords(json.coordinates ?? []);
      setDistanceM(json.distance_m ?? 0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("路線計算失敗，請稍後再試");
    } finally {
      setRouting(false);
    }
  }, []);

  function addWaypoint(point: LatLng) {
    setWaypoints((prev) => {
      const next = [...prev, point];
      void fetchRoute(next);
      return next;
    });
  }

  function undo() {
    setWaypoints((prev) => {
      const next = prev.slice(0, -1);
      void fetchRoute(next);
      return next;
    });
  }

  function clearAll() {
    setWaypoints([]);
    setGeometry(null);
    setRouteCoords([]);
    setDistanceM(0);
    setError(null);
  }

  function runSearch(q: string) {
    setSearchQ(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/geo/search?q=${encodeURIComponent(q.trim())}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(apiErrorMessage(json.error, "搜尋失敗"));
          setSearchHits([]);
          return;
        }
        setSearchHits(json.results ?? []);
      } catch {
        setError("搜尋失敗");
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function selectSearchHit(hit: SearchHit) {
    const p = { lat: hit.lat, lng: hit.lng };
    setCenter(p);
    setFlyTo({ ...p });
    setShowSearch(false);
    setSearchHits([]);
    setSearchQ("");
    if (waypoints.length === 0) {
      addWaypoint(p);
    }
  }

  function exportGpx() {
    const pts = routeCoords.length >= 2 ? routeCoords : waypoints;
    if (pts.length < 2) {
      setError("至少需要兩個點才能匯出 GPX");
      return;
    }
    const gpx = buildGpx(pts, {
      name: "BQ揪跑路線",
      distanceKm,
    });
    downloadGpx(gpx);
  }

  function applyToRun() {
    if (distanceKm <= 0 && waypoints.length < 2) {
      setError("請先規劃路線再套用到開團");
      return;
    }
    const km = distanceKm > 0 ? distanceKm : 0;
    if (km <= 0) {
      setError("距離無效，請重新規劃");
      return;
    }

    const last = waypoints[waypoints.length - 1];
    const destination =
      last != null
        ? `路線終點（${last.lat.toFixed(4)}, ${last.lng.toFixed(4)}）`
        : undefined;

    const draft: RouteDraft = {
      distance_km: km,
      destination,
      waypoint_count: waypoints.length,
    };
    try {
      sessionStorage.setItem(ROUTE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // private mode 等可略過
    }

    const params = new URLSearchParams();
    params.set("distance_km", String(km));
    if (destination) params.set("destination", destination);
    router.push(`/runs/new?${params.toString()}`);
  }

  const locateHint =
    locateStatus === "pending"
      ? "正在取得定位…"
      : locateStatus === "denied"
        ? "已拒絕定位，請搜尋地名"
        : locateStatus === "unavailable"
          ? "此裝置不支援定位，請搜尋地名"
          : null;

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] min-h-[480px] flex-col">
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-white drop-shadow">路線規劃</h1>
            <p className="text-xs text-emerald-100/70 drop-shadow">
              點地圖新增途經點 · 步行貼路
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="rounded-lg border border-emerald-700/50 bg-[#0c1812]/90 px-3 py-2 text-sm text-emerald-100"
          >
            搜尋
          </button>
        </div>

        {(showSearch || locateStatus === "denied" || locateStatus === "unavailable") && (
          <div className="rounded-xl border border-emerald-800/50 bg-[#0c1812]/95 p-2 shadow-lg backdrop-blur">
            <label className="sr-only" htmlFor="geo-search">
              搜尋地名
            </label>
            <input
              id="geo-search"
              value={searchQ}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="搜尋城市、地標…"
              className="w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
              autoComplete="off"
            />
            {searching && (
              <p className="mt-1 px-1 text-xs text-emerald-100/40">搜尋中…</p>
            )}
            {searchHits.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-auto">
                {searchHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => selectSearchHit(hit)}
                      className="w-full rounded-md px-2 py-2 text-left text-sm text-emerald-50 hover:bg-emerald-900/50"
                    >
                      {hit.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {locateHint && !showSearch && locateStatus === "pending" && (
          <p className="rounded-lg bg-[#0c1812]/85 px-3 py-1.5 text-xs text-emerald-100/60">
            {locateHint}
          </p>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <RoutePlannerMap
            center={center}
            waypoints={waypoints}
            geometry={geometry}
            onMapClick={addWaypoint}
            flyTo={flyTo}
          />
        </div>
      </div>

      <div className="z-20 border-t border-emerald-900/50 bg-[#0c1812]/98 px-3 pb-3 pt-2 backdrop-blur">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {TARGET_DISTANCES_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => {
                setTargetMode("preset");
                setTargetKm(km);
                setCustomTargetInput("");
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                targetMode === "preset" && targetKm === km
                  ? "bg-emerald-400 text-emerald-950"
                  : "border border-emerald-800/60 text-emerald-100/70"
              }`}
            >
              {km}K
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTargetMode("custom");
              if (customTargetInput.trim() === "") {
                setTargetKm(null);
              }
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              targetMode === "custom"
                ? "bg-emerald-400 text-emerald-950"
                : "border border-emerald-800/60 text-emerald-100/70"
            }`}
          >
            自行輸入
          </button>
          {targetMode === "custom" && (
            <label className="flex items-center gap-1 text-xs text-emerald-100/70">
              <input
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                value={customTargetInput}
                placeholder="km"
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomTargetInput(raw);
                  const n = Number(raw);
                  if (raw.trim() !== "" && Number.isFinite(n) && n > 0) {
                    setTargetKm(Math.round(n * 10) / 10);
                  } else {
                    setTargetKm(null);
                  }
                }}
                className="w-16 rounded-md border border-emerald-800/60 bg-transparent px-2 py-1 text-sm tabular-nums text-white"
                aria-label="自訂目標距離（公里）"
              />
              <span>km</span>
            </label>
          )}
        </div>

        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tabular-nums text-white">
            {formatKm(distanceKm)}
            <span className="ml-1 text-sm font-medium text-emerald-100/50">km</span>
          </p>
          <div className="text-right text-xs text-emerald-100/55">
            {routing ? <span>計算中…</span> : null}
            {remain ? <p className="text-emerald-300/90">{remain}</p> : null}
            <p>{waypoints.length} 個途經點</p>
          </div>
        </div>

        {error && <p className="mb-2 text-xs text-amber-300">{error}</p>}

        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={waypoints.length === 0}
            className="h-11 rounded-lg border border-emerald-800/60 text-sm text-emerald-100 disabled:opacity-35"
          >
            復原
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={waypoints.length === 0}
            className="h-11 rounded-lg border border-emerald-800/60 text-sm text-emerald-100 disabled:opacity-35"
          >
            清除
          </button>
          <button
            type="button"
            onClick={exportGpx}
            disabled={waypoints.length < 2}
            className="h-11 rounded-lg border border-emerald-800/60 text-sm text-emerald-100 disabled:opacity-35"
          >
            GPX
          </button>
          <button
            type="button"
            onClick={applyToRun}
            disabled={distanceKm <= 0}
            className="h-11 rounded-lg bg-emerald-400 text-sm font-semibold text-emerald-950 disabled:opacity-35"
            title="套用到開團"
          >
            套用
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-emerald-100/35">
          <Link href="/runs/new" className="underline-offset-2 hover:underline">
            直接開團
          </Link>
          {" · "}路網資料來自 OpenStreetMap
        </p>
      </div>
    </div>
  );
}
