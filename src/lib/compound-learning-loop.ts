import type {
  AuditLog,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { View } from "@/lib/ui/types";

export type CompoundLoopStageStatus = "stalled" | "forming" | "learning" | "compounding";

export type CompoundLoopStageId =
  | "discover"
  | "codify"
  | "instrument"
  | "trust"
  | "adopt"
  | "scale";

export type CompoundLoopStage = {
  id: CompoundLoopStageId;
  name: string;
  score: number;
  status: CompoundLoopStageStatus;
  signal: string;
  nextAction: string;
  targetView: View;
};

export type CompoundAutopilotMove = {
  id: string;
  title: string;
  body: string;
  targetView: View;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  confidence: number;
};

export type CompoundMoatSignal = {
  label: string;
  value: string;
  helper: string;
};

export type CompoundLearningLoop = {
  score: number;
  status: "empty" | "forming" | "operating" | "compounding";
  summary: string;
  stages: CompoundLoopStage[];
  autopilotMoves: CompoundAutopilotMove[];
  moatSignals: CompoundMoatSignal[];
  weakestStage: CompoundLoopStage;
};

export type CompoundLearningLoopInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  workSignals: WorkSignal[];
  report: string;
  metrics: {
    annualValue: number;
    adoptionRate: number;
    hoursSaved: number;
    riskItemsOpen: number;
  };
  workflow: {
    nodeCount: number;
    status: "Saved" | "Testing" | "Published";
    valid: boolean;
  };
};

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function stageStatus(score: number): CompoundLoopStageStatus {
  if (score >= 82) return "compounding";
  if (score >= 58) return "learning";
  if (score >= 28) return "forming";
  return "stalled";
}

function loopStatus(score: number, evidenceCount: number): CompoundLearningLoop["status"] {
  if (evidenceCount === 0) return "empty";
  if (score >= 82) return "compounding";
  if (score >= 58) return "operating";
  return "forming";
}

