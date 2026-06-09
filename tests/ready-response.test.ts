import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicReadyResponse, buildReadyResponse, readyScopeFromSearchParams } from "../src/lib/ready-response.ts";
import type { ProductionReadiness } from "../src/lib/ui/types.ts";

const database = {
  ok: true,
  mode: "file",
  detail: "Local file persistence directory is writable.",
};

const degradedReadiness = {
  status: "degraded",
  blockers: [],
  warnings: [{ id: "sso", label: "OIDC SSO", status: "warn", detail: "OIDC is not configured." }],
  manualActions: [
    {
      id: "sso",
      title: "Connect enterprise SSO",
      severity: "warning",
      owner: "Identity",
      action: "Create an OIDC app and configure issuer, client id, client secret, and redirect URI.",
      why: "Enterprise users should authenticate through centralized identity.",
      env: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"],
      verify: "Complete an OIDC callback in the hosted environment.",
    },
  ],
  customerLaunchContract: {
    status: "needs-work",
    score: 62,
    readyCount: 4,
    needsWorkCount: 6,
    blockedCount: 0,
    domains: [],
    nextActions: [],
  },
} satisfies ProductionReadiness;

const readyReadiness = {
  status: "ready",
  blockers: [],
  warnings: [],
  manualActions: [],
  customerLaunchContract: {
    status: "ready",
    score: 100,
    readyCount: 10,
    needsWorkCount: 0,
    blockedCount: 0,
    domains: [],
    nextActions: [],
  },
} satisfies ProductionReadiness;

test("readyScopeFromSearchParams separates serving and launch probes", () => {
  assert.equal(readyScopeFromSearchParams(new URLSearchParams()), "serving");
  assert.equal(readyScopeFromSearchParams(new URLSearchParams("scope=launch")), "launch");
  assert.equal(readyScopeFromSearchParams(new URLSearchParams("scope=production")), "launch");
  assert.equal(readyScopeFromSearchParams(new URLSearchParams("strict=true")), "launch");
  assert.equal(readyScopeFromSearchParams(new URLSearchParams("strict=1")), "launch");
});

test("buildReadyResponse allows degraded serving readiness without overstating launch readiness", () => {
  const ready = buildReadyResponse({
    scope: "serving",
    database,
    readiness: degradedReadiness,
    organizationId: "tenant-a",
    tenantEvidence: { loaded: true, errors: [] },
    generatedAt: "2026-06-06T16:00:00.000Z",
  });

  assert.equal(ready.statusCode, 200);
  assert.equal(ready.payload.ok, true);
  assert.equal(ready.payload.scope, "serving");
  assert.equal(ready.payload.serving.ok, true);
  assert.equal(ready.payload.launch.ok, false);
  assert.equal(ready.payload.launch.manualActionCount, 1);
  assert.equal(ready.payload.launch.nextAction?.id, "sso");
  assert.equal(ready.payload.organizationId, "tenant-a");
});

test("buildReadyResponse makes strict launch readiness fail closed on warnings", () => {
  const ready = buildReadyResponse({
    scope: "launch",
    database,
    readiness: degradedReadiness,
    tenantEvidence: { loaded: false, errors: ["No tenant session."] },
  });

  assert.equal(ready.statusCode, 503);
  assert.equal(ready.payload.ok, false);
  assert.equal(ready.payload.scope, "launch");
  assert.equal(ready.payload.serving.ok, true);
  assert.equal(ready.payload.launch.ok, false);
  assert.match(ready.payload.launch.reason, /Strict launch readiness/);
});

test("buildReadyResponse only marks launch ready when runtime and launch contract are clean", () => {
  const ready = buildReadyResponse({
    scope: "launch",
    database,
    readiness: readyReadiness,
    tenantEvidence: { loaded: true, errors: [] },
  });

  assert.equal(ready.statusCode, 200);
  assert.equal(ready.payload.ok, true);
  assert.equal(ready.payload.launch.ok, true);
  assert.equal(ready.payload.launch.score, 100);
  assert.equal(ready.payload.launch.manualActionCount, 0);
  assert.equal(ready.payload.launch.nextAction, null);
});

test("buildPublicReadyResponse removes operator-only readiness detail", () => {
  const ready = buildReadyResponse({
    scope: "launch",
    database,
    readiness: degradedReadiness,
    organizationId: "tenant-a",
    tenantEvidence: { loaded: false, errors: ["No tenant session."] },
    generatedAt: "2026-06-06T16:00:00.000Z",
  });
  const response = buildPublicReadyResponse(ready);

  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.public, true);
  assert.equal(response.payload.schema, "enterprise-ai-enablement-os.ready.v1");
  assert.equal(response.payload.scope, "launch");
  assert.equal(response.payload.ok, false);
  assert.equal(response.payload.launch.manualActionCount, 1);
  assert.equal("nextAction" in response.payload.launch, false);

  const serialized = JSON.stringify(response.payload);
  assert.equal(serialized.includes("database"), false);
  assert.equal(serialized.includes("tenant-a"), false);
  assert.equal(serialized.includes("tenantEvidence"), false);
  assert.equal(serialized.includes("No tenant session"), false);
  assert.equal(serialized.includes("blockers"), false);
  assert.equal(serialized.includes("warnings"), false);
  assert.equal(serialized.includes("OIDC_CLIENT_SECRET"), false);
});
