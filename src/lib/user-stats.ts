import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type UserRunStats = {
  host_count: number;
  join_count: number;
  no_show_count: number;
};

export type UserHistoryItem = {
  run_id: string;
  start_time: string;
  distance_km: number;
  status: string;
  role: "host" | "join" | "no_show";
  place: string;
};

/** 已結案活動的出席統計（主揪／跟團／缺席） */
export async function getUserRunStats(userId: string): Promise<UserRunStats> {
  const supabase = getSupabaseAdmin();

  const { count: hostCount } = await supabase
    .from("pwa_runs")
    .select("*", { count: "exact", head: true })
    .eq("host_id", userId)
    .eq("status", "completed")
    .is("deleted_at", null);

  const { data: parts } = await supabase
    .from("pwa_run_participants")
    .select("status, run_id")
    .eq("user_id", userId)
    .in("status", ["attended", "no_show"]);

  const runIds = [...new Set((parts ?? []).map((p) => p.run_id))];
  if (runIds.length === 0) {
    return {
      host_count: hostCount ?? 0,
      join_count: 0,
      no_show_count: 0,
    };
  }

  const { data: runs } = await supabase
    .from("pwa_runs")
    .select("id, host_id")
    .in("id", runIds)
    .eq("status", "completed")
    .is("deleted_at", null);

  const completed = new Map((runs ?? []).map((r) => [r.id, r.host_id]));

  let joinCount = 0;
  let noShowCount = 0;
  for (const p of parts ?? []) {
    const runHostId = completed.get(p.run_id);
    if (!runHostId) continue;
    if (p.status === "no_show") {
      noShowCount += 1;
    } else if (p.status === "attended" && runHostId !== userId) {
      joinCount += 1;
    }
  }

  return {
    host_count: hostCount ?? 0,
    join_count: joinCount,
    no_show_count: noShowCount,
  };
}

type Loc = { city: string; district: string; title: string };

function normalizeLocation(
  location: Loc | Loc[] | null | undefined,
): Loc | null {
  if (!location) return null;
  return Array.isArray(location) ? (location[0] ?? null) : location;
}

function placeLabel(run: {
  custom_location: string | null;
  location?: Loc | Loc[] | null;
}): string {
  if (run.custom_location) return run.custom_location;
  const loc = normalizeLocation(run.location);
  if (loc) return `${loc.city}${loc.district} ${loc.title}`;
  return "—";
}

/** 近期活動歷程（主揪或報名過的場次，含進行中／已結案／已取消） */
export async function getUserRunHistory(
  userId: string,
  limit = 30,
): Promise<UserHistoryItem[]> {
  const supabase = getSupabaseAdmin();

  const [{ data: hosted }, { data: parts }] = await Promise.all([
    supabase
      .from("pwa_runs")
      .select(
        `id, start_time, distance_km, status, host_id, custom_location,
         location:pwa_locations(city, district, title)`,
      )
      .eq("host_id", userId)
      .is("deleted_at", null)
      .order("start_time", { ascending: false })
      .limit(limit),
    supabase
      .from("pwa_run_participants")
      .select("status, run_id")
      .eq("user_id", userId)
      .neq("status", "cancelled"),
  ]);

  const partByRun = new Map(
    (parts ?? []).map((p) => [p.run_id, p.status as string]),
  );
  const joinedIds = [...partByRun.keys()].filter(
    (id) => !(hosted ?? []).some((r) => r.id === id),
  );

  let joinedRuns: typeof hosted = [];
  if (joinedIds.length > 0) {
    const { data } = await supabase
      .from("pwa_runs")
      .select(
        `id, start_time, distance_km, status, host_id, custom_location,
         location:pwa_locations(city, district, title)`,
      )
      .in("id", joinedIds)
      .is("deleted_at", null)
      .order("start_time", { ascending: false })
      .limit(limit);
    joinedRuns = data ?? [];
  }

  type RunRow = {
    id: string;
    start_time: string;
    distance_km: number;
    status: string;
    host_id: string;
    custom_location: string | null;
    location?: Loc | Loc[] | null;
  };

  const all = new Map<string, RunRow>();
  for (const r of [...(hosted ?? []), ...(joinedRuns ?? [])]) {
    all.set(r.id, r as unknown as RunRow);
  }

  const items: UserHistoryItem[] = [];
  for (const run of all.values()) {
    const partStatus = partByRun.get(run.id);
    let role: UserHistoryItem["role"];
    if (run.host_id === userId) {
      role = "host";
    } else if (partStatus === "no_show") {
      role = "no_show";
    } else {
      role = "join";
    }
    items.push({
      run_id: run.id,
      start_time: run.start_time,
      distance_km: Number(run.distance_km),
      status: run.status,
      role,
      place: placeLabel(run),
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );
  return items.slice(0, limit);
}
