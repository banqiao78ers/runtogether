"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  formatDateTime,
  participantsCountLabel,
  runStatusLabel,
} from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_FILTERS = [
  { value: "all", label: "全部" },
  { value: "open", label: "報名中" },
  { value: "delayed", label: "已延期" },
  { value: "ongoing", label: "進行中" },
  { value: "completed", label: "已結案" },
  { value: "cancelled", label: "已取消" },
  { value: "deleted", label: "已軟刪" },
] as const;

type AdminRunRow = {
  id: string;
  status: string;
  start_time: string;
  distance_km: number;
  max_participants: number;
  participant_count: number;
  custom_location: string | null;
  deleted_at: string | null;
  host?: { id: string; display_name: string } | null;
  location?: {
    city: string;
    district: string;
    title: string;
  } | null;
};

export default function AdminRunsPage() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      status,
      page: String(page),
    });
    if (q.trim()) params.set("q", q.trim());
    if (includeDeleted || status === "deleted") {
      params.set("include_deleted", "1");
    }
    return `/api/admin/runs?${params}`;
  }, [status, page, q, includeDeleted]);

  const { data, isLoading } = useSWR(url, fetcher);
  const runs = (data?.runs ?? []) as AdminRunRow[];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">活動管理</h1>
        <Link href="/me" className="text-sm text-emerald-300/70">
          ← 我的
        </Link>
      </div>
      <p className="mt-2 text-sm text-emerald-100/55">
        檢視全站活動；點進可修改時間、地點、狀態與出席等資訊。
      </p>

      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="搜尋主揪、地點、活動 ID"
        className="mt-6 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatus(f.value);
              setPage(1);
              if (f.value === "deleted") setIncludeDeleted(true);
            }}
            className={`rounded-md px-2.5 py-1 text-xs ${
              status === f.value
                ? "bg-emerald-400 text-emerald-950"
                : "border border-emerald-800/60 text-emerald-100/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-xs text-emerald-100/55">
        <input
          type="checkbox"
          checked={includeDeleted}
          onChange={(e) => {
            setIncludeDeleted(e.target.checked);
            setPage(1);
          }}
        />
        包含已軟刪活動
      </label>

      {isLoading ? (
        <p className="mt-8 text-sm text-emerald-100/45">載入中…</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {runs.map((r) => {
            const place =
              r.custom_location ||
              (r.location
                ? `${r.location.district} ${r.location.title}`
                : "—");
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/runs/${r.id}`}
                  className="block rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatDateTime(r.start_time)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-100/60">
                        {place} · {r.distance_km} km ·{" "}
                        {participantsCountLabel(
                          r.participant_count,
                          r.max_participants,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-emerald-100/45">
                        主揪 {r.host?.display_name || "—"}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-emerald-200">
                        {runStatusLabel(r.status)}
                      </span>
                      {r.deleted_at && (
                        <p className="mt-1 text-rose-300/80">已軟刪</p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {runs.length === 0 && (
            <li className="text-sm text-emerald-100/45">沒有符合的活動</li>
          )}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between text-sm text-emerald-100/60">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="disabled:opacity-40"
        >
          上一頁
        </button>
        <span>
          {page} / {totalPages}（共 {total}）
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="disabled:opacity-40"
        >
          下一頁
        </button>
      </div>
    </main>
  );
}
