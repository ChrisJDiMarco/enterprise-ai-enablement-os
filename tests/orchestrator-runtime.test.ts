import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAISettings } from "../src/lib/model-router.ts";
import { orchestratorActionTypes, planOrchestratorChat } from "../src/lib/orchestrator-runtime.ts";

const baseWorkspace = {
  metrics: {
    totalUseCases: 3,
    skills: 1,
    activePilots: 1,
    riskItemsOpen: 1,
  },
  counts: {
    runs: 2,
    auditLogs: 6,
    evalResults: 1,
    governanceReviews: 1,
    pendingToolRequests: 1,
  },
  topUseCases: [
    {
      id: "uc-hr-helpdesk",
      title: "HR Helpdesk Copilot",
      department: "HR",
      status: "scored",
      riskLevel: "medium",
      priorityScore: 91,
      linkedSkillId: "",
    },
  ],
  selectedSkill: {
    id: "sk-hr-helpdesk",
    name: "HR Helpdesk Copilot",
    status: "draft",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    evalPassRate: 88,
  },
  selectedRun: {
    id: "run-1001",
    status: "waiting_for_approval",
    currentStage: "Human Approval Required",
    riskLevel: "medium",
  },
  recentRuns: [{ id: "run-1001", status: "waiting_for_approval" }],
  governanceReviews: [
    {
      id: "gov-1",
      title: "HR Helpdesk Copilot",
      status: "in_review",
      riskLevel: "medium",
      blockers: ["Privacy evidence needed"],
    },
  ],
  workflow: {
    nodes: 6,
    edges: 5,
    issues: 0,
    warnings: 1,
    valid: true,
  },
	  productionReadiness: {
	    status: "degraded",
    connectors: {
      catalog: {
        brokerMode: "policy-only",
        readyCount: 1,
        requiredCount: 3,
        connectors: [
          {
            id: "sharepoint",
            label: "SharePoint",
            status: "ready",
            missingSecrets: [],
            nextActivationAction: "Connector activation is complete.",
          },
          {
            id: "slack",
            label: "Slack",
            status: "missing",
            missingSecrets: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
            nextActivationAction: "Create a Slack app and store the bot token and signing secret.",
          },
          {
            id: "jira",
            label: "Jira",
            status: "missing",
            missingSecrets: ["JIRA_BASE_URL", "JIRA_API_TOKEN"],
            nextActivationAction: "Create an Atlassian token and bind approved projects.",
          },
        ],
      },
    },
	  },
  primetimeLaunchGate: {
    score: 72,
    status: "needs-work",
    summary: "2 warnings remain before production rollout.",
    nextAction: {
      label: "Launch-grade eval evidence",
      targetView: "evals",
      nextAction: "Run grounding, permission, prompt-injection, and tool-safety evals.",
    },
  },
  compoundLearningLoop: {
    score: 64,
    status: "operating",
    weakestStage: "Instrument runs",
    summary: "The loop is operating but runtime instrumentation is the current leverage point.",
    autopilotMoves: [
      {
        title: "Run the Harness and capture traces",
        targetView: "harness",
        impact: "high",
        effort: "low",
        confidence: 82,
      },
      {
        title: "Package governance evidence",
        targetView: "evidence",
        impact: "high",
        effort: "medium",
        confidence: 76,
      },
    ],
  },
};

test("orchestratorActionTypes: exposes operator actions for visible OS control", () => {
  assert.ok(orchestratorActionTypes.includes("open_top_use_case"));
  assert.ok(orchestratorActionTypes.includes("convert_top_use_case_to_skill"));
  assert.ok(orchestratorActionTypes.includes("approve_pending_tool_request"));
  assert.ok(orchestratorActionTypes.includes("open_selected_run_trace"));
  assert.ok(orchestratorActionTypes.includes("approve_governance_review"));
});

test("planOrchestratorChat: next-step prompt recommends real workspace actions", async () => {
  const plan = await planOrchestratorChat({
    message: "What should I do next today?",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  const actionTypes = plan.actions.map((action) => action.type);

  assert.match(plan.content, /Portfolio: 3 use cases/);
  assert.ok(actionTypes.includes("open_top_use_case"));
  assert.ok(actionTypes.includes("convert_top_use_case_to_skill"));
  assert.ok(actionTypes.includes("approve_pending_tool_request"));
  assert.ok(actionTypes.includes("approve_governance_review"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: launch prompt reports primetime gate and keeps actions explicit", async () => {
  const plan = await planOrchestratorChat({
    message: "Are we ready to go live with customers?",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  const actionTypes = plan.actions.map((action) => action.type);

  assert.match(plan.content, /Primetime launch gate is needs-work at 72\/100/);
  assert.ok(actionTypes.includes("open_view"));
  assert.ok(actionTypes.includes("generate_exec_brief"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: compounding prompt explains the learning loop", async () => {
  const plan = await planOrchestratorChat({
    message: "How do we make this a compounding AI transformation moat?",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Compounding loop is operating at 64\/100/);
  assert.match(plan.content, /Weakest link: Instrument runs/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "harness"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: connector prompt produces launch-grade connector actions", async () => {
  const plan = await planOrchestratorChat({
    message: "Guide connector setup",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Connector posture: 1\/3 connectors/);
  assert.match(plan.content, /Next connector: Slack/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "connectors"));
  assert.ok(plan.actions.some((action) => action.type === "open_ai_settings"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "evidence"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: connector commands stay deterministic even when external models are configured", async () => {
  const plan = await planOrchestratorChat({
    message: "Guide connector setup",
    history: [],
    workspace: baseWorkspace,
    settings: {
      ...defaultAISettings,
      openaiKey: "sk-test",
      defaultProvider: "openai",
      workflowModel: "openai/gpt-5.4-mini",
    },
  });

  assert.match(plan.content, /Connector posture: 1\/3 connectors/);
  assert.equal(plan.model.modelRef, "local/deterministic-command-router");
  assert.equal(plan.model.finishReason, "deterministic_command_plan");
});
