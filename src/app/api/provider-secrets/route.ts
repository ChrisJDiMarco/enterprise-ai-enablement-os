import { NextRequest, NextResponse } from "next/server";
import { providerSecretsDeleteInputSchema, providerSecretsInputSchema, formatZodError } from "@/lib/api-validation";
import { caughtErrorDetail } from "@/lib/api-errors";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import type { AuditLog } from "@/lib/enterprise-ai-data";
import { recordOperationalEvent } from "@/lib/observability";
import {
  tenantSecretLifecycleEventLevel,
  tenantSecretLifecycleEventName,
  tenantSecretLifecycleMetadata,
} from "@/lib/tenant-secret-observability";
import {
  buildTenantSecretReadinessImpact,
  deriveTenantSecretOperationScope,
} from "@/lib/tenant-secret-readiness";
import { loadTenantSecretEvidence } from "@/lib/tenant-secret-evidence";
import { deleteTenantSecrets, getSecretVaultReadiness, listTenantSecrets, upsertTenantSecrets } from "@/lib/tenant-secret-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const secretEvidence = await loadTenantSecretEvidence({
    organizationId: guard.session.user.organizationId,
    deps: {
      listTenantSecrets: async () => secrets,
    },
  });
  const connectionImpact = buildTenantSecretReadinessImpact({
    configuredSecretNames: secretEvidence.configuredSecretNames,
    runtimeSecretNames: secretEvidence.runtimeSecretNames,
  });

  return NextResponse.json({
    schema: responseSchema(),
    legacySchema: "enterprise-ai-enablement-os.provider-secrets.v1",
    secretPolicy: "Secret values are encrypted server-side and are never returned to clients.",
    readiness: getSecretVaultReadiness(),
    secretEvidence: secretEvidence.evidence,
    categorySummary: connectionImpact.categorySummary,
    connectionImpact,
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
    const repository = getWorkspaceRepository();
    const unavailable = persistenceUnavailable(repository);
    if (unavailable) return NextResponse.json(unavailable, { status: 503 });

    const beforeSecrets = await listTenantSecrets(guard.session.user.organizationId);
    const configuredSecrets = await upsertTenantSecrets(guard.session.user.organizationId, parsed.data.secrets);
    const secretEvidence = await loadTenantSecretEvidence({
      organizationId: guard.session.user.organizationId,
      deps: {
        listTenantSecrets: async () => configuredSecrets,
      },
    });
    const changedNames = Object.keys(parsed.data.secrets);
    const connectionImpact = buildTenantSecretReadinessImpact({
      beforeConfiguredSecretNames: beforeSecrets.map((secret) => secret.name),
      configuredSecretNames: secretEvidence.configuredSecretNames,
      runtimeSecretNames: secretEvidence.runtimeSecretNames,
      changedNames,
    });
    const primaryScope = deriveTenantSecretOperationScope({
      requestedScope: parsed.data.scope,
      secretNames: changedNames,
    });
    const auditLog: AuditLog = {
      id: `audit-${primaryScope}-secrets-${Date.now()}`,
      eventType: primaryScope === "connector" ? "connector_secrets_updated" : primaryScope === "provider" ? "provider_secrets_updated" : "tenant_secrets_updated",
      message: `${changedNames.length} ${primaryScope} secret${changedNames.length === 1 ? "" : "s"} updated in the tenant vault.`,
      actor: guard.session.user.name,
      riskLevel: "low",
      createdAt: new Date().toISOString(),
    };
    await repository.appendAuditLog(guard.session.user.organizationId, auditLog);
    await recordOperationalEvent({
      organizationId: guard.session.user.organizationId,
      name: tenantSecretLifecycleEventName(primaryScope, "updated"),
      level: tenantSecretLifecycleEventLevel(secretEvidence.evidence),
      route: "/api/provider-secrets",
      actor: guard.session.user.name,
      metadata: tenantSecretLifecycleMetadata({
        operation: "updated",
        scope: primaryScope,
        requestedCount: changedNames.length,
        changedCount: changedNames.length,
        connectionImpact,
        evidence: secretEvidence.evidence,
      }),
    });

    return NextResponse.json({
      schema: responseSchema(primaryScope),
      legacySchema: "enterprise-ai-enablement-os.provider-secrets.v1",
      secretPolicy: "Secret values are encrypted server-side and are never returned to clients.",
      readiness: getSecretVaultReadiness(),
      secretEvidence: secretEvidence.evidence,
      categorySummary: connectionImpact.categorySummary,
      changedSummary: connectionImpact.changedSummary,
      connectionImpact,
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

export async function DELETE(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = providerSecretsDeleteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tenant secret deletion payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    const repository = getWorkspaceRepository();
    const unavailable = persistenceUnavailable(repository);
    if (unavailable) return NextResponse.json(unavailable, { status: 503 });

    const beforeSecrets = await listTenantSecrets(guard.session.user.organizationId);
    const beforeNames = beforeSecrets.map((secret) => secret.name);
    const configuredSecrets = await deleteTenantSecrets(guard.session.user.organizationId, parsed.data.names);
    const secretEvidence = await loadTenantSecretEvidence({
      organizationId: guard.session.user.organizationId,
      deps: {
        listTenantSecrets: async () => configuredSecrets,
      },
    });
    const afterNames = configuredSecrets.map((secret) => secret.name);
    const afterNameSet = new Set(afterNames);
    const deletedNames = parsed.data.names.filter((name) => beforeNames.includes(name) && !afterNameSet.has(name));
    const connectionImpact = buildTenantSecretReadinessImpact({
      beforeConfiguredSecretNames: beforeNames,
      configuredSecretNames: secretEvidence.configuredSecretNames,
      runtimeSecretNames: secretEvidence.runtimeSecretNames,
      changedNames: deletedNames,
    });
    const primaryScope = deriveTenantSecretOperationScope({
      requestedScope: parsed.data.scope,
      secretNames: deletedNames,
    });
    const auditLog: AuditLog = {
      id: `audit-${primaryScope}-secrets-deleted-${Date.now()}`,
      eventType: primaryScope === "connector" ? "connector_secrets_deleted" : primaryScope === "provider" ? "provider_secrets_deleted" : "tenant_secrets_deleted",
      message: `${deletedNames.length} ${primaryScope} secret${deletedNames.length === 1 ? "" : "s"} deleted from the tenant vault.`,
      actor: guard.session.user.name,
      riskLevel: "medium",
      createdAt: new Date().toISOString(),
    };
    await repository.appendAuditLog(guard.session.user.organizationId, auditLog);
    await recordOperationalEvent({
      organizationId: guard.session.user.organizationId,
      name: tenantSecretLifecycleEventName(primaryScope, "deleted"),
      level: tenantSecretLifecycleEventLevel(secretEvidence.evidence),
      route: "/api/provider-secrets",
      actor: guard.session.user.name,
      metadata: tenantSecretLifecycleMetadata({
        operation: "deleted",
        scope: primaryScope,
        requestedCount: parsed.data.names.length,
        changedCount: deletedNames.length,
        connectionImpact,
        evidence: secretEvidence.evidence,
      }),
    });

    return NextResponse.json({
      schema: responseSchema(primaryScope),
      legacySchema: "enterprise-ai-enablement-os.provider-secrets.v1",
      secretPolicy: "Secret values are encrypted server-side and are never returned to clients.",
      readiness: getSecretVaultReadiness(),
      secretEvidence: secretEvidence.evidence,
      categorySummary: connectionImpact.categorySummary,
      changedSummary: connectionImpact.changedSummary,
      connectionImpact,
      configuredSecrets,
      deletedNames,
      auditLog,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Tenant secret vault unavailable.",
        detail: caughtErrorDetail(error, "Tenant secrets could not be deleted. Review vault configuration and server logs."),
        readiness: getSecretVaultReadiness(),
      },
      { status: 503 },
    );
  }
}
