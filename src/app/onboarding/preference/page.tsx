"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  // 預設 5:00–6:00（對應既有 pace 300–360）
  const [selected, setSelected] = useState<Set<number>>(() => new Set([1, 2]));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 隱藏計算：多選區間取包絡，供 API／推播篩選使用
  const { paceMin, paceMax } = useMemo(() => {
    if (selected.size === 0) return { paceMin: null as number | null, paceMax: null as number | null };
    let min = Infinity;
    let max = -Infinity;
    for (const i of selected) {
      min = Math.min(min, PRESETS[i].min);
      max = Math.max(max, PRESETS[i].max);
    }
    return { paceMin: min, paceMax: max };
  }, [selected]);

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function submit() {
    if (paceMin == null || paceMax == null) {
      setError("請至少選擇一個配速區間");
      return;
    }
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
        可複選多個區間，之後開團推播會依此匹配。單位：分鐘／公里。
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => {
          const active = selected.has(i);
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(i)}
              className={`rounded-md border px-3 py-2 text-sm ${
                active
                  ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                  : "border-emerald-800/60 text-emerald-100/70"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-amber-300">{error}</p>}

      <button
        type="button"
        disabled={loading || paceMin == null}
        onClick={() => void submit()}
        className="mt-10 h-12 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-60"
      >
        {loading ? "儲存中…" : "完成"}
      </button>
    </main>
  );
}
