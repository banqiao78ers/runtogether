import { NextResponse } from "next/server";
import { jsonError, handleRouteError } from "@/lib/api";
import {
  findInviteByRawToken,
  loadInviteUser,
  markInviteUsed,
} from "@/lib/auth/invite-token";
import { FLAGS_COOKIE } from "@/lib/auth/flags";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";
import { needsOnboarding } from "@/lib/rbac";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const lookup = await findInviteByRawToken(token);
    if (!lookup.ok) return jsonError(`INVITE_${lookup.code}`);
    if (lookup.row.purpose !== "login") {
      return jsonError("INVITE_NOT_LOGIN");
    }
    if (!lookup.row.user_id) return jsonError("USER_NOT_FOUND", 404);

    const user = await loadInviteUser(lookup.row.user_id);
    if (!user) return jsonError("USER_NOT_FOUND", 404);
    if (user.is_banned) return jsonError("BANNED");

    const marked = await markInviteUsed(lookup.row.id, user.id);
    if (!marked) return jsonError("INVITE_USED");

    const sessionToken = await signSession({
      userId: user.id,
      lineUid: user.line_uid,
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
