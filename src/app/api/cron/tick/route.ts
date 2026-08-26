import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/push";
import { runEndTime } from "@/lib/format";

function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return jsonError("UNAUTHORIZED", 401);

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const from = new Date(now + 55 * 60_000).toISOString();
  const to = new Date(now + 65 * 60_000).toISOString();

  const { data: runs } = await supabase
    .from("pwa_runs")
    .select("id, start_time")
    .in("status", ["open", "delayed"])
    .is("deleted_at", null)
    .is("start_reminder_sent_at", null)
    .gte("start_time", from)
    .lte("start_time", to);

  for (const run of runs ?? []) {
    const { data: parts } = await supabase
      .from("pwa_run_participants")
      .select("user_id")
      .eq("run_id", run.id)
      .in("status", ["registered", "arrived"]);

      notifyUsers(
      (parts ?? []).map((p) => p.user_id),
      {
        title: "約跑提醒",
        body: "活動約一小時後開始，記得準時集合",
        url: `/runs/${run.id}`,
      },
    );

    await supabase
      .from("pwa_runs")
      .update({ start_reminder_sent_at: new Date().toISOString() })
      .eq("id", run.id);
  }

  const { data: finished } = await supabase
    .from("pwa_runs")
    .select("*")
    .in("status", ["open", "delayed", "ongoing"])
    .is("deleted_at", null);

  let reminded = 0;
  let autoCompleted = 0;

  for (const run of finished ?? []) {
    const end = runEndTime(
      run.start_time,
      run.estimated_duration_minutes,
    ).getTime();
    if (end > now) continue;

    if (!run.completion_reminder_sent_at) {
      notifyUsers([run.host_id], {
        title: "請結案點名",
        body: "活動已結束，請至詳情頁完成點名結案",
        url: `/runs/${run.id}`,
      });
      await supabase
        .from("pwa_runs")
        .update({ completion_reminder_sent_at: new Date().toISOString() })
        .eq("id", run.id);
      reminded += 1;
    }

    if (now - end >= 48 * 60 * 60 * 1000) {
      await supabase
        .from("pwa_runs")
        .update({ status: "completed" })
        .eq("id", run.id);
      await supabase
        .from("pwa_run_participants")
        .update({ status: "attended" })
        .eq("run_id", run.id)
        .in("status", ["registered", "arrived"]);
      autoCompleted += 1;
    }
  }

  return jsonOk({
    start_reminders: (runs ?? []).length,
    completion_reminders: reminded,
    auto_completed: autoCompleted,
  });
}
