import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { setUserFlagsCookie } from "@/lib/auth/flags";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canReviewAppeals } from "@/lib/rbac";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();

    if (canReviewAppeals(user.role)) {
      const { data, error } = await supabase
        .from("pwa_penalty_appeals")
        .select(
          `*, user:pwa_users!user_id(id, display_name, avatar_url)`,
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return jsonError("DB", 500);
      return jsonOk({ appeals: data ?? [] });
    }

    const { data, error } = await supabase
      .from("pwa_penalty_appeals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return jsonError("DB", 500);
    return jsonOk({ appeals: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.is_banned) return jsonError("NOT_BANNED");

    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim();
    if (!reason) return jsonError("REASON_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data: pending } = await supabase
      .from("pwa_penalty_appeals")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (pending) return jsonError("ALREADY_PENDING");

    const { data, error } = await supabase
      .from("pwa_penalty_appeals")
      .insert({ user_id: user.id, reason })
      .select("*")
      .single();

    if (error) return jsonError("DB", 500);
    return jsonOk({ appeal: data }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (!canReviewAppeals(user.role)) return jsonError("FORBIDDEN", 403);

    const body = (await request.json()) as {
      id?: string;
      status?: "approved" | "rejected";
    };
    if (!body.id || !body.status) return jsonError("INVALID_BODY");

    const supabase = getSupabaseAdmin();
    const { data: appeal, error } = await supabase
      .from("pwa_penalty_appeals")
      .update({
        status: body.status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("status", "pending")
      .select("*")
      .single();

    if (error || !appeal) return jsonError("NOT_FOUND", 404);

    if (body.status === "approved") {
      const { data: unbanned } = await supabase
        .from("pwa_users")
        .update({ is_banned: false })
        .eq("id", appeal.user_id)
        .select("*")
        .single();
      if (unbanned) await setUserFlagsCookie(unbanned);
    }

    return jsonOk({ appeal });
  } catch (err) {
    return handleRouteError(err);
  }
}
