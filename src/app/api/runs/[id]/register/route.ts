import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyHostParticipantJoined } from "@/lib/push";
import { sendCatchUpReminder } from "@/lib/run-reminders";
import type { RegisterRpcResult } from "@/types/database";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (user.is_banned) return jsonError("BANNED", 403);
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("pwa_register_for_run", {
      p_run_id: id,
      p_user_id: user.id,
    });

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }

    const result = data as RegisterRpcResult;
    if (!result?.ok) {
      const code = result?.code || "FAILED";
      const status = code === "FULL" || code === "TIME_OVERLAP" ? 409 : 400;
      return jsonError(code, status);
    }

    const { data: run } = await supabase
      .from("pwa_runs")
      .select("host_id, start_time")
      .eq("id", id)
      .maybeSingle();

    if (run?.host_id && run.host_id !== user.id) {
      notifyHostParticipantJoined({
        runId: id,
        hostId: run.host_id,
        joinerName: user.display_name || "跑友",
        startTime: run.start_time,
      });
    }

    if (run?.start_time) {
      sendCatchUpReminder(user.id, run.start_time, id);
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
