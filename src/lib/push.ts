import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime, paceLabel } from "@/lib/format";
import type { PushSubscriptionJSON } from "@/types/database";

let configured = false;

function ensureVapid() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToSubscription(
  subscription: PushSubscriptionJSON,
  payload: PushPayload,
  userId?: string,
): Promise<boolean> {
  ensureVapid();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 410 && userId) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("pwa_users")
        .update({ push_subscription: null })
        .eq("id", userId);
    }
    return false;
  }
}

export type NotifyUsersResult = {
  eligible: number;
  sent: number;
};

export async function notifyUsersAsync(
  userIds: string[],
  payload: PushPayload,
): Promise<NotifyUsersResult> {
  if (userIds.length === 0) return { eligible: 0, sent: 0 };

  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase
    .from("pwa_users")
    .select("id, push_subscription")
    .in("id", userIds)
    .not("push_subscription", "is", null);

  const eligible = users?.length ?? 0;
  if (eligible === 0) return { eligible: 0, sent: 0 };

  const results = await Promise.all(
    (users ?? []).map((u) =>
      sendPushToSubscription(
        u.push_subscription as PushSubscriptionJSON,
        payload,
        u.id,
      ),
    ),
  );

  return { eligible, sent: results.filter(Boolean).length };
}

export function notifyRunCreated(run: {
  id: string;
  host_id: string;
  pace_min: number;
  pace_max: number;
  start_time: string;
}): void {
  void (async () => {
    try {
      const supabase = getSupabaseAdmin();

      const [{ data: host }, { data: paceUsers }, { data: follows }] =
        await Promise.all([
          supabase
            .from("pwa_users")
            .select("display_name")
            .eq("id", run.host_id)
            .maybeSingle(),
          supabase
            .from("pwa_users")
            .select("id, push_subscription, pace_min, pace_max")
            .not("push_subscription", "is", null)
            .not("pace_min", "is", null)
            .not("pace_max", "is", null)
            .eq("is_banned", false)
            .neq("id", run.host_id),
          supabase
            .from("pwa_host_follows")
            .select("follower_id")
            .eq("host_id", run.host_id),
        ]);

      const followerIds = new Set((follows ?? []).map((f) => f.follower_id));

      let followerUsers: {
        id: string;
        push_subscription: PushSubscriptionJSON | null;
      }[] = [];

      if (followerIds.size > 0) {
        const { data } = await supabase
          .from("pwa_users")
          .select("id, push_subscription")
          .in("id", [...followerIds])
          .not("push_subscription", "is", null)
          .eq("is_banned", false)
          .neq("id", run.host_id);
        followerUsers = data ?? [];
      }

      const byId = new Map<
        string,
        { id: string; push_subscription: PushSubscriptionJSON }
      >();

      for (const u of paceUsers ?? []) {
        if (
          u.pace_min != null &&
          u.pace_max != null &&
          u.pace_min <= run.pace_max &&
          u.pace_max >= run.pace_min &&
          u.push_subscription
        ) {
          byId.set(u.id, {
            id: u.id,
            push_subscription: u.push_subscription as PushSubscriptionJSON,
          });
        }
      }

      for (const u of followerUsers) {
        if (u.push_subscription) {
          byId.set(u.id, {
            id: u.id,
            push_subscription: u.push_subscription as PushSubscriptionJSON,
          });
        }
      }

      const hostName = host?.display_name || "跑友";
      const when = formatDateTime(run.start_time);
      const pace = `${paceLabel(run.pace_min)}–${paceLabel(run.pace_max)}`;

      await Promise.all(
        [...byId.values()].map((u) =>
          sendPushToSubscription(
            u.push_subscription,
            {
              title: "有新約跑開團",
              body: `${hostName} · ${when} · ${pace}`,
              url: `/runs/${run.id}`,
            },
            u.id,
          ),
        ),
      );
    } catch {
      // swallow background errors
    }
  })();
}

export function notifyUsers(userIds: string[], payload: PushPayload): void {
  void notifyUsersAsync(userIds, payload).catch(() => {
    // ignore background errors
  });
}

/** 有人報名加入約跑時通知主揪（Fire-and-forget） */
export function notifyHostParticipantJoined(opts: {
  runId: string;
  hostId: string;
  joinerName: string;
  startTime: string;
}): void {
  notifyUsers([opts.hostId], {
    title: "有人加入你的約跑",
    body: `${opts.joinerName} · ${formatDateTime(opts.startTime)}`,
    url: `/runs/${opts.runId}`,
  });
}

