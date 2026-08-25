import { NextRequest, NextResponse } from "next/server";
import { exchangeLineCode, fetchLineProfile } from "@/lib/auth/line";
import { signSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { FLAGS_COOKIE } from "@/lib/auth/flags";
import { needsOnboarding } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PwaUser } from "@/types/database";

function appOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = appOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("line_oauth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  try {
    const accessToken = await exchangeLineCode(code);
    const profile = await fetchLineProfile(accessToken);
    const supabase = getSupabaseAdmin();

    const { data: existing, error: findErr } = await supabase
      .from("pwa_users")
      .select("*")
      .eq("line_uid", profile.userId)
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
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl ?? existing.avatar_url,
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
          line_uid: profile.userId,
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl ?? null,
          role: "member",
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
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      },
    );
    response.cookies.set("line_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${origin}/login?error=line`);
  }
}
