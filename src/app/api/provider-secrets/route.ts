import { NextRequest, NextResponse } from "next/server";
import { providerSecretsInputSchema, formatZodError } from "@/lib/api-validation";
import { caughtErrorDetail } from "@/lib/api-errors";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import type { AuditLog } from "@/lib/enterprise-ai-data";
import { enterpriseConnectorRegistry } from "@/lib/enterprise-connectors";
import { providerRegistry } from "@/lib/provider-registry";
import { getSecretVaultReadiness, listTenantSecrets, upsertTenantSecrets } from "@/lib/tenant-secret-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SecretCategory = "provider" | "connector" | "tenant";

function providerSecretNames() {
  return new Set(
    providerRegistry.flatMap((provider) => [
      ...provider.keyEnvNames,
      ...(provider.endpointEnvNames ?? []),
      ...(provider.baseUrlEnvNames ?? []),
    ]),
  );
}

function connectorSecretNames() {
  return new Set(
    enterpriseConnectorRegistry.flatMap((connector) => [
      ...connector.requiredSecretNames,
      ...(connector.optionalSecretNames ?? []),
    ]),
  );
}

function categorizeSecretName(name: string): SecretCategory {
  if (connectorSecretNames().has(name)) return "connector";
  if (providerSecretNames().has(name)) return "provider";
  return "tenant";
}

function secretCategorySummary(secretNames: string[]) {
  return secretNames.reduce<Record<SecretCategory, number>>(
    (summary, name) => {
      summary[categorizeSecretName(name)] += 1;
      return summary;
    },
    { provider: 0, connector: 0, tenant: 0 },
  );
}

function responseSchema(scope?: string) {
  return scope === "provider"
    ? "enterprise-ai-enablement-os.provider-secrets.v1"
    : "enterprise-ai-enablement-os.tenant-secrets.v1";
}

export async function GET() {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const secrets = await listTenantSecrets(guard.session.user.organizationId);
  const secretNames = secrets.map((secret) => secret.name);

  return NextResponse.json({
    schema: responseSchema(),
    legacySchema: "enterprise-ai-enablement-os.provider-secrets.v1",
    secretPolicy: "Secret values are encrypted server-side and are never returned to clients.",
    readiness: getSecretVaultReadiness(),
    categorySummary: secretCategorySummary(secretNames),
    configuredSecrets: secrets,
  });
}

export async function PUT(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = providerSecretsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider secret payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    const configuredSecrets = await upsertTenantSecrets(guard.session.user.organizationId, parsed.data.secrets);
    const changedNames = Object.keys(parsed.data.secrets);
    const summary = secretCategorySummary(configuredSecrets.map((secret) => secret.name));
    const changedSummary = secretCategorySummary(changedNames);
    const repository = getWorkspaceRepository();
    const unavailable = persistenceUnavailable(repository);
    if (unavailable) return NextResponse.json(unavailable, { status: 503 });

    const primaryScope = parsed.data.scope === "tenant"
      ? changedSummary.connector
        ? "connector"
        : changedSummary.provider
          ? "provider"
          : "tenant"
      : parsed.data.scope;
    const auditLog: AuditLog = {
      id: `audit-${primaryScope}-secrets-${Date.now()}`,
      eventType: primaryScope === "connector" ? "connector_secrets_updated" : primaryScope === "provider" ? "provider_secrets_updated" : "tenant_secrets_updated",
      message: `${changedNames.length} ${primaryScope} secret${changedNames.length === 1 ? "" : "s"} updated in the tenant vault.`,
      actor: guard.session.user.name,
      riskLevel: "low",
      createdAt: new Date().toISOString(),
    };
    await repository.appendAuditLog(guard.session.user.organizationId, auditLog);

    return NextResponse.json({
      schema: responseSchema(primaryScope),
      legacySchema: "enterprise-ai-enablement-os.provider-secrets.v1",
      secretPolicy: "Secret values are encrypted server-side and are never returned to clients.",
      readiness: getSecretVaultReadiness(),
      categorySummary: summary,
      configuredSecrets,
      auditLog,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Tenant secret vault unavailable.",
        detail: caughtErrorDetail(error, "Tenant secrets could not be stored. Review vault configuration and server logs."),
        readiness: getSecretVaultReadiness(),
      },
      { status: 503 },
    );
  }
}
