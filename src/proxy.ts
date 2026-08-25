import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromRequest,
  refreshSessionOnResponse,
} from "@/lib/auth/session";

const PUBLIC_EXACT = new Set(["/login", "/manifest.webmanifest", "/sw.js"]);

function isPublicPath(pathname: string, method: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (method === "GET" && pathname === "/api/runs") return true;
  if (method === "GET" && /^\/api\/runs\/[^/]+$/.test(pathname)) return true;
  if (method === "GET" && pathname === "/api/locations") return true;
  if (pathname === "/" || pathname.startsWith("/runs/")) {
    if (pathname === "/runs/new") return false;
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);
  const publicPath = isPublicPath(pathname, method);

  if (!session && !publicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!session) {
    return NextResponse.next();
  }

  const flagsRaw = request.cookies.get("bq_flags")?.value;
  if (flagsRaw && !pathname.startsWith("/api/")) {
    try {
      const flags = JSON.parse(flagsRaw) as {
        banned?: boolean;
        needsPace?: boolean;
      };

      if (
        flags.banned &&
        !pathname.startsWith("/banned") &&
        pathname !== "/login"
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/banned";
        return NextResponse.redirect(url);
      }

      if (
        flags.needsPace &&
        !flags.banned &&
        !pathname.startsWith("/onboarding") &&
        !pathname.startsWith("/banned")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding/preference";
        return NextResponse.redirect(url);
      }
    } catch {
      // ignore bad flags
    }
  }

  const response = NextResponse.next();
  return refreshSessionOnResponse(response, session);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
