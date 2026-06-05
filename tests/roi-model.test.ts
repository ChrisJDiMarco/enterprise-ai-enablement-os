import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoiPortfolio, buildRoiRows, ROI_MODEL_ASSUMPTIONS, useCaseConfidence } from "../src/lib/roi-model.ts";
import type { UseCase } from "../src/lib/enterprise-ai-data.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-test",
    title: "Finance Close Briefing",
    description: "Summarize close status.",
    department: "Finance",
    requestorId: "u-1",
    businessProblem: "Manual weekly close summaries take too long.",
    currentProcess: "Analysts collect updates manually.",
    desiredOutcome: "Produce a governed summary with owner follow-ups.",
    monthlyVolume: 100,
    avgHandlingTimeMinutes: 30,
    estimatedUsers: 20,
    capabilityType: "agentic_workflow",
    status: "scored",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 2.5,
    reuseScore: 4,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 80,
    expectedBenefits: [],
    dataSources: [],
    risks: [],
    updatedAt: "May 29, 2026",
    createdAt: "May 29, 2026",
    ...overrides,
  };
}

test("buildRoiRows: derives value from saved use case assumptions", () => {
  const rows = buildRoiRows([useCase()]);
  const monthlyHours = (100 * 30) / 60;
  const expected =
    monthlyHours *
    ROI_MODEL_ASSUMPTIONS.loadedHourlyCostUsd *
    12 *
    ROI_MODEL_ASSUMPTIONS.adoptionCaptureRate;

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.hours, monthlyHours);
  assert.equal(rows[0]?.expected, expected);
  assert.equal(rows[0]?.adoption, 62);
  assert.equal(rows[0]?.confidence, "high");
});

test("buildRoiRows: skips records without baseline volume or time", () => {
  assert.deepEqual(buildRoiRows([useCase({ monthlyVolume: 0 }), useCase({ avgHandlingTimeMinutes: 0 })]), []);
});

test("buildRoiPortfolio: rolls up conservative, expected, and optimistic bands", () => {
  const portfolio = buildRoiPortfolio([useCase(), useCase({ id: "uc-2", title: "Legal Intake", monthlyVolume: 50 })]);

  assert.equal(portfolio.rows.length, 2);
  assert.ok(portfolio.conservative < portfolio.expected);
  assert.ok(portfolio.optimistic > portfolio.expected);
});

test("useCaseConfidence: maps data readiness to confidence labels", () => {
  assert.equal(useCaseConfidence({ dataReadinessScore: 4 }), "high");
  assert.equal(useCaseConfidence({ dataReadinessScore: 3 }), "medium");
  assert.equal(useCaseConfidence({ dataReadinessScore: 2 }), "low");
});
