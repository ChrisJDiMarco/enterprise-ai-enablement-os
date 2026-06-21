import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAISettings } from "../src/lib/model-router.ts";
import { compactWorkspaceForOrchestrator, orchestratorActionTypes, planOrchestratorChat } from "../src/lib/orchestrator-runtime.ts";
import { deriveTrustedOrchestratorWorkspaceContext } from "../src/lib/orchestrator-workspace-context.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";

const providerKeyFixture = (value: string) => ["sk", value].join("-");

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
  evidenceQuality: {
    score: 68,
    status: "building",
    summary: "Evidence quality is building at 68/100: useful proof exists, but passing eval evidence still needs attention.",
    gaps: ["passing eval evidence", "adoption or value proof"],
    nextAction: "Run launch-grade evals and clear critical failures.",
  },
  operatingTimeline: {
    total: 3,
    latestSummary: "Harness run waiting for approval: Human Approval Required for Skill sk-hr-helpdesk.",
    entries: [
      {
        id: "run-1001",
        kind: "run",
        title: "Harness run waiting for approval",
        detail: "Human Approval Required for Skill sk-hr-helpdesk.",
        targetView: "harness",
        createdAt: "2026-06-18T12:00:00.000Z",
      },
      {
        id: "gov-1",
        kind: "review",
        title: "Governance in review",
        detail: "HR Helpdesk Copilot: Privacy evidence needed.",
        targetView: "governance",
        createdAt: "2026-06-17T12:00:00.000Z",
      },
    ],
  },
  connectorPosture: {
    status: "partial",
    readyCount: 1,
    requiredCount: 3,
    summary: "1/3 required connectors are ready or broker-managed.",
    nextAction: "Activate Slack and store required tenant-safe secrets.",
    missing: ["Slack", "Jira"],
  },
  runtimeControl: {
    score: 35,
    grade: "forming",
    summary: "forming: Runtime telemetry is being connected; the next step is committing imports and closing proof gaps.",
    metrics: {
      activeAdapters: 1,
      importedAssets: 4,
      proofCoverage: 50,
      ownerCoverage: 50,
      evalCoverage: 25,
    },
    gaps: [
      {
        id: "runtime-owner-gap",
        severity: "high",
        label: "Runtime assets need owners",
        detail: "50% of imported runtime assets do not yet have accountable ownership.",
        action: "Assign an owner for Langfuse runtime traces.",
        target: "owner",
      },
    ],
    nextActions: [
      {
        id: "owner-runtime-asset-langfuse-trace",
        label: "Assign runtime owner",
        detail: "Langfuse runtime traces",
        command: "assign_owner",
        priority: "high",
      },
    ],
  },
  roleProfile: {
    role: "admin",
    lens: "operator",
    label: "Workspace Admin",
    defaultView: "command",
    priorities: ["clear command orders", "remove launch blockers", "connect enterprise stack", "package executive proof"],
    guardrail: "Can coordinate the OS, but high-impact execution still needs visible approval and evidence.",
  },
  setupGuide: {
    readyForGuidedSetup: false,
    summary: "This workspace already has operating records; setup should focus on gaps rather than starting over.",
    questions: [
      "Which business functions should be in the first 90-day AI rollout?",
      "Which existing systems hold work demand, knowledge, approvals, and customer records?",
      "Which AI tools or agents already exist, including shadow AI?",
      "Which risk boundaries are non-negotiable?",
      "Which outcome matters first?",
    ],
    firstActions: [
      { label: "Map company blueprint", targetView: "blueprint" },
      { label: "Connect identity and providers", targetView: "admin" },
      { label: "Capture first work signal", targetView: "work" },
    ],
  },
  assistantQuality: {
    score: 80,
    status: "covered",
    summary: "Assistant quality is covered for guided operation, but eval and proof coverage should improve before broad rollout.",
    checks: [
      { label: "Intent interpretation", status: "covered", evidence: "Responses expose interpreted goal and confidence." },
      { label: "Workspace grounding", status: "covered", evidence: "Planner receives trusted workspace counts and selected records." },
      { label: "Human approval", status: "covered", evidence: "High-impact actions are approval-gated." },
    ],
    nextAction: "Add eval cases for intent routing, unsafe action blocking, workspace grounding, and missing-proof recommendations.",
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
  assert.ok(orchestratorActionTypes.includes("capture_work_signal"));
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

  assert.match(plan.content, /Recommended move:/);
  assert.ok(actionTypes.includes("open_top_use_case"));
  assert.ok(actionTypes.includes("generate_exec_brief"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "governance"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "evidence"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: next-best-action prompt returns an operating recommendation", async () => {
  const plan = await planOrchestratorChat({
    message: "What is the next best action for this workspace?",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Recommended move:/);
  assert.match(plan.content, /Action plan:/);
  assert.ok(plan.actions.some((action) => action.type === "open_top_use_case"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "governance"));
  assert.ok(plan.actions.some((action) => action.payload?.view === "evidence"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: status overview routes pending approvals to the Harness queue", async () => {
  const plan = await planOrchestratorChat({
    message: "Give me a status overview",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  const approvalQueue = plan.actions.find((action) => action.label === "Open approval queue");

  assert.equal(approvalQueue?.type, "open_view");
  assert.deepEqual(approvalQueue?.payload, { view: "harness" });
  assert.equal(plan.actions.some((action) => action.type === "approve_pending_tool_request"), false);
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: reasoned next-move wording is interpreted without magic phrases", async () => {
  const plan = await planOrchestratorChat({
    message: "Think across the workspace and decide the most rational move to get this from idea to a launchable pilot.",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Recommended move:/);
  assert.ok(plan.actions.some((action) => action.type === "open_top_use_case"));
  assert.ok(plan.evidence.some((item) => item.label === "Routing (rule-based)" && /next best operating move/i.test(item.value)));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: remembers prior assistant action when recommending the next move", async () => {
  const plan = await planOrchestratorChat({
    message: "What should I do next after that?",
    history: [
      {
        role: "assistant",
        content: "Opened: Open Proof Ledger. The action is recorded in this transcript so the assistant remains the control surface.",
      },
    ],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Last assistant action: Open Proof Ledger/);
  assert.ok(plan.evidence.some((item) => item.label === "Memory" && /Open Proof Ledger/.test(item.value)));
});

test("planOrchestratorChat: operating timeline uses workspace activity instead of generic status", async () => {
  const plan = await planOrchestratorChat({
    message: "Show me the operating timeline and what changed recently",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Operating timeline: 3 workspace event/);
  assert.match(plan.content, /Harness run waiting for approval/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "evidence"));
});

test("planOrchestratorChat: evidence questions report proof quality and next proof move", async () => {
  const plan = await planOrchestratorChat({
    message: "Is the proof good enough for auditors?",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Evidence quality is building at 68\/100/);
  assert.match(plan.content, /Next proof move: Run launch-grade evals/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "evals"));
});

test("planOrchestratorChat: role mode explains the correct enterprise lens", async () => {
  const plan = await planOrchestratorChat({
    message: "Switch this into operator mode for the workspace admin role",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Role lens: Workspace Admin \(operator\)/);
  assert.match(plan.content, /high-impact execution still needs visible approval/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "command"));
});

test("planOrchestratorChat: setup guide asks company onboarding questions before automation", async () => {
  const plan = await planOrchestratorChat({
    message: "Set up a new company workspace from scratch",
    history: [],
    workspace: {
      ...baseWorkspace,
      metrics: { ...baseWorkspace.metrics, totalUseCases: 0, skills: 0, activePilots: 0 },
      counts: { ...baseWorkspace.counts, runs: 0, auditLogs: 0, evalResults: 0, governanceReviews: 0 },
      topUseCases: [],
      setupGuide: {
        ...baseWorkspace.setupGuide,
        readyForGuidedSetup: true,
        summary: "This workspace is ready for guided company setup.",
      },
    },
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Setup questions:/);
  assert.match(plan.content, /Which business functions/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "blueprint"));
});

test("planOrchestratorChat: assistant quality prompt returns eval harness checks", async () => {
  const plan = await planOrchestratorChat({
    message: "Evaluate the assistant response quality and its eval harness",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Assistant quality harness: covered at 80\/100/);
  assert.match(plan.content, /Intent interpretation/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "evals"));
});

test("planOrchestratorChat: intelligence prompt uses enterprise OS future-proofing context", async () => {
  const workspace = {
    ...baseWorkspace,
    enterpriseAiOperatingSystem: {
      score: 58,
      posture: "forming",
      headline: "Enterprise AI has a foundation, but needs stronger operating loops",
      summary:
        "4 AI assets, 1 governed Skill, 2 work signals, 2 traceable runs, 33% eval coverage, 62% assurance coverage, 33% connector readiness, and $412,000 tracked value.",
      metrics: {
        aiAssets: 4,
        governedSkills: 1,
        workflowSignals: 2,
        traceableRuns: 2,
        evalCoverage: 33,
        complianceCoverage: 62,
        connectorReadiness: 33,
        valueTracked: 412000,
      },
      protocols: [
        {
          label: "MCP tool access",
          readiness: 42,
          currentSignal: "1/3 connectors ready; 1 tool decision recorded.",
          nextAction: "Register connector scopes, approval gates, redaction, idempotency, and trace evidence.",
          targetView: "connectors",
        },
      ],
      recommendations: [
        {
          priority: "high",
          title: "Make the enterprise stack connectable",
          body: "Future-proof AI depends on governed system access: identity, knowledge, tickets, documents, approvals, and business apps.",
          targetView: "connectors",
          actionLabel: "Open Connect Apps",
        },
      ],
    },
  };
  const plan = await planOrchestratorChat({
    message: "How can we make the assistant intelligence more future-proof for enterprise AI?",
    history: [],
    workspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Enterprise AI OS: 58\/100 forming/);
  assert.match(plan.content, /Protocol readiness:/);
  assert.match(plan.content, /MCP tool access/);
  assert.match(plan.content, /Make the enterprise stack connectable/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "connectors"));
  assert.ok(plan.evidence.some((item) => item.label === "Enterprise OS" && /58\/100 forming/.test(item.value)));
});

test("planOrchestratorChat: vague use-case draft asks for missing intake details", async () => {
  const plan = await planOrchestratorChat({
    message: "Create a use case",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Intake form:/);
  assert.ok(plan.actions.some((action) => action.type === "open_intake"));
  assert.equal(plan.actions.some((action) => action.type === "draft_use_case"), false);
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: intake answers become a bounded draft action", async () => {
  const plan = await planOrchestratorChat({
    message:
      "Finance AP, invoice exceptions take 20 minutes each, 800 per month, owner is AP Ops, data is Coupa and SharePoint, AI must not approve payments.",
    history: [
      {
        role: "assistant",
        content:
          "I can create the use case, but I need a little more signal.\nIntake form:\n1. Business process or team\n2. Repeated pain, delay, or request pattern\n3. Owner or decision maker",
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

  const draft = plan.actions.find((action) => action.type === "draft_use_case");

  assert.match(plan.content, /prepare a first intake draft/);
  assert.ok(draft);
  assert.match(String(draft.payload?.message), /Finance AP/);
  assert.equal(plan.model.modelRef, "local/deterministic-command-router");
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: candidate workflow starts a guided use-case path", async () => {
  const plan = await planOrchestratorChat({
    message: "ok lets say start with responding to incoming emails",
    history: [],
    workspace: {
      ...baseWorkspace,
      metrics: { ...baseWorkspace.metrics, totalUseCases: 0, skills: 0, activePilots: 0 },
      counts: { ...baseWorkspace.counts, runs: 0, evalResults: 0, governanceReviews: 0 },
      topUseCases: [],
      governanceReviews: [],
    },
    settings: defaultAISettings,
  });

  assert.match(plan.content, /incoming email response/);
  assert.match(plan.content, /Intake form:/);
  assert.ok(plan.actions.some((action) => action.label === "Draft support-email starter"));
  assert.equal(plan.actions.some((action) => action.type === "draft_use_case"), true);
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: workflow pain is interpreted as use-case intake without explicit use-case keywords", async () => {
  const plan = await planOrchestratorChat({
    message: "Our support inbox is a mess. Customers wait hours, replies are inconsistent, and I want help turning that into something governed.",
    history: [],
    workspace: {
      ...baseWorkspace,
      metrics: { ...baseWorkspace.metrics, totalUseCases: 0, skills: 0, activePilots: 0 },
      topUseCases: [],
    },
    settings: defaultAISettings,
  });

  assert.match(plan.content, /incoming email response/);
  assert.ok(plan.actions.some((action) => action.type === "draft_use_case"));
  assert.ok(plan.actions.some((action) => action.type === "open_intake"));
  assert.ok(plan.evidence.some((item) => item.label === "Routing (rule-based)" && /workflow into use case/i.test(item.value)));
});

test("planOrchestratorChat: fill-it-in request offers a clearly editable starter instead of fabricating facts", async () => {
  const plan = await planOrchestratorChat({
    message: "well I want you to fill it in for me",
    history: [
      {
        role: "assistant",
        content:
          "I need a few basics.\nIntake form:\n1. Business process or team\n2. Repeated pain, delay, or request pattern\n3. Owner or decision maker",
      },
    ],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /should not invent company facts/);
  assert.ok(plan.actions.some((action) => action.label === "Use support-email starter"));
  assert.match(String(plan.actions.find((action) => action.type === "draft_use_case")?.payload?.message), /Support team handles about 120 customer emails per day/);
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: accepting the prior example drafts it automatically", async () => {
  const plan = await planOrchestratorChat({
    message: "ok lets go with that",
    history: [
      {
        role: "assistant",
        content:
          "A good response is specific enough to produce an intake without inventing business facts.\nExample: \"Support team handles about 120 customer emails per day. The biggest pain is delayed first responses and inconsistent wording. We use Gmail, Zendesk, and a shared FAQ doc. Anything involving refunds, legal claims, or account changes must stay human-reviewed. I want to automate draft replies for routine questions first.\"",
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

  const draft = plan.autoActions.find((action) => action.type === "draft_use_case");

  assert.match(plan.content, /use the example as the seed intake/);
  assert.ok(draft);
  assert.match(String(draft.payload?.message), /Zendesk/);
  assert.equal(plan.model.modelRef, "local/deterministic-command-router");
  assert.equal(plan.actions.some((action) => action.type === "draft_use_case"), false);
});

test("planOrchestratorChat: vague work-signal capture asks for signal details", async () => {
  const plan = await planOrchestratorChat({
    message: "Capture a work signal",
    history: [],
    workspace: baseWorkspace,
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Work signal form:/);
  assert.ok(plan.actions.some((action) => action.payload?.view === "work"));
  assert.equal(plan.actions.some((action) => action.type === "capture_work_signal"), false);
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: work-signal answers become a bounded capture action", async () => {
  const plan = await planOrchestratorChat({
    message:
      "Finance AP invoice exceptions repeat 800 times per month, each takes 20 minutes, source is Coupa and SharePoint, aggregate only with no individual scoring.",
    history: [
      {
        role: "assistant",
        content:
          "I can capture the work signal.\nWork signal form:\n1. Business process or team\n2. Repeated work pattern\n3. Approximate volume or frequency\n4. Source system",
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

  const capture = plan.actions.find((action) => action.type === "capture_work_signal");

  assert.match(plan.content, /privacy-safe aggregate signal/);
  assert.ok(capture);
  assert.match(String(capture.payload?.message), /Finance AP/);
  assert.equal(plan.model.modelRef, "local/deterministic-command-router");
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

test("planOrchestratorChat: launch readiness review names blockers, gaps, and next button", async () => {
  const plan = await planOrchestratorChat({
    message: "Run a launch readiness review. Show blockers, evidence gaps, and the next button I should click.",
    history: [],
    workspace: {
      ...baseWorkspace,
      counts: { ...baseWorkspace.counts, runs: 0, evalResults: 0, governanceReviews: 1 },
    },
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Launch readiness review: needs-work at 72\/100/);
  assert.match(plan.content, /Blockers:/);
  assert.match(plan.content, /Evidence gaps:/);
  assert.match(plan.content, /Next button to click: Run launch eval suite/);
  assert.ok(plan.actions.some((action) => action.type === "run_selected_eval"));
  assert.equal(plan.autoActions.length, 0);
});

test("planOrchestratorChat: proof-missing launch wording becomes readiness review", async () => {
  const plan = await planOrchestratorChat({
    message: "Before we show this to executives, reason through whether it can launch and what proof is missing.",
    history: [],
    workspace: {
      ...baseWorkspace,
      counts: { ...baseWorkspace.counts, runs: 0, evalResults: 0, governanceReviews: 1 },
    },
    settings: defaultAISettings,
  });

  assert.match(plan.content, /Launch readiness review:/);
  assert.match(plan.content, /Evidence gaps:/);
  assert.ok(plan.actions.some((action) => action.type === "run_selected_eval"));
  assert.ok(plan.evidence.some((item) => item.label === "Routing (rule-based)" && /launch blockers/i.test(item.value)));
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

  assert.match(plan.content, /Connector posture: 1\/3 (required )?connectors/);
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

  assert.match(plan.content, /Connector posture: 1\/3 (required )?connectors/);
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
              payload: { view: "billing-admin", secret: providerKeyFixture("should-not-survive") },
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
              payload: { requestId: "tr-123", secret: providerKeyFixture("should-not-survive") },
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
              type: "capture_work_signal",
              label: "Capture signal",
              payload: { message: "B".repeat(2400), rawContent: "SECRET_TOKEN_SHOULD_NOT_LEAK" },
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
          evidence: [{ label: "Status", value: `safe ${providerKeyFixture("should-not-survive-12345")}` }],
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
    const capture = plan.actions.find((action) => action.type === "capture_work_signal");
    const clear = plan.actions.find((action) => action.type === "clear_chat");
    const serialized = JSON.stringify(plan.actions);
    const evidenceSerialized = JSON.stringify(plan.evidence);

    assert.deepEqual(invalidOpen?.payload, undefined);
    assert.deepEqual(validOpen?.payload, { view: "harness", targetId: "run-1001" });
    assert.deepEqual(toolApproval?.payload, { requestId: "tr-123" });
    assert.deepEqual(approve?.payload, { reviewId: "gov-1" });
    assert.equal(String(draft?.payload?.message).length, 2000);
    assert.equal(String(capture?.payload?.message).length, 2000);
    assert.equal(JSON.stringify(capture?.payload).includes("rawContent"), false);
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
      message: `Summarize this request from chris@example.com using api key ${providerKeyFixture("supersecretvalue123456")}.`,
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

test("planOrchestratorChat: repairs model view actions from label text when payload is missing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          content: "Open the ROI surface to inspect measured value.",
          actions: [
            {
              type: "open_view",
              label: "Open ROI view",
              description: "See adoption, hours saved, and measured value.",
              tone: "secondary",
            },
            {
              type: "open_view",
              label: "Open work view",
              description: "Inspect the highest-friction work command order.",
              tone: "secondary",
            },
          ],
          autoActions: [],
          evidence: [{ label: "Route", value: "value" }],
        }),
        status: "completed",
        usage: { input_tokens: 80, output_tokens: 30 },
      }),
      { status: 200 },
    )) as typeof fetch;

  try {
    const plan = await planOrchestratorChat({
      message: "Please respond using the planner JSON exactly.",
      history: [],
      workspace: baseWorkspace,
      settings: {
        ...defaultAISettings,
        openaiKey: "sk-test",
        defaultProvider: "openai",
        workflowModel: "openai/gpt-5.4-mini",
      },
    });

    assert.deepEqual(plan.actions.map((action) => action.payload), [{ view: "roi" }, { view: "work" }]);
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
      openaiKey: providerKeyFixture("secret-secret-secret"),
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
  assert.ok((context.enterpriseAiOperatingSystem as { score: number }).score > 0);
  assert.ok(
    (context.enterpriseAiOperatingSystem as { recommendations: { title: string }[] }).recommendations.some(
      (recommendation) => recommendation.title.length > 0,
    ),
  );
  assert.ok(JSON.stringify(compacted).includes("enterpriseAiOperatingSystem"));
  assert.ok(JSON.stringify(compacted).includes("runtimeControl"));
  assert.ok((context.runtimeControl as { summary: string }).summary.length > 0);
  assert.ok((context.runtimeControl as { nextActions: { label: string }[] }).nextActions.length > 0);
  assert.match(plan.content, /Recommended move:/);
  assert.ok(plan.evidence.some((item) => item.label === "Use cases" && item.value === String(workspace.useCases.length)));
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
