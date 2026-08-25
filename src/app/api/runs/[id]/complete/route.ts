import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      attendance?: Record<string, "attended" | "no_show">;
    };

    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (run.host_id !== user.id && user.role !== "admin") {
      return jsonError("FORBIDDEN", 403);
    }
    if (run.status === "cancelled") return jsonError("CANCELLED");
    if (run.status === "completed") return jsonError("ALREADY_COMPLETED");

    const { data: parts } = await supabase
      .from("pwa_run_participants")
      .select("*")
      .eq("run_id", id)
      .in("status", ["registered", "arrived"]);

    for (const p of parts ?? []) {
      const mark = body.attendance?.[p.user_id];
      const status =
        mark ??
        (p.status === "arrived" || p.user_id === run.host_id
          ? "attended"
          : "attended");
      await supabase
        .from("pwa_run_participants")
        .update({ status })
        .eq("id", p.id);
    }

    await supabase.from("pwa_runs").update({ status: "completed" }).eq("id", id);

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
