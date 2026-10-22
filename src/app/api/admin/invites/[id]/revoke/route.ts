import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { canManageUserRoles } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!canManageUserRoles(user.role)) return jsonError("FORBIDDEN", 403);

    const { id } = await context.params;
    if (!id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_invite_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("used_at", null)
      .is("revoked_at", null)
      .select(
        "id, purpose, user_id, created_by, expires_at, used_at, revoked_at, created_at",
      )
      .maybeSingle();

    if (error) return jsonError("DB", 500);
    if (!data) return jsonError("INVITE_NOT_REVOCABLE");
    return jsonOk({ invite: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
