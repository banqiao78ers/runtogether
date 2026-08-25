import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isExemptFromCancelPenalty } from "@/lib/rbac";
import type { UserRole } from "@/types/database";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json()) as { is_malicious?: boolean };
    const isMalicious = body.is_malicious !== false;

    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*, host:pwa_users!host_id(id, role)")
      .eq("id", id)
      .maybeSingle();

    if (!run || run.status !== "cancelled") return jsonError("NOT_CANCELLED");
    const hostRole = (run.host as { role?: UserRole } | null)?.role ?? "member";
    if (isExemptFromCancelPenalty(hostRole)) {
      return jsonError("HOST_EXEMPT", 400);
    }

    const { data: part } = await supabase
      .from("pwa_run_participants")
      .select("id")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .maybeSingle();

    // allow voters who were registered before cancel — include cancelled status after cancel
    const { data: anyPart } = await supabase
      .from("pwa_run_participants")
      .select("id")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!anyPart && !part) return jsonError("NOT_PARTICIPANT", 403);
    if (user.id === run.host_id) return jsonError("CANNOT_VOTE_SELF", 403);

    const { error } = await supabase.from("pwa_run_cancellation_votes").upsert(
      {
        run_id: id,
        voter_id: user.id,
        is_malicious: isMalicious,
      },
      { onConflict: "run_id,voter_id" },
    );

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }

    if (isMalicious) {
      await supabase.rpc("pwa_apply_malicious_cancel_ban", {
        p_host_id: run.host_id,
      });
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
