const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";

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
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function login(role, organizationId = "smoke-org") {
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

  const builderCookie = await login("builder");
  const authHeaders = { Cookie: builderCookie };

  const session = await json("/api/auth/session", { headers: authHeaders });
  assert(session.payload.authenticated, "session failed");

  const workspace = await json("/api/workspace", {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      schema: "enterprise-ai-enablement-os.workspace.v1",
      organizationId: "smoke-org",
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

  const context = await json("/api/context/retrieve", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, sources: [source], query: "smoke source" }),
  });
  assert(context.response.ok && context.payload.results.length === 1, "context retrieval failed");

  const connector = await json("/api/connectors/execute", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, tools: [tool], toolId: tool.id, payload: { path: "/docs/smoke" }, approved: true }),
  });
  assert(connector.response.ok && connector.payload.result.status === "executed", "connector execution failed");

  const harness = await json("/api/harness/run", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ skill, tools: [tool], message: "Run smoke harness" }),
  });
  assert(harness.response.ok && harness.payload.result.run.status === "completed", "harness run failed");

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
    body: JSON.stringify({ schema: "enterprise-ai-enablement-os.workspace.v1", organizationId: "smoke-org" }),
  });
  assert(denied.response.status === 403, "viewer write should be forbidden");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "health",
      "login/session",
      "workspace persistence",
      "audit append",
      "workflow jobs",
      "context retrieval",
      "connector execution",
      "server harness",
      "orchestrator chat",
      "rbac denial",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
