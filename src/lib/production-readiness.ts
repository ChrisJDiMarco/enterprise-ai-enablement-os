import { authReadiness } from "@/lib/auth";
import { getDatabaseReadiness } from "@/lib/database";
import { getProviderReadiness } from "@/lib/provider-registry";

export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

function check(id: string, label: string, status: ReadinessStatus, detail: string): ReadinessCheck {
  return { id, label, status, detail };
}

export function getProductionReadiness() {
  const auth = authReadiness();
  const database = getDatabaseReadiness();
  const providers = getProviderReadiness();
  const configuredExternalProviders = providers.filter((provider) => provider.id !== "local" && provider.configured);
  const connectorMode = process.env.MCP_BROKER_URL
    ? "mcp-broker"
    : process.env.CONNECTOR_BROKER_URL
      ? "connector-broker"
      : "policy-only";
  const workflowMode = process.env.TEMPORAL_ADDRESS
    ? "temporal-ready"
    : process.env.WORKFLOW_ENGINE_URL
      ? "external-engine-ready"
      : "local-job-ledger";

  const checks: ReadinessCheck[] = [
    check(
      "auth-required",
      "Authentication enforcement",
      auth.issues.some((issue) => issue.includes("AUTH_REQUIRED")) ? "fail" : auth.authRequired ? "pass" : "warn",
      auth.authRequired ? "AUTH_REQUIRED is enabled." : "Local development auth mode is active.",
    ),
    check(
      "auth-secret",
      "Session signing secret",
      auth.issues.some((issue) => issue.includes("AUTH_SECRET")) ? "fail" : "pass",
      auth.issues.find((issue) => issue.includes("AUTH_SECRET")) ?? "A session signing secret is available.",
    ),
    check(
      "sso",
      "OIDC SSO",
      auth.oidcConfigured ? "pass" : auth.authRequired ? "fail" : "warn",
      auth.oidcConfigured ? "OIDC issuer/client credentials are configured." : "OIDC is not configured.",
    ),
    check(
      "database",
      "Durable persistence",
      database.durable ? "pass" : process.env.NODE_ENV === "production" ? "fail" : "warn",
      database.reason,
    ),
    check(
      "providers",
      "External model providers",
      configuredExternalProviders.length > 0 ? "pass" : "warn",
      configuredExternalProviders.length > 0
        ? `${configuredExternalProviders.length} external provider(s) are configured.`
        : "Only deterministic local runtime is configured.",
    ),
    check(
      "connectors",
      "Connector broker",
      connectorMode === "policy-only" ? "warn" : "pass",
      connectorMode === "policy-only"
        ? "Policy-only connector mode is active. Configure MCP_BROKER_URL for real execution."
        : `Connector broker mode: ${connectorMode}.`,
    ),
    check(
      "workflow-engine",
      "Durable workflow engine",
      workflowMode === "local-job-ledger" ? "warn" : "pass",
      workflowMode === "local-job-ledger"
        ? "Local workflow job ledger is active. Configure Temporal or WORKFLOW_ENGINE_URL for production workers."
        : `Workflow engine mode: ${workflowMode}.`,
    ),
  ];

  return {
    status: checks.some((item) => item.status === "fail")
      ? "blocked"
      : checks.some((item) => item.status === "warn")
        ? "degraded"
        : "ready",
    checks,
    blockers: checks.filter((item) => item.status === "fail"),
    warnings: checks.filter((item) => item.status === "warn"),
    auth,
    database,
    providers,
    connectors: {
      configured: connectorMode !== "policy-only",
      mode: connectorMode,
    },
    workflows: {
      configured: workflowMode !== "local-job-ledger",
      mode: workflowMode,
    },
  };
}
