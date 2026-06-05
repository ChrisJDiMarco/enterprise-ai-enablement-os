import type { UseCase } from "./enterprise-ai-data.ts";
import { formatCurrency } from "./enterprise-ai-data.ts";
import { deriveUseCaseIntelligence } from "./use-case-intelligence.ts";

const autonomyLabelByTier: Record<string, string> = {
  tier_0_draft_only: "Tier 0 - Draft only",
  tier_1_read_only: "Tier 1 - Read only",
  tier_2_prepare_action: "Tier 2 - Prepare action",
  tier_3_execute_bounded_action: "Tier 3 - Execute bounded action",
  tier_4_autonomous_workflow: "Tier 4 - Autonomous workflow",
  tier_5_restricted: "Tier 5 - Restricted",
};

export type PilotBriefSourcePacket = {
  useCase: {
    id: string;
    title: string;
    department: string;
    status: string;
    riskLevel: string;
    priorityScore: number;
    monthlyVolume: number;
    avgHandlingTimeMinutes: number;
    estimatedUsers: number;
    capabilityType: string;
    businessProblem: string;
    currentProcess: string;
    desiredOutcome: string;
    dataSources: string[];
    risks: string[];
    expectedBenefits: string[];
  };
  intelligence: {
    recommendedPattern: string;
    patternReason: string;
    autonomyTier: string;
    autonomyLabel: string;
    confidenceScore: number;
    valueConfidence: string;
    dataReadinessLabel: string;
    requiredReviews: string[];
    riskCategories: string[];
    missingEvidence: string[];
    successMetrics: string[];
    pilotGuardrails: string[];
    discoveryQuestions: string[];
  };
  valueModel: {
    monthlyHours: number;
    annualValueUsd: number;
    conservativeValueUsd: number;
    expectedValueUsd: number;
    optimisticValueUsd: number;
    fteImpact: number;
    loadedHourlyCostUsd: number;
  };
};

