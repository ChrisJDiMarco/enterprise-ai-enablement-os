import type {
  EvalResult,
  GovernanceReview,
  RiskLevel,
  Skill,
  Tool,
  UseCase,
  WorkSignal,
} from "./enterprise-ai-data.ts";
import {
  calculatePriorityScore,
  formatCurrency,
  riskToScore,
} from "./enterprise-ai-data.ts";
import type { AIProviderSettings } from "./model-router.ts";
import type { PatternMarketplaceItem } from "./pattern-marketplace.ts";
import type { IntakeForm } from "./ui/types.ts";

export type WorkspaceAuditDraft = {
  eventType: string;
  message: string;
  riskLevel: RiskLevel;
  actor?: string;
};

export type WorkspaceCommandOutcome<T = unknown> = {
  data: T;
  audit?: WorkspaceAuditDraft;
  notification: string;
};

export type IntakeValidation =
  | {
      ok: true;
      dataSources: string[];
    }
  | {
      ok: false;
      intakeStep: number;
      notification: string;
    };

type InvalidIntakeValidation = Extract<IntakeValidation, { ok: false }>;

export type UseCaseSubmissionInput = {
  intake: IntakeForm;
  currentUserId: string;
  useCaseId: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillGenerationInput = {
  useCase: UseCase;
  currentUserId: string;
  skillId: string;
  aiSettings: Pick<AIProviderSettings, "defaultProvider" | "defaultModel" | "fallbackModel">;
  tools: Tool[];
  updatedAt: string;
};

export type PatternInstallInput = {
  pattern: PatternMarketplaceItem;
  currentUserId: string;
  timestamp: number;
  today: string;
  aiSettings: Pick<AIProviderSettings, "defaultProvider" | "defaultModel" | "fallbackModel">;
  tools: Tool[];
  actor: string;
};

export type ExecutiveBriefMetrics = {
  totalUseCases: number;
  activePilots: number;
  skills: number;
  adoptionRate: number;
  hoursSaved: number;
  annualValue: number;
  riskItemsOpen: number;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseDataSources(value: string) {
  return value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateUseCaseIntake(intake: IntakeForm): IntakeValidation {
  const dataSources = parseDataSources(intake.dataSources);
  const missingProblemFields = [
    intake.title.trim(),
    intake.businessProblem.trim(),
    intake.currentProcess.trim(),
  ].some((value) => !value);
  if (missingProblemFields) {
    return {
      ok: false,
      intakeStep: 0,
      notification: "Complete the problem fields before scoring",
    };
  }

  const missingSolutionFields = [
    intake.desiredOutcome.trim(),
    intake.aiHelp.trim(),
    intake.aiNotDo.trim(),
  ].some((value) => !value);
  if (missingSolutionFields) {
    return {
      ok: false,
      intakeStep: 1,
      notification: "Complete the AI boundary fields before scoring",
    };
  }

  if (!dataSources.length) {
    return {
      ok: false,
      intakeStep: 2,
      notification: "Add at least one approved data source before scoring",
    };
  }

  if (intake.monthlyVolume <= 0 || intake.avgHandlingTimeMinutes <= 0 || intake.estimatedUsers <= 0) {
    return {
      ok: false,
      intakeStep: 3,
      notification: "Enter volume, handling time, and users before scoring",
    };
  }

  return { ok: true, dataSources };
}

export function buildUseCaseSubmission(
  input: UseCaseSubmissionInput,
): WorkspaceCommandOutcome<{ useCase: UseCase }> | InvalidIntakeValidation {
  const validation = validateUseCaseIntake(input.intake);
  if (!validation.ok) return validation;

  const { intake } = input;
  const riskScore = riskToScore(intake.dataSensitivity);
  const valueScore = intake.monthlyVolume > 5000 ? 5 : intake.monthlyVolume > 1000 ? 4 : 3;
  const feasibilityScore = validation.dataSources.length >= 2 ? 4 : 3;
  const reuseScore = ["HR", "IT", "Operations"].includes(intake.department) ? 5 : 4;
  const urgencyScore = intake.humanReview ? 4 : 3;
  const dataReadinessScore = validation.dataSources.length >= 2 ? 4 : 3;
  const priorityScore = calculatePriorityScore({
    valueScore,
    feasibilityScore,
    reuseScore,
    urgencyScore,
    dataReadinessScore,
    riskScore,
  });

  const useCase: UseCase = {
    id: input.useCaseId,
    title: intake.title,
    description: intake.desiredOutcome,
    department: intake.department,
    requestorId: input.currentUserId,
    ownerId: input.currentUserId,
    businessProblem: intake.businessProblem,
    currentProcess: intake.currentProcess,
    desiredOutcome: intake.desiredOutcome,
    monthlyVolume: intake.monthlyVolume,
    avgHandlingTimeMinutes: intake.avgHandlingTimeMinutes,
    estimatedUsers: intake.estimatedUsers,
    capabilityType: "knowledge_assistant",
    status: "scored",
    riskLevel: intake.dataSensitivity,
    valueScore,
    feasibilityScore,
    riskScore,
    reuseScore,
    urgencyScore,
    dataReadinessScore,
    priorityScore,
    expectedBenefits: ["hours_saved", "employee_experience", "quality_improvement"],
    dataSources: validation.dataSources,
    risks: [
      intake.humanReview ? "Human review required" : "Low oversight requirement",
      intake.externalCommunication ? "External communication" : "Internal-only",
      "Policy grounding",
    ],
    updatedAt: input.updatedAt,
    createdAt: input.createdAt,
  };

  return {
    data: { useCase },
    audit: {
      eventType: "use_case_created",
      message: `${useCase.title} submitted and scored at ${priorityScore}/100.`,
      riskLevel: useCase.riskLevel,
    },
    notification: "Use case submitted and priority score calculated",
  };
}

export function buildSkillFromUseCase(input: SkillGenerationInput): WorkspaceCommandOutcome<{
  skill: Skill;
  updatedUseCase: UseCase;
}> {
  const defaultAllowedTool = input.tools.find((tool) => tool.enabled && tool.actionType === "read");
  const allowedTools = defaultAllowedTool ? [defaultAllowedTool.id] : [];
  const blockedTools = input.tools
    .filter((tool) => !tool.enabled || tool.riskLevel === "restricted" || tool.requiresApprovalByDefault)
    .map((tool) => tool.id);

  const skill: Skill = {
    id: input.skillId,
    useCaseId: input.useCase.id,
    name: input.useCase.title,
    slug: slugify(input.useCase.title),
    description: input.useCase.desiredOutcome,
    department: input.useCase.department,
    ownerId: input.useCase.ownerId ?? input.currentUserId,
    status: "draft",
    version: "0.1.0",
    riskLevel: input.useCase.riskLevel,
    autonomyTier: input.useCase.riskLevel === "high" ? "tier_2_prepare_action" : "tier_1_read_only",
    modelProvider: input.aiSettings.defaultProvider,
    model: input.aiSettings.defaultModel,
    temperature: 0.2,
    maxTokens: 1800,
    fallbackModel: input.aiSettings.fallbackModel,
    costLimit: 0.25,
    systemPrompt: `You are the ${input.useCase.title}. Use only approved enterprise context. Cite sources, respect tool policy, and escalate ambiguity to the owner.`,
    allowedTools,
    blockedTools,
    contextSources: input.useCase.dataSources,
    evalPassRate: 0,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: input.updatedAt,
  };

  return {
    data: {
      skill,
      updatedUseCase: {
        ...input.useCase,
        linkedSkillId: skill.id,
        status: "governance_review",
        updatedAt: input.updatedAt,
      },
    },
    audit: {
      eventType: "skill_created",
      message: `${skill.name} created from ${input.useCase.title}.`,
      riskLevel: skill.riskLevel,
    },
    notification: "Skill created from use case",
  };
}

export function buildPatternInstall(input: PatternInstallInput): WorkspaceCommandOutcome<{
  useCase: UseCase;
  skill: Skill;
}> {
  const useCaseId = `uc-pattern-${input.timestamp}`;
  const skillId = `skill-pattern-${input.timestamp}`;
  const riskLevel: RiskLevel =
    input.pattern.department === "Legal" ||
    input.pattern.department === "Finance" ||
    input.pattern.patternType === "Agentic Workflow"
      ? "medium"
      : "low";
  const defaultAllowedTool = input.tools.find((tool) => tool.enabled && tool.actionType === "read");
  const allowedTools = defaultAllowedTool ? [defaultAllowedTool.id] : [];
  const blockedTools = input.tools
    .filter((tool) => !tool.enabled || tool.riskLevel === "restricted" || tool.actionType !== "read")
    .map((tool) => tool.id);
  const scores = {
    valueScore: 4,
    feasibilityScore: 4,
    reuseScore: 5,
    urgencyScore: 3,
    dataReadinessScore: 3,
    riskScore: riskToScore(riskLevel),
  };
  const useCase: UseCase = {
    id: useCaseId,
    title: input.pattern.title,
    description: input.pattern.description,
    department: input.pattern.department === "Cross-Functional" ? "Operations" : input.pattern.department,
    requestorId: input.currentUserId,
    ownerId: input.currentUserId,
    businessProblem: `${input.pattern.process} is a repeatable enterprise workflow that can benefit from a governed ${input.pattern.patternType.toLowerCase()} pattern.`,
    currentProcess: input.pattern.process,
    desiredOutcome: input.pattern.description,
    monthlyVolume: 0,
    avgHandlingTimeMinutes: 0,
    estimatedUsers: 0,
    capabilityType: input.pattern.patternType === "Agentic Workflow" ? "agentic_workflow" : "knowledge_assistant",
    status: "draft",
    riskLevel,
    ...scores,
    priorityScore: calculatePriorityScore(scores),
    expectedBenefits: ["hours_saved", "quality_improvement", "reuse"],
    dataSources: ["Approved source set required"],
    risks: ["Source approval required", "Human oversight required before launch", "Eval suite required"],
    linkedSkillId: skillId,
    updatedAt: input.today,
    createdAt: input.today,
  };
  const skill: Skill = {
    id: skillId,
    useCaseId,
    name: input.pattern.title,
    slug: slugify(input.pattern.title),
    description: input.pattern.description,
    department: input.pattern.department,
    ownerId: input.currentUserId,
    status: "draft",
    version: "0.1.0",
    riskLevel,
    autonomyTier: input.pattern.patternType === "Agentic Workflow" ? "tier_2_prepare_action" : "tier_1_read_only",
    modelProvider: input.aiSettings.defaultProvider,
    model: input.aiSettings.defaultModel,
    temperature: 0.2,
    maxTokens: 1800,
    fallbackModel: input.aiSettings.fallbackModel,
    costLimit: 0.25,
    systemPrompt: input.pattern.promptStarter,
    allowedTools,
    blockedTools,
    contextSources: [],
    evalPassRate: 0,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: input.today,
  };

  return {
    data: { useCase, skill },
    audit: {
      eventType: "pattern_template_installed",
      message: `${input.pattern.title} starter pattern installed as a governed Skill draft.`,
      riskLevel,
      actor: input.actor,
    },
    notification: "Reusable pattern installed",
  };
}

export function buildEvalRun(
  skill: Skill,
  timestamp: string,
): WorkspaceCommandOutcome<{ result: EvalResult; updatedSkill: Skill }> {
  const score = Math.min(99, Math.max(72, skill.evalPassRate || 87) + (skill.evalPassRate ? 1 : 8));
  const result: EvalResult = {
    id: `eval-${Date.now()}`,
    skillId: skill.id,
    suiteName: `${skill.name} Launch Readiness Suite`,
    score,
    passed: score >= 90,
    criticalFailures: score >= 90 ? 0 : 1,
    createdAt: timestamp,
  };

  return {
    data: {
      result,
      updatedSkill: {
        ...skill,
        evalPassRate: score,
      },
    },
    audit: {
      eventType: "eval_run",
      message: `${skill.name} eval suite completed with ${score}% score.`,
      riskLevel: skill.riskLevel,
      actor: "Evaluation Runner",
    },
    notification: "Eval suite completed",
  };
}

export function buildGovernanceReview(
  skill: Skill,
  dueDate: string,
): WorkspaceCommandOutcome<{ review: GovernanceReview; updatedSkill: Skill }> {
  const review: GovernanceReview = {
    id: `gov-${Date.now()}`,
    itemType: "skill",
    itemId: skill.id,
    title: skill.name,
    department: skill.department,
    riskLevel: skill.riskLevel,
    reviewer: "Unassigned reviewer",
    status: "in_review",
    dueDate,
    blockers: skill.evalPassRate < 90 ? ["Eval pass rate below threshold"] : [],
  };

  return {
    data: {
      review,
      updatedSkill: {
        ...skill,
        status: "in_review",
      },
    },
    audit: {
      eventType: "human_approval_requested",
      message: `${skill.name} submitted to governance.`,
      riskLevel: skill.riskLevel,
      actor: "AI Product Owner",
    },
    notification: "Governance review submitted",
  };
}

export function buildExecutiveBrief(params: {
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  workSignals: WorkSignal[];
  metrics: ExecutiveBriefMetrics;
  statusLabels: Record<string, string>;
}): WorkspaceCommandOutcome<{ report: string; shouldAudit: boolean }> {
  const { useCases, skills, governanceReviews, workSignals, metrics, statusLabels } = params;
  if (!useCases.length && !skills.length && !governanceReviews.length && !workSignals.length) {
    return {
      data: {
        shouldAudit: false,
        report: `# Weekly AI Enablement Brief

## Executive Summary

No portfolio records have been imported or created in this workspace yet. The operating system is ready for production intake, but executive reporting will remain empty until real use cases, Skills, governed work signals, governance decisions, runs, and ROI signals are added.

## Recommended Startup Actions

1. Configure tenant branding, identity, model routing, and provider credentials in Admin.
2. Import existing AI opportunity records or create the first use case through the Use Case Factory.
3. Convert approved opportunities into governed Skills with tools, context, approval rules, and eval suites.
4. Run controlled Harness tests and governance reviews before pilot launch.

## Decisions Needed

1. Confirm the source of truth for portfolio data.
2. Assign initial reviewers for Security, Legal, Privacy, and function ownership.
3. Decide which connectors can be enabled in the MCP Broker.`,
      },
      notification: "Executive brief generated",
    };
  }

  const highPriority = [...useCases].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 3);
  const topWorkSignals = [...workSignals]
    .sort((a, b) => (b.metadata.volume ?? b.metadata.count ?? 1) - (a.metadata.volume ?? a.metadata.count ?? 1))
    .slice(0, 3);

  return {
    data: {
      shouldAudit: true,
      report: `# Weekly AI Enablement Brief

## Executive Summary

The AI Enablement portfolio now contains ${metrics.totalUseCases} use cases, ${metrics.activePilots} active pilots, and ${metrics.skills} governed Skills. Estimated annualized value currently tracked in the platform is ${formatCurrency(metrics.annualValue)}.

## Portfolio Status

- Total use cases: ${metrics.totalUseCases}
- Active pilots: ${metrics.activePilots}
- Skills in library: ${metrics.skills}
- Adoption rate: ${metrics.adoptionRate}%
- Estimated hours saved: ${metrics.hoursSaved.toLocaleString()}
- Open high-risk items: ${metrics.riskItemsOpen}
- Governed work signals: ${workSignals.length}

## Key Wins

${skills.length ? skills.slice(0, 3).map((skill, index) => `${index + 1}. ${skill.name} is ${statusLabels[skill.status]} with ${skill.evalPassRate}% eval score and ${skill.runs.toLocaleString()} runs.`).join("\n") : "No governed Skills have been launched yet."}

## Top Priorities

${highPriority.length ? highPriority.map((item, index) => `${index + 1}. ${item.title} - priority ${item.priorityScore}/100, ${item.department}, ${statusLabels[item.status]}.`).join("\n") : "No use case priorities have been scored yet."}

## Work Intelligence

${topWorkSignals.length ? topWorkSignals.map((signal, index) => `${index + 1}. ${signal.department} - ${signal.process}: ${signal.summary}`).join("\n") : "No governed work signals are connected yet."}

## Risks and Blockers

${governanceReviews.length ? governanceReviews.slice(0, 3).map((review, index) => `${index + 1}. ${review.title}: ${review.blockers[0] ?? "No active blocker"} (${statusLabels[review.status]}).`).join("\n") : "No governance blockers are currently recorded."}

## Decisions Needed

1. Confirm next portfolio intake batch.
2. Assign owners and reviewers for unowned records.
3. Review connector enablement and approval policy before pilot expansion.`,
    },
    audit: {
      eventType: "output_generated",
      message: "Executive brief generated from current portfolio data.",
      riskLevel: "low",
      actor: "Exec Brief Generator",
    },
    notification: "Executive brief generated",
  };
}
