import type { AIProviderSettings } from "@/lib/model-router";
import { providerLabel, selectModelForTask } from "@/lib/model-router";
import { generateWithModelProvider } from "@/lib/model-provider";

export const orchestratorActionTypes = [
  "open_view",
  "open_intake",
  "draft_use_case",
  "generate_exec_brief",
  "validate_workflow",
  "test_workflow",
  "publish_workflow",
  "load_knowledge_workflow",
  "load_approval_workflow",
  "run_selected_skill",
  "run_selected_eval",
  "submit_selected_governance",
  "open_ai_settings",
  "clear_chat",
] as const;

export type OrchestratorActionType = (typeof orchestratorActionTypes)[number];

export type OrchestratorAction = {
  id: string;
  type: OrchestratorActionType;
  label: string;
  description?: string;
  payload?: Record<string, unknown>;
  tone?: "primary" | "secondary" | "danger";
};

export type OrchestratorEvidence = {
  label: string;
  value: string;
};

export type OrchestratorPlan = {
  content: string;
  actions: OrchestratorAction[];
  autoActions: OrchestratorAction[];
  evidence: OrchestratorEvidence[];
};

export type OrchestratorPlanResult = OrchestratorPlan & {
  model: {
    provider: string;
    model: string;
    modelRef: string;
    routeReason: string;
    localFallback: boolean;
    finishReason: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  };
};

