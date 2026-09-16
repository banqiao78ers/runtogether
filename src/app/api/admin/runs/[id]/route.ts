import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canManageRuns } from "@/lib/rbac";
import { UNLIMITED_PARTICIPANTS } from "@/lib/format";
import type { ParticipantStatus, RunStatus } from "@/types/database";

type Ctx = { params: Promise<{ id: string }> };

const RUN_STATUSES: RunStatus[] = [
  "open",
  "delayed",
  "ongoing",
  "completed",
  "cancelled",
];

const PARTICIPANT_STATUSES: ParticipantStatus[] = [
  "registered",
  "arrived",
  "attended",
  "cancelled",
  "no_show",
];

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!canManageRuns(user.role)) return jsonError("FORBIDDEN", 403);

    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { data: run, error } = await supabase
      .from("pwa_runs")
      .select(
        `
        *,
        host:pwa_users!host_id(id, display_name, avatar_url, role),
        location:pwa_locations(id, city, district, title)
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !run) return jsonError("NOT_FOUND", 404);

    const { data: participants } = await supabase
      .from("pwa_run_participants")
      .select(
        `id, status, arrived_at, user_id, created_at, updated_at,
         user:pwa_users!user_id(id, display_name, avatar_url)`,
      )
      .eq("run_id", id)
      .order("created_at", { ascending: true });

    return jsonOk({
      run,
      participants: participants ?? [],
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!canManageRuns(user.role)) return jsonError("FORBIDDEN", 403);

    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      location_id?: string | null;
      custom_location?: string | null;
      location_detail?: string | null;
      destination?: string | null;
      start_time?: string;
      estimated_duration_minutes?: number;
      distance_km?: number;
      pace_min?: number;
      pace_max?: number;
      max_participants?: number;
      note?: string | null;
      status?: RunStatus;
      cancel_reason?: string | null;
      delay_count?: number;
      total_delayed_minutes?: number;
      deleted?: boolean;
      participants?: Array<{ user_id: string; status: ParticipantStatus }>;
    };

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("pwa_runs")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return jsonError("NOT_FOUND", 404);

    if (body.status != null && !RUN_STATUSES.includes(body.status)) {
      return jsonError("INVALID_BODY");
    }
    if (
      body.pace_min != null &&
      body.pace_max != null &&
      body.pace_min > body.pace_max
    ) {
      return jsonError("INVALID_PACE");
    }
    if (
      body.max_participants != null &&
      body.max_participants !== UNLIMITED_PARTICIPANTS &&
      (body.max_participants < 2 || body.max_participants > 100)
    ) {
      return jsonError("INVALID_BODY");
    }

    const patch: Record<string, unknown> = {};
    const assign = <K extends keyof typeof body>(key: K, column = key as string) => {
      if (body[key] !== undefined) patch[column] = body[key];
    };

    assign("location_id");
    assign("custom_location");
    assign("location_detail");
    assign("destination");
    assign("start_time");
    assign("estimated_duration_minutes");
    assign("distance_km");
    assign("pace_min");
    assign("pace_max");
    assign("max_participants");
    assign("note");
    assign("status");
    assign("cancel_reason");
    assign("delay_count");
    assign("total_delayed_minutes");

    if (body.deleted === true) {
      patch.deleted_at = new Date().toISOString();
    } else if (body.deleted === false) {
      patch.deleted_at = null;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("pwa_runs")
        .update(patch)
        .eq("id", id);
      if (error) {
        console.error(error);
        return jsonError("DB", 500);
      }
    }

    if (body.participants?.length) {
      for (const p of body.participants) {
        if (!p.user_id || !PARTICIPANT_STATUSES.includes(p.status)) {
          return jsonError("INVALID_ATTENDANCE_STATUS");
        }
        const { error } = await supabase
          .from("pwa_run_participants")
          .update({ status: p.status })
          .eq("run_id", id)
          .eq("user_id", p.user_id);
        if (error) {
          console.error(error);
          return jsonError("DB", 500);
        }
      }
    }

    const { data: run } = await supabase
      .from("pwa_runs")
      .select(
        `
        *,
        host:pwa_users!host_id(id, display_name, avatar_url, role),
        location:pwa_locations(id, city, district, title)
      `,
      )
      .eq("id", id)
      .maybeSingle();

    const { data: participants } = await supabase
      .from("pwa_run_participants")
      .select(
        `id, status, arrived_at, user_id, created_at, updated_at,
         user:pwa_users!user_id(id, display_name, avatar_url)`,
      )
      .eq("run_id", id)
      .order("created_at", { ascending: true });

    return jsonOk({ run, participants: participants ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}
