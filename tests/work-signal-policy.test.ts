import { test } from "node:test";
import assert from "node:assert/strict";
import { workSignalBatchInputSchema } from "../src/lib/api-validation.ts";
import {
  normalizeWorkSignals,
  resolveWorkSignalReferences,
  summarizeWorkSignalRisk,
  workSignalPrivacyIssues,
} from "../src/lib/work-signal-policy.ts";
import type { ContextSource, Skill, UseCase, WorkSignal } from "../src/lib/enterprise-ai-data.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

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

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-work-signal",
    title: "Case Review Assistant",
    description: "Help operators review cases.",
    department: "Operations",
    requestorId: "user-1",
    ownerId: "user-1",
    businessProblem: "Case review is slow.",
    currentProcess: "Operators inspect each case manually.",
    desiredOutcome: "Operators get cited case guidance.",
    monthlyVolume: 500,
    avgHandlingTimeMinutes: 12,
    estimatedUsers: 40,
    capabilityType: "knowledge_assistant",
    status: "scored",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 2,
    reuseScore: 4,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 76,
    expectedBenefits: ["hours_saved"],
    dataSources: ["Policy Library"],
    risks: ["Policy grounding"],
    linkedSkillId: "skill-work-signal",
    createdAt: "2026-05-28",
    updatedAt: "2026-05-28",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-work-signal",
    useCaseId: "uc-work-signal",
    name: "Case Review Assistant",
    slug: "case-review-assistant",
    description: "Help operators review cases.",
    department: "Operations",
    ownerId: "user-1",
    status: "production",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "openai",
    model: "gpt-4.1",
    temperature: 0.2,
    maxTokens: 1200,
    fallbackModel: "local",
    costLimit: 0.5,
    systemPrompt: "Use approved context only.",
    allowedTools: [],
    blockedTools: [],
    contextSources: ["source-policy"],
    evalPassRate: 93,
    adoptionCount: 12,
    valueDelivered: 12000,
    runs: 4,
    updatedAt: "2026-05-28",
    ...overrides,
  };
}

function contextSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: "source-policy",
    name: "Policy Library",
    type: "SharePoint",
    classification: "internal",
    ownerDepartment: "Operations",
    enabled: true,
    lastIndexedAt: "2026-05-28T00:00:00.000Z",
    documentCount: 20,
    skillsUsing: 1,
    health: "healthy",
    ...overrides,
  };
}

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

test("resolveWorkSignalReferences: canonicalizes known relationships and enriches linked records", () => {
  const workspace = {
    ...emptyWorkspace("org-work-signal-policy"),
    useCases: [useCase()],
    skills: [skill()],
    contextSources: [contextSource()],
  };

  const resolvedFromSkill = resolveWorkSignalReferences({
    workspace,
    signals: [
      {
        ...safeSignal,
        id: "ws-skill",
        metadata: {
          relatedSkillId: "skill-work-signal",
          relatedContextSource: "source-policy",
        },
      },
    ],
  });
  assert.deepEqual(resolvedFromSkill.issues, []);
  assert.equal(resolvedFromSkill.signals[0]?.metadata.relatedSkillId, "skill-work-signal");
  assert.equal(resolvedFromSkill.signals[0]?.metadata.relatedUseCaseId, "uc-work-signal");
  assert.equal(resolvedFromSkill.signals[0]?.metadata.relatedContextSource, "Policy Library");

  const resolvedFromUseCase = resolveWorkSignalReferences({
    workspace,
    signals: [{ ...safeSignal, id: "ws-use-case", metadata: { relatedUseCaseId: "uc-work-signal" } }],
  });
  assert.deepEqual(resolvedFromUseCase.issues, []);
  assert.equal(resolvedFromUseCase.signals[0]?.metadata.relatedSkillId, "skill-work-signal");
});

test("resolveWorkSignalReferences: rejects stale or mismatched Skill and use case relationships", () => {
  const workspace = {
    ...emptyWorkspace("org-work-signal-policy"),
    useCases: [useCase({ id: "uc-one", linkedSkillId: "skill-one" }), useCase({ id: "uc-two", linkedSkillId: "skill-two" })],
    skills: [skill({ id: "skill-one", useCaseId: "uc-one" }), skill({ id: "skill-two", useCaseId: "uc-two" })],
    contextSources: [contextSource()],
  };

  const missing = resolveWorkSignalReferences({
    workspace,
    signals: [
      {
        ...safeSignal,
        id: "ws-missing",
        metadata: {
          relatedSkillId: "skill-missing",
          relatedUseCaseId: "uc-missing",
          relatedContextSource: "unknown-source",
        },
      },
    ],
  });
  assert.deepEqual(missing.issues.map((issue) => issue.field).sort(), [
    "metadata.relatedContextSource",
    "metadata.relatedSkillId",
    "metadata.relatedUseCaseId",
  ]);

  const mismatched = resolveWorkSignalReferences({
    workspace,
    signals: [{ ...safeSignal, id: "ws-mismatch", metadata: { relatedSkillId: "skill-one", relatedUseCaseId: "uc-two" } }],
  });
  assert.equal(mismatched.issues.length, 1);
  assert.equal(mismatched.issues[0]?.field, "metadata.relatedSkillId");
  assert.match(mismatched.issues[0]?.message ?? "", /not linked/);
});

test("resolveWorkSignalReferences: allows unmapped context sources only for context gap signals", () => {
  const workspace = {
    ...emptyWorkspace("org-work-signal-policy"),
    contextSources: [contextSource()],
  };

  const allowedGap = resolveWorkSignalReferences({
    workspace,
    signals: [
      {
        ...safeSignal,
        id: "ws-context-gap",
        eventType: "context_gap",
        metadata: { relatedContextSource: "Missing Policy Store" },
      },
    ],
  });
  assert.deepEqual(allowedGap.issues, []);
  assert.equal(allowedGap.signals[0]?.metadata.relatedContextSource, "Missing Policy Store");

  const rejectedQuestion = resolveWorkSignalReferences({
    workspace,
    signals: [
      {
        ...safeSignal,
        id: "ws-question",
        eventType: "question_asked",
        metadata: { relatedContextSource: "Missing Policy Store" },
      },
    ],
  });
  assert.equal(rejectedQuestion.issues.length, 1);
  assert.equal(rejectedQuestion.issues[0]?.field, "metadata.relatedContextSource");
});

test("summarizeWorkSignalRisk: returns the highest signal risk", () => {
  assert.equal(summarizeWorkSignalRisk([safeSignal, { ...safeSignal, id: "ws-high", riskLevel: "high" }]), "high");
});
