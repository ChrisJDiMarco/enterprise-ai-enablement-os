import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { checkDatabaseHealth } from "@/lib/database";
import { getProductionReadiness } from "@/lib/production-readiness";
import { loadTenantReadinessContext } from "@/lib/tenant-readiness-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getRequestSession();
    const tenantReadiness = await loadTenantReadinessContext({
      session,
      includeFallbackTenant: true,
    });
    const database = await checkDatabaseHealth();
    const readiness = getProductionReadiness(tenantReadiness.options);
    const ok = database.ok && readiness.status !== "blocked";

    return NextResponse.json(
      {
        schema: "enterprise-ai-enablement-os.ready.v1",
        ok,
        status: readiness.status,
        database,
        organizationId: tenantReadiness.organizationId,
        tenantEvidence: {
          loaded: tenantReadiness.tenantEvidenceLoaded,
          errors: tenantReadiness.evidenceErrors,
        },
        blockers: readiness.blockers,
        warnings: readiness.warnings,
        generatedAt: new Date().toISOString(),
      },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        schema: "enterprise-ai-enablement-os.ready.v1",
        ok: false,
        status: "blocked",
        error: error instanceof Error ? error.message : "Readiness check failed.",
        generatedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
