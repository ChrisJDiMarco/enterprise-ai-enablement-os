import type { AuditLog, EvalResult, GovernanceReview, Run, Skill, ToolRequest, UseCase } from "@/lib/enterprise-ai-data";

export type MarketBenchmarkStatus = "leading" | "competitive" | "developing" | "gap";

export type MarketBenchmarkPattern = {
  id:
    | "control-tower"
    | "agent-observability"
    | "governed-builder"
    | "connector-sandbox"
    | "adoption-value"
    | "evidence-automation";
  name: string;
  marketSignal: string;
  sourceExamples: string[];
  score: number;
  status: MarketBenchmarkStatus;
  evidence: string;
  nextAction: string;
};

export type MarketBenchmark = {
  score: number;
  status: MarketBenchmarkStatus;
  summary: string;
  patterns: MarketBenchmarkPattern[];
  highestLeverageGap: MarketBenchmarkPattern;
};

export type MarketBenchmarkInput = {
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  metrics: {
    adoptionRate: number;
    hoursSaved: number;
    annualValue: number;
  };
  workflowNodeCount: number;
  workflowStatus: "Saved" | "Testing" | "Published";
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusFromScore(score: number): MarketBenchmarkStatus {
  if (score >= 85) return "leading";
  if (score >= 65) return "competitive";
  if (score >= 40) return "developing";
  return "gap";
}

function pattern(params: Omit<MarketBenchmarkPattern, "status" | "score"> & { score: number }): MarketBenchmarkPattern {
  const score = clampScore(params.score);
  return {
    ...params,
    score,
    status: statusFromScore(score),
  };
}

export function deriveMarketBenchmark(input: MarketBenchmarkInput): MarketBenchmark {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const evalResults = input.evalResults ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const auditLogs = input.auditLogs ?? [];

  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const skillsWithTools = skills.filter((skill) => skill.allowedTools.length > 0);
  const skillsWithContext = skills.filter((skill) => skill.contextSources.length > 0);
  const highQualityEvals = evalResults.filter((result) => result.passed && result.score >= 90);
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const runsWithCostAndLatency = runs.filter((run) => run.costUsd > 0 && run.latencyMs > 0);
  const blockedOrPendingReviews = governanceReviews.filter(
    (review) => ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  );
  const brokerDecisions = toolRequests.filter((request) =>
    ["pending", "approved", "rejected", "blocked"].includes(request.status),
  );
  const actionablePortfolio = useCases.filter((item) =>
    ["scored", "governance_review", "approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(item.status),
  );
  const hasValueProof = input.metrics.annualValue > 0 || input.metrics.hoursSaved > 0;

  const patterns: MarketBenchmarkPattern[] = [
    pattern({
      id: "control-tower",
      name: "AI operating control plane",
      marketSignal: "The market is moving toward one place to inventory agents, models, workflows, risks, owners, and value.",
      sourceExamples: ["Agent inventory platforms", "Enterprise observability suites"],
      score:
        (useCases.length ? 16 : 0) +
        (skills.length ? 18 : 0) +
        (governanceReviews.length ? 18 : 0) +
        (runs.length ? 18 : 0) +
        (auditLogs.length ? 15 : 0) +
        (hasValueProof ? 15 : 0),
      evidence: `${useCases.length} opportunities, ${skills.length} Skills, ${runs.length} traceable runs, and ${governanceReviews.length} reviews are visible in one workspace.`,
      nextAction: "Add automated discovery for external AI assets, models, MCP servers, and shadow agents so the OS can govern what it did not create.",
    }),
    pattern({
      id: "agent-observability",
      name: "Agent observability",
      marketSignal: "Best-in-class agent platforms expose traces, tool calls, evals, latency, cost, and failure modes as first-class objects.",
      sourceExamples: ["LLM tracing platforms", "Open-source eval stacks"],
      score:
        (traceableRuns.length ? 30 : runs.length ? 15 : 0) +
        (runsWithCostAndLatency.length ? 20 : 0) +
        (highQualityEvals.length ? 25 : evalResults.length ? 12 : 0) +
        (auditLogs.length ? 15 : 0) +
        (blockedOrPendingReviews.length ? 10 : 0),
      evidence: `${traceableRuns.length} run${traceableRuns.length === 1 ? "" : "s"} have full trace chains; ${highQualityEvals.length} eval artifact${highQualityEvals.length === 1 ? "" : "s"} passed at 90% or better.`,
      nextAction: "Promote traces into an OTel-compatible span model with evaluator overlays for every prompt, retrieval, tool, approval, and output validation event.",
    }),
    pattern({
      id: "governed-builder",
      name: "Governed builder",
      marketSignal: "Enterprise winners let business and IT co-build agents while enforcing lifecycle, environment, and review gates.",
      sourceExamples: ["Agent builder studios", "Low-code workflow builders"],
      score:
        (actionablePortfolio.length ? 20 : 0) +
        (governedSkills.length ? 25 : 0) +
        (input.workflowNodeCount ? 25 : 0) +
        (input.workflowStatus === "Published" ? 15 : input.workflowStatus === "Testing" ? 8 : 0) +
        (governanceReviews.length ? 15 : 0),
      evidence: `${governedSkills.length} governed Skill${governedSkills.length === 1 ? "" : "s"} and ${input.workflowNodeCount} workflow block${input.workflowNodeCount === 1 ? "" : "s"} are connected to the lifecycle.`,
      nextAction: "Add dev/test/prod promotion, Skill package export, reviewer sign-off gates, and versioned workflow specs for every launch.",
    }),
    pattern({
      id: "connector-sandbox",
      name: "Connector sandbox",
      marketSignal: "MCP-style connector access needs explicit identity, scopes, policy checks, approval gates, and plugin trust controls.",
      sourceExamples: ["Connector protocol ecosystems", "Enterprise IAM and DLP controls"],
      score:
        (skillsWithTools.length ? 25 : 0) +
        (brokerDecisions.length ? 30 : 0) +
        (toolRequests.some((request) => ["blocked", "rejected"].includes(request.status)) ? 15 : 0) +
        (skills.some((skill) => skill.blockedTools.length > 0) ? 15 : 0) +
        (skillsWithContext.length ? 15 : 0),
      evidence: `${skillsWithTools.length} Skill${skillsWithTools.length === 1 ? "" : "s"} expose tools; ${brokerDecisions.length} broker decision${brokerDecisions.length === 1 ? "" : "s"} are recorded.`,
      nextAction: "Add connector trust scoring, OAuth scope diffing, sandbox dry-runs, and kill-switch controls before any irreversible action executes.",
    }),
    pattern({
      id: "adoption-value",
      name: "Adoption and value proof",
      marketSignal: "Exec buyers need adoption, consumption, assisted hours, cycle-time change, and business outcomes tied to each agent.",
      sourceExamples: ["Copilot analytics suites", "AI consumption dashboards"],
      score:
        (input.metrics.adoptionRate > 0 ? 25 : 0) +
        (input.metrics.hoursSaved > 0 ? 25 : 0) +
        (input.metrics.annualValue > 0 ? 25 : 0) +
        (skills.some((skill) => skill.adoptionCount > 0) ? 15 : 0) +
        (useCases.some((item) => ["measuring", "scaled"].includes(item.status)) ? 10 : 0),
      evidence: `${input.metrics.adoptionRate}% adoption, ${input.metrics.hoursSaved.toLocaleString()} tracked hours saved, and ${input.metrics.annualValue ? "$" + Math.round(input.metrics.annualValue).toLocaleString() : "$0"} annualized value are modeled.`,
      nextAction: "Track baseline-versus-actual value by function, persona, cohort, and Skill version with confidence bands and CFO-ready assumptions.",
    }),
    pattern({
      id: "evidence-automation",
      name: "Evidence automation",
      marketSignal: "Responsible AI platforms are turning risk reviews into living evidence packets mapped to NIST, ISO, EU AI Act, and OWASP controls.",
      sourceExamples: ["AI governance platforms", "ISO/IEC 42001 and NIST AI RMF programs"],
      score:
        (governanceReviews.length ? 25 : 0) +
        (highQualityEvals.length ? 20 : evalResults.length ? 10 : 0) +
        (auditLogs.length ? 20 : 0) +
        (skills.some((skill) => skill.riskLevel && skill.autonomyTier) ? 15 : 0) +
        (runs.length ? 10 : 0) +
        (useCases.some((item) => item.risks.length > 0) ? 10 : 0),
      evidence: `${governanceReviews.length} review record${governanceReviews.length === 1 ? "" : "s"}, ${evalResults.length} eval result${evalResults.length === 1 ? "" : "s"}, and ${auditLogs.length} audit event${auditLogs.length === 1 ? "" : "s"} can feed assurance packets.`,
      nextAction: "Generate exportable evidence packets with control owner, risk rationale, eval proof, approval history, runtime trace, and remediation status.",
    }),
  ];

  const score = clampScore(patterns.reduce((sum, item) => sum + item.score, 0) / patterns.length);
  const status = statusFromScore(score);
  const sortedByGap = [...patterns].sort((a, b) => a.score - b.score);
  const leadingCount = patterns.filter((item) => item.status === "leading").length;
  const competitiveCount = patterns.filter((item) => item.status === "competitive").length;

  return {
    score,
    status,
    summary: `${leadingCount} leading and ${competitiveCount} competitive pattern${competitiveCount === 1 ? "" : "s"} against current enterprise AI platform signals.`,
    patterns,
    highestLeverageGap: sortedByGap[0],
  };
}
