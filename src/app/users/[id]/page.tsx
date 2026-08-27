"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { apiErrorMessage } from "@/lib/api-errors";
import {
  ActivityHistoryList,
  ActivityStatsGrid,
} from "@/components/ActivityHistory";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR(
    id ? `/api/users/${id}` : null,
    fetcher,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggleFollow() {
    if (busy || !data?.viewer) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/users/${id}/follow`, {
      method: data.viewer.is_following ? "DELETE" : "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(apiErrorMessage(j.error, "追蹤操作失敗"));
      return;
    }
    await mutate();
  }

  async function toggleBlocklist() {
    if (busy || !data?.viewer) return;
    setBusy(true);
    setMsg(null);
    const res = data.viewer.is_blocked
      ? await fetch(`/api/blocklist?blocked_user_id=${id}`, { method: "DELETE" })
      : await fetch("/api/blocklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked_user_id: id }),
        });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(apiErrorMessage(j.error, "黑名單操作失敗"));
      return;
    }
    await mutate();
  }

  if (isLoading) {
    return (
      <main className="px-5 py-10 text-sm text-emerald-100/50">載入中…</main>
    );
  }

  if (!data?.user) {
    return (
      <main className="px-5 py-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-emerald-300/70"
        >
          ← 返回
        </button>
        <p className="mt-6 text-sm text-emerald-100/60">找不到此跑友</p>
      </main>
    );
  }

  const { user, stats, history = [], viewer } = data;

  return (
    <main className="px-5 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-emerald-300/70"
      >
        ← 返回
      </button>

      <div className="mt-6 flex items-center gap-4">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-emerald-800/50" />
        )}
        <div>
          <h1 className="text-xl font-bold text-white">{user.display_name}</h1>
          <p className="text-sm text-emerald-100/50">{user.role_label}</p>
        </div>
      </div>

      {user.pace_label && (
        <p className="mt-4 text-sm text-emerald-100/60">
          配速偏好 {user.pace_label}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-emerald-200/80">活動統計</h2>
        <div className="mt-4">
          <ActivityStatsGrid
            hostCount={stats.host_count}
            joinCount={stats.join_count}
            noShowCount={stats.no_show_count}
          />
        </div>
        <p className="mt-3 text-xs text-emerald-100/35">
          統計僅含已結案活動；跟團不含自己主揪的場次。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-emerald-200/80">活動歷程</h2>
        <div className="mt-4">
          <ActivityHistoryList items={history} />
        </div>
      </section>

      {msg && <p className="mt-4 text-sm text-amber-300">{msg}</p>}

      {!viewer && (
        <div className="mt-8 rounded-lg border border-emerald-800/50 p-4 text-sm text-emerald-100/60">
          <Link href="/login" className="text-emerald-300">
            登入
          </Link>
          後可追蹤跑友或管理黑名單
        </div>
      )}

      {viewer && !viewer.is_self && (
        <div className="mt-8 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleFollow()}
            className="h-11 rounded-lg border border-emerald-500/40 text-emerald-200 disabled:opacity-50"
          >
            {viewer.is_following ? "取消追蹤" : "加入追蹤"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleBlocklist()}
            className="h-11 rounded-lg border border-rose-400/40 text-rose-200 disabled:opacity-50"
          >
            {viewer.is_blocked ? "從黑名單移除" : "加入黑名單"}
          </button>
        </div>
      )}

      {viewer?.is_self && (
        <p className="mt-8 text-sm text-emerald-100/45">這是你自己的個人頁</p>
      )}
    </main>
  );
}
