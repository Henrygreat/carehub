import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  TenantAccessError,
} from "@/lib/tenant";
import { PermissionDeniedError } from "@/lib/permissions";
import { RateLimitError } from "@/lib/rate-limit";
import { requireAppUrl } from "@/lib/environment";

export function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

export function jsonError(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof TenantAccessError || error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return NextResponse.json({ error: "A record with those details already exists." }, { status: 409 });
  }
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Unable to complete the request." }, { status: 500 });
}

export function validationError(issues: unknown) {
  return NextResponse.json(
    { error: "Validation failed.", details: issues },
    { status: 400 },
  );
}

export function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const appOrigin = requireAppUrl(process.env.APP_URL);
  try {
    return new URL(origin).origin === appOrigin;
  } catch {
    return false;
  }
}
