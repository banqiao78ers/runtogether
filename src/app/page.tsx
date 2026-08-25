export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,#2d5a40_0%,transparent_50%),radial-gradient(ellipse_at_80%_100%,#1a3a2a_0%,transparent_45%),linear-gradient(160deg,#0f1f17_0%,#152820_45%,#0c1812_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(-12deg,transparent,transparent_11px,#fff_11px,#fff_12px)]"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <p className="mb-3 text-sm font-medium tracking-[0.2em] text-emerald-300/80 uppercase">
          Banqiao Run Club
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
          板橋約跑
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-emerald-100/70">
          揪團、報名、推播提醒 — PWA 樣板已就緒，可連結 Vercel 部署。
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/banqiao78ers/runtogether"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-emerald-400 px-6 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            連結 Vercel
          </a>
          <a
            href="https://github.com/banqiao78ers/runtogether"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-emerald-400/30 px-6 text-sm font-medium text-emerald-100/90 transition hover:border-emerald-300/50 hover:bg-white/5"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Repo
          </a>
        </div>

        <p className="mt-16 text-xs text-emerald-200/40">
          Next.js App Router · PWA · Supabase shared DB
        </p>
      </main>
    </div>
  );
}
