import type { ProductionReadiness } from "./ui/types.ts";

export type ReadyScope = "serving" | "launch";
export type ReadyResponse = ReturnType<typeof buildReadyResponse>;

export type ReadyDatabaseHealth = {
  ok: boolean;
  mode: string;
  detail: string;
};

export type TenantEvidenceStatus = {
  loaded: boolean;
  errors: string[];
};

export function readyScopeFromSearchParams(searchParams: URLSearchParams): ReadyScope {
  const scope = (searchParams.get("scope") || searchParams.get("mode") || "").trim().toLowerCase();
  const strict = (searchParams.get("strict") || "").trim().toLowerCase();
  return scope === "launch" || scope === "production" || strict === "true" || strict === "1" ? "launch" : "serving";
}

function firstLaunchAction(readiness: ProductionReadiness) {
  const manualAction = readiness.manualActions?.[0];
  if (manualAction) {
    return {
      id: manualAction.id,
      title: manualAction.title,
      owner: manualAction.owner,
      severity: manualAction.severity,
      action: manualAction.action,
      verify: manualAction.verify,
    };
  }

  const contractAction = readiness.customerLaunchContract?.nextActions?.[0];
  if (contractAction) {
    return {
      id: contractAction.id,
      title: contractAction.label,
      owner: contractAction.owner,
      severity: contractAction.status === "blocked" ? "blocker" : "warning",
      action: contractAction.nextAction,
      verify: contractAction.env.length
        ? `Set ${contractAction.env.join(", ")} and rerun launch preflight.`
        : "Rerun launch preflight after completing this action.",
    };
  }

  return null;
}

export function buildReadyResponse({
  scope,
  database,
  readiness,
  organizationId,
  tenantEvidence,
  generatedAt = new Date().toISOString(),
}: {
  scope: ReadyScope;
  database: ReadyDatabaseHealth;
  readiness: ProductionReadiness;
  organizationId?: string;
  tenantEvidence: TenantEvidenceStatus;
  generatedAt?: string;
}) {
  const blockerCount = readiness.blockers?.length ?? 0;
  const warningCount = readiness.warnings?.length ?? 0;
  const manualActionCount = readiness.manualActions?.length ?? 0;
  const launchContract = readiness.customerLaunchContract;
  const servingOk = database.ok && readiness.status !== "blocked";
  const launchOk =
    servingOk &&
    readiness.status === "ready" &&
    launchContract?.status === "ready" &&
    blockerCount === 0 &&
    warningCount === 0 &&
    manualActionCount === 0;
  const ok = scope === "launch" ? launchOk : servingOk;

  return {
    statusCode: ok ? 200 : 503,
    payload: {
      schema: "enterprise-ai-enablement-os.ready.v1" as const,
      ok,
      scope,
      status: readiness.status,
      database,
      organizationId,
      tenantEvidence,
      serving: {
        ok: servingOk,
        reason: servingOk
          ? "The service can answer authenticated tenant requests."
          : "The service should not receive tenant traffic until blockers clear.",
      },
      launch: {
        ok: launchOk,
        status: launchContract?.status ?? "blocked",
        score: launchContract?.score ?? 0,
        readyCount: launchContract?.readyCount ?? 0,
        needsWorkCount: launchContract?.needsWorkCount ?? 0,
        blockedCount: launchContract?.blockedCount ?? blockerCount,
        manualActionCount,
        warningCount,
        blockerCount,
        nextAction: firstLaunchAction(readiness),
        reason: launchOk
          ? "Production launch contract is satisfied."
          : "Strict launch readiness requires ready runtime status, ready launch contract, no blockers, no warnings, and no manual launch actions.",
      },
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      generatedAt,
    },
  };
}

export function buildPublicReadyResponse(ready: ReadyResponse) {
  const { payload } = ready;

  return {
    statusCode: ready.statusCode,
    payload: {
      schema: payload.schema,
      public: true,
      ok: payload.ok,
      scope: payload.scope,
      status: payload.status,
      serving: {
        ok: payload.serving.ok,
        reason: payload.serving.ok
          ? "The service can answer readiness probes."
          : "The service is not ready to receive tenant traffic.",
      },
      launch: {
        ok: payload.launch.ok,
        status: payload.launch.status,
        score: payload.launch.score,
        readyCount: payload.launch.readyCount,
        needsWorkCount: payload.launch.needsWorkCount,
        blockedCount: payload.launch.blockedCount,
        manualActionCount: payload.launch.manualActionCount,
        warningCount: payload.launch.warningCount,
        blockerCount: payload.launch.blockerCount,
        reason: payload.launch.ok
          ? "Production launch readiness probe is satisfied."
          : "Production launch readiness is not satisfied.",
      },
      generatedAt: payload.generatedAt,
    },
  };
}
