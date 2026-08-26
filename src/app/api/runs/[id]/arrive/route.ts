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
    if (!["open", "delayed", "ongoing"].includes(run.status)) {
      return jsonError("RUN_CLOSED");
    }
    if (new Date(run.start_time).getTime() > Date.now()) {
      return jsonError("NOT_STARTED");
    }

    const { data: part } = await supabase
      .from("pwa_run_participants")
      .select("*")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!part || part.status === "cancelled") {
      return jsonError("NOT_REGISTERED");
    }

    await supabase
      .from("pwa_run_participants")
      .update({
        status: "arrived",
        arrived_at: new Date().toISOString(),
      })
      .eq("id", part.id);

    // 開始後才標 ongoing；報名 RPC 亦允許 ongoing（見 migration 004）
    if (run.status !== "ongoing") {
      await supabase.from("pwa_runs").update({ status: "ongoing" }).eq("id", id);
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
