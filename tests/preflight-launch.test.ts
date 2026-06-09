import assert from "node:assert/strict";
import test from "node:test";

import {
  enterpriseControlPlanePreflightFindings,
  manualActionsMarkdown,
  preflightRequestOptions,
  preflightTenantContext,
  readyProbePreflightFindings,
  summarizeReadyProbe,
  summarizeEnterpriseControlPlane,
} from "../scripts/preflight-launch.mjs";

function responseLike(headers: Record<string, string>, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
  };
}

test("summarizeEnterpriseControlPlane creates a launch preflight snapshot with markdown proof", () => {
  const summary = summarizeEnterpriseControlPlane(
    {
      schema: "enterprise-ai-enablement-os.enterprise-control-plane.v1",
      generatedAt: "2026-06-06T16:00:00.000Z",
      organizationId: "preflight-org",
      organization: { name: "Preflight Org" },
      controlPlane: {
        posture: "controlled",
        score: 76,
        capabilities: [{ id: "system-of-record" }, { id: "shadow-ai" }],
        priorityActions: [
          {
            id: "permissions",
            title: "Agent permission graph",
            status: "building",
            score: 48,
            nextAction: "Bind every Skill to least-privilege context and tools.",
          },
        ],
      },
      readinessInputs: {
        providers: { total: 5, ready: 2 },
        connectors: { total: 6, ready: 3, brokerMode: "mcp-broker" },
        evidence: { auditLogs: 12, runs: 4 },
      },
    },
    {
      response: responseLike({ "content-type": "text/markdown; charset=utf-8" }),
      payload: [
        "# Preflight Org Enterprise AI Control Plane",
        "## Capability Ledger",
        "## Privacy Boundary",
      ].join("\n"),
    },
  );

  assert.equal(summary.available, true);
  assert.equal(summary.organizationId, "preflight-org");
  assert.equal(summary.posture, "controlled");
  assert.equal(summary.score, 76);
  assert.equal(summary.capabilityCount, 2);
  assert.equal(summary.priorityActions[0].id, "permissions");
  assert.deepEqual(summary.readinessInputs.providers, { total: 5, ready: 2 });
  assert.equal(summary.readinessInputs.connectors.brokerMode, "mcp-broker");
  assert.equal(summary.markdownExport.ok, true);
  assert.equal(summary.markdownExport.hasPrivacyBoundary, true);
});

test("summarizeEnterpriseControlPlane refuses invalid payloads and incomplete markdown exports", () => {
  const invalid = summarizeEnterpriseControlPlane({ schema: "wrong" });
  assert.equal(invalid.available, false);

  const summary = summarizeEnterpriseControlPlane(
    {
      schema: "enterprise-ai-enablement-os.enterprise-control-plane.v1",
      controlPlane: { capabilities: [], priorityActions: [] },
      readinessInputs: { providers: {}, connectors: {}, evidence: {} },
    },
    {
      response: responseLike({ "content-type": "application/json" }),
      payload: "# Missing expected sections",
    },
  );

  assert.equal(summary.available, true);
  assert.ok(summary.markdownExport);
  assert.equal(summary.markdownExport.ok, false);
  assert.equal(summary.markdownExport.hasCapabilityLedger, false);
});

