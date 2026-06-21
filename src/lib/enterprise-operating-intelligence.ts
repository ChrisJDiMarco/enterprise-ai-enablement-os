import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  Tool,
  UseCase,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { ProductionReadiness, View } from "@/lib/ui/types";

type TimelineEntryKind = "audit" | "run" | "eval" | "review" | "signal" | "use_case" | "skill";

export type EvidenceQuality = {
  score: number;
  status: "thin" | "building" | "launch-grade";
  summary: string;
  gaps: string[];
  nextAction: string;
};

export type OperatingTimelineEntry = {
  id: string;
  kind: TimelineEntryKind;
  title: string;
  detail: string;
  riskLevel?: string;
  targetView: View;
  createdAt: string;
};

export type OperatingTimeline = {
  total: number;
  latestSummary: string;
  entries: OperatingTimelineEntry[];
};

export type ConnectorPosture = {
  status: "unknown" | "missing" | "partial" | "ready";
  readyCount: number;
  requiredCount: number;
  launchReadyCount: number;
  readTestReadyCount: number;
  actionGateReadyCount: number;
  evidenceReadyCount: number;
  summary: string;
  nextAction: string;
  missing: string[];
  proofGaps: string[];
};

export type RoleOperatingMode = {
  role: string;
  lens: "executive" | "operator" | "builder" | "reviewer" | "auditor" | "viewer";
  label: string;
  defaultView: View;
  priorities: string[];
  guardrail: string;
};

export type WorkspaceSetupGuide = {
  readyForGuidedSetup: boolean;
  summary: string;
  questions: string[];
  firstActions: { label: string; targetView: View }[];
};

export type AssistantQualityProgram = {
  score: number;
  status: "needs-evals" | "covered" | "production-ready";
  summary: string;
  checks: { label: string; status: "missing" | "partial" | "covered"; evidence: string }[];
  nextAction: string;
};

