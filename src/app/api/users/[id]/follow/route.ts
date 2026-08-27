import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** 追蹤跑友（對方開團時優先收到推播） */
export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id: targetId } = await ctx.params;
    if (targetId === user.id) return jsonError("CANNOT_FOLLOW_SELF");

    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from("pwa_users")
      .select("id")
      .eq("id", targetId)
      .eq("is_banned", false)
      .maybeSingle();

    if (!target) return jsonError("USER_NOT_FOUND", 404);

    const { error } = await supabase.from("pwa_host_follows").upsert(
      { follower_id: user.id, host_id: targetId },
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
    const { id: targetId } = await ctx.params;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("pwa_host_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("host_id", targetId);

    if (error) return jsonError("DB", 500);
    return jsonOk({ following: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