function stage(params: Omit<CompoundLoopStage, "score" | "status"> & { score: number }): CompoundLoopStage {
  const score = clamp(params.score);

  return {
    ...params,
    score,
    status: stageStatus(score),
  };
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function moveForStage(stageItem: CompoundLoopStage): CompoundAutopilotMove {
  const shared = {
    id: `compound-${stageItem.id}`,
    targetView: stageItem.targetView,
    confidence: Math.max(58, Math.min(94, 100 - Math.round(stageItem.score / 2))),
  };

  switch (stageItem.id) {
    case "discover":
      return {
        ...shared,
        title: "Open the opportunity engine",
        body: "Capture high-volume pain points, score them, and use privacy-safe work signals to decide what deserves a governed AI Skill.",
        impact: "high",
        effort: "medium",
      };
    case "codify":
      return {
        ...shared,
        title: "Turn the top opportunity into an asset",
        body: "Convert the strongest use case into a versioned Skill package with prompt contract, context, tools, owner, and workflow blueprint.",
        impact: "high",
        effort: "medium",
      };
    case "instrument":
      return {
        ...shared,
        title: "Run the Harness and capture traces",
        body: "Create a full execution trace with identity, retrieval, policy, model, tool, approval, cost, latency, and output validation events.",
        impact: "high",
        effort: "low",
      };
    case "trust":
      return {
        ...shared,
        title: "Package governance evidence",
        body: "Attach eval results, reviewer decisions, policy decisions, and audit records so the next pilot can pass review without a scramble.",
        impact: "high",
        effort: "medium",
      };
    case "adopt":
      return {
        ...shared,
        title: "Close the adoption-value loop",
        body: "Tie Skill usage to cohorts, hours saved, cycle-time change, and stakeholder sentiment so leaders see actual behavior change.",
        impact: "high",
        effort: "medium",
      };
    case "scale":
      return {
        ...shared,
        title: "Promote a reusable pattern",
        body: "Turn the proven Skill, workflow, controls, and evidence packet into a repeatable template another department can launch safely.",
        impact: "medium",
        effort: "low",
      };
  }
}

export function deriveCompoundLearningLoop(input: CompoundLearningLoopInput): CompoundLearningLoop {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const auditLogs = input.auditLogs ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const evalResults = input.evalResults ?? [];
  const workSignals = input.workSignals ?? [];

  const scoredUseCases = useCases.filter((item) => item.priorityScore > 0);
  const richUseCases = useCases.filter((item) => item.businessProblem && item.currentProcess && item.desiredOutcome);
  const linkedUseCases = useCases.filter((item) => item.linkedSkillId);
  const activeDepartments = new Set(useCases.map((item) => item.department)).size;
  const highReuseUseCases = useCases.filter((item) => item.reuseScore >= 4);
  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const productionSkills = skills.filter((skill) => ["pilot", "production"].includes(skill.status));
  const skillPackages = skills.filter(
    (skill) =>
      skill.systemPrompt.length >= 80 &&
      skill.contextSources.length > 0 &&
      skill.allowedTools.length > 0 &&
      skill.evalPassRate > 0,
  );
  const reusableSkills = skills.filter(
    (skill) => skill.department === "Cross-Functional" || skill.valueDelivered > 0 || skill.adoptionCount > 0,
  );
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const instrumentedRuns = runs.filter((run) => run.costUsd > 0 && run.latencyMs > 0);
  const policyAwareRuns = runs.filter((run) =>
    run.trace.some((step) => /policy|approval|validation|safety|permission/i.test(`${step.label} ${step.detail}`)),
  );
  const brokerDecisions = toolRequests.filter((request) =>
    ["pending", "approved", "rejected", "blocked"].includes(request.status),
  );
  const passingEvals = evalResults.filter((result) => result.passed && result.score >= 90 && result.criticalFailures === 0);
  const approvedReviews = governanceReviews.filter((review) =>
    ["approved", "approved_with_conditions"].includes(review.status),
  );
  const approvedOrActiveReviews = governanceReviews.filter((review) => review.status !== "not_submitted");
  const privacySafeSignals = workSignals.filter(
    (signal) =>
      signal.privacy?.contentRedacted &&
      signal.privacy?.piiRedacted &&
      !signal.privacy.rawContentStored &&
      !signal.privacy.individualScoringAllowed,
  );
  const valueSkills = skills.filter((skill) => skill.valueDelivered > 0 || skill.adoptionCount > 0 || skill.runs > 0);
  const measuredUseCases = useCases.filter((item) => ["measuring", "scaled"].includes(item.status));

  const stages = [
    stage({
      id: "discover",
      name: "Discover demand",
      targetView: "factory",
      score:
        (useCases.length ? 16 : 0) +
        Math.min(18, scoredUseCases.length * 5) +
        Math.min(14, richUseCases.length * 4) +
        Math.min(16, activeDepartments * 5) +
        Math.min(20, privacySafeSignals.length * 4) +
        (workSignals.some((signal) => ["workflow_delayed", "rework_detected", "approval_waiting"].includes(signal.eventType)) ? 16 : 0),
      signal: `${plural(scoredUseCases.length, "scored opportunity", "scored opportunities")} across ${activeDepartments || 0} department${activeDepartments === 1 ? "" : "s"} with ${plural(privacySafeSignals.length, "privacy-safe work signal")}.`,
      nextAction: "Capture more pain signals, discovery notes, and process baselines before choosing what to industrialize.",
    }),
    stage({
      id: "codify",
      name: "Codify assets",
      targetView: "skills",
      score:
        (linkedUseCases.length ? 20 : 0) +
        Math.min(18, governedSkills.length * 7) +
        Math.min(22, skillPackages.length * 11) +
        (input.workflow.nodeCount ? 18 : 0) +
        (input.workflow.valid ? 10 : 0) +
        (input.workflow.status === "Published" ? 12 : input.workflow.status === "Testing" ? 6 : 0),
      signal: `${plural(governedSkills.length, "governed Skill")} and ${plural(input.workflow.nodeCount, "workflow block")} linked to reusable delivery patterns.`,
      nextAction: "Make every approved use case a portable Skill package with workflow spec, prompt contract, context, tools, evals, and owner.",
    }),
    stage({
      id: "instrument",
      name: "Instrument runs",
      targetView: "harness",
      score:
        (runs.length ? 15 : 0) +
        Math.min(24, traceableRuns.length * 8) +
        Math.min(16, instrumentedRuns.length * 6) +
        Math.min(18, policyAwareRuns.length * 6) +
        Math.min(15, auditLogs.length * 2) +
        (brokerDecisions.length ? 12 : 0),
      signal: `${plural(traceableRuns.length, "traceable run")} with ${plural(policyAwareRuns.length, "policy-aware execution")} and ${plural(auditLogs.length, "audit event")}.`,
      nextAction: "Persist complete traces and replayable checkpoints for every model call, retrieval, tool action, approval, and output validation.",
    }),
    stage({
      id: "trust",
      name: "Earn trust",
      targetView: "evidence",
      score:
        (governanceReviews.length ? 20 : 0) +
        Math.min(20, approvedOrActiveReviews.length * 7) +
        Math.min(20, approvedReviews.length * 10) +
        (evalResults.length ? 12 : 0) +
        Math.min(18, passingEvals.length * 9) +
        (brokerDecisions.length ? 10 : 0),
      signal: `${plural(governanceReviews.length, "review record")} and ${plural(passingEvals.length, "launch-grade eval")} available for evidence packets.`,
      nextAction: "Generate reviewer-ready evidence packets mapped to control frameworks before expanding any pilot.",
    }),
    stage({
      id: "adopt",
      name: "Drive adoption",
      targetView: "roi",
      score:
        Math.min(24, input.metrics.adoptionRate * 0.35) +
        (input.metrics.hoursSaved > 0 ? 18 : 0) +
        (input.metrics.annualValue > 0 ? 18 : 0) +
        Math.min(20, valueSkills.length * 7) +
        Math.min(12, measuredUseCases.length * 6) +
        (workSignals.some((signal) => ["training_completed", "feedback_given", "skill_used"].includes(signal.eventType)) ? 8 : 0),
      signal: `${percent(input.metrics.adoptionRate)} adoption, ${input.metrics.hoursSaved.toLocaleString()} hours saved, and ${plural(valueSkills.length, "Skill")} with usage or value proof.`,
      nextAction: "Connect usage cohorts, training completion, stakeholder sentiment, and baseline-versus-actual value by department.",
    }),
    stage({
      id: "scale",
      name: "Scale patterns",
      targetView: "reports",
      score:
        Math.min(22, highReuseUseCases.length * 8) +
        Math.min(18, reusableSkills.length * 7) +
        Math.min(16, productionSkills.length * 8) +
        (input.report ? 18 : 0) +
        (input.metrics.annualValue >= 100_000 ? 14 : input.metrics.annualValue > 0 ? 7 : 0) +
        (skills.some((skill) => skill.department === "Cross-Functional") ? 12 : 0),
      signal: `${plural(highReuseUseCases.length, "high-reuse opportunity", "high-reuse opportunities")} and ${plural(reusableSkills.length, "reusable Skill package")} ready to become templates.`,
      nextAction: "Promote proven Skills into templates with scope, controls, rollout checklist, value assumptions, and launch evidence.",
    }),
  ];

  const evidenceCount =
    useCases.length +
    skills.length +
    runs.length +
    toolRequests.length +
    auditLogs.length +
    governanceReviews.length +
    evalResults.length +
    workSignals.length;
  const score = clamp(stages.reduce((sum, item) => sum + item.score, 0) / stages.length);
  const status = loopStatus(score, evidenceCount);
  const weakestStage = [...stages].sort((a, b) => a.score - b.score)[0];
  const autopilotMoves = [...stages]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(moveForStage);
  const learningAssets = evidenceCount;
  const evidenceDensity = skills.length
    ? (runs.length + evalResults.length + governanceReviews.length + auditLogs.length) / skills.length
    : 0;
  const reuseRate = useCases.length ? Math.round((highReuseUseCases.length / useCases.length) * 100) : 0;

  const statusCopy: Record<CompoundLearningLoop["status"], string> = {
    empty: "No compounding loop exists yet. Create the first opportunity, Skill, run, evidence packet, and report.",
    forming: "The operating system has useful artifacts, but the learning loop is still incomplete across execution, trust, adoption, or reuse.",
    operating: "The loop is operating: opportunities are becoming Skills, Skills are being run, and evidence is starting to convert into value proof.",
    compounding: "The loop is compounding: the enterprise is turning work signals into governed Skills, measured adoption, reusable patterns, and executive proof.",
  };

  return {
    score,
    status,
    summary: statusCopy[status],
    stages,
    autopilotMoves,
    moatSignals: [
      {
        label: "Learning assets",
        value: learningAssets.toLocaleString(),
        helper: "signals, opportunities, Skills, runs, decisions, evals, and audit facts the OS can reason over",
      },
      {
        label: "Evidence density",
        value: skills.length ? evidenceDensity.toFixed(1) : "0.0",
        helper: "trace, eval, review, and audit records per Skill package",
      },
      {
        label: "Reuse potential",
        value: `${reuseRate}%`,
        helper: "opportunities scored as reusable patterns across departments or regions",
      },
      {
        label: "Value signal",
        value: formatCompactCurrency(input.metrics.annualValue),
        helper: "annualized value currently attached to launched or governed Skills",
      },
    ],
    weakestStage,
  };
}
