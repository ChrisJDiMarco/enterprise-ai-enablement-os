import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRequestSession, requireRole } from "@/lib/auth";
import { observabilityConfigFromEnv, recordOperationalEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const eventSchema = z.object({
  name: z.string().trim().min(2).max(160),
  level: z.enum(["info", "warn", "error"]).default("info"),
  route: z.string().trim().max(240).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.observability-readiness.v1",
    generatedAt: new Date().toISOString(),
    config: observabilityConfigFromEnv(),
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid observability event payload.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "body",
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const delivery = await recordOperationalEvent({
    organizationId: guard.session.user.organizationId,
    actor: guard.session.user.name,
    ...parsed.data,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.observability-event-delivery.v1",
    config: observabilityConfigFromEnv(),
    delivery,
  });
}
