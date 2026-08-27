import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_host_follows")
      .select(
        `id, host_id, created_at, user:pwa_users!host_id(id, display_name, avatar_url)`,
      )
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return jsonError("DB", 500);
    return jsonOk({ follows: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}
