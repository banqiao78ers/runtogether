import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionFromCookies } from "@/lib/auth/session";
import type { PwaUser } from "@/types/database";

export async function getCurrentUser(): Promise<PwaUser | null> {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pwa_users")
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as PwaUser;
}

export async function requireUser(): Promise<PwaUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("UNAUTHORIZED", 401);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
