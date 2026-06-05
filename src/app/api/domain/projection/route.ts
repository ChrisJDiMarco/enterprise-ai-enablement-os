import { NextResponse } from "next/server";

import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { buildDomainProjection, domainProjectionCounts } from "@/lib/domain-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const projection = buildDomainProjection(workspace);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.domain-projection.v1",
    generatedAt: new Date().toISOString(),
    persistence: repository.readiness(),
    organizationId: projection.organizationId,
    counts: domainProjectionCounts(projection),
    evidenceItems: projection.evidenceItems,
  });
}
