import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canManageUserRoles } from "@/lib/rbac";
import type { UserRole } from "@/types/database";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canManageUserRoles(user.role)) return jsonError("FORBIDDEN", 403);

    const supabase = getSupabaseAdmin();
    const [{ data: users, error: uErr }, { data: profiles, error: pErr }] =
      await Promise.all([
        supabase
          .from("pwa_users")
          .select(
            "id, display_name, avatar_url, role, is_banned, pace_min, pace_max, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, created_at")
          .order("display_name")
          .limit(500),
      ]);

    if (uErr) return jsonError("DB", 500);
    // profiles may fail if RLS; still return users
    return jsonOk({
      users: users ?? [],
      profiles: pErr ? [] : profiles ?? [],
      profiles_error: pErr?.message ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageUserRoles(user.role)) return jsonError("FORBIDDEN", 403);

    const body = (await request.json()) as {
      id?: string;
      role?: UserRole;
      is_banned?: boolean;
    };
    if (!body.id) return jsonError("ID_REQUIRED");
    if (body.role && !["member", "super_member", "admin"].includes(body.role)) {
      return jsonError("INVALID_ROLE");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_users")
      .update({
        ...(body.role ? { role: body.role } : {}),
        ...(body.is_banned != null ? { is_banned: body.is_banned } : {}),
      })
      .eq("id", body.id)
      .select(
        "id, display_name, avatar_url, role, is_banned, pace_min, pace_max, created_at",
      )
      .single();

    if (error || !data) return jsonError("DB", 500);
    return jsonOk({ user: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
