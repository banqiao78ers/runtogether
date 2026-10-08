import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** 載入單一路線（含 geometry／waypoints） */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (!id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_routes")
      .select(
        "id, title, distance_m, elevation_gain_m, geometry, waypoints, prefs, created_at, updated_at",
      )
      .eq("id", id)
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }
    if (!data) return jsonError("NOT_FOUND", 404);
    return jsonOk({ route: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 更新公開分享狀態等 */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (!id) return jsonError("ID_REQUIRED");

    const body = (await request.json()) as {
      is_public?: boolean;
      title?: string;
    };

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) return jsonError("TITLE_REQUIRED");
      if (title.length > 100) return jsonError("TITLE_TOO_LONG");
      patch.title = title;
    }
    if (Object.keys(patch).length <= 1) return jsonError("INVALID_BODY");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_routes")
      .update(patch)
      .eq("id", id)
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .select("id, title, distance_m, is_public, created_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }
    if (!data) return jsonError("NOT_FOUND", 404);
    return jsonOk({ route: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 軟刪除 */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (!id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_routes")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }
    if (!data) return jsonError("NOT_FOUND", 404);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
