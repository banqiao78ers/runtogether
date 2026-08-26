import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** 追蹤主揪 */
export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id: hostId } = await ctx.params;
    if (hostId === user.id) return jsonError("CANNOT_FOLLOW_SELF");

    const supabase = getSupabaseAdmin();
    const { data: host } = await supabase
      .from("pwa_users")
      .select("id")
      .eq("id", hostId)
      .eq("is_banned", false)
      .maybeSingle();

    if (!host) return jsonError("HOST_NOT_FOUND", 404);

    const { error } = await supabase.from("pwa_host_follows").upsert(
      { follower_id: user.id, host_id: hostId },
      { onConflict: "follower_id,host_id", ignoreDuplicates: true },
    );

    if (error) return jsonError("DB", 500);
    return jsonOk({ following: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 取消追蹤 */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id: hostId } = await ctx.params;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("pwa_host_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("host_id", hostId);

    if (error) return jsonError("DB", 500);
    return jsonOk({ following: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
