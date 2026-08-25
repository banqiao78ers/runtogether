import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canManageLocations } from "@/lib/rbac";

const DEFAULT_CITY = "\u65b0\u5317\u5e02"; // 新北市
const DEFAULT_DISTRICT = "\u677f\u6a4b\u5340"; // 板橋區

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_locations")
      .select("*")
      .eq("is_active", true)
      .order("district")
      .order("title");

    if (error) return jsonError("DB", 500);
    return jsonOk({ locations: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageLocations(user.role)) return jsonError("FORBIDDEN", 403);

    const body = (await request.json()) as {
      city?: string;
      district?: string;
      title?: string;
      description?: string;
    };
    if (!body.title?.trim()) return jsonError("TITLE_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_locations")
      .insert({
        city: body.city || DEFAULT_CITY,
        district: body.district || DEFAULT_DISTRICT,
        title: body.title.trim(),
        description: body.description ?? null,
      })
      .select("*")
      .single();

    if (error) return jsonError("DB", 500);
    return jsonOk({ location: data }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageLocations(user.role)) return jsonError("FORBIDDEN", 403);

    const body = (await request.json()) as {
      id?: string;
      title?: string;
      city?: string;
      district?: string;
      description?: string | null;
      is_active?: boolean;
    };
    if (!body.id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_locations")
      .update({
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.city != null ? { city: body.city } : {}),
        ...(body.district != null ? { district: body.district } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.is_active != null ? { is_active: body.is_active } : {}),
      })
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) return jsonError("DB", 500);
    return jsonOk({ location: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageLocations(user.role)) return jsonError("FORBIDDEN", 403);

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    await supabase
      .from("pwa_locations")
      .update({ is_active: false })
      .eq("id", id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
