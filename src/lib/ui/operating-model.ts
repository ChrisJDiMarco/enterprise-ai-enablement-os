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

export type OperatingMetrics = {
  totalUseCases: number;
  activePilots: number;
  skills: number;
  adoptionRate: number;
  hoursSaved: number;
  riskItemsOpen: number;
  annualValue: number;
};

export type OperatingStage = {
  id: string;
  label: string;
  view: View;
  complete: boolean;
  active: boolean;
  value: string;
  helper: string;
  evidence: string;
  actionLabel: string;
};

export type ProofRequirement = {
  id: string;
  label: string;
  view: View;
  complete: boolean;
  active: boolean;
  body: string;
  actionLabel: string;
};

export type ActiveInitiative = {
  title: string;
  subtitle: string;
  department: string;
  status: string;
  risk: string;
  owner: string;
  useCase?: UseCase | null;
  skill?: Skill | null;
  runCount: number;
  evalCount: number;
  reviewCount: number;
  auditCount: number;
  proofCount: number;
  openReviewCount: number;
  readinessScore: number;
};

export type OperatingModel = {
  initiative: ActiveInitiative;
  stages: OperatingStage[];
  proofRequirements: ProofRequirement[];
  nextStage?: OperatingStage;
  nextProof?: ProofRequirement;
  completionScore: number;
  proofScore: number;
  headline: string;
  body: string;
  controlPlane: {
    label: string;
    value: string;
    helper: string;
    tone: "green" | "blue" | "amber" | "red" | "purple" | "slate";
    view: View;
  }[];
};

