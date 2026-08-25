"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminLocationsPage() {
  const { data, mutate } = useSWR("/api/locations", fetcher);
  const [title, setTitle] = useState("");
  const [district, setDistrict] = useState("板橋區");
  const [city, setCity] = useState("新北市");

  async function create() {
    await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, district, city }),
    });
    setTitle("");
    await mutate();
  }

  async function deactivate(id: string) {
    await fetch(`/api/locations?id=${id}`, { method: "DELETE" });
    await mutate();
  }

  return (
    <main className="px-5 py-8">
      <h1 className="text-xl font-bold text-white">集合點管理</h1>
      <div className="mt-6 flex flex-col gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
          placeholder="縣市"
        />
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
          placeholder="行政區"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
          placeholder="名稱"
        />
        <button
          type="button"
          onClick={() => void create()}
          className="h-10 rounded-lg bg-emerald-400 font-semibold text-emerald-950"
        >
          新增
        </button>
      </div>
      <ul className="mt-8 space-y-3">
        {(data?.locations ?? []).map(
          (l: { id: string; city: string; district: string; title: string }) => (
            <li
              key={l.id}
              className="flex items-center justify-between text-sm text-emerald-100/70"
            >
              <span>
                {l.city}
                {l.district} {l.title}
              </span>
              <button
                type="button"
                onClick={() => void deactivate(l.id)}
                className="text-rose-300/80"
              >
                停用
              </button>
            </li>
          ),
        )}
      </ul>
    </main>
  );
}
