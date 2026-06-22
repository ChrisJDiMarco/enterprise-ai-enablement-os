import { test } from "node:test";
import assert from "node:assert/strict";

import type { IntakeForm } from "../src/lib/ui/types.ts";
import { defaultAISettings } from "../src/lib/model-router.ts";
import {
  buildEvalRun,
  buildExecutiveBrief,
  buildGovernanceReview,
  buildPatternInstall,
  buildSkillFromUseCase,
  buildUseCaseSubmission,
  validateUseCaseIntake,
} from "../src/lib/workspace-commands.ts";
import type { PatternMarketplaceItem } from "../src/lib/pattern-marketplace.ts";
import type { Skill, Tool, UseCase } from "../src/lib/enterprise-ai-data.ts";

const validIntake: IntakeForm = {
  title: "HR Policy Copilot",
  department: "HR",
  businessProblem: "Employees wait too long for repeated policy answers.",
  currentProcess: "Employees email HR and HR manually checks the policy handbook.",
  desiredOutcome: "Employees get cited answers from approved HR sources.",
  aiHelp: "Answer routine policy questions and cite sources.",
  aiNotDo: "Approve leave, change records, or make employment decisions.",
  monthlyVolume: 4200,
  avgHandlingTimeMinutes: 11,
  estimatedUsers: 180,
  dataSensitivity: "medium",
  dataSources: "HR handbook\nBenefits guide",
  humanReview: true,
  externalCommunication: false,
};

const readTool: Tool = {
  id: "sharepoint.read_policy",
  displayName: "Read policy",
  description: "Read approved policy sources.",
  category: "document",
  actionType: "read",
  riskLevel: "low",
  requiresApprovalByDefault: false,
  enabled: true,
  usage: 0,
  lastUsed: "Never",
};

const writeTool: Tool = {
  id: "email.send_external",
  displayName: "Send external email",
  description: "Sends an external email.",
  category: "email",
  actionType: "create",
  riskLevel: "high",
  requiresApprovalByDefault: true,
  enabled: true,
  usage: 0,
  lastUsed: "Never",
};

function makeUseCase(): UseCase {
  const outcome = buildUseCaseSubmission({
    intake: validIntake,
    currentUserId: "user-1",
    useCaseId: "uc-1",
    createdAt: "2026-06-02",
    updatedAt: "2026-06-02",
  });
  assert("data" in outcome);
  return outcome.data.useCase;
}

function skill(): Skill {
  return buildSkillFromUseCase({
    useCase: makeUseCase(),
    currentUserId: "user-1",
    skillId: "skill-1",
    aiSettings: defaultAISettings,
    tools: [readTool, writeTool],
    updatedAt: "2026-06-02",
  }).data.skill;
}

test("validateUseCaseIntake: blocks incomplete production intake at the right step", () => {
  const missingSources = validateUseCaseIntake({ ...validIntake, dataSources: "" });

  assert.equal(missingSources.ok, false);
  if (!missingSources.ok) {
    assert.equal(missingSources.intakeStep, 2);
    assert.match(missingSources.notification, /approved data source/i);
  }
});

test("buildUseCaseSubmission: scores and packages an intake record", () => {
  const outcome = buildUseCaseSubmission({
    intake: validIntake,
    currentUserId: "user-1",
    useCaseId: "uc-1",
    createdAt: "2026-06-02",
    updatedAt: "2026-06-02",
  });

  assert("data" in outcome);
  assert.equal(outcome.data.useCase.status, "scored");
  assert.equal(outcome.data.useCase.dataSources.length, 2);
  assert.equal(outcome.data.useCase.riskLevel, "medium");
  assert.ok(outcome.data.useCase.priorityScore > 0);
  assert.equal(outcome.audit?.eventType, "use_case_created");
});

test("buildSkillFromUseCase: creates a governed Skill with read tools and blocked approval tools", () => {
  const outcome = buildSkillFromUseCase({
    useCase: makeUseCase(),
    currentUserId: "user-1",
    skillId: "skill-1",
    aiSettings: defaultAISettings,
    tools: [readTool, writeTool],
    updatedAt: "2026-06-02",
  });

  assert.equal(outcome.data.skill.status, "draft");
  assert.deepEqual(outcome.data.skill.allowedTools, ["sharepoint.read_policy"]);
  assert.deepEqual(outcome.data.skill.blockedTools, ["email.send_external"]);
  assert.equal(outcome.data.updatedUseCase.linkedSkillId, "skill-1");
  assert.equal(outcome.audit?.eventType, "skill_created");
});

test("buildPatternInstall: turns a marketplace template into linked use case and Skill records", () => {
  const pattern: PatternMarketplaceItem = {
    id: "starter",
    kind: "starter-template",
    title: "Finance Close Assistant",
    department: "Finance",
    process: "Close variance review",
    patternType: "Agentic Workflow",
    description: "Summarizes close variance evidence.",
    readiness: 70,
    installConfidence: 80,
    evidence: "Template evidence",
    controls: ["NIST.MEASURE"],
    promptStarter: "Never fabricate numbers.",
    recommendedFor: ["Finance"],
  };

  const outcome = buildPatternInstall({
    pattern,
    currentUserId: "user-1",
    timestamp: 123,
    today: "2026-06-02",
    aiSettings: defaultAISettings,
    tools: [readTool, writeTool],
    actor: "Builder",
  });

  assert.equal(outcome.data.useCase.linkedSkillId, outcome.data.skill.id);
  // Skills are born read-only; autonomy elevation is a separate governed step.
  assert.equal(outcome.data.skill.autonomyTier, "tier_1_read_only");
  assert.equal(outcome.data.skill.riskLevel, "medium");
  assert.equal(outcome.audit?.actor, "Builder");
});

test("buildEvalRun and buildGovernanceReview: generate launch artifacts from a Skill", () => {
  const activeSkill = skill();
  const evalOutcome = buildEvalRun(activeSkill, "10:00 AM");
  const reviewOutcome = buildGovernanceReview(evalOutcome.data.updatedSkill, "2026-06-02");

  assert.equal(evalOutcome.data.result.skillId, activeSkill.id);
  assert.equal(evalOutcome.data.updatedSkill.evalPassRate, evalOutcome.data.result.score);
  assert.equal(reviewOutcome.data.review.itemId, activeSkill.id);
  assert.equal(reviewOutcome.data.updatedSkill.status, "in_review");
});

test("buildExecutiveBrief: keeps production-empty workspaces honest", () => {
  const outcome = buildExecutiveBrief({
    useCases: [],
    skills: [],
    governanceReviews: [],
    workSignals: [],
    metrics: {
      totalUseCases: 0,
      activePilots: 0,
      skills: 0,
      adoptionRate: 0,
      hoursSaved: 0,
      annualValue: 0,
      riskItemsOpen: 0,
    },
    statusLabels: {},
  });

  assert.equal(outcome.data.shouldAudit, false);
  assert.match(outcome.data.report, /No portfolio records/i);
});
