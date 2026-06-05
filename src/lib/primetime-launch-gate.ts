import type { EvalResult, GovernanceReview, Run, Skill, UseCase } from "@/lib/enterprise-ai-data";
import type { EnterpriseMaturity } from "@/lib/enterprise-maturity";
import type { IntegrationBlueprint } from "@/lib/integration-blueprint";
import type { ProductionReadiness, View } from "@/lib/ui/types";

export type PrimetimeGateStatus = "pass" | "warn" | "block";

export type PrimetimeGateItem = {
  id: string;
  label: string;
  status: PrimetimeGateStatus;
  evidence: string;
  requiredFor: "pilot" | "production";
  nextAction: string;
  targetView: View;
};

export type PrimetimeLaunchGate = {
  score: number;
  status: "ready" | "needs-work" | "blocked";
  summary: string;
  blockers: PrimetimeGateItem[];
  warnings: PrimetimeGateItem[];
  passes: PrimetimeGateItem[];
  items: PrimetimeGateItem[];
  nextAction: PrimetimeGateItem;
};

export type PrimetimeLaunchGateInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  report: string;
  productionReadiness?: ProductionReadiness | null;
  enterpriseMaturity: EnterpriseMaturity;
  integrationBlueprint: IntegrationBlueprint;
  workflow: {
    nodeCount: number;
    valid: boolean;
    issues: number;
    status: "Saved" | "Testing" | "Published";
  };
};

function gate(params: PrimetimeGateItem): PrimetimeGateItem {
  return params;
}

function statusWeight(status: PrimetimeGateStatus) {
  if (status === "pass") return 100;
  if (status === "warn") return 55;
  return 0;
}

