import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const baseUrl = process.env.PREFLIGHT_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:3002";
const allowDegraded = process.env.ALLOW_DEGRADED_LAUNCH === "true";
const reportPath = process.env.PREFLIGHT_REPORT_PATH || process.env.LAUNCH_PREFLIGHT_REPORT_PATH;

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function summarizeCheck(item) {
  return `${item.status.toUpperCase()} ${item.label}: ${item.detail}`;
}

function manualActionsMarkdown(actions) {
  if (!actions.length) {
    return "## Launch Manual Actions\n\nNo manual launch actions were reported by preflight.\n";
  }

  return [
    "## Launch Manual Actions",
    "",
    ...actions.map((item, index) => {
      const title = item.title || item.id;
      const severity = item.severity ? ` (${item.severity})` : "";
      const owner = item.owner ? `\nOwner: ${item.owner}` : "";
      const env = Array.isArray(item.env) && item.env.length ? `\nEnv: ${item.env.join(", ")}` : "";
      const verify = item.verify ? `\nVerify: ${item.verify}` : "";
      return `${index + 1}. ${title}${severity}\nAction: ${item.action}${owner}${env}${verify}`;
    }),
    "",
  ].join("\n");
}

const manualActionByCheck = {
  "auth-required": "Set AUTH_REQUIRED=true in the hosted environment.",
  "auth-secret": "Generate and set a 32+ byte AUTH_SECRET.",
  sso: "Create an OIDC/SAML app with your identity provider and set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI.",
  "user-provisioning": "Set PROVISIONING_API_TOKEN or SCIM_BEARER_TOKEN and configure your IdP/SCIM job to call /api/provisioning/users with x-eaieos-tenant.",
  "tenant-provisioning": "Keep SELF_SERVE_SIGNUP_ENABLED=false until SSO, DATABASE_URL, TENANT_SECRET_KEY, API_TRUSTED_ORIGINS, API_RATE_LIMIT_KEY_SALT, and CUSTOMER_ONBOARDING_TERMS_URL are ready.",
  database: "Provision a managed Postgres database, set DATABASE_URL, enable DATABASE_SSL when required, and run a backup/restore drill.",
  "api-protection": "Set API_TRUSTED_ORIGINS to the production app origin and API_RATE_LIMIT_KEY_SALT to a random secret.",
  providers: "Set at least one external model provider key, or use the Admin provider vault after TENANT_SECRET_KEY is configured.",
  "secret-vault": "Set TENANT_SECRET_KEY or SECRET_VAULT_KEY so tenant provider keys can be encrypted server-side.",
  "model-cost-controls": "Set TENANT_MONTHLY_BUDGET_USD or MODEL_BUDGET_ENFORCEMENT_ENABLED so each tenant has explicit spend controls.",
  connectors: "Deploy or choose an MCP/connector broker and set MCP_BROKER_URL or CONNECTOR_BROKER_URL plus CONNECTOR_BROKER_TOKEN if required.",
  "connector-catalog": "Configure an MCP broker or store native connector secrets for Slack/Teams/Jira/ServiceNow/SharePoint/Workday in the tenant vault.",
  "context-ingestion": "Configure VECTOR_STORE_URL, CONTEXT_INDEX_JOB_URL, or CONTEXT_SYNC_ENABLED for permission-aware context ingestion.",
  "workflow-engine": "Provision Temporal or an equivalent workflow runner and set TEMPORAL_ADDRESS or WORKFLOW_ENGINE_URL.",
  "database-ops": "Configure managed backups or DATABASE_BACKUP_URL, DATABASE_BACKUP_SCHEDULE, and DATABASE_RESTORE_DRILL_AT.",
  "database-migrations": "Run npm run db:migrate against production, then set DB_SCHEMA_VERSION or DB_MIGRATIONS_APPLIED=true.",
  "trace-store": "Set DATABASE_URL so Harness traces are stored durably.",
  "eval-runner": "Set EVAL_RUNNER_URL for an external runner, or DATABASE_URL for durable deterministic eval artifacts.",
  "continuous-evals": "Set EVAL_SCHEDULE_ENABLED, EVAL_SCHEDULE_CRON, or EVAL_RUNNER_URL so evals run continuously after launch.",
  "audit-integrity": "Keep AUDIT_INTEGRITY_ENABLED enabled and persist audit events in Postgres. Verify with /api/audit?verify=true.",
  observability: "Configure OTEL_EXPORTER_OTLP_ENDPOINT, SENTRY_DSN, or LOG_DRAIN_URL for production telemetry and incident response.",
  "privacy-lifecycle": "Set DATA_RETENTION_DAYS and PRIVACY_EXPORT_ENABLED or PRIVACY_REQUEST_WORKFLOW_URL for customer privacy lifecycle operations.",
};

async function main() {
  const health = await getJson("/api/health");
  if (!health.response.ok || !health.payload.ok) {
    throw new Error(`Liveness failed: ${health.response.status} ${JSON.stringify(health.payload)}`);
  }

  const ready = await getJson("/api/ready");
  const readiness = await getJson("/api/readiness");
  const providers = await getJson("/api/providers");
  const tenants = await getJson("/api/tenants");

  const checks = readiness.payload.checks || [];
  const blockers = readiness.payload.blockers || [];
  const warnings = readiness.payload.warnings || [];
  const customerLaunchContract = readiness.payload.customerLaunchContract || null;
  const configuredProviders = (providers.payload.providers || []).filter((provider) => provider.id !== "local" && provider.configured);

  const fallbackManualActions = [...blockers, ...warnings]
    .map((item) => ({ id: item.id, action: manualActionByCheck[item.id] || item.detail }))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
  const manualActions = readiness.payload.manualActions?.length
    ? readiness.payload.manualActions.map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      owner: item.owner,
      action: item.action,
      env: item.env,
      verify: item.verify,
    }))
    : fallbackManualActions;

  const report = {
    generatedAt: new Date().toISOString(),
    ok: ready.response.ok && ready.payload.ok,
    baseUrl,
    status: readiness.payload.status,
    selfServeSignup: tenants.payload.enabled,
    configuredExternalProviders: configuredProviders.map((provider) => provider.id),
    customerLaunchContract: customerLaunchContract
      ? {
          status: customerLaunchContract.status,
          score: customerLaunchContract.score,
          readyCount: customerLaunchContract.readyCount,
          needsWorkCount: customerLaunchContract.needsWorkCount,
          blockedCount: customerLaunchContract.blockedCount,
          nextActions: (customerLaunchContract.nextActions || []).map((domain) => ({
            id: domain.id,
            label: domain.label,
            owner: domain.owner,
            status: domain.status,
            nextAction: domain.nextAction,
            env: domain.env,
          })),
        }
      : null,
    blockers: blockers.map(summarizeCheck),
    warnings: warnings.map(summarizeCheck),
    manualActions,
    manualActionsMarkdown: manualActionsMarkdown(manualActions),
    checked: checks.map((item) => ({ id: item.id, status: item.status })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (blockers.length) {
    throw new Error("Launch preflight blocked. Resolve blockers before inviting customers.");
  }

  if (warnings.length && !allowDegraded) {
    throw new Error("Launch preflight is degraded. Set ALLOW_DEGRADED_LAUNCH=true only for an explicitly accepted private-beta launch.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
