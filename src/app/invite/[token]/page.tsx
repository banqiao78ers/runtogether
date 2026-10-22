import Link from "next/link";
import { findInviteByRawToken } from "@/lib/auth/invite-token";
import RegisterForm from "./RegisterForm";
import LoginConfirm from "./LoginConfirm";

const ERROR_ZH: Record<string, string> = {
  NOT_FOUND: "邀請連結無效或不存在",
  EXPIRED: "邀請連結已過期，請向管理員重新索取",
  USED: "此連結已使用過",
  REVOKED: "此連結已被撤銷",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await findInviteByRawToken(token);

  if (!lookup.ok) {
    return (
      <InviteShell
        title="無法使用此連結"
        message={ERROR_ZH[lookup.code] ?? "邀請連結無效"}
      />
    );
  }

  if (lookup.row.purpose === "login") {
    return (
      <main className="relative flex flex-1 flex-col justify-center px-6 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,#2d5a40,transparent_50%),linear-gradient(160deg,#0f1f17,#0c1812)]"
        />
        <h1 className="text-3xl font-bold text-white">登入板橋約跑</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-100/65">
          此為管理員發給你的一次性登入連結。確認後即可進入，無需 LINE。
        </p>
        <LoginConfirm token={token} />
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col justify-center px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,#2d5a40,transparent_50%),linear-gradient(160deg,#0f1f17,#0c1812)]"
      />
      <h1 className="text-3xl font-bold text-white">邀請開通</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-100/65">
        填寫你在 LINE 群內的顯示名稱即可開通帳號。開通後請盡量安裝成 App
        並避免清除網站資料；若之後無法登入，請再向管理員索取登入連結。
      </p>
      <RegisterForm token={token} />
    </main>
  );
}

function InviteShell({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="relative flex flex-1 flex-col justify-center px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,#2d5a40,transparent_50%),linear-gradient(160deg,#0f1f17,#0c1812)]"
      />
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      <p className="mt-3 max-w-sm text-sm text-amber-200/90" role="alert">
        {message}
      </p>
      <Link href="/login" className="mt-8 text-sm text-emerald-200/60">
        前往登入頁
      </Link>
    </main>
  );
}
