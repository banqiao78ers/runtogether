import { NextResponse } from "next/server";
import { buildLineAuthorizeUrl } from "@/lib/auth/line";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const state = randomBytes(16).toString("hex");
    const response = NextResponse.redirect(buildLineAuthorizeUrl(state));
    response.cookies.set("line_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(
      new URL("/login?error=config", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    );
  }
}
