import type { ContextSource, Department, RiskLevel, Run, Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";

type SignalAggregate = {
  key: string;
  department: Department;
  process: string;
  volume: number;
  count: number;
  avgDelayHours: number;
  avgCycleTimeHours: number;
  confidence: number;
  riskLevel: RiskLevel;
  summaries: string[];
  relatedUseCaseIds: string[];
  relatedSkillIds: string[];
};

export type WorkOpportunity = SignalAggregate & {
  recommendedPattern: "Knowledge Skill" | "Workflow Redesign" | "Agentic Workflow" | "Training / Change" | "Context Remediation";
  score: number;
  recommendedAction: string;
};

export type WorkOpportunityIntakeDraft = {
  title: string;
  department: Department;
  businessProblem: string;
  currentProcess: string;
  desiredOutcome: string;
  aiHelp: string;
  aiNotDo: string;
  monthlyVolume: number;
  avgHandlingTimeMinutes: number;
  estimatedUsers: number;
  dataSensitivity: RiskLevel;
  dataSources: string;
  humanReview: boolean;
  externalCommunication: boolean;
};

export type ProcessInsight = {
  process: string;
  department: Department;
  delays: number;
  rework: number;
  variants: number;
  avgCycleTimeHours: number;
  recommendation: string;
};

export type AdoptionInsight = {
  department: Department;
  signals: number;
  skillUses: number;
  trainingCompletions: number;
  positiveFeedback: number;
  negativeFeedback: number;
  adoptionHealth: "strong" | "building" | "needs attention";
  recommendation: string;
};

export type ContextQualityInsight = {
  sourceName: string;
  department: Department;
  gapSignals: number;
  sourceHealth: string;
  classification: string;
  recommendation: string;
};

export type SkillLearningInsight = {
  skillId: string;
  skillName: string;
  signals: number;
  successfulRuns: number;
  needsTuning: boolean;
  recommendation: string;
};

export type ExecutiveDecision = {
  id: string;
  label: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type WorkIntelligenceSummary = {
  totals: {
    signals: number;
    departments: number;
    processes: number;
    avgDelayHours: number;
    opportunityCandidates: number;
    privacyCoverage: number;
  };
  opportunityRadar: WorkOpportunity[];
  processInsights: ProcessInsight[];
  adoptionInsights: AdoptionInsight[];
  contextQuality: ContextQualityInsight[];
  skillLearning: SkillLearningInsight[];
  executiveDecisions: ExecutiveDecision[];
  privacyPosture: {
    allContentRedacted: boolean;
    allPiiRedacted: boolean;
    rawContentStored: boolean;
    individualScoringAllowed: boolean;
    maxRetentionDays: number;
    consentBases: string[];
  };
};

const riskRank: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  restricted: 4,
};

function riskMax(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskRank[a] >= riskRank[b] ? a : b;
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function signalVolume(signal: WorkSignal) {
  return signal.metadata.volume ?? signal.metadata.count ?? 1;
}

function pushUnique(target: string[], value?: string) {
  if (value && !target.includes(value)) target.push(value);
}

function opportunityPattern(signals: WorkSignal[]): WorkOpportunity["recommendedPattern"] {
  if (signals.some((signal) => signal.eventType === "context_gap")) return "Context Remediation";
  if (signals.some((signal) => signal.eventType === "workflow_delayed" || signal.eventType === "handoff_delayed")) {
    return "Workflow Redesign";
  }
  if (signals.some((signal) => signal.eventType === "approval_waiting" || signal.eventType === "rework_detected")) {
    return "Agentic Workflow";
  }
  if (signals.some((signal) => signal.eventType === "question_asked")) return "Knowledge Skill";
  if (signals.some((signal) => signal.eventType === "training_completed" || signal.eventType === "feedback_given")) {
    return "Training / Change";
  }
  return "Knowledge Skill";
}

function opportunityAction(pattern: WorkOpportunity["recommendedPattern"], process: string) {
  if (pattern === "Context Remediation") return `Refresh and permission-test the source set behind ${process}.`;
  if (pattern === "Workflow Redesign") return `Open Process Studio and model the future-state swimlane for ${process}.`;
  if (pattern === "Agentic Workflow") return `Design a human-gated workflow and approval policy for ${process}.`;
  if (pattern === "Training / Change") return `Create an adoption intervention and champion plan for ${process}.`;
  return `Create a reusable grounded Skill for ${process}.`;
}

function capabilityPhrase(pattern: WorkOpportunity["recommendedPattern"]) {
  if (pattern === "Context Remediation") return "permission-aware retrieval and source-quality remediation";
  if (pattern === "Workflow Redesign") return "future-state process redesign with AI-assisted handoffs";
  if (pattern === "Agentic Workflow") return "a governed agentic workflow with approval gates";
  if (pattern === "Training / Change") return "targeted enablement, champions, and adoption nudges";
  return "a grounded reusable AI Skill with citations and escalation paths";
}

function buildOpportunityRadar(workSignals: WorkSignal[]): WorkOpportunity[] {
  const byProcess = new Map<string, { aggregate: SignalAggregate; signals: WorkSignal[] }>();

  workSignals.forEach((signal) => {
    const key = `${signal.department}:${signal.process}`;
    const current = byProcess.get(key);
    const volume = signalVolume(signal);
    if (!current) {
      byProcess.set(key, {
        aggregate: {
          key,
          department: signal.department,
          process: signal.process,
          volume,
          count: 1,
          avgDelayHours: signal.metadata.delayHours ?? 0,
          avgCycleTimeHours: signal.metadata.cycleTimeHours ?? 0,
          confidence: signal.metadata.confidence ?? 0.7,
          riskLevel: signal.riskLevel,
          summaries: [signal.summary],
          relatedUseCaseIds: signal.metadata.relatedUseCaseId ? [signal.metadata.relatedUseCaseId] : [],
          relatedSkillIds: signal.metadata.relatedSkillId ? [signal.metadata.relatedSkillId] : [],
        },
        signals: [signal],
      });
      return;
    }

    current.signals.push(signal);
    current.aggregate.volume += volume;
    current.aggregate.count += 1;
    current.aggregate.avgDelayHours = average(current.signals.map((item) => item.metadata.delayHours ?? 0));
    current.aggregate.avgCycleTimeHours = average(current.signals.map((item) => item.metadata.cycleTimeHours ?? 0));
    current.aggregate.confidence = average(current.signals.map((item) => item.metadata.confidence ?? 0.7));
    current.aggregate.riskLevel = riskMax(current.aggregate.riskLevel, signal.riskLevel);
    current.aggregate.summaries = current.signals.slice(0, 3).map((item) => item.summary);
    pushUnique(current.aggregate.relatedUseCaseIds, signal.metadata.relatedUseCaseId);
    pushUnique(current.aggregate.relatedSkillIds, signal.metadata.relatedSkillId);
  });

  return [...byProcess.values()]
    .map(({ aggregate, signals }) => {
      const pattern = opportunityPattern(signals);
      const score = Math.min(
        100,
        Math.round(
          20 +
            Math.log10(aggregate.volume + 1) * 14 +
            aggregate.count * 5 +
            Math.min(aggregate.avgDelayHours, 48) * 0.7 +
            Math.min(aggregate.avgCycleTimeHours, 120) * 0.1 +
            aggregate.confidence * 10 -
            riskRank[aggregate.riskLevel] * 3,
        ),
      );

      return {
        ...aggregate,
        recommendedPattern: pattern,
        recommendedAction: opportunityAction(pattern, aggregate.process),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildProcessInsights(workSignals: WorkSignal[]): ProcessInsight[] {
  const processes = new Map<string, WorkSignal[]>();
  workSignals.forEach((signal) => {
    const key = `${signal.department}:${signal.process}`;
    processes.set(key, [...(processes.get(key) ?? []), signal]);
  });

  return [...processes.values()]
    .map((signals) => {
      const first = signals[0];
      const delays = signals.filter((signal) => signal.eventType === "workflow_delayed" || signal.eventType === "handoff_delayed").length;
      const rework = signals.filter((signal) => signal.eventType === "rework_detected").length;
      const variants = signals.filter((signal) => signal.eventType === "process_variant").length;
      const avgCycleTimeHours = average(signals.map((signal) => signal.metadata.cycleTimeHours ?? 0));
      const recommendation =
        delays || rework
          ? "Map current and future-state handoffs before adding automation."
          : variants
            ? "Standardize the process variant before scaling a Skill."
            : "Monitor for repeatable pain before redesign investment.";

      return {
        process: first.process,
        department: first.department,
        delays,
        rework,
        variants,
        avgCycleTimeHours,
        recommendation,
      };
    })
    .sort((a, b) => b.delays + b.rework + b.variants - (a.delays + a.rework + a.variants))
    .slice(0, 6);
}

function buildAdoptionInsights(workSignals: WorkSignal[]): AdoptionInsight[] {
  const byDepartment = new Map<Department, WorkSignal[]>();
  workSignals.forEach((signal) => {
    byDepartment.set(signal.department, [...(byDepartment.get(signal.department) ?? []), signal]);
  });

  return [...byDepartment.entries()]
    .map(([department, signals]) => {
      const skillUses = signals.filter((signal) => signal.eventType === "skill_used").reduce((sum, signal) => sum + signalVolume(signal), 0);
      const trainingCompletions = signals
        .filter((signal) => signal.eventType === "training_completed")
        .reduce((sum, signal) => sum + signalVolume(signal), 0);
      const positiveFeedback = signals.filter((signal) => signal.metadata.sentiment === "positive").length;
      const negativeFeedback = signals.filter((signal) => signal.metadata.sentiment === "negative").length;
      const adoptionHealth: AdoptionInsight["adoptionHealth"] =
        skillUses >= 100 && positiveFeedback >= negativeFeedback
          ? "strong"
          : trainingCompletions || skillUses
            ? "building"
            : "needs attention";

      return {
        department,
        signals: signals.length,
        skillUses,
        trainingCompletions,
        positiveFeedback,
        negativeFeedback,
        adoptionHealth,
        recommendation:
          adoptionHealth === "strong"
            ? "Capture reusable patterns and expand champions."
            : adoptionHealth === "building"
              ? "Pair enablement sessions with one high-volume Skill."
              : "Run stakeholder discovery before pushing adoption targets.",
      };
    })
    .sort((a, b) => b.skillUses + b.trainingCompletions - (a.skillUses + a.trainingCompletions));
}

function buildContextQuality(workSignals: WorkSignal[], contextSources: ContextSource[]): ContextQualityInsight[] {
  const gaps = workSignals.filter((signal) => signal.eventType === "context_gap" || signal.metadata.relatedContextSource);
  const bySource = new Map<string, WorkSignal[]>();
  gaps.forEach((signal) => {
    const source = signal.metadata.relatedContextSource ?? "Unmapped source";
    bySource.set(source, [...(bySource.get(source) ?? []), signal]);
  });

  contextSources
    .filter((source) => source.health !== "healthy")
    .forEach((source) => {
      if (!bySource.has(source.name)) bySource.set(source.name, []);
    });

  return [...bySource.entries()]
    .map(([sourceName, signals]) => {
      const source = contextSources.find((item) => item.name === sourceName || item.id === sourceName);
      const department = source?.ownerDepartment ?? signals[0]?.department ?? "Other";
      const sourceHealth = source?.health ?? "gap reported";
      return {
        sourceName,
        department,
        gapSignals: signals.length,
        sourceHealth,
        classification: source?.classification ?? "unknown",
        recommendation:
          sourceHealth === "stale"
            ? "Refresh the index and attach freshness evidence before launch."
            : signals.length
              ? "Run retrieval tests, add missing citations, and request owner approval."
              : "Review source ownership and ingestion health.",
      };
    })
    .sort((a, b) => b.gapSignals - a.gapSignals)
    .slice(0, 6);
}

function buildSkillLearning(workSignals: WorkSignal[], skills: Skill[], runs: Run[]): SkillLearningInsight[] {
  const skillIds = new Set<string>();
  workSignals.forEach((signal) => {
    if (signal.metadata.relatedSkillId) skillIds.add(signal.metadata.relatedSkillId);
  });
  skills.forEach((skill) => {
    if (workSignals.some((signal) => signal.metadata.relatedSkillId === skill.id) || runs.some((run) => run.skillId === skill.id)) {
      skillIds.add(skill.id);
    }
  });

  return [...skillIds]
    .map((skillId) => {
      const skill = skills.find((item) => item.id === skillId);
      const relatedSignals = workSignals.filter((signal) => signal.metadata.relatedSkillId === skillId);
      const relatedRuns = runs.filter((run) => run.skillId === skillId);
      const negativeFeedback = relatedSignals.filter((signal) => signal.metadata.sentiment === "negative").length;
      const contextGaps = relatedSignals.filter((signal) => signal.eventType === "context_gap").length;
      const blockedRuns = relatedRuns.filter((run) => run.status === "blocked" || run.status === "failed").length;
      const needsTuning = negativeFeedback > 0 || contextGaps > 0 || blockedRuns > 0 || (skill?.evalPassRate ?? 100) < 90;

      return {
        skillId,
        skillName: skill?.name ?? skillId,
        signals: relatedSignals.length,
        successfulRuns: relatedRuns.filter((run) => run.status === "completed").length,
        needsTuning,
        recommendation: needsTuning
          ? "Open prompt, context, eval, and policy evidence before scaling."
          : "Candidate for reusable pattern packaging.",
      };
    })
    .sort((a, b) => Number(b.needsTuning) - Number(a.needsTuning) || b.signals - a.signals)
    .slice(0, 6);
}

function buildExecutiveDecisions(params: {
  opportunities: WorkOpportunity[];
  processInsights: ProcessInsight[];
  contextQuality: ContextQualityInsight[];
  privacyPosture: WorkIntelligenceSummary["privacyPosture"];
  useCases: UseCase[];
}): ExecutiveDecision[] {
  const decisions: ExecutiveDecision[] = [];
  const topOpportunity = params.opportunities[0];
  const topDelay = params.processInsights.find((insight) => insight.delays || insight.rework);
  const topContextGap = params.contextQuality[0];

  if (topOpportunity) {
    decisions.push({
      id: "decision-top-opportunity",
      label: `Prioritize ${topOpportunity.process}`,
      detail: `${topOpportunity.department} has the highest rule-based priority score (${topOpportunity.score}/100). ${topOpportunity.recommendedAction}`,
      priority: topOpportunity.score > 70 ? "high" : "medium",
    });
  }

  if (topDelay) {
    decisions.push({
      id: "decision-process-redesign",
      label: `Redesign ${topDelay.process}`,
      detail: `${topDelay.delays + topDelay.rework} delay or rework signals indicate the process should be redesigned before more automation.`,
      priority: "medium",
    });
  }

  if (topContextGap && (topContextGap.gapSignals || topContextGap.sourceHealth === "stale")) {
    decisions.push({
      id: "decision-context-quality",
      label: `Fix ${topContextGap.sourceName}`,
      detail: `${topContextGap.sourceName} is ${topContextGap.sourceHealth}; resolve source quality before launching dependent Skills.`,
      priority: topContextGap.classification === "regulated" || topContextGap.classification === "restricted" ? "high" : "medium",
    });
  }

  if (params.privacyPosture.rawContentStored || params.privacyPosture.individualScoringAllowed) {
    decisions.push({
      id: "decision-privacy-stop",
      label: "Stop unsafe signal capture",
      detail: "At least one work signal violates the OS privacy guardrails. Disable raw content storage and individual scoring before proceeding.",
      priority: "high",
    });
  }

  const unlinkedHighPriority = params.useCases.filter((useCase) => useCase.priorityScore >= 75 && !useCase.linkedSkillId);
  if (unlinkedHighPriority.length) {
    decisions.push({
      id: "decision-industrialize",
      label: "Industrialize high-priority use cases",
      detail: `${unlinkedHighPriority.length} high-priority opportunities are not yet converted into reusable Skills.`,
      priority: "medium",
    });
  }

  return decisions.slice(0, 6);
}

export function deriveWorkIntelligence({
  workSignals,
  useCases,
  skills,
  runs,
  contextSources,
}: {
  workSignals: WorkSignal[];
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  contextSources: ContextSource[];
}): WorkIntelligenceSummary {
  const opportunityRadar = buildOpportunityRadar(workSignals);
  const processInsights = buildProcessInsights(workSignals);
  const adoptionInsights = buildAdoptionInsights(workSignals);
  const contextQuality = buildContextQuality(workSignals, contextSources);
  const skillLearning = buildSkillLearning(workSignals, skills, runs);
  const allContentRedacted = workSignals.every((signal) => signal.privacy.contentRedacted);
  const allPiiRedacted = workSignals.every((signal) => signal.privacy.piiRedacted);
  const rawContentStored = workSignals.some((signal) => Boolean(signal.privacy.rawContentStored));
  const individualScoringAllowed = workSignals.some((signal) => Boolean(signal.privacy.individualScoringAllowed));
  const retentionDays = workSignals.map((signal) => signal.privacy.retentionDays).filter((value) => Number.isFinite(value));
  const privacyCoverage = workSignals.length
    ? Math.round(
        (workSignals.filter(
          (signal) =>
            signal.privacy.contentRedacted &&
            signal.privacy.piiRedacted &&
            !signal.privacy.rawContentStored &&
            !signal.privacy.individualScoringAllowed,
        ).length /
          workSignals.length) *
          100,
      )
    : 100;
  const privacyPosture = {
    allContentRedacted,
    allPiiRedacted,
    rawContentStored,
    individualScoringAllowed,
    maxRetentionDays: retentionDays.length ? Math.max(...retentionDays) : 0,
    consentBases: [...new Set(workSignals.map((signal) => signal.privacy.consentBasis))],
  };

  return {
    totals: {
      signals: workSignals.length,
      departments: new Set(workSignals.map((signal) => signal.department)).size,
      processes: new Set(workSignals.map((signal) => `${signal.department}:${signal.process}`)).size,
      avgDelayHours: Math.round(average(workSignals.map((signal) => signal.metadata.delayHours ?? 0)) * 10) / 10,
      opportunityCandidates: opportunityRadar.length,
      privacyCoverage,
    },
    opportunityRadar,
    processInsights,
    adoptionInsights,
    contextQuality,
    skillLearning,
    executiveDecisions: buildExecutiveDecisions({
      opportunities: opportunityRadar,
      processInsights,
      contextQuality,
      privacyPosture,
      useCases,
    }),
    privacyPosture,
  };
}

export function workOpportunityToIntakeDraft(opportunity: WorkOpportunity): WorkOpportunityIntakeDraft {
  const minutesFromCycleTime = opportunity.avgCycleTimeHours ? Math.max(8, Math.round(opportunity.avgCycleTimeHours * 12)) : 20;
  const estimatedUsers = Math.max(25, Math.min(2000, Math.round(opportunity.volume / 12)));
  const signalSummary = opportunity.summaries.slice(0, 2).join(" ");
  const isExternal = /customer|vendor|supplier|external|client/i.test(`${opportunity.process} ${signalSummary}`);
  const dataSources = [
    opportunity.department,
    opportunity.recommendedPattern === "Context Remediation" ? "Context Fabric source catalog" : "Approved work-system metadata",
    "Harness evidence ledger",
  ];

  return {
    title: `${opportunity.process} ${opportunity.recommendedPattern}`,
    department: opportunity.department,
    businessProblem: `${opportunity.department} shows ${opportunity.volume.toLocaleString()} governed work item${opportunity.volume === 1 ? "" : "s"} related to ${opportunity.process}. ${signalSummary || "The signal pattern indicates repeatable work pain that should be structured before automation."}`,
    currentProcess: `${opportunity.process} currently relies on manual follow-up, fragmented system records, and inconsistent handoffs. Average observed delay is ${Math.round(opportunity.avgDelayHours * 10) / 10} hours across the governed signal set.`,
    desiredOutcome: `Create ${capabilityPhrase(opportunity.recommendedPattern)} for ${opportunity.process}, with measurable cycle-time reduction, owner accountability, and launch evidence captured in the AI Harness.`,
    aiHelp: opportunity.recommendedAction,
    aiNotDo: "Do not inspect private employee messages, store raw content, rank individual workers, make employment decisions, bypass data permissions, or execute external actions without policy approval.",
    monthlyVolume: Math.max(1, Math.round(opportunity.volume)),
    avgHandlingTimeMinutes: minutesFromCycleTime,
    estimatedUsers,
    dataSensitivity: opportunity.riskLevel,
    dataSources: dataSources.join(", "),
    humanReview: opportunity.riskLevel !== "low" || opportunity.recommendedPattern === "Agentic Workflow",
    externalCommunication: isExternal,
  };
}
