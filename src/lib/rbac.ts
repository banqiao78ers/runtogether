import type { UserRole } from "@/types/database";

export function canUseCustomLocation(role: UserRole): boolean {
  return role === "super_member" || role === "admin";
}

export function isExemptFromCancelPenalty(role: UserRole): boolean {
  return role === "super_member" || role === "admin";
}

export function canManageLocations(role: UserRole): boolean {
  return role === "admin";
}

export function canDeleteAnyComment(role: UserRole): boolean {
  return role === "admin";
}

export function canReviewAppeals(role: UserRole): boolean {
  return role === "admin";
}

export function canManageUserRoles(role: UserRole): boolean {
  return role === "admin";
}

export function canBroadcastPush(role: UserRole): boolean {
  return role === "admin";
}

export function needsOnboarding(
  paceMin: number | null | undefined,
  paceMax: number | null | undefined,
): boolean {
  return paceMin == null || paceMax == null;
}
