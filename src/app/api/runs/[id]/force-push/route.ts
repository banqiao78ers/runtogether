import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canBroadcastPush } from "@/lib/rbac";
import { broadcastPush } from "@/lib/push";
import { formatDateTime, paceLabel } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 管理員強制推播：略過配速過濾，發送給所有已開啟推播的會員。
 */
export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!canBroadcastPush(user.role)) return jsonError("FORBIDDEN", 403);

    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select(
        `
        id, start_time, distance_km, pace_min, pace_max, status,
        custom_location, location_detail,
        host:pwa_users!host_id(display_name),
        location:pwa_locations(city, district, title)
      `,
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (["completed", "cancelled"].includes(run.status)) {
      return jsonError("RUN_CLOSED");
    }

    const host = run.host as { display_name?: string } | null;
    const loc = run.location as {
      city?: string;
      district?: string;
      title?: string;
    } | null;
    const place =
      run.custom_location ||
      (loc ? `${loc.district || ""}${loc.title || ""}`.trim() : "") ||
      "地點見詳情";
    const when = formatDateTime(run.start_time);
    const pace = `${paceLabel(run.pace_min)}–${paceLabel(run.pace_max)}`;

    const result = await broadcastPush({
      title: "活動宣傳｜板橋約跑",
      body: `${when} · ${place} · ${run.distance_km} km · ${pace} · 主揪 ${host?.display_name || "跑友"}`,
      url: `/runs/${run.id}`,
    });

    return jsonOk({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message === "VAPID keys not configured") {
      return jsonError("VAPID_NOT_CONFIGURED", 500);
    }
    return handleRouteError(err);
  }
}
