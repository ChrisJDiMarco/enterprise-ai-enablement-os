import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  RiskLevel,
  Run,
  Skill,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "./enterprise-ai-data.ts";
import { deriveAdoptionRate } from "./adoption-model.ts";
import { openClawIntegration } from "./openclaw-integration.ts";
import type { ReportTemplateId } from "./report-generator.ts";
import type { View } from "./ui/types.ts";

export type OpenAiControlPlaneTone = "green" | "blue" | "amber" | "red" | "purple" | "slate";

export type RuntimeAdapterStatus = "connected" | "ready_to_connect" | "needs_setup" | "sample_profile";

export type RuntimeTelemetryAdapter = {
  id: string;
  name: string;
  category: "native" | "traces" | "evals" | "agent-runtime" | "gateway" | "observability" | "governance";
  status: RuntimeAdapterStatus;
  statusLabel: string;
  tone: OpenAiControlPlaneTone;
  coverage: number;
  purpose: string;
  capabilities: string[];
  proofSignals: string[];
  targetView: View;
};

export type RuntimeInventoryAsset = {
  id: string;
  name: string;
  runtime: string;
  kind: "Skill" | "Agent" | "Workflow" | "Model" | "Connector";
  owner: string;
  risk: RiskLevel;
  activity: string;
  proof: string;
  targetView: View;
};

export type OpenControlPlaneNode = {
  id: string;
  label: string;
  kind: string;
  value: string;
  readiness: number;
  tone: OpenAiControlPlaneTone;
  description: string;
  targetView: View;
};

export type OpenControlPlaneEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  evidence: string;
  strength: number;
};

export type OpenControlPlaneTemplate = {
  id: string;
  title: string;
  category:
    | "control-plane"
    | "runtime-import"
    | "compliance"
    | "observability"
    | "reporting"
    | "adoption"
    | "connector-policy";
  source: string;
  summary: string;
  installs: string;
  evidence: string[];
  actionLabel: string;
  targetView: View;
  tone: OpenAiControlPlaneTone;
};

export type OpenReportCadence = {
  id: string;
  title: string;
  cadence: string;
  audience: string;
  templateId: ReportTemplateId;
  signal: string;
  readiness: number;
  tone: OpenAiControlPlaneTone;
};

export type OpenControlPlaneGap = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  targetView: View;
  severity: "critical" | "high" | "medium";
  tone: OpenAiControlPlaneTone;
};

export type OpenAiControlPlane = {
  score: number;
  posture: "operating" | "forming" | "empty";
  headline: string;
  summary: string;
  nodes: OpenControlPlaneNode[];
  edges: OpenControlPlaneEdge[];
  adapters: RuntimeTelemetryAdapter[];
  runtimeAssets: RuntimeInventoryAsset[];
  templates: OpenControlPlaneTemplate[];
  reportCadence: OpenReportCadence[];
  gaps: OpenControlPlaneGap[];
  metrics: {
    assets: number;
    adapterCount: number;
    connectedAdapters: number;
    telemetryCoverage: number;
    templateCount: number;
    reportCadences: number;
  };
};

export type OpenAiControlPlaneInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
  auditLogs?: AuditLog[];
  toolRequests?: ToolRequest[];
  workSignals?: WorkSignal[];
  contextSources?: ContextSource[];
  report?: string;
  providerCount?: number;
  connectorCount?: number;
  metrics?: {
    annualValue?: number;
    adoptionRate?: number;
    hoursSaved?: number;
    riskItemsOpen?: number;
  };
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readinessTone(readiness: number): OpenAiControlPlaneTone {
  if (readiness >= 82) return "green";
  if (readiness >= 62) return "blue";
  if (readiness >= 36) return "amber";
  return "red";
}

export function runtimeAdapterStatusTone(status: RuntimeAdapterStatus): OpenAiControlPlaneTone {
  if (status === "connected") return "green";
  if (status === "ready_to_connect") return "blue";
  if (status === "sample_profile") return "purple";
  return "amber";
}

