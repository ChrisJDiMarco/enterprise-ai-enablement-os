import assert from "node:assert/strict";
import test from "node:test";
import { deriveEvidenceGraph } from "../src/lib/evidence-graph.ts";

test("deriveEvidenceGraph points an empty workspace at opportunity capture", () => {
  const graph = deriveEvidenceGraph({
    useCases: [],
    skills: [],
    runs: [],
    evalResults: [],
    governanceReviews: [],
    auditLogs: [],
  });

  assert.equal(graph.score, 0);
  assert.equal(graph.nextAction?.id, "opportunity");
  assert.equal(graph.nextAction?.targetView, "factory");
  assert.ok(graph.gaps.some((gap) => gap.includes("Opportunity portfolio")));
});

test("deriveEvidenceGraph scores a closed-loop workspace as executive-ready", () => {
  const graph = deriveEvidenceGraph({
    useCases: [
      {
        id: "uc-1",
        title: "Policy Self-Service",
        description: "Reduce repetitive policy questions.",
        department: "HR",
        requestorId: "user-1",
        ownerId: "owner-1",
        businessProblem: "Employees wait too long for policy answers.",
        currentProcess: "Employees email HR.",
        desiredOutcome: "Answers are grounded and fast.",
        monthlyVolume: 1200,
        avgHandlingTimeMinutes: 8,
        estimatedUsers: 400,
        capabilityType: "knowledge_assistant",
        status: "approved_for_pilot",
        riskLevel: "medium",
        valueScore: 5,
        feasibilityScore: 4,
        riskScore: 2,
        reuseScore: 5,
        urgencyScore: 4,
        dataReadinessScore: 4,
        priorityScore: 92,
        expectedBenefits: ["hours_saved"],
        dataSources: ["HR Policy Manual"],
        risks: ["hallucination"],
        linkedSkillId: "skill-1",
        updatedAt: "2026-05-29",
        createdAt: "2026-05-29",
      },
    ],
    skills: [
      {
        id: "skill-1",
        useCaseId: "uc-1",
        name: "Policy Self-Service",
        slug: "policy-self-service",
        description: "Answers approved policy questions.",
        department: "HR",
        ownerId: "owner-1",
        status: "pilot",
        version: "1.0.0",
        riskLevel: "medium",
        autonomyTier: "tier_1_read_only",
        modelProvider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        maxTokens: 2000,
        fallbackModel: "openrouter/auto",
        costLimit: 0.25,
        systemPrompt: "Answer only from approved sources and cite evidence.",
        allowedTools: ["sharepoint.read_policy"],
        blockedTools: ["email.send_external"],
        contextSources: ["HR Policy Manual"],
        evalPassRate: 96,
        adoptionCount: 300,
        valueDelivered: 50000,
        runs: 12,
        updatedAt: "2026-05-29",
      },
    ],
    runs: [
      {
        id: "run-1",
        skillId: "skill-1",
        useCaseId: "uc-1",
        triggeredBy: "user-1",
        status: "completed",
        riskLevel: "medium",
        currentStage: "Completed",
        costUsd: 0.02,
        latencyMs: 2200,
        startedAt: "2026-05-29 10:00",
        output: "Answered with citations.",
        trace: [
          { label: "Request", status: "completed", detail: "Received", latencyMs: 10 },
          { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 10 },
          { label: "Context", status: "completed", detail: "Retrieved", latencyMs: 10 },
          { label: "Policy", status: "completed", detail: "Allowed", latencyMs: 10 },
          { label: "Model", status: "completed", detail: "Generated", latencyMs: 10 },
          { label: "Audit", status: "completed", detail: "Logged", latencyMs: 10 },
        ],
      },
    ],
    evalResults: [
      {
        id: "eval-1",
        skillId: "skill-1",
        suiteName: "Launch Readiness",
        score: 96,
        passed: true,
        criticalFailures: 0,
        createdAt: "2026-05-29",
      },
    ],
    governanceReviews: [
      {
        id: "review-1",
        itemType: "skill",
        itemId: "skill-1",
        title: "Policy Self-Service Review",
        department: "HR",
        riskLevel: "medium",
        reviewer: "Security",
        status: "approved_with_conditions",
        dueDate: "2026-05-30",
        blockers: [],
      },
    ],
    auditLogs: [
      { id: "audit-1", eventType: "use_case_created", message: "Use case created.", actor: "Admin", riskLevel: "low", createdAt: "2026-05-29" },
      { id: "audit-2", eventType: "skill_created", message: "Skill created.", actor: "Admin", riskLevel: "low", createdAt: "2026-05-29" },
      { id: "audit-3", eventType: "workflow_run_started", message: "Run started.", actor: "Harness", riskLevel: "low", createdAt: "2026-05-29" },
      { id: "audit-4", eventType: "eval_run", message: "Eval passed.", actor: "Evaluations", riskLevel: "low", createdAt: "2026-05-29" },
      { id: "audit-5", eventType: "human_approval_granted", message: "Review approved.", actor: "Governance", riskLevel: "low", createdAt: "2026-05-29" },
    ],
  });

  assert.equal(graph.score, 100);
  assert.equal(graph.gaps.length, 0);
  assert.equal(graph.nextAction, undefined);
  assert.ok(graph.edges.every((edge) => edge.status === "complete"));
});
