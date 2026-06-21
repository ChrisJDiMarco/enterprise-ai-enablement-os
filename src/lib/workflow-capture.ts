import type { Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";

export type WorkflowCaptureMode = {
  id: "record" | "import" | "write" | "quiz" | "publish";
  label: string;
  helper: string;
  complete: boolean;
};

export type WorkflowCaptureStep = {
  id: string;
  title: string;
  owner: "Human" | "AI Skill" | "System" | "Reviewer";
  body: string;
  evidence: string;
};

export type WorkflowProcedureModule = {
  id: "overview" | "steps" | "exceptions" | "training" | "agent_context" | "proof";
  label: string;
  body: string;
  evidence: string;
  publishTo: "SOP" | "Training" | "Agent Context" | "Proof";
  ready: boolean;
};

export type WorkflowProcedureStep = {
  id: string;
  action: string;
  humanOwner: string;
  aiSupport: string;
  systemOfRecord: string;
  proof: string;
  control: string;
};

export type WorkflowProcedureExport = {
  id: "sop_doc" | "training_module" | "quiz" | "agent_context" | "audit_packet";
  label: string;
  helper: string;
  ready: boolean;
};

export type WorkflowProcedureArtifact = {
  title: string;
  version: string;
  audience: string;
  owner: string;
  status: "draft" | "needs_sources" | "needs_skill" | "ready_to_publish";
  modules: WorkflowProcedureModule[];
  stepGuide: WorkflowProcedureStep[];
  assistantBrief: string[];
  exports: WorkflowProcedureExport[];
};

export type WorkflowCaptureReviewItem = {
  id: string;
  label: string;
  helper: string;
  status: "ready" | "attention" | "missing";
};

export type WorkflowCaptureReview = {
  status: "empty" | "needs_capture" | "needs_review" | "publish_ready";
  statusLabel: string;
  qualityScore: number;
  observedSteps: (WorkflowCaptureReviewItem & {
    owner: WorkflowCaptureStep["owner"];
    proof: string;
  })[];
  artifacts: (WorkflowCaptureReviewItem & {
    type: "recording" | "source" | "skill" | "control" | "value" | "training";
  })[];
  editQueue: WorkflowCaptureReviewItem[];
  publishGates: WorkflowCaptureReviewItem[];
};

export type WorkflowGuidePipelineStage = {
  id: "capture" | "clean" | "write" | "train" | "publish" | "prove";
  label: string;
  helper: string;
  status: "ready" | "next" | "blocked";
  actionLabel: string;
};

export type WorkflowCaptureInsight = {
  id: "path" | "sources" | "training" | "agent" | "proof";
  label: string;
  value: string;
  helper: string;
  status: "ready" | "attention" | "missing";
};

export type WorkflowCaptureSource = {
  id: "web" | "desktop" | "mobile" | "video" | "import";
  label: string;
  helper: string;
  evidence: string;
  status: "ready" | "available" | "missing";
};

export type WorkflowGuideDistribution = {
  id: "sop_page" | "training_flow" | "sidekick" | "agent_context" | "audit_export";
  label: string;
  helper: string;
  audience: "Team" | "Operators" | "AI" | "Reviewers";
  readiness: number;
  status: "ready" | "attention" | "missing";
};

export type WorkflowGuideSecurityControl = {
  id: "redaction" | "permissions" | "review_cadence" | "version_history";
  label: string;
  helper: string;
  evidence: string;
  status: "ready" | "attention" | "missing";
};

export type WorkflowGuideAnalytics = {
  summary: string;
  views: number;
  completions: number;
  comments: number;
  staleWarnings: number;
  signals: {
    label: string;
    value: string;
    helper: string;
    status: "ready" | "attention" | "missing";
  }[];
};

export type WorkflowCapturePacket = {
  title: string;
  summary: string;
  readiness: number;
  headline: string;
  pipeline: WorkflowGuidePipelineStage[];
  insights: WorkflowCaptureInsight[];
  sources: WorkflowCaptureSource[];
  distribution: WorkflowGuideDistribution[];
  security: WorkflowGuideSecurityControl[];
  analytics: WorkflowGuideAnalytics;
  captureModes: WorkflowCaptureMode[];
  steps: WorkflowCaptureStep[];
  sopOutline: string[];
  quizChecks: string[];
  procedure: WorkflowProcedureArtifact;
  review: WorkflowCaptureReview;
  agentContext: {
    ready: boolean;
    sources: string[];
    missing: string[];
  };
  nextAction: string;
};

export function deriveWorkflowCapturePacket({
  useCase,
  skill,
  workSignals,
}: {
  useCase: UseCase | null;
  skill?: Skill | null;
  workSignals: WorkSignal[];
}): WorkflowCapturePacket {
  if (!useCase) return emptyPacket();

  const relatedSignals = workSignals.filter(
    (signal) =>
      signal.metadata.relatedUseCaseId === useCase.id ||
      signal.metadata.relatedSkillId === skill?.id ||
      normalized(signal.process) === normalized(useCase.title) ||
      normalized(signal.process) === normalized(useCase.capabilityType),
  );
  const hasWorkflowCapture = Boolean(useCase.currentProcess) || relatedSignals.some((signal) => signal.eventType === "process_variant");
  const hasSources = useCase.dataSources.length > 0 || Boolean(skill?.contextSources.length);
  const hasSkill = Boolean(skill);
  const hasRiskControls = useCase.risks.length > 0 || useCase.riskLevel === "low";
  const hasValue = useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0;
  const hasTrainingEvidence = relatedSignals.some((signal) => signal.eventType === "training_completed" || signal.eventType === "feedback_given");
  const readiness = clamp(
    (hasWorkflowCapture ? 24 : 0) +
      (hasSources ? 18 : 0) +
      (hasSkill ? 18 : 0) +
      (hasRiskControls ? 14 : 0) +
      (hasValue ? 14 : 0) +
      (hasTrainingEvidence ? 12 : 0),
  );

  const captureModes: WorkflowCaptureMode[] = [
    {
      id: "record",
      label: "Record workflow",
      helper: "Capture the real screen path, handoffs, and variants.",
      complete: hasWorkflowCapture,
    },
    {
      id: "import",
      label: "Import artifacts",
      helper: "Attach SOPs, videos, tickets, policies, and system evidence.",
      complete: hasSources,
    },
    {
      id: "write",
      label: "Write SOP with AI",
      helper: "Generate the procedure, owner notes, controls, and exceptions.",
      complete: hasWorkflowCapture && hasSources,
    },
    {
      id: "quiz",
      label: "Generate checks",
      helper: "Turn the SOP into validation questions for launch cohorts.",
      complete: hasRiskControls && hasTrainingEvidence,
    },
    {
      id: "publish",
      label: "Publish context",
      helper: "Expose approved steps to the assistant, Skills, and reports.",
      complete: readiness >= 78 && hasSkill,
    },
  ];

  const steps: WorkflowCaptureStep[] = [
    {
      id: "intake",
      title: "Request enters the workflow",
      owner: "Human",
      body: useCase.currentProcess || "Capture the request trigger, required fields, and system where the work starts.",
      evidence: relatedSignals[0]?.summary ?? "Needs workflow recording or source import.",
    },
    {
      id: "context",
      title: "Approved context is gathered",
      owner: "System",
      body: hasSources
        ? `Use ${[...useCase.dataSources, ...(skill?.contextSources ?? [])].slice(0, 3).join(", ")} as the governed source set.`
        : "Attach the policy, system, knowledge, and source records people rely on today.",
      evidence: hasSources ? `${useCase.dataSources.length + (skill?.contextSources.length ?? 0)} sources mapped` : "No approved source set yet.",
    },
    {
      id: "draft",
      title: "AI prepares the next action",
      owner: "AI Skill",
      body: skill
        ? `${skill.name} drafts or prepares work within ${skill.autonomyTier.replaceAll("_", " ")}.`
        : "Create a Skill only after the workflow, data, value, and human boundary are explicit.",
      evidence: skill ? `${skill.evalPassRate}% eval pass rate, ${skill.runs} runs` : "No governed Skill attached.",
    },
    {
      id: "review",
      title: "Human reviews the boundary",
      owner: "Reviewer",
      body: useCase.riskLevel === "low"
        ? "Low-risk outputs can use lightweight review with clear escalation."
        : `Because risk is ${useCase.riskLevel}, keep sensitive outputs, exceptions, and external actions human-gated.`,
      evidence: hasRiskControls ? `${useCase.risks.length || 1} control notes available` : "Risk controls need to be written.",
    },
    {
      id: "proof",
      title: "Proof flows into launch evidence",
      owner: "System",
      body: hasValue
        ? `${useCase.monthlyVolume.toLocaleString()} monthly items and ${useCase.avgHandlingTimeMinutes} minutes baseline can prove cycle-time impact.`
        : "Add volume and handling-time baseline so the redesigned SOP can prove value.",
      evidence: hasTrainingEvidence ? "Training or feedback signal exists" : "Training and feedback proof missing.",
    },
  ];

  const sources = [...new Set([...useCase.dataSources, ...(skill?.contextSources ?? [])])];
  const relatedSignalsForAnalytics = relatedSignals.length;
  const missing = [
    !hasWorkflowCapture ? "workflow recording" : null,
    !hasSources ? "approved sources" : null,
    !hasSkill ? "governed Skill" : null,
    !hasRiskControls ? "risk controls" : null,
    !hasTrainingEvidence ? "training checks" : null,
  ].filter((item): item is string => Boolean(item));
  const agentContextReady = readiness >= 78 && hasSkill && hasSources;
  const pipeline = buildGuidePipeline({
    hasWorkflowCapture,
    hasSources,
    hasSkill,
    hasRiskControls,
    hasValue,
    hasTrainingEvidence,
    agentContextReady,
  });
  const insights = buildCaptureInsights({
    hasWorkflowCapture,
    hasSources,
    hasSkill,
    hasValue,
    hasTrainingEvidence,
    agentContextReady,
    sourceCount: sources.length,
    stepCount: steps.length,
    missingCount: missing.length,
  });
  const captureSources = buildCaptureSources({
    hasWorkflowCapture,
    hasSources,
    relatedSignals,
    sourceCount: sources.length,
  });
  const distribution = buildGuideDistribution({
    hasWorkflowCapture,
    hasSources,
    hasSkill,
    hasRiskControls,
    hasTrainingEvidence,
    hasValue,
    agentContextReady,
    readiness,
  });
  const security = buildGuideSecurity({
    hasWorkflowCapture,
    hasSources,
    hasSkill,
    hasRiskControls,
    relatedSignals,
    riskLevel: useCase.riskLevel,
    version: skill?.version,
  });
  const analytics = buildGuideAnalytics({
    relatedSignals,
    estimatedUsers: useCase.estimatedUsers,
    hasWorkflowCapture,
    hasTrainingEvidence,
    hasSources,
    agentContextReady,
    relatedSignalCount: relatedSignalsForAnalytics,
  });
  const procedure = buildProcedureArtifact({
    useCase,
    skill,
    sources,
    steps,
    hasWorkflowCapture,
    hasSources,
    hasSkill,
    hasRiskControls,
    hasValue,
    hasTrainingEvidence,
    agentContextReady,
  });
  const review = buildCaptureReview({
    steps,
    relatedSignals,
    hasWorkflowCapture,
    hasSources,
    hasSkill,
    hasRiskControls,
    hasValue,
    hasTrainingEvidence,
    agentContextReady,
    readiness,
    sourceCount: sources.length,
    skillName: skill?.name,
  });

  return {
    title: `${useCase.title} capture packet`,
    summary: `Captured workflow knowledge for ${useCase.department}: guide, SOP, training, assistant context, and launch proof.`,
    readiness,
    headline:
      agentContextReady
        ? "Ready to publish into the assistant and launch packet"
        : pipeline.find((stage) => stage.status === "next")?.helper ?? "Capture the workflow before publishing reusable operating knowledge.",
    pipeline,
    insights,
    sources: captureSources,
    distribution,
    security,
    analytics,
    captureModes,
    steps,
    sopOutline: [
      `Purpose: ${useCase.desiredOutcome || useCase.businessProblem}`,
      `Trigger: ${useCase.currentProcess || "Record the first workflow trigger."}`,
      `Source set: ${sources.length ? sources.join(", ") : "Attach approved sources."}`,
      `AI boundary: ${useCase.desiredOutcome || "AI prepares work while accountable owners review exceptions."}`,
      `Controls: ${useCase.risks.length ? useCase.risks.join("; ") : "Document risk controls before launch."}`,
    ],
    quizChecks: [
      "Can the operator identify when the AI output needs human review?",
      "Can the operator name the approved source used for the answer?",
      "Can the reviewer explain what evidence must be captured before launch?",
    ],
    procedure,
    review,
    agentContext: {
      ready: agentContextReady,
      sources,
      missing,
    },
    nextAction:
      missing[0] === "workflow recording"
        ? "Record or describe the workflow before generating the SOP."
        : missing[0] === "approved sources"
          ? "Attach the approved knowledge and system sources."
          : missing[0] === "governed Skill"
            ? "Create the governed Skill from this use case."
            : missing[0] === "training checks"
              ? "Generate quiz checks and assign the launch cohort."
              : "Publish the approved procedure into assistant context.",
  };
}

function emptyPacket(): WorkflowCapturePacket {
  return {
    title: "Select a workflow to capture",
    summary: "Choose a use case before generating SOP, training, quiz, and agent-context artifacts.",
    readiness: 0,
    headline: "Select a use case to start the capture loop.",
    pipeline: buildGuidePipeline({
      hasWorkflowCapture: false,
      hasSources: false,
      hasSkill: false,
      hasRiskControls: false,
      hasValue: false,
      hasTrainingEvidence: false,
      agentContextReady: false,
    }),
    insights: buildCaptureInsights({
      hasWorkflowCapture: false,
      hasSources: false,
      hasSkill: false,
      hasValue: false,
      hasTrainingEvidence: false,
      agentContextReady: false,
      sourceCount: 0,
      stepCount: 0,
      missingCount: 1,
    }),
    sources: buildCaptureSources({
      hasWorkflowCapture: false,
      hasSources: false,
      relatedSignals: [],
      sourceCount: 0,
    }),
    distribution: buildGuideDistribution({
      hasWorkflowCapture: false,
      hasSources: false,
      hasSkill: false,
      hasRiskControls: false,
      hasTrainingEvidence: false,
      hasValue: false,
      agentContextReady: false,
      readiness: 0,
    }),
    security: buildGuideSecurity({
      hasWorkflowCapture: false,
      hasSources: false,
      hasSkill: false,
      hasRiskControls: false,
      relatedSignals: [],
      riskLevel: "low",
    }),
    analytics: buildGuideAnalytics({
      relatedSignals: [],
      estimatedUsers: 0,
      hasWorkflowCapture: false,
      hasTrainingEvidence: false,
      hasSources: false,
      agentContextReady: false,
      relatedSignalCount: 0,
    }),
    captureModes: [
      { id: "record", label: "Record workflow", helper: "Select a use case first.", complete: false },
      { id: "import", label: "Import artifacts", helper: "Select a use case first.", complete: false },
      { id: "write", label: "Write SOP with AI", helper: "Select a use case first.", complete: false },
      { id: "quiz", label: "Generate checks", helper: "Select a use case first.", complete: false },
      { id: "publish", label: "Publish context", helper: "Select a use case first.", complete: false },
    ],
    steps: [],
    sopOutline: [],
    quizChecks: [],
    procedure: emptyProcedureArtifact(),
    review: emptyCaptureReview(),
    agentContext: { ready: false, sources: [], missing: ["selected use case"] },
    nextAction: "Select or create a use case.",
  };
}

function stageStatus(ready: boolean, next: boolean): WorkflowGuidePipelineStage["status"] {
  if (ready) return "ready";
  return next ? "next" : "blocked";
}

function buildGuidePipeline({
  hasWorkflowCapture,
  hasSources,
  hasSkill,
  hasRiskControls,
  hasValue,
  hasTrainingEvidence,
  agentContextReady,
}: {
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  hasSkill: boolean;
  hasRiskControls: boolean;
  hasValue: boolean;
  hasTrainingEvidence: boolean;
  agentContextReady: boolean;
}): WorkflowGuidePipelineStage[] {
  return [
    {
      id: "capture",
      label: "Capture",
      helper: hasWorkflowCapture ? "Workflow path is captured." : "Record or describe the real path first.",
      status: stageStatus(hasWorkflowCapture, true),
      actionLabel: "Capture workflow",
    },
    {
      id: "clean",
      label: "Clean",
      helper: hasSources ? "Approved source evidence is attached." : "Attach source docs, tickets, policies, or system proof.",
      status: stageStatus(hasSources, hasWorkflowCapture),
      actionLabel: "Attach sources",
    },
    {
      id: "write",
      label: "Write",
      helper: hasWorkflowCapture && hasSources ? "SOP draft has enough inputs." : "Generate the SOP after capture and sources.",
      status: stageStatus(hasWorkflowCapture && hasSources, hasWorkflowCapture && hasSources),
      actionLabel: "Draft SOP",
    },
    {
      id: "train",
      label: "Train",
      helper: hasTrainingEvidence ? "Training proof exists." : "Create checks and assign the launch cohort.",
      status: stageStatus(hasTrainingEvidence, hasWorkflowCapture && hasRiskControls),
      actionLabel: "Assign training",
    },
    {
      id: "publish",
      label: "Publish",
      helper: agentContextReady ? "Assistant context is ready." : "Publish only when Skill, sources, and controls align.",
      status: stageStatus(agentContextReady, hasSkill && hasSources && hasRiskControls),
      actionLabel: "Publish context",
    },
    {
      id: "prove",
      label: "Prove",
      helper: hasValue && hasRiskControls && hasSources ? "Proof packet can be created." : "Add baseline, controls, and source evidence.",
      status: stageStatus(hasValue && hasRiskControls && hasSources, hasValue || hasRiskControls || hasSources),
      actionLabel: "Package proof",
    },
  ];
}

function insightStatus(ready: boolean, attention: boolean): WorkflowCaptureInsight["status"] {
  if (ready) return "ready";
  return attention ? "attention" : "missing";
}

function buildCaptureInsights({
  hasWorkflowCapture,
  hasSources,
  hasSkill,
  hasValue,
  hasTrainingEvidence,
  agentContextReady,
  sourceCount,
  stepCount,
  missingCount,
}: {
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  hasSkill: boolean;
  hasValue: boolean;
  hasTrainingEvidence: boolean;
  agentContextReady: boolean;
  sourceCount: number;
  stepCount: number;
  missingCount: number;
}): WorkflowCaptureInsight[] {
  return [
    {
      id: "path",
      label: "Path",
      value: hasWorkflowCapture ? `${stepCount} steps` : "Needed",
      helper: hasWorkflowCapture ? "The workflow can become a step guide." : "Capture trigger, screens, handoffs, and exceptions.",
      status: insightStatus(hasWorkflowCapture, false),
    },
    {
      id: "sources",
      label: "Sources",
      value: String(sourceCount),
      helper: hasSources ? "Approved source evidence is mapped." : "Attach trusted docs or system records.",
      status: insightStatus(hasSources, hasWorkflowCapture),
    },
    {
      id: "training",
      label: "Training",
      value: hasTrainingEvidence ? "Live" : "Draft",
      helper: hasTrainingEvidence ? "Cohort proof has started." : "Generate checks before broad rollout.",
      status: insightStatus(hasTrainingEvidence, hasWorkflowCapture),
    },
    {
      id: "agent",
      label: "Agent",
      value: agentContextReady ? "Ready" : hasSkill ? "Gaps" : "No Skill",
      helper: agentContextReady ? "Safe for assistant and Skill context." : "Needs Skill, sources, controls, and readiness.",
      status: insightStatus(agentContextReady, hasSkill || hasSources),
    },
    {
      id: "proof",
      label: "Proof",
      value: missingCount ? `${missingCount} gaps` : "Ready",
      helper: hasValue ? "Value baseline can support reporting." : "Add baseline for ROI and launch evidence.",
      status: insightStatus(missingCount === 0, hasValue),
    },
  ];
}

function buildCaptureSources({
  hasWorkflowCapture,
  hasSources,
  relatedSignals,
  sourceCount,
}: {
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  relatedSignals: WorkSignal[];
  sourceCount: number;
}): WorkflowCaptureSource[] {
  const eventTypes = new Set(relatedSignals.map((signal) => String(signal.eventType)));
  const hasVideo = eventTypes.has("video_recorded") || eventTypes.has("screen_recording_uploaded");
  const hasMobile = eventTypes.has("mobile_screenshot_uploaded") || eventTypes.has("field_capture");
  const hasDesktop = eventTypes.has("desktop_capture") || eventTypes.has("process_variant");

  return [
    {
      id: "web",
      label: "Web path",
      helper: "Capture clicks, screens, source fields, and decision points from browser workflows.",
      evidence: hasWorkflowCapture ? "Workflow narrative or path exists" : "No screen path recorded",
      status: hasWorkflowCapture ? "ready" : "missing",
    },
    {
      id: "desktop",
      label: "Desktop path",
      helper: "Support non-browser enterprise tools and multi-window handoffs.",
      evidence: hasDesktop ? "Desktop or variant signal detected" : "Available when a desktop workflow is imported",
      status: hasDesktop ? "ready" : "available",
    },
    {
      id: "mobile",
      label: "Mobile screenshots",
      helper: "Attach mobile or tablet proof when frontline work happens away from the browser.",
      evidence: hasMobile ? "Mobile capture signal detected" : "Available for screenshot upload",
      status: hasMobile ? "ready" : "available",
    },
    {
      id: "video",
      label: "Video to SOP",
      helper: "Convert recorded walkthroughs into steps, controls, and training checks.",
      evidence: hasVideo ? "Video capture signal detected" : "Available for walkthrough import",
      status: hasVideo ? "ready" : "available",
    },
    {
      id: "import",
      label: "Source import",
      helper: "Attach policies, tickets, SOPs, data dictionaries, and system proof.",
      evidence: hasSources ? `${sourceCount} approved source${sourceCount === 1 ? "" : "s"}` : "No approved source set",
      status: hasSources ? "ready" : "missing",
    },
  ];
}

function distributionStatus(ready: boolean, attention: boolean): WorkflowGuideDistribution["status"] {
  if (ready) return "ready";
  return attention ? "attention" : "missing";
}

function buildGuideDistribution({
  hasWorkflowCapture,
  hasSources,
  hasSkill,
  hasRiskControls,
  hasTrainingEvidence,
  hasValue,
  agentContextReady,
  readiness,
}: {
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  hasSkill: boolean;
  hasRiskControls: boolean;
  hasTrainingEvidence: boolean;
  hasValue: boolean;
  agentContextReady: boolean;
  readiness: number;
}): WorkflowGuideDistribution[] {
  return [
    {
      id: "sop_page",
      label: "Process Page",
      helper: "A Scribe-style guide page with steps, sources, media, and owner notes.",
      audience: "Team",
      readiness: clamp(readiness * 0.72 + (hasWorkflowCapture ? 18 : 0) + (hasSources ? 10 : 0)),
      status: distributionStatus(hasWorkflowCapture && hasSources, hasWorkflowCapture || hasSources),
    },
    {
      id: "training_flow",
      label: "Training Flow",
      helper: "A Whale-style assignment path with cohort, quiz checks, and completion proof.",
      audience: "Operators",
      readiness: clamp((hasWorkflowCapture ? 28 : 0) + (hasRiskControls ? 28 : 0) + (hasTrainingEvidence ? 34 : 0) + (hasSkill ? 10 : 0)),
      status: distributionStatus(hasWorkflowCapture && hasRiskControls && hasTrainingEvidence, hasWorkflowCapture && hasRiskControls),
    },
    {
      id: "sidekick",
      label: "Answer Sidekick",
      helper: "A small assistant surface that answers procedural questions from approved workflow context.",
      audience: "Team",
      readiness: clamp((hasWorkflowCapture ? 30 : 0) + (hasSources ? 38 : 0) + (hasRiskControls ? 16 : 0) + (hasSkill ? 16 : 0)),
      status: distributionStatus(hasWorkflowCapture && hasSources && hasRiskControls, hasSources || hasWorkflowCapture),
    },
    {
      id: "agent_context",
      label: "Agent Context",
      helper: "Governed workflow context available to Skills and agent runtimes.",
      audience: "AI",
      readiness: agentContextReady ? 100 : clamp((hasSkill ? 34 : 0) + (hasSources ? 28 : 0) + (hasWorkflowCapture ? 20 : 0) + (hasRiskControls ? 18 : 0)),
      status: distributionStatus(agentContextReady, hasSkill || hasSources),
    },
    {
      id: "audit_export",
      label: "Audit Export",
      helper: "Reviewer packet with source set, controls, training proof, value baseline, and version history.",
      audience: "Reviewers",
      readiness: clamp((hasSources ? 22 : 0) + (hasRiskControls ? 24 : 0) + (hasValue ? 24 : 0) + (hasTrainingEvidence ? 16 : 0) + (hasWorkflowCapture ? 14 : 0)),
      status: distributionStatus(hasSources && hasRiskControls && hasValue, hasSources || hasRiskControls || hasValue),
    },
  ];
}

function securityStatus(ready: boolean, attention: boolean): WorkflowGuideSecurityControl["status"] {
  if (ready) return "ready";
  return attention ? "attention" : "missing";
}

function buildGuideSecurity({
  hasWorkflowCapture,
  hasSources,
  hasSkill,
  hasRiskControls,
  relatedSignals,
  riskLevel,
  version,
}: {
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  hasSkill: boolean;
  hasRiskControls: boolean;
  relatedSignals: WorkSignal[];
  riskLevel: UseCase["riskLevel"];
  version?: string;
}): WorkflowGuideSecurityControl[] {
  const hasSignals = relatedSignals.length > 0;
  const redactedSignals = relatedSignals.filter((signal) => signal.privacy?.contentRedacted && signal.privacy?.piiRedacted).length;
  const redactionReady = hasSignals ? redactedSignals === relatedSignals.length : hasSources;
  const reviewStrict = riskLevel === "high" || riskLevel === "restricted";

  return [
    {
      id: "redaction",
      label: "Sensitive data redaction",
      helper: "Keep capture useful while stripping secrets, raw PII, and private employee content.",
      evidence: hasSignals ? `${redactedSignals}/${relatedSignals.length} signals redacted` : hasSources ? "Source import needs redaction scan" : "No content to scan yet",
      status: securityStatus(redactionReady, hasSignals || hasSources),
    },
    {
      id: "permissions",
      label: "Access permissions",
      helper: "Limit guide, training, and assistant context by owner, cohort, and reviewer group.",
      evidence: hasSkill ? "Skill owner and source boundary available" : "No governed Skill owner yet",
      status: securityStatus(hasSkill && hasSources, hasSources),
    },
    {
      id: "review_cadence",
      label: "Review cadence",
      helper: reviewStrict ? "High-risk workflows need explicit reviewer cadence before publishing." : "Keep procedure freshness visible with a recurring owner review.",
      evidence: hasRiskControls ? `${riskLevel} risk controls mapped` : "Risk controls and review interval missing",
      status: securityStatus(hasRiskControls, hasWorkflowCapture),
    },
    {
      id: "version_history",
      label: "Version history",
      helper: "Every SOP, quiz, and context publication should preserve a reviewable version trail.",
      evidence: version ? `Skill contract ${version}` : hasWorkflowCapture ? "Generated draft version ready" : "No versionable artifact yet",
      status: securityStatus(Boolean(version) || hasWorkflowCapture, hasWorkflowCapture),
    },
  ];
}

function buildGuideAnalytics({
  relatedSignals,
  estimatedUsers,
  hasWorkflowCapture,
  hasTrainingEvidence,
  hasSources,
  agentContextReady,
  relatedSignalCount,
}: {
  relatedSignals: WorkSignal[];
  estimatedUsers: number;
  hasWorkflowCapture: boolean;
  hasTrainingEvidence: boolean;
  hasSources: boolean;
  agentContextReady: boolean;
  relatedSignalCount: number;
}): WorkflowGuideAnalytics {
  const completionSignals = relatedSignals.filter((signal) => signal.eventType === "training_completed").length;
  const feedbackSignals = relatedSignals.filter((signal) => signal.eventType === "feedback_given").length;
  const processVariants = relatedSignals.filter((signal) => signal.eventType === "process_variant").length;
  const views = hasWorkflowCapture ? Math.max(estimatedUsers, relatedSignalCount * 12, completionSignals * 18) : 0;
  const completions = hasTrainingEvidence ? Math.max(completionSignals, Math.round(views * 0.34)) : completionSignals;
  const comments = feedbackSignals;
  const staleWarnings = [!hasSources, !hasTrainingEvidence, !agentContextReady].filter(Boolean).length + processVariants;

  return {
    summary:
      views === 0
        ? "Analytics begin after the workflow is captured and assigned."
        : `${views.toLocaleString()} expected viewers, ${completions.toLocaleString()} completions, ${comments.toLocaleString()} feedback thread${comments === 1 ? "" : "s"}.`,
    views,
    completions,
    comments,
    staleWarnings,
    signals: [
      {
        label: "Views",
        value: views ? views.toLocaleString() : "Pending",
        helper: hasWorkflowCapture ? "Projected guide and Sidekick reach." : "Capture a workflow to forecast reach.",
        status: views ? "ready" : "missing",
      },
      {
        label: "Completions",
        value: completions ? completions.toLocaleString() : "Pending",
        helper: hasTrainingEvidence ? "Training proof is flowing." : "Assign training to create completion evidence.",
        status: hasTrainingEvidence ? "ready" : hasWorkflowCapture ? "attention" : "missing",
      },
      {
        label: "Feedback",
        value: comments ? comments.toLocaleString() : "None yet",
        helper: comments ? "Comments can improve the guide." : "Collect comments to catch confusing or stale steps.",
        status: comments ? "ready" : hasWorkflowCapture ? "attention" : "missing",
      },
      {
        label: "Freshness",
        value: staleWarnings ? `${staleWarnings} watch` : "Current",
        helper: staleWarnings ? "Review sources, training proof, or agent context before broad publishing." : "No freshness warnings.",
        status: staleWarnings ? "attention" : "ready",
      },
    ],
  };
}

function buildCaptureReview({
  steps,
  relatedSignals,
  hasWorkflowCapture,
  hasSources,
  hasSkill,
  hasRiskControls,
  hasValue,
  hasTrainingEvidence,
  agentContextReady,
  readiness,
  sourceCount,
  skillName,
}: {
  steps: WorkflowCaptureStep[];
  relatedSignals: WorkSignal[];
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  hasSkill: boolean;
  hasRiskControls: boolean;
  hasValue: boolean;
  hasTrainingEvidence: boolean;
  agentContextReady: boolean;
  readiness: number;
  sourceCount: number;
  skillName?: string;
}): WorkflowCaptureReview {
  const observedSteps = steps.map((step) => ({
    id: step.id,
    label: step.title,
    owner: step.owner,
    helper: step.body,
    proof: step.evidence,
    status: hasWorkflowCapture || step.id !== "intake" ? "ready" as const : "missing" as const,
  }));
  const artifacts: WorkflowCaptureReview["artifacts"] = [
    {
      id: "recording",
      type: "recording",
      label: "Recording",
      helper: hasWorkflowCapture ? "Step path or process narrative captured" : "Record the screen path or describe the workflow",
      status: hasWorkflowCapture ? "ready" : "missing",
    },
    {
      id: "sources",
      type: "source",
      label: "Sources",
      helper: hasSources ? `${sourceCount} approved source${sourceCount === 1 ? "" : "s"} mapped` : "Attach SOPs, policies, system records, or tickets",
      status: hasSources ? "ready" : "missing",
    },
    {
      id: "skill",
      type: "skill",
      label: "Skill",
      helper: hasSkill ? `${skillName ?? "Governed Skill"} attached` : "Create or attach the governed Skill",
      status: hasSkill ? "ready" : "missing",
    },
    {
      id: "controls",
      type: "control",
      label: "Controls",
      helper: hasRiskControls ? "Exceptions and review boundaries captured" : "Add risk controls and escalation criteria",
      status: hasRiskControls ? "ready" : "attention",
    },
    {
      id: "value",
      type: "value",
      label: "Value baseline",
      helper: hasValue ? "Volume and handling-time baseline are available" : "Add volume and handling-time baseline",
      status: hasValue ? "ready" : "attention",
    },
    {
      id: "training",
      type: "training",
      label: "Training signal",
      helper: hasTrainingEvidence ? "Training or feedback proof detected" : "Assign the cohort and capture completion proof",
      status: hasTrainingEvidence ? "ready" : "attention",
    },
  ];
  const editQueue: WorkflowCaptureReviewItem[] = [
    !hasWorkflowCapture
      ? {
          id: "edit-record",
          label: "Record missing steps",
          helper: "Capture trigger, screens, handoffs, and exceptions before writing the final SOP.",
          status: "missing",
        }
      : null,
    !hasSources
      ? {
          id: "edit-sources",
          label: "Attach source evidence",
          helper: "Map the approved documents, tickets, policies, or system records.",
          status: "missing",
        }
      : null,
    !hasSkill
      ? {
          id: "edit-skill",
          label: "Attach Skill contract",
          helper: "Connect the prompt, tools, context, autonomy tier, and owner.",
          status: "missing",
        }
      : null,
    !hasTrainingEvidence
      ? {
          id: "edit-training",
          label: "Add training proof",
          helper: "Generate checks and assign the cohort before broad sharing.",
          status: "attention",
        }
      : null,
  ].filter((item): item is WorkflowCaptureReviewItem => Boolean(item));
  const publishGates: WorkflowCaptureReviewItem[] = [
    {
      id: "gate-sop",
      label: "SOP can publish",
      helper: "Recording and source evidence are present",
      status: hasWorkflowCapture && hasSources ? "ready" : "missing",
    },
    {
      id: "gate-training",
      label: "Training can assign",
      helper: "Controls exist so checks can be generated",
      status: hasWorkflowCapture && hasRiskControls ? "ready" : "attention",
    },
    {
      id: "gate-agent",
      label: "Agent context can publish",
      helper: "Skill, sources, controls, and readiness are aligned",
      status: agentContextReady ? "ready" : "missing",
    },
    {
      id: "gate-proof",
      label: "Audit packet can publish",
      helper: "Value baseline and controls are available",
      status: hasValue && hasRiskControls && hasSources ? "ready" : "attention",
    },
  ];
  const qualityScore = clamp(
    readiness * 0.7 +
      Math.round((artifacts.filter((artifact) => artifact.status === "ready").length / artifacts.length) * 30) +
      Math.min(8, relatedSignals.length * 2),
  );
  const status =
    agentContextReady && publishGates.every((gate) => gate.status === "ready")
      ? "publish_ready"
      : hasWorkflowCapture && hasSources
        ? "needs_review"
        : hasWorkflowCapture || hasSources || hasSkill
          ? "needs_capture"
          : "empty";

  return {
    status,
    statusLabel:
      status === "publish_ready"
        ? "Publish ready"
        : status === "needs_review"
          ? "Review edits"
          : status === "needs_capture"
            ? "Capture gaps"
            : "Not captured",
    qualityScore,
    observedSteps,
    artifacts,
    editQueue,
    publishGates,
  };
}

function buildProcedureArtifact({
  useCase,
  skill,
  sources,
  steps,
  hasWorkflowCapture,
  hasSources,
  hasSkill,
  hasRiskControls,
  hasValue,
  hasTrainingEvidence,
  agentContextReady,
}: {
  useCase: UseCase;
  skill?: Skill | null;
  sources: string[];
  steps: WorkflowCaptureStep[];
  hasWorkflowCapture: boolean;
  hasSources: boolean;
  hasSkill: boolean;
  hasRiskControls: boolean;
  hasValue: boolean;
  hasTrainingEvidence: boolean;
  agentContextReady: boolean;
}): WorkflowProcedureArtifact {
  const owner = skill?.ownerId ?? useCase.ownerId ?? useCase.requestorId;
  const sourceSummary = sources.length ? sources.slice(0, 4).join(", ") : "approved sources not mapped yet";
  const status: WorkflowProcedureArtifact["status"] = agentContextReady
    ? "ready_to_publish"
    : !hasSources
      ? "needs_sources"
      : !hasSkill
        ? "needs_skill"
        : "draft";

  return {
    title: `${useCase.title} operating procedure`,
    version: "v0.1 generated",
    audience: useCase.estimatedUsers ? `${useCase.estimatedUsers.toLocaleString()} target users` : "First launch cohort",
    owner,
    status,
    modules: [
      {
        id: "overview",
        label: "Purpose and scope",
        body: useCase.desiredOutcome || useCase.businessProblem || "Define the outcome this procedure supports.",
        evidence: hasValue
          ? `${useCase.monthlyVolume.toLocaleString()} monthly items, ${useCase.avgHandlingTimeMinutes} min baseline`
          : "Value baseline still needed",
        publishTo: "SOP",
        ready: Boolean(useCase.desiredOutcome || useCase.businessProblem),
      },
      {
        id: "steps",
        label: "Step-by-step guide",
        body: hasWorkflowCapture
          ? "The current workflow has enough detail to become operator instructions."
          : "Record the real screen path, handoffs, and exceptions before publishing.",
        evidence: steps.map((step) => step.title).join(" -> "),
        publishTo: "SOP",
        ready: hasWorkflowCapture,
      },
      {
        id: "exceptions",
        label: "Exceptions and controls",
        body: hasRiskControls
          ? `${useCase.riskLevel} risk workflow with explicit review and escalation notes.`
          : "Add review boundaries, escalation criteria, and exception handling.",
        evidence: useCase.risks[0] ?? `${useCase.riskLevel} risk level`,
        publishTo: "Proof",
        ready: hasRiskControls,
      },
      {
        id: "training",
        label: "Training assignment",
        body: hasTrainingEvidence
          ? "Training or feedback proof exists, so this can become a tracked enablement module."
          : "Generate checks, assign the cohort, and capture completion proof.",
        evidence: hasTrainingEvidence ? "Training signal detected" : "No training signal yet",
        publishTo: "Training",
        ready: hasTrainingEvidence,
      },
      {
        id: "agent_context",
        label: "Agent context",
        body: hasSkill
          ? `${skill?.name} can use the approved workflow if sources and controls are published.`
          : "Create a governed Skill before exposing this procedure to assistants.",
        evidence: hasSources ? sourceSummary : "No approved context source set",
        publishTo: "Agent Context",
        ready: agentContextReady,
      },
      {
        id: "proof",
        label: "Launch proof",
        body: "Every published procedure should produce evidence: source set, owners, checks, training, and value baseline.",
        evidence: hasValue && hasRiskControls ? "Proof inputs are mapped" : "Proof inputs incomplete",
        publishTo: "Proof",
        ready: hasValue && hasRiskControls,
      },
    ],
    stepGuide: steps.map((step, index) => ({
      id: step.id,
      action: step.title,
      humanOwner: step.owner === "AI Skill" ? "Business reviewer" : step.owner,
      aiSupport:
        step.owner === "AI Skill"
          ? skill?.name ?? "Governed Skill"
          : hasSkill
            ? `${skill?.name} prepares context or draft support`
            : "No AI Skill attached yet",
      systemOfRecord: sources[index % Math.max(sources.length, 1)] ?? useCase.dataSources[0] ?? "Source not mapped",
      proof: step.evidence,
      control: step.owner === "Reviewer" || useCase.riskLevel !== "low"
        ? "Human review before sensitive or external action"
        : "Lightweight review with escalation path",
    })),
    assistantBrief: [
      `Answer only from ${sourceSummary}.`,
      `Procedure owner: ${owner}.`,
      `For ${useCase.riskLevel} risk, route exceptions to a human reviewer.`,
      `When unsure, ask for missing workflow details rather than inventing steps.`,
    ],
    exports: [
      {
        id: "sop_doc",
        label: "SOP document",
        helper: "Procedure, roles, controls, and source evidence.",
        ready: hasWorkflowCapture && hasSources,
      },
      {
        id: "training_module",
        label: "Training module",
        helper: "Role assignment, completion criteria, and cohort proof.",
        ready: hasWorkflowCapture && hasRiskControls,
      },
      {
        id: "quiz",
        label: "Quiz checks",
        helper: "Validation questions generated from controls and exceptions.",
        ready: hasWorkflowCapture && hasRiskControls,
      },
      {
        id: "agent_context",
        label: "Agent context",
        helper: "Approved procedure available to assistants and Skills.",
        ready: agentContextReady,
      },
      {
        id: "audit_packet",
        label: "Audit packet",
        helper: "Proof bundle for reviewers, risk, and leadership.",
        ready: hasValue && hasRiskControls && hasSources,
      },
    ],
  };
}

function emptyProcedureArtifact(): WorkflowProcedureArtifact {
  return {
    title: "No procedure selected",
    version: "v0.1 generated",
    audience: "Select a use case",
    owner: "Workspace Admin",
    status: "draft",
    modules: [],
    stepGuide: [],
    assistantBrief: ["Select or create a use case before publishing assistant context."],
    exports: [
      {
        id: "sop_doc",
        label: "SOP document",
        helper: "Select a workflow first.",
        ready: false,
      },
      {
        id: "training_module",
        label: "Training module",
        helper: "Select a workflow first.",
        ready: false,
      },
      {
        id: "quiz",
        label: "Quiz checks",
        helper: "Select a workflow first.",
        ready: false,
      },
      {
        id: "agent_context",
        label: "Agent context",
        helper: "Select a workflow first.",
        ready: false,
      },
      {
        id: "audit_packet",
        label: "Audit packet",
        helper: "Select a workflow first.",
        ready: false,
      },
    ],
  };
}

function emptyCaptureReview(): WorkflowCaptureReview {
  return {
    status: "empty",
    statusLabel: "Not captured",
    qualityScore: 0,
    observedSteps: [],
    artifacts: [
      {
        id: "recording",
        type: "recording",
        label: "Recording",
        helper: "Select a workflow first.",
        status: "missing",
      },
      {
        id: "sources",
        type: "source",
        label: "Sources",
        helper: "Select a workflow first.",
        status: "missing",
      },
      {
        id: "skill",
        type: "skill",
        label: "Skill",
        helper: "Select a workflow first.",
        status: "missing",
      },
    ],
    editQueue: [
      {
        id: "select-workflow",
        label: "Select workflow",
        helper: "Choose or create a use case before recording steps.",
        status: "missing",
      },
    ],
    publishGates: [
      {
        id: "gate-sop",
        label: "SOP can publish",
        helper: "Select a workflow first.",
        status: "missing",
      },
      {
        id: "gate-agent",
        label: "Agent context can publish",
        helper: "Select a workflow first.",
        status: "missing",
      },
    ],
  };
}

function normalized(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
