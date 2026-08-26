"use client";

import Link from "next/link";
import useSWR from "swr";
import { formatDateTime, paceLabel, runListBadge } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type RunRow = {
  id: string;
  start_time: string;
  distance_km: number;
  pace_min: number;
  pace_max: number;
  max_participants: number;
  participant_count: number;
  status: string;
  custom_location: string | null;
  location?: { title: string; district: string } | null;
  host?: { display_name: string } | null;
};

export default function HomePage() {
  const { data, isLoading } = useSWR<{ runs: RunRow[] }>("/api/runs", fetcher, {
    refreshInterval: 15000,
  });

  return (
    <main className="relative flex flex-1 flex-col px-5 pt-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,#2d5a40_0%,transparent_55%),linear-gradient(180deg,#0f1f17,#0c1812)]"
      />
      <header className="mb-8">
        <p className="text-xs font-medium tracking-[0.2em] text-emerald-300/70">
          板橋
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">板橋約跑</h1>
        <p className="mt-2 text-sm text-emerald-100/55">近期揪團 · 先搶先贏</p>
      </header>

      {isLoading && (
        <p className="text-sm text-emerald-100/50">載入中…</p>
      )}

      <ul className="flex flex-col gap-4">
        {(data?.runs ?? []).map((run) => {
          const place =
            run.custom_location ||
            (run.location
              ? `${run.location.district} ${run.location.title}`
              : "地點未定");
          const full = run.participant_count >= run.max_participants;
          return (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="block border-b border-emerald-800/40 pb-4 transition hover:border-emerald-500/50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <time className="text-base font-semibold text-white">
                    {formatDateTime(run.start_time)}
                  </time>
                  <span className="text-xs text-emerald-300/70">
                    {runListBadge(run.status, full)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-emerald-100/80">{place}</p>
                <p className="mt-2 text-xs text-emerald-100/45">
                  {run.distance_km} km · {paceLabel(run.pace_min)}–
                  {paceLabel(run.pace_max)} · {run.participant_count}/
                  {run.max_participants}
                  {run.host?.display_name ? ` · ${run.host.display_name}` : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      {!isLoading && (data?.runs?.length ?? 0) === 0 && (
        <p className="text-sm text-emerald-100/50">目前沒有進行中的揪團，來開一團吧。</p>
      )}
    </main>
  );
}
