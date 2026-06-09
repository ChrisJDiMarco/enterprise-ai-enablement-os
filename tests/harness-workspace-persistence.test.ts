import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeServerHarnessResultIntoWorkspace } from "../src/lib/harness-workspace-persistence.ts";
import type { Run, Skill, ToolRequest } from "../src/lib/enterprise-ai-data.ts";
import type { ServerHarnessResult } from "../src/lib/server-harness-runtime.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-harness",
    name: "Harness Skill",
    slug: "harness-skill",
    description: "Tests server Harness persistence.",
    department: "Operations",
    ownerId: "owner-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "local",
    model: "local",
    temperature: 0.2,
    maxTokens: 1000,
    fallbackModel: "local",
    costLimit: 1,
    systemPrompt: "Run safely.",
    allowedTools: ["tool-read"],
    blockedTools: [],
    contextSources: [],
    evalPassRate: 0,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 2,
    updatedAt: "2026-06-01",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-harness",
    skillId: "skill-harness",
    useCaseId: "uc-harness",
    triggeredBy: "Builder",
    status: "waiting_for_approval",
    riskLevel: "medium",
    currentStage: "Approval Gate",
    costUsd: 0.02,
    latencyMs: 450,
    startedAt: "2026-06-08T14:20:00.000Z",
    output: "Prepared a safe response.",
    trace: [
      {
        label: "Request received",
        status: "completed",
        detail: "Accepted.",
        latencyMs: 1,
      },
    ],
    ...overrides,
  };
}

function toolRequest(overrides: Partial<ToolRequest> = {}): ToolRequest {
  return {
    id: "tr-harness",
    skillId: "skill-harness",
    runId: "run-harness",
    user: "Builder",
    toolId: "tool-read",
    reason: "Approval is required.",
    riskLevel: "medium",
    status: "pending",
    requestedAt: "2026-06-08T14:20:00.000Z",
    ...overrides,
  };
}

function result(overrides: Partial<ServerHarnessResult> = {}): ServerHarnessResult {
  return {
    run: run(),
    toolRequest: toolRequest(),
    selectedToolId: "tool-read",
    requiresApproval: true,
    lane: "workflow",
    route: {
      provider: "local",
      model: "local",
      modelRef: "local/local",
      fallbackUsed: false,
      reason: "Test route.",
    },
    policy: {
      context: { status: "approved", reason: "Context allowed.", policyId: "context", riskLevel: "medium" },
      tool: { status: "requires_approval", reason: "Approval is required.", policyId: "tool", riskLevel: "medium" },
      output: { status: "approved", reason: "Output allowed.", policyId: "output", riskLevel: "medium" },
    },
    model: {
      inputTokens: 10,
      outputTokens: 20,
      localFallback: true,
      finishReason: "stop",
      estimatedCostUsd: 0,
    },
    budget: {
      status: "pass",
      enforcementEnabled: true,
      reason: "Budget available.",
      estimatedRunCostUsd: 0,
      currentMonthlySpendUsd: 0,
      projectedMonthlySpendUsd: 0,
      monthlyBudgetUsd: 100,
      runBudgetUsd: 1,
      warningThreshold: 0.8,
      evidence: ["budget available"],
    },
    prompt: {
      contractId: "contract",
      contractVersion: "1",
      quality: {
        score: 100,
        grade: "excellent",
        totalChecks: 1,
        passedChecks: 1,
        missingCritical: [],
        findings: [],
      },
    },
    ...overrides,
  };
}

test("mergeServerHarnessResultIntoWorkspace stores runs, pending tool requests, audit evidence, and Skill counters", () => {
  const workspace = emptyWorkspace("org-harness-persistence");
  workspace.skills = [skill()];

  const merged = mergeServerHarnessResultIntoWorkspace({
    workspace,
    result: result(),
    actor: "Builder",
  });

  assert.equal(merged.runInserted, true);
  assert.equal(merged.toolRequestInserted, true);
  assert.equal(merged.workspace.runs[0]?.id, "run-harness");
  assert.equal(merged.workspace.toolRequests[0]?.id, "tr-harness");
  assert.equal(merged.workspace.skills[0]?.runs, 3);
  assert.equal(merged.workspace.skills[0]?.updatedAt, "2026-06-08");
  assert.equal(merged.auditLog.eventType, "tool_requested");
  assert.equal(merged.workspace.auditLogs[0]?.id, merged.auditLog.id);
});

test("mergeServerHarnessResultIntoWorkspace upserts retried run evidence without inflating counters", () => {
  const workspace = emptyWorkspace("org-harness-persistence");
  workspace.skills = [skill()];
  workspace.runs = [run({ output: "Old output." })];
  workspace.toolRequests = [toolRequest({ reason: "Old reason." })];

  const merged = mergeServerHarnessResultIntoWorkspace({
    workspace,
    result: result({
      run: run({ output: "New output." }),
      toolRequest: toolRequest({ reason: "New reason." }),
    }),
    actor: "Builder",
  });

  assert.equal(merged.runInserted, false);
  assert.equal(merged.toolRequestInserted, false);
  assert.equal(merged.workspace.runs.length, 1);
  assert.equal(merged.workspace.runs[0]?.output, "New output.");
  assert.equal(merged.workspace.toolRequests.length, 1);
  assert.equal(merged.workspace.toolRequests[0]?.reason, "New reason.");
  assert.equal(merged.workspace.skills[0]?.runs, 2);
});

test("mergeServerHarnessResultIntoWorkspace records completed runs without creating phantom tool requests", () => {
  const workspace = emptyWorkspace("org-harness-persistence");
  workspace.skills = [skill()];

  const merged = mergeServerHarnessResultIntoWorkspace({
    workspace,
    result: result({
      run: run({ status: "completed", currentStage: "Response Delivered" }),
      toolRequest: undefined,
      requiresApproval: false,
    }),
    actor: "Builder",
  });

  assert.equal(merged.toolRequestInserted, false);
  assert.deepEqual(merged.workspace.toolRequests, []);
  assert.equal(merged.auditLog.eventType, "workflow_run_started");
});
