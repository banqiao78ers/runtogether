import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 公開分享路線（僅 is_public=true）。
 * 不需登入。
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_routes")
      .select(
        `
        id, title, distance_m, elevation_gain_m, geometry, waypoints, created_at,
        creator:pwa_users!creator_id(display_name)
      `,
      )
      .eq("id", id)
      .eq("is_public", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }
    if (!data) return jsonError("NOT_FOUND", 404);

    const creator = data.creator as { display_name?: string } | null;
    return jsonOk({
      route: {
        id: data.id,
        title: data.title,
        distance_m: data.distance_m,
        elevation_gain_m: data.elevation_gain_m,
        geometry: data.geometry,
        waypoints: data.waypoints,
        created_at: data.created_at,
        creator_name: creator?.display_name ?? null,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
