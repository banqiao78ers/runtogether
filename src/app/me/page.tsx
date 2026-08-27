"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { PushRegister } from "@/components/PushRegister";
import { InstallApp } from "@/components/InstallApp";
import {
  ActivityHistoryList,
  ActivityStatsGrid,
} from "@/components/ActivityHistory";
import { paceLabel, roleLabel } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MePage() {
  const router = useRouter();
  const { data, error } = useSWR("/api/auth/me", fetcher);
  const { data: profile } = useSWR(
    data?.id ? `/api/users/${data.id}` : null,
    fetcher,
  );

  if (error || data?.error === "UNAUTHORIZED") {
    return (
      <main className="px-5 py-10">
        <p className="text-emerald-100/60">請先登入</p>
        <Link href="/login" className="mt-4 inline-block text-emerald-300">
          前往登入
        </Link>
      </main>
    );
  }

  if (!data) {
    return <main className="px-5 py-10 text-emerald-100/50">載入中…</main>;
  }

  const stats = profile?.stats;
  const history = profile?.history ?? [];

  return (
    <main className="px-5 py-8">
      <div className="flex items-center gap-4">
        {data.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatar_url}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-emerald-800/50" />
        )}
        <div>
          <h1 className="text-xl font-bold text-white">{data.display_name}</h1>
          <p className="text-sm text-emerald-100/50">{roleLabel(data.role)}</p>
        </div>
      </div>

      <dl className="mt-8 space-y-3 text-sm text-emerald-100/70">
        <div>
          <dt className="text-emerald-100/40">配速偏好</dt>
          <dd>
            {data.pace_min != null && data.pace_max != null
              ? `${paceLabel(data.pace_min)} – ${paceLabel(data.pace_max)}`
              : "未設定"}
          </dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-emerald-200/80">活動統計</h2>
        <div className="mt-4">
          {stats ? (
            <ActivityStatsGrid
              hostCount={stats.host_count}
              joinCount={stats.join_count}
              noShowCount={stats.no_show_count}
            />
          ) : (
            <p className="text-sm text-emerald-100/40">載入中…</p>
          )}
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

      <div className="mt-8 space-y-4">
        <InstallApp />
        <PushRegister />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3">
        {(
          [
            {
              href: "/onboarding/preference",
              label: "修改配速偏好",
              tone: "border-emerald-400/50 bg-emerald-400/20 text-emerald-50",
            },
            {
              href: "/me/follows",
              label: "我的追蹤",
              tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
            },
            {
              href: "/me/blocklist",
              label: "我的黑名單",
              tone: "border-emerald-700/50 bg-emerald-900/40 text-emerald-100/85",
            },
            ...(data.role === "admin"
              ? [
                  {
                    href: "/admin/users",
                    label: "管理會員角色",
                    tone: "border-emerald-300/45 bg-emerald-300/18 text-emerald-50",
                  },
                  {
                    href: "/admin/locations",
                    label: "管理集合點",
                    tone: "border-emerald-600/45 bg-emerald-800/35 text-emerald-100",
                  },
                  {
                    href: "/admin/appeals",
                    label: "審核停權申訴",
                    tone: "border-emerald-500/35 bg-emerald-950/50 text-emerald-200/90",
                  },
                  {
                    href: "/admin/push",
                    label: "推播測試",
                    tone: "border-emerald-400/40 bg-emerald-600/20 text-emerald-100",
                  },
                ]
              : []),
          ] as { href: string; label: string; tone: string }[]
        ).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex aspect-square items-center justify-center rounded-xl border px-3 text-center text-sm font-medium leading-snug ${item.tone}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <button
        type="button"
        className="mt-8 w-full rounded-xl border border-emerald-900/60 py-3 text-sm text-emerald-100/45"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        }}
      >
        登出
      </button>
    </main>
  );
}
