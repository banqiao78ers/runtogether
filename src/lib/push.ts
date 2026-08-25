import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
): Promise<void> {
  ensureVapid();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 410 && userId) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("pwa_users")
        .update({ push_subscription: null })
        .eq("id", userId);
    }
  }
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
      const { data: users } = await supabase
        .from("pwa_users")
        .select("id, push_subscription, pace_min, pace_max")
        .not("push_subscription", "is", null)
        .not("pace_min", "is", null)
        .not("pace_max", "is", null)
        .eq("is_banned", false)
        .neq("id", run.host_id);

      const targets = (users ?? []).filter(
        (u) =>
          u.pace_min != null &&
          u.pace_max != null &&
          u.pace_min <= run.pace_max &&
          u.pace_max >= run.pace_min &&
          u.push_subscription,
      );

      await Promise.all(
        targets.map((u) =>
          sendPushToSubscription(
            u.push_subscription as PushSubscriptionJSON,
            {
              title: "New run",
              body: "A run matching your pace is open",
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
  void (async () => {
    try {
      if (userIds.length === 0) return;
      const supabase = getSupabaseAdmin();
      const { data: users } = await supabase
        .from("pwa_users")
        .select("id, push_subscription")
        .in("id", userIds)
        .not("push_subscription", "is", null);

      await Promise.all(
        (users ?? []).map((u) =>
          sendPushToSubscription(
            u.push_subscription as PushSubscriptionJSON,
            payload,
            u.id,
          ),
        ),
      );
    } catch {
      // ignore
    }
  })();
}
