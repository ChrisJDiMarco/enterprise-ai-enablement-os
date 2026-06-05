import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import {
  deriveFactoryIntelligence,
  deriveIntakeIntelligence,
  deriveUseCaseIntelligence,
  parseIntakeSources,
} from "../src/lib/use-case-intelligence.ts";
import type { IntakeForm } from "../src/lib/ui/types.ts";

const hrIntake: IntakeForm = {
  title: "Benefits Policy Assistant",
  department: "HR",
  businessProblem: "Employees wait several days for benefits and PTO policy answers.",
  currentProcess: "Employees email People Ops, then HR searches approved policy documents.",
  desiredOutcome: "Employees receive fast cited answers while sensitive edge cases route to HR.",
  aiHelp: "Answer routine policy questions from approved sources and draft escalation notes.",
  aiNotDo: "Approve benefits, change employee records, or decide employee eligibility.",
  monthlyVolume: 2400,
  avgHandlingTimeMinutes: 11,
  estimatedUsers: 1800,
  dataSensitivity: "medium",
  dataSources: "HR Policy Manual, Benefits Guide 2026",
  humanReview: true,
  externalCommunication: false,
};

test("intake intelligence routes sensitive HR ideas through governance", () => {
  const intelligence = deriveIntakeIntelligence(hrIntake);

  assert.equal(intelligence.recommendedPattern, "Prepare Action Skill");
  assert.equal(intelligence.autonomyTier, "tier_2_prepare_action");
  assert.equal(intelligence.dataReadinessLabel, "ready");
  assert.equal(intelligence.valueConfidence, "high");
  assert.equal(intelligence.contextSources.length, 2);
  assert.equal(intelligence.requiredReviews.includes("Privacy"), true);
  assert.equal(intelligence.requiredReviews.includes("People/HR Owner"), true);
  assert.equal(intelligence.riskCategories.includes("Employee impact"), true);
  assert.equal(intelligence.missingFields.length, 0);
  assert.match(intelligence.generatedSummary, /Benefits Policy Assistant/);
});

test("source parsing handles comma and line separated context sources", () => {
  assert.deepEqual(parseIntakeSources("SharePoint Policy\nBenefits Guide, People Ops SOP"), [
    "SharePoint Policy",
    "Benefits Guide",
    "People Ops SOP",
  ]);
});

test("use case intelligence identifies missing evidence before launch", () => {
  const workspace = buildDemoWorkspace("demo");
  const legal = workspace.useCases.find((item) => item.department === "Legal");
  assert.ok(legal);

  const intelligence = deriveUseCaseIntelligence({ ...legal, dataSources: [], risks: [], ownerId: undefined });

  assert.equal(intelligence.missingEvidence.includes("Accountable owner"), true);
  assert.equal(intelligence.missingEvidence.includes("Approved context sources"), true);
  assert.equal(intelligence.missingEvidence.includes("Risk register"), true);
  assert.equal(intelligence.requiredReviews.includes("Legal"), true);
  assert.equal(intelligence.discoveryQuestions.length > 0, true);
});

test("factory intelligence keeps production-empty workspace guided", () => {
  const intelligence = deriveFactoryIntelligence([]);

  assert.equal(intelligence.nextBestAction.targetTab, "intake");
  assert.equal(intelligence.departmentCoverage.represented, 0);
  assert.equal(intelligence.portfolioGaps.includes("No opportunity portfolio exists yet"), true);
  assert.match(intelligence.operatingNarrative, /production-empty/);
});

test("factory intelligence selects a concrete next action from the portfolio", () => {
  const workspace = buildDemoWorkspace("demo");
  const intelligence = deriveFactoryIntelligence(workspace.useCases);

  assert.ok(intelligence.topOpportunity);
  assert.equal(typeof intelligence.nextBestAction.title, "string");
  assert.equal(intelligence.reusablePatternSignals.length > 0, true);
  assert.equal(intelligence.departmentCoverage.represented > 0, true);
});
