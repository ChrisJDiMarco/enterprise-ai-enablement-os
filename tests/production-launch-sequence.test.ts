import test from "node:test";
import assert from "node:assert/strict";

import { deriveProductionLaunchSequence } from "../src/lib/production-launch-sequence.ts";
import type { ProductionReadiness } from "../src/lib/ui/types.ts";

test("deriveProductionLaunchSequence: groups launch gaps into executable phases", () => {
  const sequence = deriveProductionLaunchSequence({
    manualActions: [
      {
        id: "sso",
        title: "Connect enterprise SSO",
        severity: "blocker",
        owner: "Identity",
        action: "Set OIDC values.",
        why: "SSO is required.",
        env: ["OIDC_ISSUER", "OIDC_CLIENT_ID"],
        verify: "Complete SSO callback.",
      },
      {
        id: "providers",
        title: "Configure external model providers",
        severity: "warning",
        owner: "AI",
        action: "Set model keys.",
        why: "External runtime is needed.",
        env: ["OPENAI_API_KEY"],
        verify: "Open /api/providers.",
      },
    ],
  } satisfies ProductionReadiness);

  const identity = sequence.find((step) => step.id === "identity");
  const aiRuntime = sequence.find((step) => step.id === "ai-runtime");
  const operations = sequence.find((step) => step.id === "operations");

  assert.equal(identity?.status, "blocker");
  assert.deepEqual(identity?.env, ["OIDC_CLIENT_ID", "OIDC_ISSUER"]);
  assert.equal(aiRuntime?.status, "warning");
  assert.equal(operations?.status, "ready");
});
