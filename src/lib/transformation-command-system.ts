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

export type TransformationStageStatus = "blocked" | "forming" | "operating" | "scaling";

export type TransformationStageId =
  | "sense"
  | "prioritize"
  | "redesign"
  | "industrialize"
  | "execute"
  | "prove"
  | "adopt"
  | "scale";

export type TransformationCommandStage = {
  id: TransformationStageId;
  label: string;
  score: number;
  status: TransformationStageStatus;
  signal: string;
  nextAction: string;
  targetView: View;
};

export type TransformationCommandOrder = {
  id: string;
  title: string;
  why: string;
  evidenceNeeded: string;
  targetView: View;
  urgency: "now" | "next" | "soon";
  confidence: number;
};

export type TransformationCommandSystem = {
  score: number;
  posture: "empty" | "forming" | "command-ready" | "scaling";
  directive: string;
  whyNow: string;
  operatorBrief: string;
  proofDebt: number;
  scaleReadiness: number;
  nextAction: TransformationCommandOrder;
  stages: TransformationCommandStage[];
  orders: TransformationCommandOrder[];
  boardProof: {
    label: string;
    value: string;
    helper: string;
    targetView: View;
  }[];
};

export type TransformationCommandSystemInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  auditLogs: AuditLog[];
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
    issues: number;
  };
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFor(score: number): TransformationStageStatus {
  if (score >= 82) return "scaling";
  if (score >= 58) return "operating";
  if (score >= 25) return "forming";
  return "blocked";
}

