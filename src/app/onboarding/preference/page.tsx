"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  { label: "4:30–5:00", min: 270, max: 300 },
  { label: "5:00–5:30", min: 300, max: 330 },
  { label: "5:30–6:00", min: 330, max: 360 },
  { label: "6:00–6:30", min: 360, max: 390 },
  { label: "6:30–7:00", min: 390, max: 420 },
  { label: "7:00–8:00", min: 420, max: 480 },
];

export default function PreferencePage() {
  const router = useRouter();
  const [paceMin, setPaceMin] = useState(300);
  const [paceMax, setPaceMax] = useState(360);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/me/preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pace_min: paceMin, pace_max: paceMax }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "儲存失敗");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <h1 className="text-2xl font-bold text-white">設定配速偏好</h1>
      <p className="mt-2 text-sm text-emerald-100/60">
        之後開團推播會依此區間匹配。單位：分鐘／公里。
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setPaceMin(p.min);
              setPaceMax(p.max);
            }}
            className={`rounded-md border px-3 py-2 text-sm ${
              paceMin === p.min && paceMax === p.max
                ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                : "border-emerald-800/60 text-emerald-100/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-emerald-100/80">
        <label className="flex flex-col gap-1">
          最快（秒/km）
          <input
            type="number"
            value={paceMin}
            onChange={(e) => setPaceMin(Number(e.target.value))}
            className="rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          最慢（秒/km）
          <input
            type="number"
            value={paceMax}
            onChange={(e) => setPaceMax(Number(e.target.value))}
            className="rounded-md border border-emerald-800/60 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-amber-300">{error}</p>}

      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="mt-10 h-12 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-60"
      >
        {loading ? "儲存中…" : "完成"}
      </button>
    </main>
  );
}
