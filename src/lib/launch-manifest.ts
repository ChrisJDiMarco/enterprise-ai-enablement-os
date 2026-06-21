import type { ReadinessCheck } from "./production-readiness.ts";

export type LaunchManualAction = {
  id: string;
  title: string;
  severity: "blocker" | "warning";
  owner: "Platform" | "Identity" | "Data" | "AI" | "Security" | "Integrations" | "Operations";
  action: string;
  why: string;
  env: string[];
  verify: string;
};

type LaunchActionTemplate = Omit<LaunchManualAction, "severity">;

const launchActionCatalog: Record<string, LaunchActionTemplate> = {
  "auth-required": {
    id: "auth-required",
    title: "Enforce authenticated access",
    owner: "Identity",
    action: "Set AUTH_REQUIRED=true in the hosted environment before any customer tenant is invited.",
    why: "Customer workspaces must never fall back to local development login semantics.",
    env: ["AUTH_REQUIRED"],
    verify: "Run npm run preflight:launch and confirm Authentication enforcement is pass.",
  },
  "auth-secret": {
    id: "auth-secret",
    title: "Set a strong session signing secret",
    owner: "Security",
    action: "Generate and set a 32+ byte AUTH_SECRET.",
    why: "Signed sessions and OIDC callback state depend on a stable high-entropy secret.",
    env: ["AUTH_SECRET"],
    verify: "Run npm run preflight:launch and confirm Session signing secret is pass.",
  },
  sso: {
    id: "sso",
    title: "Connect enterprise SSO",
    owner: "Identity",
    action: "Create an OIDC app with the customer identity provider and set issuer, client id, client secret, and redirect URI.",
    why: "Enterprise customers expect SSO, centralized access control, and clean session lifecycle handling.",
    env: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"],
    verify: "Open /api/auth/oidc/start in the hosted environment and complete an SSO callback.",
  },
  "user-provisioning": {
    id: "user-provisioning",
    title: "Wire enterprise user provisioning",
    owner: "Identity",
    action: "Create a SCIM or IdP automation token, set PROVISIONING_API_TOKEN or SCIM_BEARER_TOKEN, and configure the IdP to call /api/provisioning/users with x-eaieos-tenant.",
    why: "Customer workspaces need automatic joiner, mover, leaver, department, reviewer-role, and access lifecycle management.",
    env: ["PROVISIONING_API_TOKEN", "SCIM_BEARER_TOKEN", "ALLOW_MANUAL_USER_PROVISIONING_IN_PRODUCTION"],
    verify: "POST a dryRun payload to /api/provisioning/users and confirm User provisioning lifecycle is pass in npm run preflight:launch.",
  },
  "tenant-provisioning": {
    id: "tenant-provisioning",
    title: "Gate self-serve tenant onboarding",
    owner: "Identity",
    action: "Keep SELF_SERVE_SIGNUP_ENABLED=false until SSO, durable storage, tenant secret encryption, salted API protection, and customer onboarding terms are ready.",
    why: "Self-serve tenant creation can create customer workspaces and admin sessions, so it must only open after the full onboarding control plane is safe.",
    env: [
      "SELF_SERVE_SIGNUP_ENABLED",
      "AUTH_REQUIRED",
      "OIDC_ISSUER",
      "DATABASE_URL",
      "TENANT_SECRET_KEY",
      "API_TRUSTED_ORIGINS",
      "API_RATE_LIMIT_KEY_SALT",
      "CUSTOMER_ONBOARDING_TERMS_URL",
    ],
    verify: "Call /api/tenants and confirm configured=true before enabling production self-serve tenant creation.",
  },
  database: {
    id: "database",
    title: "Provision durable Postgres persistence",
    owner: "Data",
    action: "Provision managed Postgres, set DATABASE_URL, enable DATABASE_SSL when required, and run migrations.",
    why: "Use cases, Skills, traces, evals, evidence, and audit logs must survive deploys and browser sessions.",
    env: ["DATABASE_URL", "DATABASE_SSL"],
    verify: "Run npm run db:migrate, then npm run preflight:launch and confirm Durable persistence is pass.",
  },
  "api-protection": {
    id: "api-protection",
    title: "Lock API origins and rate-limit salt",
    owner: "Security",
    action: "Set API_TRUSTED_ORIGINS to the production app origin and API_RATE_LIMIT_KEY_SALT to a random secret.",
    why: "Mutation routes need origin checks, payload bounds, request IDs, and non-guessable rate-limit keys.",
    env: ["API_TRUSTED_ORIGINS", "API_RATE_LIMIT_KEY_SALT"],
    verify: "Run npm run preflight:launch and confirm API origin, rate limit, and payload guard is pass.",
  },
  providers: {
    id: "providers",
    title: "Configure external model providers",
    owner: "AI",
    action: "Set at least one server provider key or configure tenant provider keys through the Admin vault after the tenant secret key is active.",
    why: "The deterministic local runtime is excellent for tests but not enough for production-grade AI work.",
    env: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "AZURE_OPENAI_API_KEY", "KIMI_API_KEY", "GLM_API_KEY", "DEEPSEEK_API_KEY"],
    verify: "Open Settings > AI Settings or /api/providers and confirm at least one non-local provider is configured.",
  },
  "model-cost-controls": {
    id: "model-cost-controls",
    title: "Set model budget guardrails",
    owner: "AI",
    action: "Set a tenant monthly model budget and enable spend/latency enforcement before broad customer launch.",
    why: "Enterprise AI systems need explicit cost ceilings, routing fallback, and budget evidence before usage scales.",
    env: ["TENANT_MONTHLY_BUDGET_USD", "MODEL_BUDGET_USD", "MODEL_BUDGET_ENFORCEMENT_ENABLED"],
    verify: "Run npm run preflight:launch and confirm Model cost and latency guardrails is pass.",
  },
  "secret-vault": {
    id: "secret-vault",
    title: "Enable tenant secret encryption",
    owner: "Security",
    action: "Set TENANT_SECRET_KEY or SECRET_VAULT_KEY so tenant provider and connector secrets are encrypted server-side.",
    why: "Customer API keys cannot be stored or routed safely without a production tenant secret vault.",
    env: ["TENANT_SECRET_KEY", "SECRET_VAULT_KEY"],
    verify: "Run npm run preflight:launch and confirm Tenant secret vault is pass.",
  },
  connectors: {
    id: "connectors",
    title: "Deploy the connector broker",
    owner: "Integrations",
    action: "Deploy or select an MCP/connector broker and set its URL and token.",
    why: "Policy-only mode is safe for review, but real Slack, Teams, Jira, ServiceNow, SharePoint, and Workday actions need a brokered execution layer.",
    env: ["MCP_BROKER_URL", "CONNECTOR_BROKER_URL", "CONNECTOR_BROKER_TOKEN"],
    verify: "Call /api/connectors/readiness and confirm broker-managed or native connector execution is ready.",
  },
  "connector-catalog": {
    id: "connector-catalog",
    title: "Configure enterprise connector families",
    owner: "Integrations",
    action: "Configure broker-managed or native connector secrets for the systems this tenant will use on day one.",
    why: "The OS becomes genuinely useful when it can read approved knowledge, route tickets, open tasks, and prepare governed actions in existing systems.",
    env: ["SLACK_BOT_TOKEN", "TEAMS_CLIENT_ID", "JIRA_API_TOKEN", "SERVICENOW_TOKEN", "SHAREPOINT_CLIENT_ID", "WORKDAY_CLIENT_ID"],
    verify: "Open Settings > Customer Launch Infrastructure and confirm connector families are ready or broker-managed.",
  },
  "connector-execution-evidence": {
    id: "connector-execution-evidence",
    title: "Prove governed connector execution",
    owner: "Integrations",
    action:
      "Run one launch-relevant Skill through a governed connector path, require approval when policy asks for it, and preserve a fresh connector execution envelope with redacted payload evidence.",
    why:
      "A configured broker is not enough for customer launch; reviewers need recent proof that real connector calls are policy-gated, idempotent, redacted, and auditable.",
    env: ["MCP_BROKER_URL", "CONNECTOR_BROKER_URL", "CONNECTOR_BROKER_TOKEN", "DATABASE_URL", "CONNECTOR_EVIDENCE_MAX_AGE_DAYS"],
    verify:
      "Open Settings > Runtime Operations and confirm Connector Execution Evidence shows at least one executed event inside the freshness window, zero blocked events, and zero legacy events without envelopes.",
  },
  "context-ingestion": {
    id: "context-ingestion",
    title: "Configure context ingestion",
    owner: "Data",
    action: "Configure a vector store, context sync worker, or explicitly approved manual indexing path for the tenant's first knowledge sources.",
    why: "Context Fabric must keep citations, permissions, classifications, and freshness intact as documents change.",
    env: ["VECTOR_STORE_URL", "CONTEXT_INDEX_JOB_URL", "CONTEXT_SYNC_WORKER_URL", "CONTEXT_SYNC_ENABLED", "ALLOW_MANUAL_CONTEXT_INDEXING_IN_PRODUCTION"],
    verify: "Index one approved source through /api/context/index and confirm Context Fabric retrieval returns permission-filtered citations.",
  },
  "workflow-engine": {
    id: "workflow-engine",
    title: "Connect a durable workflow engine",
    owner: "Platform",
    action: "Provision Temporal or an equivalent workflow runner and set the workflow endpoint.",
    why: "Long-running agentic workflows need retries, resumability, worker visibility, and failure recovery.",
    env: ["TEMPORAL_ADDRESS", "WORKFLOW_ENGINE_URL"],
    verify: "Run npm run preflight:launch and confirm Durable workflow engine is pass.",
  },
  "database-ops": {
    id: "database-ops",
    title: "Prove backups and restore",
    owner: "Operations",
    action: "Configure managed backups or a backup target, schedule, and restore-drill timestamp.",
    why: "Customer evidence and audit history are business-critical records.",
    env: ["MANAGED_DATABASE_BACKUPS", "DATABASE_BACKUP_URL", "DATABASE_BACKUP_SCHEDULE", "DATABASE_RESTORE_DRILL_AT", "RESTORE_DRILL_VERIFIED"],
    verify: "Run npm run preflight:launch and confirm Backups and restore drill is pass.",
  },
  "database-migrations": {
    id: "database-migrations",
    title: "Run the production migration gate",
    owner: "Data",
    action: "Run npm run db:migrate against production, then set DB_SCHEMA_VERSION or DB_MIGRATIONS_APPLIED=true.",
    why: "Production should never rely on implicit local auto-schema behavior.",
    env: ["DB_SCHEMA_VERSION", "APP_SCHEMA_VERSION", "DB_MIGRATIONS_APPLIED"],
    verify: "Run npm run preflight:launch and confirm Schema migration gate is pass.",
  },
  "trace-store": {
    id: "trace-store",
    title: "Persist Harness traces durably",
    owner: "Platform",
    action: "Set DATABASE_URL so Harness traces, policy decisions, and model routing metadata are stored durably.",
    why: "The evidence ledger and governance packets depend on traceability after launch.",
    env: ["DATABASE_URL"],
    verify: "Run a Skill test and confirm the run trace remains available after reload.",
  },
  "harness-trace-evidence": {
    id: "harness-trace-evidence",
    title: "Prove clean Harness trace quality",
    owner: "Operations",
    action:
      "Run the selected launch Skill through the Harness and resolve failed traces, blocked policy paths, stale traces, or unsafe prompt-contract findings before promotion.",
    why:
      "Launch evidence must show a recent real runtime path: identity, context policy, prompt contract, model route, tool policy, approval gate, output policy, and durable trace storage.",
    env: ["DATABASE_URL", "EVAL_RUNNER_URL", "HARNESS_TRACE_MAX_AGE_DAYS"],
    verify:
      "Open Settings > Runtime Operations and confirm Harness trace evidence has at least one completed trace inside the freshness window, zero failed traces, and zero unsafe prompt contracts.",
  },
  "eval-runner": {
    id: "eval-runner",
    title: "Configure evaluation artifacts",
    owner: "AI",
    action: "Configure EVAL_RUNNER_URL for external eval jobs or DATABASE_URL for durable deterministic eval artifacts.",
    why: "Launch readiness needs reusable eval artifacts, regression history, and drift evidence.",
    env: ["EVAL_RUNNER_URL", "DATABASE_URL"],
    verify: "Run an eval suite and confirm results are persisted and reflected in Evidence Ledger.",
  },
  "continuous-evals": {
    id: "continuous-evals",
    title: "Enable continuous eval cadence",
    owner: "AI",
    action: "Schedule regression, red-team, permission, tool-safety, latency, and cost evals for every production Skill.",
    why: "Model, prompt, context, and connector drift can happen after launch; evals must become a recurring control, not a one-time checklist.",
    env: ["EVAL_RUNNER_URL", "EVAL_SCHEDULE_ENABLED", "EVAL_SCHEDULE_CRON"],
    verify: "Run npm run preflight:launch and confirm Continuous eval cadence is pass; then verify eval artifacts in Evidence Ledger.",
  },
  "audit-integrity": {
    id: "audit-integrity",
    title: "Enable tamper-evident audit history",
    owner: "Security",
    action: "Keep AUDIT_INTEGRITY_ENABLED enabled and back audit events with durable Postgres persistence.",
    why: "Enterprise buyers need provable evidence that approvals, policy decisions, connector calls, evals, and governance artifacts were not silently altered.",
    env: ["AUDIT_INTEGRITY_ENABLED", "DATABASE_URL"],
    verify: "Call /api/audit?verify=true and confirm the audit chain verifies without legacy or tamper gaps.",
  },
  observability: {
    id: "observability",
    title: "Wire production observability",
    owner: "Platform",
    action: "Configure telemetry, error reporting, log drain, uptime checks, and incident ownership.",
    why: "A customer-facing AI operating system needs fast detection of failed workflows, connector errors, provider outages, and latency/cost spikes.",
    env: ["OTEL_EXPORTER_OTLP_ENDPOINT", "SENTRY_DSN", "LOG_DRAIN_URL", "ALLOW_LOCAL_OBSERVABILITY_IN_PRODUCTION"],
    verify: "Trigger a test request and confirm traces/errors/logs appear in the production observability stack.",
  },
  "privacy-lifecycle": {
    id: "privacy-lifecycle",
    title: "Set privacy lifecycle controls",
    owner: "Security",
    action: "Set retention policy and connect the privacy request workflow for export/delete/review requests.",
    why: "Enterprise buyers need a clear answer for retention, privacy requests, and safe handling of work-intelligence signals.",
    env: ["DATA_RETENTION_DAYS", "PRIVACY_EXPORT_ENABLED", "PRIVACY_REQUEST_WORKFLOW_URL", "DSR_WORKFLOW_URL"],
    verify: "Run npm run preflight:launch and confirm Privacy, retention, and data subject workflow is pass.",
  },
};

