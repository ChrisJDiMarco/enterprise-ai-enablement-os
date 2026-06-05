import { NextResponse } from "next/server";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getEnterpriseConnectorReadiness } from "@/lib/enterprise-connectors";
import { listTenantSecrets } from "@/lib/tenant-secret-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  let configuredSecretNames: string[] = [];
  try {
    configuredSecretNames = (await listTenantSecrets(guard.session.user.organizationId)).map((secret) => secret.name);
  } catch {
    configuredSecretNames = [];
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.connector-readiness.v1",
    generatedAt: new Date().toISOString(),
    secretPolicy: "Server-side readiness only. Secret values are never returned to the client.",
    ...getEnterpriseConnectorReadiness(process.env, configuredSecretNames),
  });
}
