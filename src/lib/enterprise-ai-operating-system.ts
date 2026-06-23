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
import { formatCurrency } from "./enterprise-ai-data.ts";
import { deriveAdoptionRate } from "./adoption-model.ts";
import type { ProductionReadiness, View } from "./ui/types.ts";

export type EnterpriseOsTone = "slate" | "green" | "amber" | "red" | "blue" | "purple";
export type EnterpriseOsStatus = "future-ready" | "operating" | "forming" | "gap";

export type EnterpriseOsCapability = {
  id:
    | "system-registry"
    | "agent-lifecycle"
    | "workflow-native"
    | "protocol-ready"
    | "assurance"
    | "observability"
    | "adoption"
    | "value-reporting";
  title: string;
  score: number;
  status: EnterpriseOsStatus;
  tone: EnterpriseOsTone;
  value: string;
  summary: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseOsLifecycleStage = {
  id: string;
  label: string;
  readiness: number;
  tone: EnterpriseOsTone;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseOsProtocolSurface = {
  id: "mcp" | "a2a" | "agents-sdk" | "enterprise-ipaas" | "observability-otel";
  label: string;
  purpose: string;
  readiness: number;
  tone: EnterpriseOsTone;
  currentSignal: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseOsWorkflowLane = {
  id: string;
  label: string;
  readiness: number;
  tone: EnterpriseOsTone;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseOsStakeholderTrack = {
  audience: string;
  promise: string;
  readiness: number;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseOsRecommendation = {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  body: string;
  targetView: View;
  actionLabel: string;
};

export type EnterpriseAiOperatingSystem = {
  score: number;
  posture: EnterpriseOsStatus;
  headline: string;
  summary: string;
  metrics: {
    aiAssets: number;
    governedSkills: number;
    workflowSignals: number;
    traceableRuns: number;
    evalCoverage: number;
    complianceCoverage: number;
    connectorReadiness: number;
    valueTracked: number;
  };
  capabilities: EnterpriseOsCapability[];
  lifecycle: EnterpriseOsLifecycleStage[];
  protocols: EnterpriseOsProtocolSurface[];
  workflowLanes: EnterpriseOsWorkflowLane[];
  stakeholderTracks: EnterpriseOsStakeholderTrack[];
  recommendations: EnterpriseOsRecommendation[];
};

export type EnterpriseAiOperatingSystemInput = {
  useCases?: UseCase[];
  skills?: Skill[];
  runs?: Run[];
  evalResults?: EvalResult[];
  governanceReviews?: GovernanceReview[];
  auditLogs?: AuditLog[];
  toolRequests?: ToolRequest[];
  workSignals?: WorkSignal[];
  contextSources?: ContextSource[];
  productionReadiness?: ProductionReadiness | null;
  report?: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratio(ready: number, total: number) {
  if (total <= 0) return 0;
  return clamp((ready / total) * 100);
}

function tone(score: number): EnterpriseOsTone {
  if (score >= 82) return "green";
  if (score >= 62) return "blue";
  if (score >= 38) return "amber";
  return "red";
}

function status(score: number): EnterpriseOsStatus {
  if (score >= 82) return "future-ready";
  if (score >= 62) return "operating";
  if (score >= 38) return "forming";
  return "gap";
}

function cap(input: Omit<EnterpriseOsCapability, "status" | "tone">): EnterpriseOsCapability {
  const score = clamp(input.score);
  return { ...input, score, status: status(score), tone: tone(score) };
}

function stage(input: Omit<EnterpriseOsLifecycleStage, "tone">): EnterpriseOsLifecycleStage {
  return { ...input, readiness: clamp(input.readiness), tone: tone(input.readiness) };
}

function protocol(input: Omit<EnterpriseOsProtocolSurface, "tone">): EnterpriseOsProtocolSurface {
  return { ...input, readiness: clamp(input.readiness), tone: tone(input.readiness) };
}

function lane(input: Omit<EnterpriseOsWorkflowLane, "tone">): EnterpriseOsWorkflowLane {
  return { ...input, readiness: clamp(input.readiness), tone: tone(input.readiness) };
}

function highRisk(risk: RiskLevel) {
  return risk === "high" || risk === "restricted";
}

function activePilot(useCase: UseCase) {
  return ["approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(useCase.status);
}

function completedRun(run: Run) {
  return run.status === "completed" && run.trace.length > 0;
}

function approvedReview(review: GovernanceReview) {
  return ["approved", "approved_with_conditions"].includes(review.status);
}

function compactList(items: string[]) {
  return items.filter(Boolean).slice(0, 3).join(", ") || "No evidence yet";
}

export function deriveEnterpriseAiOperatingSystem(input: EnterpriseAiOperatingSystemInput = {}): EnterpriseAiOperatingSystem {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const evalResults = input.evalResults ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const auditLogs = input.auditLogs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const workSignals = input.workSignals ?? [];
  const contextSources = input.contextSources ?? [];
  const report = input.report ?? "";
  const connectorCatalog = input.productionReadiness?.connectors?.catalog;

  const aiAssets = useCases.length + skills.length;
  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status)).length;
  const productionSkills = skills.filter((skill) => skill.status === "production").length;
  const activePilots = useCases.filter(activePilot).length;
  const linkedUseCases = useCases.filter((useCase) => useCase.linkedSkillId).length;
  const completedRuns = runs.filter(completedRun).length;
  const passingEvals = evalResults.filter((result) => result.passed && result.criticalFailures === 0).length;
  const evalCoverage = ratio(passingEvals, Math.max(skills.length, 1));
  const approvedReviews = governanceReviews.filter(approvedReview).length;
  const complianceCoverage = clamp(
    (governanceReviews.length ? 20 : 0) +
      (approvedReviews ? 20 : 0) +
      (evalResults.length ? 18 : 0) +
      (auditLogs.length ? 16 : 0) +
      (runs.length ? 14 : 0) +
      (skills.some((skill) => highRisk(skill.riskLevel)) || useCases.some((useCase) => highRisk(useCase.riskLevel)) ? (governanceReviews.length ? 12 : 0) : 12),
  );
  const connectorReady = connectorCatalog?.readyCount ?? input.productionReadiness?.connectors?.eventSummary?.executed ?? 0;
  const connectorRequired = connectorCatalog?.requiredCount ?? connectorCatalog?.connectors.length ?? 0;
  const connectorReadiness = connectorRequired ? ratio(connectorReady, connectorRequired) : aiAssets ? 28 : 0;
  const providerConfigured = Boolean(input.productionReadiness?.secretVault?.configured || input.productionReadiness?.connectors?.configured);
  const healthyContextSources = contextSources.filter((source) => source.enabled && source.health === "healthy").length;
  const valueTracked = skills.reduce((sum, skill) => sum + (skill.valueDelivered || 0), 0);
  const adoptionRate = deriveAdoptionRate(skills, useCases);
  const highRiskAssets = [...useCases, ...skills].filter((asset) => highRisk(asset.riskLevel)).length;
  const openReviews = governanceReviews.filter((review) => review.status === "changes_requested" || review.blockers.length > 0).length;
  const decidedToolRequests = toolRequests.filter((request) => ["approved", "rejected", "blocked"].includes(request.status)).length;
  const toolDecisionCoverage = ratio(decidedToolRequests, Math.max(toolRequests.length, 1));
  const workflowCoverage = clamp(
    (workSignals.length ? 22 : 0) +
      (useCases.length ? 18 : 0) +
      (linkedUseCases ? 18 : 0) +
      (runs.length ? 16 : 0) +
      (valueTracked ? 14 : 0) +
      (report.trim() ? 12 : 0),
  );
  const registryScore = clamp(
    (aiAssets ? 25 : 0) +
      ratio(governedSkills + linkedUseCases, Math.max(aiAssets, 1)) * 0.24 +
      (providerConfigured ? 14 : 0) +
      connectorReadiness * 0.18 +
      (auditLogs.length ? 12 : 0) +
      (contextSources.length ? 10 : 0),
  );
  const lifecycleScore = clamp(
    (useCases.length ? 12 : 0) +
      (linkedUseCases ? 12 : 0) +
      (governedSkills ? 14 : 0) +
      (completedRuns ? 14 : 0) +
      evalCoverage * 0.16 +
      complianceCoverage * 0.16 +
      (activePilots ? 10 : 0) +
      (productionSkills ? 12 : 0),
  );
  const protocolScore = clamp(
    connectorReadiness * 0.34 +
      toolDecisionCoverage * 0.18 +
      (providerConfigured ? 14 : 0) +
      (runs.length ? 12 : 0) +
      (skills.some((skill) => skill.allowedTools.length || skill.contextSources.length) ? 12 : 0) +
      (auditLogs.length ? 10 : 0),
  );
  const observabilityScore = clamp(
    (runs.length ? 22 : 0) +
      (completedRuns ? 16 : 0) +
      evalCoverage * 0.24 +
      (auditLogs.length ? 16 : 0) +
      (toolRequests.length ? 10 : 0) +
      (workSignals.some((signal) => ["feedback_given", "skill_used", "context_gap"].includes(signal.eventType)) ? 12 : 0),
  );
  const adoptionScore = clamp(
    (governedSkills ? 18 : 0) +
      adoptionRate * 0.28 +
      (workSignals.some((signal) => ["training_completed", "feedback_given", "skill_used"].includes(signal.eventType)) ? 18 : 0) +
      (valueTracked ? 18 : 0) +
      (report.trim() ? 10 : 0) +
      (useCases.length ? 10 : 0),
  );
  const valueReportingScore = clamp(
    (valueTracked ? 26 : 0) +
      (report.trim() ? 18 : 0) +
      (runs.length ? 14 : 0) +
      evalCoverage * 0.14 +
      complianceCoverage * 0.14 +
      (adoptionRate ? 14 : 0),
  );
  const assuranceScore = complianceCoverage;

  const capabilities: EnterpriseOsCapability[] = [
    cap({
      id: "system-registry",
      title: "AI system registry",
      score: registryScore,
      value: `${aiAssets} assets`,
      summary: "One inventory for use cases, Skills, owners, providers, connectors, context, risk, and proof.",
      nextAction: aiAssets ? "Close owner/provider/connector gaps so the inventory becomes audit-grade." : "Create the first governed use case and register the owner.",
      targetView: aiAssets ? "estate" : "factory",
    }),
    cap({
      id: "agent-lifecycle",
      title: "Agent lifecycle",
      score: lifecycleScore,
      value: `${productionSkills} production`,
      summary: "Move AI from idea to design, governance, build, eval, pilot, production, monitoring, and retirement.",
      nextAction: governedSkills ? "Standardize versioning, launch gates, and retirement criteria for every Skill." : "Convert the first approved opportunity into a governed Skill.",
      targetView: governedSkills ? "launch" : "skills",
    }),
    cap({
      id: "workflow-native",
      title: "Workflow-native AI",
      score: workflowCoverage,
      value: `${workSignals.length} signals`,
      summary: "Start from business workflows, handoffs, friction, volume, and exception paths before designing agents.",
      nextAction: workSignals.length ? "Turn the strongest work signal into a process map and use case." : "Connect or capture work signals from Slack, tickets, email, finance, HR, or operations.",
      targetView: workSignals.length ? "process" : "work",
    }),
    cap({
      id: "protocol-ready",
      title: "Protocol-ready integration",
      score: protocolScore,
      value: `${connectorReady}/${Math.max(connectorRequired, 1)} connectors`,
      summary: "Prepare for MCP-style tools, A2A-style handoffs, SDK-owned orchestration, and enterprise iPaaS execution.",
      nextAction: connectorReadiness >= 70 ? "Run connector proof with policy, trace, and rollback evidence." : "Activate the first governed connector and bind tool scopes to Skills.",
      targetView: "connectors",
    }),
    cap({
      id: "assurance",
      title: "AI assurance",
      score: assuranceScore,
      value: `${complianceCoverage}% covered`,
      summary: "Map NIST AI RMF, ISO 42001, EU AI Act, OWASP LLM risks, and board/audit packets to one evidence chain.",
      nextAction: openReviews ? "Resolve open governance blockers and attach closure evidence." : "Generate compliance packs from live evidence.",
      targetView: "governance",
    }),
    cap({
      id: "observability",
      title: "Evals and observability",
      score: observabilityScore,
      value: `${completedRuns} traces`,
      summary: "Capture traces, evals, issue clusters, cost, latency, human review, and regression checks.",
      nextAction: evalCoverage >= 70 ? "Promote production failures and feedback into regression evals." : "Run launch-grade evals for the active Skill.",
      targetView: evalCoverage >= 70 ? "harness" : "evals",
    }),
    cap({
      id: "adoption",
      title: "Adoption operating model",
      score: adoptionScore,
      value: `${adoptionRate}% adoption`,
      summary: "Manage role-based training, champions, office hours, feedback loops, and change adoption.",
      nextAction: adoptionRate ? "Create targeted interventions for low-adoption teams." : "Launch the first role-based adoption cohort.",
      targetView: "training",
    }),
    cap({
      id: "value-reporting",
      title: "Value and reporting",
      score: valueReportingScore,
      value: formatCurrency(valueTracked),
      summary: "Turn AI activity into daily briefs, ROI proof, finance validation, board summaries, and decision memos.",
      nextAction: valueTracked ? "Generate the stakeholder packet that matches the next decision." : "Attach baseline volume, time saved, adoption, and finance assumptions.",
      targetView: valueTracked ? "reports" : "roi",
    }),
  ];

  const lifecycle: EnterpriseOsLifecycleStage[] = [
    stage({
      id: "discover",
      label: "Discover work",
      readiness: clamp((workSignals.length ? 60 : 0) + (useCases.length ? 25 : 0) + (contextSources.length ? 15 : 0)),
      evidence: compactList([`${workSignals.length} signals`, `${useCases.length} use cases`, `${healthyContextSources} healthy context sources`]),
      nextAction: workSignals.length ? "Promote the top signal into a governed opportunity." : "Capture demand signals from existing work systems.",
      targetView: "work",
    }),
    stage({
      id: "design",
      label: "Design workflow",
      readiness: clamp((useCases.length ? 40 : 0) + (linkedUseCases ? 30 : 0) + (workSignals.length ? 20 : 0) + (activePilots ? 10 : 0)),
      evidence: compactList([`${linkedUseCases} linked to Skills`, `${activePilots} pilot-ready`, `${useCases.length} scored opportunities`]),
      nextAction: "Map current-state and future-state handoffs before increasing autonomy.",
      targetView: "process",
    }),
    stage({
      id: "build",
      label: "Build governed Skill",
      readiness: clamp((skills.length ? 35 : 0) + ratio(governedSkills, Math.max(skills.length, 1)) * 0.45 + (toolDecisionCoverage * 0.2)),
      evidence: compactList([`${skills.length} Skills`, `${governedSkills} governed`, `${decidedToolRequests} tool decisions`]),
      nextAction: governedSkills ? "Harden prompt, tool, context, and autonomy contracts." : "Convert a priority use case into a Skill.",
      targetView: "skills",
    }),
    stage({
      id: "prove",
      label: "Prove quality",
      readiness: clamp((completedRuns ? 32 : 0) + evalCoverage * 0.44 + (approvedReviews ? 24 : 0)),
      evidence: compactList([`${completedRuns} traces`, `${passingEvals} passing evals`, `${approvedReviews} approvals`]),
      nextAction: evalCoverage >= 80 ? "Package proof for launch review." : "Run Harness traces and eval suites.",
      targetView: "harness",
    }),
    stage({
      id: "launch",
      label: "Launch safely",
      readiness: clamp((activePilots ? 30 : 0) + (productionSkills ? 24 : 0) + complianceCoverage * 0.28 + connectorReadiness * 0.18),
      evidence: compactList([`${activePilots} pilots`, `${productionSkills} production Skills`, `${connectorReadiness}% connector readiness`]),
      nextAction: activePilots || productionSkills ? "Confirm launch gates, fallback, and incident playbooks." : "Approve the first pilot scope.",
      targetView: "launch",
    }),
    stage({
      id: "operate",
      label: "Operate and improve",
      readiness: clamp(observabilityScore * 0.45 + adoptionScore * 0.28 + valueReportingScore * 0.27),
      evidence: compactList([`${observabilityScore}% observability`, `${adoptionRate}% adoption`, formatCurrency(valueTracked)]),
      nextAction: "Promote usage patterns, failures, and feedback into evals and roadmap decisions.",
      targetView: "reports",
    }),
  ];

  const protocols: EnterpriseOsProtocolSurface[] = [
    protocol({
      id: "mcp",
      label: "MCP tool access",
      purpose: "Standardize secure tool and data access across models and agents.",
      readiness: clamp(connectorReadiness * 0.55 + toolDecisionCoverage * 0.25 + (auditLogs.length ? 20 : 0)),
      currentSignal: `${connectorReady}/${Math.max(connectorRequired, 1)} connectors ready; ${decidedToolRequests} tool decisions recorded.`,
      nextAction: "Register connector scopes, approval gates, redaction, idempotency, and trace evidence.",
      targetView: "connectors",
    }),
    protocol({
      id: "a2a",
      label: "Agent-to-agent handoffs",
      purpose: "Prepare multi-agent coordination without losing ownership, identity, or auditability.",
      readiness: clamp((skills.length >= 2 ? 35 : 0) + (runs.length ? 20 : 0) + complianceCoverage * 0.25 + (auditLogs.length ? 20 : 0)),
      currentSignal: `${skills.length} Skills and ${runs.length} runtime records available for handoff design.`,
      nextAction: "Define specialist ownership, handoff criteria, shared state, and escalation rules.",
      targetView: "workflow",
    }),
    protocol({
      id: "agents-sdk",
      label: "App-owned orchestration",
      purpose: "Keep state, approvals, tools, and business logic in the platform instead of buried in prompts.",
      readiness: clamp((runs.length ? 25 : 0) + (toolRequests.length ? 20 : 0) + (governanceReviews.length ? 20 : 0) + (skills.length ? 20 : 0) + (auditLogs.length ? 15 : 0)),
      currentSignal: `${runs.length} runs, ${toolRequests.length} tool requests, ${governanceReviews.length} review records.`,
      nextAction: "Make every high-impact action resumable, reviewable, and rollback-safe.",
      targetView: "orchestrator",
    }),
    protocol({
      id: "enterprise-ipaas",
      label: "Enterprise iPaaS / MCP bridge",
      purpose: "Connect existing systems without custom one-off integrations for every model or team.",
      readiness: clamp(connectorReadiness * 0.65 + (providerConfigured ? 20 : 0) + (contextSources.length ? 15 : 0)),
      currentSignal: `${connectorReadiness}% connector readiness and ${contextSources.length} context source records.`,
      nextAction: "Route the first production action through broker policy and capture execution proof.",
      targetView: "broker",
    }),
    protocol({
      id: "observability-otel",
      label: "Open telemetry for agents",
      purpose: "Make traces, tool calls, eval outcomes, cost, latency, and incidents queryable.",
      readiness: observabilityScore,
      currentSignal: `${completedRuns} completed traces and ${evalResults.length} eval results.`,
      nextAction: "Turn failed or low-confidence traces into eval datasets and release gates.",
      targetView: "harness",
    }),
  ];

  const workflowLanes: EnterpriseOsWorkflowLane[] = [
    lane({
      id: "intake",
      label: "Demand sensing",
      readiness: clamp((workSignals.length ? 64 : 0) + (useCases.length ? 26 : 0) + (auditLogs.length ? 10 : 0)),
      evidence: `${workSignals.length} work signals and ${useCases.length} use cases.`,
      nextAction: "Capture repeated friction from systems of work before building agents.",
      targetView: "work",
    }),
    lane({
      id: "process",
      label: "Process redesign",
      readiness: clamp((useCases.length ? 34 : 0) + (workSignals.length ? 24 : 0) + (linkedUseCases ? 22 : 0) + (activePilots ? 20 : 0)),
      evidence: `${linkedUseCases} use cases linked to Skills; ${activePilots} pilots active.`,
      nextAction: "Create the current/future workflow map and human approval boundaries.",
      targetView: "process",
    }),
    lane({
      id: "control",
      label: "Governance control",
      readiness: complianceCoverage,
      evidence: `${governanceReviews.length} reviews, ${approvedReviews} approvals, ${highRiskAssets} high-risk assets.`,
      nextAction: "Generate compliance packs and resolve open review blockers.",
      targetView: "governance",
    }),
    lane({
      id: "run",
      label: "Runtime operations",
      readiness: observabilityScore,
      evidence: `${runs.length} runs, ${toolRequests.length} tool requests, ${evalResults.length} evals.`,
      nextAction: "Create traces, evals, incident paths, and rollback plans for production Skills.",
      targetView: "harness",
    }),
    lane({
      id: "scale",
      label: "Adoption and value",
      readiness: clamp(adoptionScore * 0.45 + valueReportingScore * 0.55),
      evidence: `${adoptionRate}% adoption and ${formatCurrency(valueTracked)} tracked value.`,
      nextAction: "Run stakeholder-specific adoption and ROI reporting loops.",
      targetView: "reports",
    }),
  ];

  const stakeholderTracks: EnterpriseOsStakeholderTrack[] = [
    {
      audience: "Executive sponsor",
      promise: "Know what to fund, pause, scale, or escalate.",
      readiness: valueReportingScore,
      evidence: report.trim() ? "Executive reporting exists." : "No executive packet generated yet.",
      nextAction: "Generate the weekly executive brief and board-ready summary.",
      targetView: "reports",
    },
    {
      audience: "AI Enablement Office",
      promise: "Run the portfolio, unblock owners, and convert proof into scale.",
      readiness: lifecycleScore,
      evidence: `${lifecycle.filter((item) => item.readiness >= 60).length}/${lifecycle.length} lifecycle stages operating.`,
      nextAction: "Work from the lowest-readiness lifecycle stage.",
      targetView: "command",
    },
    {
      audience: "Security, Legal, Privacy",
      promise: "Approve faster because evidence is structured and inspectable.",
      readiness: assuranceScore,
      evidence: `${complianceCoverage}% compliance evidence coverage.`,
      nextAction: "Review high-risk systems and map evidence to compliance packs.",
      targetView: "governance",
    },
    {
      audience: "Builders and developers",
      promise: "Ship agents with versioned prompts, tools, evals, traces, and rollback.",
      readiness: clamp(protocolScore * 0.45 + observabilityScore * 0.55),
      evidence: `${skills.length} Skills, ${runs.length} runs, ${evalResults.length} evals.`,
      nextAction: "Bind every Skill to prompt contracts, tool policy, evals, and trace evidence.",
      targetView: "skills",
    },
    {
      audience: "Business teams",
      promise: "Adopt AI inside real work instead of learning generic prompts.",
      readiness: adoptionScore,
      evidence: `${workSignals.length} work signals and ${adoptionRate}% adoption.`,
      nextAction: "Launch role-based training around the active workflow.",
      targetView: "training",
    },
  ];

  const recommendations: EnterpriseOsRecommendation[] = [];
  if (!aiAssets) {
    recommendations.push({
      id: "first-use-case",
      priority: "critical",
      title: "Create the first governed AI opportunity",
      body: "The OS needs one real business workflow before it can produce meaningful governance, ROI, eval, or reporting evidence.",
      targetView: "factory",
      actionLabel: "Open Use Case Factory",
    });
  }
  if (connectorReadiness < 60 && aiAssets) {
    recommendations.push({
      id: "connector-layer",
      priority: "high",
      title: "Make the enterprise stack connectable",
      body: "Future-proof AI depends on governed system access: identity, knowledge, tickets, documents, approvals, and business apps.",
      targetView: "connectors",
      actionLabel: "Open Connect Apps",
    });
  }
  if (evalCoverage < 70 && skills.length) {
    recommendations.push({
      id: "eval-gates",
      priority: "high",
      title: "Promote evals into release gates",
      body: "Production agents need regression checks based on real traces, not only launch-time review.",
      targetView: "evals",
      actionLabel: "Open Quality Evals",
    });
  }
  if (complianceCoverage < 70 && (skills.length || highRiskAssets)) {
    recommendations.push({
      id: "assurance-crosswalk",
      priority: highRiskAssets ? "critical" : "high",
      title: "Close the compliance evidence crosswalk",
      body: "Map each AI asset to NIST AI RMF, ISO 42001, EU AI Act, OWASP, and internal review evidence.",
      targetView: "governance",
      actionLabel: "Open Risk Review",
    });
  }
  if (adoptionScore < 60 && governedSkills) {
    recommendations.push({
      id: "adoption-loop",
      priority: "medium",
      title: "Add adoption programs around real workflows",
      body: "Major companies need role-based training, champions, feedback, and behavior change tied to the exact workflow.",
      targetView: "training",
      actionLabel: "Open Adoption Plan",
    });
  }
  if (!report.trim()) {
    recommendations.push({
      id: "auto-reporting",
      priority: "medium",
      title: "Turn progress into automatic stakeholder packets",
      body: "Daily digests, weekly executive briefs, ROI flashes, governance summaries, and board packets should be generated from live evidence.",
      targetView: "reports",
      actionLabel: "Open Reports",
    });
  }

  const score = clamp(
    registryScore * 0.14 +
      lifecycleScore * 0.14 +
      workflowCoverage * 0.13 +
      protocolScore * 0.12 +
      assuranceScore * 0.14 +
      observabilityScore * 0.13 +
      adoptionScore * 0.1 +
      valueReportingScore * 0.1,
  );
  const posture = status(score);
  const headline =
    posture === "future-ready"
      ? "Enterprise AI is ready to scale as an operating system"
      : posture === "operating"
        ? "Enterprise AI is operating, with a few scale gaps to close"
        : posture === "forming"
          ? "Enterprise AI has a foundation, but needs stronger operating loops"
          : "Enterprise AI is still fragmented and needs a governed first loop";
  const summary =
    `${aiAssets} AI assets, ${governedSkills} governed Skills, ${workSignals.length} work signals, ${completedRuns} traceable runs, ${evalCoverage}% eval coverage, ${complianceCoverage}% assurance coverage, ${connectorReadiness}% connector readiness, and ${formatCurrency(valueTracked)} tracked value.`;

  return {
    score,
    posture,
    headline,
    summary,
    metrics: {
      aiAssets,
      governedSkills,
      workflowSignals: workSignals.length,
      traceableRuns: completedRuns,
      evalCoverage,
      complianceCoverage,
      connectorReadiness,
      valueTracked,
    },
    capabilities,
    lifecycle,
    protocols,
    workflowLanes,
    stakeholderTracks,
    recommendations: recommendations.slice(0, 6),
  };
}
