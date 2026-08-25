import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { clearUserFlagsCookie } from "@/lib/auth/flags";

export async function POST() {
  await clearSessionCookie();
  await clearUserFlagsCookie();
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  await clearSessionCookie();
  await clearUserFlagsCookie();
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`);
}
