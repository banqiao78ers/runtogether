import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyUsersAsync } from "@/lib/push";
import { runEndTime } from "@/lib/format";
import {
  pickCronReminder,
  REMINDER_COPY,
  sendRunReminderAsync,
} from "@/lib/run-reminders";

const DAY = 24 * 60 * 60_000;
const AUTO_COMPLETE_AFTER_MS = DAY;

function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return jsonError("UNAUTHORIZED", 401);

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const horizon = new Date(now + DAY).toISOString();

  const { data: upcoming, error: upcomingError } = await supabase
    .from("pwa_runs")
    .select(
      "id, start_time, reminder_1d_sent_at, reminder_6h_sent_at, start_reminder_sent_at",
    )
    .in("status", ["open", "delayed"])
    .is("deleted_at", null)
    .gt("start_time", new Date(now).toISOString())
    .lte("start_time", horizon);

  if (upcomingError) {
    console.error(upcomingError);
    return jsonError("DB", 500, { detail: upcomingError.message });
  }

  const counts = { "1d": 0, "6h": 0, "1h": 0 };
  let push_sent = 0;
  let push_failed = 0;
  let push_skipped_no_sub = 0;

  for (const run of upcoming ?? []) {
    const kind = pickCronReminder(run, now);
    if (!kind) continue;

    const { data: parts } = await supabase
      .from("pwa_run_participants")
      .select("user_id")
      .eq("run_id", run.id)
      .in("status", ["registered", "arrived"]);

    const userIds = (parts ?? []).map((p) => p.user_id);
    const copy = REMINDER_COPY[kind];
    const result = await sendRunReminderAsync(userIds, kind, run.id);

    push_sent += result.sent;
    if (result.eligible === 0) {
      push_skipped_no_sub += userIds.length;
    } else if (result.sent < result.eligible) {
      push_failed += result.eligible - result.sent;
    }

    // 無推播訂閱可標記已送；有訂閱但全失敗則留待下輪重試
    if (result.eligible === 0 || result.sent > 0) {
      await supabase
        .from("pwa_runs")
        .update({ [copy.column]: new Date().toISOString() })
        .eq("id", run.id);
      counts[kind] += 1;
    }
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
      const result = await notifyUsersAsync([run.host_id], {
        title: "請結案點名",
        body: "活動已結束，請至詳情頁完成點名結案",
        url: `/runs/${run.id}`,
      });

      push_sent += result.sent;
      if (result.eligible > 0 && result.sent < result.eligible) {
        push_failed += result.eligible - result.sent;
      }

      if (result.eligible === 0 || result.sent > 0) {
        await supabase
          .from("pwa_runs")
          .update({ completion_reminder_sent_at: new Date().toISOString() })
          .eq("id", run.id);
        reminded += 1;
      }
    }

    if (now - end >= AUTO_COMPLETE_AFTER_MS) {
      const { data: pendingParts } = await supabase
        .from("pwa_run_participants")
        .select("user_id")
        .eq("run_id", run.id)
        .in("status", ["registered", "arrived"]);

      await supabase
        .from("pwa_runs")
        .update({ status: "completed" })
        .eq("id", run.id);
      await supabase
        .from("pwa_run_participants")
        .update({ status: "attended" })
        .eq("run_id", run.id)
        .in("status", ["registered", "arrived"]);

      const notifyIds = [
        run.host_id,
        ...(pendingParts ?? []).map((p) => p.user_id),
      ];
      const result = await notifyUsersAsync([...new Set(notifyIds)], {
        title: "活動已自動結案",
        body: "主揪未於 24 小時內點名，系統已自動結案並標記出席",
        url: `/runs/${run.id}`,
      });
      push_sent += result.sent;
      if (result.eligible > 0 && result.sent < result.eligible) {
        push_failed += result.eligible - result.sent;
      }
      if (result.eligible === 0 && notifyIds.length > 0) {
        push_skipped_no_sub += notifyIds.length;
      }

      autoCompleted += 1;
    }
  }

  return jsonOk({
    reminders_1d: counts["1d"],
    reminders_6h: counts["6h"],
    reminders_1h: counts["1h"],
    completion_reminders: reminded,
    auto_completed: autoCompleted,
    push_sent,
    push_failed,
    push_skipped_no_sub,
  });
}
