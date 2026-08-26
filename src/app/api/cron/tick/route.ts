import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/push";
import { runEndTime } from "@/lib/format";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type ReminderKind = "1d" | "6h" | "1h";

const REMINDER_COPY: Record<
  ReminderKind,
  { title: string; body: string; column: string }
> = {
  "1d": {
    title: "約跑提醒（一天前）",
    body: "活動約一天後開始，請預留時間",
    column: "reminder_1d_sent_at",
  },
  "6h": {
    title: "約跑提醒（六小時前）",
    body: "活動約六小時後開始，記得準備",
    column: "reminder_6h_sent_at",
  },
  "1h": {
    title: "約跑提醒（一小時前）",
    body: "活動約一小時後開始，記得準時集合",
    column: "start_reminder_sent_at",
  },
};

function pickReminder(run: {
  start_time: string;
  reminder_1d_sent_at: string | null;
  reminder_6h_sent_at: string | null;
  start_reminder_sent_at: string | null;
}, now: number): ReminderKind | null {
  const msUntil = new Date(run.start_time).getTime() - now;
  if (msUntil <= 0) return null;

  // 門檻補送：Cron 即使每日一次，進入該時段且尚未送過就發
  if (!run.start_reminder_sent_at && msUntil <= HOUR) return "1h";
  if (!run.reminder_6h_sent_at && msUntil <= 6 * HOUR) return "6h";
  if (!run.reminder_1d_sent_at && msUntil <= DAY) return "1d";
  return null;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return jsonError("UNAUTHORIZED", 401);

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const horizon = new Date(now + DAY).toISOString();

  const { data: upcoming } = await supabase
    .from("pwa_runs")
    .select(
      "id, start_time, reminder_1d_sent_at, reminder_6h_sent_at, start_reminder_sent_at",
    )
    .in("status", ["open", "delayed"])
    .is("deleted_at", null)
    .gt("start_time", new Date(now).toISOString())
    .lte("start_time", horizon);

  const counts = { "1d": 0, "6h": 0, "1h": 0 };

  for (const run of upcoming ?? []) {
    const kind = pickReminder(run, now);
    if (!kind) continue;

    const { data: parts } = await supabase
      .from("pwa_run_participants")
      .select("user_id")
      .eq("run_id", run.id)
      .in("status", ["registered", "arrived"]);

    const copy = REMINDER_COPY[kind];
    notifyUsers((parts ?? []).map((p) => p.user_id), {
      title: copy.title,
      body: copy.body,
      url: `/runs/${run.id}`,
    });

    await supabase
      .from("pwa_runs")
      .update({ [copy.column]: new Date().toISOString() })
      .eq("id", run.id);

    counts[kind] += 1;
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
    reminders_1d: counts["1d"],
    reminders_6h: counts["6h"],
    reminders_1h: counts["1h"],
    completion_reminders: reminded,
    auto_completed: autoCompleted,
  });
}
