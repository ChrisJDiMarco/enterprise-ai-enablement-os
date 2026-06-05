const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";
const smokeOrganizationId = process.env.SMOKE_ORG_ID || `smoke-org-${Date.now()}`;
const smokeTenantHeaders = { "X-EAIEOS-Tenant": smokeOrganizationId };

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...smokeTenantHeaders,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function raw(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...smokeTenantHeaders,
      ...(options.headers || {}),
    },
  });
}

async function text(path, options = {}) {
  const response = await raw(path, options);
  const payload = await response.text();
  return { response, payload };
}

async function login(role, organizationId = smokeOrganizationId) {
  const { response, payload } = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      id: `${role}-smoke-user`,
      organizationId,
      name: `${role} Smoke User`,
      email: `${role}@example.com`,
      role,
      department: "AI Enablement",
    }),
  });
  assert(response.ok, `login failed for ${role}: ${JSON.stringify(payload)}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "login did not return a session cookie");
  return cookie;
}

const skill = {
  id: "skill-smoke",
  name: "Smoke Skill",
  slug: "smoke-skill",
  description: "Smoke test Skill",
  department: "Operations",
  ownerId: "builder-smoke-user",
  status: "draft",
  version: "0.1.0",
  riskLevel: "low",
  autonomyTier: "tier_1_read_only",
  modelProvider: "local",
  model: "local-enterprise-reasoner",
  temperature: 0.2,
  maxTokens: 1000,
  fallbackModel: "local",
  costLimit: 0.1,
  systemPrompt: "You are a production smoke test Skill.",
  allowedTools: ["tool-read"],
  blockedTools: [],
  contextSources: ["src-smoke"],
  evalPassRate: 0,
  adoptionCount: 0,
  valueDelivered: 0,
  runs: 0,
  updatedAt: "May 28, 2026",
};

const tool = {
  id: "tool-read",
  displayName: "Read Tool",
  description: "Read-only smoke connector",
  category: "document",
  actionType: "read",
  riskLevel: "low",
  requiresApprovalByDefault: false,
  enabled: true,
  usage: 0,
  lastUsed: "Never",
};

const source = {
  id: "src-smoke",
  name: "Smoke Source",
  type: "uploaded_docs",
  classification: "internal",
  ownerDepartment: "Operations",
  enabled: true,
  lastIndexedAt: "2026-05-28",
  documentCount: 1,
  skillsUsing: 1,
  health: "healthy",
};

async function main() {
  const health = await json("/api/health");
  assert(health.response.ok && health.payload.ok, "health failed");
  assert(health.response.headers.get("cache-control") === "no-store", "API responses should be no-store");
  assert(
    health.response.headers.get("x-robots-tag")?.includes("noindex"),
    "API responses should block crawler indexing",
  );

  const root = await raw("/");
  assert(root.ok, "root app shell failed");
  assert(root.headers.get("x-frame-options") === "DENY", "root shell missing frame denial header");
  assert(root.headers.get("x-content-type-options") === "nosniff", "root shell missing content sniffing protection");
  assert(
    root.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"),
    "root shell missing frame-ancestors CSP",
  );
  assert(
    root.headers.get("permissions-policy")?.includes("browsing-topics=()"),
    "root shell missing restrictive permissions policy",
  );
  assert(root.headers.get("x-robots-tag")?.includes("noindex"), "root shell should block crawler indexing");
  assert(root.headers.get("cross-origin-opener-policy") === "same-origin", "root shell missing COOP header");
  assert(root.headers.get("cross-origin-resource-policy") === "same-origin", "root shell missing CORP header");

  const manifest = await json("/manifest.webmanifest");
  assert(
    manifest.response.ok &&
      manifest.payload.name === "Enterprise AI Enablement OS" &&
      manifest.payload.display === "standalone",
    "web app manifest failed",
  );

  const robots = await text("/robots.txt");
  assert(robots.response.ok && robots.payload.includes("Disallow: /"), "robots policy should block tenant app crawling");

  const builderCookie = await login("builder");
  const authHeaders = { Cookie: builderCookie };

  const session = await json("/api/auth/session", { headers: authHeaders });
  assert(session.payload.authenticated, "session failed");

  const tenantProvisioning = await json("/api/tenants");
  assert(
    tenantProvisioning.response.ok &&
      typeof tenantProvisioning.payload.enabled === "boolean" &&
      typeof tenantProvisioning.payload.requested === "boolean" &&
      tenantProvisioning.payload.readiness?.mode,
    "tenant provisioning status failed",
  );

  const tenant = await json("/api/tenants", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Smoke Tenant ${Date.now()}`,
      workspaceLabel: "AI Enablement OS",
      adminName: "Smoke Admin",
      adminEmail: "smoke.admin@example.com",
      adminDepartment: "Data",
      workspaceMode: "production",
    }),
  });
  assert(tenant.response.ok && tenant.payload.workspace?.organizationId, "tenant provisioning failed");
  const tenantCookie = tenant.response.headers.get("set-cookie")?.split(";")[0];
  assert(tenantCookie, "tenant provisioning did not return a session cookie");
  const tenantWorkspace = await json("/api/workspace", { headers: { Cookie: tenantCookie } });
  assert(
    tenantWorkspace.response.ok && tenantWorkspace.payload.workspace.organization.name.startsWith("Smoke Tenant"),
    "tenant workspace load failed",
  );

  const adminCookie = await login("admin", smokeOrganizationId);
  const secrets = await json("/api/provider-secrets", {
    method: "PUT",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      scope: "tenant",
      secrets: {
        SMOKE_PROVIDER_KEY: "smoke-secret-value",
        SLACK_BOT_TOKEN: "xoxb-smoke-secret-value",
      },
    }),
  });
  assert(
    secrets.response.ok &&
      secrets.payload.secretPolicy &&
      secrets.payload.configuredSecrets.some((item) => item.name === "SMOKE_PROVIDER_KEY") &&
      secrets.payload.configuredSecrets.some((item) => item.name === "SLACK_BOT_TOKEN") &&
      secrets.payload.categorySummary?.connector >= 1 &&
      !JSON.stringify(secrets.payload).includes("smoke-secret-value") &&
      !JSON.stringify(secrets.payload).includes("xoxb-smoke-secret-value"),
    "tenant secret vault failed",
  );

  const connectorSecretReadiness = await json("/api/connectors/readiness", { headers: { Cookie: adminCookie } });
  const slackReadiness = connectorSecretReadiness.payload.connectors?.find((connector) => connector.id === "slack");
  assert(
    connectorSecretReadiness.response.ok &&
      slackReadiness?.configuredSecrets?.includes("SLACK_BOT_TOKEN") &&
      slackReadiness?.missingSecrets?.includes("SLACK_SIGNING_SECRET"),
    "connector readiness should use tenant vault connector secrets without exposing values",
  );

  const workspace = await json("/api/workspace", {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      schema: "enterprise-ai-enablement-os.workspace.v1",
      organizationId: smokeOrganizationId,
      useCases: [],
      skills: [skill],
      runs: [],
      toolRequests: [],
      auditLogs: [],
      governanceReviews: [],
      evalResults: [],
      workflow: { status: "Saved", nodes: [], edges: [] },
      report: "",
    }),
  });
  assert(workspace.response.ok && workspace.payload.workspace.skills.length === 1, "workspace save failed");

  const member = await json("/api/users", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      name: "Smoke Reviewer",
      email: "smoke.reviewer@example.com",
      title: "Security Reviewer",
      department: "Security",
      role: "security_reviewer",
    }),
  });
  assert(member.response.ok && member.payload.user?.id, "workspace member upsert failed");

  const members = await json("/api/users", { headers: authHeaders });
  assert(
    members.response.ok && members.payload.users.some((user) => user.email === "smoke.reviewer@example.com"),
    "workspace member list failed",
  );

  const memberDelete = await json(`/api/users?userId=${encodeURIComponent(member.payload.user.id)}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert(
    memberDelete.response.ok &&
      !memberDelete.payload.users.some((user) => user.email === "smoke.reviewer@example.com"),
    "workspace member delete failed",
  );

  const provisioningDryRun = await json("/api/provisioning/users", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      organizationId: smokeOrganizationId,
      source: "admin_import",
      dryRun: true,
      users: [
        {
          userName: "smoke.scim@example.com",
          name: "Smoke SCIM User",
          title: "Provisioned Viewer",
          department: "Operations",
          role: "viewer",
        },
      ],
    }),
  });
  assert(
    provisioningDryRun.response.ok &&
      provisioningDryRun.payload.dryRun &&
      provisioningDryRun.payload.upserted.length === 1,
    "provisioning dry run failed",
  );

  const provisioningSync = await json("/api/provisioning/users", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      organizationId: smokeOrganizationId,
      source: "admin_import",
      users: [
        {
          userName: "smoke.scim@example.com",
          name: { givenName: "Smoke", familyName: "SCIM User" },
          title: "Provisioned Viewer",
          department: "Operations",
          role: "viewer",
        },
      ],
    }),
  });
  assert(
    provisioningSync.response.ok &&
      provisioningSync.payload.users.some((user) => user.email === "smoke.scim@example.com"),
    "provisioning sync failed",
  );

  const audit = await json("/api/audit", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      eventType: "production_smoke",
      message: "Production API smoke verified.",
      actor: "Smoke Runner",
      riskLevel: "low",
    }),
  });
  assert(audit.response.ok, "audit append failed");
  assert(audit.payload.auditLog.integrity?.hash, "audit append did not return an integrity seal");

  const auditVerified = await json("/api/audit?verify=true", { headers: authHeaders });
  assert(
    auditVerified.response.ok &&
      auditVerified.payload.integrity?.sealed >= 1 &&
      auditVerified.payload.integrity?.verified,
    "audit integrity verification failed",
  );

  const auditMaintenance = await json("/api/audit", {
    method: "PUT",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ action: "seal_legacy_chain" }),
  });
  assert(
    auditMaintenance.response.ok &&
      auditMaintenance.payload.action === "seal_legacy_chain" &&
      auditMaintenance.payload.integrity?.verified,
    "audit chain maintenance endpoint failed",
  );

  const backupDrillPreview = await json("/api/ops/backup-drill", { headers: { Cookie: adminCookie } });
  assert(
    backupDrillPreview.response.ok &&
      backupDrillPreview.payload.schema === "enterprise-ai-enablement-os.backup-restore-drill.v1" &&
      backupDrillPreview.payload.dryRun &&
      backupDrillPreview.payload.verification?.workspaceNormalized,
    "backup drill preview failed",
  );

  const backupDrillApply = await json("/api/ops/backup-drill", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ action: "backup_restore_drill", dryRun: false }),
  });
  assert(
    backupDrillApply.response.ok &&
      backupDrillApply.payload.persisted &&
      backupDrillApply.payload.artifactPath &&
      backupDrillApply.payload.verification?.auditIntegrity?.verified,
    "backup drill apply failed",
  );

  const workSignal = await json("/api/work-signals", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      signals: [
        {
          id: `ws-smoke-${Date.now()}`,
          source: "workflow",
          eventType: "workflow_delayed",
          department: "Operations",
          process: "Smoke process",
          teamId: "smoke-team",
          summary: "Aggregated smoke signal showing delayed workflow metadata without raw message content.",
          metadata: { volume: 12, delayHours: 4, cycleTimeHours: 9, confidence: 0.9, system: "Smoke Runner" },
          privacy: {
            contentRedacted: true,
            piiRedacted: true,
            consentBasis: "system_metadata",
            retentionDays: 30,
            individualScoringAllowed: false,
            rawContentStored: false,
          },
          riskLevel: "low",
        },
        {
          id: `ws-expired-smoke-${Date.now()}`,
          source: "harness",
          eventType: "context_gap",
          department: "Operations",
          process: "Expired smoke privacy signal",
          summary: "Expired aggregate privacy signal for retention sweep smoke coverage.",
          metadata: { volume: 1, confidence: 0.8, system: "Smoke Runner" },
          privacy: {
            contentRedacted: true,
            piiRedacted: true,
            consentBasis: "system_metadata",
            retentionDays: 1,
            individualScoringAllowed: false,
            rawContentStored: false,
          },
          riskLevel: "low",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  });
  assert(workSignal.response.ok && workSignal.payload.accepted === 2, "work signal ingest failed");

  const workSignals = await json("/api/work-signals", { headers: authHeaders });
  assert(workSignals.response.ok && workSignals.payload.total >= 1, "work signal list failed");

  const privacyRequest = await json("/api/privacy/requests", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      type: "review",
      subjectEmail: "smoke.scim@example.com",
      reason: "Review smoke privacy lifecycle request.",
    }),
  });
  assert(
    privacyRequest.response.ok &&
      privacyRequest.payload.schema === "enterprise-ai-enablement-os.privacy-request-receipt.v1" &&
      ["accepted", "forwarded"].includes(privacyRequest.payload.receipt?.status),
    "privacy request intake failed",
  );

  const privacyExport = await json("/api/privacy/export?email=smoke.scim%40example.com", {
    headers: { Cookie: adminCookie },
  });
  assert(
    privacyExport.response.ok &&
      privacyExport.payload.packet?.schema === "enterprise-ai-enablement-os.privacy-export.v1" &&
      privacyExport.payload.packet.guardrails?.some((guardrail) => guardrail.includes("Raw employee message content")),
    "privacy export failed",
  );

  const privacyRetentionPreview = await json("/api/privacy/retention", { headers: { Cookie: adminCookie } });
  assert(
    privacyRetentionPreview.response.ok &&
      privacyRetentionPreview.payload.schema === "enterprise-ai-enablement-os.privacy-retention-sweep.v1" &&
      privacyRetentionPreview.payload.expired >= 1,
    "privacy retention preview failed",
  );

  const privacyRetentionApply = await json("/api/privacy/retention", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ action: "retention_sweep", dryRun: false }),
  });
  assert(
    privacyRetentionApply.response.ok &&
      privacyRetentionApply.payload.persisted &&
      privacyRetentionApply.payload.expired >= 1 &&
      !JSON.stringify(privacyRetentionApply.payload).includes("Expired aggregate privacy signal"),
    "privacy retention sweep failed",
  );

  const jobCreate = await json("/api/workflows/jobs", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ workflowId: "wf-smoke", skillId: skill.id, input: { message: "smoke" } }),
  });
  assert(jobCreate.response.ok && jobCreate.payload.job.id, "workflow job create failed");

  const jobUpdate = await json("/api/workflows/jobs", {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ id: jobCreate.payload.job.id, status: "completed", output: { ok: true } }),
  });
  assert(jobUpdate.response.ok && jobUpdate.payload.job.status === "completed", "workflow job update failed");

  const jobMaintenance = await json("/api/workflows/jobs", {
    method: "PUT",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ action: "reconcile_stale", dryRun: true, staleAfterMinutes: 1 }),
  });
  assert(
    jobMaintenance.response.ok &&
      jobMaintenance.payload.schema === "enterprise-ai-enablement-os.workflow-job-maintenance.v1" &&
      jobMaintenance.payload.dryRun === true &&
      Array.isArray(jobMaintenance.payload.items),
    "workflow job maintenance dry-run failed",
  );

  const context = await json("/api/context/retrieve", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, sources: [source], query: "smoke source" }),
  });
  assert(context.response.ok && context.payload.results.length === 1, "context retrieval failed");

  const contextIndex = await json("/api/context/index", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      documents: [
        {
          id: `smoke-context-doc-${Date.now()}`,
          sourceId: source.id,
          sourceName: source.name,
          title: "Smoke Source Operating Procedure",
          content: "This indexed document proves the Context Fabric can store and retrieve approved tenant knowledge.",
          classification: "internal",
          ownerDepartment: "Operations",
        },
      ],
    }),
  });
  assert(contextIndex.response.ok && contextIndex.payload.accepted === 1, "context index failed");

  const contextStats = await json("/api/context/index", { headers: authHeaders });
  assert(contextStats.response.ok && contextStats.payload.stats.totalDocuments >= 1, "context index stats failed");

  const connector = await json("/api/connectors/execute", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, tools: [tool], toolId: tool.id, payload: { path: "/docs/smoke" }, approved: true }),
  });
  assert(connector.response.ok && connector.payload.result.status === "executed", "connector execution failed");

  const connectorReadiness = await json("/api/connectors/readiness", { headers: authHeaders });
  assert(
    connectorReadiness.response.ok &&
      connectorReadiness.payload.schema === "enterprise-ai-enablement-os.connector-readiness.v1" &&
      Array.isArray(connectorReadiness.payload.connectors),
    "connector readiness failed",
  );

  const harness = await json("/api/harness/run", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, tools: [tool], message: "Run smoke harness" }),
  });
  assert(harness.response.ok && harness.payload.result.run.status === "completed" && harness.payload.traceRecord?.id, "harness run failed");

  const traces = await json("/api/traces", { headers: authHeaders });
  assert(traces.response.ok && traces.payload.traces.some((trace) => trace.runId === harness.payload.result.run.id), "trace list failed");

  const agentControlPlane = await json("/api/agent-control-plane", { headers: authHeaders });
  assert(
    agentControlPlane.response.ok &&
      agentControlPlane.payload.schema === "enterprise-ai-enablement-os.agent-control-plane.v1" &&
      Array.isArray(agentControlPlane.payload.inventory) &&
      Array.isArray(agentControlPlane.payload.findings),
    "agent control plane failed",
  );

  const evalRun = await json("/api/evals/run", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, threshold: 60 }),
  });
  assert(
    evalRun.response.ok && evalRun.payload.artifact?.result?.resultsByTest?.length && evalRun.payload.workspaceUpdated,
    "eval run failed",
  );

  const evalList = await json("/api/evals/run", { headers: authHeaders });
  assert(evalList.response.ok && evalList.payload.artifacts.some((artifact) => artifact.id === evalRun.payload.artifact.id), "eval artifact list failed");

  const evalSchedulePreview = await json("/api/evals/schedule", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ action: "run_due", dryRun: true, maxSkills: 5 }),
  });
  assert(
    evalSchedulePreview.response.ok &&
      evalSchedulePreview.payload.maintenance?.schema === "enterprise-ai-enablement-os.eval-schedule-maintenance.v1" &&
      evalSchedulePreview.payload.maintenance.dryRun,
    "eval schedule dry run failed",
  );

  const evalScheduleBackfill = await json("/api/evals/schedule", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ action: "run_due", dryRun: false, maxSkills: 5, threshold: 50 }),
  });
  assert(
    evalScheduleBackfill.response.ok &&
      !evalScheduleBackfill.payload.maintenance.dryRun &&
      Array.isArray(evalScheduleBackfill.payload.artifacts) &&
      evalScheduleBackfill.payload.workspaceEvidence?.evalResults >= 1,
    "eval schedule backfill failed",
  );

  const evidencePacket = await json("/api/evidence/packet", { headers: authHeaders });
  assert(
    evidencePacket.response.ok &&
      evidencePacket.payload.schema === "enterprise-ai-enablement-os.evidence-packet.v2" &&
      typeof evidencePacket.payload.markdown === "string",
    "evidence packet failed",
  );

  const launchPacket = await json("/api/launch/packet", { headers: authHeaders });
  assert(
    launchPacket.response.ok &&
      launchPacket.payload.schema === "enterprise-ai-enablement-os.customer-launch-packet.v1" &&
      launchPacket.payload.recommendedNextMove?.title &&
      typeof launchPacket.payload.markdown === "string",
    "customer launch packet failed",
  );

  const launchPacketMarkdown = await text("/api/launch/packet?format=markdown", { headers: authHeaders });
  assert(
    launchPacketMarkdown.response.ok &&
      launchPacketMarkdown.response.headers.get("content-type")?.includes("text/markdown") &&
      launchPacketMarkdown.payload.includes("Customer Launch Packet"),
    "customer launch packet markdown export failed",
  );

  const orchestrator = await json("/api/orchestrator/chat", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      message: "What needs attention right now?",
      history: [],
      workspace: {
        metrics: { totalUseCases: 0, activePilots: 0, skills: 1, adoptionRate: 0, hoursSaved: 0, riskItemsOpen: 0, annualValue: 0 },
        counts: { runs: 0, auditLogs: 1, evalResults: 0, governanceReviews: 0 },
        workflow: { status: "Saved", nodes: 0, edges: 0, valid: false, issues: 1, warnings: 0 },
        selectedSkill: { id: skill.id, name: skill.name, status: skill.status, riskLevel: skill.riskLevel },
        productionReadiness: { status: "degraded", blockers: [], warnings: [] },
      },
    }),
  });
  assert(
    orchestrator.response.ok &&
      orchestrator.payload.schema === "enterprise-ai-enablement-os.orchestrator-plan.v1" &&
      orchestrator.payload.plan?.content,
    "orchestrator chat failed",
  );

  const viewerCookie = await login("viewer");
  const denied = await json("/api/workspace", {
    method: "PUT",
    headers: { Cookie: viewerCookie },
    body: JSON.stringify({ schema: "enterprise-ai-enablement-os.workspace.v1", organizationId: smokeOrganizationId }),
  });
  assert(denied.response.status === 403, "viewer write should be forbidden");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "health",
      "browser security headers",
      "API no-store/noindex headers",
      "web app manifest",
      "robots noindex policy",
      "login/session",
      "tenant provisioning",
      "provider secret vault",
      "workspace persistence",
      "workspace member management",
      "user lifecycle provisioning",
      "audit append",
      "audit integrity verification",
      "backup restore drill",
      "work signal ingest/list",
      "privacy request/export/retention",
      "workflow jobs",
      "context retrieval",
      "context indexing",
      "connector execution",
      "connector readiness",
      "server harness",
      "trace store",
      "agent control plane",
      "eval runner",
      "continuous eval schedule backfill",
      "evidence packet",
      "customer launch packet",
      "orchestrator chat",
      "rbac denial",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
