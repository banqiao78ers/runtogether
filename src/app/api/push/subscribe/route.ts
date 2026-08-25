import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PushSubscriptionJSON } from "@/types/database";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { subscription?: PushSubscriptionJSON };
    if (!body.subscription?.endpoint || !body.subscription.keys) {
      return jsonError("INVALID_SUBSCRIPTION");
    }

    const supabase = getSupabaseAdmin();
    await supabase
      .from("pwa_users")
      .update({ push_subscription: body.subscription })
      .eq("id", user.id);

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();
    await supabase
      .from("pwa_users")
      .update({ push_subscription: null })
      .eq("id", user.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
