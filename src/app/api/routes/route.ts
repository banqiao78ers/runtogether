import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type WaypointBody = { lat: number; lng: number };

function isWaypoint(p: unknown): p is WaypointBody {
  if (!p || typeof p !== "object") return false;
  const { lat, lng } = p as WaypointBody;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function isLineString(g: unknown): g is {
  type: "LineString";
  coordinates: [number, number][];
} {
  if (!g || typeof g !== "object") return false;
  const geom = g as { type?: string; coordinates?: unknown };
  return (
    geom.type === "LineString" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2
  );
}

/** 我的路線列表 */
export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_routes")
      .select(
        "id, title, distance_m, elevation_gain_m, created_at, updated_at",
      )
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }
    return jsonOk({ routes: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 儲存路線（需名稱） */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      title?: string;
      distance_m?: number;
      geometry?: unknown;
      waypoints?: unknown;
      prefs?: unknown;
    };

    const title = body.title?.trim() ?? "";
    if (!title) return jsonError("TITLE_REQUIRED");
    if (title.length > 100) return jsonError("TITLE_TOO_LONG");

    if (
      typeof body.distance_m !== "number" ||
      !Number.isFinite(body.distance_m) ||
      body.distance_m < 0
    ) {
      return jsonError("DISTANCE_REQUIRED");
    }

    if (!isLineString(body.geometry)) return jsonError("GEOMETRY_REQUIRED");
    if (!Array.isArray(body.waypoints) || body.waypoints.length < 2) {
      return jsonError("POINTS_REQUIRED");
    }
    if (!body.waypoints.every(isWaypoint)) return jsonError("INVALID_POINTS");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_routes")
      .insert({
        creator_id: user.id,
        title,
        distance_m: Math.round(body.distance_m),
        geometry: body.geometry,
        waypoints: body.waypoints,
        prefs: body.prefs ?? null,
      })
      .select(
        "id, title, distance_m, elevation_gain_m, geometry, waypoints, created_at, updated_at",
      )
      .single();

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }
    return jsonOk({ route: data }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