function postureFor(score: number, evidenceCount: number): TransformationCommandSystem["posture"] {
  if (evidenceCount === 0) return "empty";
  if (score >= 82) return "scaling";
  if (score >= 58) return "command-ready";
  return "forming";
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function stage(params: Omit<TransformationCommandStage, "score" | "status"> & { score: number }): TransformationCommandStage {
  const score = clamp(params.score);

  return {
    ...params,
    score,
    status: statusFor(score),
  };
}

function orderForStage(stageItem: TransformationCommandStage, urgency: TransformationCommandOrder["urgency"]): TransformationCommandOrder {
  const shared = {
    id: `command-${stageItem.id}`,
    targetView: stageItem.targetView,
    urgency,
    confidence: Math.max(62, Math.min(96, 102 - Math.round(stageItem.score / 2))),
  };

  switch (stageItem.id) {
    case "sense":
      return {
        ...shared,
        title: "Find the highest-friction work",
        why: "The OS needs real demand signals before it can become a transformation command system.",
        evidenceNeeded: "Use cases, privacy-safe work signals, process pain, and function ownership.",
      };
    case "prioritize":
      return {
        ...shared,
        title: "Decide what deserves AI",
        why: "Executives need a ranked portfolio, not a pile of AI ideas.",
        evidenceNeeded: "Value, feasibility, risk, urgency, data readiness, and reuse scores.",
      };
    case "redesign":
      return {
        ...shared,
        title: "Redesign before automating",
        why: "The highest leverage comes from changing the process, not just adding a model to bad work.",
        evidenceNeeded: "Current state, future state, cycle-time baseline, handoffs, controls, and human/AI boundaries.",
      };
    case "industrialize":
      return {
        ...shared,
        title: "Turn the best use case into a governed Skill",
        why: "A reusable Skill is the enterprise asset; the prompt alone is not the product.",
        evidenceNeeded: "Owner, prompt contract, context sources, tool policy, eval suite, and launch checklist.",
      };
    case "execute":
      return {
        ...shared,
        title: "Run the Harness and capture trace evidence",
        why: "The enterprise will trust what it can inspect: identity, context, policy, model, tools, approvals, and output validation.",
        evidenceNeeded: "Traceable run, workflow blueprint, broker decision, cost, latency, and validation events.",
      };
    case "prove":
      return {
        ...shared,
        title: "Package governance proof",
        why: "Security, legal, privacy, and executives need one proof chain before pilot expansion.",
        evidenceNeeded: "Eval results, reviewer decisions, policy decisions, audit logs, and control mappings.",
      };
    case "adopt":
      return {
        ...shared,
        title: "Attach usage to value",
        why: "The program only matters if people use it and the work measurably improves.",
        evidenceNeeded: "Adoption cohorts, hours saved, cycle-time change, quality signals, and stakeholder feedback.",
      };
    case "scale":
      return {
        ...shared,
        title: "Promote the pattern",
        why: "The compounding advantage is turning one safe win into a repeatable launch pattern for another function.",
        evidenceNeeded: "Reusable Skill package, workflow blueprint, controls, ROI assumptions, launch playbook, and proof packet.",
      };
  }
}

export function deriveTransformationCommandSystem(input: TransformationCommandSystemInput): TransformationCommandSystem {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const evalResults = input.evalResults ?? [];
  const auditLogs = input.auditLogs ?? [];
  const workSignals = input.workSignals ?? [];
  const metrics = input.metrics ?? { annualValue: 0, adoptionRate: 0, hoursSaved: 0, riskItemsOpen: 0 };

  const scoredUseCases = useCases.filter((item) => item.priorityScore > 0);
  const highPriorityUseCases = scoredUseCases.filter((item) => item.priorityScore >= 75);
  const linkedUseCases = useCases.filter((item) => item.linkedSkillId);
  const processReadyUseCases = useCases.filter((item) => item.businessProblem && item.currentProcess && item.desiredOutcome);
  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const packagedSkills = skills.filter(
    (skill) =>
      skill.systemPrompt.length >= 80 &&
      skill.contextSources.length > 0 &&
      skill.allowedTools.length > 0 &&
      skill.evalPassRate > 0,
  );
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const completedRuns = runs.filter((run) => run.status === "completed");
  const brokerDecisions = toolRequests.filter((request) => ["approved", "rejected", "blocked", "pending"].includes(request.status));
  const pendingToolRequests = toolRequests.filter((request) => request.status === "pending");
  const approvedReviews = governanceReviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status));
  const activeReviews = governanceReviews.filter((review) => review.status !== "not_submitted");
  const failedEvals = evalResults.filter((result) => !result.passed || result.criticalFailures > 0);
  const passingEvals = evalResults.filter((result) => result.passed && result.score >= 90 && result.criticalFailures === 0);
  const highReuseUseCases = useCases.filter((item) => item.reuseScore >= 4);
  const reusableSkills = skills.filter((skill) => skill.valueDelivered > 0 || skill.adoptionCount > 0 || skill.department === "Cross-Functional");
  const privacySafeSignals = workSignals.filter(
    (signal) =>
      signal.privacy?.contentRedacted &&
      signal.privacy?.piiRedacted &&
      !signal.privacy.rawContentStored &&
      !signal.privacy.individualScoringAllowed,
  );
  const evidenceCount = traceableRuns.length + evalResults.length + activeReviews.length + brokerDecisions.length + auditLogs.length;

  const stages: TransformationCommandStage[] = [
    stage({
      id: "sense",
      label: "Sense demand",
      targetView: "work",
      score: Math.min(40, useCases.length * 8) + Math.min(34, privacySafeSignals.length * 9) + (new Set(useCases.map((item) => item.department)).size >= 3 ? 26 : 0),
      signal: useCases.length || privacySafeSignals.length ? `${plural(useCases.length, "opportunity", "opportunities")} and ${plural(privacySafeSignals.length, "safe signal")}` : "No enterprise demand signals yet.",
      nextAction: "Connect privacy-safe work signals or capture the first corporate-function pain point.",
    }),
    stage({
      id: "prioritize",
      label: "Prioritize portfolio",
      targetView: "factory",
      score: Math.min(42, scoredUseCases.length * 8) + Math.min(26, highPriorityUseCases.length * 8) + (useCases.some((item) => item.ownerId) ? 16 : 0) + (useCases.some((item) => item.riskScore > 0) ? 16 : 0),
      signal: scoredUseCases.length ? `${plural(scoredUseCases.length, "scored opportunity", "scored opportunities")}; ${plural(highPriorityUseCases.length, "high-priority candidate")}` : "No scored portfolio yet.",
      nextAction: "Score opportunities by value, feasibility, risk, reuse, urgency, and data readiness.",
    }),
    stage({
      id: "redesign",
      label: "Redesign work",
      targetView: "process",
      score: Math.min(55, processReadyUseCases.length * 10) + (useCases.some((item) => item.avgHandlingTimeMinutes || item.monthlyVolume) ? 20 : 0) + (useCases.some((item) => item.expectedBenefits.length) ? 25 : 0),
      signal: processReadyUseCases.length ? `${plural(processReadyUseCases.length, "use case")} with current/future-state detail.` : "Current and future process evidence is missing.",
      nextAction: "Map current state, future state, handoffs, cycle-time baseline, and control points.",
    }),
    stage({
      id: "industrialize",
      label: "Industrialize Skills",
      targetView: "skills",
      score: Math.min(32, linkedUseCases.length * 9) + Math.min(36, governedSkills.length * 12) + Math.min(32, packagedSkills.length * 12),
      signal: skills.length ? `${plural(skills.length, "Skill")} with ${plural(packagedSkills.length, "complete package")}.` : "No governed Skills yet.",
      nextAction: "Convert the top opportunity into a Skill with prompt contract, sources, tools, evals, and owner.",
    }),
    stage({
      id: "execute",
      label: "Execute safely",
      targetView: "harness",
      score: Math.min(30, input.workflow.nodeCount * 6) + (input.workflow.valid && input.workflow.nodeCount ? 20 : 0) + Math.min(30, traceableRuns.length * 10) + Math.min(20, completedRuns.length * 5),
      signal: `${plural(input.workflow.nodeCount, "blueprint block")} and ${plural(traceableRuns.length, "traceable run")}.`,
      nextAction: input.workflow.nodeCount && !input.workflow.valid ? "Fix the execution blueprint before publishing." : "Run the Skill through the Harness and inspect the trace.",
    }),
    stage({
      id: "prove",
      label: "Prove trust",
      targetView: "evidence",
      score: Math.min(22, activeReviews.length * 8) + Math.min(25, approvedReviews.length * 10) + Math.min(25, passingEvals.length * 9) + Math.min(18, brokerDecisions.length * 5) + Math.min(10, auditLogs.length / 20),
      signal: `${plural(activeReviews.length, "review")} · ${plural(passingEvals.length, "passing eval")} · ${plural(brokerDecisions.length, "broker decision")}.`,
      nextAction: failedEvals.length ? "Resolve failed evals before pilot expansion." : "Package evals, approvals, policy decisions, and audit logs into the evidence ledger.",
    }),
    stage({
      id: "adopt",
      label: "Measure adoption",
      targetView: "roi",
      score: Math.min(35, metrics.adoptionRate) + Math.min(30, metrics.hoursSaved / 250) + (metrics.annualValue ? 25 : 0) + (skills.some((skill) => skill.adoptionCount > 0) ? 10 : 0),
      signal: metrics.annualValue ? `${metrics.adoptionRate}% adoption and ${formatCompactCurrency(metrics.annualValue)} annualized value.` : "No adoption-adjusted value proof yet.",
      nextAction: "Attach usage to cohorts, baselines, hours saved, cycle-time change, and quality outcomes.",
    }),
    stage({
      id: "scale",
      label: "Scale patterns",
      targetView: "reports",
      score: Math.min(30, highReuseUseCases.length * 8) + Math.min(30, reusableSkills.length * 10) + (metrics.annualValue && input.report ? 20 : 0) + (governedSkills.some((skill) => ["pilot", "production"].includes(skill.status)) ? 20 : 0),
      signal: `${plural(highReuseUseCases.length, "high-reuse opportunity", "high-reuse opportunities")} and ${plural(reusableSkills.length, "reusable Skill")}.`,
      nextAction: "Promote the proven Skill, blueprint, controls, ROI, and launch playbook into a reusable pattern.",
    }),
  ];

  const score = clamp(stages.reduce((total, item) => total + item.score, 0) / stages.length);
  const weakestStage = [...stages].sort((a, b) => a.score - b.score)[0] ?? stages[0];
  const proofDebt = clamp(100 - stages.find((item) => item.id === "prove")!.score);
  const scaleReadiness = clamp((stages.find((item) => item.id === "scale")!.score + stages.find((item) => item.id === "adopt")!.score + stages.find((item) => item.id === "prove")!.score) / 3);
  const posture = postureFor(score, evidenceCount);

  const urgentOrders: TransformationCommandOrder[] = [];
  if (pendingToolRequests.length) {
    urgentOrders.push({
      id: "command-pending-tools",
      title: "Decide pending tool approvals",
      why: `${plural(pendingToolRequests.length, "tool request")} is waiting on a visible human decision.`,
      evidenceNeeded: "Approval decision, approver role, policy reason, and audit event.",
      targetView: "broker",
      urgency: "now",
      confidence: 96,
    });
  }
  if (input.workflow.nodeCount && (!input.workflow.valid || input.workflow.issues > 0)) {
    urgentOrders.push({
      id: "command-blueprint-blocker",
      title: "Fix the execution blueprint",
      why: "Publishing a broken runtime graph weakens the trust layer before the Harness can prove it.",
      evidenceNeeded: "Valid trigger, connected blocks, output boundary, approval gates, and compiled spec.",
      targetView: "workflow",
      urgency: "now",
      confidence: 94,
    });
  }
  if (failedEvals.length) {
    urgentOrders.push({
      id: "command-eval-blocker",
      title: "Close eval failures",
      why: `${plural(failedEvals.length, "eval")} is below the launch bar.`,
      evidenceNeeded: "Passing regression, grounding, permission, prompt-injection, and tool-safety results.",
      targetView: "evals",
      urgency: "now",
      confidence: 92,
    });
  }

  const stageOrders = stages
    .filter((item) => item.score < 82)
    .sort((a, b) => a.score - b.score)
    .map((item, index) => orderForStage(item, index === 0 ? "now" : index === 1 ? "next" : "soon"));

  const orders = [...urgentOrders, ...stageOrders]
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 5);
  const fallbackOrder: TransformationCommandOrder = {
    id: "command-scale-pattern",
    title: "Scale the proven pattern",
    why: "The operating loop has enough proof to turn this into repeatable enterprise capability.",
    evidenceNeeded: "Pattern package, launch memo, controls, ROI model, adoption plan, and executive decision.",
    targetView: "reports",
    urgency: "now",
    confidence: 90,
  };
  const nextAction = orders[0] ?? fallbackOrder;

  const directive =
    posture === "empty"
      ? "Create the first operating loop"
      : posture === "forming"
        ? `Close the ${weakestStage.label.toLowerCase()} gap`
        : posture === "command-ready"
          ? "Move from controlled pilot to measurable value"
          : "Scale reusable AI patterns across functions";
  const whyNow =
    posture === "empty"
      ? "There is not enough live evidence for the OS to command the transformation yet."
      : `${weakestStage.label} is the current constraint at ${weakestStage.score}/100, so improving it raises the whole operating loop.`;
  const operatorBrief = [
    `${directive}.`,
    `${plural(useCases.length, "opportunity", "opportunities")}, ${plural(skills.length, "Skill")}, ${plural(traceableRuns.length, "traceable Harness run")}, ${plural(activeReviews.length, "governance review")}, and ${formatCompactCurrency(metrics.annualValue)} annualized value are visible.`,
    `Next: ${nextAction.title}.`,
  ].join(" ");

  return {
    score,
    posture,
    directive,
    whyNow,
    operatorBrief,
    proofDebt,
    scaleReadiness,
    nextAction,
    stages,
    orders: orders.length ? orders : [fallbackOrder],
    boardProof: [
      {
        label: "Demand",
        value: String(useCases.length + privacySafeSignals.length),
        helper: "Use cases plus privacy-safe work signals.",
        targetView: "factory",
      },
      {
        label: "Governed assets",
        value: String(governedSkills.length),
        helper: "Approved, pilot, or production Skills.",
        targetView: "skills",
      },
      {
        label: "Runtime proof",
        value: String(traceableRuns.length),
        helper: "Harness runs with inspectable traces.",
        targetView: "harness",
      },
      {
        label: "Trust proof",
        value: String(activeReviews.length + passingEvals.length + brokerDecisions.length),
        helper: "Reviews, passing evals, and broker decisions.",
        targetView: "evidence",
      },
      {
        label: "Value proof",
        value: metrics.annualValue ? formatCompactCurrency(metrics.annualValue) : "none",
        helper: "Adoption-adjusted annualized value.",
        targetView: "roi",
      },
    ],
  };
}
