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

/** 配速選單：秒僅 0 / 15 / 30 */
export const PACE_SECOND_OPTIONS = [0, 15, 30] as const;
export const PACE_MINUTE_MIN = 3;
export const PACE_MINUTE_MAX = 12;

export function combinePace(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}

/** 將任意秒／公里對齊到選單可用的分＋0/15/30 */
export function snapPaceToStep(totalSeconds: number): number {
  const clamped = Math.min(
    PACE_MINUTE_MAX * 60,
    Math.max(PACE_MINUTE_MIN * 60, totalSeconds),
  );
  let best = PACE_MINUTE_MIN * 60;
  let bestDist = Infinity;
  for (let m = PACE_MINUTE_MIN; m <= PACE_MINUTE_MAX; m++) {
    for (const s of PACE_SECOND_OPTIONS) {
      if (m === PACE_MINUTE_MAX && s > 0) continue;
      const candidate = combinePace(m, s);
      const dist = Math.abs(candidate - clamped);
      if (dist < bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
  }
  return best;
}

export function splitPace(totalSeconds: number): {
  minutes: number;
  seconds: number;
} {
  const snapped = snapPaceToStep(totalSeconds);
  return {
    minutes: Math.floor(snapped / 60),
    seconds: snapped % 60,
  };
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

const RUN_STATUS_ZH: Record<string, string> = {
  open: "報名中",
  delayed: "已延期",
  ongoing: "進行中",
  completed: "已結案",
  cancelled: "已取消",
};

const PARTICIPANT_STATUS_ZH: Record<string, string> = {
  registered: "已報名",
  arrived: "已到達",
  attended: "已出席",
  cancelled: "已取消報名",
  no_show: "未到",
};

const ROLE_ZH: Record<string, string> = {
  member: "一般會員",
  super_member: "超級會員",
  admin: "管理員",
};

const APPEAL_STATUS_ZH: Record<string, string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "已駁回",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_ZH[status] ?? status;
}

export function participantStatusLabel(status: string): string {
  return PARTICIPANT_STATUS_ZH[status] ?? status;
}

export function roleLabel(role: string): string {
  return ROLE_ZH[role] ?? role;
}

export function appealStatusLabel(status: string): string {
  return APPEAL_STATUS_ZH[status] ?? status;
}

/** 首頁列表用狀態徽章 */
export function runListBadge(status: string, full: boolean): string {
  if (status === "delayed") return "已延期";
  if (status === "ongoing") return "進行中";
  if (status === "completed") return "已結案";
  if (status === "cancelled") return "已取消";
  if (full) return "額滿";
  return "報名中";
}
