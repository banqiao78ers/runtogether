import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserRunStats } from "@/lib/user-stats";
import { paceLabel, roleLabel } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();
    const viewer = await getCurrentUser();

    const { data: user, error } = await supabase
      .from("pwa_users")
      .select("id, display_name, avatar_url, role, pace_min, pace_max, is_banned")
      .eq("id", id)
      .maybeSingle();

    if (error || !user) return jsonError("USER_NOT_FOUND", 404);
    if (user.is_banned) return jsonError("USER_NOT_FOUND", 404);

    const stats = await getUserRunStats(id);

    let isFollowing = false;
    let isBlocked = false;
    const isSelf = viewer?.id === id;

    if (viewer && !isSelf) {
      const [{ data: follow }, { data: block }] = await Promise.all([
        supabase
          .from("pwa_host_follows")
          .select("id")
          .eq("follower_id", viewer.id)
          .eq("host_id", id)
          .maybeSingle(),
        supabase
          .from("pwa_host_blocklists")
          .select("id")
          .eq("host_id", viewer.id)
          .eq("blocked_user_id", id)
          .maybeSingle(),
      ]);
      isFollowing = !!follow;
      isBlocked = !!block;
    }

    return jsonOk({
      user: {
        id: user.id,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
        role_label: roleLabel(user.role),
        pace_label:
          user.pace_min != null && user.pace_max != null
            ? `${paceLabel(user.pace_min)} – ${paceLabel(user.pace_max)}`
            : null,
      },
      stats,
      viewer: viewer
        ? {
            is_self: isSelf,
            is_following: isFollowing,
            is_blocked: isBlocked,
          }
        : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
