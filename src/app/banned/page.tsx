"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function BannedPage() {
  const { data, mutate } = useSWR("/api/appeals", fetcher);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json.error || "送出失敗");
      return;
    }
    setReason("");
    setMsg("申訴已送出，請等候審核");
    await mutate();
  }

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-bold text-white">帳號已停權</h1>
      <p className="mt-3 text-sm text-emerald-100/60">
        因惡意取消累計達門檻，暫時無法開團／報名。可提出申訴供管理員審核。
      </p>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        className="mt-8 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
        placeholder="申訴理由"
      />
      {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        className="mt-4 h-11 w-full rounded-lg bg-emerald-400 font-semibold text-emerald-950"
      >
        送出申訴
      </button>

      <ul className="mt-10 space-y-2 text-sm text-emerald-100/50">
        {(data?.appeals ?? []).map(
          (a: { id: string; status: string; created_at: string }) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString("zh-TW")} · {a.status}
            </li>
          ),
        )}
      </ul>
    </main>
  );
}
