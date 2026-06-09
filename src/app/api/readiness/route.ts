import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { getProductionReadiness } from "@/lib/production-readiness";
import { buildPublicReadinessResponse } from "@/lib/readiness-response";
import { loadTenantReadinessContext } from "@/lib/tenant-readiness-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();
  if (!session) {
    return NextResponse.json(buildPublicReadinessResponse());
  }

  const tenantReadiness = await loadTenantReadinessContext({ session });
  const readiness = getProductionReadiness(tenantReadiness.options);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.production-readiness.v1",
    generatedAt: new Date().toISOString(),
    ...readiness,
    tenantEvidence: {
      loaded: tenantReadiness.tenantEvidenceLoaded,
      errors: tenantReadiness.evidenceErrors,
    },
    session: session
      ? {
          organizationId: session.user.organizationId,
          role: session.user.role,
          expiresAt: session.expiresAt,
        }
      : null,
  });
}
