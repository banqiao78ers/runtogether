"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiErrorMessage } from "@/lib/api-errors";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminPushPage() {
  const { data, mutate } = useSWR("/api/admin/push/broadcast", fetcher);
  const [title, setTitle] = useState("板橋約跑測試推播");
  const [body, setBody] = useState("這是一則管理員測試通知，若你看到代表推播正常。");
  const [loading, setLoading] = useState<"self" | "all" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(scope: "self" | "all") {
    setLoading(scope);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/push/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, url: "/", scope }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(
        apiErrorMessage(json.error, "發送失敗") +
          (json.reason ? `（${json.reason}）` : ""),
      );
      return;
    }
    setResult(
      scope === "self"
        ? `已嘗試推播給你：成功 ${json.sent}、失敗 ${json.failed}、過期 ${json.expired}`
        : `全站：共 ${json.total} 人訂閱，成功 ${json.sent}、失敗 ${json.failed}、過期 ${json.expired}`,
    );
    if (json.errors?.length) {
      setResult((prev) => `${prev}\n範例錯誤：${json.errors.join("；")}`);
    }
    await mutate();
  }

  return (
    <main className="px-5 py-8">
      <h1 className="text-xl font-bold text-white">推播測試（管理員）</h1>
      <p className="mt-2 text-sm text-emerald-100/55">
        用來確認 VAPID 金鑰與使用者訂閱是否正常。請先在「我的」開啟推播再測「只推給我」。
      </p>

      <dl className="mt-6 space-y-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-emerald-100/50">已訂閱推播人數</dt>
          <dd className="text-emerald-100">{data?.subscribers ?? "…"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-emerald-100/50">伺服器 VAPID</dt>
          <dd className={data?.vapid_ok ? "text-emerald-300" : "text-amber-300"}>
            {data?.vapid_ok ? "正常" : data?.vapid_reason || "檢查中…"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-emerald-100/50">你的推播訂閱</dt>
          <dd className={data?.me_has_push ? "text-emerald-300" : "text-amber-300"}>
            {data?.me_has_push ? "已開啟" : "未開啟"}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-3">
        <label className="text-sm text-emerald-100/80">
          標題
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm text-emerald-100/80">
          內文
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 text-sm text-amber-300" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-emerald-200">
          {result}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void send("self")}
          className="h-11 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-50"
        >
          {loading === "self" ? "發送中…" : "只推播給我（測試）"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void send("all")}
          className="h-11 rounded-lg border border-amber-400/50 text-amber-200 disabled:opacity-50"
        >
          {loading === "all" ? "發送中…" : "全站推播（所有已訂閱者）"}
        </button>
      </div>
    </main>
  );
}
