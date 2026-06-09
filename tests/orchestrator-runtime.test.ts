import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAISettings } from "../src/lib/model-router.ts";
import { compactWorkspaceForOrchestrator, orchestratorActionTypes, planOrchestratorChat } from "../src/lib/orchestrator-runtime.ts";
import { deriveTrustedOrchestratorWorkspaceContext } from "../src/lib/orchestrator-workspace-context.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";

const baseWorkspace = {
  metrics: {
    totalUseCases: 3,
    skills: 1,
    activePilots: 1,
    riskItemsOpen: 1,
    annualValue: 412000,
    adoptionRate: 57,
    hoursSaved: 6059,
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

test("planOrchestratorChat: feedback prompts stay deterministic and return improvement actions", async () => {
  const plan = await planOrchestratorChat({
    message: "Review this workspace and tell me what is missing",
    history: [],
    workspace: baseWorkspace,
    settings: {
      ...defaultAISettings,
      openaiKey: "sk-test",
      defaultProvider: "openai",
      workflowModel: "openai/gpt-5.4-mini",
    },
  });

  assert.match(plan.content, /operating feedback/i);
  assert.ok(plan.actions.some((action) => action.type === "open_top_use_case"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "launch"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "evidence"));
  assert.equal(plan.autoActions.length, 0);
  assert.equal(plan.model.modelRef, "local/deterministic-command-router");
});

test("planOrchestratorChat: routes inventory and work-signal navigation through typed actions", async () => {
  const inventoryPlan = await planOrchestratorChat({
    message: "Open AI inventory",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });
  const workPlan = await planOrchestratorChat({
    message: "Open work signals",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.ok(inventoryPlan.autoActions.some((action) => action.payload?.view === "estate"));
  assert.ok(workPlan.autoActions.some((action) => action.payload?.view === "work"));
});

test("planOrchestratorChat: answers value and ROI prompts with operating metrics", async () => {
  const plan = await planOrchestratorChat({
    message: "What are our ROI metrics and adoption numbers?",
    history: [],
    workspace: baseWorkspace,
    settings: {
      ...defaultAISettings,
      openaiKey: "sk-test",
      defaultProvider: "openai",
      workflowModel: "openai/gpt-5.4-mini",
    },
  });

  assert.match(plan.content, /\$412,000 annualized value/);
  assert.match(plan.content, /6059 estimated hours saved/);
  assert.match(plan.content, /57% adoption/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "roi"));
  assert.ok(plan.actions.some((action) => action.type === "generate_exec_brief"));
  assert.equal(plan.model.modelRef, "local/deterministic-command-router");
});

test("planOrchestratorChat: model-generated action payloads are bounded by action type", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          content: "Open the useful surfaces, but keep the payload safe.",
          actions: [
            {
              type: "open_view",
              label: "Open fake view",
              payload: { view: "billing-admin", secret: "provider-key-should-not-survive" },
              tone: "primary",
            },
            {
              type: "open_view",
              label: "Open Harness",
              payload: { view: "harness", targetId: "run-1001", extra: "ignored" },
              tone: "primary",
            },
            {
              type: "approve_pending_tool_request",
              label: "Approve tool request",
              payload: { requestId: "tr-123", secret: "provider-key-should-not-survive" },
              tone: "primary",
            },
            {
              type: "approve_governance_review",
              label: "Approve review",
              payload: { reviewId: "gov-1", systemPrompt: "do not keep this" },
              tone: "primary",
            },
            {
              type: "draft_use_case",
              label: "Draft",
              payload: { message: "A".repeat(2400), credential: "SECRET_TOKEN_SHOULD_NOT_LEAK" },
            },
            {
              type: "clear_chat",
              label: "Clear",
              payload: { reason: "not allowed" },
              tone: "danger",
            },
          ],
          autoActions: [
            {
              type: "open_view",
              label: "Auto open invalid",
              payload: { view: "root" },
            },
            {
              type: "generate_exec_brief",
              label: "Auto generate report",
            },
            {
              type: "validate_workflow",
              label: "Auto validate workflow",
            },
          ],
          evidence: [{ label: "Status", value: "safe provider-key-should-not-survive-12345" }],
        }),
        status: "completed",
        usage: { input_tokens: 100, output_tokens: 80 },
      }),
      { status: 200 },
    )) as typeof fetch;

  try {
    const plan = await planOrchestratorChat({
      message: "Create a structured model-router response sample",
      history: [],
      workspace: baseWorkspace,
      settings: {
        ...defaultAISettings,
        openaiKey: "sk-test",
        defaultProvider: "openai",
        workflowModel: "openai/gpt-5.4-mini",
      },
    });
    const invalidOpen = plan.actions.find((action) => action.label === "Open fake view");
    const validOpen = plan.actions.find((action) => action.label === "Open Harness");
    const toolApproval = plan.actions.find((action) => action.type === "approve_pending_tool_request");
    const approve = plan.actions.find((action) => action.type === "approve_governance_review");
    const draft = plan.actions.find((action) => action.type === "draft_use_case");
    const clear = plan.actions.find((action) => action.type === "clear_chat");
    const serialized = JSON.stringify(plan.actions);
    const evidenceSerialized = JSON.stringify(plan.evidence);

    assert.deepEqual(invalidOpen?.payload, undefined);
    assert.deepEqual(validOpen?.payload, { view: "harness", targetId: "run-1001" });
    assert.deepEqual(toolApproval?.payload, { requestId: "tr-123" });
    assert.deepEqual(approve?.payload, { reviewId: "gov-1" });
    assert.equal(String(draft?.payload?.message).length, 2000);
    assert.deepEqual(clear?.payload, undefined);
    assert.equal(serialized.includes("SECRET_TOKEN"), false);
    assert.equal(serialized.includes("systemPrompt"), false);
    assert.equal(evidenceSerialized.includes("provider-key-should-not-survive"), false);
    assert.equal(plan.autoActions.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("planOrchestratorChat: redacts user and history secrets before external model planning", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequestBody = "";
  globalThis.fetch = (async (_url, init) => {
    capturedRequestBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          content: "Use the safe local workspace context.",
          actions: [{ type: "open_view", label: "Open Home", payload: { view: "command" } }],
          autoActions: [{ type: "open_view", label: "Open Home", payload: { view: "command" } }],
          evidence: [{ label: "Status", value: "safe" }],
        }),
        status: "completed",
        usage: { input_tokens: 80, output_tokens: 30 },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const plan = await planOrchestratorChat({
      message: "Summarize this request from chris@example.com using api key provider-key-supersecretvalue123456.",
      history: [
        {
          role: "user",
          content: "Earlier note included bearer token bearer abcdefghijklmnopqrstuvwxyz123456.",
          createdAt: "now",
        },
      ],
      workspace: baseWorkspace,
      settings: {
        ...defaultAISettings,
        openaiKey: "sk-test",
        defaultProvider: "openai",
        workflowModel: "openai/gpt-5.4-mini",
      },
    });
    const parsedBody = JSON.parse(capturedRequestBody) as { input?: string };
    const userPayload = String(parsedBody.input ?? "");

    assert.equal(userPayload.includes("chris@example.com"), false);
    assert.equal(userPayload.includes("sk-supersecretvalue"), false);
    assert.equal(userPayload.includes("bearer abcdefghijklmnopqrstuvwxyz"), false);
    assert.match(userPayload, /\[redacted\]/);
    assert.equal(plan.autoActions.length, 1);
    assert.deepEqual(plan.autoActions[0]?.payload, { view: "command" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("compactWorkspaceForOrchestrator: redacts prompts, secrets, payloads, and oversized arrays before model context", () => {
  const compacted = compactWorkspaceForOrchestrator({
    ...baseWorkspace,
    ignoredRawTable: [{ value: "should not be present" }],
    selectedSkill: {
      ...baseWorkspace.selectedSkill,
      systemPrompt: "Never show this prompt",
      openaiKey: "provider-key-secret-secret-secret",
    },
    recentRuns: Array.from({ length: 12 }, (_, index) => ({
      id: `run-${index}`,
      payload: { secret: "SECRET_TOKEN_SHOULD_NOT_LEAK" },
      output: `run output ${index}`,
    })),
  });
  const serialized = JSON.stringify(compacted);

  assert.equal("ignoredRawTable" in compacted, false);
  assert.equal(serialized.includes("Never show this prompt"), false);
  assert.equal(serialized.includes("sk-secret"), false);
  assert.equal(serialized.includes("SECRET_TOKEN"), false);
  assert.equal(serialized.includes("...4 more"), true);
  assert.equal((compacted.selectedSkill as Record<string, unknown>).systemPrompt, "[redacted]");
});

test("deriveTrustedOrchestratorWorkspaceContext: derives planning facts from persisted workspace state", async () => {
  const workspace = buildDemoWorkspace();
  const context = deriveTrustedOrchestratorWorkspaceContext({ workspace });
  const compacted = compactWorkspaceForOrchestrator(context);
  const plan = await planOrchestratorChat({
    message: "What should I do next today?",
    history: [],
    workspace: context,
    settings: defaultAISettings,
  });

  assert.equal((context.metrics as { totalUseCases: number }).totalUseCases, workspace.useCases.length);
  assert.equal((context.counts as { skills: number }).skills, workspace.skills.length);
  assert.equal(
    (context.topUseCases as { priorityScore: number }[])[0].priorityScore,
    Math.max(...workspace.useCases.map((useCase) => useCase.priorityScore)),
  );
  assert.equal(JSON.stringify(compacted).includes("systemPrompt"), false);
  assert.match(plan.content, new RegExp(`${workspace.useCases.length} opportunit`));
});

test("deriveTrustedOrchestratorWorkspaceContext: preserves the active Skill and run focus for chat actions", () => {
  const workspace = buildDemoWorkspace();
  const focusedSkill = workspace.skills.at(-1);
  const focusedRun = workspace.runs.at(-1);
  assert.ok(focusedSkill);
  assert.ok(focusedRun);

  const context = deriveTrustedOrchestratorWorkspaceContext({
    workspace,
    selectedSkillId: focusedSkill.id,
    selectedRunId: focusedRun.id,
  });

  assert.equal((context.selectedSkill as { id: string }).id, focusedSkill.id);
  assert.equal((context.selectedRun as { id: string }).id, focusedRun.id);
});
