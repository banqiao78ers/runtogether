import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();
    const me = await getCurrentUser();

    const { data: run, error } = await supabase
      .from("pwa_runs")
      .select(
        `
        *,
        host:pwa_users!host_id(id, display_name, avatar_url, role),
        location:pwa_locations(id, city, district, title, description)
      `,
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !run) return jsonError("NOT_FOUND", 404);

    const { data: participants } = await supabase
      .from("pwa_run_participants")
      .select(
        `id, status, arrived_at, user_id, user:pwa_users!user_id(id, display_name, avatar_url)`,
      )
      .eq("run_id", id)
      .neq("status", "cancelled");

    const { data: comments } = await supabase
      .from("pwa_run_comments")
      .select(
        `id, content, created_at, user_id, user:pwa_users!user_id(id, display_name, avatar_url)`,
      )
      .eq("run_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const activeCount = (participants ?? []).filter((p) =>
      ["registered", "arrived", "attended"].includes(p.status),
    ).length;

    const myParticipation = me
      ? (participants ?? []).find((p) => p.user_id === me.id) ?? null
      : null;

    return jsonOk({
      run,
      participants: participants ?? [],
      comments: comments ?? [],
      participant_count: activeCount,
      me: me
        ? {
            id: me.id,
            role: me.role,
            is_host: run.host_id === me.id,
            participation: myParticipation,
          }
        : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Soft-delete only — time/location locked after create */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!run) return jsonError("NOT_FOUND", 404);
    if (run.host_id !== user.id && user.role !== "admin") {
      return jsonError("FORBIDDEN", 403);
    }

    await supabase
      .from("pwa_runs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