export function buildPilotBriefSourcePacket(useCase: UseCase): PilotBriefSourcePacket {
  const intelligence = deriveUseCaseIntelligence(useCase);
  const monthlyHours = Math.round((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60);
  const annualValueUsd = monthlyHours * 68 * 12;

  return {
    useCase: {
      id: useCase.id,
      title: useCase.title,
      department: useCase.department,
      status: useCase.status,
      riskLevel: useCase.riskLevel,
      priorityScore: useCase.priorityScore,
      monthlyVolume: useCase.monthlyVolume,
      avgHandlingTimeMinutes: useCase.avgHandlingTimeMinutes,
      estimatedUsers: useCase.estimatedUsers,
      capabilityType: useCase.capabilityType,
      businessProblem: useCase.businessProblem,
      currentProcess: useCase.currentProcess,
      desiredOutcome: useCase.desiredOutcome,
      dataSources: useCase.dataSources,
      risks: useCase.risks,
      expectedBenefits: useCase.expectedBenefits,
    },
    intelligence: {
      recommendedPattern: intelligence.recommendedPattern,
      patternReason: intelligence.patternReason,
      autonomyTier: intelligence.autonomyTier,
      autonomyLabel: autonomyLabelByTier[intelligence.autonomyTier] ?? intelligence.autonomyTier,
      confidenceScore: intelligence.confidenceScore,
      valueConfidence: intelligence.valueConfidence,
      dataReadinessLabel: intelligence.dataReadinessLabel,
      requiredReviews: intelligence.requiredReviews,
      riskCategories: intelligence.riskCategories,
      missingEvidence: intelligence.missingEvidence,
      successMetrics: intelligence.successMetrics,
      pilotGuardrails: intelligence.pilotGuardrails,
      discoveryQuestions: intelligence.discoveryQuestions,
    },
    valueModel: {
      monthlyHours,
      annualValueUsd,
      conservativeValueUsd: Math.round(annualValueUsd * 0.55),
      expectedValueUsd: Math.round(annualValueUsd * 0.8),
      optimisticValueUsd: Math.round(annualValueUsd * 1.15),
      fteImpact: Number((((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60) * 12 / 5200).toFixed(1)),
      loadedHourlyCostUsd: 68,
    },
  };
}

export function buildDeterministicPilotBrief(useCase: UseCase) {
  const packet = buildPilotBriefSourcePacket(useCase);
  const evidenceGaps = packet.intelligence.missingEvidence.length
    ? packet.intelligence.missingEvidence
    : ["No critical evidence gaps identified before pilot planning."];

  return `# ${packet.useCase.title} Pilot Brief

## Executive Pilot Thesis
${packet.useCase.title} should be piloted as a ${packet.intelligence.recommendedPattern} for ${packet.useCase.department}. The pilot should prove whether the workflow can reduce manual effort while preserving policy boundaries, human oversight, measurable value, and launch evidence.

## Business Problem
${packet.useCase.businessProblem}

## Current Process
${packet.useCase.currentProcess}

## Desired Outcome
${packet.useCase.desiredOutcome}

## Pilot Scope
- Pilot cohort: ${Math.min(packet.useCase.estimatedUsers, 250).toLocaleString()} users or stakeholders
- Duration: 4 weeks
- Monthly volume baseline: ${packet.useCase.monthlyVolume.toLocaleString()} items
- Current handling-time baseline: ${packet.useCase.avgHandlingTimeMinutes} minutes per item
- Context sources: ${packet.useCase.dataSources.length ? packet.useCase.dataSources.join(", ") : "approved sources still required"}

## AI Pattern And Autonomy
- Pattern: ${packet.intelligence.recommendedPattern}
- Rationale: ${packet.intelligence.patternReason}
- Autonomy tier: ${packet.intelligence.autonomyLabel}
- Required reviews: ${packet.intelligence.requiredReviews.join(", ")}

## Success Metrics
${packet.intelligence.successMetrics.map((metric) => `- ${metric}`).join("\n")}

## Guardrails
${packet.intelligence.pilotGuardrails.map((guardrail) => `- ${guardrail}`).join("\n")}

## Value Model
- Monthly hours available for reduction: ${packet.valueModel.monthlyHours.toLocaleString()}
- Conservative annualized value: ${formatCurrency(packet.valueModel.conservativeValueUsd)}
- Expected annualized value: ${formatCurrency(packet.valueModel.expectedValueUsd)}
- Optimistic annualized value: ${formatCurrency(packet.valueModel.optimisticValueUsd)}
- Gross annual value baseline: ${formatCurrency(packet.valueModel.annualValueUsd)}
- FTE capacity impact: ${packet.valueModel.fteImpact.toFixed(1)}

## Evidence To Close Before Expansion
${evidenceGaps.map((item) => `- ${item}`).join("\n")}

## Discovery Questions
${packet.intelligence.discoveryQuestions.map((question) => `- ${question}`).join("\n")}

## Launch Decision Gate
Approve expansion only after eval results, run traces, adoption telemetry, user feedback, governance decisions, and ROI assumptions are attached to the evidence ledger.`;
}

export function buildPilotBriefSystemPrompt() {
  return [
    "You are an enterprise AI enablement pilot-planning assistant.",
    "Create an executive-ready pilot brief from the provided source packet only.",
    "Do not invent facts, counts, approvals, integrations, dates, ROI, owners, or evidence.",
    "If evidence is missing, call it out as a gap and turn it into a launch condition.",
    "Use concise Markdown with clear headings and bullet points.",
    "The brief must be practical for AI Enablement, Legal, Security, Privacy, Finance, and the business owner.",
    "Return Markdown only. Do not wrap the answer in code fences.",
  ].join("\n");
}

export function buildPilotBriefUserPrompt(params: {
  sourcePacket: PilotBriefSourcePacket;
  deterministicBrief: string;
}) {
  return [
    "Generate a pilot brief from this source packet.",
    "",
    "Required sections:",
    "1. Executive Pilot Thesis",
    "2. Business Problem",
    "3. Pilot Scope",
    "4. AI Pattern And Autonomy",
    "5. Success Metrics",
    "6. Guardrails",
    "7. Value Model",
    "8. Evidence To Close Before Expansion",
    "9. Launch Decision Gate",
    "",
    "Source packet JSON:",
    JSON.stringify(params.sourcePacket, null, 2),
    "",
    "Deterministic fallback draft for style and coverage reference:",
    params.deterministicBrief,
  ].join("\n");
}

export function cleanGeneratedPilotBrief(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!cleaned || !/^#\s+/m.test(cleaned) || !/Pilot|Scope|Guardrails|Value/i.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}
