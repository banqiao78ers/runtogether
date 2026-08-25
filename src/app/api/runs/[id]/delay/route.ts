import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json()) as { minutes?: number };
    const minutes = body.minutes ?? 0;

    if (minutes < 1 || minutes > 30) return jsonError("INVALID_MINUTES");

    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (run.host_id !== user.id) return jsonError("FORBIDDEN", 403);
    if (!["open", "delayed"].includes(run.status)) return jsonError("RUN_CLOSED");
    if (run.delay_count >= 2) return jsonError("DELAY_LIMIT");
    if (run.total_delayed_minutes + minutes > 60) return jsonError("DELAY_TOTAL_LIMIT");

    const newStart = new Date(
      new Date(run.start_time).getTime() + minutes * 60_000,
    ).toISOString();

    const { data: updated, error } = await supabase
      .from("pwa_runs")
      .update({
        start_time: newStart,
        delay_count: run.delay_count + 1,
        total_delayed_minutes: run.total_delayed_minutes + minutes,
        status: "delayed",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) return jsonError("DB", 500);

    const { data: parts } = await supabase
      .from("pwa_run_participants")
      .select("user_id")
      .eq("run_id", id)
      .in("status", ["registered", "arrived"])
      .neq("user_id", user.id);

    notifyUsers(
      (parts ?? []).map((p) => p.user_id),
      {
        title: "約跑延期通知",
        body: `活動延期 ${minutes} 分鐘`,
        url: `/runs/${id}`,
      },
    );

    return jsonOk({ run: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
