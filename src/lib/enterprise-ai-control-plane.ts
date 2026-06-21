import type {
  AuditLog,
  EvalResult,
  GovernanceReview,
  RiskLevel,
  Run,
  Skill,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "./enterprise-ai-data.ts";
import type { View } from "./ui/types.ts";

export type EnterpriseControlTone = "slate" | "green" | "amber" | "red" | "blue" | "purple";
export type EnterpriseControlStatus = "ready" | "operating" | "building" | "gap";

export type EnterpriseControlCapability = {
  id:
    | "system-of-record"
    | "shadow-ai"
    | "operating-model"
    | "permissions"
    | "assurance"
    | "incident-ops"
    | "adoption"
    | "value-proof";
  title: string;
  score: number;
  status: EnterpriseControlStatus;
  tone: EnterpriseControlTone;
  value: string;
  helper: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseControlPlane = {
  score: number;
  posture: "scale-ready" | "controlled" | "forming" | "uncontrolled";
  summary: string;
  capabilities: EnterpriseControlCapability[];
  priorityActions: EnterpriseControlCapability[];
  metrics: {
    governedAssets: number;
    shadowCandidates: number;
    highRiskAssets: number;
    openReviews: number;
    permissionedSkills: number;
    traceableRuns: number;
    complianceCoverage: number;
    incidentReadiness: number;
    valueConfidence: number;
  };
};

export type EnterpriseControlPlaneInput = {
  useCases?: UseCase[];
  skills?: Skill[];
  runs?: Run[];
  governanceReviews?: GovernanceReview[];
  evalResults?: EvalResult[];
  auditLogs?: AuditLog[];
  toolRequests?: ToolRequest[];
  workSignals?: WorkSignal[];
  providerCount?: number;
  providerReadyCount?: number;
  connectorCount?: number;
  connectorReadyCount?: number;
  metrics?: {
    annualValue?: number;
    adoptionRate?: number;
    hoursSaved?: number;
  };
};

export type ControlTowerPillar = {
  id: string;
  title: string;
  body: string;
  evidence: string;
  targetView: View;
};

export type ShadowAiDiscovery = {
  name: string;
  source: string;
  usage: string;
  risk: RiskLevel;
  disposition: "govern" | "integrate" | "replace" | "block";
  nextAction: string;
};

export type AgentPermissionSurface = {
  surface: string;
  control: string;
  evidence: string;
  targetView: View;
  risk: RiskLevel;
};

export type VendorRiskRecord = {
  category: string;
  examples: string;
  control: string;
  evidence: string;
  risk: RiskLevel;
};

export type CompliancePack = {
  name: string;
  purpose: string;
  evidence: string[];
  owner: string;
  targetView: View;
};

export type IncidentPlay = {
  trigger: string;
  contain: string;
  investigate: string;
  restore: string;
  targetView: View;
};

export type AdoptionTrack = {
  audience: string;
  outcome: string;
  enablement: string;
  measure: string;
};

export type WorkflowRedesignPlay = {
  step: string;
  decision: string;
  evidence: string;
  targetView: View;
};

export type FinanceValueControl = {
  control: string;
  evidence: string;
  owner: string;
  targetView: View;
};

export const controlTowerPillars: ControlTowerPillar[] = [
  {
    id: "system-of-record",
    title: "System of record",
    body: "Every AI use case, Skill, provider, connector, owner, risk, and proof artifact is visible in one inventory.",
    evidence: "Inventory records, owner attestations, provider readiness, connector posture, audit evidence.",
    targetView: "admin",
  },
  {
    id: "shadow-ai",
    title: "Shadow AI discovery",
    body: "Unsanctioned AI tools become an intake queue with usage, data exposure, business value, and a disposition decision.",
    evidence: "SSO app catalog, procurement spend, DLP/SIEM alerts, browser telemetry, user-submitted tools.",
    targetView: "work",
  },
  {
    id: "operating-model",
    title: "Operating model",
    body: "Business, IT, security, legal, data, finance, and AI platform teams share clear ownership and escalation paths.",
    evidence: "RACI, review matrix, launch gates, policy exceptions, command orders.",
    targetView: "governance",
  },
  {
    id: "runtime-ops",
    title: "Runtime operations",
    body: "Agents run behind identity, permissions, approvals, evals, tracing, incident response, and kill switches.",
    evidence: "Harness traces, broker decisions, eval results, incidents, rollback proof.",
    targetView: "harness",
  },
  {
    id: "adoption-value",
    title: "Adoption and value",
    body: "Enablement, workflow change, adoption, measured value, and finance sign-off are managed as one loop.",
    evidence: "Cohorts, training completion, run usage, baselines, ROI assumptions, executive reports.",
    targetView: "training",
  },
];

export const shadowAiDiscoveries: ShadowAiDiscovery[] = [
  {
    name: "General-purpose chat assistants",
    source: "Browser and SSO app discovery",
    usage: "Knowledge work, drafting, summarization",
    risk: "medium",
    disposition: "govern",
    nextAction: "Assign tenant policy, data handling rules, approved use cases, and retention controls.",
  },
  {
    name: "Meeting note and transcript bots",
    source: "Calendar, Zoom, Teams, and app consent logs",
    usage: "Meeting capture and follow-up summaries",
    risk: "high",
    disposition: "integrate",
    nextAction: "Review consent, recording notices, transcript storage, and customer-confidential boundaries.",
  },
  {
    name: "No-code AI workflow tools",
    source: "Procurement and OAuth grants",
    usage: "Department automations and app-to-app actions",
    risk: "high",
    disposition: "replace",
    nextAction: "Route high-value workflows through governed connectors, approvals, and trace evidence.",
  },
  {
    name: "Unreviewed browser extensions",
    source: "Endpoint and browser-management telemetry",
    usage: "Page summarization, email drafting, data extraction",
    risk: "restricted",
    disposition: "block",
    nextAction: "Block untrusted extensions that can read sensitive pages or exfiltrate customer data.",
  },
];

export const agentPermissionSurfaces: AgentPermissionSurface[] = [
  {
    surface: "Agent identity",
    control: "Each Skill gets a stable subject, owner, reviewer group, and lifecycle state.",
    evidence: "Owner attestation, version, autonomy tier, last run, kill-switch state.",
    targetView: "harness",
    risk: "medium",
  },
  {
    surface: "Knowledge access",
    control: "Retrieval is permission-aware and source-owner approved before use by a Skill.",
    evidence: "Source classification, retrieval tests, citations, permission simulation.",
    targetView: "context",
    risk: "high",
  },
  {
    surface: "Tool actions",
    control: "Read, write, create, update, delete, and execute scopes pass through broker policy.",
    evidence: "Allowlist, blocked tools, approval request, decision, trace span.",
    targetView: "broker",
    risk: "high",
  },
  {
    surface: "External destinations",
    control: "Email, webhook, file-transfer, and customer-facing outputs use destination allowlists and DLP checks.",
    evidence: "Destination record, reviewer, policy decision, output validation.",
    targetView: "governance",
    risk: "restricted",
  },
  {
    surface: "Runtime rollback",
    control: "High-impact Skills need pause, disable, rollback, and incident handoff paths.",
    evidence: "Kill switch, launch manifest, incident playbook, recovery note.",
    targetView: "launch",
    risk: "medium",
  },
];

export const vendorRiskRecords: VendorRiskRecord[] = [
  {
    category: "Frontier model providers",
    examples: "Frontier, private, and region-hosted model endpoints",
    control: "Provider key vaulting, model routing policy, data retention terms, regional availability, spend ceilings.",
    evidence: "Provider readiness, model route, cost budget, fallback model, contract notes.",
    risk: "medium",
  },
  {
    category: "Enterprise copilots",
    examples: "Productivity copilots, CRM copilots, ITSM agents, and embedded app assistants",
    control: "Tenant permissions, app-specific admin policy, least-privilege data access, usage exports.",
    evidence: "SSO app catalog, tenant settings, approved cohorts, adoption telemetry.",
    risk: "high",
  },
  {
    category: "Search and context platforms",
    examples: "Enterprise search, vector databases, retrieval services, and knowledge graph systems",
    control: "Source ownership, indexing health, permission sync, stale-content SLAs, citation checks.",
    evidence: "Context source catalog, retrieval tests, source classification, sync logs.",
    risk: "high",
  },
  {
    category: "Automation and agent runners",
    examples: "iPaaS platforms, workflow automation, RPA, and persistent worker runtimes",
    control: "Bounded execution, human approval, dry-runs, idempotency keys, rollback paths.",
    evidence: "Workflow spec, tool request ledger, test run, approval and rollback evidence.",
    risk: "restricted",
  },
];

export const compliancePacks: CompliancePack[] = [
  {
    name: "NIST AI RMF",
    purpose: "Map, measure, manage, and govern AI risks with practical launch evidence.",
    evidence: ["Risk taxonomy", "Evaluation results", "Human oversight", "Monitoring plan"],
    owner: "Risk and AI governance",
    targetView: "governance",
  },
  {
    name: "ISO/IEC 42001",
    purpose: "Operate an AI management system with roles, policies, controls, review cadence, and improvement loops.",
    evidence: ["AI asset inventory", "Accountability matrix", "Policy exceptions", "Audit trail"],
    owner: "Compliance",
    targetView: "governance",
  },
  {
    name: "EU AI Act readiness",
    purpose: "Classify high-risk systems, prove oversight, capture technical documentation, and maintain post-market monitoring.",
    evidence: ["Risk classification", "Data governance notes", "Technical file", "Incident response"],
    owner: "Legal and privacy",
    targetView: "governance",
  },
  {
    name: "Board and audit packet",
    purpose: "Give executives and auditors one clean packet for what AI exists, how it is controlled, and what value it creates.",
    evidence: ["Use case", "Skill spec", "Trace", "Eval", "Approval", "ROI story"],
    owner: "AI Enablement Office",
    targetView: "evidence",
  },
];

export const incidentResponsePlays: IncidentPlay[] = [
  {
    trigger: "Prompt injection or jailbreak signal",
    contain: "Pause affected Skill, block untrusted context, and snapshot the run trace.",
    investigate: "Compare retrieved content, prompt contract, output validation, and recent changes.",
    restore: "Patch prompt/context boundary, rerun adversarial evals, and attach the closure note.",
    targetView: "harness",
  },
  {
    trigger: "Unexpected external egress",
    contain: "Block destination, disable write tools, and notify Security/DLP owner.",
    investigate: "Correlate tool request, user identity, destination, approval decision, and network telemetry.",
    restore: "Update destination allowlist, broker policy, and rollback evidence before reenabling.",
    targetView: "broker",
  },
  {
    trigger: "Quality or hallucination regression",
    contain: "Hold launch expansion and route impacted outputs to human review.",
    investigate: "Check eval drift, source freshness, model route, and failed user feedback examples.",
    restore: "Update eval suite, source set, and Skill version before returning to pilot.",
    targetView: "evals",
  },
  {
    trigger: "Model or vendor outage",
    contain: "Route through approved fallback model or disable affected Skills.",
    investigate: "Review provider status, latency, cost, failure rates, and customer-facing impact.",
    restore: "Record fallback decision and update provider readiness after recovery.",
    targetView: "admin",
  },
];

export const adoptionEnablementTracks: AdoptionTrack[] = [
  {
    audience: "Executives",
    outcome: "Portfolio confidence and decision cadence",
    enablement: "Monthly transformation brief, risk posture, value proof, dependency decisions.",
    measure: "Decisions made, blockers cleared, investment confidence.",
  },
  {
    audience: "Managers",
    outcome: "Workflow redesign and team adoption",
    enablement: "Use-case selection, process baselines, rollout cohorts, manager playbooks.",
    measure: "Approved use cases, cycle-time improvement, cohort activation.",
  },
  {
    audience: "Operators",
    outcome: "Trusted weekly usage",
    enablement: "Skill-specific training, office hours, examples, escalation paths.",
    measure: "Active users, repeat runs, feedback, quality issues.",
  },
  {
    audience: "Builders",
    outcome: "Reusable governed Skills",
    enablement: "Prompt contracts, workflow design, tool policy, evals, evidence packets.",
    measure: "Skills published, proof completeness, reuse rate.",
  },
  {
    audience: "Reviewers",
    outcome: "Fast and defensible approvals",
    enablement: "Risk taxonomy, compliance packs, approval matrix, incident drills.",
    measure: "Review cycle time, blocker quality, approval evidence.",
  },
];

export const workflowRedesignPlays: WorkflowRedesignPlay[] = [
  {
    step: "Baseline the work",
    decision: "Is this a better process, a better assistant, or a full agent workflow?",
    evidence: "Work signals, volume, cycle time, current-state map, owner.",
    targetView: "work",
  },
  {
    step: "Choose the autonomy tier",
    decision: "Should AI draft, retrieve, prepare actions, execute bounded actions, or stay restricted?",
    evidence: "Risk level, data classification, tool actions, human-impact review.",
    targetView: "skills",
  },
  {
    step: "Redesign handoffs",
    decision: "Where should humans approve, correct, escalate, or take ownership?",
    evidence: "Workflow spec, approval waits, exception rules, rollback owner.",
    targetView: "workflow",
  },
  {
    step: "Instrument the loop",
    decision: "What telemetry proves quality, safety, adoption, and value?",
    evidence: "Harness trace, evals, feedback, adoption, cost, latency, ROI baseline.",
    targetView: "harness",
  },
];

export const financeValueControls: FinanceValueControl[] = [
  {
    control: "Baseline before launch",
    evidence: "Current volume, handling time, error rate, labor rate, and expected adoption.",
    owner: "Business owner and Finance partner",
    targetView: "factory",
  },
  {
    control: "Telemetry replaces assumptions",
    evidence: "Runs, active users, task completion, cycle-time change, quality misses, cost.",
    owner: "AI product owner",
    targetView: "roi",
  },
  {
    control: "Quality-adjusted value",
    evidence: "Only count realized value where evals, reviews, and human oversight are acceptable.",
    owner: "Risk reviewer and Finance partner",
    targetView: "governance",
  },
  {
    control: "Executive value story",
    evidence: "Modeled forecast, measured impact, remaining gap, risks, next scale ask.",
    owner: "AI Enablement Office",
    targetView: "reports",
  },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readiness(ready: number, total: number) {
  if (!total) return 0;
  return clamp((ready / total) * 100);
}

function statusFromScore(score: number): EnterpriseControlStatus {
  if (score >= 82) return "ready";
  if (score >= 62) return "operating";
  if (score >= 34) return "building";
  return "gap";
}

function toneFromScore(score: number): EnterpriseControlTone {
  if (score >= 82) return "green";
  if (score >= 62) return "blue";
  if (score >= 34) return "amber";
  return "red";
}

function countText(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isHighRisk(risk: RiskLevel) {
  return risk === "high" || risk === "restricted";
}

function capability(params: Omit<EnterpriseControlCapability, "score" | "status" | "tone"> & { score: number }): EnterpriseControlCapability {
  const score = clamp(params.score);
  return {
    ...params,
    score,
    status: statusFromScore(score),
    tone: toneFromScore(score),
  };
}

export function deriveEnterpriseAiControlPlane(input: EnterpriseControlPlaneInput = {}): EnterpriseControlPlane {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const reviews = input.governanceReviews ?? [];
  const evals = input.evalResults ?? [];
  const auditLogs = input.auditLogs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const workSignals = input.workSignals ?? [];
  const providerCount = input.providerCount ?? 0;
  const providerReadyCount = input.providerReadyCount ?? 0;
  const connectorCount = input.connectorCount ?? 0;
  const connectorReadyCount = input.connectorReadyCount ?? 0;
  const annualValue = input.metrics?.annualValue ?? skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);
  const adoptionRate = input.metrics?.adoptionRate ?? 0;

  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const governedAssets = useCases.length + skills.length;
  const ownedAssets = [...useCases, ...skills].filter((asset) => Boolean(asset.ownerId)).length;
  const highRiskAssets = [...useCases, ...skills].filter((asset) => isHighRisk(asset.riskLevel)).length;
  const openReviews = reviews.filter((review) => ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0).length;
  const approvedReviews = reviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status)).length;
  const permissionedSkills = skills.filter((skill) => skill.allowedTools.length || skill.blockedTools.length || skill.contextSources.length).length;
  const decidedToolRequests = toolRequests.filter((request) => ["approved", "rejected", "blocked"].includes(request.status)).length;
  const traceableRuns = runs.filter((run) => run.trace.length >= 4).length;
  const passingEvals = evals.filter((result) => result.passed && result.criticalFailures === 0).length;
  const adoptionSignals = skills.filter((skill) => skill.adoptionCount > 0 || skill.runs > 0).length;
  const valueSkills = skills.filter((skill) => skill.valueDelivered > 0).length;
  const shadowLogSignals = auditLogs.filter((log) => /shadow ai|unsanctioned|unmanaged|unknown agent/i.test(`${log.eventType} ${log.message}`)).length;
  const shadowWorkSignals = workSignals.filter((signal) =>
    /ai|copilot|chatgpt|assistant|agent/i.test(`${signal.summary} ${signal.metadata.system ?? ""}`),
  ).length;
  const shadowCandidates = Math.max(shadowLogSignals + shadowWorkSignals, shadowAiDiscoveries.length);
  const providerScore = providerCount ? readiness(providerReadyCount, providerCount) : governedAssets ? 35 : 0;
  const connectorScore = connectorCount ? readiness(connectorReadyCount, connectorCount) : governedAssets ? 35 : 0;
  const ownerScore = readiness(ownedAssets, Math.max(governedAssets, 1));
  const inventoryScore = clamp(
    (governedAssets ? 22 : 0) +
    ownerScore * 0.28 +
    providerScore * 0.2 +
    connectorScore * 0.2 +
    (auditLogs.length ? 10 : 0) +
    (governedSkills.length ? 20 : 0),
  );
  const operatingModelScore = clamp(
    (useCases.length ? 18 : 0) +
    (skills.length ? 18 : 0) +
    (runs.length ? 16 : 0) +
    (reviews.length ? 18 : 0) +
    (evals.length ? 14 : 0) +
    (annualValue > 0 ? 16 : 0),
  );
  const permissionScore = clamp(
    readiness(permissionedSkills, Math.max(skills.length, 1)) * 0.4 +
    readiness(decidedToolRequests, Math.max(toolRequests.length, 1)) * 0.22 +
    connectorScore * 0.18 +
    (skills.some((skill) => skill.blockedTools.length) ? 10 : 0) +
    (traceableRuns ? 10 : 0),
  );
  const complianceCoverage = clamp(
    (reviews.length ? 22 : 0) +
    (approvedReviews ? 18 : 0) +
    (evals.length ? 18 : 0) +
    (passingEvals ? 12 : 0) +
    (auditLogs.length ? 16 : 0) +
    (highRiskAssets === 0 || reviews.length ? 14 : 0),
  );
  const incidentReadiness = clamp(
    (traceableRuns ? 22 : 0) +
    (toolRequests.length ? 16 : 0) +
    (auditLogs.length ? 18 : 0) +
    (evals.length ? 14 : 0) +
    (skills.some((skill) => ["deprecated", "archived"].includes(skill.status) || skill.autonomyTier === "tier_5_restricted") ? 10 : 0) +
    (reviews.length ? 20 : 0),
  );
  const adoptionScore = clamp(
    (governedSkills.length ? 22 : 0) +
    (adoptionSignals ? 28 : 0) +
    Math.min(24, adoptionRate / 3) +
    (workSignals.some((signal) => ["training_completed", "feedback_given", "skill_used"].includes(signal.eventType)) ? 14 : 0) +
    (annualValue > 0 ? 12 : 0),
  );
  const valueConfidence = clamp(
    (useCases.some((useCase) => useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0) ? 22 : 0) +
    (runs.length ? 18 : 0) +
    (valueSkills ? 22 : 0) +
    (annualValue > 0 ? 18 : 0) +
    (passingEvals ? 10 : 0) +
    (approvedReviews ? 10 : 0),
  );

  const capabilities: EnterpriseControlCapability[] = [
    capability({
      id: "system-of-record",
      title: "AI system of record",
      score: inventoryScore,
      value: countText(governedAssets, "asset"),
      helper: `${providerReadyCount}/${Math.max(providerCount, 1)} providers and ${connectorReadyCount}/${Math.max(connectorCount, 1)} connector surfaces are ready.`,
      nextAction: "Unify app catalog, procurement, provider vault, connector readiness, and AI inventory records.",
      targetView: "admin",
    }),
    capability({
      id: "shadow-ai",
      title: "Shadow AI intake",
      score: shadowCandidates ? Math.max(38, inventoryScore - 12) : 10,
      value: countText(shadowCandidates, "candidate"),
      helper: "Classify unsanctioned tools into govern, integrate, replace, or block decisions.",
      nextAction: "Connect SSO, procurement, browser, endpoint, and DLP signals to the intake queue.",
      targetView: "work",
    }),
    capability({
      id: "operating-model",
      title: "Operating model",
      score: operatingModelScore,
      value: `${openReviews} open review${openReviews === 1 ? "" : "s"}`,
      helper: "Use cases, Skills, traces, evals, review decisions, and ROI must move through one managed loop.",
      nextAction: "Publish RACI, approval matrix, escalation rules, and command cadence for the AI enablement office.",
      targetView: "governance",
    }),
    capability({
      id: "permissions",
      title: "Agent permission graph",
      score: permissionScore,
      value: `${permissionedSkills}/${Math.max(skills.length, 1)} Skills`,
      helper: "Tie agent identity to knowledge, tools, destinations, approvals, and rollback controls.",
      nextAction: "Bind every Skill to least-privilege context and tool scopes before increasing autonomy.",
      targetView: "broker",
    }),
    capability({
      id: "assurance",
      title: "Compliance assurance",
      score: complianceCoverage,
      value: `${complianceCoverage}/100 readiness`,
      helper: "NIST AI RMF, ISO 42001, EU AI Act readiness, and board audit packets need the same evidence chain.",
      nextAction: "Attach risk classification, evals, approvals, trace, monitoring, and value proof to each launch packet.",
      targetView: "governance",
    }),
    capability({
      id: "incident-ops",
      title: "AI incident response",
      score: incidentReadiness,
      value: `${traceableRuns} traceable run${traceableRuns === 1 ? "" : "s"}`,
      helper: "Prompt injection, egress, quality drift, and provider outages need containment and recovery playbooks.",
      nextAction: "Create incident triggers, owner routing, kill switches, audit exports, and recovery evidence.",
      targetView: "harness",
    }),
    capability({
      id: "adoption",
      title: "AI literacy and adoption",
      score: adoptionScore,
      value: adoptionRate ? `${adoptionRate}% adoption` : countText(adoptionSignals, "active Skill"),
      helper: "Major-company rollouts need executives, managers, operators, builders, and reviewers enabled differently.",
      nextAction: "Run cohort-based enablement tied to real Skills, workflow moments, and feedback loops.",
      targetView: "training",
    }),
    capability({
      id: "value-proof",
      title: "Finance-grade value proof",
      score: valueConfidence,
      value: annualValue ? money(annualValue) : "No value proof",
      helper: "Modeled assumptions must be replaced by run telemetry, adoption, quality, and finance sign-off.",
      nextAction: "Package baseline, measured impact, quality conditions, remaining gap, and next scale ask.",
      targetView: "roi",
    }),
  ];

  const score = clamp(capabilities.reduce((sum, item) => sum + item.score, 0) / capabilities.length);
  const posture: EnterpriseControlPlane["posture"] =
    score >= 82 ? "scale-ready" : score >= 62 ? "controlled" : score >= 34 ? "forming" : "uncontrolled";

  return {
    score,
    posture,
    summary:
      posture === "scale-ready"
        ? "The enterprise AI operating loop has inventory, runtime controls, assurance evidence, adoption, and value proof ready for scale."
        : posture === "controlled"
          ? "The core AI operating loop is in place; focus on the lowest-scoring controls before broad rollout."
          : posture === "forming"
            ? "The workspace has early assets and proof, but still needs stronger ownership, permissions, compliance, and value controls."
            : "The company needs a visible AI system of record before expanding usage.",
    capabilities,
    priorityActions: [...capabilities].sort((a, b) => a.score - b.score).slice(0, 4),
    metrics: {
      governedAssets,
      shadowCandidates,
      highRiskAssets,
      openReviews,
      permissionedSkills,
      traceableRuns,
      complianceCoverage,
      incidentReadiness,
      valueConfidence,
    },
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value);
}
