import { deriveAdoptionRate } from "./adoption-model.ts";
import { activeCommandOrders } from "./command-orders.ts";
import { deriveCompanyBlueprint } from "./company-blueprint.ts";
import { deriveCompoundLearningLoop } from "./compound-learning-loop.ts";
import { deriveEnterpriseAiOperatingSystem } from "./enterprise-ai-operating-system.ts";
import {
  deriveAssistantQualityProgram,
  deriveConnectorPosture,
  deriveEvidenceQuality,
  deriveOperatingTimeline,
  deriveRoleOperatingMode,
  deriveWorkspaceSetupGuide,
} from "./enterprise-operating-intelligence.ts";
import { deriveEnterpriseMaturity } from "./enterprise-maturity.ts";
import { deriveIntegrationBlueprint } from "./integration-blueprint.ts";
import { derivePrimetimeLaunchGate } from "./primetime-launch-gate.ts";
import { buildRuntimeControlIntelligence } from "./runtime-control-plane.ts";
import { deriveTransformationCommandSystem } from "./transformation-command-system.ts";
import type { ProductionReadiness } from "./ui/types.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

type WorkflowReadiness = {
  nodeCount: number;
  edgeCount: number;
  valid: boolean;
  issues: number;
  warnings: number;
  firstIssue: string;
};

function deriveMetrics(workspace: EnterpriseWorkspace) {
  const activePilots = workspace.useCases.filter((item) =>
    ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status),
  ).length;
  const annualValue = workspace.skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);
  const openRisk = workspace.useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).length;

  return {
    totalUseCases: workspace.useCases.length,
    activePilots,
    skills: workspace.skills.length,
    adoptionRate: deriveAdoptionRate(workspace.skills, workspace.useCases),
    hoursSaved: Math.round(annualValue / 68),
    riskItemsOpen: openRisk,
    annualValue,
  };
}

function deriveWorkflowReadiness(workspace: EnterpriseWorkspace): WorkflowReadiness {
  const nodeCount = workspace.workflow.nodes.length;
  const edgeCount = workspace.workflow.edges.length;
  const hasMissingConnections = nodeCount > 1 && edgeCount < nodeCount - 1;
  const issues = hasMissingConnections ? 1 : 0;

  return {
    nodeCount,
    edgeCount,
    valid: nodeCount > 0 && issues === 0,
    issues,
    warnings: nodeCount > 0 && workspace.workflow.status !== "Published" ? 1 : 0,
    firstIssue: hasMissingConnections ? "Workflow blocks are not fully connected." : "",
  };
}