function validDate(value: string | undefined) {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function latestDate(...values: (string | undefined)[]) {
  return values.map(validDate).filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? "";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function deriveEvidenceQuality(input: {
  auditLogs?: AuditLog[];
  runs?: Run[];
  evalResults?: EvalResult[];
  governanceReviews?: GovernanceReview[];
  useCases?: UseCase[];
  skills?: Skill[];
  workSignals?: WorkSignal[];
}): EvidenceQuality {
  const auditLogs = input.auditLogs ?? [];
  const runs = input.runs ?? [];
  const evalResults = input.evalResults ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const workSignals = input.workSignals ?? [];
  const gaps: string[] = [];

  const auditScore = auditLogs.length >= 8 ? 15 : auditLogs.length >= 3 ? 10 : auditLogs.length ? 5 : 0;
  if (auditScore < 15) gaps.push("audit trail");

  const completedRuns = runs.filter((run) => run.status === "completed");
  const traceScore = completedRuns.length ? 20 : runs.length ? 10 : 0;
  if (traceScore < 20) gaps.push("completed Harness traces");

  const passedEvals = evalResults.filter((result) => result.passed && result.criticalFailures === 0);
  const avgEvalScore =
    evalResults.length > 0
      ? Math.round(evalResults.reduce((sum, result) => sum + result.score, 0) / evalResults.length)
      : 0;
  const evalScore = passedEvals.length && avgEvalScore >= 85 ? 20 : evalResults.length ? 10 : 0;
  if (evalScore < 20) gaps.push("passing eval evidence");

  const approvedReviews = governanceReviews.filter((review) =>
    ["approved", "approved_with_conditions"].includes(review.status),
  );
  const governanceScore = approvedReviews.length ? 20 : governanceReviews.length ? 10 : 0;
  if (governanceScore < 20) gaps.push("reviewer decision");

  const linkedSkills = skills.filter((skill) => skill.useCaseId || useCases.some((useCase) => useCase.linkedSkillId === skill.id));
  const linkageScore = linkedSkills.length && useCases.length ? 10 : skills.length || useCases.length ? 5 : 0;
  if (linkageScore < 10) gaps.push("use case to Skill linkage");

  const valueEvidence =
    skills.some((skill) => skill.valueDelivered > 0 || skill.adoptionCount > 0) ||
    useCases.some((useCase) => useCase.expectedBenefits.length > 0) ||
    workSignals.length > 0;
  const valueScore = valueEvidence ? 15 : 0;
  if (!valueEvidence) gaps.push("adoption or value proof");

  const score = clampScore(auditScore + traceScore + evalScore + governanceScore + linkageScore + valueScore);
  const status = score >= 80 ? "launch-grade" : score >= 50 ? "building" : "thin";
  const summary =
    status === "launch-grade"
      ? `Evidence quality is launch-grade at ${score}/100: traces, evals, reviews, audit, linkage, and value proof are mostly present.`
      : status === "building"
        ? `Evidence quality is building at ${score}/100: useful proof exists, but ${gaps.slice(0, 3).join(", ")} still need attention.`
        : `Evidence quality is thin at ${score}/100: the workspace needs traceable proof before a major-company launch review.`;

  return {
    score,
    status,
    summary,
    gaps: [...new Set(gaps)],
    nextAction:
      gaps[0] === "completed Harness traces"
        ? "Run the selected Skill through the Harness and attach the trace."
        : gaps[0] === "passing eval evidence"
          ? "Run launch-grade evals and clear critical failures."
          : gaps[0] === "reviewer decision"
            ? "Submit or resolve governance review."
            : gaps[0] === "adoption or value proof"
              ? "Attach adoption, time-saved, or value evidence to the Proof Ledger."
              : "Package the proof into an executive-ready evidence packet.",
  };
}

export function deriveOperatingTimeline(input: {
  auditLogs?: AuditLog[];
  runs?: Run[];
  evalResults?: EvalResult[];
  governanceReviews?: GovernanceReview[];
  useCases?: UseCase[];
  skills?: Skill[];
  workSignals?: WorkSignal[];
  limit?: number;
}): OperatingTimeline {
  const entries: OperatingTimelineEntry[] = [];

  for (const log of input.auditLogs ?? []) {
    entries.push({
      id: log.id,
      kind: "audit",
      title: log.eventType.replace(/_/g, " "),
      detail: log.message,
      riskLevel: log.riskLevel,
      targetView: "evidence",
      createdAt: validDate(log.createdAt),
    });
  }

  for (const run of input.runs ?? []) {
    entries.push({
      id: run.id,
      kind: "run",
      title: `Harness run ${run.status}`,
      detail: `${run.currentStage || "Runtime trace"} for Skill ${run.skillId}.`,
      riskLevel: run.riskLevel,
      targetView: "harness",
      createdAt: validDate(run.startedAt),
    });
  }

  for (const result of input.evalResults ?? []) {
    entries.push({
      id: result.id,
      kind: "eval",
      title: `${result.suiteName} eval ${result.passed ? "passed" : "needs work"}`,
      detail: `${result.score}/100 with ${result.criticalFailures} critical failure(s).`,
      targetView: "evals",
      createdAt: validDate(result.createdAt),
    });
  }

  for (const review of input.governanceReviews ?? []) {
    entries.push({
      id: review.id,
      kind: "review",
      title: `Governance ${review.status.replace(/_/g, " ")}`,
      detail: `${review.title}: ${review.blockers.length ? review.blockers.join(", ") : "no blockers recorded"}.`,
      riskLevel: review.riskLevel,
      targetView: "governance",
      createdAt: latestDate(review.dueDate),
    });
  }

  for (const signal of input.workSignals ?? []) {
    entries.push({
      id: signal.id,
      kind: "signal",
      title: `Work signal: ${signal.process}`,
      detail: signal.summary,
      riskLevel: signal.riskLevel,
      targetView: "work",
      createdAt: validDate(signal.createdAt),
    });
  }

  for (const useCase of input.useCases ?? []) {
    entries.push({
      id: useCase.id,
      kind: "use_case",
      title: `Use case ${useCase.status.replace(/_/g, " ")}`,
      detail: `${useCase.title} scored ${useCase.priorityScore}/100.`,
      riskLevel: useCase.riskLevel,
      targetView: "factory",
      createdAt: latestDate(useCase.updatedAt, useCase.createdAt),
    });
  }

  for (const skill of input.skills ?? []) {
    entries.push({
      id: skill.id,
      kind: "skill",
      title: `Skill ${skill.status.replace(/_/g, " ")}`,
      detail: `${skill.name}: ${skill.evalPassRate}% eval pass rate, ${skill.runs} run(s).`,
      riskLevel: skill.riskLevel,
      targetView: "skills",
      createdAt: validDate(skill.updatedAt),
    });
  }

  const sorted = entries
    .filter((entry) => entry.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const visible = sorted.slice(0, input.limit ?? 8);

  return {
    total: entries.length,
    latestSummary: visible[0]
      ? `${visible[0].title}: ${visible[0].detail}`
      : "No operating activity has been recorded yet.",
    entries: visible,
  };
}

export function deriveConnectorPosture(input: {
  productionReadiness?: ProductionReadiness | null;
  tools?: Tool[];
  contextSources?: ContextSource[];
}): ConnectorPosture {
  const catalog = input.productionReadiness?.connectors?.catalog;
  if (catalog) {
    const launchReadyConnectors = catalog.connectors.filter((connector) =>
      ["ready", "broker-managed"].includes(connector.status) &&
      (connector.activationChecklist?.length
        ? connector.activationChecklist.every((item) => item.status === "complete")
        : true),
    );
    const checklistComplete = (id: string) =>
      catalog.connectors.filter((connector) =>
        connector.activationChecklist?.some((item) => item.id === id && item.status === "complete"),
      ).length;
    const unreadyConnectors = catalog.connectors.filter((connector) => !["ready", "broker-managed"].includes(connector.status));
    const proofGapConnectors = catalog.connectors.filter((connector) =>
      ["ready", "broker-managed"].includes(connector.status) &&
      connector.activationChecklist?.some((item) => item.status === "pending"),
    );
    const missing = unreadyConnectors.map((connector) => connector.label).slice(0, 6);
    const proofGaps = proofGapConnectors
      .map((connector) => {
        const pending = connector.activationChecklist?.find((item) => item.status === "pending");
        return pending ? `${connector.label}: ${pending.label}` : connector.label;
      })
      .slice(0, 6);
    const status =
      launchReadyConnectors.length >= catalog.requiredCount
        ? "ready"
        : catalog.readyCount > 0 || proofGapConnectors.length
          ? "partial"
          : "missing";
    const nextUnready = unreadyConnectors[0];
    const nextProofGap = proofGapConnectors[0];
    const nextPendingProof = nextProofGap?.activationChecklist?.find((item) => item.status === "pending");
    return {
      status,
      readyCount: catalog.readyCount,
      requiredCount: catalog.requiredCount,
      launchReadyCount: launchReadyConnectors.length,
      readTestReadyCount: checklistComplete("read-test"),
      actionGateReadyCount: checklistComplete("action-gate"),
      evidenceReadyCount: checklistComplete("evidence"),
      summary: `${catalog.readyCount}/${catalog.requiredCount} connectors ready or broker-managed; ${launchReadyConnectors.length}/${catalog.requiredCount} have complete launch proof.`,
      nextAction: nextUnready
        ? `Activate ${nextUnready.label}: ${nextUnready.nextActivationAction ?? nextUnready.setupAction}`
        : nextProofGap && nextPendingProof
          ? `Prove ${nextProofGap.label}: ${nextPendingProof.action}`
          : "Connector plane is launch-ready. Keep scopes, broker routes, and evidence under recurring review.",
      missing,
      proofGaps,
    };
  }

  const enabledTools = (input.tools ?? []).filter((tool) => tool.enabled).length;
  const healthySources = (input.contextSources ?? []).filter((source) => source.enabled && source.health === "healthy").length;
  const readyCount = enabledTools + healthySources;
  return {
    status: readyCount ? "partial" : "unknown",
    readyCount,
    requiredCount: 3,
    launchReadyCount: 0,
    readTestReadyCount: 0,
    actionGateReadyCount: 0,
    evidenceReadyCount: 0,
    summary: readyCount
      ? `${readyCount} enabled tool/source connection(s) are visible, but connector readiness has not been certified.`
      : "Connector readiness is unknown until Connect Apps or production readiness runs.",
    nextAction: "Open Connect Apps, configure one work-system connector, and rerun readiness.",
    missing: [],
    proofGaps: readyCount ? ["Connector catalog readiness not certified"] : [],
  };
}

export function deriveRoleOperatingMode(role: string | undefined): RoleOperatingMode {
  const normalized = (role || "viewer").toLowerCase();
  if (normalized.includes("director") || normalized.includes("admin")) {
    return {
      role: normalized,
      lens: "operator",
      label: normalized.includes("admin") ? "Workspace Admin" : "AI Enablement Director",
      defaultView: "command",
      priorities: ["clear command orders", "remove launch blockers", "connect enterprise stack", "package executive proof"],
      guardrail: "Can coordinate the OS, but high-impact execution still needs visible approval and evidence.",
    };
  }
  if (normalized.includes("governance") || normalized.includes("security") || normalized.includes("legal") || normalized.includes("privacy")) {
    return {
      role: normalized,
      lens: "reviewer",
      label: "Reviewer",
      defaultView: "governance",
      priorities: ["review risk evidence", "inspect traces and evals", "approve or request changes", "check control mapping"],
      guardrail: "Should focus on decision evidence and avoid changing build artifacts directly.",
    };
  }
  if (normalized.includes("builder")) {
    return {
      role: normalized,
      lens: "builder",
      label: "AI Builder",
      defaultView: "factory",
      priorities: ["draft use cases", "convert Skills", "build workflows", "run Harness and evals"],
      guardrail: "Can build and test, but launch, tool writes, and governance decisions remain approval-gated.",
    };
  }
  if (normalized.includes("auditor")) {
    return {
      role: normalized,
      lens: "auditor",
      label: "Auditor",
      defaultView: "evidence",
      priorities: ["inspect evidence packets", "verify audit chain", "sample trace records", "review control coverage"],
      guardrail: "Should receive read-mostly proof views and reviewer-ready exports.",
    };
  }
  if (normalized.includes("executive")) {
    return {
      role: normalized,
      lens: "executive",
      label: "Executive",
      defaultView: "roi",
      priorities: ["readiness", "risk posture", "business value", "rollout progress"],
      guardrail: "Should see concise decisions, not builder-level implementation detail by default.",
    };
  }
  return {
    role: normalized,
    lens: "viewer",
    label: "Viewer",
    defaultView: "command",
    priorities: ["understand current status", "ask questions", "open assigned proof"],
    guardrail: "Can inspect and ask, but should not execute workspace-changing actions.",
  };
}

export function deriveWorkspaceSetupGuide(input: {
  useCases?: UseCase[];
  skills?: Skill[];
  runs?: Run[];
  auditLogs?: AuditLog[];
  governanceReviews?: GovernanceReview[];
  workSignals?: WorkSignal[];
  tools?: Tool[];
  contextSources?: ContextSource[];
}): WorkspaceSetupGuide {
  const total =
    (input.useCases?.length ?? 0) +
    (input.skills?.length ?? 0) +
    (input.runs?.length ?? 0) +
    (input.auditLogs?.length ?? 0) +
    (input.governanceReviews?.length ?? 0) +
    (input.workSignals?.length ?? 0);
  const readyForGuidedSetup = total === 0;
  return {
    readyForGuidedSetup,
    summary: readyForGuidedSetup
      ? "This workspace is ready for guided company setup."
      : "This workspace already has operating records; setup should focus on gaps rather than starting over.",
    questions: [
      "Which business functions should be in the first 90-day AI rollout?",
      "Which existing systems hold work demand, knowledge, approvals, and customer records?",
      "Which AI tools or agents already exist, including shadow AI?",
      "Which risk boundaries are non-negotiable: data classes, tool writes, external communication, or human approvals?",
      "Which outcome matters first: cycle time, quality, cost, compliance, revenue, or employee experience?",
    ],
    firstActions: [
      { label: "Map company blueprint", targetView: "blueprint" },
      { label: "Connect identity and providers", targetView: "admin" },
      { label: "Capture first work signal", targetView: "work" },
      { label: "Create first use case", targetView: "factory" },
      { label: "Open connector plan", targetView: "connectors" },
    ],
  };
}

export function deriveAssistantQualityProgram(input: {
  evidenceQuality: EvidenceQuality;
  hasActionButtons: boolean;
  hasSafeActionGates: boolean;
  hasInterpretationEvidence: boolean;
  hasWorkspaceContext: boolean;
}): AssistantQualityProgram {
  const checks = [
    {
      label: "Intent interpretation",
      status: input.hasInterpretationEvidence ? "covered" : "partial",
      evidence: input.hasInterpretationEvidence ? "Responses expose interpreted goal and confidence." : "Interpretation should be visible in proof evidence.",
    },
    {
      label: "Workspace grounding",
      status: input.hasWorkspaceContext ? "covered" : "missing",
      evidence: input.hasWorkspaceContext ? "Planner receives trusted workspace counts and selected records." : "Planner lacks workspace context.",
    },
    {
      label: "Actionability",
      status: input.hasActionButtons ? "covered" : "partial",
      evidence: input.hasActionButtons ? "Responses can return typed action buttons." : "Responses need visible next actions.",
    },
    {
      label: "Human approval",
      status: input.hasSafeActionGates ? "covered" : "partial",
      evidence: input.hasSafeActionGates ? "High-impact actions are approval-gated." : "High-impact actions should require confirmation.",
    },
    {
      label: "Evidence quality",
      status: input.evidenceQuality.score >= 80 ? "covered" : input.evidenceQuality.score >= 50 ? "partial" : "missing",
      evidence: input.evidenceQuality.summary,
    },
  ] as const;
  const score = clampScore(
    checks.reduce((sum, check) => sum + (check.status === "covered" ? 20 : check.status === "partial" ? 10 : 0), 0),
  );
  return {
    score,
    status: score >= 90 ? "production-ready" : score >= 60 ? "covered" : "needs-evals",
    summary:
      score >= 90
        ? "Assistant quality is production-ready for governed workspace operation."
        : score >= 60
          ? "Assistant quality is covered for guided operation, but eval and proof coverage should improve before broad rollout."
          : "Assistant quality needs a formal eval harness before broad rollout.",
    checks: checks.map((check) => ({ ...check })),
    nextAction:
      score >= 90
        ? "Keep running regression prompts after every planner change."
        : "Add eval cases for intent routing, unsafe action blocking, workspace grounding, and missing-proof recommendations.",
  };
}
