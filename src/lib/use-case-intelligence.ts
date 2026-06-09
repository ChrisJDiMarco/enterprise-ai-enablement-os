import type { AutonomyTier, Department, RiskLevel, UseCase } from "@/lib/enterprise-ai-data";
import type { IntakeForm } from "@/lib/ui/types";

const enterpriseDepartments: Department[] = ["HR", "Finance", "Legal", "Procurement", "IT", "Marketing", "Operations"];

type IntelligenceTone = "green" | "amber" | "red" | "blue" | "purple" | "slate";

export type IntelligenceAction = {
  title: string;
  body: string;
  targetTab: "overview" | "intake" | "backlog" | "scoring" | "detail" | "pilot" | "value";
  useCaseId?: string;
};

export type IntelligenceChecklistItem = {
  label: string;
  complete: boolean;
  owner: string;
  action: string;
};

export type UseCaseIntelligence = {
  recommendedPattern: string;
  patternReason: string;
  autonomyTier: AutonomyTier;
  riskCategories: string[];
  requiredReviews: string[];
  missingEvidence: string[];
  discoveryQuestions: string[];
  successMetrics: string[];
  pilotGuardrails: string[];
  nextBestAction: IntelligenceAction;
  confidenceScore: number;
  readinessItems: IntelligenceChecklistItem[];
  valueConfidence: "low" | "medium" | "high";
  dataReadinessLabel: "not ready" | "partial" | "ready";
};

export type IntakeIntelligence = UseCaseIntelligence & {
  contextSources: string[];
  generatedSummary: string;
  missingFields: string[];
  priorityPreviewLabel: string;
};

export type FactoryIntelligence = {
  nextBestAction: IntelligenceAction;
  portfolioGaps: string[];
  governanceBottlenecks: string[];
  reusablePatternSignals: { label: string; count: number; tone: IntelligenceTone; helper: string }[];
  departmentCoverage: { represented: number; missing: Department[] };
  topOpportunity?: UseCase;
  operatingNarrative: string;
};

