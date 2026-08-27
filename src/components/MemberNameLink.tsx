import Link from "next/link";

type Props = {
  userId: string;
  name?: string | null;
  className?: string;
};

/** 可點進個人頁的成員姓名，樣式一眼可辨為可點按 */
export function MemberNameLink({ userId, name, className = "" }: Props) {
  return (
    <Link
      href={`/users/${userId}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-400/10 px-2 py-0.5 text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-400/20 active:bg-emerald-400/25 ${className}`}
    >
      <span className="truncate font-medium">{name || "跑友"}</span>
      <span className="shrink-0 text-emerald-300/70" aria-hidden>
        ›
      </span>
    </Link>
  );
}
