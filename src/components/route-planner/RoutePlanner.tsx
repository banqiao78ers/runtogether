"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/api-errors";
import { formatKm, metersToKm, remainingLabel } from "@/lib/routing/format";
import { buildGpx, downloadGpx } from "@/lib/routing/gpx";
import { preloadOsmTiles } from "@/lib/routing/preload-tiles";
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

type RouteListItem = {
  id: string;
  title: string;
  distance_m: number;
  is_public?: boolean;
  created_at: string;
};

function shareUrlFor(routeId: string) {
  if (typeof window === "undefined") return `/routes/share/${routeId}`;
  return `${window.location.origin}/routes/share/${routeId}`;
}

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
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [routeTitle, setRouteTitle] = useState("");
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<RouteListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const routeAbort = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const distanceKm = metersToKm(distanceM);
  const remain = remainingLabel(distanceKm, targetKm);

  // 進頁預載預設／定位附近圖磚
  useEffect(() => {
    preloadOsmTiles(DEFAULT_CENTER, { zoom: 14, radius: 1 });
  }, []);

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
        preloadOsmTiles(p, { zoom: 14, radius: 1 });
        preloadOsmTiles(p, { zoom: 15, radius: 1 });
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
    setOkMsg(null);

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
      setSavedRouteId(null);
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
    setSavedRouteId(null);
  }

  function clearAll() {
    setWaypoints([]);
    setGeometry(null);
    setRouteCoords([]);
    setDistanceM(0);
    setError(null);
    setOkMsg(null);
    setSavedRouteId(null);
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
    preloadOsmTiles(p, { zoom: 14, radius: 1 });
    if (waypoints.length === 0) {
      addWaypoint(p);
    }
  }

  function currentGeometry(): LineStringGeometry | null {
    if (geometry && geometry.coordinates.length >= 2) return geometry;
    if (routeCoords.length >= 2) {
      return {
        type: "LineString",
        coordinates: routeCoords.map((p) => [p.lng, p.lat]),
      };
    }
    if (waypoints.length >= 2) {
      return {
        type: "LineString",
        coordinates: waypoints.map((p) => [p.lng, p.lat]),
      };
    }
    return null;
  }

  function exportGpx() {
    const pts = routeCoords.length >= 2 ? routeCoords : waypoints;
    if (pts.length < 2) {
      setError("至少需要兩個點才能匯出 GPX");
      return;
    }
    const gpx = buildGpx(pts, {
      name: routeTitle.trim() || "BQ揪跑路線",
      distanceKm,
    });
    downloadGpx(gpx);
  }

  async function saveRoute() {
    const title = routeTitle.trim();
    if (!title) {
      setError("請先填寫路線名稱");
      return;
    }
    const geom = currentGeometry();
    if (!geom || waypoints.length < 2 || distanceM <= 0) {
      setError("請先完成至少兩點的貼路路線再儲存");
      return;
    }

    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          distance_m: distanceM,
          geometry: geom,
          waypoints,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(json.error, "儲存失敗"));
        return;
      }
      setSavedRouteId(json.route?.id ?? null);
      setOkMsg("路線已儲存");
      if (showHistory) void loadHistory();
    } catch {
      setError("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/routes");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(json.error, "無法載入歷史路線"));
        setHistory([]);
        return;
      }
      setHistory(json.routes ?? []);
    } catch {
      setError("無法載入歷史路線");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistory() {
    const next = !showHistory;
    setShowHistory(next);
    setShowSearch(false);
    if (next) await loadHistory();
  }

  async function loadSavedRoute(id: string) {
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/routes/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(json.error, "無法開啟路線"));
        return;
      }
      const route = json.route as {
        id: string;
        title: string;
        distance_m: number;
        geometry: LineStringGeometry;
        waypoints: LatLng[];
      };
      const wps = Array.isArray(route.waypoints) ? route.waypoints : [];
      setWaypoints(wps);
      setGeometry(route.geometry);
      setRouteCoords(
        (route.geometry?.coordinates ?? []).map(([lng, lat]) => ({
          lat,
          lng,
        })),
      );
      setDistanceM(route.distance_m);
      setRouteTitle(route.title);
      setSavedRouteId(route.id);
      setShowHistory(false);
      if (wps[0]) {
        setCenter(wps[0]);
        setFlyTo({ ...wps[0] });
        preloadOsmTiles(wps[0], { zoom: 14, radius: 1 });
      }
      setOkMsg(`已載入「${route.title}」`);
    } catch {
      setError("無法開啟路線");
    }
  }

  async function deleteSavedRoute(id: string) {
    if (!confirm("確定刪除此路線？")) return;
    try {
      const res = await fetch(`/api/routes/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(json.error, "刪除失敗"));
        return;
      }
      if (savedRouteId === id) setSavedRouteId(null);
      await loadHistory();
    } catch {
      setError("刪除失敗");
    }
  }

  async function publishAndGetShareUrl(existingId?: string | null) {
    const title = routeTitle.trim();
    if (!title) {
      setError("分享前請先填寫路線名稱");
      return null;
    }
    const geom = currentGeometry();
    if (!geom || waypoints.length < 2 || distanceM <= 0) {
      setError("請先完成至少兩點的貼路路線再分享");
      return null;
    }

    if (existingId) {
      const res = await fetch(`/api/routes/${existingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: true, title }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(json.error, "無法產生分享連結"));
        return null;
      }
      setSavedRouteId(existingId);
      return shareUrlFor(existingId);
    }

    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        distance_m: distanceM,
        geometry: geom,
        waypoints,
        is_public: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiErrorMessage(json.error, "無法產生分享連結"));
      return null;
    }
    const id = json.route?.id as string | undefined;
    if (!id) {
      setError("無法產生分享連結");
      return null;
    }
    setSavedRouteId(id);
    return shareUrlFor(id);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    }
  }

  async function shareRoute(fromHistoryId?: string) {
    setSharing(true);
    setError(null);
    setOkMsg(null);
    try {
      const id = fromHistoryId ?? savedRouteId;
      // 從歷史分享時若與當前編輯不是同一條，直接公開該 id
      let url: string | null = null;
      if (fromHistoryId) {
        const res = await fetch(`/api/routes/${fromHistoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_public: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(apiErrorMessage(json.error, "無法產生分享連結"));
          return;
        }
        url = shareUrlFor(fromHistoryId);
      } else {
        url = await publishAndGetShareUrl(id);
      }
      if (!url) return;

      const title = routeTitle.trim() || "板橋約跑路線";
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title,
            text: `${title} · 板橋約跑路線地圖`,
            url,
          });
          setOkMsg("已開啟分享");
          if (showHistory) void loadHistory();
          return;
        } catch (err) {
          // 使用者取消分享 → 仍提供複製
          if (err instanceof DOMException && err.name === "AbortError") {
            setOkMsg("已取消分享");
            return;
          }
        }
      }

      const copied = await copyText(url);
      setOkMsg(copied ? "分享連結已複製" : `分享連結：${url}`);
      if (showHistory) void loadHistory();
    } catch {
      setError("分享失敗，請稍後再試");
    } finally {
      setSharing(false);
    }
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
      route_id: savedRouteId ?? undefined,
      title: routeTitle.trim() || undefined,
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pr-14">
        <div className="pointer-events-auto max-w-[calc(100%-0.5rem)]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-white drop-shadow">路線規劃</h1>
            <button
              type="button"
              onClick={() => {
                setShowSearch((v) => !v);
                setShowHistory(false);
              }}
              className="rounded-md border border-emerald-700/50 bg-[#0c1812]/90 px-2.5 py-1 text-xs text-emerald-100"
            >
              搜尋
            </button>
            <button
              type="button"
              onClick={() => void openHistory()}
              className="rounded-md border border-emerald-700/50 bg-[#0c1812]/90 px-2.5 py-1 text-xs text-emerald-100"
            >
              歷史
            </button>
          </div>
          <p className="mt-0.5 text-xs text-emerald-100/70 drop-shadow">
            {waypoints.length === 0
              ? "點地圖設定起點（不必是目前 GPS 位置）"
              : waypoints.length === 1
                ? "再點下一點，計算貼路路線"
                : "可持續加點 · 步行貼路"}
          </p>
        </div>

        {(showSearch || locateStatus === "denied" || locateStatus === "unavailable") && (
          <div className="pointer-events-auto mr-1 rounded-xl border border-emerald-800/50 bg-[#0c1812]/95 p-2 shadow-lg backdrop-blur">
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

        {showHistory && (
          <div className="pointer-events-auto mr-1 max-h-56 overflow-auto rounded-xl border border-emerald-800/50 bg-[#0c1812]/95 p-2 shadow-lg backdrop-blur">
            <p className="px-1 pb-1 text-xs font-medium text-emerald-200/80">
              我的路線
            </p>
            {historyLoading && (
              <p className="px-1 text-xs text-emerald-100/40">載入中…</p>
            )}
            {!historyLoading && history.length === 0 && (
              <p className="px-1 text-xs text-emerald-100/40">尚無儲存的路線</p>
            )}
            <ul className="space-y-1">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-emerald-900/40"
                >
                  <button
                    type="button"
                    onClick={() => void loadSavedRoute(r.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm text-emerald-50">
                      {r.title}
                    </span>
                    <span className="text-[11px] text-emerald-100/45">
                      {formatKm(metersToKm(r.distance_m))} km ·{" "}
                      {new Date(r.created_at).toLocaleDateString("zh-TW")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareRoute(r.id)}
                    className="shrink-0 text-xs text-emerald-300/80"
                  >
                    分享
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSavedRoute(r.id)}
                    className="shrink-0 text-xs text-amber-200/70"
                  >
                    刪
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {locateHint && !showSearch && locateStatus === "pending" && (
          <p className="pointer-events-auto w-fit rounded-lg bg-[#0c1812]/85 px-3 py-1.5 text-xs text-emerald-100/60">
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
        <label className="mb-2 flex items-center gap-2 text-xs text-emerald-100/70">
          <span className="shrink-0">名稱</span>
          <input
            value={routeTitle}
            onChange={(e) => setRouteTitle(e.target.value)}
            maxLength={100}
            placeholder="例：板橋河濱 10K"
            className="min-w-0 flex-1 rounded-md border border-emerald-800/60 bg-transparent px-2 py-1.5 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => void saveRoute()}
            disabled={saving || waypoints.length < 2 || distanceM <= 0}
            className="shrink-0 rounded-md bg-emerald-500/90 px-2.5 py-1.5 text-xs font-semibold text-emerald-950 disabled:opacity-35"
          >
            {saving ? "…" : "儲存"}
          </button>
        </label>

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
        {okMsg && <p className="mb-2 text-xs text-emerald-300">{okMsg}</p>}

        <div className="grid grid-cols-5 gap-1.5">
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
            onClick={() => void shareRoute()}
            disabled={sharing || waypoints.length < 2 || distanceM <= 0}
            className="h-11 rounded-lg border border-emerald-800/60 text-sm text-emerald-100 disabled:opacity-35"
            title="產生公開地圖連結"
          >
            {sharing ? "…" : "分享"}
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
