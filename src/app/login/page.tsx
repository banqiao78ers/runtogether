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
      <Link href="/" className="mt-6 text-sm text-emerald-200/50">
        先逛逛活動列表
      </Link>
    </main>
  );
}
