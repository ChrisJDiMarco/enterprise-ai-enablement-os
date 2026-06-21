import { ok, strictEqual } from "node:assert";
import { test } from "node:test";

import type { Skill, UseCase, WorkSignal } from "../src/lib/enterprise-ai-data.ts";
import { deriveWorkflowCapturePacket } from "../src/lib/workflow-capture.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "Employee policy support",
    description: "Help HR answer policy questions.",
    department: "HR",
    requestorId: "u-1",
    ownerId: "u-2",
    businessProblem: "Teams wait for repeated policy answers.",
    currentProcess: "Employee asks HR, HR searches policy, HR routes exceptions to legal.",
    desiredOutcome: "AI drafts grounded policy answers and routes exceptions.",
    monthlyVolume: 420,
    avgHandlingTimeMinutes: 16,
    estimatedUsers: 120,
    capabilityType: "Knowledge support",
    status: "approved_for_pilot",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 2,
    reuseScore: 5,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 91,
    expectedBenefits: ["Faster answers"],
    dataSources: ["Employee handbook", "HR policy"],
    risks: ["Outdated policy citation"],
    linkedSkillId: "skill-1",
    updatedAt: "2026-06-10T12:00:00.000Z",
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "Policy Answer Assistant",
    slug: "policy-answer-assistant",
    description: "Drafts grounded HR policy answers.",
    department: "HR",
    ownerId: "u-2",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "OpenAI",
    model: "gpt-4.1",
    temperature: 0.2,
    maxTokens: 2_000,
    fallbackModel: "gpt-4.1-mini",
    costLimit: 50,
    systemPrompt: "Answer from policy only.",
    allowedTools: ["search.policy"],
    blockedTools: [],
    contextSources: ["Employee handbook"],
    evalPassRate: 89,
    adoptionCount: 50,
    valueDelivered: 35_000,
    runs: 80,
    updatedAt: "2026-06-12T12:00:00.000Z",
    ...overrides,
  };
}

function signal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "sig-1",
    source: "learning_platform",
    eventType: "training_completed",
    department: "HR",
    process: "Employee policy support",
    summary: "HR launch cohort completed policy assistant training.",
    metadata: { relatedUseCaseId: "uc-1", relatedSkillId: "skill-1", confidence: 0.91 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 365,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2026-06-18T12:00:00.000Z",
    ...overrides,
  };
}

test("deriveWorkflowCapturePacket produces a publish-ready packet from a mature use case", () => {
  const packet = deriveWorkflowCapturePacket({
    useCase: useCase(),
    skill: skill(),
    workSignals: [signal()],
  });

  ok(packet.readiness >= 78);
  strictEqual(packet.agentContext.ready, true);
  strictEqual(packet.review.status, "publish_ready");
  ok(packet.review.qualityScore >= 80);
  ok(packet.headline.includes("Ready to publish"));
  strictEqual(packet.pipeline.filter((stage) => stage.status === "ready").length, 6);
  ok(packet.insights.some((insight) => insight.id === "agent" && insight.value === "Ready"));
  ok(packet.sources.some((source) => source.id === "web" && source.status === "ready"));
  ok(packet.sources.some((source) => source.id === "import" && source.status === "ready"));
  ok(packet.distribution.some((target) => target.id === "sidekick" && target.status === "ready"));
  ok(packet.distribution.some((target) => target.id === "audit_export" && target.status === "ready"));
  ok(packet.security.some((control) => control.id === "redaction" && control.status === "ready"));
  ok(packet.analytics.views > 0);
  ok(packet.analytics.completions > 0);
  ok(packet.review.observedSteps.length >= 5);
  ok(packet.review.artifacts.some((artifact) => artifact.type === "source" && artifact.status === "ready"));
  strictEqual(packet.captureModes.filter((mode) => mode.complete).length, 5);
  ok(packet.sopOutline.some((line) => line.includes("Employee handbook")));
  strictEqual(packet.procedure.status, "ready_to_publish");
  ok(packet.procedure.modules.some((module) => module.id === "agent_context" && module.ready));
  ok(packet.procedure.stepGuide.some((step) => step.aiSupport.includes("Policy Answer Assistant")));
  ok(packet.procedure.exports.some((target) => target.id === "agent_context" && target.ready));
});

test("deriveWorkflowCapturePacket identifies missing capture inputs", () => {
  const packet = deriveWorkflowCapturePacket({
    useCase: useCase({ currentProcess: "", dataSources: [], risks: [], linkedSkillId: undefined }),
    skill: null,
    workSignals: [],
  });

  strictEqual(packet.agentContext.ready, false);
  strictEqual(packet.review.status, "empty");
  ok(packet.pipeline.some((stage) => stage.id === "capture" && stage.status === "next"));
  ok(packet.pipeline.some((stage) => stage.id === "publish" && stage.status === "blocked"));
  ok(packet.insights.some((insight) => insight.id === "path" && insight.status === "missing"));
  ok(packet.sources.some((source) => source.id === "web" && source.status === "missing"));
  ok(packet.distribution.some((target) => target.id === "training_flow" && target.status === "missing"));
  ok(packet.security.some((control) => control.id === "redaction" && control.status === "missing"));
  strictEqual(packet.analytics.views, 0);
  ok(packet.review.editQueue.some((item) => item.label.includes("Record")));
  ok(packet.review.publishGates.some((gate) => gate.status === "missing"));
  ok(packet.agentContext.missing.includes("workflow recording"));
  ok(packet.agentContext.missing.includes("approved sources"));
  ok(packet.agentContext.missing.includes("governed Skill"));
  strictEqual(packet.procedure.status, "needs_sources");
  ok(packet.procedure.exports.some((target) => target.id === "agent_context" && !target.ready));
});

test("deriveWorkflowCapturePacket handles no selected use case", () => {
  const packet = deriveWorkflowCapturePacket({ useCase: null, skill: null, workSignals: [] });

  strictEqual(packet.readiness, 0);
  strictEqual(packet.title, "Select a workflow to capture");
  strictEqual(packet.procedure.title, "No procedure selected");
  strictEqual(packet.review.status, "empty");
  strictEqual(packet.review.qualityScore, 0);
  strictEqual(packet.pipeline[0]?.status, "next");
  strictEqual(packet.insights[0]?.value, "Needed");
  strictEqual(packet.sources[0]?.status, "missing");
  strictEqual(packet.distribution[0]?.status, "missing");
  strictEqual(packet.security[0]?.status, "missing");
  strictEqual(packet.analytics.summary, "Analytics begin after the workflow is captured and assigned.");
  ok(packet.nextAction.includes("Select"));
});
