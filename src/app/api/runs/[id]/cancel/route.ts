import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isExemptFromCancelPenalty } from "@/lib/rbac";
import { notifyUsers } from "@/lib/push";
import type { UserRole } from "@/types/database";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim();
    if (!reason) return jsonError("REASON_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*, host:pwa_users!host_id(role)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (run.host_id !== user.id && user.role !== "admin") {
      return jsonError("FORBIDDEN", 403);
    }
    if (["completed", "cancelled"].includes(run.status)) {
      return jsonError("ALREADY_CLOSED");
    }

    await supabase
      .from("pwa_runs")
      .update({
        status: "cancelled",
        cancel_reason: reason,
      })
      .eq("id", id);

    const { data: parts } = await supabase
      .from("pwa_run_participants")
      .select("user_id")
      .eq("run_id", id)
      .in("status", ["registered", "arrived"])
      .neq("user_id", run.host_id);

    notifyUsers(
      (parts ?? []).map((p) => p.user_id),
      {
        title: "約跑已取消",
        body: reason,
        url: `/runs/${id}`,
      },
    );

    const hostRole = (run.host as { role?: UserRole } | null)?.role ?? "member";
    return jsonOk({
      ok: true,
      voting_enabled: !isExemptFromCancelPenalty(hostRole),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
