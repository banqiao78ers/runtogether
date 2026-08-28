import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/inspect-run.mjs <run-id>");
  process.exit(1);
}

const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};

async function get(path) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return JSON.parse(text);
}

const runRows = await get(
  `/pwa_runs?id=eq.${runId}&select=id,start_time,status,created_at,updated_at,start_reminder_sent_at,completion_reminder_sent_at,host_id,custom_location,estimated_duration_minutes`,
);
const run = runRows[0];
if (!run) {
  console.log(JSON.stringify({ error: "RUN_NOT_FOUND", runId }, null, 2));
  process.exit(0);
}

const parts = await get(
  `/pwa_run_participants?run_id=eq.${runId}&select=user_id,status,created_at`,
);

const users = [];
for (const part of parts) {
  const rows = await get(
    `/pwa_users?id=eq.${part.user_id}&select=id,display_name,role,push_subscription`,
  );
  const user = rows[0];
  users.push({
    ...part,
    display_name: user?.display_name ?? null,
    role: user?.role ?? null,
    has_push: !!user?.push_subscription,
  });
}

const start = new Date(run.start_time);
const created = new Date(run.created_at);
const now = new Date();

const report = {
  run: {
    ...run,
    start_time_taipei: start.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    created_at_taipei: created.toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
    }),
  },
  participants: users,
  analysis: {
    now_taipei: now.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    hours_from_create_to_start:
      Math.round(((start - created) / 3600000) * 10) / 10,
    ms_until_start_at_create: start - created,
    start_reminder_sent: !!run.start_reminder_sent_at,
    completion_reminder_sent: !!run.completion_reminder_sent_at,
  },
};

console.log(JSON.stringify(report, null, 2));