/** 主揪取消整場活動時通知報名者（不含主揪） */
export async function notifyRunCancelled(opts: {
  runId: string;
  startTime: string;
  reason: string;
  participantUserIds: string[];
}): Promise<NotifyUsersResult> {
  return notifyUsersAsync(opts.participantUserIds, {
    title: "約跑已取消",
    body: `${formatDateTime(opts.startTime)} · 取消原因：${opts.reason}`,
    url: `/runs/${opts.runId}`,
  });
}

export type BroadcastPushResult = {
  total: number;
  sent: number;
  failed: number;
  expired: number;
  errors: string[];
};

/** 管理員測試用：同步發送並回傳統計 */
export async function broadcastPush(
  payload: PushPayload,
  options?: { onlyUserId?: string },
): Promise<BroadcastPushResult> {
  ensureVapid();
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("pwa_users")
    .select("id, push_subscription, display_name")
    .not("push_subscription", "is", null)
    .eq("is_banned", false);

  if (options?.onlyUserId) {
    query = query.eq("id", options.onlyUserId);
  }

  const { data: users, error } = await query;
  if (error) throw new Error("DB");

  const result: BroadcastPushResult = {
    total: users?.length ?? 0,
    sent: 0,
    failed: 0,
    expired: 0,
    errors: [],
  };

  for (const u of users ?? []) {
    try {
      await webpush.sendNotification(
        u.push_subscription as PushSubscriptionJSON,
        JSON.stringify(payload),
      );
      result.sent += 1;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 410) {
        result.expired += 1;
        await supabase
          .from("pwa_users")
          .update({ push_subscription: null })
          .eq("id", u.id);
      } else {
        result.failed += 1;
        if (result.errors.length < 5) {
          result.errors.push(`${u.display_name}: ${msg}`);
        }
      }
    }
  }

  return result;
}

const BACKFILL_LIMIT = 5;

/**
 * 新設配速或剛開啟推播時，補推目前仍開放且配速重疊的約跑（最多 5 場）。
 * Fire-and-forget。
 */
export function notifyOpenRunsMatchingUser(userId: string): void {
  void (async () => {
    try {
      const supabase = getSupabaseAdmin();
      const { data: user } = await supabase
        .from("pwa_users")
        .select("id, pace_min, pace_max, push_subscription, is_banned")
        .eq("id", userId)
        .maybeSingle();

      if (
        !user ||
        user.is_banned ||
        !user.push_subscription ||
        user.pace_min == null ||
        user.pace_max == null
      ) {
        return;
      }

      const { data: runs } = await supabase
        .from("pwa_runs")
        .select(
          "id, host_id, pace_min, pace_max, start_time, host:pwa_users!host_id(display_name)",
        )
        .in("status", ["open", "delayed"])
        .is("deleted_at", null)
        .gt("start_time", new Date().toISOString())
        .neq("host_id", userId)
        .order("start_time", { ascending: true })
        .limit(40);

      const matching = (runs ?? []).filter(
        (r) =>
          user.pace_min! <= r.pace_max && user.pace_max! >= r.pace_min,
      );

      if (matching.length === 0) return;

      const runIds = matching.map((r) => r.id);
      const { data: parts } = await supabase
        .from("pwa_run_participants")
        .select("run_id")
        .eq("user_id", userId)
        .in("run_id", runIds)
        .in("status", ["registered", "arrived", "attended"]);

      const alreadyIn = new Set((parts ?? []).map((p) => p.run_id));
      const targets = matching
        .filter((r) => !alreadyIn.has(r.id))
        .slice(0, BACKFILL_LIMIT);

      const sub = user.push_subscription as PushSubscriptionJSON;

      if (targets.length === 1) {
        const r = targets[0];
        const host = r.host as { display_name?: string } | null;
        await sendPushToSubscription(
          sub,
          {
            title: "有符合配速的約跑",
            body: `${host?.display_name || "跑友"} · ${formatDateTime(r.start_time)} · ${paceLabel(r.pace_min)}–${paceLabel(r.pace_max)}`,
            url: `/runs/${r.id}`,
          },
          userId,
        );
        return;
      }

      if (targets.length > 1) {
        await sendPushToSubscription(
          sub,
          {
            title: "有符合配速的約跑",
            body: `目前有 ${targets.length} 場開放中，點擊查看列表`,
            url: "/",
          },
          userId,
        );
      }
    } catch {
      // swallow
    }
  })();
}
