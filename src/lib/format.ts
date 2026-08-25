export function paceLabel(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = secondsPerKm % 60;
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function parsePaceToSeconds(mmss: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(mmss.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function runEndTime(startIso: string, durationMinutes: number): Date {
  return new Date(new Date(startIso).getTime() + durationMinutes * 60_000);
}

export const ACTIVE_PARTICIPANT_STATUSES = [
  "registered",
  "arrived",
  "attended",
] as const;
