import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/user";
import { setSessionCookie } from "@/lib/auth/session";
import { setUserFlagsCookie } from "@/lib/auth/flags";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("UNAUTHORIZED", 401);

    await setSessionCookie({
      userId: user.id,
      lineUid: user.line_uid,
      role: user.role,
    });
    await setUserFlagsCookie(user);

    return jsonOk({
      id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
      is_banned: user.is_banned,
      pace_min: user.pace_min,
      pace_max: user.pace_max,
      has_push: !!user.push_subscription,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