function fallbackAction(check: ReadinessCheck): LaunchActionTemplate {
  return {
    id: check.id,
    title: check.label,
    owner: "Operations",
    action: check.detail,
    why: "This readiness check must be resolved before customer launch is considered complete.",
    env: [],
    verify: `Run npm run preflight:launch and confirm ${check.label} is pass.`,
  };
}

export function buildLaunchManualActions(checks: ReadinessCheck[]): LaunchManualAction[] {
  const seen = new Set<string>();

  return checks
    .filter((item) => item.status === "fail" || item.status === "warn")
    .map((item) => {
      const template = launchActionCatalog[item.id] ?? fallbackAction(item);
      return {
        ...template,
        severity: item.status === "fail" ? "blocker" : "warning",
      } satisfies LaunchManualAction;
    })
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "blocker" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
}

export function launchManualActionsMarkdown(actions: LaunchManualAction[]) {
  if (!actions.length) return "All production launch checks are passing.";

  return actions
    .map((item, index) => {
      const envLine = item.env.length ? `\n   Env: ${item.env.join(", ")}` : "";
      return `${index + 1}. [${item.severity.toUpperCase()}] ${item.title}\n   Owner: ${item.owner}\n   Action: ${item.action}\n   Why: ${item.why}${envLine}\n   Verify: ${item.verify}`;
    })
    .join("\n\n");
}
