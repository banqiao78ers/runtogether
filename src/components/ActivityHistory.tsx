import Link from "next/link";
import { formatDateTime, runStatusLabel } from "@/lib/format";

export type HistoryRow = {
  run_id: string;
  start_time: string;
  distance_km: number;
  status: string;
  role: "host" | "join" | "no_show";
  place: string;
};

const ROLE_ZH: Record<HistoryRow["role"], string> = {
  host: "主揪",
  join: "跟團",
  no_show: "缺席",
};

export function ActivityHistoryList({
  items,
  emptyText = "尚無活動紀錄",
}: {
  items: HistoryRow[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-emerald-100/40">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.run_id}>
          <Link
            href={`/runs/${item.run_id}`}
            className="block rounded-lg border border-emerald-800/50 bg-emerald-950/25 px-3 py-3 transition hover:border-emerald-600/50 hover:bg-emerald-900/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-white">
                {formatDateTime(item.start_time)}
              </span>
              <span
                className={`shrink-0 text-xs ${
                  item.role === "no_show"
                    ? "text-rose-300/80"
                    : item.role === "host"
                      ? "text-amber-200/80"
                      : "text-emerald-300/80"
                }`}
              >
                {ROLE_ZH[item.role]}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-emerald-100/65">
              {item.place} · {item.distance_km} km
            </p>
            <p className="mt-0.5 text-xs text-emerald-100/40">
              {runStatusLabel(item.status)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ActivityStatsGrid({
  hostCount,
  joinCount,
  noShowCount,
}: {
  hostCount: number;
  joinCount: number;
  noShowCount: number;
}) {
  return (
    <dl className="grid grid-cols-3 gap-3 text-center">
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-4">
        <dt className="text-xs text-emerald-100/40">主揪</dt>
        <dd className="mt-1 text-2xl font-bold text-white">{hostCount}</dd>
        <dd className="text-xs text-emerald-100/45">次</dd>
      </div>
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-4">
        <dt className="text-xs text-emerald-100/40">跟團</dt>
        <dd className="mt-1 text-2xl font-bold text-white">{joinCount}</dd>
        <dd className="text-xs text-emerald-100/45">次</dd>
      </div>
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-4">
        <dt className="text-xs text-emerald-100/40">缺席</dt>
        <dd className="mt-1 text-2xl font-bold text-white">{noShowCount}</dd>
        <dd className="text-xs text-emerald-100/45">次</dd>
      </div>
    </dl>
  );
}
