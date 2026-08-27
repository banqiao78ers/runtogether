"use client";

import Link from "next/link";
import useSWR from "swr";
import { MemberNameLink } from "@/components/MemberNameLink";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function FollowsPage() {
  const { data, mutate } = useSWR("/api/follows", fetcher);

  async function unfollow(userId: string) {
    await fetch(`/api/users/${userId}/follow`, { method: "DELETE" });
    await mutate();
  }

  return (
    <main className="px-5 py-8">
      <Link href="/me" className="text-sm text-emerald-300/70">
        ← 我的
      </Link>
      <h1 className="mt-4 text-xl font-bold text-white">我的追蹤</h1>
      <p className="mt-2 text-sm text-emerald-100/50">
        追蹤的跑友開團時，你會優先收到推播（略過配速過濾）。也可在活動詳情頁點擊跑友姓名，進入個人頁加入追蹤。
      </p>
      <ul className="mt-8 space-y-3">
        {(data?.follows ?? []).map(
          (f: {
            id: string;
            host_id: string;
            user?: { display_name: string };
          }) => (
            <li
              key={f.id}
              className="flex items-center justify-between text-sm text-emerald-100/70"
            >
              <MemberNameLink
                userId={f.host_id}
                name={f.user?.display_name}
              />
              <button
                type="button"
                onClick={() => void unfollow(f.host_id)}
                className="text-emerald-300/80"
              >
                取消追蹤
              </button>
            </li>
          ),
        )}
        {(data?.follows ?? []).length === 0 && data && (
          <li className="text-sm text-emerald-100/40">尚未追蹤任何跑友</li>
        )}
      </ul>
    </main>
  );
}
