import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canDeleteAnyComment } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

const lastCommentAt = new Map<string, number>();

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pwa_run_comments")
      .select(
        `id, content, created_at, user_id, user:pwa_users!user_id(id, display_name, avatar_url)`,
      )
      .eq("run_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return jsonError("DB", 500);
    return jsonOk({ comments: data ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content || content.length > 500) return jsonError("INVALID_CONTENT");

    const key = `${user.id}:${id}`;
    const last = lastCommentAt.get(key) ?? 0;
    if (Date.now() - last < 5000) return jsonError("COOLDOWN", 429);
    lastCommentAt.set(key, Date.now());

    const supabase = getSupabaseAdmin();
    const { data: run } = await supabase
      .from("pwa_runs")
      .select("host_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!run) return jsonError("NOT_FOUND", 404);

    const isHost = run.host_id === user.id;
    const { data: part } = await supabase
      .from("pwa_run_participants")
      .select("id")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .in("status", ["registered", "arrived", "attended"])
      .maybeSingle();

    if (!isHost && !part) return jsonError("FORBIDDEN", 403);

    const { data: comment, error } = await supabase
      .from("pwa_run_comments")
      .insert({ run_id: id, user_id: user.id, content })
      .select(
        `id, content, created_at, user_id, user:pwa_users!user_id(id, display_name, avatar_url)`,
      )
      .single();

    if (error) return jsonError("DB", 500);
    return jsonOk({ comment }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id: runId } = await ctx.params;
    const commentId = new URL(request.url).searchParams.get("commentId");
    if (!commentId) return jsonError("COMMENT_ID_REQUIRED");

    const supabase = getSupabaseAdmin();
    const { data: comment } = await supabase
      .from("pwa_run_comments")
      .select("*, run:pwa_runs!run_id(host_id)")
      .eq("id", commentId)
      .eq("run_id", runId)
      .maybeSingle();

    if (!comment) return jsonError("NOT_FOUND", 404);

    const hostId = (comment.run as { host_id?: string } | null)?.host_id;
    const allowed =
      canDeleteAnyComment(user.role) ||
      comment.user_id === user.id ||
      hostId === user.id;

    if (!allowed) return jsonError("FORBIDDEN", 403);

    await supabase
      .from("pwa_run_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
