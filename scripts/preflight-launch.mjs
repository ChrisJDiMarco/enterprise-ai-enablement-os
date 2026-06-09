import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = process.env.PREFLIGHT_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:3002";
const allowDegraded = process.env.ALLOW_DEGRADED_LAUNCH === "true";
const reportPath = process.env.PREFLIGHT_REPORT_PATH || process.env.LAUNCH_PREFLIGHT_REPORT_PATH;
const preflightOrganizationId =
  process.env.PREFLIGHT_ORG_ID ||
  process.env.SMOKE_ORG_ID ||
  process.env.DEFAULT_ORGANIZATION_ID ||
  "default";

async function getJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function getText(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "text/plain, text/markdown",
      ...(options.headers || {}),
    },
  });
  const payload = await response.text().catch(() => "");
  return { response, payload };
}

async function postJson(path, body, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function summarizeCheck(item) {
  return `${item.status.toUpperCase()} ${item.label}: ${item.detail}`;
}

export function manualActionsMarkdown(actions) {
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

function normalizeCookie(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith("cookie:") ? trimmed.slice("cookie:".length).trim() : trimmed;
}

async function resolvePreflightAuthHeaders() {
  const configuredCookie = normalizeCookie(
    process.env.PREFLIGHT_AUTH_COOKIE || process.env.LAUNCH_PREFLIGHT_AUTH_COOKIE,
  );
  if (configuredCookie) {
    return {
      headers: { Cookie: configuredCookie },
      auth: {
        mode: "configured-cookie",
        organizationId: preflightOrganizationId,
        detail: "Used PREFLIGHT_AUTH_COOKIE/LAUNCH_PREFLIGHT_AUTH_COOKIE.",
      },
    };
  }

  const login = await postJson("/api/auth/login", {
    id: "launch-preflight-viewer",
    organizationId: preflightOrganizationId,
    name: "Launch Preflight",
    email: "launch-preflight@example.com",
    role: "viewer",
    department: "AI Enablement",
    localLoginToken:
      process.env.PREFLIGHT_LOCAL_LOGIN_TOKEN ||
      process.env.LAUNCH_PREFLIGHT_LOCAL_LOGIN_TOKEN ||
      process.env.LOCAL_LOGIN_TOKEN ||
      process.env.EMERGENCY_LOCAL_LOGIN_TOKEN ||
      process.env.EMERGENCY_ACCESS_TOKEN,
  });
  const cookie = login.response.headers.get("set-cookie")?.split(";")[0] || "";
  if (login.response.ok && cookie) {
    return {
      headers: { Cookie: cookie },
      auth: {
        mode: "local-login",
        organizationId: login.payload.session?.user?.organizationId || preflightOrganizationId,
        detail: "Used local login for launch preflight.",
      },
    };
  }

  return {
    headers: {},
    auth: {
      mode: "unavailable",
      organizationId: preflightOrganizationId,
      statusCode: login.response.status,
      detail:
        login.response.status === 403
          ? "Enterprise control-plane checks require PREFLIGHT_AUTH_COOKIE or emergency local login."
          : `Local preflight login failed with ${login.response.status}.`,
    },
  };
}

export function summarizeEnterpriseControlPlane(payload, markdown = {}) {
  if (!payload || payload.schema !== "enterprise-ai-enablement-os.enterprise-control-plane.v1") {
    return {
      available: false,
      detail: "Enterprise control-plane JSON payload was unavailable or invalid.",
    };
  }

  const markdownText = typeof markdown.payload === "string" ? markdown.payload : "";
  const markdownContentType = markdown.response?.headers?.get?.("content-type") || "";
  const priorityActions = Array.isArray(payload.controlPlane?.priorityActions)
    ? payload.controlPlane.priorityActions.slice(0, 5).map((action) => ({
        id: action.id,
        title: action.title,
        status: action.status,
        score: action.score,
        nextAction: action.nextAction,
      }))
    : [];

  return {
    available: true,
    schema: payload.schema,
    generatedAt: payload.generatedAt,
    organizationId: payload.organizationId,
    organizationName: payload.organization?.name,
    posture: payload.controlPlane?.posture,
    score: payload.controlPlane?.score,
    capabilityCount: Array.isArray(payload.controlPlane?.capabilities)
      ? payload.controlPlane.capabilities.length
      : 0,
    priorityActions,
    readinessInputs: {
      providers: {
        total: payload.readinessInputs?.providers?.total ?? 0,
        ready: payload.readinessInputs?.providers?.ready ?? 0,
      },
      connectors: {
        total: payload.readinessInputs?.connectors?.total ?? 0,
        ready: payload.readinessInputs?.connectors?.ready ?? 0,
        brokerMode: payload.readinessInputs?.connectors?.brokerMode,
      },
      evidence: payload.readinessInputs?.evidence ?? {},
    },
    markdownExport: {
      ok:
        Boolean(markdown.response?.ok) &&
        markdownContentType.includes("text/markdown") &&
        markdownText.includes("Enterprise AI Control Plane") &&
        markdownText.includes("Capability Ledger") &&
        markdownText.includes("Privacy Boundary"),
      statusCode: markdown.response?.status ?? null,
      contentType: markdownContentType,
      bytes: Buffer.byteLength(markdownText, "utf8"),
      hasCapabilityLedger: markdownText.includes("Capability Ledger"),
      hasPrivacyBoundary: markdownText.includes("Privacy Boundary"),
    },
  };
}

export function enterpriseControlPlanePreflightFindings(enterpriseControlPlane) {
  const summary = enterpriseControlPlane?.summary;
  if (!summary?.available) {
    return {
      warnings: [`WARN Enterprise AI control plane: ${summary?.detail || "control-plane packet could not be loaded."}`],
      manualActions: [
        {
          id: "enterprise-control-plane",
          title: "Authenticate control-plane preflight",
          severity: "warning",
          owner: "Operations",
          action:
            "Set PREFLIGHT_AUTH_COOKIE or LAUNCH_PREFLIGHT_AUTH_COOKIE for a viewer/admin session before running launch preflight against production.",
          env: ["PREFLIGHT_AUTH_COOKIE", "LAUNCH_PREFLIGHT_AUTH_COOKIE", "PREFLIGHT_ORG_ID"],
          verify:
            "Run npm run preflight:launch and confirm enterpriseControlPlane.summary.available is true.",
        },
      ],
    };
  }

  const warnings = [];
  const manualActions = [];
  if (!summary.markdownExport?.ok) {
    warnings.push("WARN Enterprise AI control plane: markdown packet export is unavailable or missing required sections.");
    manualActions.push({
      id: "enterprise-control-plane-export",
      title: "Fix control-plane packet export",
      severity: "warning",
      owner: "AI Enablement",
      action:
        "Verify /api/enterprise-control-plane?format=markdown returns text/markdown with Capability Ledger and Privacy Boundary sections.",
      env: ["PREFLIGHT_AUTH_COOKIE", "LAUNCH_PREFLIGHT_AUTH_COOKIE"],
      verify:
        "Run npm run preflight:launch and confirm enterpriseControlPlane.summary.markdownExport.ok is true.",
    });
  }

  if (typeof summary.score === "number" && summary.score < 40) {
    warnings.push(
      `WARN Enterprise AI control plane posture: ${summary.posture || "unknown"} at ${summary.score}/100; tenant evidence is not ready for broad rollout.`,
    );
  }

  return { warnings, manualActions };
}

function dedupeManualActions(actions) {
  return actions.filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
}

export function preflightRequestOptions(authResolution) {
  return authResolution?.headers?.Cookie ? { headers: authResolution.headers } : {};
}

export function preflightTenantContext(authResolution, readinessPayload = {}, providersPayload = {}) {
  const session = readinessPayload.session || null;
  return {
    auth: authResolution?.auth ?? {
      mode: "unavailable",
      organizationId: preflightOrganizationId,
      detail: "Preflight auth was not resolved.",
    },
    readinessSession: session
      ? {
          organizationId: session.organizationId,
          role: session.role,
          expiresAt: session.expiresAt,
        }
      : null,
    tenantEvidence: readinessPayload.tenantEvidence ?? null,
    providerEvidence: {
      total: Array.isArray(providersPayload.providers) ? providersPayload.providers.length : 0,
      externalConfigured: Array.isArray(providersPayload.providers)
        ? providersPayload.providers.filter((provider) => provider.id !== "local" && provider.configured).map((provider) => provider.id)
        : [],
      secretPolicy: providersPayload.secretPolicy,
    },
  };
}

export function summarizeReadyProbe(probe = {}) {
  const payload = probe.payload || {};
  const response = probe.response;
  return {
    ok: Boolean(response?.ok && payload.ok),
    statusCode: response?.status ?? null,
    scope: payload.scope || "serving",
    status: payload.status || "unknown",
    servingOk: Boolean(payload.serving?.ok),
    launchOk: Boolean(payload.launch?.ok),
    launchStatus: payload.launch?.status || "unknown",
    launchScore: typeof payload.launch?.score === "number" ? payload.launch.score : 0,
    manualActionCount: typeof payload.launch?.manualActionCount === "number" ? payload.launch.manualActionCount : 0,
    warningCount: typeof payload.launch?.warningCount === "number" ? payload.launch.warningCount : 0,
    blockerCount: typeof payload.launch?.blockerCount === "number" ? payload.launch.blockerCount : 0,
    nextAction: payload.launch?.nextAction || null,
    reason: payload.launch?.reason || payload.serving?.reason || "",
  };
}

export function readyProbePreflightFindings(servingReady, launchReady) {
  const blockers = [];
  const warnings = [];
  const manualActions = [];

  if (!servingReady?.ok) {
    blockers.push(
      `BLOCK Serving readiness endpoint: ${servingReady?.status || "unknown"} (${servingReady?.statusCode ?? "no status"}).`,
    );
    manualActions.push({
      id: "serving-readiness",
      title: "Restore serving readiness",
      severity: "blocker",
      owner: "Platform",
      action: "Inspect /api/ready, database health, persistence, and runtime readiness blockers before sending tenant traffic.",
      env: ["DATABASE_URL", "AUTH_SECRET", "API_TRUSTED_ORIGINS"],
      verify: "Call /api/ready and confirm ok=true with HTTP 200.",
    });
  }

  if (servingReady?.ok && !launchReady?.launchOk) {
    warnings.push(
      `WARN Strict launch readiness endpoint: ${launchReady?.launchStatus || "unknown"} at ${launchReady?.launchScore ?? 0}/100 with ${launchReady?.manualActionCount ?? 0} manual action(s).`,
    );
    if (launchReady?.nextAction) {
      manualActions.push({
        id: launchReady.nextAction.id || "strict-launch-next-action",
        title: launchReady.nextAction.title || "Resolve strict launch readiness",
        severity: launchReady.nextAction.severity === "blocker" ? "blocker" : "warning",
        owner: launchReady.nextAction.owner || "Operations",
        action: launchReady.nextAction.action || "Resolve the next strict launch readiness action.",
        env: [],
        verify: launchReady.nextAction.verify || "Call /api/ready?scope=launch and confirm ok=true with HTTP 200.",
      });
    }
  }

  return { blockers, warnings, manualActions };
}

async function loadEnterpriseControlPlane(auth = null) {
  const resolvedAuth = auth ?? (await resolvePreflightAuthHeaders());
  if (!resolvedAuth.headers.Cookie) {
    return {
      auth: resolvedAuth.auth,
      summary: {
        available: false,
        detail: resolvedAuth.auth.detail,
      },
    };
  }

  const controlPlane = await getJson("/api/enterprise-control-plane", { headers: resolvedAuth.headers });
  const markdown = await getText("/api/enterprise-control-plane?format=markdown", { headers: resolvedAuth.headers });

  return {
    auth: resolvedAuth.auth,
    summary: summarizeEnterpriseControlPlane(controlPlane.payload, markdown),
  };
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
  const preflightAuth = await resolvePreflightAuthHeaders();
  const tenantOptions = preflightRequestOptions(preflightAuth);
  const health = await getJson("/api/health");
  if (!health.response.ok || !health.payload.ok) {
    throw new Error(`Liveness failed: ${health.response.status} ${JSON.stringify(health.payload)}`);
  }

  const ready = await getJson("/api/ready", tenantOptions);
  const launchReady = await getJson("/api/ready?scope=launch", tenantOptions);
  const readiness = await getJson("/api/readiness", tenantOptions);
  const providers = await getJson("/api/providers", tenantOptions);
  const tenants = await getJson("/api/tenants");
  const enterpriseControlPlane = await loadEnterpriseControlPlane(preflightAuth);

  const checks = readiness.payload.checks || [];
  const blockers = readiness.payload.blockers || [];
  const warnings = readiness.payload.warnings || [];
  const customerLaunchContract = readiness.payload.customerLaunchContract || null;
  const configuredProviders = (providers.payload.providers || []).filter((provider) => provider.id !== "local" && provider.configured);
  const enterpriseFindings = enterpriseControlPlanePreflightFindings(enterpriseControlPlane);
  const readyProbes = {
    serving: summarizeReadyProbe(ready),
    launch: summarizeReadyProbe(launchReady),
  };
  const readyFindings = readyProbePreflightFindings(readyProbes.serving, readyProbes.launch);

  const fallbackManualActions = [...blockers, ...warnings]
    .map((item) => ({ id: item.id, action: manualActionByCheck[item.id] || item.detail }))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
  const readinessManualActions = readiness.payload.manualActions?.length
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
  const manualActions = dedupeManualActions([
    ...readinessManualActions,
    ...enterpriseFindings.manualActions,
    ...readyFindings.manualActions,
  ]);
  const blockerSummaries = [...blockers.map(summarizeCheck), ...readyFindings.blockers];
  const warningSummaries = [...warnings.map(summarizeCheck), ...enterpriseFindings.warnings, ...readyFindings.warnings];
  const reportStatus = blockerSummaries.length ? "blocked" : warningSummaries.length ? "degraded" : readiness.payload.status;

  const report = {
    generatedAt: new Date().toISOString(),
    ok: ready.response.ok && ready.payload.ok,
    baseUrl,
    status: reportStatus,
    readyProbes,
    selfServeSignup: tenants.payload.enabled,
    configuredExternalProviders: configuredProviders.map((provider) => provider.id),
    tenantContext: preflightTenantContext(preflightAuth, readiness.payload, providers.payload),
    enterpriseControlPlane,
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
    blockers: blockerSummaries,
    warnings: warningSummaries,
    manualActions,
    manualActionsMarkdown: manualActionsMarkdown(manualActions),
    checked: checks.map((item) => ({ id: item.id, status: item.status })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (blockerSummaries.length) {
    throw new Error("Launch preflight blocked. Resolve blockers before inviting customers.");
  }

  if (warningSummaries.length && !allowDegraded) {
    throw new Error("Launch preflight is degraded. Set ALLOW_DEGRADED_LAUNCH=true only for an explicitly accepted private-beta launch.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
