import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canManageRuns } from "@/lib/rbac";

const PAGE_SIZE = 50;
const SEARCH_SCAN_LIMIT = 400;

type HostRef = { id: string; display_name: string } | null;
type LocRef = {
  city: string;
  district: string;
  title: string;
} | null;

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageRuns(user.role)) return jsonError("FORBIDDEN", 403);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const includeDeleted = searchParams.get("include_deleted") === "1";
    const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("pwa_runs")
      .select(
        `
        id, status, start_time, distance_km, pace_min, pace_max,
        max_participants, custom_location, location_detail, destination,
        cancel_reason, deleted_at, created_at, updated_at,
        host:pwa_users!host_id(id, display_name),
        location:pwa_locations(id, city, district, title),
        participants:pwa_run_participants(id, status)
      `,
        { count: "exact" },
      )
      .order("start_time", { ascending: false });

    if (status === "deleted") {
      query = query.not("deleted_at", "is", null);
    } else {
      if (!includeDeleted) {
        query = query.is("deleted_at", null);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }
    }

    if (q) {
      query = query.limit(SEARCH_SCAN_LIMIT);
    } else {
      query = query.range(from, to);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }

    let runs = (data ?? []).map((r) => {
      const active = (r.participants ?? []).filter((p: { status: string }) =>
        ["registered", "arrived", "attended"].includes(p.status),
      ).length;
      return {
        ...r,
        host: asOne(r.host as HostRef | HostRef[]),
        location: asOne(r.location as LocRef | LocRef[]),
        participant_count: active,
        participants: undefined,
      };
    });

    if (q) {
      runs = runs.filter((r) => {
        const hay = [
          r.host?.display_name,
          r.custom_location,
          r.location_detail,
          r.destination,
          r.location?.title,
          r.location?.district,
          r.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
      const total = runs.length;
      runs = runs.slice(from, from + PAGE_SIZE);
      return jsonOk({
        runs,
        page,
        page_size: PAGE_SIZE,
        total,
      });
    }

    return jsonOk({
      runs,
      page,
      page_size: PAGE_SIZE,
      total: count ?? runs.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
