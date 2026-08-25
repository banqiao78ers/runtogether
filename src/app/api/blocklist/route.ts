import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_host_blocklists")
      .select(
        `id, blocked_user_id, created_at, blocked:pwa_users!blocked_user_id(id, display_name, avatar_url)`,
      )
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return jsonError("DB", 500);
    return jsonOk({ blocklist: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { blocked_user_id?: string };
    if (!body.blocked_user_id) return jsonError("USER_REQUIRED");
    if (body.blocked_user_id === user.id) return jsonError("CANNOT_BLOCK_SELF");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_host_blocklists")
      .upsert(
        { host_id: user.id, blocked_user_id: body.blocked_user_id },
        { onConflict: "host_id,blocked_user_id" },
      )
      .select("*")
      .single();

    if (error) return jsonError("DB", 500);
    return jsonOk({ entry: data }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const blockedUserId = new URL(request.url).searchParams.get("blocked_user_id");
    if (!blockedUserId) return jsonError("USER_REQUIRED");

    const supabase = getSupabaseAdmin();
    await supabase
      .from("pwa_host_blocklists")
      .delete()
      .eq("host_id", user.id)
      .eq("blocked_user_id", blockedUserId);

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
