import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canBroadcastPush } from "@/lib/rbac";
import { broadcastPush } from "@/lib/push";

function validateVapidPublicKey(): { ok: boolean; reason?: string } {
  const raw =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    "";
  const publicKey = raw.trim().replace(/^["']|["']$/g, "");
  if (!publicKey) return { ok: false, reason: "未設定公鑰" };
  if (!process.env.VAPID_PRIVATE_KEY?.trim()) {
    return { ok: false, reason: "未設定私鑰" };
  }
  const padded = publicKey + "=".repeat((4 - (publicKey.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return { ok: false, reason: "公鑰無法解碼" };
  }
  if (bytes.length !== 65 || bytes[0] !== 4) {
    return { ok: false, reason: "公鑰格式錯誤" };
  }
  return { ok: true };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!canBroadcastPush(user.role)) return jsonError("FORBIDDEN", 403);

    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from("pwa_users")
      .select("id", { count: "exact", head: true })
      .not("push_subscription", "is", null)
      .eq("is_banned", false);

    const vapid = validateVapidPublicKey();
    const meHasPush = !!user.push_subscription;

    return jsonOk({
      subscribers: count ?? 0,
      vapid_ok: vapid.ok,
      vapid_reason: vapid.reason ?? null,
      me_has_push: meHasPush,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canBroadcastPush(user.role)) return jsonError("FORBIDDEN", 403);

    const vapid = validateVapidPublicKey();
    if (!vapid.ok) return jsonError("VAPID_INVALID", 500, { reason: vapid.reason });

    const body = (await request.json()) as {
      title?: string;
      body?: string;
      url?: string;
      scope?: "self" | "all";
    };

    const title = body.title?.trim() || "板橋約跑測試推播";
    const text = body.body?.trim() || "這是一則管理員測試通知";
    const url = body.url?.trim() || "/";
    const scope = body.scope === "self" ? "self" : "all";

    if (scope === "self" && !user.push_subscription) {
      return jsonError("SELF_NO_PUSH", 400);
    }

    const result = await broadcastPush(
      { title, body: text, url },
      scope === "self" ? { onlyUserId: user.id } : undefined,
    );

    return jsonOk({ ok: true, scope, ...result });
  } catch (err) {
    if (err instanceof Error && err.message === "VAPID keys not configured") {
      return jsonError("VAPID_NOT_CONFIGURED", 500);
    }
    return handleRouteError(err);
  }
}
