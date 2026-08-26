import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCustomLocation } from "@/lib/rbac";
import { notifyRunCreated } from "@/lib/push";
import { runEndTime, UNLIMITED_PARTICIPANTS } from "@/lib/format";

const BANQIAO_DISTRICT = "\u677f\u6a4b\u5340"; // 板橋區

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "upcoming";
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("pwa_runs")
      .select(
        `
        *,
        host:pwa_users!host_id(id, display_name, avatar_url, role),
        location:pwa_locations(id, city, district, title),
        participants:pwa_run_participants(id, status)
      `,
      )
      .is("deleted_at", null)
      .order("start_time", { ascending: true });

    if (status === "upcoming") {
      query = query
        .in("status", ["open", "delayed", "ongoing"])
        .gte(
          "start_time",
          new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        );
    } else if (status === "past") {
      query = query
        .in("status", ["completed", "cancelled"])
        .order("start_time", { ascending: false });
    }

    const { data, error } = await query.limit(50);
    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }

    const runs = (data ?? []).map((r) => {
      const active = (r.participants ?? []).filter((p: { status: string }) =>
        ["registered", "arrived", "attended"].includes(p.status),
      ).length;
      return { ...r, participant_count: active, participants: undefined };
    });

    return jsonOk({ runs });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.is_banned) return jsonError("BANNED", 403);

    const body = (await request.json()) as {
      location_id?: string | null;
      custom_location?: string | null;
      location_detail?: string | null;
      destination?: string | null;
      start_time: string;
      estimated_duration_minutes?: number;
      distance_km: number;
      pace_min: number;
      pace_max: number;
      max_participants?: number;
      note?: string | null;
    };

    if (
      !body.start_time ||
      body.distance_km == null ||
      !body.pace_min ||
      !body.pace_max
    ) {
      return jsonError("INVALID_BODY");
    }
    if (body.pace_min > body.pace_max) return jsonError("INVALID_PACE");

    const maxParticipants = body.max_participants ?? UNLIMITED_PARTICIPANTS;
    if (
      maxParticipants !== UNLIMITED_PARTICIPANTS &&
      (maxParticipants < 2 || maxParticipants > 50)
    ) {
      return jsonError("INVALID_BODY");
    }

    const duration = body.estimated_duration_minutes ?? 60;
    const start = new Date(body.start_time);
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() < Date.now() - 60_000
    ) {
      return jsonError("INVALID_START");
    }

    let locationId = body.location_id ?? null;
    let customLocation = body.custom_location?.trim() || null;

    if (canUseCustomLocation(user.role)) {
      if (!locationId && !customLocation) return jsonError("LOCATION_REQUIRED");
    } else {
      customLocation = null;
      if (!locationId) return jsonError("LOCATION_REQUIRED");
      const supabaseCheck = getSupabaseAdmin();
      const { data: loc } = await supabaseCheck
        .from("pwa_locations")
        .select("*")
        .eq("id", locationId)
        .eq("is_active", true)
        .maybeSingle();
      if (!loc || loc.district !== BANQIAO_DISTRICT) {
        return jsonError("BANQIAO_ONLY", 403);
      }
    }

    const supabase = getSupabaseAdmin();
    const end = runEndTime(body.start_time, duration);

    const { data: overlap } = await supabase.rpc("pwa_user_has_time_overlap", {
      p_user_id: user.id,
      p_start: body.start_time,
      p_end: end.toISOString(),
      p_exclude_run_id: null,
    });

    if (overlap === true) return jsonError("TIME_OVERLAP", 409);

    const { data: run, error } = await supabase
      .from("pwa_runs")
      .insert({
        host_id: user.id,
        location_id: locationId,
        custom_location: customLocation,
        location_detail: body.location_detail ?? null,
        destination: body.destination ?? null,
        start_time: body.start_time,
        estimated_duration_minutes: duration,
        distance_km: body.distance_km,
        pace_min: body.pace_min,
        pace_max: body.pace_max,
        max_participants: maxParticipants,
        note: body.note ?? null,
        status: "open",
      })
      .select("*")
      .single();

    if (error || !run) {
      console.error(error);
      return jsonError("DB", 500);
    }

    await supabase.from("pwa_run_participants").insert({
      run_id: run.id,
      user_id: user.id,
      status: "registered",
    });

    notifyRunCreated(run);

    return jsonOk({ run }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
