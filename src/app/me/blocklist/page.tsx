"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { MemberNameLink } from "@/components/MemberNameLink";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function BlocklistPage() {
  const { data, mutate } = useSWR("/api/blocklist", fetcher);
  const [userId, setUserId] = useState("");

  async function add() {
    if (!userId.trim()) return;
    await fetch("/api/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked_user_id: userId.trim() }),
    });
    setUserId("");
    await mutate();
  }

  async function remove(id: string) {
    await fetch(`/api/blocklist?blocked_user_id=${id}`, { method: "DELETE" });
    await mutate();
  }

  return (
    <main className="px-5 py-8">
      <Link href="/me" className="text-sm text-emerald-300/70">
        ← 我的
      </Link>
      <h1 className="mt-4 text-xl font-bold text-white">我的黑名單</h1>
      <p className="mt-2 text-sm text-emerald-100/50">
        被列入者無法報名你開的團。建議至活動詳情頁點擊跑友姓名，進入個人頁加入黑名單。
      </p>
      <div className="mt-6 flex gap-2">
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="flex-1 rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
          placeholder="進階：使用者 UUID（一般不需填寫）"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="rounded-md bg-emerald-400 px-3 text-sm font-semibold text-emerald-950"
        >
          新增
        </button>
      </div>
      <ul className="mt-8 space-y-3">
        {(data?.blocklist ?? []).map(
          (b: {
            id: string;
            blocked_user_id: string;
            blocked?: { display_name: string };
          }) => (
            <li
              key={b.id}
              className="flex items-center justify-between text-sm text-emerald-100/70"
            >
              <MemberNameLink
                userId={b.blocked_user_id}
                name={b.blocked?.display_name}
              />
              <button
                type="button"
                onClick={() => void remove(b.blocked_user_id)}
                className="text-rose-300/80"
              >
                移除
              </button>
            </li>
          ),
        )}
        {(data?.blocklist ?? []).length === 0 && data && (
          <li className="text-sm text-emerald-100/40">黑名單是空的</li>
        )}
      </ul>
    </main>
  );
}
