import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveWorkIntelligence, workOpportunityToIntakeDraft } from "../src/lib/work-intelligence.ts";
import type { ContextSource, Skill, WorkSignal } from "../src/lib/enterprise-ai-data.ts";

const privacy: WorkSignal["privacy"] = {
  contentRedacted: true,
  piiRedacted: true,
  consentBasis: "aggregated",
  retentionDays: 90,
  individualScoringAllowed: false,
  rawContentStored: false,
};

function signal(overrides: Partial<WorkSignal>): WorkSignal {
  return {
    id: "ws-1",
    source: "service_now",
    eventType: "question_asked",
    department: "HR",
    process: "Policy self-service",
    summary: "Repeated PTO questions.",
    metadata: { volume: 100, delayHours: 5, cycleTimeHours: 12, confidence: 0.9 },
    privacy,
    riskLevel: "medium",
    createdAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "sk-1",
    name: "Policy Skill",
    slug: "policy-skill",
    description: "",
    department: "HR",
    ownerId: "u-1",
    status: "production",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 2000,
    fallbackModel: "",
    costLimit: 10,
    systemPrompt: "",
    allowedTools: [],
    blockedTools: [],
    contextSources: [],
    evalPassRate: 96,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

test("deriveWorkIntelligence: handles empty workspace safely", () => {
  const result = deriveWorkIntelligence({
    workSignals: [],
    useCases: [],
    skills: [],
    runs: [],
    contextSources: [],
  });

  assert.equal(result.totals.signals, 0);
  assert.equal(result.totals.privacyCoverage, 100);
  assert.deepEqual(result.opportunityRadar, []);
  assert.equal(result.privacyPosture.rawContentStored, false);
});

test("deriveWorkIntelligence: ranks opportunity radar by governed signal strength", () => {
  const result = deriveWorkIntelligence({
    workSignals: [
      signal({ id: "ws-low", department: "Legal", process: "Contract intake", metadata: { volume: 20, delayHours: 2, confidence: 0.7 } }),
      signal({ id: "ws-high", department: "IT", process: "Incident routing", eventType: "handoff_delayed", metadata: { volume: 1200, delayHours: 8, confidence: 0.95 } }),
    ],
    useCases: [],
    skills: [],
    runs: [],
    contextSources: [],
  });

  assert.equal(result.opportunityRadar[0].process, "Incident routing");
  assert.equal(result.opportunityRadar[0].recommendedPattern, "Workflow Redesign");
});

test("deriveWorkIntelligence: reports privacy posture from signal guardrails", () => {
  const result = deriveWorkIntelligence({
    workSignals: [
      signal({ id: "ws-safe" }),
      {
        ...signal({ id: "ws-unsafe" }),
        privacy: {
          ...privacy,
          rawContentStored: true,
          individualScoringAllowed: true,
        },
      } as unknown as WorkSignal,
    ],
    useCases: [],
    skills: [],
    runs: [],
    contextSources: [],
  });

  assert.equal(result.totals.privacyCoverage, 50);
  assert.equal(result.privacyPosture.rawContentStored, true);
  assert.equal(result.privacyPosture.individualScoringAllowed, true);
  assert.ok(result.executiveDecisions.some((decision) => decision.id === "decision-privacy-stop"));
});

test("deriveWorkIntelligence: surfaces stale context sources as quality alerts", () => {
  const contextSources: ContextSource[] = [
    {
      id: "cs-reg",
      name: "Regulatory Library",
      type: "SharePoint",
      classification: "regulated",
      ownerDepartment: "Compliance",
      enabled: true,
      lastIndexedAt: "2026-05-18T00:00:00.000Z",
      documentCount: 500,
      skillsUsing: 1,
      health: "stale",
    },
  ];

  const result = deriveWorkIntelligence({
    workSignals: [signal({ eventType: "context_gap", department: "Compliance", process: "Regulatory monitoring", metadata: { relatedContextSource: "Regulatory Library" } })],
    useCases: [],
    skills: [skill()],
    runs: [],
    contextSources,
  });

  assert.equal(result.contextQuality[0].sourceName, "Regulatory Library");
  assert.equal(result.contextQuality[0].sourceHealth, "stale");
  assert.ok(result.executiveDecisions.some((decision) => decision.id === "decision-context-quality"));
});

test("workOpportunityToIntakeDraft: promotes governed signals into scoring-ready intake", () => {
  const intelligence = deriveWorkIntelligence({
    workSignals: [
      signal({
        id: "ws-promo",
        eventType: "approval_waiting",
        department: "Finance",
        process: "Close variance follow-up",
        metadata: { volume: 900, delayHours: 16, cycleTimeHours: 30, confidence: 0.91 },
        riskLevel: "medium",
      }),
    ],
    useCases: [],
    skills: [],
    runs: [],
    contextSources: [],
  });

  const draft = workOpportunityToIntakeDraft(intelligence.opportunityRadar[0]);

  assert.equal(draft.department, "Finance");
  assert.match(draft.title, /Close variance follow-up/);
  assert.equal(draft.monthlyVolume, 900);
  assert.equal(draft.dataSensitivity, "medium");
  assert.equal(draft.humanReview, true);
  assert.match(draft.aiNotDo, /private employee messages/);
});