export const openControlPlaneTemplates: OpenControlPlaneTemplate[] = [
  {
    id: "tpl-ai-system-registry",
    title: "AI System Registry",
    category: "control-plane",
    source: "Open control-plane starter",
    summary: "Inventory AI assets, owners, risk, purpose, providers, tools, data, evidence, and value in one normalized schema.",
    installs: "Registry tables, ownership workflow, lifecycle labels",
    evidence: ["asset owner", "risk tier", "runtime source", "proof link"],
    actionLabel: "Open Settings",
    targetView: "admin",
    tone: "blue",
  },
  {
    id: "tpl-runtime-import",
    title: "Universal Runtime Import Pack",
    category: "runtime-import",
    source: "Langfuse, LangSmith, Phoenix, OpenTelemetry, and runtime API adapters",
    summary: "Normalize traces, sessions, tool calls, prompts, evals, approvals, and cost events from whichever agent stack teams already use.",
    installs: "Adapter manifest, field mapper, import quality checks",
    evidence: ["trace id", "tool call", "eval result", "cost/latency"],
    actionLabel: "Open Harness",
    targetView: "harness",
    tone: "purple",
  },
  {
    id: "tpl-nist-iso-eu-pack",
    title: "NIST, ISO 42001, and EU AI Act Pack",
    category: "compliance",
    source: "Responsible AI operating controls",
    summary: "Map launch packets to risk management, AI management system controls, human oversight, transparency, and post-market monitoring.",
    installs: "Control map, reviewer workflow, audit export",
    evidence: ["risk rationale", "review decision", "eval proof", "monitoring plan"],
    actionLabel: "Open Risk Review",
    targetView: "governance",
    tone: "green",
  },
  {
    id: "tpl-agent-observability",
    title: "Agent Observability Starter",
    category: "observability",
    source: "OpenTelemetry-compatible trace model",
    summary: "Treat every prompt, retrieval, tool call, approval, model call, evaluator, and output validation as a reviewable event.",
    installs: "Span taxonomy, evaluator overlays, drift watchlist",
    evidence: ["span id", "prompt version", "approval gate", "drift signal"],
    actionLabel: "Open Evals",
    targetView: "evals",
    tone: "blue",
  },
  {
    id: "tpl-exec-reporting",
    title: "Automated Executive Reporting Cadence",
    category: "reporting",
    source: "Daily, weekly, monthly, board-ready report automation",
    summary: "Prepare stakeholder-specific packets from live portfolio, proof, risk, adoption, and value data without waiting for a prompt.",
    installs: "Daily digest, weekly exec brief, governance exception report, board summary",
    evidence: ["report template", "audience", "cadence", "source evidence"],
    actionLabel: "Open Reports",
    targetView: "reports",
    tone: "amber",
  },
  {
    id: "tpl-connector-policy",
    title: "Connector Trust and Scope Policy",
    category: "connector-policy",
    source: "MCP and enterprise app governance",
    summary: "Score connector trust, compare OAuth scopes, require approvals for risky actions, and keep a kill switch for every tool path.",
    installs: "Scope diff, policy simulation, approval gate, revocation path",
    evidence: ["scope list", "policy decision", "approval id", "blocked action"],
    actionLabel: "Open Broker",
    targetView: "broker",
    tone: "red",
  },
  {
    id: "tpl-adoption-rollout",
    title: "Adoption and Change Rollout Pack",
    category: "adoption",
    source: "Enablement office playbook",
    summary: "Turn pilot wins into role-based training, office hours, champions, feedback loops, and cohort-level value proof.",
    installs: "Champion roster, training sequence, value feedback loop",
    evidence: ["role cohort", "training event", "feedback signal", "adoption metric"],
    actionLabel: "Open Training",
    targetView: "training",
    tone: "green",
  },
];