test("manualActionsMarkdown keeps launch preflight handoffs readable", () => {
  const markdown = manualActionsMarkdown([
    {
      id: "providers",
      title: "Configure providers",
      severity: "blocker",
      owner: "AI Platform",
      action: "Set at least one external model provider key.",
      env: ["OPENAI_API_KEY"],
      verify: "Check /api/providers.",
    },
  ]);

  assert.match(markdown, /## Launch Manual Actions/);
  assert.match(markdown, /Configure providers/);
  assert.match(markdown, /Owner: AI Platform/);
  assert.match(markdown, /Env: OPENAI_API_KEY/);
  assert.match(markdown, /Verify: Check \/api\/providers/);
});

test("enterpriseControlPlanePreflightFindings turns artifact gaps into preflight warnings", () => {
  const unavailable = enterpriseControlPlanePreflightFindings({
    summary: { available: false, detail: "No auth cookie." },
  });
  assert.equal(unavailable.warnings.length, 1);
  assert.match(unavailable.warnings[0], /No auth cookie/);
  assert.equal(unavailable.manualActions[0].id, "enterprise-control-plane");

  const brokenExport = enterpriseControlPlanePreflightFindings({
    summary: {
      available: true,
      score: 92,
      posture: "scale-ready",
      markdownExport: { ok: false },
    },
  });
  assert.equal(brokenExport.warnings.some((warning: string) => warning.includes("markdown packet export")), true);
  assert.equal(brokenExport.manualActions[0].id, "enterprise-control-plane-export");

  const weakTenant = enterpriseControlPlanePreflightFindings({
    summary: {
      available: true,
      score: 12,
      posture: "uncontrolled",
      markdownExport: { ok: true },
    },
  });
  assert.equal(weakTenant.manualActions.length, 0);
  assert.equal(weakTenant.warnings.some((warning: string) => warning.includes("12/100")), true);
});

test("preflight tenant context preserves authenticated readiness and provider evidence", () => {
  const authResolution = {
    headers: { Cookie: "eaieos_session=test" },
    auth: {
      mode: "configured-cookie",
      organizationId: "tenant-a",
      detail: "Used test cookie.",
    },
  };

  assert.deepEqual(preflightRequestOptions(authResolution), {
    headers: { Cookie: "eaieos_session=test" },
  });

  const context = preflightTenantContext(
    authResolution,
    {
      session: {
        organizationId: "tenant-a",
        role: "viewer",
        expiresAt: 1_800_000_000_000,
      },
      tenantEvidence: {
        loaded: true,
        errors: [],
      },
    },
    {
      secretPolicy: "Server-side readiness only. Secret values are never returned to the client.",
      providers: [
        { id: "local", configured: true },
        { id: "openai", configured: true },
        { id: "anthropic", configured: false },
      ],
    },
  );

  assert.equal(context.auth.organizationId, "tenant-a");
  assert.equal(context.readinessSession?.organizationId, "tenant-a");
  assert.equal(context.tenantEvidence?.loaded, true);
  assert.deepEqual(context.providerEvidence.externalConfigured, ["openai"]);
  assert.equal(context.providerEvidence.total, 3);
});

test("preflightRequestOptions stays anonymous when no auth cookie is available", () => {
  const options = preflightRequestOptions({
    headers: {},
    auth: { mode: "unavailable", organizationId: "default", detail: "No cookie." },
  });

  assert.deepEqual(options, {});
});

test("summarizeReadyProbe captures serving and launch readiness separately", () => {
  const summary = summarizeReadyProbe({
    response: responseLike({}, false, 503),
    payload: {
      scope: "launch",
      ok: false,
      status: "degraded",
      serving: { ok: true, reason: "Serving traffic." },
      launch: {
        ok: false,
        status: "needs-work",
        score: 58,
        manualActionCount: 3,
        warningCount: 2,
        blockerCount: 0,
        nextAction: {
          id: "sso",
          title: "Connect enterprise SSO",
          owner: "Identity",
          severity: "warning",
          action: "Configure OIDC.",
          verify: "Complete callback.",
        },
        reason: "Strict launch readiness requires clean controls.",
      },
    },
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.statusCode, 503);
  assert.equal(summary.scope, "launch");
  assert.equal(summary.servingOk, true);
  assert.equal(summary.launchOk, false);
  assert.equal(summary.launchScore, 58);
  assert.equal(summary.manualActionCount, 3);
  assert.equal(summary.nextAction.id, "sso");
});

test("readyProbePreflightFindings turns probe failures into launch handoff items", () => {
  const servingFailure = readyProbePreflightFindings(
    { ok: false, status: "blocked", statusCode: 503 },
    { launchOk: false },
  );
  assert.equal(servingFailure.blockers.length, 1);
  assert.equal(servingFailure.manualActions[0].id, "serving-readiness");

  const launchWarning = readyProbePreflightFindings(
    { ok: true, status: "degraded", statusCode: 200 },
    {
      launchOk: false,
      launchStatus: "needs-work",
      launchScore: 58,
      manualActionCount: 1,
      nextAction: {
        id: "sso",
        title: "Connect enterprise SSO",
        owner: "Identity",
        severity: "warning",
        action: "Configure OIDC.",
        verify: "Complete callback.",
      },
    },
  );
  assert.equal(launchWarning.blockers.length, 0);
  assert.equal(launchWarning.warnings.some((warning: string) => warning.includes("58/100")), true);
  assert.equal(launchWarning.manualActions[0].id, "sso");
});
