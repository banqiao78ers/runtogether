"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function BlocklistPage() {
  const { data, mutate } = useSWR("/api/blocklist", fetcher);
  const [userId, setUserId] = useState("");

  async function add() {
    await fetch("/api/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked_user_id: userId }),
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
      <h1 className="text-xl font-bold text-white">主揪黑名單</h1>
      <p className="mt-2 text-sm text-emerald-100/50">
        被列入者無法報名你開的團。請貼上對方使用者 UUID。
      </p>
      <div className="mt-6 flex gap-2">
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="flex-1 rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
          placeholder="對方使用者編號（UUID）"
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
              <span>{b.blocked?.display_name || b.blocked_user_id}</span>
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
      </ul>
    </main>
  );
}
