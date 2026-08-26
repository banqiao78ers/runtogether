import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (run.host_id === user.id) {
      return jsonError("HOST_MUST_CANCEL_RUN", 400);
    }
    if (!["open", "delayed", "ongoing"].includes(run.status)) {
      return jsonError("RUN_CLOSED", 400);
    }

    const { data: part } = await supabase
      .from("pwa_run_participants")
      .select("*")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!part || !["registered", "arrived"].includes(part.status)) {
      return jsonError("NOT_REGISTERED", 400);
    }

    await supabase
      .from("pwa_run_participants")
      .update({ status: "cancelled" })
      .eq("id", part.id);

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
