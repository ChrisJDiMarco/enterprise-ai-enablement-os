import { NextRequest, NextResponse } from "next/server";
import {
  clientKey,
  evaluateOrigin,
  evaluatePayloadSize,
  isMutationMethod,
  normalizeRequestId,
  routeLimit,
  shouldBypassMutationOriginGuard,
} from "@/lib/api-protection";

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitAllowed(request: NextRequest) {
  const { windowMs, maxRequests } = routeLimit(request.nextUrl.pathname, request.method);
  const key = clientKey(request.headers, request.nextUrl.pathname);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit: maxRequests, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function requestId(request: NextRequest) {
  return normalizeRequestId(request.headers.get("x-request-id")) || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function apiHeaders(id: string, extra?: Record<string, string>) {
  return {
    "X-Request-Id": id,
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    ...extra,
  };
}

export function proxy(request: NextRequest) {
  const id = requestId(request);

  if (isMutationMethod(request.method)) {
    const payload = evaluatePayloadSize({
      contentLength: request.headers.get("content-length"),
      transferEncoding: request.headers.get("transfer-encoding"),
      method: request.method,
    });

    if (!payload.allowed) {
      const missingLength =
        payload.reason === "missing_content_length" || payload.reason === "streaming_body_not_allowed";
      const invalidLength = payload.reason === "invalid_content_length";
      return NextResponse.json(
        {
          error: missingLength
            ? "Content-Length header is required for API mutations."
            : invalidLength
              ? "Invalid Content-Length header."
              : "Request body is too large.",
          code: missingLength ? "LENGTH_REQUIRED" : invalidLength ? "INVALID_CONTENT_LENGTH" : "PAYLOAD_TOO_LARGE",
          maxBodyBytes: payload.maxBodyBytes,
          requestId: id,
        },
        { status: missingLength ? 411 : invalidLength ? 400 : 413, headers: apiHeaders(id) },
      );
    }
  }

  if (
    isMutationMethod(request.method) &&
    !shouldBypassMutationOriginGuard({
      pathname: request.nextUrl.pathname,
      authorizationHeader: request.headers.get("authorization"),
    })
  ) {
    const origin = evaluateOrigin({
      origin: request.headers.get("origin"),
      requestOrigin: request.nextUrl.origin,
      method: request.method,
    });

    if (!origin.allowed) {
      return NextResponse.json(
        { error: "Cross-origin API mutation blocked.", code: "ORIGIN_NOT_ALLOWED", reason: origin.reason, requestId: id },
        { status: 403, headers: apiHeaders(id) },
      );
    }
  }

  const limit = rateLimitAllowed(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "API rate limit exceeded.", code: "RATE_LIMITED", requestId: id },
      {
        status: 429,
        headers: apiHeaders(id, {
          "X-RateLimit-Limit": String(limit.limit),
          "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(limit.resetAt / 1000)),
        }),
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-Request-Id", id);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-RateLimit-Limit", String(limit.limit));
  response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(limit.resetAt / 1000)));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
