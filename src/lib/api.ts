import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/user";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(code: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.code, err.status);
  }
  console.error(err);
  return jsonError("INTERNAL", 500);
}