function buildAdapters(input: Required<Pick<OpenAiControlPlaneInput, "runs" | "evalResults" | "governanceReviews">> & {
  hasReport: boolean;
  hasConnectors: boolean;
}): RuntimeTelemetryAdapter[] {
  const traceCoverage = input.runs.length ? 64 : 0;
  const evalCoverage = input.evalResults.length ? 68 : 0;
  const governanceCoverage = input.governanceReviews.length ? 72 : 0;
  const workspaceCoverage = clamp(42 + Math.min(30, input.runs.length * 4) + Math.min(20, input.evalResults.length * 5) + (input.hasReport ? 8 : 0));

  return [
    {
      id: "enablement-os-native",
      name: "Enablement OS Native",
      category: "native",
      status: "connected",
      statusLabel: "Tracking now",
      tone: "green",
      coverage: workspaceCoverage,
      purpose: "Portfolio, Skill, governance, proof, value, and reporting system of record.",
      capabilities: ["AI inventory", "launch lifecycle", "proof ledger", "report generation"],
      proofSignals: ["use cases", "Skills", "reviews", "reports"].filter((label) =>
        label === "use cases" ? true : label === "reports" ? input.hasReport : true,
      ),
      targetView: "evidence",
    },
    {
      id: "otel-agent-spans",
      name: "OpenTelemetry Agent Spans",
      category: "observability",
      status: input.runs.length ? "ready_to_connect" : "needs_setup",
      statusLabel: input.runs.length ? "Mapper ready" : "Needs trace source",
      tone: runtimeAdapterStatusTone(input.runs.length ? "ready_to_connect" : "needs_setup"),
      coverage: traceCoverage,
      purpose: "Import prompt, retrieval, tool, approval, model, cost, latency, and output validation spans.",
      capabilities: ["trace import", "cost and latency", "tool calls", "approval spans"],
      proofSignals: input.runs.length ? [`${input.runs.length} local runs can map to spans`] : ["no trace source connected"],
      targetView: "harness",
    },
    {
      id: "langfuse-adapter",
      name: "Langfuse",
      category: "traces",
      status: "ready_to_connect",
      statusLabel: "Adapter-ready",
      tone: "blue",
      coverage: traceCoverage,
      purpose: "Bring prompt versions, traces, scores, cost, latency, and production feedback into governance packets.",
      capabilities: ["prompt versions", "trace sessions", "feedback scores", "cost telemetry"],
      proofSignals: input.runs.length ? [`${input.runs.length} trace records to reconcile`] : ["connect a project API key"],
      targetView: "connectors",
    },
    {
      id: "langsmith-adapter",
      name: "LangSmith",
      category: "evals",
      status: "ready_to_connect",
      statusLabel: "Adapter-ready",
      tone: "blue",
      coverage: Math.max(traceCoverage, evalCoverage),
      purpose: "Pull datasets, experiment results, traces, evaluator output, and regression signals into release gates.",
      capabilities: ["datasets", "experiments", "evaluators", "trace runs"],
      proofSignals: input.evalResults.length ? [`${input.evalResults.length} eval results to reconcile`] : ["connect workspace token"],
      targetView: "evals",
    },
    {
      id: "phoenix-openinference",
      name: "Arize Phoenix / OpenInference",
      category: "observability",
      status: "ready_to_connect",
      statusLabel: "Adapter-ready",
      tone: "blue",
      coverage: Math.max(traceCoverage, evalCoverage),
      purpose: "Import open-source traces, embeddings, evaluations, drift, and hallucination signals for reviewer-ready monitoring.",
      capabilities: ["OpenInference traces", "eval spans", "drift signals", "retrieval diagnostics"],
      proofSignals: input.evalResults.length ? ["eval overlays available"] : ["connect Phoenix project"],
      targetView: "harness",
    },
    {
      id: "enterprise-ai-gateway",
      name: "Enterprise AI Gateway",
      category: "gateway",
      status: input.hasConnectors ? "ready_to_connect" : "needs_setup",
      statusLabel: input.hasConnectors ? "Policy-ready" : "Needs connectors",
      tone: runtimeAdapterStatusTone(input.hasConnectors ? "ready_to_connect" : "needs_setup"),
      coverage: input.hasConnectors ? 58 : 18,
      purpose: "Normalize provider routing, budgets, secrets, model allowlists, and irreversible tool actions.",
      capabilities: ["provider routing", "budget policy", "scope checks", "kill switch"],
      proofSignals: input.hasConnectors ? ["connector catalog exists"] : ["connect first app or provider"],
      targetView: "broker",
    },
    {
      id: "governance-platforms",
      name: "Governance Platforms",
      category: "governance",
      status: input.governanceReviews.length ? "ready_to_connect" : "needs_setup",
      statusLabel: input.governanceReviews.length ? "Evidence-ready" : "Needs review packet",
      tone: runtimeAdapterStatusTone(input.governanceReviews.length ? "ready_to_connect" : "needs_setup"),
      coverage: governanceCoverage,
      purpose: "Export AI inventory, control evidence, reviewer decisions, exceptions, and audit trails to enterprise GRC systems.",
      capabilities: ["control map", "review export", "exceptions", "audit trail"],
      proofSignals: input.governanceReviews.length ? [`${input.governanceReviews.length} review records`] : ["submit first review"],
      targetView: "governance",
    },
    {
      id: "openclaw-compatible",
      name: "OpenClaw-compatible runtime",
      category: "agent-runtime",
      status: "sample_profile",
      statusLabel: "Reference adapter",
      tone: "purple",
      coverage: clamp((openClawIntegration.riskControls.filter((control) => control.status === "pass").length / openClawIntegration.riskControls.length) * 100),
      purpose: "Example adapter shape for agent runtimes with channels, tools, sessions, risk controls, and proof events.",
      capabilities: ["agent import", "session proof", "risk controls", "launch readiness"],
      proofSignals: [`${openClawIntegration.agents.length} reference agents`, `${openClawIntegration.gateway.evidenceEvents} sample events`],
      targetView: "connectors",
    },
  ];
}

