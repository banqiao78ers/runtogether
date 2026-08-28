import { notifyUsers, notifyUsersAsync } from "@/lib/push";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

export type ReminderKind = "1d" | "6h" | "1h";

export const REMINDER_COPY: Record<
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

type RunReminderState = {
  start_time: string;
  reminder_1d_sent_at: string | null;
  reminder_6h_sent_at: string | null;
  start_reminder_sent_at: string | null;
};

function msUntilStart(startTime: string, now: number): number {
  return new Date(startTime).getTime() - now;
}

/** Cron 用：依整場是否已送過，挑下一則該發的提醒 */
export function pickCronReminder(
  run: RunReminderState,
  now = Date.now(),
): ReminderKind | null {
  const msUntil = msUntilStart(run.start_time, now);
  if (msUntil <= 0) return null;

  if (!run.start_reminder_sent_at && msUntil <= HOUR) return "1h";
  if (!run.reminder_6h_sent_at && msUntil <= 6 * HOUR) return "6h";
  if (!run.reminder_1d_sent_at && msUntil <= DAY) return "1d";
  return null;
}

/** 個人補送：報名／開團時若已進入門檻，直接推給該使用者 */
export function pickCatchUpReminder(
  startTime: string,
  now = Date.now(),
): ReminderKind | null {
  const msUntil = msUntilStart(startTime, now);
  if (msUntil <= 0) return null;

  if (msUntil <= HOUR) return "1h";
  if (msUntil <= 6 * HOUR) return "6h";
  if (msUntil <= DAY) return "1d";
  return null;
}

export async function sendRunReminderAsync(
  userIds: string[],
  kind: ReminderKind,
  runId: string,
) {
  const copy = REMINDER_COPY[kind];
  return notifyUsersAsync(userIds, {
    title: copy.title,
    body: copy.body,
    url: `/runs/${runId}`,
  });
}

/** Fire-and-forget：報名或開團後的個人補推 */
export function sendCatchUpReminder(
  userId: string,
  startTime: string,
  runId: string,
): void {
  const kind = pickCatchUpReminder(startTime);
  if (!kind) return;

  notifyUsers([userId], {
    title: REMINDER_COPY[kind].title,
    body: REMINDER_COPY[kind].body,
    url: `/runs/${runId}`,
  });
}
