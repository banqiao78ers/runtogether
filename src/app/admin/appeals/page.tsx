"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminAppealsPage() {
  const { data, mutate } = useSWR("/api/appeals", fetcher);

  async function review(id: string, status: "approved" | "rejected") {
    await fetch("/api/appeals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await mutate();
  }

  return (
    <main className="px-5 py-8">
      <h1 className="text-xl font-bold text-white">停權申訴審核</h1>
      <ul className="mt-6 space-y-4">
        {(data?.appeals ?? []).map(
          (a: {
            id: string;
            reason: string;
            status: string;
            created_at: string;
            user?: { display_name: string };
          }) => (
            <li
              key={a.id}
              className="border-b border-emerald-900/40 pb-4 text-sm text-emerald-100/75"
            >
              <p className="font-medium text-white">
                {a.user?.display_name || "用戶"} · {a.status}
              </p>
              <p className="mt-1 text-emerald-100/50">
                {new Date(a.created_at).toLocaleString("zh-TW")}
              </p>
              <p className="mt-2">{a.reason}</p>
              {a.status === "pending" && (
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void review(a.id, "approved")}
                    className="text-emerald-300"
                  >
                    核准
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(a.id, "rejected")}
                    className="text-rose-300"
                  >
                    駁回
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
    </main>
  );
}