export function derivePrimetimeLaunchGate(input: PrimetimeLaunchGateInput): PrimetimeLaunchGate {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const evalResults = input.evalResults ?? [];
  const productionReadiness = input.productionReadiness ?? null;

  const pilotOrProductionSkills = skills.filter((skill) => ["pilot", "production"].includes(skill.status));
  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production", "in_review"].includes(skill.status));
  const launchGradeEvals = evalResults.filter((result) => result.passed && result.score >= 90 && result.criticalFailures === 0);
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const approvedReviews = governanceReviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status));
  const blockedReviews = governanceReviews.filter((review) =>
    ["changes_requested", "in_review"].includes(review.status) || review.blockers.length > 0,
  );
  const hasReport = input.report.trim().length > 0;
  const hasPortfolio = useCases.length > 0;
  const hasWorkflow = input.workflow.nodeCount > 0;
  const productionBlocked = productionReadiness?.status === "blocked";
  const productionWarnings = (productionReadiness?.warnings?.length ?? 0) + (productionReadiness?.blockers?.length ?? 0);

  const items: PrimetimeGateItem[] = [
    gate({
      id: "portfolio",
      label: "Opportunity portfolio",
      status: hasPortfolio ? "pass" : "block",
      evidence: hasPortfolio ? `${useCases.length} use case${useCases.length === 1 ? "" : "s"} in the portfolio.` : "No scored opportunities exist yet.",
      requiredFor: "pilot",
      nextAction: "Run guided setup or create the first use case so the operating loop has real demand to work from.",
      targetView: "factory",
    }),
    gate({
      id: "skill-package",
      label: "Governed Skill package",
      status: governedSkills.length ? "pass" : hasPortfolio ? "warn" : "block",
      evidence: governedSkills.length ? `${governedSkills.length} governed Skill package${governedSkills.length === 1 ? "" : "s"} visible.` : "No governed Skill exists yet.",
      requiredFor: "pilot",
      nextAction: "Convert the top use case into a Skill with prompt, model, context, tools, approval rules, and metrics.",
      targetView: "skills",
    }),
    gate({
      id: "workflow",
      label: "Workflow validation",
      status: hasWorkflow && input.workflow.valid ? "pass" : hasWorkflow ? "warn" : "block",
      evidence: hasWorkflow
        ? `${input.workflow.nodeCount} workflow blocks, ${input.workflow.issues} blocking issue${input.workflow.issues === 1 ? "" : "s"}, status ${input.workflow.status}.`
        : "No workflow blueprint exists yet.",
      requiredFor: "pilot",
      nextAction: "Open Workflow Studio, load or validate a governed execution blueprint, and resolve blocking issues before publishing.",
      targetView: "workflow",
    }),
    gate({
      id: "evals",
      label: "Launch-grade eval evidence",
      status: launchGradeEvals.length ? "pass" : evalResults.length ? "warn" : "block",
      evidence: launchGradeEvals.length
        ? `${launchGradeEvals.length} launch-grade eval result${launchGradeEvals.length === 1 ? "" : "s"} passed.`
        : evalResults.length
          ? `${evalResults.length} eval result${evalResults.length === 1 ? "" : "s"} exist, but none meet the 90% no-critical-failure bar.`
          : "No eval evidence exists yet.",
      requiredFor: "pilot",
      nextAction: "Run grounding, permission, prompt-injection, tool-safety, cost, latency, and regression evals for the selected Skill.",
      targetView: "evals",
    }),
    gate({
      id: "harness-trace",
      label: "Traceable Harness execution",
      status: traceableRuns.length ? "pass" : runs.length ? "warn" : "block",
      evidence: traceableRuns.length
        ? `${traceableRuns.length} traceable Harness run${traceableRuns.length === 1 ? "" : "s"} recorded.`
        : runs.length
          ? `${runs.length} run${runs.length === 1 ? "" : "s"} exist but need fuller trace evidence.`
          : "No Harness run exists yet.",
      requiredFor: "pilot",
      nextAction: "Run the Skill through the AI Harness and inspect identity, context, policy, model, tool, approval, validation, and audit steps.",
      targetView: "harness",
    }),
    gate({
      id: "governance",
      label: "Governance decision path",
      status: approvedReviews.length ? "pass" : blockedReviews.length ? "warn" : "block",
      evidence: approvedReviews.length
        ? `${approvedReviews.length} review decision${approvedReviews.length === 1 ? "" : "s"} approved or conditionally approved.`
        : blockedReviews.length
          ? `${blockedReviews.length} review${blockedReviews.length === 1 ? "" : "s"} still need movement.`
          : "No governance review exists yet.",
      requiredFor: "pilot",
      nextAction: "Submit the Skill to security, legal, privacy, and business review, then resolve open blockers.",
      targetView: "governance",
    }),
    gate({
      id: "integration",
      label: "Enterprise integration posture",
      status: input.integrationBlueprint.status === "ready" ? "pass" : input.integrationBlueprint.status === "partial" ? "warn" : "block",
      evidence: `Integration blueprint score is ${input.integrationBlueprint.score}/100; next gap is ${input.integrationBlueprint.primaryNextAction.name}.`,
      requiredFor: "production",
      nextAction: input.integrationBlueprint.primaryNextAction.nextAction,
      targetView: input.integrationBlueprint.primaryNextAction.targetView,
    }),
    gate({
      id: "production-runtime",
      label: "Production runtime controls",
      status: productionReadiness?.status === "ready" ? "pass" : productionBlocked ? "block" : "warn",
      evidence: productionReadiness
        ? `${productionReadiness.status} with ${productionWarnings} blocker/warning item${productionWarnings === 1 ? "" : "s"}.`
        : "Server readiness has not been checked.",
      requiredFor: "production",
      nextAction: "Configure production auth/SSO, durable persistence, provider secrets, connector broker, workflow engine, and deployment health gates.",
      targetView: "launch",
    }),
    gate({
      id: "maturity",
      label: "Operating-system maturity",
      status: input.enterpriseMaturity.score >= 85 ? "pass" : input.enterpriseMaturity.score >= 68 ? "warn" : "block",
      evidence: `Enterprise AI OS maturity is ${input.enterpriseMaturity.score}/100; highest leverage gap is ${input.enterpriseMaturity.highestLeveragePillar.name}.`,
      requiredFor: "production",
      nextAction: input.enterpriseMaturity.highestLeveragePillar.nextAction,
      targetView: input.enterpriseMaturity.highestLeveragePillar.targetView,
    }),
    gate({
      id: "executive-proof",
      label: "Executive proof packet",
      status: hasReport && pilotOrProductionSkills.length ? "pass" : hasReport ? "warn" : "block",
      evidence: hasReport
        ? `Executive report exists; ${pilotOrProductionSkills.length} Skill${pilotOrProductionSkills.length === 1 ? "" : "s"} are pilot/production.`
        : "No executive launch report has been generated yet.",
      requiredFor: "pilot",
      nextAction: "Generate an executive brief covering portfolio state, value, risks, blockers, and decisions needed.",
      targetView: "reports",
    }),
  ];

  const score = Math.round(items.reduce((sum, item) => sum + statusWeight(item.status), 0) / items.length);
  const blockers = items.filter((item) => item.status === "block");
  const warnings = items.filter((item) => item.status === "warn");
  const passes = items.filter((item) => item.status === "pass");
  const nextAction = blockers[0] ?? warnings[0] ?? items[items.length - 1];

  return {
    score,
    status: blockers.length ? "blocked" : warnings.length ? "needs-work" : "ready",
    summary: blockers.length
      ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} must be resolved before primetime launch.`
      : warnings.length
        ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} remain before production rollout.`
        : "Pilot and production launch gates are satisfied.",
    blockers,
    warnings,
    passes,
    items,
    nextAction,
  };
}
