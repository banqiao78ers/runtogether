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

export async function GET() {
  try {
    const user = await requireUser();
    if (!canManageUserRoles(user.role)) return jsonError("FORBIDDEN", 403);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_invite_tokens")
      .select(
        "id, purpose, user_id, created_by, expires_at, used_at, revoked_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return jsonError("DB", 500);
    return jsonOk({ invites: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageUserRoles(user.role)) return jsonError("FORBIDDEN", 403);

    const { rawToken, row } = await createInviteToken({
      purpose: "register",
      createdBy: user.id,
    });

    return jsonOk({
      invite: {
        id: row.id,
        purpose: row.purpose,
        expires_at: row.expires_at,
        created_at: row.created_at,
      },
      url: buildInviteUrl(appOrigin(request), rawToken),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