type WorkspaceContext = Record<string, unknown>;

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function makeAction(
  type: OrchestratorActionType,
  label: string,
  description?: string,
  payload?: Record<string, unknown>,
  tone: OrchestratorAction["tone"] = "secondary",
): OrchestratorAction {
  return {
    id: `oa-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label,
    description,
    payload,
    tone,
  };
}

function actionForView(view: string, label: string) {
  return makeAction("open_view", label, "Open this OS surface.", { view });
}

function evidenceFromWorkspace(workspace: WorkspaceContext): OrchestratorEvidence[] {
  const metrics = getRecord(workspace.metrics);
  const counts = getRecord(workspace.counts);
  const evidenceCount =
    getNumber(counts, "auditLogs") +
    getNumber(counts, "runs") +
    getNumber(counts, "evalResults") +
    getNumber(counts, "governanceReviews");

  return [
    { label: "Use cases", value: String(getNumber(metrics, "totalUseCases")) },
    { label: "Skills", value: String(getNumber(metrics, "skills")) },
    { label: "Runs", value: String(getNumber(counts, "runs")) },
    { label: "Evidence", value: String(evidenceCount) },
  ];
}

function viewFromPrompt(message: string) {
  const text = message.toLowerCase();
  const matches: { view: string; terms: string[] }[] = [
    { view: "command", terms: ["command center", "dashboard", "home", "overview"] },
    { view: "orchestrator", terms: ["orchestrator", "assistant", "chat"] },
    { view: "strategy", terms: ["strategy", "roadmap", "quarter", "objective", "operating plan"] },
    { view: "process", terms: ["process", "redesign", "current state", "future state", "swimlane"] },
    { view: "factory", terms: ["use case", "opportunity", "intake", "backlog", "factory"] },
    { view: "harness", terms: ["harness", "trace", "run", "runtime"] },
    { view: "skills", terms: ["skills", "skill library", "prompt"] },
    { view: "workflow", terms: ["workflow", "builder", "graph", "canvas"] },
    { view: "broker", terms: ["mcp", "broker", "connector", "tool"] },
    { view: "context", terms: ["context", "retrieval", "source", "knowledge"] },
    { view: "evals", terms: ["eval", "evaluation", "red team", "test suite"] },
    { view: "governance", terms: ["governance", "review", "approval", "risk"] },
    { view: "evidence", terms: ["evidence", "audit", "ledger", "control"] },
    { view: "roi", terms: ["roi", "metric", "value", "adoption"] },
    { view: "training", terms: ["training", "adoption", "champion"] },
    { view: "reports", terms: ["report", "brief", "executive"] },
    { view: "admin", terms: ["admin", "settings", "api key", "provider", "sso", "readiness"] },
  ];

  return matches.find((entry) => entry.terms.some((term) => text.includes(term)))?.view ?? "";
}

function deterministicPlan(message: string, workspace: WorkspaceContext): OrchestratorPlan {
  const lower = message.toLowerCase();
  const metrics = getRecord(workspace.metrics);
  const counts = getRecord(workspace.counts);
  const workflow = getRecord(workspace.workflow);
  const selectedSkill = getRecord(workspace.selectedSkill);
  const readiness = getRecord(workspace.productionReadiness);
  const workflowIssues = getNumber(workflow, "issues");
  const workflowWarnings = getNumber(workflow, "warnings");
  const workflowNodes = getNumber(workflow, "nodes");
  const workflowEdges = getNumber(workflow, "edges");
  const requestedView = viewFromPrompt(message);
  const evidence = evidenceFromWorkspace(workspace);

  if (/\b(open|show|go to|take me|navigate|switch to)\b/.test(lower) && requestedView) {
    return {
      content: `Done. I can open ${requestedView} from the Orchestrator action rail.`,
      actions: [actionForView(requestedView, `Open ${requestedView}`)],
      autoActions: [actionForView(requestedView, `Open ${requestedView}`)],
      evidence,
    };
  }

  if (/\b(help|what can you do|capabilities|commands)\b/.test(lower)) {
    return {
      content:
        "I can inspect the live workspace, draft use cases, route you to any OS surface, validate and test workflows, generate executive briefs, run selected Skills and evals, submit governance reviews, inspect evidence, and open AI provider settings. I return typed action buttons so state-changing work stays visible and auditable.",
      actions: [
        actionForView("factory", "Open Use Case Factory"),
        actionForView("strategy", "Open Strategy & Roadmap"),
        actionForView("process", "Open Process Studio"),
        actionForView("workflow", "Open Workflow Builder"),
        actionForView("harness", "Open AI Harness"),
        actionForView("evidence", "Open Evidence Ledger"),
        makeAction("generate_exec_brief", "Generate exec brief", "Create a report from the current workspace.", undefined, "primary"),
      ],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(create|draft|add|make)\b/.test(lower) && /\b(use case|opportunity|intake)\b/.test(lower)) {
    return {
      content:
        "I can draft that into the Use Case Factory intake. I will prefill the problem, current process, desired outcome, department, and risk hints, while leaving volume/value fields for confirmed business-owner numbers.",
      actions: [
        makeAction("draft_use_case", "Draft use case", "Prefill intake from this instruction.", { message }, "primary"),
        makeAction("open_intake", "Open blank intake", "Start a clean intake."),
      ],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(generate|create|write|draft)\b/.test(lower) && /\b(report|brief|exec|executive)\b/.test(lower)) {
    return {
      content: "I can generate the executive brief from current portfolio, governance, evidence, and ROI records.",
      actions: [
        makeAction("generate_exec_brief", "Generate exec brief", "Create a report from live workspace state.", undefined, "primary"),
        actionForView("reports", "Open Reports"),
      ],
      autoActions: [makeAction("generate_exec_brief", "Generate exec brief", undefined, undefined, "primary")],
      evidence,
    };
  }

  if (/\b(strategy|roadmap|quarter|objective|operating plan|priority|priorities)\b/.test(lower)) {
    return {
      content: `The roadmap has ${getNumber(metrics, "totalUseCases")} opportunities, ${getNumber(metrics, "activePilots")} active pilots, ${getNumber(metrics, "skills")} reusable Skills, and ${getNumber(metrics, "riskItemsOpen")} open high-risk items. Use Strategy & Roadmap to decide the next quarter's priorities, governance dependencies, and executive decisions.`,
      actions: [
        actionForView("strategy", "Open Strategy & Roadmap"),
        actionForView("factory", "Open Opportunity Funnel"),
        actionForView("reports", "Prepare executive brief"),
      ],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(process|redesign|current state|future state|swimlane|bottleneck|cycle time)\b/.test(lower)) {
    return {
      content:
        "Process Studio turns a selected use case into current-state and future-state operating design before automation. It highlights handoffs, human/AI boundaries, control points, and cycle-time assumptions.",
      actions: [
        actionForView("process", "Open Process Studio"),
        actionForView("workflow", "Open Workflow Builder"),
        actionForView("factory", "Open Use Case Factory"),
      ],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(workflow|builder|graph|canvas|node|validate|publish|test)\b/.test(lower)) {
    return {
      content: [
        workflowIssues ? "The current workflow is not publish-ready." : workflowNodes ? "The current workflow is structurally ready." : "The workflow canvas is empty.",
        `Canvas: ${workflowNodes} blocks, ${workflowEdges} connections, ${workflowIssues} blocking issues, ${workflowWarnings} warnings.`,
      ].join("\n"),
      actions: [
        actionForView("workflow", "Open Workflow Builder"),
        makeAction("validate_workflow", "Validate workflow", "Run graph and policy validation.", undefined, "primary"),
        makeAction("test_workflow", "Test workflow", "Queue a workflow job if validation passes."),
        makeAction("load_knowledge_workflow", "Load knowledge template", "Create a retrieval workflow."),
        makeAction("load_approval_workflow", "Load approval template", "Create a human-gated workflow."),
      ],
      autoActions: /\bvalidate\b/.test(lower) ? [makeAction("validate_workflow", "Validate workflow")] : [],
      evidence,
    };
  }

  if (/\b(api|key|model|provider|kimi|glm|deepseek|gemini|openai|anthropic|azure|sso|auth|admin|settings)\b/.test(lower)) {
    return {
      content: `Provider readiness is ${getString(readiness, "status") || "not checked"}. Server-side model routing can use external providers when environment keys exist; otherwise it stays in deterministic local mode.`,
      actions: [
        makeAction("open_ai_settings", "Open AI settings", "Configure local routing preferences and provider keys.", undefined, "primary"),
        actionForView("admin", "Open Admin"),
      ],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(skill|prompt|agent|copilot|assistant)\b/.test(lower)) {
    const skillName = getString(selectedSkill, "name");
    return {
      content: skillName
        ? `${skillName} is selected. I can run it through the Harness, run evals, submit governance review, or open the Skills Library.`
        : "No Skill is selected yet. Create one from a use case before running Harness, eval, or governance actions.",
      actions: [
        actionForView("skills", "Open Skills Library"),
        makeAction("run_selected_skill", skillName ? `Run ${skillName}` : "Run selected Skill", "Run selected Skill through the Harness.", undefined, "primary"),
        makeAction("run_selected_eval", "Run eval suite", "Run launch-readiness evals."),
        makeAction("submit_selected_governance", "Submit governance review", "Send selected Skill to governance."),
      ],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(evidence|audit|ledger|control|nist|iso|eu ai|owasp)\b/.test(lower)) {
    return {
      content: `Evidence currently includes ${getNumber(counts, "auditLogs")} audit logs, ${getNumber(counts, "runs")} runs, ${getNumber(counts, "evalResults")} eval artifacts, and ${getNumber(counts, "governanceReviews")} governance records.`,
      actions: [actionForView("evidence", "Open Evidence Ledger"), actionForView("harness", "Open Harness"), actionForView("governance", "Open Governance")],
      autoActions: [],
      evidence,
    };
  }

  if (/\b(status|summary|overview|today|priority|next|attention|what should|where are we)\b/.test(lower)) {
    return {
      content: [
        `Portfolio: ${getNumber(metrics, "totalUseCases")} use cases, ${getNumber(metrics, "skills")} Skills, ${getNumber(metrics, "activePilots")} active pilots, ${getNumber(counts, "runs")} runs, ${getNumber(metrics, "riskItemsOpen")} high-risk items.`,
        `Workflow canvas: ${workflowNodes} blocks, ${workflowEdges} connections, ${workflowIssues ? `${workflowIssues} issues` : "valid or empty"}.`,
        getNumber(counts, "governanceReviews")
          ? `Governance: ${getNumber(counts, "governanceReviews")} review records.`
          : "Governance: no review records yet.",
      ].join("\n"),
      actions: [
        getNumber(metrics, "totalUseCases")
          ? actionForView("factory", "Review opportunities")
          : makeAction("open_intake", "Create first use case", "Start structured intake.", undefined, "primary"),
        actionForView("evidence", "Inspect evidence"),
        makeAction("generate_exec_brief", "Generate exec brief", "Create an executive report."),
      ],
      autoActions: [],
      evidence,
    };
  }

  return {
    content:
      "I can route this through the OS. The safest next steps are to open the relevant surface, draft a use case, validate the workflow, or generate an executive brief.",
    actions: [
      actionForView(requestedView || "command", requestedView ? "Open related view" : "Open Command Center"),
      makeAction("open_intake", "Create use case", "Start structured intake."),
      makeAction("validate_workflow", "Validate workflow", "Check the current graph."),
      makeAction("generate_exec_brief", "Generate exec brief", "Create an executive report."),
    ],
    autoActions: [],
    evidence,
  };
}

function parseModelJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeActions(actions: unknown): OrchestratorAction[] {
  if (!Array.isArray(actions)) return [];
  return actions.slice(0, 8).flatMap((raw, index) => {
    const item = getRecord(raw);
    const type = getString(item, "type") as OrchestratorActionType;
    if (!orchestratorActionTypes.includes(type)) return [];
    const label = getString(item, "label").slice(0, 80) || type.replace(/_/g, " ");
    const description = getString(item, "description").slice(0, 240) || undefined;
    const payload = getRecord(item.payload);
    const rawTone = getString(item, "tone");
    const tone = rawTone === "primary" || rawTone === "danger" || rawTone === "secondary" ? rawTone : "secondary";
    return [
      {
        id: getString(item, "id") || `oa-model-${Date.now()}-${index}`,
        type,
        label,
        description,
        payload: Object.keys(payload).length ? payload : undefined,
        tone,
      },
    ];
  });
}

function sanitizeEvidence(evidence: unknown, fallback: OrchestratorEvidence[]): OrchestratorEvidence[] {
  if (!Array.isArray(evidence)) return fallback;
  const cleaned = evidence.slice(0, 8).flatMap((raw) => {
    const item = getRecord(raw);
    const label = getString(item, "label").slice(0, 60);
    const value = String(item.value ?? "").slice(0, 80);
    return label && value ? [{ label, value }] : [];
  });
  return cleaned.length ? cleaned : fallback;
}

function coerceModelPlan(parsed: Record<string, unknown> | null, fallback: OrchestratorPlan): OrchestratorPlan {
  if (!parsed) return fallback;
  const content = getString(parsed, "content").trim();
  if (!content) return fallback;
  return {
    content: content.slice(0, 4000),
    actions: sanitizeActions(parsed.actions),
    autoActions: sanitizeActions(parsed.autoActions).filter((action) =>
      ["open_view", "generate_exec_brief", "validate_workflow"].includes(action.type),
    ),
    evidence: sanitizeEvidence(parsed.evidence, fallback.evidence),
  };
}

function orchestratorSystemPrompt() {
  return [
    "You are the Enterprise AI Enablement OS Orchestrator.",
    "You help enterprise AI leaders operate a governed AI enablement control plane.",
    "Use only the workspace context provided by the user payload. Do not invent counts, names, approvals, policies, or provider status.",
    "Return strict JSON only. No markdown outside JSON.",
    "Schema: {\"content\":\"string\",\"actions\":[{\"type\":\"open_view|open_intake|draft_use_case|generate_exec_brief|validate_workflow|test_workflow|publish_workflow|load_knowledge_workflow|load_approval_workflow|run_selected_skill|run_selected_eval|submit_selected_governance|open_ai_settings\",\"label\":\"string\",\"description\":\"string\",\"payload\":{},\"tone\":\"primary|secondary|danger\"}],\"autoActions\":[],\"evidence\":[{\"label\":\"string\",\"value\":\"string\"}]}",
    "Never put publish_workflow, run_selected_skill, submit_selected_governance, or clear_chat in autoActions.",
    "Prefer action buttons over claiming you completed state changes.",
  ].join("\n");
}

export async function planOrchestratorChat(params: {
  message: string;
  history: { role: "user" | "assistant"; content: string; createdAt?: string }[];
  workspace: WorkspaceContext;
  settings: AIProviderSettings;
}): Promise<OrchestratorPlanResult> {
  const route = selectModelForTask(params.settings, "workflow");
  const fallbackPlan = deterministicPlan(params.message, params.workspace);

  if (route.provider === "local") {
    return {
      ...fallbackPlan,
      model: {
        provider: route.provider,
        model: route.model,
        modelRef: route.modelRef,
        routeReason: route.reason,
        localFallback: true,
        finishReason: "local_planner",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
    };
  }

  const userPayload = JSON.stringify({
    message: params.message,
    history: params.history.slice(-8),
    workspace: params.workspace,
    allowedActionTypes: orchestratorActionTypes,
  });

  const modelResult = await generateWithModelProvider({
    settings: params.settings,
    lane: "workflow",
    system: orchestratorSystemPrompt(),
    user: userPayload,
    temperature: 0.1,
    maxTokens: 1200,
  });
  const modelPlan = modelResult.localFallback ? fallbackPlan : coerceModelPlan(parseModelJson(modelResult.text), fallbackPlan);

  return {
    ...modelPlan,
    model: {
      provider: modelResult.route.provider,
      model: modelResult.route.model,
      modelRef: modelResult.route.modelRef,
      routeReason: `${providerLabel(modelResult.route.provider)}: ${modelResult.route.reason}`,
      localFallback: modelResult.localFallback,
      finishReason: modelResult.finishReason,
      inputTokens: modelResult.inputTokens,
      outputTokens: modelResult.outputTokens,
      latencyMs: modelResult.latencyMs,
    },
  };
}
