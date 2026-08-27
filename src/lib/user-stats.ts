import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type UserRunStats = {
  host_count: number;
  join_count: number;
  no_show_count: number;
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