function buildRuntimeAssets(input: OpenAiControlPlaneInput): RuntimeInventoryAsset[] {
  const skillAssets = input.skills.map((skill) => {
    const evalCount = input.evalResults.filter((result) => result.skillId === skill.id).length;
    const runCount = input.runs.filter((run) => run.skillId === skill.id).length;
    return {
      id: `skill-${skill.id}`,
      name: skill.name,
      runtime: "Enablement OS Registry",
      kind: "Skill" as const,
      owner: skill.ownerId || "Unassigned",
      risk: skill.riskLevel,
      activity: `${runCount || skill.runs || 0} run${(runCount || skill.runs || 0) === 1 ? "" : "s"}`,
      proof: evalCount ? `${evalCount} eval${evalCount === 1 ? "" : "s"}` : `${skill.evalPassRate}% eval pass rate`,
      targetView: "skills" as View,
    };
  });

  const workflowAssets = input.useCases
    .filter((useCase) => ["approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(useCase.status))
    .slice(0, Math.max(0, 6 - skillAssets.length))
    .map((useCase) => ({
      id: `use-case-${useCase.id}`,
      name: useCase.title,
      runtime: "Launch Portfolio",
      kind: "Workflow" as const,
      owner: useCase.ownerId ?? useCase.requestorId,
      risk: useCase.riskLevel,
      activity: `${useCase.status.replace(/_/g, " ")}`,
      proof: `${useCase.priorityScore}/100 priority`,
      targetView: "factory" as View,
    }));

  return [...skillAssets, ...workflowAssets].slice(0, 8);
}

export function deriveOpenAiControlPlane(input: OpenAiControlPlaneInput): OpenAiControlPlane {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const evalResults = input.evalResults ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const auditLogs = input.auditLogs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const workSignals = input.workSignals ?? [];
  const contextSources = input.contextSources ?? [];
  const annualValue = input.metrics?.annualValue ?? skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);
  const adoptionRate = input.metrics?.adoptionRate ?? deriveAdoptionRate(skills, useCases);
  const connectorCount = input.connectorCount ?? toolRequests.length;
  const hasConnectors = connectorCount > 0 || toolRequests.length > 0;
  const hasReport = Boolean(input.report?.trim());
  const approvedReviews = governanceReviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status)).length;
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const passedEvals = evalResults.filter((result) => result.passed).length;
  const assetCount = useCases.length + skills.length + (input.providerCount ?? 0) + connectorCount;
  const telemetryCoverage = clamp(
    (runs.length ? 26 : 0) +
      (evalResults.length ? 22 : 0) +
      (auditLogs.length ? 14 : 0) +
      (toolRequests.length ? 14 : 0) +
      (contextSources.length ? 10 : 0) +
      (hasReport ? 8 : 0),
  );
  const governanceCoverage = clamp(
    (governanceReviews.length ? 34 : 0) +
      (approvedReviews ? 18 : 0) +
      (passedEvals ? 18 : 0) +
      (auditLogs.length ? 14 : 0) +
      (annualValue ? 10 : 0),
  );
  const lifecycleCoverage = clamp(
    (workSignals.length ? 12 : 0) +
      (useCases.length ? 18 : 0) +
      (skills.length ? 20 : 0) +
      (runs.length ? 16 : 0) +
      (evalResults.length ? 14 : 0) +
      (governanceReviews.length ? 12 : 0) +
      (annualValue ? 8 : 0),
  );
  const connectorCoverage = clamp((hasConnectors ? 46 : 0) + (toolRequests.length ? 24 : 0) + (contextSources.length ? 18 : 0) + (input.providerCount ? 12 : 0));
  const reportingCoverage = clamp((hasReport ? 36 : 0) + (annualValue ? 24 : 0) + (adoptionRate ? 16 : 0) + (governanceReviews.length ? 12 : 0) + (runs.length ? 12 : 0));
  const score = clamp(
    assetCount ? lifecycleCoverage * 0.28 + telemetryCoverage * 0.22 + governanceCoverage * 0.2 + connectorCoverage * 0.14 + reportingCoverage * 0.16 : 0,
  );
  const posture = score >= 60 ? "operating" : score > 0 ? "forming" : "empty";
  const adapters = buildAdapters({
    runs,
    evalResults,
    governanceReviews,
    hasReport,
    hasConnectors,
  });
  const nodes: OpenControlPlaneNode[] = [
    {
      id: "demand",
      label: "Work Demand",
      kind: "signal layer",
      value: workSignals.length ? `${workSignals.length}` : `${useCases.length}`,
      readiness: clamp(workSignals.length ? 80 : useCases.length ? 48 : 8),
      tone: readinessTone(workSignals.length ? 80 : useCases.length ? 48 : 8),
      description: "Work signals, intake, manual demand, and use case evidence.",
      targetView: workSignals.length ? "work" : "factory",
    },
    {
      id: "portfolio",
      label: "Use Cases",
      kind: "portfolio",
      value: String(useCases.length),
      readiness: clamp(useCases.length ? Math.min(100, 40 + useCases.length * 10) : 0),
      tone: readinessTone(useCases.length ? Math.min(100, 40 + useCases.length * 10) : 0),
      description: "Scored opportunities with owners, risk, value, and launch intent.",
      targetView: "factory",
    },
    {
      id: "assets",
      label: "Skills and Agents",
      kind: "AI asset registry",
      value: String(skills.length),
      readiness: clamp(skills.length ? Math.min(100, 42 + skills.length * 12) : 0),
      tone: readinessTone(skills.length ? Math.min(100, 42 + skills.length * 12) : 0),
      description: "Reusable governed AI capabilities, imported agents, and runtime assets.",
      targetView: "skills",
    },
    {
      id: "runtime",
      label: "Runtime Traces",
      kind: "observability",
      value: String(runs.length),
      readiness: telemetryCoverage,
      tone: readinessTone(telemetryCoverage),
      description: "Runs, spans, tool calls, cost, latency, outputs, and failure modes.",
      targetView: "harness",
    },
    {
      id: "evals",
      label: "Evals",
      kind: "quality gates",
      value: String(evalResults.length),
      readiness: clamp(evalResults.length ? Math.min(100, 36 + passedEvals * 16) : 0),
      tone: readinessTone(evalResults.length ? Math.min(100, 36 + passedEvals * 16) : 0),
      description: "Safety, accuracy, reliability, regression, and launch-readiness checks.",
      targetView: "evals",
    },
    {
      id: "connectors",
      label: "Connectors",
      kind: "tool and data access",
      value: String(connectorCount),
      readiness: connectorCoverage,
      tone: readinessTone(connectorCoverage),
      description: "Providers, apps, MCP servers, context sources, policies, and approval gates.",
      targetView: "connectors",
    },
    {
      id: "governance",
      label: "Governance",
      kind: "risk and assurance",
      value: String(governanceReviews.length),
      readiness: governanceCoverage,
      tone: readinessTone(governanceCoverage),
      description: "Risk reviews, exceptions, control maps, approvals, and audit-ready packets.",
      targetView: "governance",
    },
    {
      id: "value",
      label: "Value",
      kind: "business impact",
      value: annualValue ? `$${Math.round(annualValue / 1000)}K` : "Baseline",
      readiness: clamp((annualValue ? 58 : 0) + (adoptionRate ? 24 : 0) + (input.metrics?.hoursSaved ? 18 : 0)),
      tone: readinessTone((annualValue ? 58 : 0) + (adoptionRate ? 24 : 0) + (input.metrics?.hoursSaved ? 18 : 0)),
      description: "Adoption, hours saved, cycle-time lift, business value, and confidence.",
      targetView: "roi",
    },
    {
      id: "reports",
      label: "Reports",
      kind: "stakeholder packets",
      value: hasReport ? "Ready" : "Draft",
      readiness: reportingCoverage,
      tone: readinessTone(reportingCoverage),
      description: "Daily, weekly, governance, finance, board, and pilot-ready reporting.",
      targetView: "reports",
    },
  ];

  const edges: OpenControlPlaneEdge[] = [
    { id: "demand-portfolio", from: "demand", to: "portfolio", label: "prioritize", evidence: `${useCases.length} use cases`, strength: nodes[1].readiness },
    { id: "portfolio-assets", from: "portfolio", to: "assets", label: "build", evidence: `${skills.length} Skills`, strength: nodes[2].readiness },
    { id: "assets-runtime", from: "assets", to: "runtime", label: "run", evidence: `${completedRuns} completed runs`, strength: nodes[3].readiness },
    { id: "runtime-evals", from: "runtime", to: "evals", label: "score", evidence: `${evalResults.length} evals`, strength: nodes[4].readiness },
    { id: "connectors-governance", from: "connectors", to: "governance", label: "control", evidence: `${toolRequests.length} tool decisions`, strength: Math.min(nodes[5].readiness, nodes[6].readiness) },
    { id: "governance-reports", from: "governance", to: "reports", label: "prove", evidence: `${governanceReviews.length} reviews`, strength: nodes[8].readiness },
    { id: "reports-value", from: "reports", to: "value", label: "fund", evidence: annualValue ? "value attached" : "baseline needed", strength: nodes[7].readiness },
  ];

  const gaps: OpenControlPlaneGap[] = [
    !workSignals.length && !useCases.length
      ? {
          id: "missing-demand",
          title: "Capture real work demand",
          body: "The OS needs repeated work pain, manual demand, tickets, or business requests before it can prioritize responsibly.",
          actionLabel: "Open Work Signals",
          targetView: "work",
          severity: "critical",
          tone: "red",
        }
      : null,
    !skills.length
      ? {
          id: "missing-assets",
          title: "Create the first governed Skill",
          body: "The app can track opportunities, but it becomes operational once a reusable Skill or imported agent has owner, policy, context, and evals.",
          actionLabel: "Open AI Skills",
          targetView: "skills",
          severity: "high",
          tone: "amber",
        }
      : null,
    !runs.length
      ? {
          id: "missing-runtime",
          title: "Attach trace evidence",
          body: "Runtime traces, tool calls, cost, latency, and outputs make the control plane useful to engineers and reviewers.",
          actionLabel: "Open Harness",
          targetView: "harness",
          severity: "high",
          tone: "amber",
        }
      : null,
    !governanceReviews.length
      ? {
          id: "missing-review",
          title: "Create reviewable assurance",
          body: "Risk reviewers need a concrete packet with use case intent, Skill contract, eval results, control owner, and decision record.",
          actionLabel: "Open Risk Review",
          targetView: "governance",
          severity: "medium",
          tone: "blue",
        }
      : null,
    !annualValue
      ? {
          id: "missing-value",
          title: "Baseline value and adoption",
          body: "Executives will ask whether AI is saving time, reducing risk, growing capacity, or improving cycle time.",
          actionLabel: "Open ROI",
          targetView: "roi",
          severity: "medium",
          tone: "blue",
        }
      : null,
  ].filter(Boolean) as OpenControlPlaneGap[];

  const reportCadence: OpenReportCadence[] = [
    {
      id: "daily-operator-digest",
      title: "Daily Operator Digest",
      cadence: "Weekday morning",
      audience: "AI enablement operator",
      templateId: "daily_ai_enablement_digest",
      signal: "What changed, what is blocked, and the next best move.",
      readiness: clamp(reportingCoverage + 8),
      tone: readinessTone(reportingCoverage + 8),
    },
    {
      id: "weekly-exec-brief",
      title: "Weekly Executive Brief",
      cadence: "Friday afternoon",
      audience: "Executive sponsor and function leaders",
      templateId: "weekly_ai_enablement_brief",
      signal: "Progress, value, decisions, blockers, and risk posture.",
      readiness: reportingCoverage,
      tone: readinessTone(reportingCoverage),
    },
    {
      id: "governance-exception-brief",
      title: "Governance Exception Brief",
      cadence: "When risk changes",
      audience: "Legal, privacy, security, compliance",
      templateId: "governance_summary",
      signal: "Open reviews, control gaps, exceptions, and approval decisions.",
      readiness: governanceCoverage,
      tone: readinessTone(governanceCoverage),
    },
    {
      id: "board-ai-transformation-summary",
      title: "Board AI Transformation Summary",
      cadence: "Monthly or quarterly",
      audience: "CEO staff, board, transformation office",
      templateId: "board_summary",
      signal: "Strategic adoption, value, risk, maturity, and funding asks.",
      readiness: clamp(reportingCoverage * 0.72 + governanceCoverage * 0.18 + (annualValue ? 10 : 0)),
      tone: readinessTone(reportingCoverage * 0.72 + governanceCoverage * 0.18 + (annualValue ? 10 : 0)),
    },
  ];

  const connectedAdapters = adapters.filter((adapter) => adapter.status === "connected").length;
  const headline =
    posture === "operating"
      ? "The AI control plane is ready to sit above any runtime"
      : posture === "forming"
        ? "The AI control plane is forming around your live rollout"
        : "Start the AI control plane with one real work signal";
  const summary =
    `Tracks ${assetCount} inventory object${assetCount === 1 ? "" : "s"}, ${runs.length} runtime trace${runs.length === 1 ? "" : "s"}, ${evalResults.length} eval result${evalResults.length === 1 ? "" : "s"}, ${governanceReviews.length} review${governanceReviews.length === 1 ? "" : "s"}, ${openControlPlaneTemplates.length} reusable launch pack${openControlPlaneTemplates.length === 1 ? "" : "s"}, and ${reportCadence.length} reporting cadence${reportCadence.length === 1 ? "" : "s"} without assuming a single agent runtime.`;

  return {
    score,
    posture,
    headline,
    summary,
    nodes,
    edges,
    adapters,
    runtimeAssets: buildRuntimeAssets(input),
    templates: openControlPlaneTemplates,
    reportCadence,
    gaps: gaps.slice(0, 4),
    metrics: {
      assets: assetCount,
      adapterCount: adapters.length,
      connectedAdapters,
      telemetryCoverage,
      templateCount: openControlPlaneTemplates.length,
      reportCadences: reportCadence.length,
    },
  };
}
