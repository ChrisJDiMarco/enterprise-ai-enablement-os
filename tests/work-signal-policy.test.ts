import { test } from "node:test";
import assert from "node:assert/strict";
import { workSignalBatchInputSchema } from "../src/lib/api-validation.ts";
import { normalizeWorkSignals, summarizeWorkSignalRisk, workSignalPrivacyIssues } from "../src/lib/work-signal-policy.ts";
import type { WorkSignal } from "../src/lib/enterprise-ai-data.ts";

const safeSignal: WorkSignal = {
  id: "ws-safe",
  source: "workflow",
  eventType: "workflow_delayed",
  department: "Operations",
  process: "Case review",
  teamId: "ops-team",
  summary: "Aggregated workflow metadata shows case review delays.",
  metadata: { volume: 20, delayHours: 3, cycleTimeHours: 8, confidence: 0.9 },
  privacy: {
    contentRedacted: true,
    piiRedacted: true,
    consentBasis: "system_metadata",
    retentionDays: 60,
    individualScoringAllowed: false,
    rawContentStored: false,
  },
  riskLevel: "low",
  createdAt: "2026-05-28T00:00:00.000Z",
};

test("workSignalBatchInputSchema: accepts a redacted aggregate signal", () => {
  const parsed = workSignalBatchInputSchema.safeParse({ signals: [safeSignal] });
  assert.equal(parsed.success, true);
});

test("workSignalBatchInputSchema: rejects raw content storage and individual scoring", () => {
  const parsed = workSignalBatchInputSchema.safeParse({
    signals: [
      {
        ...safeSignal,
        privacy: {
          ...safeSignal.privacy,
          rawContentStored: true,
          individualScoringAllowed: true,
        },
      },
    ],
  });

  assert.equal(parsed.success, false);
});

test("workSignalPrivacyIssues: user-level signals require explicit opt-in", () => {
  const issues = workSignalPrivacyIssues({
    ...safeSignal,
    userId: "u-123",
    privacy: { ...safeSignal.privacy, consentBasis: "aggregated" },
  });

  assert.ok(issues.some((issue) => issue.field === "userId"));
});

test("normalizeWorkSignals: removes unsafe signals and de-duplicates by id", () => {
  const normalized = normalizeWorkSignals([
    safeSignal,
    { ...safeSignal, summary: "Newer duplicate", createdAt: "2026-05-29T00:00:00.000Z" },
    {
      ...safeSignal,
      id: "ws-unsafe",
      privacy: { ...safeSignal.privacy, contentRedacted: false },
    },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].summary, "Newer duplicate");
});

test("summarizeWorkSignalRisk: returns the highest signal risk", () => {
  assert.equal(summarizeWorkSignalRisk([safeSignal, { ...safeSignal, id: "ws-high", riskLevel: "high" }]), "high");
});
