import { NextResponse } from "next/server";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getEnterpriseConnectorReadiness } from "@/lib/enterprise-connectors";
import { loadTenantSecretEvidence } from "@/lib/tenant-secret-evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const secretEvidence = await loadTenantSecretEvidence({
    organizationId: guard.session.user.organizationId,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.connector-readiness.v1",
    generatedAt: new Date().toISOString(),
    secretPolicy: "Server-side readiness only. Secret values are never returned to the client.",
    secretEvidence: secretEvidence.evidence,
    ...getEnterpriseConnectorReadiness(process.env, secretEvidence.runtimeSecretNames),
  });
}
