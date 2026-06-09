import test from "node:test";
import assert from "node:assert/strict";

import { buildLaunchManualActions, launchManualActionsMarkdown } from "../src/lib/launch-manifest.ts";
import type { ReadinessCheck } from "../src/lib/production-readiness.ts";

test("buildLaunchManualActions turns readiness gaps into deduplicated launch work", () => {
  const checks: ReadinessCheck[] = [
    {
      id: "database",
      label: "Durable persistence",
      status: "fail",
      detail: "DATABASE_URL is missing.",
    },
    {
      id: "providers",
      label: "External model providers",
      status: "warn",
      detail: "Only deterministic local runtime is configured.",
    },
    {
      id: "providers",
      label: "External model providers",
      status: "warn",
      detail: "Duplicate should be ignored.",
    },
    {
      id: "api-protection",
      label: "API protection",
      status: "pass",
      detail: "Configured.",
    },
  ];

  const actions = buildLaunchManualActions(checks);

  assert.equal(actions.length, 2);
  assert.equal(actions[0].id, "database");
  assert.equal(actions[0].severity, "blocker");
  assert.deepEqual(actions[0].env.slice(0, 2), ["DATABASE_URL", "DATABASE_SSL"]);
  assert.equal(actions[1].id, "providers");
  assert.equal(actions[1].severity, "warning");
});

test("launchManualActionsMarkdown creates an executive-safe handoff", () => {
  const actions = buildLaunchManualActions([
    {
      id: "sso",
      label: "OIDC SSO",
      status: "warn",
      detail: "OIDC is not configured.",
    },
  ]);

  const markdown = launchManualActionsMarkdown(actions);

  assert.match(markdown, /Connect enterprise SSO/);
  assert.match(markdown, /Owner: Identity/);
  assert.match(markdown, /OIDC_ISSUER/);
  assert.match(markdown, /Verify:/);
});

test("launchManualActionsMarkdown reports clean readiness clearly", () => {
  assert.equal(launchManualActionsMarkdown([]), "All production launch checks are passing.");
});

test("buildLaunchManualActions includes user provisioning launch work", () => {
  const actions = buildLaunchManualActions([
    {
      id: "user-provisioning",
      label: "User provisioning lifecycle",
      status: "fail",
      detail: "No provisioning token is configured.",
    },
  ]);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].owner, "Identity");
  assert.equal(actions[0].env.includes("PROVISIONING_API_TOKEN"), true);
  assert.match(actions[0].verify, /\/api\/provisioning\/users/);
});

test("buildLaunchManualActions gives evidence-quality checks concrete owners and verification", () => {
  const actions = buildLaunchManualActions([
    {
      id: "connector-execution-evidence",
      label: "Connector execution evidence",
      status: "warn",
      detail: "No tenant connector event ledger was loaded.",
    },
    {
      id: "harness-trace-evidence",
      label: "Harness trace evidence quality",
      status: "warn",
      detail: "No tenant Harness trace evidence was loaded.",
    },
  ]);
  const connector = actions.find((action) => action.id === "connector-execution-evidence");
  const harness = actions.find((action) => action.id === "harness-trace-evidence");

  assert.equal(connector?.owner, "Integrations");
  assert.match(connector?.action ?? "", /connector execution envelope/);
  assert.equal(connector?.env.includes("CONNECTOR_BROKER_TOKEN"), true);
  assert.match(connector?.verify ?? "", /zero legacy events/);

  assert.equal(harness?.owner, "Operations");
  assert.match(harness?.action ?? "", /Run the selected launch Skill through the Harness/);
  assert.equal(harness?.env.includes("DATABASE_URL"), true);
  assert.match(harness?.verify ?? "", /zero unsafe prompt contracts/);
});
