"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage } from "@/lib/api-errors";

export default function RegisterForm({ token }: { token: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirect?: string;
      };
      if (!res.ok) {
        setError(apiErrorMessage(data.error, "註冊失敗，請再試一次"));
        return;
      }
      router.replace(data.redirect || "/onboarding/preference");
      router.refresh();
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
      <label className="block text-sm text-emerald-100/80">
        LINE 群內顯示名稱
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
          required
          autoFocus
          placeholder="請與群內暱稱一致，方便辨識"
          className="mt-2 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-emerald-100/35"
        />
      </label>
      {error && (
        <p className="text-sm text-amber-300/90" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !displayName.trim()}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-emerald-500 px-6 text-sm font-semibold text-[#0c1812] disabled:opacity-50"
      >
        {pending ? "開通中…" : "完成開通"}
      </button>
    </form>
  );
}
