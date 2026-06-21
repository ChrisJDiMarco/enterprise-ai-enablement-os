import type { ContextSource, Run, Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";
import type { View } from "@/lib/ui/types";
import { deriveEnablementPlaybookProgram } from "./enablement-playbooks.ts";
import { deriveWorkIntelligence } from "./work-intelligence.ts";

export type OptimizationLane = "capture" | "standardize" | "train" | "agent_context" | "automate" | "prove";

export type WorkflowOptimizationRecommendation = {
  id: string;
  lane: OptimizationLane;
  title: string;
  process: string;
  department: string;
  impactScore: number;
  confidence: number;
  effort: "low" | "medium" | "high";
  evidence: string[];
  actionLabel: string;
  targetView: View;
};

export type WorkflowOptimizationModel = {
  recommendations: WorkflowOptimizationRecommendation[];
  lanes: {
    id: OptimizationLane;
    label: string;
    helper: string;
    count: number;
    targetView: View;
  }[];
  metrics: {
    workflowsObserved: number;
    documentationBacklog: number;
    trainingBacklog: number;
    agentContextCoverage: number;
    automationCandidates: number;
    roiProofGaps: number;
  };
};

export function deriveWorkflowOptimizationModel({
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
}): WorkflowOptimizationModel {
  const work = deriveWorkIntelligence({ workSignals, useCases, skills, runs, contextSources });
  const playbooks = deriveEnablementPlaybookProgram({ skills, useCases, workSignals });
  const recommendations: WorkflowOptimizationRecommendation[] = [];

  work.opportunityRadar.slice(0, 4).forEach((opportunity, index) => {
    const lane = opportunity.recommendedPattern === "Workflow Redesign"
      ? "standardize"
      : opportunity.recommendedPattern === "Training / Change"
        ? "train"
        : opportunity.recommendedPattern === "Context Remediation"
          ? "agent_context"
          : opportunity.recommendedPattern === "Agentic Workflow"
            ? "automate"
            : "capture";

    recommendations.push({
      id: `opportunity-${opportunity.key}`,
      lane,
      title: titleForLane(lane, opportunity.process),
      process: opportunity.process,
      department: opportunity.department,
      impactScore: opportunity.score,
      confidence: Math.round(opportunity.confidence * 100),
      effort: opportunity.riskLevel === "restricted" || opportunity.riskLevel === "high" ? "high" : opportunity.avgDelayHours > 24 ? "medium" : "low",
      evidence: [
        `${opportunity.volume.toLocaleString()} observed work items`,
        `${Math.round(opportunity.avgDelayHours * 10) / 10}h average delay`,
        opportunity.summaries[0] ?? "Governed work signal detected",
      ],
      actionLabel: actionForLane(lane),
      targetView: viewForLane(lane),
    });

    if (index === 0 && opportunity.score >= 70) {
      recommendations.push({
        id: `prove-${opportunity.key}`,
        lane: "prove",
        title: `Prove ROI for ${opportunity.process}`,
        process: opportunity.process,
        department: opportunity.department,
        impactScore: Math.min(100, opportunity.score - 5),
        confidence: Math.round(opportunity.confidence * 100),
        effort: "medium",
        evidence: [
          "Top workflow optimization candidate",
          "Needs baseline, launch proof, and executive packet",
          opportunity.recommendedAction,
        ],
        actionLabel: "Open Value & ROI",
        targetView: "roi",
      });
    }
  });

  playbooks.playbooks
    .filter((playbook) => playbook.source !== "seed" && (!playbook.agentReady || playbook.trainingCompletion < 50))
    .slice(0, 4)
    .forEach((playbook) => {
      const lane: OptimizationLane = playbook.contextReadiness < 65 ? "agent_context" : playbook.trainingCompletion < 50 ? "train" : "capture";
      recommendations.push({
        id: `playbook-${playbook.id}`,
        lane,
        title: lane === "agent_context" ? `Make ${playbook.title} agent-ready` : `Train teams on ${playbook.title}`,
        process: playbook.title,
        department: playbook.department,
        impactScore: Math.max(30, playbook.completion),
        confidence: Math.max(40, playbook.contextReadiness),
        effort: playbook.gaps.length > 3 ? "high" : playbook.gaps.length > 1 ? "medium" : "low",
        evidence: [
          `${playbook.completion}% playbook readiness`,
          `${playbook.trainingCompletion}% training completion`,
          playbook.gaps[0] ?? "Ready for enablement packaging",
        ],
        actionLabel: lane === "agent_context" ? "Open Assistant" : "Open Adoption Plan",
        targetView: lane === "agent_context" ? "orchestrator" : "training",
      });
    });

  contextSources
    .filter((source) => source.health !== "healthy")
    .slice(0, 3)
    .forEach((source) => {
      recommendations.push({
        id: `context-${source.id}`,
        lane: "agent_context",
        title: `Repair ${source.name} before agents rely on it`,
        process: source.name,
        department: source.ownerDepartment,
        impactScore: source.health === "stale" ? 74 : 62,
        confidence: 82,
        effort: source.classification === "restricted" || source.classification === "regulated" ? "high" : "medium",
        evidence: [
          `${source.documentCount.toLocaleString()} documents`,
          `${source.skillsUsing.toLocaleString()} Skills using source`,
          `${source.classification} classification`,
        ],
        actionLabel: "Open Knowledge Sources",
        targetView: "context",
      });
    });

  const deduped = Array.from(new Map(recommendations.map((recommendation) => [recommendation.id, recommendation])).values())
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8);
  const countByLane = (lane: OptimizationLane) => deduped.filter((recommendation) => recommendation.lane === lane).length;
  const agentReady = playbooks.playbooks.filter((playbook) => playbook.agentReady).length;

  return {
    recommendations: deduped.length ? deduped : [seedRecommendation()],
    lanes: [
      {
        id: "capture",
        label: "Capture",
        helper: "Record workflows and create SOPs",
        count: countByLane("capture"),
        targetView: "process",
      },
      {
        id: "standardize",
        label: "Standardize",
        helper: "Remove variants and handoff drag",
        count: countByLane("standardize"),
        targetView: "process",
      },
      {
        id: "train",
        label: "Train",
        helper: "Assign cohorts and checks",
        count: countByLane("train"),
        targetView: "training",
      },
      {
        id: "agent_context",
        label: "Agent context",
        helper: "Make knowledge safe for AI",
        count: countByLane("agent_context"),
        targetView: "context",
      },
      {
        id: "automate",
        label: "Automate",
        helper: "Build governed workflows",
        count: countByLane("automate"),
        targetView: "workflow",
      },
      {
        id: "prove",
        label: "Prove",
        helper: "Package ROI and evidence",
        count: countByLane("prove"),
        targetView: "roi",
      },
    ],
    metrics: {
      workflowsObserved: work.totals.processes,
      documentationBacklog: playbooks.playbooks.filter((playbook) => playbook.completion < 55).length,
      trainingBacklog: playbooks.playbooks.filter((playbook) => playbook.trainingCompletion < 50).length,
      agentContextCoverage: playbooks.playbooks.length ? Math.round((agentReady / playbooks.playbooks.length) * 100) : 0,
      automationCandidates: deduped.filter((recommendation) => recommendation.lane === "automate" || recommendation.lane === "standardize").length,
      roiProofGaps: deduped.filter((recommendation) => recommendation.lane === "prove").length,
    },
  };
}

