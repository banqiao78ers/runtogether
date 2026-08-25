import { cookies } from "next/headers";
import { needsOnboarding } from "@/lib/rbac";
import type { PwaUser } from "@/types/database";

export const FLAGS_COOKIE = "bq_flags";

export async function setUserFlagsCookie(user: PwaUser) {
  const jar = await cookies();
  const value = JSON.stringify({
    banned: user.is_banned,
    needsPace: needsOnboarding(user.pace_min, user.pace_max),
  });
  jar.set(FLAGS_COOKIE, value, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearUserFlagsCookie() {
  const jar = await cookies();
  jar.set(FLAGS_COOKIE, "", { path: "/", maxAge: 0 });
}
