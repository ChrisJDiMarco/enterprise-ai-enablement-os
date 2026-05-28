import { NextRequest, NextResponse } from "next/server";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const buckets = new Map<string, { count: number; resetAt: number }>();

function trustedOrigins(request: NextRequest) {
  const configured = (process.env.API_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([request.nextUrl.origin, ...configured]);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return trustedOrigins(request).has(origin);
}

function rateLimitAllowed(request: NextRequest) {
  const windowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60_000);
  const maxRequests = Number(process.env.API_RATE_LIMIT_MAX || 180);
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function proxy(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  const maxBodyBytes = Number(process.env.API_MAX_BODY_BYTES || 5_000_000);

  if (mutationMethods.has(request.method)) {
    if (!originAllowed(request)) {
      return NextResponse.json(
        { error: "Cross-origin API mutation blocked.", code: "ORIGIN_NOT_ALLOWED" },
        { status: 403 },
      );
    }

    if (contentLength > maxBodyBytes) {
      return NextResponse.json(
        { error: "Request body is too large.", code: "PAYLOAD_TOO_LARGE", maxBodyBytes },
        { status: 413 },
      );
    }
  }

  const limit = rateLimitAllowed(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "API rate limit exceeded.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
