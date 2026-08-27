import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const errorMap: Record<string, string> = {
    oauth: "登入授權失敗，請再試一次",
    line: "無法取得 LINE 資料",
    db: "資料庫暫時無法連線，請稍後再試",
    config: "伺服器尚未完成 LINE 設定",
  };
  const message = params.error ? errorMap[params.error] || "登入失敗" : null;
  const allowDevLogin = process.env.NODE_ENV !== "production";

  return (
    <main className="relative flex flex-1 flex-col justify-center px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,#2d5a40,transparent_50%),linear-gradient(160deg,#0f1f17,#0c1812)]"
      />
      <h1 className="text-4xl font-bold text-white">板橋約跑</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-100/65">
        使用 LINE 登入後即可報名與開團。首次登入需設定配速偏好。
      </p>
      {message && (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {message}
        </p>
      )}
      <a
        href="/api/auth/line"
        className="mt-10 inline-flex h-12 items-center justify-center rounded-lg bg-[#06C755] px-6 text-sm font-semibold text-white"
      >
        使用 LINE 登入
      </a>

      {allowDevLogin && (
        <div className="mt-8 space-y-3 rounded-lg border border-amber-500/30 bg-amber-400/5 p-4">
          <p className="text-xs font-medium text-amber-200/90">
            本機開發：略過 LINE（僅 development）
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="/api/auth/dev-login?as=member"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-400/15 text-sm font-medium text-emerald-100"
            >
              測試登入 · 一般會員
            </a>
            <a
              href="/api/auth/dev-login?as=super"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-teal-500/40 bg-teal-400/12 text-sm font-medium text-teal-100"
            >
              測試登入 · 超級會員
            </a>
            <a
              href="/api/auth/dev-login?as=admin"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-400/12 text-sm font-medium text-amber-100"
            >
              測試登入 · 管理員
            </a>
          </div>
        </div>
      )}

      <Link href="/" className="mt-6 text-sm text-emerald-200/50">
        先逛逛活動列表
      </Link>
    </main>
  );
}
