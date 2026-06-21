import type { Department, RiskLevel, Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";
import type { View } from "@/lib/ui/types";

export type PlaybookStageId = "capture" | "sop" | "assign" | "quiz" | "agent_context";

export type PlaybookStage = {
  id: PlaybookStageId;
  label: string;
  helper: string;
};

export type PlaybookIntent = {
  id: string;
  label: string;
  helper: string;
  view: View;
};

export type EnablementPlaybook = {
  id: string;
  title: string;
  department: Department | "Cross-Functional";
  owner: string;
  audience: string;
  source: "use_case" | "skill" | "seed";
  sourceId?: string;
  linkedSkillId?: string;
  stage: "draft" | "captured" | "assigned" | "validated" | "agent_ready";
  completion: number;
  trainingCompletion: number;
  quizReadiness: number;
  contextReadiness: number;
  freshnessDays: number;
  reviewCadenceDays: number;
  agentReady: boolean;
  nextAction: string;
  gaps: string[];
  evidence: string[];
  optimizations: PlaybookOptimizationRecommendation[];
  guide: PlaybookGuidePreview;
  targetView: View;
  lifecycle: PlaybookLifecycle;
};

export type PlaybookGuidePreview = {
  title: string;
  summary: string;
  sourceLabel: string;
  ownerNote: string;
  steps: {
    label: string;
    helper: string;
    evidence: string;
    owner: string;
  }[];
  quizChecks: string[];
  assistantContext: string[];
  publishTargets: PlaybookLifecycleTask[];
};

export type PlaybookOptimizationRecommendation = {
  id: string;
  kind: "capture" | "automate" | "context" | "train" | "review" | "publish" | "roadmap";
  label: string;
  helper: string;
  impact: string;
  confidence: number;
  targetView: View;
  tone: "green" | "blue" | "amber" | "red" | "purple" | "slate";
};

export type PlaybookOptimizationQueueItem = PlaybookOptimizationRecommendation & {
  playbookId: string;
  playbookTitle: string;
  department: Department | "Cross-Functional";
};

export type PlaybookLifecycle = {
  status: "draft" | "review_due" | "controlled" | "publish_ready";
  statusLabel: string;
  version: string;
  reviewDueInDays: number;
  permissionScope: {
    label: string;
    helper: string;
    tone: "green" | "blue" | "amber" | "red" | "slate";
  };
  assignments: PlaybookLifecycleTask[];
  approvalGates: PlaybookLifecycleTask[];
  exports: PlaybookLifecycleTask[];
  versionHistory: {
    label: string;
    date: string;
    actor: string;
    helper: string;
  }[];
};

export type PlaybookLifecycleTask = {
  label: string;
  helper: string;
  status: "ready" | "attention" | "missing";
  targetView: View;
};

export type EnablementPlaybookProgram = {
  playbooks: EnablementPlaybook[];
  captureStages: PlaybookStage[];
  intents: PlaybookIntent[];
  optimizationQueue: PlaybookOptimizationQueueItem[];
  metrics: {
    total: number;
    avgCompletion: number;
    agentReady: number;
    needsReview: number;
    trainingCoverage: number;
    quizCoverage: number;
    contextCoverage: number;
    workflowSignals: number;
    lifecycleReady: number;
    assignmentCoverage: number;
    exportCoverage: number;
  };
};

export const playbookCaptureStages: PlaybookStage[] = [
  {
    id: "capture",
    label: "Capture workflow",
    helper: "Record how work actually happens, including systems, exceptions, and handoffs.",
  },
  {
    id: "sop",
    label: "Generate SOP",
    helper: "Convert the workflow into an owned operating playbook with sources and controls.",
  },
  {
    id: "assign",
    label: "Assign training",
    helper: "Route the playbook to cohorts, owners, reviewers, and launch teams.",
  },
  {
    id: "quiz",
    label: "Validate learning",
    helper: "Generate checks so completion means understanding, not just page views.",
  },
  {
    id: "agent_context",
    label: "Feed AI context",
    helper: "Expose the approved workflow to assistants, Skills, and agent runtimes.",
  },
];

export const playbookIntents: PlaybookIntent[] = [
  {
    id: "create-sops",
    label: "Create SOPs",
    helper: "Turn use cases and work signals into governed playbooks.",
    view: "factory",
  },
  {
    id: "train-agents",
    label: "Train teams and AI",
    helper: "Assign role-based flows and agent-ready context.",
    view: "training",
  },
  {
    id: "answer-questions",
    label: "Answer questions",
    helper: "Route people to approved procedures and sources.",
    view: "orchestrator",
  },
  {
    id: "onboard-hires",
    label: "Onboard new hires",
    helper: "Package the first week of role-specific AI work.",
    view: "training",
  },
  {
    id: "automate-work",
    label: "Automate work",
    helper: "Move captured processes into Skills and workflows.",
    view: "skills",
  },
  {
    id: "ai-roadmap",
    label: "AI roadmap",
    helper: "Use workflow evidence to decide what to automate next.",
    view: "reports",
  },
];

export function deriveEnablementPlaybookProgram({
  skills,
  useCases,
  workSignals,
  now = new Date(),
}: {
  skills: Skill[];
  useCases: UseCase[];
  workSignals: WorkSignal[];
  now?: Date;
}): EnablementPlaybookProgram {
  const linkedSkillIds = new Set<string>();
  const playbooksFromUseCases = [...useCases]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
    .map((useCase) => {
      const linkedSkill = useCase.linkedSkillId
        ? skills.find((skill) => skill.id === useCase.linkedSkillId)
        : skills.find((skill) => skill.useCaseId === useCase.id);
      if (linkedSkill) linkedSkillIds.add(linkedSkill.id);

      const relatedSignals = workSignals.filter(
        (signal) =>
          signal.metadata.relatedUseCaseId === useCase.id ||
          signal.metadata.relatedSkillId === linkedSkill?.id ||
          normalize(signal.process) === normalize(useCase.title) ||
          normalize(signal.process) === normalize(useCase.capabilityType),
      );

      return buildPlaybook({
        id: `playbook-${useCase.id}`,
        title: `${useCase.title} playbook`,
        department: useCase.department,
        owner: useCase.ownerId ?? useCase.requestorId,
        audience: `${Math.max(useCase.estimatedUsers, 1).toLocaleString()} target users`,
        source: "use_case",
        sourceId: useCase.id,
        useCase,
        skill: linkedSkill,
        signals: relatedSignals,
        now,
      });
    });

  const playbooksFromSkills = skills
    .filter((skill) => !linkedSkillIds.has(skill.id))
    .sort((a, b) => b.adoptionCount + b.evalPassRate - (a.adoptionCount + a.evalPassRate))
    .slice(0, Math.max(0, 4 - playbooksFromUseCases.length))
    .map((skill) =>
      buildPlaybook({
        id: `playbook-${skill.id}`,
        title: `${skill.name} operating playbook`,
        department: skill.department,
        owner: skill.ownerId,
        audience: skill.adoptionCount ? `${skill.adoptionCount.toLocaleString()} active users` : "First launch cohort",
        source: "skill",
        sourceId: skill.id,
        skill,
        signals: workSignals.filter((signal) => signal.metadata.relatedSkillId === skill.id),
        now,
      }),
    );

  const playbooks = [...playbooksFromUseCases, ...playbooksFromSkills];
  if (!playbooks.length) {
    playbooks.push(seedPlaybook(now));
  }

  const total = playbooks.length;
  const optimizationQueue = playbooks
    .flatMap((playbook) =>
      playbook.optimizations.map((optimization) => ({
        ...optimization,
        playbookId: playbook.id,
        playbookTitle: playbook.title,
        department: playbook.department,
      })),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
  const avg = (selector: (playbook: EnablementPlaybook) => number) =>
    Math.round(playbooks.reduce((sum, playbook) => sum + selector(playbook), 0) / Math.max(total, 1));

  return {
    playbooks,
    captureStages: playbookCaptureStages,
    intents: playbookIntents,
    optimizationQueue,
    metrics: {
      total,
      avgCompletion: avg((playbook) => playbook.completion),
      agentReady: playbooks.filter((playbook) => playbook.agentReady).length,
      needsReview: playbooks.filter((playbook) => playbook.freshnessDays > playbook.reviewCadenceDays).length,
      trainingCoverage: avg((playbook) => playbook.trainingCompletion),
      quizCoverage: avg((playbook) => playbook.quizReadiness),
      contextCoverage: avg((playbook) => playbook.contextReadiness),
      workflowSignals: workSignals.filter((signal) =>
        ["workflow_delayed", "handoff_delayed", "rework_detected", "process_variant", "question_asked"].includes(signal.eventType),
      ).length,
      lifecycleReady: playbooks.filter((playbook) => playbook.lifecycle.status === "publish_ready").length,
      assignmentCoverage: avg((playbook) => taskCoverage(playbook.lifecycle.assignments)),
      exportCoverage: avg((playbook) => taskCoverage(playbook.lifecycle.exports)),
    },
  };
}

function buildPlaybook({
  id,
  title,
  department,
  owner,
  audience,
  source,
  sourceId,
  useCase,
  skill,
  signals,
  now,
}: {
  id: string;
  title: string;
  department: Department | "Cross-Functional";
  owner: string;
  audience: string;
  source: EnablementPlaybook["source"];
  sourceId?: string;
  useCase?: UseCase;
  skill?: Skill;
  signals: WorkSignal[];
  now: Date;
}): EnablementPlaybook {
  const hasCapturedWorkflow = Boolean(useCase?.currentProcess) || signals.some((signal) => signal.eventType === "process_variant");
  const hasOutcome = Boolean(useCase?.desiredOutcome) || Boolean(skill?.description);
  const hasDataSources = Boolean(useCase?.dataSources.length || skill?.contextSources.length);
  const hasSkill = Boolean(skill);
  const hasTraining = Boolean(skill?.adoptionCount) || signals.some((signal) => signal.eventType === "training_completed");
  const hasEval = (skill?.evalPassRate ?? 0) >= 70;
  const hasQuestions = signals.some((signal) => signal.eventType === "question_asked" || signal.eventType === "context_gap");
  const contextReadiness = clamp(
    (hasDataSources ? 34 : 0) +
      Math.min(30, (skill?.contextSources.length ?? 0) * 12) +
      (hasCapturedWorkflow ? 18 : 0) +
      (hasQuestions ? 10 : 0) +
      (hasSkill ? 8 : 0),
  );
  const quizReadiness = clamp(
    (hasCapturedWorkflow ? 28 : 0) +
      (hasOutcome ? 18 : 0) +
      (useCase?.risks.length ? 16 : 0) +
      (skill ? 18 : 0) +
      (hasEval ? 20 : 0),
  );
  const targetUsers = useCase?.estimatedUsers ?? Math.max(skill?.adoptionCount ?? 0, 1);
  const trainingCompletion = clamp(
    skill?.adoptionCount ? Math.round((skill.adoptionCount / Math.max(targetUsers, 1)) * 100) : hasTraining ? 36 : 0,
  );
  const completion = clamp(
    (hasCapturedWorkflow ? 22 : 0) +
      (hasOutcome ? 12 : 0) +
      (hasDataSources ? 12 : 0) +
      (hasSkill ? 18 : 0) +
      (contextReadiness >= 55 ? 12 : 0) +
      (quizReadiness >= 55 ? 12 : 0) +
      (trainingCompletion >= 50 ? 12 : 0),
  );
  const riskLevel = useCase?.riskLevel ?? skill?.riskLevel ?? "medium";
  const reviewCadenceDays = riskLevel === "restricted" ? 30 : riskLevel === "high" ? 45 : riskLevel === "medium" ? 60 : 90;
  const freshnessDays = daysSince(skill?.updatedAt ?? useCase?.updatedAt ?? signals[0]?.createdAt, now);
  const agentReady = completion >= 78 && contextReadiness >= 65 && quizReadiness >= 60 && Boolean(skill);
  const gaps = [
    !hasCapturedWorkflow ? "Capture how the workflow actually runs today." : null,
    !hasSkill ? "Attach or create the governed AI Skill." : null,
    contextReadiness < 65 ? "Map approved sources so people and agents answer from the same context." : null,
    quizReadiness < 60 ? "Generate validation checks from the SOP and risk controls." : null,
    trainingCompletion < 50 ? "Assign the playbook to the first cohort and track completion." : null,
    freshnessDays > reviewCadenceDays ? "Refresh the owner review before this becomes stale." : null,
  ].filter((gap): gap is string => Boolean(gap));
  const evidence = [
    hasCapturedWorkflow ? "Workflow capture exists" : null,
    hasSkill ? "Governed Skill attached" : null,
    hasEval ? `${skill?.evalPassRate}% eval pass rate` : null,
    hasTraining ? "Training activity detected" : null,
    contextReadiness >= 65 ? "Agent context ready" : null,
  ].filter((item): item is string => Boolean(item));
  const targetView = !hasCapturedWorkflow ? "work" : !hasSkill ? "skills" : !agentReady ? "training" : "orchestrator";
  const optimizations = buildPlaybookOptimizations({
    useCase,
    hasCapturedWorkflow,
    hasSkill,
    hasDataSources,
    contextReadiness,
    trainingCompletion,
    quizReadiness,
    freshnessDays,
    reviewCadenceDays,
    agentReady,
  });
  const lifecycle = buildPlaybookLifecycle({
    title,
    owner,
    audience,
    riskLevel,
    stage: stageFromScores(completion, agentReady),
    version: skill?.version,
    reviewCadenceDays,
    freshnessDays,
    reviewDueInDays: reviewCadenceDays - freshnessDays,
    useCase,
    skill,
    hasCapturedWorkflow,
    hasDataSources,
    hasSkill,
    hasEval,
    hasTraining,
    agentReady,
    contextReadiness,
    quizReadiness,
    trainingCompletion,
    evidence,
    now,
  });
  const guide = buildPlaybookGuidePreview({ title, owner, audience, useCase, skill, signals, lifecycle });

  return {
    id,
    title,
    department,
    owner,
    audience,
    source,
    sourceId,
    linkedSkillId: skill?.id,
    stage: stageFromScores(completion, agentReady),
    completion,
    trainingCompletion,
    quizReadiness,
    contextReadiness,
    freshnessDays,
    reviewCadenceDays,
    agentReady,
    nextAction: gaps[0] ?? "Publish this playbook into the AI assistant and launch packet.",
    gaps,
    evidence,
    optimizations,
    guide,
    targetView,
    lifecycle,
  };
}

function seedPlaybook(now: Date): EnablementPlaybook {
  return {
    id: "playbook-first-ai-initiative",
    title: "First governed AI initiative playbook",
    department: "Cross-Functional",
    owner: "Workspace Admin",
    audience: "First launch cohort",
    source: "seed",
    stage: "draft",
    completion: 8,
    trainingCompletion: 0,
    quizReadiness: 0,
    contextReadiness: 0,
    freshnessDays: daysSince(now.toISOString(), now),
    reviewCadenceDays: 60,
    agentReady: false,
    nextAction: "Capture one workflow signal and turn it into a scored use case.",
    gaps: [
      "Capture a repeated workflow before writing an SOP.",
      "Create the first use case and governed Skill.",
      "Assign a training cohort and reviewer.",
    ],
    evidence: [],
    optimizations: [
      {
        id: "seed-capture",
        kind: "capture",
        label: "Capture first workflow",
        helper: "Record or describe one repeated workflow before writing playbooks.",
        impact: "Unlock SOP, training, quiz, and assistant context",
        confidence: 86,
        targetView: "work",
        tone: "amber",
      },
      {
        id: "seed-roadmap",
        kind: "roadmap",
        label: "Build first AI roadmap lane",
        helper: "Turn the first captured process into a prioritized AI implementation path.",
        impact: "Create the first governed launch lane",
        confidence: 72,
        targetView: "strategy",
        tone: "blue",
      },
    ],
    guide: {
      title: "First governed AI initiative guide",
      summary: "Capture one repeated workflow, turn it into a scored use case, then publish the first training and assistant context packet.",
      sourceLabel: "Waiting for workflow capture",
      ownerNote: "Assign a process owner before publishing",
      steps: [
        {
          label: "Capture workflow signal",
          helper: "Record the repeated pain, system path, owner, and exception pattern.",
          evidence: "Work signal required",
          owner: "Workspace Admin",
        },
        {
          label: "Create governed use case",
          helper: "Score value, risk, data readiness, and feasibility before building.",
          evidence: "Use case required",
          owner: "Workspace Admin",
        },
        {
          label: "Publish first playbook",
          helper: "Assign the cohort, generate checks, and expose approved context to the assistant.",
          evidence: "Training and proof required",
          owner: "Workspace Admin",
        },
      ],
      quizChecks: [
        "What workflow evidence is required before creating a Skill?",
        "Who owns review before the playbook can publish?",
        "Which proof records must exist before launch?",
      ],
      assistantContext: [
        "No workflow context has been approved yet.",
        "Use the assistant to capture a work signal or draft the first use case.",
      ],
      publishTargets: buildSeedLifecycle(now).exports,
    },
    targetView: "work",
    lifecycle: buildSeedLifecycle(now),
  };
}

function buildPlaybookLifecycle({
  title,
  owner,
  audience,
  riskLevel,
  stage,
  version,
  reviewCadenceDays,
  freshnessDays,
  reviewDueInDays,
  useCase,
  skill,
  hasCapturedWorkflow,
  hasDataSources,
  hasSkill,
  hasEval,
  hasTraining,
  agentReady,
  contextReadiness,
  quizReadiness,
  trainingCompletion,
  evidence,
  now,
}: {
  title: string;
  owner: string;
  audience: string;
  riskLevel: RiskLevel;
  stage: EnablementPlaybook["stage"];
  version?: string;
  reviewCadenceDays: number;
  freshnessDays: number;
  reviewDueInDays: number;
  useCase?: UseCase;
  skill?: Skill;
  hasCapturedWorkflow: boolean;
  hasDataSources: boolean;
  hasSkill: boolean;
  hasEval: boolean;
  hasTraining: boolean;
  agentReady: boolean;
  contextReadiness: number;
  quizReadiness: number;
  trainingCompletion: number;
  evidence: string[];
  now: Date;
}): PlaybookLifecycle {
  const stale = freshnessDays > reviewCadenceDays;
  const permissionScope = permissionScopeForRisk(riskLevel, audience);
  const assignments: PlaybookLifecycleTask[] = [
    {
      label: "Process owner",
      helper: owner ? `${owner} accountable for content and changes` : "Assign the business owner",
      status: owner ? "ready" : "missing",
      targetView: "admin",
    },
    {
      label: "Training cohort",
      helper: trainingCompletion ? `${trainingCompletion}% completion against ${audience}` : `Assign ${audience}`,
      status: trainingCompletion >= 50 ? "ready" : trainingCompletion ? "attention" : "missing",
      targetView: "training",
    },
    {
      label: "Expert reviewer",
      helper: stale ? "Review interval is overdue" : `Review every ${reviewCadenceDays} days`,
      status: stale ? "attention" : "ready",
      targetView: "governance",
    },
  ];
  const approvalGates: PlaybookLifecycleTask[] = [
    {
      label: "Workflow source",
      helper: hasCapturedWorkflow ? "Process evidence captured" : "Capture the real workflow before approval",
      status: hasCapturedWorkflow ? "ready" : "missing",
      targetView: "work",
    },
    {
      label: "Skill contract",
      helper: hasSkill ? `${skill?.name ?? title} attached` : "Create the governed Skill",
      status: hasSkill ? "ready" : "missing",
      targetView: "skills",
    },
    {
      label: "Quality check",
      helper: hasEval ? `${skill?.evalPassRate}% eval pass rate` : "Run validation checks",
      status: hasEval ? "ready" : "attention",
      targetView: "evals",
    },
    {
      label: "Context approval",
      helper: contextReadiness >= 65 ? "Approved sources mapped" : "Map source permissions and retrieval context",
      status: contextReadiness >= 65 ? "ready" : hasDataSources ? "attention" : "missing",
      targetView: "context",
    },
  ];
  const exports: PlaybookLifecycleTask[] = [
    {
      label: "SOP document",
      helper: hasCapturedWorkflow ? "Procedure can be published" : "Needs workflow capture",
      status: hasCapturedWorkflow ? "ready" : "missing",
      targetView: "process",
    },
    {
      label: "Training flow",
      helper: hasTraining ? "Cohort activity detected" : "Assign the first read path",
      status: hasTraining || trainingCompletion >= 50 ? "ready" : "attention",
      targetView: "training",
    },
    {
      label: "Quiz checks",
      helper: quizReadiness >= 60 ? `${quizReadiness}% quiz readiness` : "Generate learning validation",
      status: quizReadiness >= 60 ? "ready" : "attention",
      targetView: "training",
    },
    {
      label: "Agent context",
      helper: contextReadiness >= 65 ? "Assistant-safe context is available" : "Needs approved sources",
      status: contextReadiness >= 65 ? "ready" : "missing",
      targetView: "orchestrator",
    },
    {
      label: "Audit packet",
      helper: evidence.length >= 3 ? `${evidence.length} evidence records` : "Collect trace, eval, approval, and training proof",
      status: evidence.length >= 3 ? "ready" : "attention",
      targetView: "evidence",
    },
  ];
  const readyGates = approvalGates.every((gate) => gate.status === "ready");
  const readyExports = exports.filter((item) => item.status === "ready").length >= 4;
  const status =
    stale ? "review_due" : agentReady && readyGates && readyExports ? "publish_ready" : stage === "draft" ? "draft" : "controlled";
  const statusLabel =
    status === "publish_ready"
      ? "Publish ready"
      : status === "review_due"
        ? "Review due"
        : status === "controlled"
          ? "Controlled"
          : "Draft";

  return {
    status,
    statusLabel,
    version: version ?? (hasSkill ? "1.0.0" : "0.1.0"),
    reviewDueInDays,
    permissionScope,
    assignments,
    approvalGates,
    exports,
    versionHistory: [
      {
        label: "Workflow drafted",
        date: formatShortDate(useCase?.createdAt ?? now.toISOString()),
        actor: useCase?.requestorId ?? owner,
        helper: "Initial process and business reason captured",
      },
      ...(hasSkill
        ? [
            {
              label: `Skill ${skill?.version ?? "1.0.0"} attached`,
              date: formatShortDate(skill?.updatedAt ?? now.toISOString()),
              actor: skill?.ownerId ?? owner,
              helper: "Prompt, tools, context, and policy linked to the playbook",
            },
          ]
        : []),
      {
        label: stale ? "Expert review overdue" : "Review cadence set",
        date: formatShortDate(now.toISOString()),
        actor: owner,
        helper: stale ? `${Math.abs(reviewDueInDays)} days past cadence` : `${reviewDueInDays} days until next review`,
      },
    ],
  };
}

function buildPlaybookOptimizations({
  useCase,
  hasCapturedWorkflow,
  hasSkill,
  hasDataSources,
  contextReadiness,
  trainingCompletion,
  quizReadiness,
  freshnessDays,
  reviewCadenceDays,
  agentReady,
}: {
  useCase?: UseCase;
  hasCapturedWorkflow: boolean;
  hasSkill: boolean;
  hasDataSources: boolean;
  contextReadiness: number;
  trainingCompletion: number;
  quizReadiness: number;
  freshnessDays: number;
  reviewCadenceDays: number;
  agentReady: boolean;
}): PlaybookOptimizationRecommendation[] {
  const recommendations: PlaybookOptimizationRecommendation[] = [];
  const monthlyHours =
    useCase?.monthlyVolume && useCase.avgHandlingTimeMinutes
      ? Math.round((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60)
      : 0;

  if (!hasCapturedWorkflow) {
    recommendations.push({
      id: "capture-workflow",
      kind: "capture",
      label: "Capture real workflow",
      helper: "Record the path, handoffs, exceptions, and systems before assigning training or agents.",
      impact: "Unlock SOP, quiz, training, and assistant context",
      confidence: 88,
      targetView: "work",
      tone: "amber",
    });
  }

  if (hasCapturedWorkflow && useCase && monthlyHours >= 120) {
    recommendations.push({
      id: "automation-candidate",
      kind: "automate",
      label: "Automation candidate",
      helper: "High-volume captured work can move from SOP to governed Skill and workflow automation.",
      impact: `${monthlyHours.toLocaleString()} baseline hours/month`,
      confidence: clamp(64 + useCase.reuseScore * 6 + useCase.feasibilityScore * 4),
      targetView: hasSkill ? "workflow" : "skills",
      tone: "purple",
    });
  }

  if (!hasSkill) {
    recommendations.push({
      id: "skill-contract",
      kind: "roadmap",
      label: "Create Skill contract",
      helper: "Convert the playbook into a governed Skill with owner, model, tools, prompt, and eval boundaries.",
      impact: "Moves procedure knowledge into executable AI work",
      confidence: hasCapturedWorkflow ? 82 : 62,
      targetView: "skills",
      tone: "blue",
    });
  }

  if (!hasDataSources || contextReadiness < 65) {
    recommendations.push({
      id: "context-gap",
      kind: "context",
      label: "Map source context",
      helper: "Connect approved docs, policies, systems, and source permissions so answers stay grounded.",
      impact: `${contextReadiness}% agent context readiness`,
      confidence: 78,
      targetView: "context",
      tone: "blue",
    });
  }

  if (trainingCompletion < 50 || quizReadiness < 60) {
    recommendations.push({
      id: "training-validation",
      kind: "train",
      label: "Assign and validate",
      helper: "Route the playbook to the launch cohort and generate checks from workflow risks.",
      impact: `${trainingCompletion}% training · ${quizReadiness}% quiz readiness`,
      confidence: 76,
      targetView: "training",
      tone: "amber",
    });
  }

  if (freshnessDays > reviewCadenceDays) {
    recommendations.push({
      id: "review-cadence",
      kind: "review",
      label: "Refresh expert review",
      helper: "This playbook is past its review cadence and should be re-approved before scale.",
      impact: `${freshnessDays - reviewCadenceDays} days overdue`,
      confidence: 91,
      targetView: "governance",
      tone: "red",
    });
  }

  if (agentReady) {
    recommendations.push({
      id: "publish-agent-context",
      kind: "publish",
      label: "Publish to assistant",
      helper: "The playbook is ready to become answerable context for teams and governed AI agents.",
      impact: "Available in AI Assistant and launch proof",
      confidence: 94,
      targetView: "orchestrator",
      tone: "green",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: "roadmap-review",
      kind: "roadmap",
      label: "Review roadmap fit",
      helper: "Compare the playbook against adoption, value, risk, and automation opportunities.",
      impact: "Keeps the AI roadmap evidence-driven",
      confidence: 68,
      targetView: "reports",
      tone: "slate",
    });
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

function buildPlaybookGuidePreview({
  title,
  owner,
  audience,
  useCase,
  skill,
  signals,
  lifecycle,
}: {
  title: string;
  owner: string;
  audience: string;
  useCase?: UseCase;
  skill?: Skill;
  signals: WorkSignal[];
  lifecycle: PlaybookLifecycle;
}): PlaybookGuidePreview {
  const sourceLabel = useCase
    ? `${useCase.department} use case · ${useCase.status.replaceAll("_", " ")}`
    : skill
      ? `${skill.department} Skill · ${skill.status.replaceAll("_", " ")}`
      : "Workspace seed";
  const capturedSteps = splitProcessSteps(useCase?.currentProcess);
  const steps =
    capturedSteps.length >= 3
      ? capturedSteps.slice(0, 6).map((step, index) => ({
          label: step,
          helper:
            index === 0
              ? "Start from the trigger and confirm the responsible owner."
              : index === capturedSteps.length - 1
                ? "Close the workflow with proof, handoff, or exception state."
                : "Follow the captured path and document the decision point.",
          evidence: signals[index]?.summary ?? lifecycle.approvalGates[index % lifecycle.approvalGates.length]?.helper ?? "Capture evidence during execution",
          owner,
        }))
      : defaultGuideSteps({ useCase, skill, owner });
  const quizChecks = [
    useCase?.risks[0] ? `What should the operator do when ${useCase.risks[0].toLowerCase()} appears?` : "Which exception requires human review?",
    skill?.contextSources[0] ? `Which source should be checked first: ${skill.contextSources[0]}?` : "Which approved source grounds the answer?",
    useCase?.desiredOutcome ? `What outcome proves success for ${useCase.desiredOutcome.toLowerCase()}?` : "What proof shows the workflow completed correctly?",
  ];
  const assistantContext = [
    useCase?.businessProblem ? `Business reason: ${useCase.businessProblem}` : null,
    useCase?.desiredOutcome ? `Target outcome: ${useCase.desiredOutcome}` : null,
    skill ? `AI Skill: ${skill.name} using ${skill.modelProvider} ${skill.model}` : null,
    skill?.contextSources.length ? `Approved sources: ${skill.contextSources.slice(0, 4).join(", ")}` : null,
    lifecycle.permissionScope.helper,
  ].filter((item): item is string => Boolean(item));

  return {
    title: title.replace(/ playbook$/i, " guide"),
    summary:
      useCase?.desiredOutcome ??
      skill?.description ??
      `Guide ${audience} through the approved workflow, training checks, and assistant-ready context.`,
    sourceLabel,
    ownerNote: `${owner} owns updates, review cadence, and publish scope.`,
    steps,
    quizChecks,
    assistantContext,
    publishTargets: lifecycle.exports,
  };
}

function splitProcessSteps(process?: string) {
  return (process ?? "")
    .split(/(?:\.|;|\n|, and | and then | then )/i)
    .map((step) => step.trim())
    .filter((step) => step.length > 8)
    .map((step) => sentenceCase(step));
}

function defaultGuideSteps({
  useCase,
  skill,
  owner,
}: {
  useCase?: UseCase;
  skill?: Skill;
  owner: string;
}): PlaybookGuidePreview["steps"] {
  const workflowName = useCase?.title ?? skill?.name ?? "the workflow";
  return [
    {
      label: "Confirm request and scope",
      helper: `Verify the trigger, owner, user, and business reason for ${workflowName}.`,
      evidence: useCase?.businessProblem ?? "Request and owner captured",
      owner,
    },
    {
      label: "Gather approved context",
      helper: "Use only mapped sources, policies, systems, and knowledge records.",
      evidence: [...(useCase?.dataSources ?? []), ...(skill?.contextSources ?? [])][0] ?? "Approved source required",
      owner,
    },
    {
      label: "Run the AI-assisted step",
      helper: skill ? `Use ${skill.name} within its autonomy and tool boundaries.` : "Draft the AI support pattern before execution.",
      evidence: skill ? `${skill.evalPassRate}% eval pass rate` : "Skill contract required",
      owner,
    },
    {
      label: "Review exceptions",
      helper: "Escalate risk, policy, consent, quality, and external-action exceptions.",
      evidence: useCase?.risks[0] ?? "Exception path required",
      owner,
    },
    {
      label: "Capture proof",
      helper: "Record the run, reviewer decision, training signal, and value evidence.",
      evidence: "Proof Ledger update",
      owner,
    },
  ];
}

function sentenceCase(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function buildSeedLifecycle(now: Date): PlaybookLifecycle {
  return {
    status: "draft",
    statusLabel: "Draft",
    version: "0.1.0",
    reviewDueInDays: 60,
    permissionScope: {
      label: "Workspace only",
      helper: "Publish scope is waiting for the first workflow and owner",
      tone: "slate",
    },
    assignments: [
      { label: "Process owner", helper: "Assign the business owner", status: "missing", targetView: "admin" },
      { label: "Training cohort", helper: "Choose the first launch cohort", status: "missing", targetView: "training" },
      { label: "Expert reviewer", helper: "Add the reviewer before launch", status: "missing", targetView: "governance" },
    ],
    approvalGates: [
      { label: "Workflow source", helper: "Capture the real workflow before approval", status: "missing", targetView: "work" },
      { label: "Skill contract", helper: "Create the governed Skill", status: "missing", targetView: "skills" },
      { label: "Quality check", helper: "Run validation checks", status: "missing", targetView: "evals" },
      { label: "Context approval", helper: "Map source permissions and retrieval context", status: "missing", targetView: "context" },
    ],
    exports: [
      { label: "SOP document", helper: "Needs workflow capture", status: "missing", targetView: "process" },
      { label: "Training flow", helper: "Assign the first read path", status: "missing", targetView: "training" },
      { label: "Quiz checks", helper: "Generate learning validation", status: "missing", targetView: "training" },
      { label: "Agent context", helper: "Needs approved sources", status: "missing", targetView: "orchestrator" },
      { label: "Audit packet", helper: "Collect trace, eval, approval, and training proof", status: "missing", targetView: "evidence" },
    ],
    versionHistory: [
      {
        label: "Workspace initialized",
        date: formatShortDate(now.toISOString()),
        actor: "Workspace Admin",
        helper: "Waiting for the first captured workflow",
      },
    ],
  };
}

function permissionScopeForRisk(riskLevel: RiskLevel, audience: string): PlaybookLifecycle["permissionScope"] {
  if (riskLevel === "restricted") {
    return {
      label: "Named reviewers only",
      helper: "Restricted workflow context needs explicit reviewer and role approval",
      tone: "red",
    };
  }
  if (riskLevel === "high") {
    return {
      label: "Approved groups",
      helper: "High-risk playbook can publish to assigned cohorts after review",
      tone: "amber",
    };
  }
  if (riskLevel === "medium") {
    return {
      label: "Department cohort",
      helper: `Publish to ${audience} after owner approval`,
      tone: "blue",
    };
  }
  return {
    label: "Company searchable",
    helper: "Low-risk playbook can be shared broadly once approved",
    tone: "green",
  };
}

function taskCoverage(tasks: PlaybookLifecycleTask[]) {
  if (!tasks.length) return 0;
  return Math.round(
    tasks.reduce((sum, task) => {
      if (task.status === "ready") return sum + 100;
      if (task.status === "attention") return sum + 50;
      return sum;
    }, 0) / tasks.length,
  );
}

function stageFromScores(completion: number, agentReady: boolean): EnablementPlaybook["stage"] {
  if (agentReady) return "agent_ready";
  if (completion >= 68) return "validated";
  if (completion >= 46) return "assigned";
  if (completion >= 24) return "captured";
  return "draft";
}

function daysSince(value: string | undefined, now: Date) {
  if (!value) return 999;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 999;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatShortDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}
