import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  Tool,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { ProductionReadiness, View } from "@/lib/ui/types";

export type EnterpriseMaturityStatus = "elite" | "strong" | "building" | "gap";

export type EnterpriseMaturityPillarId =
  | "strategy-roadmap"
  | "opportunity-factory"
  | "skill-industrialization"
  | "harness-runtime"
  | "connector-security"
  | "context-governance"
  | "eval-red-team"
  | "evidence-compliance"
  | "adoption-value"
  | "production-ops";

export type EnterpriseMaturityPillar = {
  id: EnterpriseMaturityPillarId;
  name: string;
  standard: string;
  score: number;
  status: EnterpriseMaturityStatus;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type EnterpriseMaturity = {
  score: number;
  status: EnterpriseMaturityStatus;
  summary: string;
  pillars: EnterpriseMaturityPillar[];
  highestLeveragePillar: EnterpriseMaturityPillar;
  eliteCount: number;
  gapCount: number;
};

export type EnterpriseMaturityInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  workSignals: WorkSignal[];
  tools: Tool[];
  contextSources: ContextSource[];
  report: string;
  metrics: {
    annualValue: number;
    adoptionRate: number;
    hoursSaved: number;
  };
  workflow: {
    nodeCount: number;
    status: "Saved" | "Testing" | "Published";
    valid: boolean;
    issues: number;
    warnings: number;
  };
  productionReadiness?: ProductionReadiness | null;
};

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusFromScore(score: number): EnterpriseMaturityStatus {
  if (score >= 85) return "elite";
  if (score >= 68) return "strong";
  if (score >= 42) return "building";
  return "gap";
}

