import type { AuditLog, EvalResult, GovernanceReview, RiskLevel, Run, Skill, ToolRequest, UseCase } from "@/lib/enterprise-ai-data";
import type { View } from "@/lib/ui/types";

export type ActionInboxSeverity = "critical" | "warning" | "info" | "success";

export type ActionInboxItem = {
  id: string;
  severity: ActionInboxSeverity;
  title: string;
  body: string;
  source: string;
  actionLabel: string;
  targetView: View;
  targetId?: string;
  count?: number;
  createdAt?: string;
};

export type ActionInboxInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  auditLogs: AuditLog[];
  report: string;
  metrics: {
    annualValue: number;
    adoptionRate: number;
    riskItemsOpen: number;
  };
  workflow: {
    nodeCount: number;
    status: "Saved" | "Testing" | "Published";
    valid: boolean;
    issues: number;
    warnings: number;
    firstIssue?: string;
  };
};

const severityOrder: Record<ActionInboxSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

function riskLabel(risk: RiskLevel) {
  if (risk === "restricted") return "restricted";
  return `${risk} risk`;
}

export function deriveActionInbox(input: ActionInboxInput): ActionInboxItem[] {
  const items: ActionInboxItem[] = [];
  const pendingToolRequests = input.toolRequests.filter((request) => request.status === "pending");
  const blockedRuns = input.runs.filter((run) => ["blocked", "failed", "waiting_for_approval"].includes(run.status));
  const blockedGovernance = input.governanceReviews.filter(
    (review) => ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  );
  const failedEvals = input.evalResults.filter((result) => !result.passed || result.criticalFailures > 0);
  const highRiskUseCases = input.useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel));
  const skillsWithoutStrongEvals = input.skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status) && skill.evalPassRate < 90);

  if (!input.useCases.length && !input.skills.length && !input.runs.length) {
    items.push({
      id: "empty-workspace",
      severity: "info",
      title: "Workspace needs first operating loop",
      body: "Run guided setup or create the first use case so strategy, Skills, workflow, Harness, evidence, and reporting can connect.",
      source: "Setup",
      actionLabel: "Start setup",
      targetView: "command",
    });
  }

  if (pendingToolRequests.length) {
    const first = pendingToolRequests[0];
    items.push({
      id: "pending-tool-requests",
      severity: pendingToolRequests.some((request) => ["high", "restricted"].includes(request.riskLevel)) ? "critical" : "warning",
      title: `${pendingToolRequests.length} tool approval${pendingToolRequests.length === 1 ? "" : "s"} waiting`,
      body: `${first.toolId} is waiting on a human decision for ${first.reason.toLowerCase()}`,
      source: "MCP Broker",
      actionLabel: "Review approvals",
      targetView: "broker",
      targetId: first.runId,
      count: pendingToolRequests.length,
      createdAt: first.requestedAt,
    });
  }

  if (blockedGovernance.length) {
    const first = blockedGovernance[0];
    items.push({
      id: "governance-blockers",
      severity: blockedGovernance.some((review) => review.status === "changes_requested" || review.riskLevel === "restricted") ? "critical" : "warning",
      title: `${blockedGovernance.length} governance review${blockedGovernance.length === 1 ? "" : "s"} need movement`,
      body: first.blockers[0] ?? `${first.title} is ${first.status.replaceAll("_", " ")} and needs reviewer action.`,
      source: "Governance",
      actionLabel: "Open reviews",
      targetView: "governance",
      targetId: first.itemId,
      count: blockedGovernance.length,
      createdAt: first.dueDate,
    });
  }

  if (blockedRuns.length) {
    const first = blockedRuns[0];
    items.push({
      id: "blocked-runs",
      severity: blockedRuns.some((run) => ["failed", "blocked"].includes(run.status)) ? "critical" : "warning",
      title: `${blockedRuns.length} Harness run${blockedRuns.length === 1 ? "" : "s"} need attention`,
      body: `${first.id} is at ${first.currentStage} with ${riskLabel(first.riskLevel)} posture.`,
      source: "AI Harness",
      actionLabel: "Inspect trace",
      targetView: "harness",
      targetId: first.id,
      count: blockedRuns.length,
      createdAt: first.startedAt,
    });
  }

  if (failedEvals.length || skillsWithoutStrongEvals.length) {
    const firstFailedEval = failedEvals[0];
    const firstSkill = skillsWithoutStrongEvals[0];
    items.push({
      id: "eval-readiness",
      severity: failedEvals.some((result) => result.criticalFailures > 0) ? "critical" : "warning",
      title: failedEvals.length ? `${failedEvals.length} eval result${failedEvals.length === 1 ? "" : "s"} below launch bar` : "Launch Skills need stronger eval evidence",
      body: firstFailedEval
        ? `${firstFailedEval.suiteName} scored ${firstFailedEval.score}% with ${firstFailedEval.criticalFailures} critical failure${firstFailedEval.criticalFailures === 1 ? "" : "s"}.`
        : `${firstSkill?.name ?? "A production Skill"} is below the 90% eval threshold.`,
      source: "Evaluations",
      actionLabel: "Run evals",
      targetView: "evals",
      targetId: firstFailedEval?.skillId ?? firstSkill?.id,
      count: failedEvals.length || skillsWithoutStrongEvals.length,
      createdAt: firstFailedEval?.createdAt,
    });
  }

  if (input.workflow.nodeCount && !input.workflow.valid) {
    items.push({
      id: "workflow-validation",
      severity: input.workflow.issues > 0 ? "critical" : "warning",
      title: `${input.workflow.issues} workflow issue${input.workflow.issues === 1 ? "" : "s"} before publish`,
      body: input.workflow.firstIssue || `${input.workflow.warnings} warning${input.workflow.warnings === 1 ? "" : "s"} remain in the workflow blueprint.`,
      source: "Workflow Studio",
      actionLabel: "Fix blueprint",
      targetView: "workflow",
      count: input.workflow.issues + input.workflow.warnings,
    });
  }

  if (highRiskUseCases.length) {
    const first = highRiskUseCases[0];
    items.push({
      id: "high-risk-use-cases",
      severity: highRiskUseCases.some((item) => item.riskLevel === "restricted") ? "critical" : "warning",
      title: `${highRiskUseCases.length} high-risk opportunity${highRiskUseCases.length === 1 ? "" : "ies"} need controls`,
      body: `${first.title} is ${riskLabel(first.riskLevel)} and should carry explicit data, autonomy, and reviewer controls before pilot.`,
      source: "Use Case Factory",
      actionLabel: "Triage backlog",
      targetView: "factory",
      targetId: first.id,
      count: highRiskUseCases.length,
      createdAt: first.updatedAt,
    });
  }

  if (input.skills.length && !input.metrics.annualValue) {
    items.push({
      id: "value-proof-gap",
      severity: "info",
      title: "Skills need value proof",
      body: "The catalog has governed Skills, but no annualized value has been attached yet.",
      source: "Metrics & ROI",
      actionLabel: "Add economics",
      targetView: "roi",
    });
  }

  if (!input.report && (input.useCases.length || input.skills.length || input.runs.length)) {
    items.push({
      id: "report-gap",
      severity: "info",
      title: "Executive brief has not been generated",
      body: "Package the current portfolio, risks, blockers, value, and next decisions into a board-ready brief.",
      source: "Reports",
      actionLabel: "Draft brief",
      targetView: "reports",
    });
  }

  if (!items.length) {
    items.push({
      id: "workspace-healthy",
      severity: "success",
      title: "Operating loop is healthy",
      body: "No urgent approvals, review blockers, failed runs, eval failures, or workflow blockers are currently open.",
      source: "Command Center",
      actionLabel: "View cockpit",
      targetView: "command",
    });
  }

  return items.sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity];
    if (severity !== 0) return severity;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

export function countOpenInboxItems(items: ActionInboxItem[]) {
  return items.filter((item) => item.severity !== "success").length;
}
