"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { PaceSelect } from "@/components/PaceSelect";
import { canUseCustomLocation } from "@/lib/rbac";
import { apiErrorMessage } from "@/lib/api-errors";
import { snapPaceToStep } from "@/lib/format";
import type { PwaLocation, UserRole } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function NewRunPage() {
  const router = useRouter();
  const { data: meData } = useSWR("/api/auth/me", fetcher);
  const { data: locData } = useSWR<{ locations: PwaLocation[] }>(
    "/api/locations",
    fetcher,
  );
  const role = (meData?.role || "member") as UserRole;
  const allowCustom = canUseCustomLocation(role);

  const [locationId, setLocationId] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [destination, setDestination] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(60);
  const [distance, setDistance] = useState(10);
  const [paceMin, setPaceMin] = useState(300);
  const [paceMax, setPaceMax] = useState(360);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (meData?.pace_min && meData?.pace_max) {
      setPaceMin(snapPaceToStep(meData.pace_min));
      setPaceMax(snapPaceToStep(meData.pace_max));
    }
  }, [meData]);

  const banqiaoLocations = (locData?.locations ?? []).filter(
    (l) => l.district === "\u677f\u6a4b\u5340" || allowCustom,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (paceMin > paceMax) {
      setError("配速區間無效：較快端應 ≤ 較慢端（例：5分00秒–6分00秒）");
      return;
    }
    setLoading(true);
    setError(null);

    const start = new Date(startLocal);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: locationId || null,
        custom_location: allowCustom ? customLocation || null : null,
        location_detail: locationDetail || null,
        destination: destination || null,
        start_time: start.toISOString(),
        estimated_duration_minutes: duration,
        distance_km: distance,
        pace_min: paceMin,
        pace_max: paceMax,
        max_participants: maxParticipants,
        note: note || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(apiErrorMessage(json.error, "開團失敗"));
      return;
    }
    router.push(`/runs/${json.run.id}`);
  }

  return (
    <main className="px-5 py-8">
      <h1 className="text-2xl font-bold text-white">開團</h1>
      <p className="mt-1 text-sm text-emerald-100/55">
        {allowCustom
          ? "可選固定點或自訂全台地點"
          : "一般會員僅能選擇板橋區固定集合點"}
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-6 flex flex-col gap-4">
        <label className="text-sm text-emerald-100/80">
          集合點
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-[#0c1812] px-3 py-2"
            required={!allowCustom}
          >
            <option value="">請選擇</option>
            {banqiaoLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.district} · {l.title}
              </option>
            ))}
          </select>
        </label>

        {allowCustom && (
          <label className="text-sm text-emerald-100/80">
            自訂地點（選填）
            <input
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
              placeholder="例：大安森林公園正門"
            />
          </label>
        )}

        <label className="text-sm text-emerald-100/80">
          集合備註
          <input
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            placeholder="例：3號出口石獅子前"
          />
        </label>

        <label className="text-sm text-emerald-100/80">
          終點／折返
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>

        <label className="text-sm text-emerald-100/80">
          集合時間
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-emerald-100/80">
            預估分鐘
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm text-emerald-100/80">
            距離 km
            <input
              type="number"
              step="0.1"
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PaceSelect
            label="配速下限（較快）"
            value={paceMin}
            onChange={setPaceMin}
          />
          <PaceSelect
            label="配速上限（較慢）"
            value={paceMax}
            onChange={setPaceMax}
          />
        </div>
        <p className="text-xs text-emerald-100/40">
          單位：分秒／公里；秒僅可選 00／15／30
        </p>

        <label className="text-sm text-emerald-100/80">
          名額
          <input
            type="number"
            min={2}
            max={50}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>

        <label className="text-sm text-emerald-100/80">
          備註
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-amber-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-12 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-60"
        >
          {loading ? "建立中…" : "建立揪團"}
        </button>
      </form>
    </main>
  );
}
