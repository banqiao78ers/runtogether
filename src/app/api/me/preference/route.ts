import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { setUserFlagsCookie } from "@/lib/auth/flags";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parsePaceToSeconds } from "@/lib/format";
import { notifyOpenRunsMatchingUser } from "@/lib/push";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      pace_min?: string | number;
      pace_max?: string | number;
    };

    const paceMin =
      typeof body.pace_min === "number"
        ? body.pace_min
        : parsePaceToSeconds(String(body.pace_min ?? ""));
    const paceMax =
      typeof body.pace_max === "number"
        ? body.pace_max
        : parsePaceToSeconds(String(body.pace_max ?? ""));

    if (paceMin == null || paceMax == null || paceMin > paceMax) {
      return jsonError("INVALID_PACE");
    }
    if (paceMin < 180 || paceMax > 720) {
      return jsonError("PACE_OUT_OF_RANGE");
    }

    const firstPace = user.pace_min == null || user.pace_max == null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_users")
      .update({ pace_min: paceMin, pace_max: paceMax })
      .eq("id", user.id)
      .select("*")
      .single();

    if (error || !data) return jsonError("DB", 500);
    await setUserFlagsCookie(data);

    // 首次設定配速：補推目前開放中的同配速團（需已開推播）
    if (firstPace) notifyOpenRunsMatchingUser(user.id);

    return jsonOk({ ok: true, pace_min: paceMin, pace_max: paceMax });
  } catch (err) {
    return handleRouteError(err);
  }
}
