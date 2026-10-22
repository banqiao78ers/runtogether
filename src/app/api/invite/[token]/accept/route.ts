import { NextResponse } from "next/server";
import { jsonError, handleRouteError } from "@/lib/api";
import {
  findInviteByRawToken,
  markInviteUsed,
} from "@/lib/auth/invite-token";
import { FLAGS_COOKIE } from "@/lib/auth/flags";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";
import { needsOnboarding } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PwaUser } from "@/types/database";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const lookup = await findInviteByRawToken(token);
    if (!lookup.ok) return jsonError(`INVITE_${lookup.code}`);

    const invite = lookup.row;
    if (invite.purpose !== "register") {
      return jsonError("INVITE_NOT_REGISTER");
    }

    const body = (await request.json().catch(() => null)) as {
      display_name?: string;
    } | null;
    const displayName = body?.display_name?.trim() ?? "";
    if (!displayName) return jsonError("DISPLAY_NAME_REQUIRED");
    if (displayName.length > 100) return jsonError("DISPLAY_NAME_TOO_LONG");

    const supabase = getSupabaseAdmin();
    const { data: created, error: createErr } = await supabase
      .from("pwa_users")
      .insert({
        line_uid: null,
        display_name: displayName,
        avatar_url: null,
        role: "member",
      })
      .select("*")
      .single();

    if (createErr || !created) {
      console.error(createErr);
      return jsonError("DB", 500);
    }

    const user = created as PwaUser;
    const marked = await markInviteUsed(invite.id, user.id);
    if (!marked) {
      await supabase.from("pwa_users").delete().eq("id", user.id);
      return jsonError("INVITE_USED");
    }

    const sessionToken = await signSession({
      userId: user.id,
      lineUid: null,
      role: user.role,
    });

    const dest = needsOnboarding(user.pace_min, user.pace_max)
      ? "/onboarding/preference"
      : "/";

    const response = NextResponse.json({ ok: true, redirect: dest });
    response.cookies.set(
      SESSION_COOKIE,
      sessionToken,
      sessionCookieOptions(),
    );
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
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
