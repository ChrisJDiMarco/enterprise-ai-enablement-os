import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeHarnessTraceForViewer, type HarnessTraceRecord } from "../src/lib/trace-store.ts";

const trace = {
  id: "trace-run-1",
  organizationId: "org-1",
  runId: "run-1",
  skillId: "skill-1",
  status: "completed",
  riskLevel: "high",
  createdAt: "2026-06-19T12:00:00.000Z",
  run: {
    id: "run-1",
    skillId: "skill-1",
    triggeredBy: "Operator",
    status: "completed",
    riskLevel: "high",
    currentStage: "Response Delivered",
    costUsd: 0.14,
    latencyMs: 420,
    startedAt: "2026-06-19T12:00:00.000Z",
    output: "Generated answer containing customer secret sk-live-sensitive.",
    executionMode: "live",
    trace: [
      {
        label: "Model call",
        status: "completed",
        detail: "Full prompt included payroll-plan.txt and sensitive user context.",
        latencyMs: 300,
      },
    ],
  },
  route: {
    provider: "openai",
    model: "gpt-sensitive-internal",
    modelRef: "openai/gpt-sensitive-internal",
    fallbackUsed: false,
    reason: "Selected because the raw prompt mentioned confidential HR content.",
  },
  policy: {
    context: {
      status: "approved",
      reason: "Allowed source payroll-plan.txt for this run.",
      policyId: "context-policy",
      riskLevel: "high",
    },
    tool: {
      status: "approved",
      reason: "Sensitive tool reason should stay server-side.",
      policyId: "tool-policy",
      riskLevel: "high",
    },
    output: {
      status: "approved",
      reason: "Output contained no blocked pattern.",
      policyId: "output-policy",
      riskLevel: "high",
    },
  },
  model: {
    inputTokens: 1200,
    outputTokens: 400,
    localFallback: false,
    providerError: false,
    finishReason: "stop",
    estimatedCostUsd: 0.14,
  },
  prompt: {
    contractId: "skill-1-contract",
    contractVersion: "2026.05",
    quality: {
      score: 94,
      grade: "excellent",
      passedChecks: 8,
      totalChecks: 8,
      missingCritical: [],
      findings: [
        {
          id: "secret-detail",
          label: "Secret detail",
          severity: "critical",
          passed: false,
          detail: "Finding detail referenced sk-live-sensitive.",
        },
      ],
    },
  },
} satisfies HarnessTraceRecord;

test("sanitizeHarnessTraceForViewer removes raw output, details, reasons, and prompt findings", () => {
  const sanitized = sanitizeHarnessTraceForViewer(trace);
  const serialized = JSON.stringify(sanitized);

  assert.equal(sanitized.run.outputRedacted, true);
  assert.equal(sanitized.run.trace[0]?.label, "Model call");
  assert.equal("detail" in (sanitized.run.trace[0] ?? {}), false);
  assert.equal("output" in sanitized.run, false);
  assert.equal("reason" in sanitized.route, false);
  assert.equal("reason" in sanitized.policy.context, false);
  assert.equal("findings" in sanitized.prompt.quality, false);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("payroll-plan.txt"), false);
  assert.equal(serialized.includes("confidential HR content"), false);
  assert.equal(serialized.includes("Sensitive tool reason"), false);
});