function titleForLane(lane: OptimizationLane, process: string) {
  if (lane === "standardize") return `Standardize ${process} before automation`;
  if (lane === "train") return `Train teams on ${process}`;
  if (lane === "agent_context") return `Fix agent context for ${process}`;
  if (lane === "automate") return `Design governed automation for ${process}`;
  if (lane === "prove") return `Prove impact for ${process}`;
  return `Capture ${process} as an operating playbook`;
}

function actionForLane(lane: OptimizationLane) {
  if (lane === "standardize") return "Open Process Redesign";
  if (lane === "train") return "Open Adoption Plan";
  if (lane === "agent_context") return "Open Knowledge Sources";
  if (lane === "automate") return "Open Workflow Builder";
  if (lane === "prove") return "Open Value & ROI";
  return "Open Capture Studio";
}

function viewForLane(lane: OptimizationLane): View {
  if (lane === "standardize") return "process";
  if (lane === "train") return "training";
  if (lane === "agent_context") return "context";
  if (lane === "automate") return "workflow";
  if (lane === "prove") return "roi";
  return "process";
}

function seedRecommendation(): WorkflowOptimizationRecommendation {
  return {
    id: "seed-capture-first-workflow",
    lane: "capture",
    title: "Capture the first workflow before building AI",
    process: "First governed workflow",
    department: "Cross-Functional",
    impactScore: 20,
    confidence: 30,
    effort: "low",
    evidence: [
      "No workflow signals are connected yet",
      "Start from observed work, not a speculative chatbot",
      "Create one SOP and training packet first",
    ],
    actionLabel: "Open Capture Studio",
    targetView: "process",
  };
}
