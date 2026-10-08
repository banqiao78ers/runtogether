/** 公尺 → km，保留 1 位小數（與開團 distance_km 一致） */
export function metersToKm(meters: number): number {
  return Math.round((meters / 1000) * 10) / 10;
}

export function formatKm(km: number): string {
  return km.toFixed(1);
}

/** 目標距離提示：還差／已超過 */
export function remainingLabel(currentKm: number, targetKm: number | null): string | null {
  if (targetKm == null || targetKm <= 0) return null;
  const diff = Math.round((targetKm - currentKm) * 10) / 10;
  if (diff > 0) return `還差 ${formatKm(diff)} km`;
  if (diff < 0) return `已超過 ${formatKm(Math.abs(diff))} km`;
  return "已達目標距離";
}