export function deriveOperatingModel({
  useCases,
  skills,
  runs,
  evalResults,
  governanceReviews,
  auditLogs,
  toolRequests = [],
  metrics,
  workflowNodeCount = 0,
  workflowStatus = "Saved",
  selectedUseCase,
  selectedSkill,
  workSignals = [],
}: {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
  auditLogs: AuditLog[];
  toolRequests?: ToolRequest[];
  metrics: OperatingMetrics;
  workflowNodeCount?: number;
  workflowStatus?: string;
  selectedUseCase?: UseCase | null;
  selectedSkill?: Skill | null;
  workSignals?: WorkSignal[];
}): OperatingModel {
  const topUseCase = [...useCases].sort((a, b) => b.priorityScore - a.priorityScore)[0] ?? null;
  const activeSkill =
    selectedSkill ??
    (selectedUseCase?.linkedSkillId ? skills.find((skill) => skill.id === selectedUseCase.linkedSkillId) : null) ??
    (topUseCase?.linkedSkillId ? skills.find((skill) => skill.id === topUseCase.linkedSkillId) : null) ??
    [...skills].sort((a, b) => b.valueDelivered + b.evalPassRate - (a.valueDelivered + a.evalPassRate))[0] ??
    null;
  const activeUseCase =
    selectedUseCase ??
    (activeSkill?.useCaseId ? useCases.find((useCase) => useCase.id === activeSkill.useCaseId) : null) ??
    topUseCase;

  const activeRuns = activeSkill
    ? runs.filter((run) => run.skillId === activeSkill.id)
    : activeUseCase
      ? runs.filter((run) => run.useCaseId === activeUseCase.id)
      : runs;
  const activeEvals = activeSkill ? evalResults.filter((result) => result.skillId === activeSkill.id) : evalResults;
  const activeReviews = [
    ...(activeSkill ? governanceReviews.filter((review) => review.itemId === activeSkill.id) : []),
    ...(activeUseCase ? governanceReviews.filter((review) => review.itemId === activeUseCase.id) : []),
  ];
  const uniqueReviews = Array.from(new Map(activeReviews.map((review) => [review.id, review])).values());
  const openReviewCount = uniqueReviews.filter(
    (review) => ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  ).length;
  const activeToolRequests = activeSkill ? toolRequests.filter((request) => request.skillId === activeSkill.id) : toolRequests;
  const activeAuditLogs = activeSkill
    ? auditLogs.filter((log) => log.message.includes(activeSkill.name) || log.actor === activeSkill.name)
    : activeUseCase
      ? auditLogs.filter((log) => log.message.includes(activeUseCase.title))
    : auditLogs;
  const proofCount = activeRuns.length + activeEvals.length + uniqueReviews.length + activeAuditLogs.length;

  const hasDemandSignal = workSignals.length > 0 || Boolean(activeUseCase);
  const hasBusinessReason = Boolean(activeUseCase);
  const hasSkillContract = Boolean(activeSkill);
  const hasWorkflow = workflowNodeCount > 0 || activeRuns.some((run) => run.trace.length > 2);
  const hasRuntimeTrace = activeRuns.length > 0;
  const hasQuality = activeEvals.length > 0;
  const hasRiskDecision = uniqueReviews.some(
    (review) => ["approved", "approved_with_conditions"].includes(review.status) && review.blockers.length === 0,
  );
  const hasLaunchMotion = metrics.activePilots > 0 || activeSkill?.status === "pilot" || activeSkill?.status === "production";
  const hasValue = metrics.annualValue > 0 || (activeSkill?.valueDelivered ?? 0) > 0 || (activeUseCase?.valueScore ?? 0) > 0;

  const stagesBase = [
    {
      id: "signal",
      label: "Signal",
      view: "work" as View,
      complete: hasDemandSignal,
      value: workSignals.length ? `${workSignals.length} signals` : useCases.length ? `${useCases.length} opportunities` : "No signal yet",
      helper: "Identify repeated work pain before designing an agent.",
      evidence: workSignals.length
        ? "Work metadata is feeding the portfolio."
        : useCases.length
          ? "A business demand signal exists."
          : "Capture a work signal or create the first use case.",
      actionLabel: workSignals.length || useCases.length ? "Inspect signals" : "Capture signal",
    },
    {
      id: "use-case",
      label: "Use case",
      view: "factory" as View,
      complete: hasBusinessReason,
      value: activeUseCase ? `${activeUseCase.priorityScore}/100 priority` : "No scored case",
      helper: "Turn messy demand into owner, value, risk, data, and outcome.",
      evidence: activeUseCase ? activeUseCase.title : "A scored use case is the business reason for every later artifact.",
      actionLabel: activeUseCase ? "Open use case" : "Create use case",
    },
    {
      id: "skill",
      label: "Skill",
      view: "skills" as View,
      complete: hasSkillContract,
      value: activeSkill ? activeSkill.status : "No Skill",
      helper: "Document prompt, model, tools, context, ownership, and policies.",
      evidence: activeSkill ? activeSkill.name : "Convert the use case into a governed Skill contract.",
      actionLabel: activeSkill ? "Open Skill" : "Create Skill",
    },
    {
      id: "workflow",
      label: "Workflow",
      view: "workflow" as View,
      complete: hasWorkflow,
      value: workflowNodeCount ? `${workflowNodeCount} blocks` : workflowStatus,
      helper: "Show how the agent moves through triggers, steps, tools, and approvals.",
      evidence: hasWorkflow ? "Execution flow is mapped." : "Map the flow before launch or automation.",
      actionLabel: "Open workflow",
    },
    {
      id: "runtime",
      label: "Harness run",
      view: "harness" as View,
      complete: hasRuntimeTrace,
      value: activeRuns.length ? `${activeRuns.length} traces` : "No trace",
      helper: "Replay identity, context, model, tools, policy, output, cost, and latency.",
      evidence: activeRuns[0]?.output ?? "Run the Skill through the Harness to prove runtime behavior.",
      actionLabel: activeRuns.length ? "Open traces" : "Run test",
    },
    {
      id: "evals",
      label: "Evals",
      view: "evals" as View,
      complete: hasQuality,
      value: activeEvals.length ? `${activeEvals.length} suites` : "No evals",
      helper: "Score grounding, prompt injection, tool safety, cost, latency, and regression.",
      evidence: activeEvals[0] ? `${activeEvals[0].suiteName}: ${activeEvals[0].score}%` : "Quality proof is required before review.",
      actionLabel: activeEvals.length ? "Open evals" : "Run evals",
    },
    {
      id: "governance",
      label: "Risk decision",
      view: "governance" as View,
      complete: hasRiskDecision,
      value: uniqueReviews.length ? `${openReviewCount} open` : "No review",
      helper: "Record human review, conditions, blockers, and approvals.",
      evidence: uniqueReviews[0]?.title ?? "A reviewer decision makes the launch defensible.",
      actionLabel: uniqueReviews.length ? "Open review" : "Submit review",
    },
    {
      id: "launch",
      label: "Launch",
      view: "launch" as View,
      complete: hasLaunchMotion,
      value: hasLaunchMotion ? "Pilot motion" : "Not launched",
      helper: "Move from approved pilot to rollout with owners, rollback, and communications.",
      evidence: hasLaunchMotion ? "Pilot or production status is visible." : "Launch needs approval, pilot scope, owner, and rollback.",
      actionLabel: "Open launch",
    },
    {
      id: "proof",
      label: "Proof packet",
      view: "evidence" as View,
      complete: proofCount >= 3,
      value: `${proofCount} records`,
      helper: "Package use case, Skill, trace, eval, review, audit, and value evidence.",
      evidence: proofCount >= 3 ? "There is enough evidence to assemble a packet." : "Collect at least trace, eval, and review proof.",
      actionLabel: "Open proof",
    },
    {
      id: "roi",
      label: "ROI",
      view: "roi" as View,
      complete: hasValue,
      value: metrics.annualValue ? money(metrics.annualValue) : activeSkill?.valueDelivered ? money(activeSkill.valueDelivered) : "No value",
      helper: "Tie adoption and time saved to a credible business story.",
      evidence: hasValue ? "A value story exists." : "Add baseline, usage, time saved, or expected benefits.",
      actionLabel: "Open ROI",
    },
  ];
  const nextId = stagesBase.find((stage) => !stage.complete)?.id ?? stagesBase[stagesBase.length - 1]?.id;
  const stages = stagesBase.map((stage) => ({ ...stage, active: stage.id === nextId }));
  const nextStage = stages.find((stage) => stage.active);
  const completionScore = Math.round((stages.filter((stage) => stage.complete).length / stages.length) * 100);

  const proofRequirementsBase = [
    {
      id: "work-signal",
      label: "Work signal",
      view: "work" as View,
      complete: hasDemandSignal,
      body: hasDemandSignal
        ? workSignals.length
          ? "A repeated work signal exists before agent design."
          : "A business demand signal exists through the selected use case."
        : "Capture a repeated work pain, request pattern, or manual demand signal first.",
      actionLabel: hasDemandSignal ? "Open signal" : "Capture signal",
    },
    {
      id: "business-reason",
      label: "Business reason",
      view: "factory" as View,
      complete: hasBusinessReason,
      body: activeUseCase ? `${activeUseCase.title} explains value, feasibility, data, and risk.` : "Create a scored use case first.",
      actionLabel: activeUseCase ? "Open use case" : "Create use case",
    },
    {
      id: "skill-contract",
      label: "Skill contract",
      view: "skills" as View,
      complete: hasSkillContract,
      body: activeSkill ? `${activeSkill.name} documents prompt, model, tools, context, and owner.` : "Create the governed Skill specification.",
      actionLabel: activeSkill ? "Open Skill" : "Create Skill",
    },
    {
      id: "runtime-trace",
      label: "Runtime trace",
      view: "harness" as View,
      complete: hasRuntimeTrace,
      body: hasRuntimeTrace ? "Harness evidence shows the agent's path through runtime controls." : "Run a test to capture trace, cost, latency, and output.",
      actionLabel: hasRuntimeTrace ? "Open trace" : "Run test",
    },
    {
      id: "quality-checks",
      label: "Quality checks",
      view: "evals" as View,
      complete: hasQuality,
      body: hasQuality ? "Eval evidence records score quality and safety." : "Run launch evals before review.",
      actionLabel: hasQuality ? "Open evals" : "Run evals",
    },
    {
      id: "risk-decision",
      label: "Risk decision",
      view: "governance" as View,
      complete: hasRiskDecision,
      body: hasRiskDecision ? "Governance approval is recorded without blockers." : "Record human review and clear blockers.",
      actionLabel: hasRiskDecision ? "Open decision" : "Submit review",
    },
    {
      id: "value-story",
      label: "Value story",
      view: "roi" as View,
      complete: hasValue,
      body: hasValue ? "The packet has value or expected-benefit evidence." : "Add value baseline, adoption, or expected benefits.",
      actionLabel: hasValue ? "Open value" : "Add value",
    },
  ];
  const nextProofId = proofRequirementsBase.find((item) => !item.complete)?.id ?? proofRequirementsBase[proofRequirementsBase.length - 1]?.id;
  const proofRequirements = proofRequirementsBase.map((item) => ({ ...item, active: item.id === nextProofId }));
  const nextProof = proofRequirements.find((item) => item.active);
  const proofScore = Math.round((proofRequirements.filter((item) => item.complete).length / proofRequirements.length) * 100);

  const title = activeSkill?.name ?? activeUseCase?.title ?? "First governed AI initiative";
  const subtitle = activeUseCase?.businessProblem || activeSkill?.description || "Create the first durable work object, then carry it from signal to proof.";
  const readinessScore = Math.round((completionScore + proofScore) / 2);
  const initiative: ActiveInitiative = {
    title,
    subtitle,
    department: activeSkill?.department ?? activeUseCase?.department ?? "AI Enablement",
    status: activeSkill?.status ?? activeUseCase?.status ?? "not_started",
    risk: activeSkill?.riskLevel ?? activeUseCase?.riskLevel ?? "unknown",
    owner: activeSkill?.ownerId ?? activeUseCase?.ownerId ?? activeUseCase?.requestorId ?? "unassigned",
    useCase: activeUseCase,
    skill: activeSkill,
    runCount: activeRuns.length,
    evalCount: activeEvals.length,
    reviewCount: uniqueReviews.length,
    auditCount: activeAuditLogs.length,
    proofCount,
    openReviewCount,
    readinessScore,
  };

  return {
    initiative,
    stages,
    proofRequirements,
    nextStage,
    nextProof,
    completionScore,
    proofScore,
    headline: nextStage ? `${nextStage.label}: ${nextStage.actionLabel.toLowerCase()}` : "Scale the proven pattern",
    body: nextStage?.evidence ?? "The core evidence chain is ready for a leadership packet.",
    controlPlane: [
      {
        label: "Owner",
        value: initiative.owner,
        helper: "single accountable human",
        tone: initiative.owner === "unassigned" ? "amber" : "green",
        view: "admin",
      },
      {
        label: "Risk",
        value: initiative.risk,
        helper: "launch review posture",
        tone: initiative.risk === "high" || initiative.risk === "restricted" ? "red" : initiative.risk === "medium" ? "amber" : "green",
        view: "governance",
      },
      {
        label: "Tools",
        value: activeSkill ? String(activeSkill.allowedTools.length) : "0",
        helper: activeToolRequests.filter((request) => request.status === "pending").length
          ? `${activeToolRequests.filter((request) => request.status === "pending").length} approval pending`
          : "approved connector surface",
        tone: activeSkill?.allowedTools.length ? "blue" : "amber",
        view: "broker",
      },
      {
        label: "Context",
        value: activeSkill ? String(activeSkill.contextSources.length) : "0",
        helper: "permission-aware knowledge",
        tone: activeSkill?.contextSources.length ? "purple" : "amber",
        view: "context",
      },
      {
        label: "Evals",
        value: activeSkill ? `${activeSkill.evalPassRate}%` : activeEvals.length ? `${activeEvals[0]?.score ?? 0}%` : "none",
        helper: "quality gate",
        tone: activeSkill && activeSkill.evalPassRate >= 90 ? "green" : activeEvals.length ? "amber" : "red",
        view: "evals",
      },
      {
        label: "Proof",
        value: String(proofCount),
        helper: nextProof?.label ?? "packet ready",
        tone: proofScore >= 80 ? "green" : proofScore >= 40 ? "amber" : "red",
        view: "evidence",
      },
    ],
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
