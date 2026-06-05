import type { AuditLog, EvalResult, GovernanceReview, Run, Skill, UseCase } from "./enterprise-ai-data.ts";
import type { View } from "./ui/types.ts";

export type EvidenceGraphLayer =
  | "opportunity"
  | "skill"
  | "run"
  | "eval"
  | "governance"
  | "value"
  | "audit";

export type EvidenceGraphStatus = "complete" | "partial" | "attention" | "missing";

export type EvidenceGraphNode = {
  id: string;
  label: string;
  layer: EvidenceGraphLayer;
  status: EvidenceGraphStatus;
  detail: string;
  targetView: View;
  targetId?: string;
  evidenceCount: number;
};

export type EvidenceGraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  status: EvidenceGraphStatus;
};

export type EvidenceGraph = {
  score: number;
  summary: string;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  gaps: string[];
  nextAction?: EvidenceGraphNode;
};

export type EvidenceGraphInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
  auditLogs: AuditLog[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nodeScore(status: EvidenceGraphStatus) {
  if (status === "complete") return 1;
  if (status === "partial") return 0.55;
  if (status === "attention") return 0.35;
  return 0;
}

function edgeStatus(from: EvidenceGraphNode, to: EvidenceGraphNode): EvidenceGraphStatus {
  if (from.status === "missing" || to.status === "missing") return "missing";
  if (from.status === "attention" || to.status === "attention") return "attention";
  if (from.status === "partial" || to.status === "partial") return "partial";
  return "complete";
}

function topUseCase(useCases: UseCase[]) {
  return [...useCases].sort((a, b) => b.priorityScore - a.priorityScore || b.updatedAt.localeCompare(a.updatedAt))[0];
}

function topSkill(skills: Skill[]) {
  return [...skills].sort((a, b) => b.valueDelivered + b.runs + b.evalPassRate - (a.valueDelivered + a.runs + a.evalPassRate))[0];
}

function topRun(runs: Run[]) {
  return [...runs].sort((a, b) => b.trace.length - a.trace.length || b.startedAt.localeCompare(a.startedAt))[0];
}

export function deriveEvidenceGraph(input: EvidenceGraphInput): EvidenceGraph {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const evalResults = input.evalResults ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const auditLogs = input.auditLogs ?? [];

  const bestUseCase = topUseCase(useCases);
  const bestSkill = topSkill(skills);
  const bestRun = topRun(runs);
  const linkedSkills = skills.filter((skill) => skill.useCaseId || useCases.some((useCase) => useCase.linkedSkillId === skill.id));
  const fullTraceRuns = runs.filter((run) => run.trace.length >= 6);
  const passedEvals = evalResults.filter((result) => result.passed && result.score >= 90 && result.criticalFailures === 0);
  const activeReviewBlockers = governanceReviews.filter((review) =>
    review.blockers.length > 0 || ["changes_requested", "rejected"].includes(review.status),
  );
  const approvedReviews = governanceReviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status));
  const valueProofCount =
    useCases.filter((useCase) => useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0 && useCase.valueScore > 0).length +
    skills.filter((skill) => skill.valueDelivered > 0).length;

  const nodes: EvidenceGraphNode[] = [
    {
      id: "opportunity",
      label: "Opportunity portfolio",
      layer: "opportunity",
      status: useCases.length ? "complete" : "missing",
      detail: useCases.length
        ? `${useCases.length} scored opportunity${useCases.length === 1 ? "" : "ies"}; top priority is ${bestUseCase?.title ?? "ready for triage"}.`
        : "Capture or import the first business pain point to start the transformation loop.",
      targetView: "factory",
      targetId: bestUseCase?.id,
      evidenceCount: useCases.length,
    },
    {
      id: "skill",
      label: "Governed Skill package",
      layer: "skill",
      status: skills.length ? (linkedSkills.length ? "complete" : "partial") : "missing",
      detail: skills.length
        ? `${skills.length} Skill${skills.length === 1 ? "" : "s"} in the catalog; ${linkedSkills.length} linked back to a business use case.`
        : "Convert an approved use case into a governed Skill contract.",
      targetView: "skills",
      targetId: bestSkill?.id,
      evidenceCount: skills.length,
    },
    {
      id: "run",
      label: "Harness trace",
      layer: "run",
      status: fullTraceRuns.length ? "complete" : runs.length ? "partial" : "missing",
      detail: fullTraceRuns.length
        ? `${fullTraceRuns.length} run${fullTraceRuns.length === 1 ? "" : "s"} include full runtime trace evidence.`
        : runs.length
          ? `${runs.length} run${runs.length === 1 ? "" : "s"} recorded, but traces are thin.`
          : "Run a Skill through the Harness to capture identity, context, policy, model, tool, approval, and audit steps.",
      targetView: "harness",
      targetId: bestRun?.id,
      evidenceCount: runs.length,
    },
    {
      id: "eval",
      label: "Continuous evaluation",
      layer: "eval",
      status: passedEvals.length ? "complete" : evalResults.length ? "attention" : "missing",
      detail: passedEvals.length
        ? `${passedEvals.length} launch-grade eval artifact${passedEvals.length === 1 ? "" : "s"} passed without critical failures.`
        : evalResults.length
          ? `${evalResults.length} eval artifact${evalResults.length === 1 ? "" : "s"} exist, but at least one needs review.`
          : "Run grounding, permissions, prompt-injection, tool-safety, latency, cost, and regression evals.",
      targetView: "evals",
      evidenceCount: evalResults.length,
    },
    {
      id: "governance",
      label: "Governance decision",
      layer: "governance",
      status: activeReviewBlockers.length ? "attention" : approvedReviews.length ? "complete" : governanceReviews.length ? "partial" : "missing",
      detail: activeReviewBlockers.length
        ? `${activeReviewBlockers.length} review${activeReviewBlockers.length === 1 ? "" : "s"} have blockers or requested changes.`
        : approvedReviews.length
          ? `${approvedReviews.length} review decision${approvedReviews.length === 1 ? "" : "s"} approved or conditionally approved.`
          : governanceReviews.length
            ? `${governanceReviews.length} review${governanceReviews.length === 1 ? "" : "s"} in progress.`
            : "Submit the Skill package for security, privacy, legal, and business review.",
      targetView: "governance",
      targetId: governanceReviews[0]?.id,
      evidenceCount: governanceReviews.length,
    },
    {
      id: "value",
      label: "Measured value proof",
      layer: "value",
      status: valueProofCount ? "complete" : useCases.length || skills.length ? "partial" : "missing",
      detail: valueProofCount
        ? `${valueProofCount} value record${valueProofCount === 1 ? "" : "s"} include baseline volume, time, or delivered value.`
        : "Add baseline volume, handling time, adoption, and value assumptions before claiming ROI.",
      targetView: "roi",
      evidenceCount: valueProofCount,
    },
    {
      id: "audit",
      label: "Exportable audit trail",
      layer: "audit",
      status: auditLogs.length >= 5 ? "complete" : auditLogs.length ? "partial" : "missing",
      detail: auditLogs.length
        ? `${auditLogs.length} immutable audit event${auditLogs.length === 1 ? "" : "s"} available for evidence packets.`
        : "Workspace activity will appear here after real actions, imports, or connector events.",
      targetView: "evidence",
      evidenceCount: auditLogs.length,
    },
  ];

  const edges: EvidenceGraphEdge[] = [
    ["opportunity", "skill", "Use case became a Skill"],
    ["skill", "run", "Skill produced runtime trace"],
    ["run", "eval", "Trace and output evaluated"],
    ["eval", "governance", "Evals informed approval"],
    ["governance", "value", "Approved work measured"],
    ["value", "audit", "Proof packet exported"],
  ].map(([fromId, toId, label]) => {
    const from = nodes.find((node) => node.id === fromId) ?? nodes[0];
    const to = nodes.find((node) => node.id === toId) ?? nodes[0];
    return {
      id: `${fromId}-${toId}`,
      from: fromId,
      to: toId,
      label,
      status: edgeStatus(from, to),
    };
  });

  const gaps = nodes
    .filter((node) => node.status !== "complete")
    .map((node) => {
      if (node.status === "attention") return `${node.label} needs attention: ${node.detail}`;
      return `${node.label}: ${node.detail}`;
    });
  const nextAction = nodes.find((node) => node.status === "attention") ?? nodes.find((node) => node.status === "missing") ?? nodes.find((node) => node.status === "partial");
  const score = clamp((nodes.reduce((sum, node) => sum + nodeScore(node.status), 0) / nodes.length) * 100);

  return {
    score,
    summary: nextAction
      ? `Proof chain is ${score}/100. Next best evidence action: ${nextAction.label}.`
      : `Proof chain is ${score}/100 and ready for executive, governance, and audit packets.`,
    nodes,
    edges,
    gaps,
    nextAction,
  };
}
