"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { PaceSelect } from "@/components/PaceSelect";
import { apiErrorMessage } from "@/lib/api-errors";
import {
  participantStatusLabel,
  runStatusLabel,
  snapPaceToStep,
  taipeiDatetimeLocalToIso,
  toTaipeiDatetimeLocal,
  UNLIMITED_PARTICIPANTS,
} from "@/lib/format";
import type {
  ParticipantStatus,
  PwaLocation,
  RunStatus,
} from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CAPACITY_OPTIONS = [
  UNLIMITED_PARTICIPANTS,
  ...Array.from({ length: 49 }, (_, i) => i + 2),
];

const RUN_STATUS_OPTIONS: RunStatus[] = [
  "open",
  "delayed",
  "ongoing",
  "completed",
  "cancelled",
];

const PARTICIPANT_OPTIONS: ParticipantStatus[] = [
  "registered",
  "arrived",
  "attended",
  "no_show",
  "cancelled",
];

type ParticipantRow = {
  id: string;
  user_id: string;
  status: ParticipantStatus;
  user?: { display_name: string };
};

export default function AdminRunEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data, mutate, isLoading } = useSWR(
    id ? `/api/admin/runs/${id}` : null,
    fetcher,
  );
  const { data: locData } = useSWR<{ locations: PwaLocation[] }>(
    "/api/locations",
    fetcher,
  );

  const [locationId, setLocationId] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [destination, setDestination] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(60);
  const [distance, setDistance] = useState(10);
  const [paceMin, setPaceMin] = useState(300);
  const [paceMax, setPaceMax] = useState(360);
  const [maxParticipants, setMaxParticipants] = useState(UNLIMITED_PARTICIPANTS);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<RunStatus>("open");
  const [cancelReason, setCancelReason] = useState("");
  const [delayCount, setDelayCount] = useState(0);
  const [totalDelayed, setTotalDelayed] = useState(0);
  const [partStatus, setPartStatus] = useState<Record<string, ParticipantStatus>>(
    {},
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const run = data?.run;
  const participants = (data?.participants ?? []) as ParticipantRow[];

  useEffect(() => {
    if (!run) return;
    setLocationId(run.location_id ?? "");
    setCustomLocation(run.custom_location ?? "");
    setLocationDetail(run.location_detail ?? "");
    setDestination(run.destination ?? "");
    setStartLocal(toTaipeiDatetimeLocal(run.start_time));
    setDuration(run.estimated_duration_minutes ?? 60);
    setDistance(Number(run.distance_km) || 10);
    setPaceMin(snapPaceToStep(run.pace_min));
    setPaceMax(snapPaceToStep(run.pace_max));
    setMaxParticipants(run.max_participants ?? UNLIMITED_PARTICIPANTS);
    setNote(run.note ?? "");
    setStatus(run.status);
    setCancelReason(run.cancel_reason ?? "");
    setDelayCount(run.delay_count ?? 0);
    setTotalDelayed(run.total_delayed_minutes ?? 0);
  }, [run]);

  useEffect(() => {
    const next: Record<string, ParticipantStatus> = {};
    for (const p of participants) {
      next[p.user_id] = p.status;
    }
    setPartStatus(next);
  }, [data?.participants]);

  async function save() {
    if (!id || saving) return;
    if (paceMin > paceMax) {
      setMsg("配速區間無效");
      return;
    }
    setSaving(true);
    setMsg(null);

    const participantChanges = participants
      .filter((p) => partStatus[p.user_id] && partStatus[p.user_id] !== p.status)
      .map((p) => ({
        user_id: p.user_id,
        status: partStatus[p.user_id],
      }));

    const res = await fetch(`/api/admin/runs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: locationId || null,
        custom_location: customLocation || null,
        location_detail: locationDetail || null,
        destination: destination || null,
        start_time: taipeiDatetimeLocalToIso(startLocal),
        estimated_duration_minutes: duration,
        distance_km: distance,
        pace_min: paceMin,
        pace_max: paceMax,
        max_participants: maxParticipants,
        note: note || null,
        status,
        cancel_reason: cancelReason || null,
        delay_count: delayCount,
        total_delayed_minutes: totalDelayed,
        participants: participantChanges,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(apiErrorMessage(json.error, "儲存失敗"));
      return;
    }
    await mutate(json, false);
    setMsg("已儲存");
  }

  async function setDeleted(deleted: boolean) {
    if (!id || saving) return;
    const ok = window.confirm(
      deleted ? "確定軟刪除此活動？" : "確定還原此活動？",
    );
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/runs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(apiErrorMessage(json.error, "操作失敗"));
      return;
    }
    await mutate(json, false);
    setMsg(deleted ? "已軟刪除" : "已還原");
  }

  if (isLoading || !run) {
    return (
      <main className="px-5 py-10 text-sm text-emerald-100/50">載入中…</main>
    );
  }

  return (
    <main className="px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/runs" className="text-sm text-emerald-300/70">
          ← 活動列表
        </Link>
        <Link href={`/runs/${id}`} className="text-sm text-emerald-300/70">
          前台詳情 →
        </Link>
      </div>

      <h1 className="mt-4 text-xl font-bold text-white">編輯活動</h1>
      <p className="mt-1 text-xs text-emerald-100/45">
        主揪 {run.host?.display_name || "—"} · ID {run.id}
        {run.deleted_at ? " · 已軟刪" : ""}
      </p>

      {msg && (
        <p className="mt-4 text-sm text-amber-200/90" role="status">
          {msg}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <label className="text-sm text-emerald-100/80">
          狀態
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RunStatus)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-[#0c1812] px-3 py-2"
          >
            {RUN_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {runStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-emerald-100/80">
          集合時間（台北）
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>

        <label className="text-sm text-emerald-100/80">
          固定集合點
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-[#0c1812] px-3 py-2"
          >
            <option value="">（無／改用自訂）</option>
            {(locData?.locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.city}
                {l.district} · {l.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-emerald-100/80">
          自訂地點
          <input
            value={customLocation}
            onChange={(e) => setCustomLocation(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>

        <label className="text-sm text-emerald-100/80">
          集合備註
          <input
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
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

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-emerald-100/80">
            預估分鐘
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm text-emerald-100/80">
            距離 km
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            />
          </label>
        </div>

        <PaceSelect
          label="較快配速"
          value={paceMin}
          onChange={setPaceMin}
        />
        <PaceSelect
          label="較慢配速"
          value={paceMax}
          onChange={setPaceMax}
        />

        <label className="text-sm text-emerald-100/80">
          名額
          <select
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-[#0c1812] px-3 py-2"
          >
            {CAPACITY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n >= UNLIMITED_PARTICIPANTS ? "不限制" : `${n} 人`}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-emerald-100/80">
            延期次數
            <input
              type="number"
              min={0}
              max={2}
              value={delayCount}
              onChange={(e) => setDelayCount(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm text-emerald-100/80">
            累計延期分
            <input
              type="number"
              min={0}
              max={60}
              value={totalDelayed}
              onChange={(e) => setTotalDelayed(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
            />
          </label>
        </div>

        <label className="text-sm text-emerald-100/80">
          取消原因
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
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
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-emerald-200/80">
          報名／出席（{participants.length}）
        </h2>
        <ul className="mt-3 space-y-3">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 border-b border-emerald-900/40 pb-2 text-sm"
            >
              <span className="text-emerald-100/80">
                {p.user?.display_name || "跑友"}
              </span>
              <select
                value={partStatus[p.user_id] ?? p.status}
                onChange={(e) =>
                  setPartStatus((prev) => ({
                    ...prev,
                    [p.user_id]: e.target.value as ParticipantStatus,
                  }))
                }
                className="rounded border border-emerald-800/60 bg-[#0c1812] px-2 py-1 text-xs"
              >
                {PARTICIPANT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {participantStatusLabel(s)}
                  </option>
                ))}
              </select>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="text-sm text-emerald-100/45">尚無報名者</li>
          )}
        </ul>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="h-11 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-50"
        >
          {saving ? "儲存中…" : "儲存變更"}
        </button>
        {run.deleted_at ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void setDeleted(false)}
            className="h-11 text-sm text-emerald-200"
          >
            還原軟刪除
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void setDeleted(true)}
            className="h-11 text-sm text-rose-300/80"
          >
            軟刪除此活動
          </button>
        )}
      </div>
    </main>
  );
}