function pillar(params: Omit<EnterpriseMaturityPillar, "score" | "status"> & { score: number }): EnterpriseMaturityPillar {
  const score = clamp(params.score);

  return {
    ...params,
    score,
    status: statusFromScore(score),
  };
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function deriveEnterpriseMaturity(input: EnterpriseMaturityInput): EnterpriseMaturity {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const auditLogs = input.auditLogs ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const evalResults = input.evalResults ?? [];
  const workSignals = input.workSignals ?? [];
  const tools = input.tools ?? [];
  const contextSources = input.contextSources ?? [];
  const readiness = input.productionReadiness ?? null;

  const scoredUseCases = useCases.filter((item) => item.priorityScore > 0);
  const convertedUseCases = useCases.filter((item) => item.linkedSkillId);
  const activeDepartments = new Set(useCases.map((item) => item.department)).size;
  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const productionSkills = skills.filter((skill) => ["pilot", "production"].includes(skill.status));
  const skillsWithPromptContracts = skills.filter((skill) => skill.systemPrompt.length > 80);
  const skillsWithContext = skills.filter((skill) => skill.contextSources.length > 0);
  const skillsWithTools = skills.filter((skill) => skill.allowedTools.length > 0);
  const skillsWithValue = skills.filter((skill) => skill.valueDelivered > 0 || skill.adoptionCount > 0);
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const runsWithCostAndLatency = runs.filter((run) => run.costUsd > 0 && run.latencyMs > 0);
  const policyTraceRuns = runs.filter((run) =>
    run.trace.some((step) => /policy|permission|approval|guardrail|validation|safety/i.test(`${step.label} ${step.detail}`)),
  );
  const pendingOrDecidedToolRequests = toolRequests.filter((request) =>
    ["pending", "approved", "rejected", "blocked"].includes(request.status),
  );
  const blockedToolRequests = toolRequests.filter((request) => ["rejected", "blocked"].includes(request.status));
  const highRiskToolRequests = toolRequests.filter((request) => ["high", "restricted"].includes(request.riskLevel));
  const approvedSources = contextSources.filter((source) => source.enabled && source.health !== "stale");
  const sensitiveSources = contextSources.filter((source) => ["confidential", "restricted", "regulated"].includes(source.classification));
  const passingEvals = evalResults.filter((result) => result.passed && result.score >= 90 && result.criticalFailures === 0);
  const criticalEvalFailures = evalResults.filter((result) => result.criticalFailures > 0);
  const reviewsWithBlockers = governanceReviews.filter((review) => review.blockers.length > 0 || ["changes_requested", "in_review"].includes(review.status));
  const highRiskUseCases = useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel));
  const approvedReviews = governanceReviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status));
  const safeWorkSignals = workSignals.filter(
    (signal) =>
      signal.privacy?.contentRedacted &&
      signal.privacy?.piiRedacted &&
      !signal.privacy.rawContentStored &&
      !signal.privacy.individualScoringAllowed,
  );
  const readinessChecks = [...(readiness?.blockers ?? []), ...(readiness?.warnings ?? [])];
  const readinessPasses = readiness?.status === "ready" ? 100 : readiness?.status === "degraded" ? 62 : readiness?.status === "blocked" ? 22 : 36;

  const pillars: EnterpriseMaturityPillar[] = [
    pillar({
      id: "strategy-roadmap",
      name: "Strategy to roadmap",
      standard: "Executive objectives, quarterly themes, dependencies, and operating cadence",
      score:
        (useCases.length ? 18 : 0) +
        (activeDepartments >= 3 ? 20 : activeDepartments ? 10 : 0) +
        (workSignals.length ? 18 : 0) +
        (input.report ? 18 : 0) +
        (input.metrics.annualValue > 0 ? 14 : 0) +
        (governanceReviews.length ? 12 : 0),
      evidence: `${plural(useCases.length, "opportunity", "opportunities")} across ${activeDepartments || 0} function${activeDepartments === 1 ? "" : "s"} with ${plural(workSignals.length, "work signal")}.`,
      nextAction: "Add explicit quarterly strategy themes, dependency owners, and executive decision records for every portfolio lane.",
      targetView: "strategy",
    }),
    pillar({
      id: "opportunity-factory",
      name: "Opportunity factory",
      standard: "Intake, discovery, scoring, risk classification, and reusable pattern selection",
      score:
        (scoredUseCases.length ? 25 : 0) +
        (useCases.some((item) => item.dataReadinessScore > 0) ? 15 : 0) +
        (useCases.some((item) => item.risks.length > 0) ? 15 : 0) +
        (convertedUseCases.length ? 25 : 0) +
        (useCases.some((item) => ["governance_review", "approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(item.status)) ? 20 : 0),
      evidence: `${plural(scoredUseCases.length, "scored opportunity", "scored opportunities")} and ${plural(convertedUseCases.length, "conversion")} into governed Skills.`,
      nextAction: "Require discovery briefs, process baselines, and automation-vs-augmentation decisions before promotion to Skill design.",
      targetView: "factory",
    }),
    pillar({
      id: "skill-industrialization",
      name: "Skill industrialization",
      standard: "Versioned Skill packages with prompts, model routing, context, tools, owners, evals, value, and rollback",
      score:
        (governedSkills.length ? 20 : 0) +
        (productionSkills.length ? 18 : 0) +
        (skillsWithPromptContracts.length ? 14 : 0) +
        (skillsWithContext.length ? 14 : 0) +
        (skillsWithTools.length ? 14 : 0) +
        (skills.some((skill) => skill.evalPassRate >= 90) ? 12 : 0) +
        (skillsWithValue.length ? 8 : 0),
      evidence: `${plural(governedSkills.length, "governed Skill")} with ${plural(skillsWithTools.length, "tool policy", "tool policies")} and ${plural(skillsWithContext.length, "context binding")}.`,
      nextAction: "Add signed Skill packages, environment promotion, rollback proof, and regression gates for every version.",
      targetView: "skills",
    }),
    pillar({
      id: "harness-runtime",
      name: "Harness runtime",
      standard: "Durable agent execution with identity, context, policy, model, tools, approvals, validation, traces, cost, and replay",
      score:
        (runs.length ? 15 : 0) +
        (traceableRuns.length ? 22 : 0) +
        (policyTraceRuns.length ? 18 : 0) +
        (runsWithCostAndLatency.length ? 15 : 0) +
        (toolRequests.some((request) => request.status === "pending") ? 10 : 0) +
        (auditLogs.length ? 12 : 0) +
        (input.workflow.nodeCount && input.workflow.valid ? 8 : 0),
      evidence: `${plural(traceableRuns.length, "traceable run")} with ${plural(policyTraceRuns.length, "policy-aware execution")} and ${plural(auditLogs.length, "audit event")}.`,
      nextAction: "Persist resumable checkpoints and export OpenTelemetry GenAI spans for every node, tool call, model call, approval, and validation gate.",
      targetView: "harness",
    }),
    pillar({
      id: "connector-security",
      name: "Connector and MCP security",
      standard: "OAuth-scoped connectors, schema discovery, sandbox dry-runs, policy decisions, approvals, and kill switches",
      score:
        (tools.length ? 14 : 0) +
        (skillsWithTools.length ? 18 : 0) +
        (pendingOrDecidedToolRequests.length ? 24 : 0) +
        (blockedToolRequests.length ? 14 : 0) +
        (highRiskToolRequests.length ? 10 : 0) +
        (skills.some((skill) => skill.blockedTools.length > 0) ? 12 : 0) +
        (readiness?.connectors?.configured ? 8 : 0),
      evidence: `${plural(tools.length, "connector")} cataloged, ${plural(pendingOrDecidedToolRequests.length, "broker decision")} recorded, ${plural(blockedToolRequests.length, "blocked action")} proven.`,
      nextAction: "Add MCP OAuth audience binding, scope diffing, connector trust scores, and per-tool pre/post guardrail evidence.",
      targetView: "broker",
    }),
    pillar({
      id: "context-governance",
      name: "Context and data governance",
      standard: "Permission-aware retrieval, data classification, source health, citations, indexing, and data-owner approval",
      score:
        (contextSources.length ? 18 : 0) +
        (approvedSources.length ? 22 : 0) +
        (sensitiveSources.length ? 12 : 0) +
        (skillsWithContext.length ? 18 : 0) +
        (runs.some((run) => run.trace.some((step) => /context|retrieval|source/i.test(`${step.label} ${step.detail}`))) ? 18 : 0) +
        (workSignals.some((signal) => signal.eventType === "context_gap") ? 12 : 0),
      evidence: `${plural(approvedSources.length, "healthy source")} from ${plural(contextSources.length, "catalog source")} with ${plural(sensitiveSources.length, "sensitive classification")}.`,
      nextAction: "Add source-owner approval workflows, retrieval quality tests, citation verification, stale-source SLAs, and permission simulation diffs.",
      targetView: "context",
    }),
    pillar({
      id: "eval-red-team",
      name: "Evaluation and red team",
      standard: "Regression, grounding, permission, prompt-injection, tool-safety, cost, latency, and quality gates",
      score:
        (evalResults.length ? 20 : 0) +
        (passingEvals.length ? 28 : 0) +
        (criticalEvalFailures.length === 0 && evalResults.length ? 12 : 0) +
        (skills.some((skill) => skill.evalPassRate >= 90) ? 20 : 0) +
        (runs.some((run) => run.trace.some((step) => /eval|validation|safety|grounding/i.test(`${step.label} ${step.detail}`))) ? 20 : 0),
      evidence: `${plural(evalResults.length, "eval artifact")} with ${plural(passingEvals.length, "launch-grade pass", "launch-grade passes")} and ${plural(criticalEvalFailures.length, "critical failure")}.`,
      nextAction: "Attach eval suites to every Skill version and run adversarial, permission, grounding, cost, latency, and regression checks before publish.",
      targetView: "evals",
    }),
    pillar({
      id: "evidence-compliance",
      name: "Evidence and compliance",
      standard: "Mapped evidence packets for NIST AI RMF, ISO 42001, EU AI Act, OWASP LLM/MCP, approvals, exceptions, and incidents",
      score:
        (governanceReviews.length ? 20 : 0) +
        (approvedReviews.length ? 18 : 0) +
        (auditLogs.length ? 18 : 0) +
        (evalResults.length ? 14 : 0) +
        (runs.length ? 12 : 0) +
        (highRiskUseCases.length ? 8 : 0) +
        (reviewsWithBlockers.length === 0 && governanceReviews.length ? 10 : 0),
      evidence: `${plural(governanceReviews.length, "review")} and ${plural(auditLogs.length, "audit event")} can feed control packets; ${plural(reviewsWithBlockers.length, "review blocker")} remain.`,
      nextAction: "Generate signed evidence packets with control owner, risk rationale, eval proof, runtime trace, approval history, and remediation status.",
      targetView: "evidence",
    }),
    pillar({
      id: "adoption-value",
      name: "Adoption and value proof",
      standard: "AI literacy, champions, usage funnels, stakeholder sentiment, baseline-vs-actual ROI, and CFO-ready assumptions",
      score:
        (input.metrics.adoptionRate > 0 ? 20 : 0) +
        (input.metrics.hoursSaved > 0 ? 20 : 0) +
        (input.metrics.annualValue > 0 ? 24 : 0) +
        (safeWorkSignals.length ? 14 : 0) +
        (skillsWithValue.length ? 12 : 0) +
        (input.report ? 10 : 0),
      evidence: `${input.metrics.adoptionRate}% adoption, ${input.metrics.hoursSaved.toLocaleString()} modeled hours saved, ${plural(safeWorkSignals.length, "privacy-safe signal")}.`,
      nextAction: "Move from modeled value to baseline-vs-actual value by cohort, Skill version, function, and confidence band.",
      targetView: "roi",
    }),
    pillar({
      id: "production-ops",
      name: "Production operations",
      standard: "SSO/RBAC, durable persistence, provider vault, workflow engine, connector broker, CI gates, runbooks, and incident response",
      score:
        Math.round(readinessPasses * 0.6) +
        (readiness?.database?.durable ? 10 : 0) +
        (readiness?.auth?.authRequired ? 8 : 0) +
        (readiness?.auth?.oidcConfigured ? 8 : 0) +
        (readiness?.connectors?.configured ? 7 : 0) +
        (readiness?.workflows?.configured ? 7 : 0),
      evidence: readiness
        ? `${readiness.status ?? "unchecked"} server readiness with ${plural(readinessChecks.length, "open operations item")}.`
        : "Production readiness has not been checked in this session.",
      nextAction: "Close production blockers, wire CI/e2e gates to deployment, and add incident response playbooks for model, connector, retrieval, and policy failures.",
      targetView: "admin",
    }),
  ];

  const score = clamp(pillars.reduce((sum, item) => sum + item.score, 0) / pillars.length);
  const sorted = [...pillars].sort((a, b) => a.score - b.score);
  const eliteCount = pillars.filter((item) => item.status === "elite").length;
  const strongCount = pillars.filter((item) => item.status === "strong").length;
  const gapCount = pillars.filter((item) => item.status === "gap").length;

  return {
    score,
    status: statusFromScore(score),
    summary: `${eliteCount} elite and ${strongCount} strong pillar${strongCount === 1 ? "" : "s"} across the enterprise AI operating model.`,
    pillars,
    highestLeveragePillar: sorted[0],
    eliteCount,
    gapCount,
  };
}
