import { createHash, randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { InviteTokenPurpose, PwaInviteToken, PwaUser } from "@/types/database";

const REGISTER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generateRawInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function inviteExpiresAt(purpose: InviteTokenPurpose): Date {
  const ms = purpose === "login" ? LOGIN_TTL_MS : REGISTER_TTL_MS;
  return new Date(Date.now() + ms);
}

export function buildInviteUrl(origin: string, rawToken: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${rawToken}`;
}

export type InviteLookup =
  | { ok: true; row: PwaInviteToken }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "USED" | "REVOKED" };

export async function findInviteByRawToken(
  rawToken: string,
): Promise<InviteLookup> {
  if (!rawToken || rawToken.length < 16) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pwa_invite_tokens")
    .select("*")
    .eq("token_hash", hashInviteToken(rawToken))
    .maybeSingle();

  if (error || !data) return { ok: false, code: "NOT_FOUND" };

  const row = data as PwaInviteToken;
  if (row.revoked_at) return { ok: false, code: "REVOKED" };
  if (row.used_at) return { ok: false, code: "USED" };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: "EXPIRED" };
  }
  return { ok: true, row };
}

export async function createInviteToken(params: {
  purpose: InviteTokenPurpose;
  createdBy: string;
  userId?: string | null;
}): Promise<{ rawToken: string; row: PwaInviteToken }> {
  const rawToken = generateRawInviteToken();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pwa_invite_tokens")
    .insert({
      token_hash: hashInviteToken(rawToken),
      purpose: params.purpose,
      user_id: params.userId ?? null,
      created_by: params.createdBy,
      expires_at: inviteExpiresAt(params.purpose).toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create invite token");
  }

  return { rawToken, row: data as PwaInviteToken };
}

export async function markInviteUsed(
  inviteId: string,
  userId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pwa_invite_tokens")
    .update({
      used_at: new Date().toISOString(),
      user_id: userId,
    })
    .eq("id", inviteId)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  return !error && !!data;
}

export async function loadInviteUser(
  userId: string,
): Promise<PwaUser | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pwa_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PwaUser;
}
