import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { getProductionReadiness } from "@/lib/production-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();
  const readiness = getProductionReadiness();

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.production-readiness.v1",
    generatedAt: new Date().toISOString(),
    ...readiness,
    session: session
      ? {
          organizationId: session.user.organizationId,
          role: session.user.role,
          expiresAt: session.expiresAt,
        }
      : null,
  });
}
