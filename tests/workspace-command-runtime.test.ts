import { test } from "node:test";
import assert from "node:assert/strict";

import type { IntakeForm } from "../src/lib/ui/types.ts";
import type { GovernanceReview, Run, Tool, ToolRequest } from "../src/lib/enterprise-ai-data.ts";
import { applyWorkspaceCommand } from "../src/lib/workspace-command-runtime.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

const now = "2026-06-02T14:30:00.000Z";
const context = {
  userId: "user-1",
  actor: "Workspace Admin",
  now,
};

const intake: IntakeForm = {
  title: "HR Policy Copilot",
  department: "HR",
  businessProblem: "Employees wait too long for repeated policy answers.",
  currentProcess: "Employees email HR and HR manually checks the policy handbook.",
  desiredOutcome: "Employees get cited answers from approved HR sources.",
  aiHelp: "Answer routine policy questions and cite sources.",
  aiNotDo: "Approve leave, update records, or make employment decisions.",
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

function workspaceWithUseCase() {
  const created = applyWorkspaceCommand(
    {
      ...emptyWorkspace("test-org"),
      tools: [readTool],
    },
    { type: "create_use_case", payload: { intake, useCaseId: "uc-1" } },
    context,
  );
  assert.equal(created.ok, true);
  return created.workspace;
}

function workspaceWithSkill() {
  const converted = applyWorkspaceCommand(
    workspaceWithUseCase(),
    { type: "convert_use_case_to_skill", payload: { useCaseId: "uc-1", skillId: "skill-1" } },
    context,
  );
  assert.equal(converted.ok, true);
  return converted.workspace;
}

test("applyWorkspaceCommand: create_use_case changes state and emits audit evidence", () => {
  const result = applyWorkspaceCommand(
    {
      ...emptyWorkspace("test-org"),
      tools: [readTool],
    },
    { id: "cmd-create", type: "create_use_case", payload: { intake, useCaseId: "uc-1" } },
    context,
  );

  assert.equal(result.ok, true);
  assert.equal(result.workspace.useCases.length, 1);
  assert.equal(result.workspace.useCases[0]?.priorityScore > 0, true);
  assert.equal(result.auditLog?.eventType, "use_case_created");
  assert.equal(result.rollbackToken?.commandId, "cmd-create");
});

test("applyWorkspaceCommand: convert_use_case_to_skill links the opportunity to a governed Skill", () => {
  const result = applyWorkspaceCommand(
    workspaceWithUseCase(),
    { type: "convert_use_case_to_skill", payload: { useCaseId: "uc-1", skillId: "skill-1" } },
    context,
  );

  assert.equal(result.ok, true);
  assert.equal(result.workspace.skills[0]?.id, "skill-1");
  assert.equal(result.workspace.useCases[0]?.linkedSkillId, "skill-1");
  assert.equal(result.auditLog?.eventType, "skill_created");
});

test("applyWorkspaceCommand: convert_use_case_to_skill repairs stale links without duplicating Skills", () => {
  const staleLinkedWorkspace = {
    ...workspaceWithUseCase(),
    useCases: workspaceWithUseCase().useCases.map((useCase) => ({ ...useCase, linkedSkillId: "skill-orphaned" })),
    skills: [],
  };
  const restored = applyWorkspaceCommand(
    staleLinkedWorkspace,
    { type: "convert_use_case_to_skill", payload: { useCaseId: "uc-1" } },
    context,
  );
  assert.equal(restored.ok, true);
  assert.equal(restored.workspace.skills.length, 1);
  assert.equal(restored.workspace.skills[0]?.id, "skill-orphaned");
  assert.equal(restored.workspace.useCases[0]?.linkedSkillId, "skill-orphaned");

  const linkedWorkspace = workspaceWithSkill();
  const unlinkedWorkspace = {
    ...linkedWorkspace,
    useCases: linkedWorkspace.useCases.map((useCase) => ({ ...useCase, linkedSkillId: undefined })),
  };
  const relinked = applyWorkspaceCommand(
    unlinkedWorkspace,
    { type: "convert_use_case_to_skill", payload: { useCaseId: "uc-1", skillId: "skill-duplicate" } },
    context,
  );
  assert.equal(relinked.ok, true);
  assert.equal(relinked.workspace.skills.length, linkedWorkspace.skills.length);
  assert.equal(relinked.workspace.useCases[0]?.linkedSkillId, "skill-1");
  assert.equal(relinked.result?.relinked, true);
});

test("applyWorkspaceCommand: run_eval_suite stores result and updates Skill pass rate", () => {
  const result = applyWorkspaceCommand(
    workspaceWithSkill(),
    { type: "run_eval_suite", payload: { skillId: "skill-1" } },
    context,
  );

  assert.equal(result.ok, true);
  assert.equal(result.workspace.evalResults.length, 1);
  assert.equal(result.workspace.skills[0]?.evalPassRate, result.workspace.evalResults[0]?.score);
  assert.equal(result.auditLog?.eventType, "eval_run");
});

test("applyWorkspaceCommand: run_eval_suite rejects stale Skill ids instead of falling back", () => {
  const workspace = workspaceWithSkill();
  const result = applyWorkspaceCommand(
    workspace,
    { type: "run_eval_suite", payload: { skillId: "skill-missing" } },
    context,
  );

  assert.equal(result.ok, false);
  assert.equal(result.notification, "Skill not found");
  assert.match(result.error ?? "", /skill-missing/);
  assert.equal(result.workspace.evalResults.length, workspace.evalResults.length);
  assert.equal(result.workspace.skills[0]?.evalPassRate, workspace.skills[0]?.evalPassRate);
});

test("applyWorkspaceCommand: governance submission and decision update review and Skill status", () => {
  const submitted = applyWorkspaceCommand(
    workspaceWithSkill(),
    { type: "submit_governance_review", payload: { skillId: "skill-1" } },
    context,
  );
  assert.equal(submitted.ok, true);

  const reviewId = submitted.workspace.governanceReviews[0]?.id;
  const approved = applyWorkspaceCommand(
    submitted.workspace,
    { type: "decide_governance", payload: { reviewId, status: "approved" } },
    context,
  );

  assert.equal(approved.ok, true);
  assert.equal(approved.workspace.governanceReviews[0]?.status, "approved");
  assert.equal(approved.workspace.skills[0]?.status, "pilot");
  assert.equal(approved.auditLog?.eventType, "human_approval_granted");
});

test("applyWorkspaceCommand: governance commands reject stale Skill and orphaned review targets", () => {
  const workspace = workspaceWithSkill();
  const missingSkillSubmission = applyWorkspaceCommand(
    workspace,
    { type: "submit_governance_review", payload: { skillId: "skill-missing" } },
    context,
  );
  assert.equal(missingSkillSubmission.ok, false);
  assert.equal(missingSkillSubmission.notification, "Skill not found");

  const orphanedReview: GovernanceReview = {
    id: "gr-orphaned",
    itemType: "skill",
    itemId: "skill-deleted",
    title: "Deleted Skill Review",
    department: "HR",
    riskLevel: "medium",
    reviewer: "u-reviewer",
    status: "in_review",
    dueDate: "2026-06-10",
    blockers: [],
  };
  const orphanedDecision = applyWorkspaceCommand(
    { ...workspace, governanceReviews: [orphanedReview] },
    { type: "decide_governance", payload: { reviewId: "gr-orphaned", status: "approved" } },
    context,
  );
  assert.equal(orphanedDecision.ok, false);
  assert.equal(orphanedDecision.notification, "Reviewed Skill not found");
});

test("applyWorkspaceCommand: decide_tool_request updates request, run, trace, and audit", () => {
  const run: Run = {
    id: "run-1",
    skillId: "skill-1",
    triggeredBy: "Workspace Admin",
    status: "waiting_for_approval",
    riskLevel: "medium",
    currentStage: "Human Approval Required",
    costUsd: 0.02,
    latencyMs: 1200,
    startedAt: now,
    output: "Pending tool approval.",
    trace: [],
  };
  const request: ToolRequest = {
    id: "tr-1",
    skillId: "skill-1",
    runId: "run-1",
    user: "Workspace Admin",
    toolId: "email.draft_internal",
    reason: "Draft a summary.",
    riskLevel: "medium",
    status: "pending",
    requestedAt: now,
  };

  const result = applyWorkspaceCommand(
    {
      ...workspaceWithSkill(),
      runs: [run],
      toolRequests: [request],
    },
    { type: "decide_tool_request", payload: { requestId: "tr-1", decision: "approved" } },
    context,
  );

  assert.equal(result.ok, true);
  assert.equal(result.workspace.toolRequests[0]?.status, "approved");
  assert.equal(result.workspace.runs[0]?.status, "completed");
  assert.equal(result.workspace.runs[0]?.trace.at(-1)?.label, "Tool approved");
  assert.equal(result.auditLog?.eventType, "tool_approved");
});

test("applyWorkspaceCommand: decide_tool_request rejects orphaned runtime requests", () => {
  const request: ToolRequest = {
    id: "tr-orphaned",
    skillId: "skill-1",
    runId: "run-missing",
    user: "Workspace Admin",
    toolId: "email.draft_internal",
    reason: "Draft a summary.",
    riskLevel: "medium",
    status: "pending",
    requestedAt: now,
  };

  const result = applyWorkspaceCommand(
    {
      ...workspaceWithSkill(),
      runs: [],
      toolRequests: [request],
    },
    { type: "decide_tool_request", payload: { requestId: "tr-orphaned", decision: "approved" } },
    context,
  );

  assert.equal(result.ok, false);
  assert.equal(result.notification, "Tool request run not found");
  assert.equal(result.workspace.toolRequests[0]?.status, "pending");
});

test("applyWorkspaceCommand: publish_workflow rejects empty workflow and publishes non-empty workflow", () => {
  const empty = applyWorkspaceCommand(
    emptyWorkspace("test-org"),
    { type: "publish_workflow" },
    context,
  );
  assert.equal(empty.ok, false);

  const published = applyWorkspaceCommand(
    {
      ...emptyWorkspace("test-org"),
      workflow: {
        status: "Saved",
        nodes: [{ id: "start" }],
        edges: [],
      },
    },
    { type: "publish_workflow" },
    context,
  );

  assert.equal(published.ok, true);
  assert.equal(published.workspace.workflow.status, "Published");
  assert.equal(published.auditLog?.eventType, "workflow_published");
});

test("applyWorkspaceCommand: generate_report writes an executive brief", () => {
  const result = applyWorkspaceCommand(
    workspaceWithSkill(),
    { type: "generate_report" },
    context,
  );

  assert.equal(result.ok, true);
  assert.match(result.workspace.report, /Weekly AI Enablement Brief/);
  assert.equal(typeof result.result?.reportLength === "number" && result.result.reportLength > 0, true);
});
