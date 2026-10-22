"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage } from "@/lib/api-errors";

export default function LoginConfirm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}/login`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        redirect?: string;
      };
      if (!res.ok) {
        setError(apiErrorMessage(data.error, "登入失敗，請再試一次"));
        return;
      }
      router.replace(data.redirect || "/");
      router.refresh();
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <p className="text-sm text-amber-300/90" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => void onConfirm()}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-emerald-500 px-6 text-sm font-semibold text-[#0c1812] disabled:opacity-50"
      >
        {pending ? "登入中…" : "確認登入"}
      </button>
    </div>
  );
}
