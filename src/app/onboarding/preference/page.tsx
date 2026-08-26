"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { PushRegister } from "@/components/PushRegister";
import { InstallApp } from "@/components/InstallApp";
import { PaceSelect } from "@/components/PaceSelect";
import { apiErrorMessage } from "@/lib/api-errors";
import { snapPaceToStep } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PreferencePage() {
  const router = useRouter();
  const { data: meData } = useSWR("/api/auth/me", fetcher);
  const [paceMin, setPaceMin] = useState(300);
  const [paceMax, setPaceMax] = useState(360);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"form" | "push">("form");

  useEffect(() => {
    if (meData?.pace_min != null && meData?.pace_max != null) {
      setPaceMin(snapPaceToStep(meData.pace_min));
      setPaceMax(snapPaceToStep(meData.pace_max));
    }
  }, [meData]);

  async function submit() {
    if (paceMin > paceMax) {
      setError("配速區間無效：較快端應 ≤ 較慢端（例：5分00秒–6分00秒）");
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
      setError(apiErrorMessage(j.error, "儲存失敗"));
      return;
    }
    setPhase("push");
  }

  function finish() {
    router.replace("/");
    router.refresh();
  }

  if (phase === "push") {
    return (
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-6">
          <p className="text-xs font-medium tracking-wide text-emerald-300/80">
            步驟 2／2
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">配速已儲存</h1>
          <p className="mt-3 text-sm leading-relaxed text-emerald-100/75">
            接下來請<strong className="text-emerald-100">開啟推播通知</strong>
            ，才收得到符合你配速的開團提醒。多數人會漏這一步，所以請現在設定。
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <InstallApp />
          <PushRegister />
        </div>

        <button
          type="button"
          onClick={finish}
          className="mt-8 h-12 rounded-lg border border-emerald-700/60 text-emerald-100/70"
        >
          稍後再設定，先進首頁
        </button>
        <button
          type="button"
          onClick={finish}
          className="mt-3 h-12 rounded-lg bg-emerald-400 font-semibold text-emerald-950"
        >
          已完成推播設定
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <p className="text-xs font-medium tracking-wide text-emerald-300/80">
        步驟 1／2
      </p>
      <h1 className="mt-2 text-2xl font-bold text-white">設定配速偏好</h1>
      <p className="mt-2 text-sm text-emerald-100/60">
        選擇你常跑的配速區間，之後開團推播會依此匹配。
      </p>
      <p className="mt-3 rounded-md bg-emerald-950/50 px-3 py-2 text-xs text-emerald-100/55">
        儲存配速後，下一步會引導你開啟推播通知。
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PaceSelect
          label="配速下限（較快）"
          value={paceMin}
          onChange={setPaceMin}
        />
        <PaceSelect
          label="配速上限（較慢）"
          value={paceMax}
          onChange={setPaceMax}
        />
      </div>
      <p className="mt-2 text-xs text-emerald-100/40">
        單位：分秒／公里；秒僅可選 00／15／30
      </p>

      {error && <p className="mt-4 text-sm text-amber-300">{error}</p>}

      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="mt-10 h-12 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-60"
      >
        {loading ? "儲存中…" : "下一步：設定推播"}
      </button>
    </main>
  );
}
