import { NextRequest, NextResponse } from "next/server";
import {
  signSession,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { FLAGS_COOKIE } from "@/lib/auth/flags";
import { needsOnboarding } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PwaUser, UserRole } from "@/types/database";

function appOrigin(request: NextRequest) {
  // 本機測試一律導回目前請求來源，避免 .env 寫成正式網址時跳錯站
  if (process.env.NODE_ENV !== "production") {
    return request.nextUrl.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

function isDevLoginAllowed() {
  return process.env.NODE_ENV !== "production";
}

const DEV_ACCOUNTS: Record<
  string,
  { line_uid: string; display_name: string; role: UserRole }
> = {
  member: {
    line_uid: "dev-local-member",
    display_name: "本機測試會員",
    role: "member",
  },
  super: {
    line_uid: "dev-local-super",
    display_name: "本機測試超會",
    role: "super_member",
  },
  admin: {
    line_uid: "dev-local-admin",
    display_name: "本機測試管理員",
    role: "admin",
  },
};

/** 本機略過 LINE：僅 NODE_ENV !== production 可用 */
export async function GET(request: NextRequest) {
  const origin = appOrigin(request);

  if (!isDevLoginAllowed()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const key = request.nextUrl.searchParams.get("as") || "member";
  const account = DEV_ACCOUNTS[key] ?? DEV_ACCOUNTS.member;

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: findErr } = await supabase
      .from("pwa_users")
      .select("*")
      .eq("line_uid", account.line_uid)
      .maybeSingle();

    if (findErr) {
      console.error(findErr);
      return NextResponse.redirect(`${origin}/login?error=db`);
    }

    let user: PwaUser;

    if (existing) {
      const { data: updated, error: updErr } = await supabase
        .from("pwa_users")
        .update({
          display_name: account.display_name,
          role: account.role,
          is_banned: false,
          // 本機預設配速，避免每次卡在 onboarding
          pace_min: existing.pace_min ?? 300,
          pace_max: existing.pace_max ?? 360,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updErr || !updated) {
        return NextResponse.redirect(`${origin}/login?error=db`);
      }
      user = updated as PwaUser;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("pwa_users")
        .insert({
          line_uid: account.line_uid,
          display_name: account.display_name,
          avatar_url: null,
          role: account.role,
          pace_min: 300,
          pace_max: 360,
        })
        .select("*")
        .single();

      if (createErr || !created) {
        console.error(createErr);
        return NextResponse.redirect(`${origin}/login?error=db`);
      }
      user = created as PwaUser;
    }

    const token = await signSession({
      userId: user.id,
      lineUid: user.line_uid,
      role: user.role,
    });

    const dest = user.is_banned
      ? "/banned"
      : needsOnboarding(user.pace_min, user.pace_max)
        ? "/onboarding/preference"
        : "/";

    const response = NextResponse.redirect(`${origin}${dest}`);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.cookies.set(
      FLAGS_COOKIE,
      JSON.stringify({
        banned: user.is_banned,
        needsPace: needsOnboarding(user.pace_min, user.pace_max),
      }),
      {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      },
    );
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${origin}/login?error=db`);
  }
}