export function deriveTrustedOrchestratorWorkspaceContext(params: {
  workspace: EnterpriseWorkspace;
  productionReadiness?: ProductionReadiness | null;
  currentUserRole?: string;
  selectedSkillId?: string;
  selectedRunId?: string;
}) {
  const { workspace } = params;
  const metrics = deriveMetrics(workspace);
  const workflow = deriveWorkflowReadiness(workspace);
  const workflowInput = {
    nodeCount: workflow.nodeCount,
    status: workspace.workflow.status,
    valid: workflow.valid,
    issues: workflow.issues,
    warnings: workflow.warnings,
  };
  const productionReadiness = params.productionReadiness ?? null;
  const evidenceQuality = deriveEvidenceQuality({
    auditLogs: workspace.auditLogs,
    runs: workspace.runs,
    evalResults: workspace.evalResults,
    governanceReviews: workspace.governanceReviews,
    useCases: workspace.useCases,
    skills: workspace.skills,
    workSignals: workspace.workSignals,
  });
  const connectorPosture = deriveConnectorPosture({
    productionReadiness,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
  });
  const runtimeControl = buildRuntimeControlIntelligence({
    adapters: workspace.runtimeAdapters,
    importJobs: workspace.runtimeImportJobs,
    runtimeAssets: workspace.normalizedRuntimeAssets,
    importAudits: workspace.runtimeImportAudits,
  });
  const operatingTimeline = deriveOperatingTimeline({
    auditLogs: workspace.auditLogs,
    runs: workspace.runs,
    evalResults: workspace.evalResults,
    governanceReviews: workspace.governanceReviews,
    useCases: workspace.useCases,
    skills: workspace.skills,
    workSignals: workspace.workSignals,
  });
  const setupGuide = deriveWorkspaceSetupGuide({
    auditLogs: workspace.auditLogs,
    runs: workspace.runs,
    governanceReviews: workspace.governanceReviews,
    useCases: workspace.useCases,
    skills: workspace.skills,
    workSignals: workspace.workSignals,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
  });
  const roleProfile = deriveRoleOperatingMode(params.currentUserRole ?? workspace.users[0]?.role);
  const assistantQuality = deriveAssistantQualityProgram({
    evidenceQuality,
    hasActionButtons: true,
    hasSafeActionGates: true,
    hasInterpretationEvidence: true,
    hasWorkspaceContext: true,
  });
  const enterpriseMaturity = deriveEnterpriseMaturity({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    auditLogs: workspace.auditLogs,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    workSignals: workspace.workSignals,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    report: workspace.report,
    metrics,
    workflow: workflowInput,
    productionReadiness,
  });
  const integrationBlueprint = deriveIntegrationBlueprint({
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    productionReadiness,
  });
  const compoundLearningLoop = deriveCompoundLearningLoop({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    auditLogs: workspace.auditLogs,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    workSignals: workspace.workSignals,
    report: workspace.report,
    metrics,
    workflow: {
      nodeCount: workflow.nodeCount,
      status: workspace.workflow.status,
      valid: workflow.valid,
    },
  });
  const transformationCommand = deriveTransformationCommandSystem({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    auditLogs: workspace.auditLogs,
    workSignals: workspace.workSignals,
    report: workspace.report,
    metrics,
    workflow: {
      nodeCount: workflow.nodeCount,
      status: workspace.workflow.status,
      valid: workflow.valid,
      issues: workflow.issues,
    },
  });
  const companyBlueprint = deriveCompanyBlueprint({
    organization: workspace.organization,
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    workSignals: workspace.workSignals,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    metrics,
    workflow: {
      nodeCount: workflow.nodeCount,
      status: workspace.workflow.status,
      valid: workflow.valid,
    },
    enterpriseMaturity,
    integrationBlueprint,
  });
  const primetimeLaunchGate = derivePrimetimeLaunchGate({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    report: workspace.report,
    productionReadiness,
    enterpriseMaturity,
    integrationBlueprint,
    workflow: {
      nodeCount: workflow.nodeCount,
      valid: workflow.valid,
      issues: workflow.issues,
      status: workspace.workflow.status,
    },
  });
  const selectedSkill =
    workspace.skills.find((skill) => skill.id === params.selectedSkillId) ??
    workspace.skills[0] ??
    null;
  const selectedRun =
    workspace.runs.find((run) => run.id === params.selectedRunId) ??
    workspace.runs[0] ??
    null;
  const enterpriseAiOperatingSystem = deriveEnterpriseAiOperatingSystem({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    evalResults: workspace.evalResults,
    governanceReviews: workspace.governanceReviews,
    auditLogs: workspace.auditLogs,
    toolRequests: workspace.toolRequests,
    workSignals: workspace.workSignals,
    contextSources: workspace.contextSources,
    productionReadiness,
    report: workspace.report,
  });

  return {
    metrics,
    counts: {
      useCases: workspace.useCases.length,
      skills: workspace.skills.length,
      runs: workspace.runs.length,
      toolRequests: workspace.toolRequests.length,
      pendingToolRequests: workspace.toolRequests.filter((request) => request.status === "pending").length,
      auditLogs: workspace.auditLogs.length,
      governanceReviews: workspace.governanceReviews.length,
      evalResults: workspace.evalResults.length,
      workSignals: workspace.workSignals.length,
      commandOrders: workspace.commandOrders.length,
    },
    commandOrders: activeCommandOrders(workspace.commandOrders).slice(0, 8).map((order) => ({
      id: order.id,
      title: order.title,
      status: order.status,
      priority: order.priority,
      targetView: order.targetView,
      dueDate: order.dueDate,
      confidence: order.confidence,
    })),
    topUseCases: [...workspace.useCases]
      .sort((left, right) => right.priorityScore - left.priorityScore)
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        title: item.title,
        department: item.department,
        status: item.status,
        riskLevel: item.riskLevel,
        priorityScore: item.priorityScore,
        linkedSkillId: item.linkedSkillId,
      })),
    recentRuns: workspace.runs.slice(0, 8).map((run) => ({
      id: run.id,
      skillId: run.skillId,
      status: run.status,
      riskLevel: run.riskLevel,
      currentStage: run.currentStage,
      startedAt: run.startedAt,
    })),
    governanceReviews: workspace.governanceReviews.slice(0, 8).map((review) => ({
      id: review.id,
      title: review.title,
      status: review.status,
      riskLevel: review.riskLevel,
      blockers: review.blockers,
    })),
    workflow: {
      status: workspace.workflow.status,
      nodes: workflow.nodeCount,
      edges: workflow.edgeCount,
      valid: workflow.valid,
      issues: workflow.issues,
      warnings: workflow.warnings,
      firstIssue: workflow.firstIssue,
    },
    selectedSkill: selectedSkill
      ? {
          id: selectedSkill.id,
          name: selectedSkill.name,
          status: selectedSkill.status,
          riskLevel: selectedSkill.riskLevel,
          autonomyTier: selectedSkill.autonomyTier,
          evalPassRate: selectedSkill.evalPassRate,
          allowedTools: selectedSkill.allowedTools,
          contextSources: selectedSkill.contextSources,
        }
      : null,
    selectedRun: selectedRun
      ? {
          id: selectedRun.id,
          status: selectedRun.status,
          currentStage: selectedRun.currentStage,
          riskLevel: selectedRun.riskLevel,
        }
      : null,
    productionReadiness: {
      status: productionReadiness?.status ?? "unknown",
      blockers: (productionReadiness?.blockers ?? []).map((blocker) => blocker.label).slice(0, 8),
      warnings: (productionReadiness?.warnings ?? []).map((warning) => warning.label).slice(0, 8),
      connectors: productionReadiness?.connectors ?? null,
      customerLaunchContract: productionReadiness?.customerLaunchContract ?? null,
    },
    evidenceQuality,
    operatingTimeline,
    connectorPosture,
    runtimeControl: {
      score: runtimeControl.score,
      grade: runtimeControl.grade,
      summary: runtimeControl.summary,
      metrics: runtimeControl.metrics,
      gaps: runtimeControl.gaps.slice(0, 6),
      nextActions: runtimeControl.nextActions.slice(0, 6),
    },
    roleProfile,
    setupGuide,
    assistantQuality,
    enterpriseAiOperatingSystem: {
      score: enterpriseAiOperatingSystem.score,
      posture: enterpriseAiOperatingSystem.posture,
      headline: enterpriseAiOperatingSystem.headline,
      summary: enterpriseAiOperatingSystem.summary,
      metrics: enterpriseAiOperatingSystem.metrics,
      weakestCapabilities: [...enterpriseAiOperatingSystem.capabilities]
        .sort((left, right) => left.score - right.score)
        .slice(0, 4)
        .map((capability) => ({
          title: capability.title,
          score: capability.score,
          status: capability.status,
          value: capability.value,
          nextAction: capability.nextAction,
          targetView: capability.targetView,
        })),
      lifecycle: enterpriseAiOperatingSystem.lifecycle.map((stage) => ({
        label: stage.label,
        readiness: stage.readiness,
        evidence: stage.evidence,
        nextAction: stage.nextAction,
        targetView: stage.targetView,
      })),
      protocols: enterpriseAiOperatingSystem.protocols.map((protocol) => ({
        label: protocol.label,
        readiness: protocol.readiness,
        currentSignal: protocol.currentSignal,
        nextAction: protocol.nextAction,
        targetView: protocol.targetView,
      })),
      recommendations: enterpriseAiOperatingSystem.recommendations.map((recommendation) => ({
        priority: recommendation.priority,
        title: recommendation.title,
        body: recommendation.body,
        targetView: recommendation.targetView,
        actionLabel: recommendation.actionLabel,
      })),
    },
    primetimeLaunchGate: {
      score: primetimeLaunchGate.score,
      status: primetimeLaunchGate.status,
      summary: primetimeLaunchGate.summary,
      nextAction: {
        label: primetimeLaunchGate.nextAction.label,
        targetView: primetimeLaunchGate.nextAction.targetView,
        nextAction: primetimeLaunchGate.nextAction.nextAction,
      },
      blockers: primetimeLaunchGate.blockers.map((item) => item.label).slice(0, 6),
      warnings: primetimeLaunchGate.warnings.map((item) => item.label).slice(0, 6),
    },
    companyBlueprint: {
      score: companyBlueprint.score,
      stage: companyBlueprint.stage,
      archetype: companyBlueprint.archetype,
      summary: companyBlueprint.summary,
      firstMove: {
        title: companyBlueprint.firstMove.title,
        targetView: companyBlueprint.firstMove.targetView,
        detail: companyBlueprint.firstMove.detail,
      },
    },
    compoundLearningLoop: {
      score: compoundLearningLoop.score,
      status: compoundLearningLoop.status,
      weakestStage: compoundLearningLoop.weakestStage.name,
      summary: compoundLearningLoop.summary,
      autopilotMoves: compoundLearningLoop.autopilotMoves.map((move) => ({
        title: move.title,
        targetView: move.targetView,
        impact: move.impact,
        effort: move.effort,
        confidence: move.confidence,
      })),
    },
    transformationCommand: {
      score: transformationCommand.score,
      posture: transformationCommand.posture,
      directive: transformationCommand.directive,
      whyNow: transformationCommand.whyNow,
      operatorBrief: transformationCommand.operatorBrief,
      nextAction: {
        title: transformationCommand.nextAction.title,
        targetView: transformationCommand.nextAction.targetView,
        why: transformationCommand.nextAction.why,
        evidenceNeeded: transformationCommand.nextAction.evidenceNeeded,
        urgency: transformationCommand.nextAction.urgency,
      },
      orders: transformationCommand.orders.slice(0, 5).map((order) => ({
        title: order.title,
        targetView: order.targetView,
        urgency: order.urgency,
        confidence: order.confidence,
      })),
    },
  };
}
