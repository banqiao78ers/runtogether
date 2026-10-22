import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import {
  buildInviteUrl,
  createInviteToken,
} from "@/lib/auth/invite-token";
import { canManageUserRoles } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function appOrigin(request: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireUser();
    if (!canManageUserRoles(admin.role)) return jsonError("FORBIDDEN", 403);

    const { id } = await context.params;
    if (!id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data: target, error } = await supabase
      .from("pwa_users")
      .select("id, line_uid, display_name, is_banned")
      .eq("id", id)
      .maybeSingle();

    if (error) return jsonError("DB", 500);
    if (!target) return jsonError("USER_NOT_FOUND", 404);
    if (target.line_uid) return jsonError("LOGIN_LINK_LINE_ONLY");
    if (target.is_banned) return jsonError("BANNED");

    const { rawToken, row } = await createInviteToken({
      purpose: "login",
      createdBy: admin.id,
      userId: target.id,
    });

    return jsonOk({
      invite: {
        id: row.id,
        purpose: row.purpose,
        user_id: row.user_id,
        expires_at: row.expires_at,
        created_at: row.created_at,
      },
      url: buildInviteUrl(appOrigin(request), rawToken),
      display_name: target.display_name,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