export function parseIntakeSources(value: string) {
  return value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function deriveIntakeIntelligence(intake: IntakeForm): IntakeIntelligence {
  const contextSources = parseIntakeSources(intake.dataSources);
  const missingFields = intakeMissingFields(intake);
  const text = [
    intake.title,
    intake.department,
    intake.businessProblem,
    intake.currentProcess,
    intake.desiredOutcome,
    intake.aiHelp,
    intake.aiNotDo,
    intake.dataSources,
  ].join(" ");

  const riskCategories = inferRiskCategories({
    text,
    department: intake.department,
    riskLevel: intake.dataSensitivity,
    dataSources: contextSources,
    externalCommunication: intake.externalCommunication,
    humanReview: intake.humanReview,
    capabilityType: intake.aiHelp,
  });
  const requiredReviews = inferRequiredReviews({
    text,
    department: intake.department,
    riskLevel: intake.dataSensitivity,
    riskCategories,
    externalCommunication: intake.externalCommunication,
    humanReview: intake.humanReview,
  });
  const autonomyTier = recommendAutonomyTier({
    text,
    riskLevel: intake.dataSensitivity,
    dataSources: contextSources,
    externalCommunication: intake.externalCommunication,
    humanReview: intake.humanReview,
    capabilityType: intake.aiHelp,
  });
  const recommendedPattern = recommendPattern({
    text,
    riskLevel: intake.dataSensitivity,
    dataSources: contextSources,
    externalCommunication: intake.externalCommunication,
    humanReview: intake.humanReview,
    capabilityType: intake.aiHelp,
  });

  return {
    recommendedPattern,
    patternReason: patternReason(recommendedPattern, autonomyTier, intake.dataSensitivity, contextSources.length),
    autonomyTier,
    riskCategories,
    requiredReviews,
    missingEvidence: intakeMissingEvidence(intake, missingFields),
    discoveryQuestions: discoveryQuestionsFor({
      title: intake.title || "this opportunity",
      department: intake.department,
      riskCategories,
      dataSources: contextSources,
      currentProcess: intake.currentProcess,
    }),
    successMetrics: successMetricsFor({
      title: intake.title || "this opportunity",
      department: intake.department,
      monthlyVolume: intake.monthlyVolume,
      avgHandlingTimeMinutes: intake.avgHandlingTimeMinutes,
      estimatedUsers: intake.estimatedUsers,
      riskLevel: intake.dataSensitivity,
    }),
    pilotGuardrails: pilotGuardrailsFor({
      riskLevel: intake.dataSensitivity,
      riskCategories,
      externalCommunication: intake.externalCommunication,
      humanReview: intake.humanReview,
      autonomyTier,
    }),
    nextBestAction: intakeNextAction(intake, missingFields),
    confidenceScore: confidenceFromSignals({
      sourceCount: contextSources.length,
      hasProblem: Boolean(intake.businessProblem.trim()),
      hasProcess: Boolean(intake.currentProcess.trim()),
      hasOutcome: Boolean(intake.desiredOutcome.trim()),
      hasBoundary: Boolean(intake.aiNotDo.trim()),
      hasValue: intake.monthlyVolume > 0 && intake.avgHandlingTimeMinutes > 0,
      hasOwner: true,
      hasRisks: riskCategories.length > 0,
    }),
    readinessItems: intakeReadinessItems(intake, contextSources, requiredReviews),
    valueConfidence: valueConfidenceFor(intake.monthlyVolume, intake.avgHandlingTimeMinutes, contextSources.length),
    dataReadinessLabel: dataReadinessLabel(contextSources.length, intake.dataSensitivity),
    contextSources,
    generatedSummary: generatedIntakeSummary(intake, recommendedPattern),
    missingFields,
    priorityPreviewLabel: missingFields.length ? `${missingFields.length} items before scoring` : "Ready to score",
  };
}

export function deriveUseCaseIntelligence(useCase: UseCase): UseCaseIntelligence {
  const text = [
    useCase.title,
    useCase.description,
    useCase.department,
    useCase.businessProblem,
    useCase.currentProcess,
    useCase.desiredOutcome,
    useCase.capabilityType,
    useCase.dataSources.join(" "),
    useCase.risks.join(" "),
  ].join(" ");
  const riskCategories = inferRiskCategories({
    text,
    department: useCase.department,
    riskLevel: useCase.riskLevel,
    dataSources: useCase.dataSources,
    externalCommunication: /external|customer|vendor|client|email\.send/i.test(text),
    humanReview: useCase.riskLevel !== "low" || /approval|review|legal|finance|employee/i.test(text),
    capabilityType: useCase.capabilityType,
  });
  const requiredReviews = inferRequiredReviews({
    text,
    department: useCase.department,
    riskLevel: useCase.riskLevel,
    riskCategories,
    externalCommunication: /external|customer|vendor|client|email\.send/i.test(text),
    humanReview: useCase.riskLevel !== "low",
  });
  const autonomyTier = recommendAutonomyTier({
    text,
    riskLevel: useCase.riskLevel,
    dataSources: useCase.dataSources,
    externalCommunication: /external|customer|vendor|client|email\.send/i.test(text),
    humanReview: useCase.riskLevel !== "low",
    capabilityType: useCase.capabilityType,
  });
  const recommendedPattern = recommendPattern({
    text,
    riskLevel: useCase.riskLevel,
    dataSources: useCase.dataSources,
    externalCommunication: /external|customer|vendor|client|email\.send/i.test(text),
    humanReview: useCase.riskLevel !== "low",
    capabilityType: useCase.capabilityType,
  });
  const missingEvidence = caseMissingEvidence(useCase, riskCategories);

  return {
    recommendedPattern,
    patternReason: patternReason(recommendedPattern, autonomyTier, useCase.riskLevel, useCase.dataSources.length),
    autonomyTier,
    riskCategories,
    requiredReviews,
    missingEvidence,
    discoveryQuestions: discoveryQuestionsFor({
      title: useCase.title,
      department: useCase.department,
      riskCategories,
      dataSources: useCase.dataSources,
      currentProcess: useCase.currentProcess,
    }),
    successMetrics: successMetricsFor(useCase),
    pilotGuardrails: pilotGuardrailsFor({
      riskLevel: useCase.riskLevel,
      riskCategories,
      externalCommunication: /external|customer|vendor|client/i.test(text),
      humanReview: useCase.riskLevel !== "low",
      autonomyTier,
    }),
    nextBestAction: caseNextAction(useCase, missingEvidence),
    confidenceScore: confidenceFromSignals({
      sourceCount: useCase.dataSources.length,
      hasProblem: Boolean(useCase.businessProblem.trim()),
      hasProcess: Boolean(useCase.currentProcess.trim()),
      hasOutcome: Boolean(useCase.desiredOutcome.trim()),
      hasBoundary: useCase.risks.length > 0,
      hasValue: useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0,
      hasOwner: Boolean(useCase.ownerId),
      hasRisks: useCase.risks.length > 0 || riskCategories.length > 0,
    }),
    readinessItems: caseReadinessItems(useCase, missingEvidence),
    valueConfidence: valueConfidenceFor(useCase.monthlyVolume, useCase.avgHandlingTimeMinutes, useCase.dataSources.length),
    dataReadinessLabel: dataReadinessLabel(useCase.dataSources.length, useCase.riskLevel),
  };
}

export function deriveFactoryIntelligence(useCases: UseCase[]): FactoryIntelligence {
  const active = useCases.filter((item) => item.status !== "scaled");
  const sorted = [...active].sort((a, b) => b.priorityScore - a.priorityScore);
  const topOpportunity = sorted[0];
  const missingDepartments = enterpriseDepartments.filter((department) => !useCases.some((item) => item.department === department));
  const scoredWithoutGovernance = useCases.filter((item) => item.status === "scored");
  const governanceQueue = useCases.filter((item) => item.status === "governance_review");
  const readyWithoutSkill = useCases.filter((item) => ["approved_for_pilot", "in_pilot"].includes(item.status) && !item.linkedSkillId);
  const incompleteEvidence = sorted.filter((item) => deriveUseCaseIntelligence(item).missingEvidence.length > 0).slice(0, 3);

  return {
    nextBestAction: factoryNextAction({
      activeCount: active.length,
      topOpportunity,
      scoredWithoutGovernance,
      governanceQueue,
      readyWithoutSkill,
      incompleteEvidence,
    }),
    portfolioGaps: portfolioGapsFor(useCases, missingDepartments),
    governanceBottlenecks: governanceBottlenecksFor(scoredWithoutGovernance, governanceQueue, readyWithoutSkill),
    reusablePatternSignals: reusablePatternSignalsFor(useCases),
    departmentCoverage: {
      represented: enterpriseDepartments.length - missingDepartments.length,
      missing: missingDepartments,
    },
    topOpportunity,
    operatingNarrative: topOpportunity
      ? `${topOpportunity.title} is the current highest-leverage candidate. Move it through evidence, governance, Skill conversion, and pilot telemetry before scaling the pattern.`
      : "The factory is production-empty. Start by importing a portfolio or capturing the first department workflow pain point.",
  };
}

function inferRiskCategories({
  text,
  department,
  riskLevel,
  dataSources,
  externalCommunication,
  humanReview,
  capabilityType,
}: {
  text: string;
  department: Department;
  riskLevel: RiskLevel;
  dataSources: string[];
  externalCommunication: boolean;
  humanReview: boolean;
  capabilityType: string;
}) {
  const normalized = text.toLowerCase();
  const categories = new Set<string>();
  if (dataSources.length) categories.add("Grounding");
  if (riskLevel !== "low" || /pii|employee|customer|health|salary|benefit|confidential|restricted/.test(normalized)) categories.add("Data privacy");
  if (/credential|access|security|database|workday|sharepoint|service now|servicenow|jira|snowflake/.test(normalized)) categories.add("Security");
  if (department === "Legal" || /legal|contract|clause|nda|terms|commitment/.test(normalized)) categories.add("Legal exposure");
  if (department === "HR" || /employee|manager|pto|leave|benefit|disciplinary|compensation/.test(normalized)) categories.add("Employee impact");
  if (department === "Finance" || /payment|invoice|journal|finance|variance|budget|forecast/.test(normalized)) categories.add("Financial exposure");
  if (externalCommunication || /external|customer|vendor|supplier|client|send email|outbound/.test(normalized)) categories.add("External communication");
  if (dataSources.some((source) => /web|vendor|external|contract|document/i.test(source))) categories.add("Prompt injection");
  if (humanReview) categories.add("Human oversight");
  if (/agentic|automation|execute|create|update|delete|send|workflow/.test(`${normalized} ${capabilityType.toLowerCase()}`)) categories.add("Excessive autonomy");
  if (!categories.size) categories.add("Grounding");
  return Array.from(categories);
}

function inferRequiredReviews({
  text,
  department,
  riskLevel,
  riskCategories,
  externalCommunication,
  humanReview,
}: {
  text: string;
  department: Department;
  riskLevel: RiskLevel;
  riskCategories: string[];
  externalCommunication: boolean;
  humanReview: boolean;
}) {
  const normalized = text.toLowerCase();
  const reviews = new Set<string>(["AI Enablement"]);
  if (riskLevel !== "low" || riskCategories.includes("Data privacy")) reviews.add("Privacy");
  if (riskLevel === "high" || riskLevel === "restricted" || riskCategories.includes("Security")) reviews.add("Security");
  if (externalCommunication || department === "Legal" || riskCategories.includes("Legal exposure") || /contract|legal|terms|payment|employment/.test(normalized)) reviews.add("Legal");
  if (department === "Finance" || riskCategories.includes("Financial exposure")) reviews.add("Finance Owner");
  if (department === "HR" || riskCategories.includes("Employee impact")) reviews.add("People/HR Owner");
  if (humanReview || riskCategories.includes("Human oversight")) reviews.add("Business Owner");
  return Array.from(reviews);
}

const autonomyTierRank: Record<AutonomyTier, number> = {
  tier_0_draft_only: 0,
  tier_1_read_only: 1,
  tier_2_prepare_action: 2,
  tier_3_execute_bounded_action: 3,
  tier_4_autonomous_workflow: 4,
  tier_5_restricted: 5,
};

const restrictedDecisionPattern =
  /employment decision|disciplinary|terminate|fire|hire|payment authorization|approve payment|legal commitment|surveillance|health data/;

/**
 * Deterministic policy floor — the "dispose" half of propose/dispose.
 * Any autonomy proposal (heuristic OR model-generated) must pass through this
 * clamp. The proposer can lower autonomy below the ceiling, never raise it.
 * Returns the clamped tier plus the reason when a clamp was applied, so the
 * UI can show "the model proposed X, policy capped it at Y because Z".
 */
export function applyAutonomyPolicyFloor({
  proposedTier,
  text,
  riskLevel,
  externalCommunication,
  humanReview,
}: {
  proposedTier: AutonomyTier;
  text: string;
  riskLevel: RiskLevel;
  externalCommunication: boolean;
  humanReview: boolean;
}): { tier: AutonomyTier; clamped: boolean; reason?: string } {
  const normalized = text.toLowerCase();

  if (restrictedDecisionPattern.test(normalized) || riskLevel === "restricted") {
    const clamped = proposedTier !== "tier_5_restricted";
    return {
      tier: "tier_5_restricted",
      clamped,
      reason: clamped
        ? "Restricted decision domain (employment, payment authorization, legal commitment, surveillance, or health data) — autonomy is policy-locked to restricted."
        : undefined,
    };
  }

  let ceiling: AutonomyTier = "tier_4_autonomous_workflow";
  let ceilingReason: string | undefined;
  if (riskLevel === "high" || externalCommunication) {
    ceiling = "tier_2_prepare_action";
    ceilingReason =
      riskLevel === "high"
        ? "High risk level caps autonomy at prepare-action: a human must approve before execution."
        : "External communication caps autonomy at prepare-action: drafts only until a human approves the send.";
  } else if (riskLevel === "medium" && !humanReview) {
    ceiling = "tier_3_execute_bounded_action";
    ceilingReason = "Medium risk without a defined human review step caps autonomy at bounded actions.";
  }

  if (autonomyTierRank[proposedTier] > autonomyTierRank[ceiling]) {
    return { tier: ceiling, clamped: true, reason: ceilingReason };
  }
  return { tier: proposedTier, clamped: false };
}

function recommendAutonomyTier({
  text,
  riskLevel,
  dataSources,
  externalCommunication,
  humanReview,
  capabilityType,
}: {
  text: string;
  riskLevel: RiskLevel;
  dataSources: string[];
  externalCommunication: boolean;
  humanReview: boolean;
  capabilityType: string;
}): AutonomyTier {
  const normalized = `${text} ${capabilityType}`.toLowerCase();
  // Heuristic proposal…
  let proposed: AutonomyTier;
  if (restrictedDecisionPattern.test(normalized) || riskLevel === "restricted") {
    proposed = "tier_5_restricted";
  } else if (/agentic|multi-step|workflow|autonomous/.test(normalized) && riskLevel !== "high") {
    proposed = "tier_4_autonomous_workflow";
  } else if (/create|update|route|tag|ticket|execute|send notification/.test(normalized) && riskLevel === "low" && !externalCommunication) {
    proposed = "tier_3_execute_bounded_action";
  } else if (/draft|prepare|escalation|send|external|vendor|customer|approval/.test(normalized) || humanReview || riskLevel === "high") {
    proposed = "tier_2_prepare_action";
  } else if (dataSources.length || /answer|search|summarize|retrieve|knowledge|policy/.test(normalized)) {
    proposed = "tier_1_read_only";
  } else {
    proposed = "tier_0_draft_only";
  }
  // …always disposed by the deterministic policy floor.
  return applyAutonomyPolicyFloor({ proposedTier: proposed, text: normalized, riskLevel, externalCommunication, humanReview }).tier;
}

function recommendPattern({
  text,
  riskLevel,
  dataSources,
  externalCommunication,
  humanReview,
  capabilityType,
}: {
  text: string;
  riskLevel: RiskLevel;
  dataSources: string[];
  externalCommunication: boolean;
  humanReview: boolean;
  capabilityType: string;
}) {
  const normalized = `${text} ${capabilityType}`.toLowerCase();
  if (/contract|invoice|extract|classification|document intelligence|compare documents|classify documents/.test(normalized)) return "Document Intelligence + Review";
  if (externalCommunication) return "Draft + Approval Workflow";
  if (/agentic|workflow|multi-step/.test(normalized)) return riskLevel === "high" || riskLevel === "restricted" ? "Human-Gated Agent Workflow" : "Bounded Agent Workflow";
  if (humanReview || riskLevel === "high" || riskLevel === "restricted") return "Prepare Action Skill";
  if (dataSources.length > 0 || /knowledge|policy|search|retrieve|answer/.test(normalized)) return "RAG + Guardrails";
  return "Structured Discovery";
}

function patternReason(pattern: string, autonomyTier: AutonomyTier, riskLevel: RiskLevel, sourceCount: number) {
  if (pattern === "RAG + Guardrails") return `${sourceCount || 1} approved source${sourceCount === 1 ? "" : "s"} can ground answers while ${riskLevel} risk stays inside ${autonomyTier.replace(/_/g, " ")} controls.`;
  if (pattern === "Draft + Approval Workflow") return "External or sensitive communications should be drafted by AI, then approved by a human before any send action.";
  if (pattern === "Document Intelligence + Review") return "The core work is extracting, classifying, and summarizing documents with reviewable evidence and citations.";
  if (pattern === "Bounded Agent Workflow") return "The workflow can use multiple steps if tool access, approvals, traces, and rollback stay bounded.";
  if (pattern === "Human-Gated Agent Workflow") return "The workflow may be agentic, but risk requires explicit human gates around decisions and actions.";
  if (pattern === "Prepare Action Skill") return "The Skill should prepare outputs or actions while preserving approval gates before execution.";
  return "The opportunity needs more discovery before a stable AI pattern should be chosen.";
}

function intakeMissingFields(intake: IntakeForm) {
  return [
    ["Use case title", intake.title.trim()],
    ["Business problem", intake.businessProblem.trim()],
    ["Current process", intake.currentProcess.trim()],
    ["Desired outcome", intake.desiredOutcome.trim()],
    ["AI should help with", intake.aiHelp.trim()],
    ["AI must not do", intake.aiNotDo.trim()],
    ["Approved data source", parseIntakeSources(intake.dataSources).length > 0],
    ["Monthly volume", intake.monthlyVolume > 0],
    ["Average handling time", intake.avgHandlingTimeMinutes > 0],
    ["Estimated users", intake.estimatedUsers > 0],
  ]
    .filter(([, value]) => !value)
    .map(([label]) => String(label));
}

function intakeMissingEvidence(intake: IntakeForm, missingFields: string[]) {
  const missing = new Set<string>();
  missingFields.forEach((field) => missing.add(field));
  if (intake.dataSensitivity !== "low") missing.add("Data owner approval");
  if (intake.humanReview) missing.add("Human oversight rule");
  if (intake.externalCommunication) missing.add("External communication approval path");
  return Array.from(missing);
}

function caseMissingEvidence(useCase: UseCase, riskCategories: string[]) {
  const missing = new Set<string>();
  if (!useCase.ownerId) missing.add("Accountable owner");
  if (!useCase.dataSources.length) missing.add("Approved context sources");
  if (!useCase.risks.length) missing.add("Risk register");
  if (!useCase.monthlyVolume || !useCase.avgHandlingTimeMinutes) missing.add("Value baseline");
  if (!useCase.desiredOutcome.trim()) missing.add("Target outcome statement");
  if (riskCategories.includes("Data privacy") && useCase.riskLevel !== "low") missing.add("Privacy review evidence");
  if (riskCategories.includes("Security")) missing.add("Security review evidence");
  if (riskCategories.includes("External communication")) missing.add("External communication policy");
  if (!["governance_review", "approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(useCase.status)) missing.add("Governance routing decision");
  return Array.from(missing);
}

function discoveryQuestionsFor({
  title,
  department,
  riskCategories,
  dataSources,
  currentProcess,
}: {
  title: string;
  department: Department;
  riskCategories: string[];
  dataSources: string[];
  currentProcess: string;
}) {
  const questions = [
    `Which ${department} roles do the work today, and where do they lose the most time?`,
    `What exact decision boundary should ${title} never cross without a human?`,
    dataSources.length
      ? `Who owns ${dataSources[0]}, and can access be permission-filtered by role?`
      : "Which approved source of truth should ground the first pilot?",
    "What telemetry will prove adoption, time saved, quality, and risk reduction after two weeks?",
  ];
  if (!currentProcess.trim()) questions.unshift("What is the current-state workflow, including handoffs, systems, and exceptions?");
  if (riskCategories.includes("External communication")) questions.push("Which external messages must be drafted only, and who approves them?");
  if (riskCategories.includes("Employee impact")) questions.push("Could this affect employees' pay, benefits, leave, performance, or employment status?");
  if (riskCategories.includes("Financial exposure")) questions.push("What financial approvals or controls must remain outside the AI path?");
  return Array.from(new Set(questions)).slice(0, 6);
}

function successMetricsFor({
  title,
  department,
  monthlyVolume,
  avgHandlingTimeMinutes,
  estimatedUsers,
  riskLevel,
}: Pick<UseCase, "title" | "department" | "monthlyVolume" | "avgHandlingTimeMinutes" | "estimatedUsers" | "riskLevel">) {
  const monthlyHours = Math.round((monthlyVolume * avgHandlingTimeMinutes) / 60);
  return [
    monthlyHours > 0 ? `${monthlyHours.toLocaleString()} monthly hours available for reduction` : "Baseline monthly hours captured before pilot launch",
    estimatedUsers > 0 ? `${estimatedUsers.toLocaleString()} ${department} users or stakeholders in the adoption cohort` : "Pilot cohort and weekly active usage defined",
    "90%+ eval pass rate before launch expansion",
    "Zero critical policy violations during pilot",
    `${title} produces cited, reviewable outputs for high-impact decisions`,
    riskLevel === "low" ? "Human escalation rate tracked for low-confidence cases" : "Human approval evidence captured for sensitive outcomes",
  ];
}

function pilotGuardrailsFor({
  riskLevel,
  riskCategories,
  externalCommunication,
  humanReview,
  autonomyTier,
}: {
  riskLevel: RiskLevel;
  riskCategories: string[];
  externalCommunication: boolean;
  humanReview: boolean;
  autonomyTier: AutonomyTier;
}) {
  const guardrails = [
    `Autonomy capped at ${autonomyTier.replace(/_/g, " ")}`,
    "All runs write trace, cost, policy, and evidence records",
    "Outputs require citations or explicit uncertainty",
  ];
  if (humanReview || riskLevel !== "low") guardrails.push("Human approval required for ambiguous or sensitive outputs");
  if (externalCommunication || riskCategories.includes("External communication")) guardrails.push("External messages remain draft-only until legal approves send permissions");
  if (riskCategories.includes("Data privacy")) guardrails.push("PII redaction and role-filtered retrieval required before pilot");
  if (riskCategories.includes("Financial exposure")) guardrails.push("No payment, journal entry, or financial statement approval delegated to AI");
  return guardrails;
}

function intakeNextAction(intake: IntakeForm, missingFields: string[]): IntelligenceAction {
  if (missingFields.length) {
    return {
      title: `Complete ${missingFields[0]}`,
      body: `${missingFields.length} intake item${missingFields.length === 1 ? "" : "s"} remain before this can become a scored opportunity.`,
      targetTab: "intake",
    };
  }
  if (intake.dataSensitivity !== "low" || intake.humanReview || intake.externalCommunication) {
    return {
      title: "Submit and route governance",
      body: "The opportunity is ready to score, but governance routing should be created immediately because risk or oversight is present.",
      targetTab: "backlog",
    };
  }
  return {
    title: "Submit and score",
    body: "The opportunity has enough discovery data to become a scored backlog item.",
    targetTab: "backlog",
  };
}

function caseNextAction(useCase: UseCase, missingEvidence: string[]): IntelligenceAction {
  if (missingEvidence.length) {
    return {
      title: `Close evidence gap: ${missingEvidence[0]}`,
      body: `${missingEvidence.length} evidence item${missingEvidence.length === 1 ? "" : "s"} should be closed before broader pilot approval.`,
      targetTab: "detail",
      useCaseId: useCase.id,
    };
  }
  if (useCase.status === "scored") {
    return {
      title: "Request governance review",
      body: "The use case is scored and ready for risk, data, tool, and oversight review.",
      targetTab: "scoring",
      useCaseId: useCase.id,
    };
  }
  if (useCase.status === "governance_review") {
    return {
      title: "Package review evidence",
      body: "Attach eval, context, tool policy, and value assumptions so reviewers can approve or request changes.",
      targetTab: "detail",
      useCaseId: useCase.id,
    };
  }
  if (!useCase.linkedSkillId && ["approved_for_pilot", "in_pilot", "measuring"].includes(useCase.status)) {
    return {
      title: "Convert to reusable Skill",
      body: "The opportunity is ready to become a governed Skill with prompt, tools, context, evals, and run evidence.",
      targetTab: "pilot",
      useCaseId: useCase.id,
    };
  }
  return {
    title: "Measure pilot value",
    body: "Replace assumptions with run telemetry, user adoption, feedback, and evidence-backed ROI.",
    targetTab: "value",
    useCaseId: useCase.id,
  };
}

function factoryNextAction({
  activeCount,
  topOpportunity,
  scoredWithoutGovernance,
  governanceQueue,
  readyWithoutSkill,
  incompleteEvidence,
}: {
  activeCount: number;
  topOpportunity?: UseCase;
  scoredWithoutGovernance: UseCase[];
  governanceQueue: UseCase[];
  readyWithoutSkill: UseCase[];
  incompleteEvidence: UseCase[];
}): IntelligenceAction {
  if (!activeCount) {
    return {
      title: "Capture the first AI opportunity",
      body: "Start with one department pain point, then let the Factory create a scored, governable record.",
      targetTab: "intake",
    };
  }
  if (scoredWithoutGovernance[0]) {
    return {
      title: `Send ${scoredWithoutGovernance[0].title} to governance`,
      body: "A scored opportunity is waiting for formal risk, context, tool, and oversight review.",
      targetTab: "scoring",
      useCaseId: scoredWithoutGovernance[0].id,
    };
  }
  if (readyWithoutSkill[0]) {
    return {
      title: `Convert ${readyWithoutSkill[0].title} into a Skill`,
      body: "A pilot-ready opportunity should now become a reusable governed capability.",
      targetTab: "pilot",
      useCaseId: readyWithoutSkill[0].id,
    };
  }
  if (incompleteEvidence[0]) {
    return {
      title: `Close evidence for ${incompleteEvidence[0].title}`,
      body: "The opportunity has remaining proof gaps before launch-readiness can be defended.",
      targetTab: "detail",
      useCaseId: incompleteEvidence[0].id,
    };
  }
  if (governanceQueue[0]) {
    return {
      title: `Unblock ${governanceQueue[0].title}`,
      body: "Governance is active. Package evidence and reviewer decisions to keep the pilot moving.",
      targetTab: "backlog",
      useCaseId: governanceQueue[0].id,
    };
  }
  return {
    title: topOpportunity ? `Advance ${topOpportunity.title}` : "Open the backlog",
    body: "Open the highest-priority opportunity and move it through discovery, governance, Skill conversion, and measurement.",
    targetTab: topOpportunity ? "detail" : "backlog",
    useCaseId: topOpportunity?.id,
  };
}

function portfolioGapsFor(useCases: UseCase[], missingDepartments: Department[]) {
  const gaps: string[] = [];
  if (!useCases.length) return ["No opportunity portfolio exists yet"];
  if (missingDepartments.length) gaps.push(`No active opportunity in ${missingDepartments.slice(0, 3).join(", ")}${missingDepartments.length > 3 ? "..." : ""}`);
  if (!useCases.some((item) => item.dataSources.length)) gaps.push("No opportunity has approved context sources");
  if (!useCases.some((item) => item.status === "governance_review")) gaps.push("No active governance review in the factory");
  if (!useCases.some((item) => item.linkedSkillId)) gaps.push("No opportunity has been industrialized into a reusable Skill");
  if (!useCases.some((item) => item.priorityScore >= 75)) gaps.push("No high-priority opportunity has crossed the 75/100 threshold");
  return gaps.slice(0, 5);
}

function governanceBottlenecksFor(scoredWithoutGovernance: UseCase[], governanceQueue: UseCase[], readyWithoutSkill: UseCase[]) {
  const bottlenecks: string[] = [];
  if (scoredWithoutGovernance.length) bottlenecks.push(`${scoredWithoutGovernance.length} scored opportunit${scoredWithoutGovernance.length === 1 ? "y" : "ies"} waiting for governance routing`);
  if (governanceQueue.length) bottlenecks.push(`${governanceQueue.length} review${governanceQueue.length === 1 ? "" : "s"} need evidence packaging or reviewer decisions`);
  if (readyWithoutSkill.length) bottlenecks.push(`${readyWithoutSkill.length} pilot-ready opportunit${readyWithoutSkill.length === 1 ? "y" : "ies"} not yet converted to Skills`);
  return bottlenecks.length ? bottlenecks : ["No current governance bottleneck detected"];
}

function reusablePatternSignalsFor(useCases: UseCase[]) {
  const patterns = useCases.reduce<Record<string, number>>((accumulator, useCase) => {
    const pattern = deriveUseCaseIntelligence(useCase).recommendedPattern;
    accumulator[pattern] = (accumulator[pattern] ?? 0) + 1;
    return accumulator;
  }, {});

  const entries = Object.entries(patterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      tone: count >= 3 ? "green" as const : count === 2 ? "blue" as const : "slate" as const,
      helper: count >= 2 ? "Candidate reusable pattern" : "Single-use signal so far",
    }));

  return entries.length ? entries : [{ label: "No patterns yet", count: 0, tone: "slate" as const, helper: "Capture opportunities to reveal reusable templates" }];
}

function confidenceFromSignals({
  sourceCount,
  hasProblem,
  hasProcess,
  hasOutcome,
  hasBoundary,
  hasValue,
  hasOwner,
  hasRisks,
}: {
  sourceCount: number;
  hasProblem: boolean;
  hasProcess: boolean;
  hasOutcome: boolean;
  hasBoundary: boolean;
  hasValue: boolean;
  hasOwner: boolean;
  hasRisks: boolean;
}) {
  const score =
    (hasProblem ? 14 : 0) +
    (hasProcess ? 12 : 0) +
    (hasOutcome ? 12 : 0) +
    (hasBoundary ? 12 : 0) +
    (hasValue ? 18 : 0) +
    (sourceCount ? Math.min(16, sourceCount * 7) : 0) +
    (hasOwner ? 8 : 0) +
    (hasRisks ? 8 : 0);
  return Math.max(0, Math.min(100, score));
}

function dataReadinessLabel(sourceCount: number, riskLevel: RiskLevel): "not ready" | "partial" | "ready" {
  if (!sourceCount) return "not ready";
  if (sourceCount === 1 || riskLevel === "high" || riskLevel === "restricted") return "partial";
  return "ready";
}

function valueConfidenceFor(monthlyVolume: number, avgHandlingTimeMinutes: number, sourceCount: number): "low" | "medium" | "high" {
  if (monthlyVolume > 0 && avgHandlingTimeMinutes > 0 && sourceCount >= 2) return "high";
  if (monthlyVolume > 0 || avgHandlingTimeMinutes > 0 || sourceCount > 0) return "medium";
  return "low";
}

function intakeReadinessItems(intake: IntakeForm, sources: string[], reviews: string[]): IntelligenceChecklistItem[] {
  return [
    {
      label: "Problem and process framed",
      complete: Boolean(intake.businessProblem.trim() && intake.currentProcess.trim()),
      owner: "Business owner",
      action: "Document the current pain, process, and affected roles.",
    },
    {
      label: "AI boundary defined",
      complete: Boolean(intake.aiHelp.trim() && intake.aiNotDo.trim()),
      owner: "AI product owner",
      action: "Separate allowed assistance from prohibited decisions or actions.",
    },
    {
      label: "Context source identified",
      complete: sources.length > 0,
      owner: "Data owner",
      action: "Name the approved source of truth for retrieval or grounding.",
    },
    {
      label: "Review route inferred",
      complete: reviews.length > 1,
      owner: "Governance",
      action: "Confirm required privacy, security, legal, or business reviews.",
    },
    {
      label: "Value baseline quantified",
      complete: intake.monthlyVolume > 0 && intake.avgHandlingTimeMinutes > 0,
      owner: "Finance partner",
      action: "Capture monthly volume and average handling time.",
    },
  ];
}

function caseReadinessItems(useCase: UseCase, missingEvidence: string[]): IntelligenceChecklistItem[] {
  return [
    {
      label: "Owner assigned",
      complete: Boolean(useCase.ownerId),
      owner: "AI Enablement",
      action: "Assign the accountable product owner.",
    },
    {
      label: "Data sources approved",
      complete: useCase.dataSources.length > 0 && !missingEvidence.includes("Approved context sources"),
      owner: "Data owner",
      action: "Confirm context source access and classification.",
    },
    {
      label: "Risk controls drafted",
      complete: useCase.risks.length > 0,
      owner: "Governance",
      action: "Document key risks and required mitigations.",
    },
    {
      label: "Governance route set",
      complete: ["governance_review", "approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(useCase.status),
      owner: "Governance",
      action: "Submit or package the review record.",
    },
    {
      label: "Value baseline defensible",
      complete: useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0,
      owner: "Finance partner",
      action: "Validate volume, time, and adoption assumptions.",
    },
  ];
}

function generatedIntakeSummary(intake: IntakeForm, recommendedPattern: string) {
  if (!intake.title.trim() || !intake.businessProblem.trim()) {
    return "Add the problem and desired AI boundary to generate a complete use case brief.";
  }

  return `${intake.title.trim()} is a ${intake.department} opportunity to reduce manual effort and improve reliability in the current workflow. The recommended first pattern is ${recommendedPattern}, with AI helping to ${intake.aiHelp.trim() || "structure work and retrieve approved context"} while explicitly avoiding ${intake.aiNotDo.trim() || "restricted decisions, unapproved data, or unreviewed actions"}.`;
}
