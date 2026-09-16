import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** 主揪結案後可修正出席的時限（毫秒）；Admin 不受限 */
const CORRECTION_WINDOW_MS = 72 * 60 * 60 * 1000;

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      user_id?: string;
      status?: "attended" | "no_show";
    };

    if (!body.user_id || typeof body.user_id !== "string") {
      return jsonError("USER_REQUIRED");
    }
    if (body.status !== "attended" && body.status !== "no_show") {
      return jsonError("INVALID_ATTENDANCE_STATUS");
    }

    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (run.status !== "completed") return jsonError("NOT_COMPLETED");
    if (run.host_id !== user.id && user.role !== "admin") {
      return jsonError("FORBIDDEN", 403);
    }

    if (user.role !== "admin") {
      const completedAt = new Date(run.updated_at).getTime();
      if (Number.isNaN(completedAt) || Date.now() - completedAt > CORRECTION_WINDOW_MS) {
        return jsonError("ATTENDANCE_CORRECTION_EXPIRED");
      }
    }

    const { data: part } = await supabase
      .from("pwa_run_participants")
      .select("*")
      .eq("run_id", id)
      .eq("user_id", body.user_id)
      .maybeSingle();

    if (!part || !["attended", "no_show"].includes(part.status)) {
      return jsonError("ATTENDANCE_NOT_CORRECTABLE");
    }

    if (part.status === body.status) {
      return jsonOk({ ok: true, status: part.status });
    }

    const { error } = await supabase
      .from("pwa_run_participants")
      .update({ status: body.status })
      .eq("id", part.id);

    if (error) return jsonError("DB", 500);

    return jsonOk({ ok: true, status: body.status });
  } catch (err) {
    return handleRouteError(err);
  }
}
