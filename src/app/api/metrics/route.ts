import { NextRequest, NextResponse } from "next/server";

import { getRequestSession, requireRole } from "@/lib/auth";
import { renderMetrics } from "@/lib/metrics";
import { bearerToken, tokenMatches } from "@/lib/provisioning-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Prometheus scrape endpoint. Protected by METRICS_TOKEN (bearer) when set —
// the standard pattern for a scraper. With no token, an admin session is required
// in production so metrics are never exposed unauthenticated.
export async function GET(request: NextRequest) {
  const token = process.env.METRICS_TOKEN?.trim();
  if (token) {
    const provided = bearerToken(request.headers.get("authorization"));
    if (!provided || !tokenMatches(provided, token)) {
      return NextResponse.json({ error: "Invalid metrics token." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    const guard = requireRole(await getRequestSession(), "admin");
    if (!guard.ok) return guard.response;
  }

  return new NextResponse(renderMetrics(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
