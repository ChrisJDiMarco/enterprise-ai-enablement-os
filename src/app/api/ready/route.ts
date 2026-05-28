import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/database";
import { getProductionReadiness } from "@/lib/production-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await checkDatabaseHealth();
    const readiness = getProductionReadiness();
    const ok = database.ok && readiness.status !== "blocked";

    return NextResponse.json(
      {
        schema: "enterprise-ai-enablement-os.ready.v1",
        ok,
        status: readiness.status,
        database,
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
