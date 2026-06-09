import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { checkDatabaseHealth } from "@/lib/database";
import { getProductionReadiness } from "@/lib/production-readiness";
import { buildPublicReadyResponse, buildReadyResponse, readyScopeFromSearchParams } from "@/lib/ready-response";
import { loadTenantReadinessContext } from "@/lib/tenant-readiness-context";
import type { ProductionReadiness } from "@/lib/ui/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const scope = readyScopeFromSearchParams(request.nextUrl.searchParams);
    const session = await getRequestSession();
    const tenantReadiness = await loadTenantReadinessContext({
      session,
      includeFallbackTenant: true,
    });
    const database = await checkDatabaseHealth();
    const readiness = getProductionReadiness(tenantReadiness.options) as ProductionReadiness;
    const ready = buildReadyResponse({
      scope,
      database,
      readiness,
      organizationId: tenantReadiness.organizationId,
      tenantEvidence: {
        loaded: tenantReadiness.tenantEvidenceLoaded,
        errors: tenantReadiness.evidenceErrors,
      },
    });

    const response = session ? ready : buildPublicReadyResponse(ready);

    return NextResponse.json(response.payload, { status: response.statusCode });
  } catch {
    return NextResponse.json(
      {
        schema: "enterprise-ai-enablement-os.ready.v1",
        public: true,
        ok: false,
        scope: "serving",
        status: "blocked",
        error: "Readiness check failed.",
        generatedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
