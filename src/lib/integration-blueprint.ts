import type {
  ContextSource,
  Department,
  RiskLevel,
  Run,
  Skill,
  Tool,
  ToolRequest,
  UseCase,
} from "@/lib/enterprise-ai-data";
import type { ProductionReadiness, View } from "@/lib/ui/types";

export type IntegrationZoneStatus = "ready" | "partial" | "missing";

export type IntegrationZone = {
  id: "identity" | "knowledge" | "work-systems" | "automation-runners" | "governance" | "observability";
  name: string;
  purpose: string;
  status: IntegrationZoneStatus;
  score: number;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type AutomationRunnerType =
  | "harness-native"
  | "durable-workflow"
  | "enterprise-automation"
  | "rpa"
  | "persistent-agent"
  | "human-in-loop";

export type AutomationRunnerRecommendation = {
  id: AutomationRunnerType;
  name: string;
  bestFor: string;
  whenToUse: string;
  guardrail: string;
  status: IntegrationZoneStatus;
};

export type IntegrationBlueprint = {
  score: number;
  status: IntegrationZoneStatus;
  summary: string;
  primaryNextAction: IntegrationZone;
  zones: IntegrationZone[];
  runners: AutomationRunnerRecommendation[];
  connectedCategories: string[];
};

export type IntegrationBlueprintInput = {
  tools: Tool[];
  contextSources: ContextSource[];
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  productionReadiness?: ProductionReadiness | null;
};

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusFromScore(score: number): IntegrationZoneStatus {
  if (score >= 75) return "ready";
  if (score >= 35) return "partial";
  return "missing";
}

function zone(params: Omit<IntegrationZone, "status" | "score"> & { score: number }): IntegrationZone {
  const score = clamp(params.score);
  return {
    ...params,
    score,
    status: statusFromScore(score),
  };
}

function hasDepartment(useCases: UseCase[], departments: Department[]) {
  return useCases.some((useCase) => departments.includes(useCase.department));
}

function hasToolCategory(tools: Tool[], categoryPattern: RegExp) {
  return tools.some((tool) => categoryPattern.test(tool.category) && tool.enabled);
}

function hasToolAction(tools: Tool[], action: Tool["actionType"]) {
  return tools.some((tool) => tool.actionType === action && tool.enabled);
}

function highestRisk(items: { riskLevel: RiskLevel }[]) {
  const order: RiskLevel[] = ["low", "medium", "high", "restricted"];
  return items.reduce<RiskLevel>((current, item) => (order.indexOf(item.riskLevel) > order.indexOf(current) ? item.riskLevel : current), "low");
}

export function deriveIntegrationBlueprint(input: IntegrationBlueprintInput): IntegrationBlueprint {
  const tools = input.tools ?? [];
  const contextSources = input.contextSources ?? [];
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const readiness = input.productionReadiness ?? null;

  const enabledTools = tools.filter((tool) => tool.enabled);
  const readTools = enabledTools.filter((tool) => tool.actionType === "read");
  const writeTools = enabledTools.filter((tool) => ["write", "create", "update", "delete", "execute"].includes(tool.actionType));
  const approvalTools = enabledTools.filter((tool) => tool.requiresApprovalByDefault);
  const sensitiveSources = contextSources.filter((source) => ["confidential", "restricted", "regulated"].includes(source.classification));
  const healthySources = contextSources.filter((source) => source.enabled && source.health === "healthy");
  const skillsWithToolPolicy = skills.filter((skill) => skill.allowedTools.length || skill.blockedTools.length);
  const skillsWithContext = skills.filter((skill) => skill.contextSources.length);
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const decidedToolRequests = toolRequests.filter((request) => ["approved", "rejected", "blocked"].includes(request.status));
  const connectedCategories = Array.from(new Set(enabledTools.map((tool) => tool.category))).sort();
  const businessRisk = highestRisk([...useCases, ...skills, ...toolRequests]);

  const zones: IntegrationZone[] = [
    zone({
      id: "identity",
      name: "Identity and access",
      purpose: "SSO, roles, groups, department ownership, Skill access, and per-tool authorization.",
      score:
        (readiness?.auth?.authRequired ? 30 : 0) +
        (readiness?.auth?.oidcConfigured ? 30 : 0) +
        (hasToolCategory(enabledTools, /identity|directory|hris/) ? 20 : 0) +
        (skillsWithToolPolicy.length ? 20 : 0),
      evidence: readiness?.auth?.oidcConfigured
        ? "OIDC is configured and tool access can bind to user identity."
        : hasToolCategory(enabledTools, /identity|directory|hris/)
          ? "Identity metadata tools are cataloged, but production SSO still needs configuration."
          : "No production identity connector is visible yet.",
      nextAction: "Connect Okta or Microsoft Entra ID, map groups to roles, and bind every tool call to the requesting user and Skill.",
      targetView: "admin",
    }),
    zone({
      id: "knowledge",
      name: "Knowledge and context fabric",
      purpose: "Approved sources, retrieval, source ownership, data classification, citations, and stale-source controls.",
      score:
        (contextSources.length ? 20 : 0) +
        (healthySources.length ? 25 : 0) +
        (sensitiveSources.length ? 15 : 0) +
        (skillsWithContext.length ? 25 : 0) +
        (readTools.length ? 15 : 0),
      evidence: `${healthySources.length}/${Math.max(contextSources.length, 1)} sources are healthy; ${skillsWithContext.length} Skills have context bindings.`,
      nextAction: "Connect SharePoint, Google Drive, Confluence, contract repositories, and data catalogs with owner approval and permission simulation.",
      targetView: "context",
    }),
    zone({
      id: "work-systems",
      name: "Systems of work and record",
      purpose: "Ticketing, HRIS, finance, procurement, legal, CRM, and workflow systems where AI work becomes business impact.",
      score:
        (connectedCategories.length ? 20 : 0) +
        (hasToolCategory(enabledTools, /ticket|workflow|hris|finance|procurement|crm|database|email|calendar/) ? 35 : 0) +
        (hasDepartment(useCases, ["HR", "Finance", "Legal", "Procurement", "IT", "Operations"]) ? 20 : 0) +
        (toolRequests.length ? 25 : 0),
      evidence: `${connectedCategories.length} tool categories are cataloged with ${toolRequests.length} broker request records.`,
      nextAction: "Connect the highest-value department systems first: ServiceNow/Jira for work intake, Workday for HR context, finance/procurement/legal systems for bounded actions.",
      targetView: "connectors",
    }),
    zone({
      id: "automation-runners",
      name: "Automation and agent runners",
      purpose: "Route work to the right execution layer: Harness-native runs, durable workflows, enterprise automation, RPA, persistent agents, or humans.",
      score:
        (runs.length ? 20 : 0) +
        (traceableRuns.length ? 20 : 0) +
        (hasToolAction(enabledTools, "create") || hasToolAction(enabledTools, "execute") ? 20 : 0) +
        (readiness?.workflows?.configured ? 20 : 0) +
        (readiness?.connectors?.configured ? 20 : 0),
      evidence: `${traceableRuns.length} traceable Harness run(s); workflow engine mode is ${readiness?.workflows?.mode ?? "local-job-ledger"}.`,
      nextAction: "Use the AI Harness for governed agent runs, Temporal or LangGraph-style durable workflows for multi-step execution, and Workato/Power Automate/UiPath/Hermes-style workers only behind broker policy.",
      targetView: "harness",
    }),
    zone({
      id: "governance",
      name: "Governance and policy",
      purpose: "Human approvals, risk posture, connector policy, autonomy boundaries, exceptions, and audit-ready evidence.",
      score:
        (approvalTools.length ? 25 : 0) +
        (decidedToolRequests.length ? 25 : 0) +
        (skills.some((skill) => skill.blockedTools.length) ? 15 : 0) +
        (businessRisk !== "low" ? 15 : 0) +
        (toolRequests.some((request) => ["rejected", "blocked"].includes(request.status)) ? 20 : 0),
      evidence: `${approvalTools.length} approval-gated tool(s), ${decidedToolRequests.length} decided broker request(s), highest visible risk is ${businessRisk}.`,
      nextAction: "Define connector policy templates by department, action type, data classification, autonomy tier, and reviewer role.",
      targetView: "governance",
    }),
    zone({
      id: "observability",
      name: "Observability and value proof",
      purpose: "OpenTelemetry-shaped traces, cost, latency, eval evidence, adoption, ROI, incident response, and executive reporting.",
      score:
        (traceableRuns.length ? 25 : 0) +
        (runs.some((run) => run.costUsd > 0 && run.latencyMs > 0) ? 20 : 0) +
        (skills.some((skill) => skill.valueDelivered > 0 || skill.adoptionCount > 0) ? 25 : 0) +
        (readiness?.status === "ready" ? 20 : readiness?.status === "degraded" ? 10 : 0) +
        (toolRequests.length ? 10 : 0),
      evidence: `${runs.length} run(s), ${traceableRuns.length} traceable execution(s), ${skills.filter((skill) => skill.valueDelivered > 0).length} Skill(s) with value proof.`,
      nextAction: "Export run traces, connector events, evals, costs, adoption, and ROI assumptions into the Evidence Ledger and executive reports.",
      targetView: "evidence",
    }),
  ];

  const runnerStatus = (ready: boolean, partial: boolean): IntegrationZoneStatus => (ready ? "ready" : partial ? "partial" : "missing");
  const runners: AutomationRunnerRecommendation[] = [
    {
      id: "harness-native",
      name: "AI Harness native runs",
      bestFor: "Skill tests, copilot answers, approval-gated tool requests, traceable AI sessions.",
      whenToUse: "Use by default for any Skill that needs identity, context, policy, evals, approval, cost, and audit evidence.",
      guardrail: "Every model, context, and tool step must produce a trace event.",
      status: runnerStatus(runs.length > 0 && traceableRuns.length > 0, runs.length > 0),
    },
    {
      id: "durable-workflow",
      name: "Durable workflow engine",
      bestFor: "Long-running, resumable, multi-step workflows with retries and human wait states.",
      whenToUse: "Use for finance close, procurement, legal intake, IT routing, and processes that cross multiple systems.",
      guardrail: "State changes require checkpointing, replay, idempotency keys, and rollback evidence.",
      status: runnerStatus(Boolean(readiness?.workflows?.configured), runs.length > 0),
    },
    {
      id: "enterprise-automation",
      name: "Enterprise automation platforms",
      bestFor: "Deterministic business automation in Power Automate, Workato, Zapier Enterprise, n8n, or similar.",
      whenToUse: "Use when the path is known and repeatable; let the OS govern trigger, action, approval, and evidence.",
      guardrail: "The OS should own policy and evidence even when another platform executes the action.",
      status: runnerStatus(hasToolCategory(enabledTools, /workflow|email|calendar/) && writeTools.length > 0, writeTools.length > 0),
    },
    {
      id: "rpa",
      name: "RPA and legacy desktop automation",
      bestFor: "Legacy systems without reliable APIs, back-office screens, or brittle administrative tasks.",
      whenToUse: "Use sparingly after process redesign proves there is no better API or workflow-system path.",
      guardrail: "Require sandbox dry-runs, screenshots/logs, human approval, and rollback plans.",
      status: runnerStatus(hasToolCategory(enabledTools, /custom/) && hasToolAction(enabledTools, "execute"), hasToolCategory(enabledTools, /custom/)),
    },
    {
      id: "persistent-agent",
      name: "Persistent AI worker",
      bestFor: "Scheduled monitoring, research, browser-assisted tasks, inbox triage, and recurring follow-ups.",
      whenToUse: "Use Hermes-style or similar workers only as governed executors behind identity, MCP/tool policy, and Harness logs.",
      guardrail: "No covert monitoring, raw private-message storage, individual scoring, or unsupervised high-risk action.",
      status: runnerStatus(hasToolAction(enabledTools, "execute") && approvalTools.length > 0, approvalTools.length > 0),
    },
    {
      id: "human-in-loop",
      name: "Human-in-the-loop review",
      bestFor: "Employment, legal, financial, external, high-risk, and ambiguous decisions.",
      whenToUse: "Use whenever autonomy tier, data classification, output risk, or policy requires accountable review.",
      guardrail: "Approval decisions must include approver identity, rationale, timestamp, and evidence packet link.",
      status: runnerStatus(approvalTools.length > 0 || toolRequests.length > 0, skills.length > 0),
    },
  ];

  const score = clamp(zones.reduce((sum, item) => sum + item.score, 0) / zones.length);
  const sortedZones = [...zones].sort((a, b) => a.score - b.score);

  return {
    score,
    status: statusFromScore(score),
    summary: `${connectedCategories.length} connector categor${connectedCategories.length === 1 ? "y" : "ies"}, ${contextSources.length} context source(s), ${skills.length} Skill(s), and ${runs.length} Harness run(s) are visible to the OS.`,
    primaryNextAction: sortedZones[0],
    zones,
    runners,
    connectedCategories,
  };
}
