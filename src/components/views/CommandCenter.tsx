"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Landmark,
  Library,
  Loader2,
  Network,
  Plus,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Badge,
  Button,
  ChartSkeleton,
  EmptyState,
  MiniMetric,
  OperatingBrief,
  Panel,
  SectionTitle,
  riskTone,
  statusTone,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { activeCommandOrders, type CommandOrderRecord } from "@/lib/command-orders";
import type { CompoundLearningLoop, CompoundLoopStage } from "@/lib/compound-learning-loop";
import {
  adoptionEnablementTracks,
  deriveEnterpriseAiControlPlane,
  workflowRedesignPlays,
} from "@/lib/enterprise-ai-control-plane";
import type { EnterpriseMaturity, EnterpriseMaturityPillar } from "@/lib/enterprise-maturity";
import { formatCurrency, type AuditLog, type EvalResult, type GovernanceReview, type Run, type Skill, type ToolRequest, type UseCase, type WorkSignal } from "@/lib/enterprise-ai-data";
import type { IntegrationBlueprint, IntegrationZone } from "@/lib/integration-blueprint";
import { deriveMarketBenchmark, type MarketBenchmarkPattern } from "@/lib/market-intelligence";
import type { TransformationCommandStage, TransformationCommandSystem } from "@/lib/transformation-command-system";
import { navItems, statusLabels } from "@/lib/ui/constants";
import { downloadTextFile, filenameFromContentDisposition, timestampedExportFilename } from "@/lib/ui/export-utils";
import { chartColors, donutGradient } from "@/lib/ui/format";
import { deriveOperatingModel } from "@/lib/ui/operating-model";
import type { View } from "@/lib/ui/types";
import type { OrganizationSettings } from "@/lib/workspace-schema";

const viewLabels = new Map<View, string>(navItems.map((item) => [item.id, item.label]));

function destinationLabel(destination: View | string) {
  return viewLabels.get(destination as View) ?? destination;
}

function actionLabel({
  action,
  context,
  helper,
  destination,
}: {
  action: string;
  context: string;
  helper?: string;
  destination: View | string;
}) {
  const segments = [action, context, helper, `Opens ${destinationLabel(destination)}`]
    .filter(Boolean)
    .map((segment) => String(segment).trim().replace(/[.!?]+$/g, ""));

  return `${segments
    .join(". ")
    .replace(/\s+/g, " ")
    .trim()}.`;
}

function enablementStageActionText(stage: { label: string; destination: View | string; complete?: boolean }) {
  if (stage.complete) return "Inspect proof";

  switch (stage.label) {
    case "Signal":
      return "Capture signal";
    case "Use case":
      return "Create use case";
    case "Skill":
      return "Create Skill";
    case "Workflow":
      return "Open workflow";
    case "Harness":
      return "Run test";
    case "Eval":
      return "Run evals";
    case "Governance":
      return "Submit review";
    case "Evidence":
      return "Create proof packet";
    case "ROI":
      return "Add value";
    default:
      return `Open ${destinationLabel(stage.destination)}`;
  }
}

export function CommandCenter({
  organization,
  metrics,
  functionData,
  statusData,
  useCases,
  skills,
  governanceReviews,
  evalResults,
  runs,
  toolRequests,
  auditLogs,
  workSignals,
  selectedUseCase,
  selectedSkill,
  report,
  workflowStatus,
  workflowNodeCount,
  enterpriseMaturity,
  integrationBlueprint,
  compoundLearningLoop,
  transformationCommand,
  commandOrders,
  onOpenCommandOrder,
  onCompleteCommandOrder,
  onOpenCommand,
  onOpenSetup,
  onOpenEstate,
  onOpenOrchestrator,
  onOpenBlueprint,
  onOpenStrategy,
  onOpenProcess,
  onOpenWork,
  onOpenSkills,
  onOpenWorkflow,
  onOpenHarness,
  onOpenConnectors,
  onOpenBroker,
  onOpenContext,
  onOpenGovernance,
  onOpenLaunch,
  onOpenEvidence,
  onOpenEvals,
  onOpenMetrics,
  onOpenTraining,
  onOpenReports,
  onOpenAdmin,
  onOpenUseCase,
  onViewBacklog,
  onNewUseCase,
  onGenerateBrief,
}: {
  organization: OrganizationSettings;
  metrics: {
    totalUseCases: number;
    activePilots: number;
    skills: number;
    adoptionRate: number;
    hoursSaved: number;
    riskItemsOpen: number;
    annualValue: number;
  };
  functionData: { name: string; value: number }[];
  statusData: { name: string; value: number }[];
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  workSignals: WorkSignal[];
  selectedUseCase: UseCase | null;
  selectedSkill: Skill | null;
  report: string;
  workflowStatus: "Saved" | "Testing" | "Published";
  workflowNodeCount: number;
  enterpriseMaturity: EnterpriseMaturity;
  integrationBlueprint: IntegrationBlueprint;
  compoundLearningLoop: CompoundLearningLoop;
  transformationCommand: TransformationCommandSystem;
  commandOrders: CommandOrderRecord[];
  onOpenCommandOrder: (orderId: string) => void;
  onCompleteCommandOrder: (orderId: string) => void;
  onOpenCommand: () => void;
  onOpenSetup: () => void;
  onOpenEstate: () => void;
  onOpenOrchestrator: () => void;
  onOpenBlueprint: () => void;
  onOpenStrategy: () => void;
  onOpenProcess: () => void;
  onOpenWork: () => void;
  onOpenSkills: () => void;
  onOpenWorkflow: () => void;
  onOpenHarness: () => void;
  onOpenConnectors: () => void;
  onOpenBroker: () => void;
  onOpenContext: () => void;
  onOpenGovernance: () => void;
  onOpenLaunch: () => void;
  onOpenEvidence: () => void;
  onOpenEvals: () => void;
  onOpenMetrics: () => void;
  onOpenTraining: () => void;
  onOpenReports: () => void;
  onOpenAdmin: () => void;
  onOpenUseCase: (id: string) => void;
  onViewBacklog: () => void;
  onNewUseCase: () => void;
  onGenerateBrief: () => void;
}) {
  const [chartsReady, setChartsReady] = useState(false);
  const [lens, setLens] = useState("Portfolio");
  const [controlPlaneExportStatus, setControlPlaneExportStatus] = useState<"idle" | "loading">("idle");
  const [controlPlaneExportNotice, setControlPlaneExportNotice] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setChartsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const valueTrend = [
    { month: "Current", value: metrics.annualValue },
  ];
  const openGovernance = governanceReviews.filter((review) =>
    ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  ).length;
  const topOpportunity = [...useCases].sort((a, b) => b.priorityScore - a.priorityScore)[0] ?? null;
  const evidenceChainCount = runs.length + evalResults.length + governanceReviews.length;
  const operatingModel = deriveOperatingModel({
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
    auditLogs,
    toolRequests,
    metrics,
    workflowNodeCount,
    workflowStatus,
    selectedUseCase,
    selectedSkill,
    workSignals,
  });
  const enterpriseControlPlane = deriveEnterpriseAiControlPlane({
    useCases,
    skills,
    runs,
    governanceReviews,
    evalResults,
    auditLogs,
    toolRequests,
    workSignals,
    metrics,
  });
  const activeInitiative = operatingModel.initiative;
  const nextOperatingProof = operatingModel.nextProof;
  const nextOperatingStage = operatingModel.nextStage;
  const activeInitiativeRiskTone =
    activeInitiative.risk === "restricted" || activeInitiative.risk === "high"
      ? "red"
      : activeInitiative.risk === "medium"
        ? "amber"
        : activeInitiative.risk === "unknown"
          ? "slate"
          : "green";
  const enablementPath = [
    {
      label: "Signal",
      value: workSignals.length ? `${workSignals.length} signals` : "No work signals",
      proof: workSignals.length ? "Governed work metadata is feeding the portfolio." : "Connect Work Intelligence or capture a manual signal.",
      complete: workSignals.length > 0 || useCases.length > 0,
      action: onOpenWork,
      destination: "Work Signals",
    },
    {
      label: "Use case",
      value: useCases.length ? `${useCases.length} scored` : "No use cases",
      proof: topOpportunity ? `${topOpportunity.title} leads at ${topOpportunity.priorityScore}/100.` : "Score the first opportunity with owner, value, and risk.",
      complete: useCases.length > 0,
      action: useCases.length ? onViewBacklog : onNewUseCase,
      destination: "Use Cases",
    },
    {
      label: "Skill",
      value: skills.length ? `${skills.length} governed` : "No Skills",
      proof: skills.length ? "Reusable AI capability exists in the library." : "Convert the top use case into a prompt, tools, context, and policy contract.",
      complete: skills.length > 0,
      action: skills.length ? onOpenSkills : onViewBacklog,
      destination: skills.length ? "AI Skills" : "Use Cases",
    },
    {
      label: "Workflow",
      value: workflowNodeCount ? `${workflowNodeCount} blocks` : "No blueprint",
      proof: workflowNodeCount ? `Workflow is ${workflowStatus.toLowerCase()}.` : "Create the execution graph before production routing.",
      complete: workflowNodeCount > 0,
      action: onOpenWorkflow,
      destination: "Workflow Builder",
    },
    {
      label: "Harness",
      value: runs.length ? `${runs.length} runs` : "No traces",
      proof: runs.length ? "Traceable execution evidence exists." : "Run a Skill through the Harness to prove runtime behavior.",
      complete: runs.length > 0,
      action: skills.length ? onOpenHarness : onOpenSkills,
      destination: skills.length ? "AI Harness" : "AI Skills",
    },
    {
      label: "Eval",
      value: evalResults.length ? `${evalResults.length} artifacts` : "No evals",
      proof: evalResults.length ? "Launch readiness has measurable checks." : "Run the eval suite before governance or launch.",
      complete: evalResults.length > 0,
      action: evalResults.length ? onOpenHarness : onOpenSkills,
      destination: evalResults.length ? "AI Harness" : "AI Skills",
    },
    {
      label: "Governance",
      value: governanceReviews.length ? `${openGovernance} open` : "No packet",
      proof: governanceReviews.length ? (openGovernance ? "Review work is active." : "Governance packet is recorded.") : "Submit the selected Skill for decision and controls.",
      complete: governanceReviews.length > 0 && openGovernance === 0,
      action: onOpenGovernance,
      destination: "Risk Review",
    },
    {
      label: "Evidence",
      value: evidenceChainCount ? `${evidenceChainCount} records` : "No chain",
      proof: evidenceChainCount ? "Runs, evals, and reviews can be audited." : "Collect trace, eval, approval, and audit proof.",
      complete: evidenceChainCount >= 3,
      action: onOpenEvidence,
      destination: "Proof Ledger",
    },
    {
      label: "ROI",
      value: metrics.annualValue ? formatCurrency(metrics.annualValue) : "No baseline",
      proof: metrics.annualValue
        ? report
          ? "Value is measured and an executive brief is ready."
          : "Value is measured; generate the executive brief for leadership."
        : "Tie usage and time saved to the value model.",
      complete: metrics.annualValue > 0,
      action: metrics.annualValue && !report ? onGenerateBrief : onOpenMetrics,
      destination: metrics.annualValue && !report ? "Reports" : "Value & ROI",
    },
  ];
  const nextEnablementStep = enablementPath.find((step) => !step.complete);
  const enablementComplete = enablementPath.filter((step) => step.complete).length;
  const enablementScore = Math.round((enablementComplete / enablementPath.length) * 100);
  const operatingStage =
    enablementScore >= 88 ? "Ready to scale" : enablementScore >= 63 ? "Pilot hardening" : enablementScore >= 38 ? "Build the controlled loop" : "First-run setup";
  const briefTitle = topOpportunity ? "Move the highest-value opportunity into governed execution" : "Stand up the AI enablement operating system";
  const briefBody = topOpportunity
    ? `${topOpportunity.title} is leading the portfolio at ${topOpportunity.priorityScore}/100. The next motion is to convert the opportunity into a governed Skill, run it through the Harness, and package evidence for review.`
    : "Start with guided setup to create the first portfolio, privacy-safe work signals, connector boundaries, and a launch plan the company can act on immediately.";
  const nextStepHeadlines: Record<string, string> = {
    Signal: "Capture the first work signal",
    "Use case": "Shape the first AI opportunity",
    Skill: topOpportunity ? `Build the AI Skill for ${topOpportunity.title}` : "Build the first AI Skill",
    Workflow: "Map the workflow before launch",
    Harness: "Run the first governed test",
    Eval: "Run the launch quality checks",
    Governance: "Clear the risk review",
    Evidence: "Package the proof for reviewers",
    ROI: "Measure value and draft the brief",
  };
  const todayTitle = nextEnablementStep
    ? nextStepHeadlines[nextEnablementStep.label] ?? `Open ${nextEnablementStep.destination}`
    : "Brief leaders and scale the pattern";
  const todayBody =
    nextEnablementStep?.proof ??
    "You have the signal, Skill, run, review, proof, and value chain needed to brief leaders and scale the pattern.";
  const primaryActionLabel = nextEnablementStep ? enablementStageActionText(nextEnablementStep) : "Open reports";
  const quickStartActions = [
    {
      label: "Ask what to do",
      helper: "The assistant can inspect this workspace and explain the next click.",
      action: onOpenOrchestrator,
      tone: "blue" as const,
      icon: Bot,
    },
    {
      label: "New Use Case",
      helper: "Capture fresh demand and score it before anyone builds.",
      action: onNewUseCase,
      tone: "amber" as const,
      icon: Plus,
    },
    {
      label: "Generate executive brief",
      helper: report ? "Refresh the leadership-ready summary with the latest proof." : "Turn the current portfolio, proof, and value story into a brief.",
      action: onGenerateBrief,
      tone: "purple" as const,
      icon: Sparkles,
    },
  ];
  const homeHealthTiles = [
    {
      label: "Opportunities",
      value: metrics.totalUseCases.toLocaleString(),
      helper: topOpportunity ? `Top: ${topOpportunity.title}` : "Add the first use case",
      tone: metrics.totalUseCases ? "blue" as const : "amber" as const,
      badge: metrics.totalUseCases ? "live" : "start",
      action: metrics.totalUseCases ? onViewBacklog : onNewUseCase,
    },
    {
      label: "AI Skills",
      value: metrics.skills.toLocaleString(),
      helper: skills[0]?.name ?? "No governed Skill yet",
      tone: metrics.skills ? "purple" as const : "amber" as const,
      badge: metrics.skills ? "built" : "needed",
      action: metrics.skills ? onOpenSkills : onViewBacklog,
    },
    {
      label: "Proof records",
      value: evidenceChainCount.toLocaleString(),
      helper: evidenceChainCount ? "Runs, evals, and reviews exist" : "Run a test and review",
      tone: evidenceChainCount ? "green" as const : "slate" as const,
      badge: evidenceChainCount ? "ready" : "pending",
      action: evidenceChainCount ? onOpenEvidence : onOpenHarness,
    },
    {
      label: "Risk items",
      value: metrics.riskItemsOpen.toLocaleString(),
      helper: metrics.riskItemsOpen ? "Needs review attention" : "No open risk items",
      tone: metrics.riskItemsOpen ? "red" as const : "green" as const,
      badge: metrics.riskItemsOpen ? "review" : "clear",
      action: onOpenGovernance,
    },
  ];
  const cockpitSignals = [
    {
      label: "Next move",
      value: nextEnablementStep?.label ?? "Scale and report",
      helper: nextEnablementStep?.proof ?? "The operating loop has enough evidence to brief leadership.",
      tone: nextEnablementStep ? "blue" as const : "green" as const,
      badge: nextEnablementStep ? "next" : "ready",
    },
    {
      label: "Open reviews",
      value: openGovernance.toString(),
      helper: openGovernance ? "active reviewer work" : "no review blockers",
      tone: openGovernance ? "amber" as const : "green" as const,
      badge: openGovernance ? "attention" : "clear",
    },
    {
      label: "Evidence chain",
      value: evidenceChainCount.toString(),
      helper: "runs, evals, approvals",
      tone: evidenceChainCount ? "purple" as const : "slate" as const,
      badge: evidenceChainCount ? "live" : "pending",
    },
    {
      label: "Value proof",
      value: metrics.annualValue ? formatCurrency(metrics.annualValue) : "Not baselined",
      helper: metrics.annualValue ? "annualized impact" : "needs ROI model",
      tone: metrics.annualValue ? "green" as const : "amber" as const,
      badge: metrics.annualValue ? "live" : "baseline",
    },
  ];
  const blockedReviews = governanceReviews.filter((review) =>
    ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  );
  const topUseCases = [...useCases].sort((a, b) => b.priorityScore - a.priorityScore);
  const productionSkills = skills.filter((skill) => ["pilot", "production"].includes(skill.status));
  const highRiskUseCases = useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel));
  const operatingLanes = [
    {
      label: "Discover",
      value: useCases.length ? `${useCases.length} opportunities` : "Empty funnel",
      helper: topUseCases[0]?.title ?? "Capture the first corporate-function pain point",
      tone: "blue" as const,
      action: useCases.length ? onViewBacklog : onNewUseCase,
    },
    {
      label: "Industrialize",
      value: skills.length ? `${skills.length} Skills` : "No Skills yet",
      helper: productionSkills.length ? `${productionSkills.length} pilot or production assets` : "Convert approved use cases into governed Skills",
      tone: "purple" as const,
      action: skills.length ? onOpenSkills : onViewBacklog,
    },
    {
      label: "Control",
      value: governanceReviews.length ? `${blockedReviews.length} blocked` : "No reviews",
      helper: blockedReviews[0]?.title ?? "Package evals, traces, and approvals for review",
      tone: blockedReviews.length ? "amber" as const : "green" as const,
      action: onOpenGovernance,
    },
    {
      label: "Scale",
      value: metrics.annualValue ? formatCurrency(metrics.annualValue) : "No value proof",
      helper: metrics.adoptionRate ? `${metrics.adoptionRate}% adoption across active Skills` : "Launch pilots with baseline value tracking",
      tone: metrics.annualValue ? "green" as const : "slate" as const,
      action: onOpenReports,
    },
  ];
  const decisionQueue = [
    {
      label: nextEnablementStep ? `${nextEnablementStep.label} stage` : "Executive brief",
      helper: nextEnablementStep ? nextEnablementStep.proof : "Brief the current launch posture to leadership",
      actionLabel: nextEnablementStep ? enablementStageActionText(nextEnablementStep) : "Report",
      action: nextEnablementStep?.action ?? onOpenReports,
      priority: nextEnablementStep ? "next" : "ready",
    },
    blockedReviews.length
      ? {
          label: "Reviewer blocker",
          helper: blockedReviews[0]?.blockers[0] ?? blockedReviews[0]?.title ?? "Review needs a decision",
          actionLabel: "Review",
          action: onOpenGovernance,
          priority: "risk",
        }
      : null,
    highRiskUseCases.length
      ? {
          label: "Risk posture",
          helper: `${highRiskUseCases.length} high-risk opportunity${highRiskUseCases.length === 1 ? "" : "s"} need control evidence`,
          actionLabel: "Triage",
          action: onViewBacklog,
          priority: "risk",
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    helper: string;
    actionLabel: string;
    action: () => void;
    priority: string;
  }[];
  const marketBenchmark = deriveMarketBenchmark({
    useCases,
    skills,
    governanceReviews,
    evalResults,
    runs,
    toolRequests,
    auditLogs,
    metrics,
    workflowNodeCount,
    workflowStatus,
  });
  const marketActionByPattern: Record<MarketBenchmarkPattern["id"], () => void> = {
    "control-tower": onOpenGovernance,
    "agent-observability": onOpenHarness,
    "governed-builder": onOpenWorkflow,
    "connector-sandbox": onOpenConnectors,
    "adoption-value": onOpenMetrics,
    "evidence-automation": onOpenEvidence,
  };
  const marketDestinationByPattern: Record<MarketBenchmarkPattern["id"], View> = {
    "control-tower": "governance",
    "agent-observability": "harness",
    "governed-builder": "workflow",
    "connector-sandbox": "connectors",
    "adoption-value": "roi",
    "evidence-automation": "evidence",
  };
  const marketStatusTone: Record<MarketBenchmarkPattern["status"], "green" | "blue" | "amber" | "red"> = {
    leading: "green",
    competitive: "blue",
    developing: "amber",
    gap: "red",
  };
  const maturityTone: Record<EnterpriseMaturityPillar["status"], "green" | "blue" | "amber" | "red"> = {
    elite: "green",
    strong: "blue",
    building: "amber",
    gap: "red",
  };
  const integrationTone: Record<IntegrationZone["status"], "green" | "amber" | "red"> = {
    ready: "green",
    partial: "amber",
    missing: "red",
  };
  const integrationActionByView: Partial<Record<View, () => void>> = {
    admin: onOpenAdmin,
    blueprint: onOpenBlueprint,
    connectors: onOpenConnectors,
    estate: onOpenEstate,
    broker: onOpenBroker,
    context: onOpenContext,
    evidence: onOpenEvidence,
    evals: onOpenEvals,
    factory: useCases.length ? onViewBacklog : onNewUseCase,
    governance: onOpenGovernance,
    launch: onOpenLaunch,
    harness: onOpenHarness,
    process: onOpenProcess,
    reports: onOpenReports,
    roi: onOpenMetrics,
    skills: onOpenSkills,
    strategy: onOpenStrategy,
    training: onOpenTraining,
    workflow: onOpenWorkflow,
    work: onOpenWork,
  };
  const compoundStageTone: Record<CompoundLoopStage["status"], "green" | "blue" | "amber" | "red"> = {
    compounding: "green",
    learning: "blue",
    forming: "amber",
    stalled: "red",
  };
  const compoundStatusTone: Record<CompoundLearningLoop["status"], "green" | "blue" | "amber" | "red"> = {
    compounding: "green",
    operating: "blue",
    forming: "amber",
    empty: "red",
  };
  const compoundActionByView: Partial<Record<View, () => void>> = {
    blueprint: onOpenBlueprint,
    command: onOpenCommand,
    factory: useCases.length ? onViewBacklog : onNewUseCase,
    estate: onOpenEstate,
    process: onOpenProcess,
    skills: onOpenSkills,
    strategy: onOpenStrategy,
    workflow: onOpenWorkflow,
    harness: onOpenHarness,
    connectors: onOpenConnectors,
    governance: onOpenGovernance,
    launch: onOpenLaunch,
    evidence: onOpenEvidence,
    roi: onOpenMetrics,
    training: onOpenTraining,
    reports: onOpenReports,
    broker: onOpenBroker,
    context: onOpenContext,
    evals: onOpenEvals,
    admin: onOpenAdmin,
    work: onOpenWork,
  };
  const transformationActionByView: Partial<Record<View, () => void>> = {
    command: onOpenCommand,
    blueprint: onOpenBlueprint,
    estate: onOpenEstate,
    strategy: onOpenStrategy,
    work: onOpenWork,
    factory: useCases.length ? onViewBacklog : onNewUseCase,
    process: onOpenProcess,
    skills: onOpenSkills,
    workflow: onOpenWorkflow,
    harness: onOpenHarness,
    connectors: onOpenConnectors,
    broker: onOpenBroker,
    context: onOpenContext,
    evals: onOpenEvals,
    governance: onOpenGovernance,
    launch: onOpenLaunch,
    evidence: onOpenEvidence,
    roi: onOpenMetrics,
    training: onOpenTraining,
    reports: onOpenReports,
    admin: onOpenAdmin,
  };
  const transformationStatusTone: Record<TransformationCommandStage["status"], "green" | "blue" | "amber" | "red"> = {
    scaling: "green",
    operating: "blue",
    forming: "amber",
    blocked: "red",
  };
  const transformationPostureTone: Record<TransformationCommandSystem["posture"], "green" | "blue" | "amber" | "red"> = {
    scaling: "green",
    "command-ready": "blue",
    forming: "amber",
    empty: "red",
  };
  const liveCommandOrders = activeCommandOrders(commandOrders).slice(0, 4);
  const commandOrderStatusTone: Record<CommandOrderRecord["status"], "green" | "blue" | "amber" | "red" | "slate"> = {
    open: "blue",
    in_progress: "amber",
    blocked: "red",
    completed: "green",
    dismissed: "slate",
  };
  const commandOrderPriorityTone: Record<CommandOrderRecord["priority"], "purple" | "red" | "amber" | "blue"> = {
    critical: "red",
    high: "purple",
    medium: "amber",
    low: "blue",
  };
  const kpiRail = [
    {
      icon: FileText,
      label: "Use Cases",
      value: metrics.totalUseCases.toLocaleString(),
      helper: "workspace data",
      tone: "blue" as const,
      action: () => setLens("Use Case Portfolio"),
    },
    {
      icon: Rocket,
      label: "Active Pilots",
      value: metrics.activePilots.toLocaleString(),
      helper: "current launch motion",
      tone: "purple" as const,
      action: () => setLens("Pilot Readiness"),
    },
    {
      icon: Library,
      label: "Skills",
      value: metrics.skills.toLocaleString(),
      helper: "governed assets",
      tone: "blue" as const,
      action: () => setLens("Reusable Skills"),
    },
    {
      icon: Activity,
      label: "Adoption",
      value: `${metrics.adoptionRate}%`,
      helper: "from usage records",
      tone: metrics.adoptionRate ? "green" as const : "slate" as const,
      action: () => setLens("Adoption"),
    },
    {
      icon: CircleDollarSign,
      label: "Hours Saved",
      value: metrics.hoursSaved.toLocaleString(),
      helper: "tracked annualized",
      tone: metrics.hoursSaved ? "green" as const : "amber" as const,
      action: () => setLens("Value Realization"),
    },
    {
      icon: AlertTriangle,
      label: "Risk Open",
      value: metrics.riskItemsOpen.toLocaleString(),
      helper: metrics.riskItemsOpen ? "needs attention" : "no high-risk open items",
      tone: metrics.riskItemsOpen ? "red" as const : "green" as const,
      action: () => setLens("Risk Posture"),
    },
  ];
  const operatingActionByView: Partial<Record<View, () => void>> = {
    command: onOpenCommand,
    blueprint: onOpenBlueprint,
    strategy: onOpenStrategy,
    process: onOpenProcess,
    work: onOpenWork,
    factory: useCases.length ? onViewBacklog : onNewUseCase,
    skills: onOpenSkills,
    workflow: onOpenWorkflow,
    harness: onOpenHarness,
    connectors: onOpenConnectors,
    broker: onOpenBroker,
    context: onOpenContext,
    evals: onOpenEvals,
    governance: onOpenGovernance,
    launch: onOpenLaunch,
    evidence: onOpenEvidence,
    roi: onOpenMetrics,
    training: onOpenTraining,
    reports: onOpenReports,
    admin: onOpenAdmin,
    estate: onOpenEstate,
    orchestrator: onOpenOrchestrator,
  };
  const openOperatingView = (view: View) => (operatingActionByView[view] ?? onOpenSetup)();

  async function downloadControlPlanePacket() {
    setControlPlaneExportStatus("loading");
    setControlPlaneExportNotice("");
    try {
      const response = await fetch("/api/enterprise-control-plane?format=markdown", {
        headers: { Accept: "text/markdown" },
      });
      if (!response.ok) {
        throw new Error(`Control plane export returned ${response.status}`);
      }
      const markdown = await response.text();
      const fallbackFilename = timestampedExportFilename(`${organization.name} enterprise ai control plane`, "md");
      const downloaded = downloadTextFile({
        contents: markdown,
        filename: filenameFromContentDisposition(response.headers.get("content-disposition"), fallbackFilename),
        mimeType: "text/markdown;charset=utf-8",
      });
      setControlPlaneExportNotice(
        downloaded
          ? "Enterprise control-plane packet downloaded"
          : "Download is unavailable in this browser session",
      );
    } catch {
      setControlPlaneExportNotice("Enterprise control-plane packet is unavailable");
    } finally {
      setControlPlaneExportStatus("idle");
    }
  }

  const enterpriseCapabilityIcon = {
    "system-of-record": Library,
    "shadow-ai": Radar,
    "operating-model": Landmark,
    permissions: Network,
    assurance: ShieldCheck,
    "incident-ops": AlertTriangle,
    adoption: Sparkles,
    "value-proof": CircleDollarSign,
  };

  return (
    <div>
      <PageHeader
        title="Home"
        subtitle={`Start here. ${organization.name} shows the next AI rollout move, what proof exists, and what needs attention.`}
      />

      <Panel className="mb-5 overflow-hidden" data-testid="home-active-initiative">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Active initiative</span>
                  <Badge tone={activeInitiativeRiskTone}>{activeInitiative.risk}</Badge>
                  <span className="text-xs font-semibold text-slate-400">{activeInitiative.department}</span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-[32px]">
                  {activeInitiative.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                  {activeInitiative.subtitle}
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-slate-200/70 bg-white/66 px-4 py-3 shadow-[var(--shadow-button)] lg:w-[220px]">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Readiness</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{activeInitiative.readinessScore}%</div>
                  </div>
                  <Badge tone={activeInitiative.readinessScore >= 80 ? "green" : activeInitiative.readinessScore >= 45 ? "amber" : "blue"}>
                    {activeInitiative.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/78">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${activeInitiative.readinessScore}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200/70 bg-white/58 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Operating chain</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    One governed path from demand signal to proof and value.
                  </p>
                </div>
                <Button onClick={() => openOperatingView(nextOperatingStage?.view ?? "factory")}>
                  <Rocket size={16} />
                  {nextOperatingStage?.actionLabel ?? "Open next step"}
                </Button>
              </div>
              <div className="relative">
                <div className="absolute left-4 right-4 top-[15px] hidden h-px bg-slate-200/82 2xl:block" aria-hidden="true" />
                <div className="relative grid gap-3 md:grid-cols-5 2xl:grid-cols-10">
                  {operatingModel.stages.map((stage, index) => (
                    <button
                      key={stage.id}
                      type="button"
                      aria-label={actionLabel({
                        action: stage.actionLabel,
                        context: `${stage.label}: ${stage.value}`,
                        helper: stage.complete ? "Complete" : stage.active ? "Current gap" : stage.evidence,
                        destination: stage.view,
                      })}
                      data-testid="home-operating-stage-action"
                      onClick={() => openOperatingView(stage.view)}
                      className="group min-w-0 text-left"
                    >
                      <span
                        className={`relative z-[1] flex size-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-slate-50 ${
                          stage.complete
                            ? "bg-green-600 text-white"
                            : stage.active
                              ? "bg-[var(--primary)] text-white"
                            : "bg-white text-slate-500 ring-white/80 shadow-[inset_0_0_0_1px_rgba(203,213,225,.9)]"
                        }`}
                      >
                        {stage.complete ? <Check size={14} /> : index + 1}
                      </span>
                      <span className="mt-3 block text-[11px] font-semibold leading-4 text-slate-950">{stage.label}</span>
                      <span className="mt-1 block line-clamp-1 text-[11px] leading-4 text-slate-500">{stage.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-lg border border-slate-200/70 bg-slate-200/70">
              {operatingModel.controlPlane.slice(0, 6).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open",
                    context: `${item.label}: ${item.value}`,
                    helper: item.helper,
                    destination: item.view,
                  })}
                  data-testid="home-control-plane-summary-action"
                  onClick={() => openOperatingView(item.view)}
                  className="bg-white/68 px-3 py-3 text-left transition-colors hover:bg-white"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                  <div className="mt-2 truncate text-sm font-semibold text-slate-950">{item.value}</div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.helper}</p>
                </button>
              ))}
            </div>
          </section>

          <aside className="ea-calm-rail border-t border-slate-200/70 p-5 xl:border-t-0 sm:p-6">
            <SectionTitle
              title="Next required proof"
              helper="The missing artifact that keeps this initiative from being launch-ready"
              compact
            />
            <div className="mt-4 rounded-lg border border-slate-200/70 bg-white/72 p-4 shadow-[var(--shadow-button)]">
              <div className="flex items-center justify-between gap-3">
                <Badge tone={nextOperatingProof?.complete ? "green" : "amber"}>{nextOperatingProof?.label ?? "Proof packet"}</Badge>
                <span className="text-2xl font-semibold tracking-tight text-slate-950">{operatingModel.proofScore}%</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {nextOperatingProof?.body ?? "The proof packet has the core use case, Skill, trace, eval, review, and value story."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => openOperatingView(nextOperatingProof?.view ?? operatingModel.nextStage?.view ?? "evidence")}>
                  <FileText size={16} />
                  {nextOperatingProof?.actionLabel ?? "Open proof"}
                </Button>
                <Button variant="secondary" onClick={onOpenOrchestrator}>
                  <Bot size={16} />
                  Ask assistant
                </Button>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200/70 bg-white/72 p-4 shadow-[var(--shadow-button)]">
              <div className="text-sm font-semibold text-slate-950">Board-ready chain</div>
              <div className="mt-3 space-y-2">
                {[
                  ["Runs", activeInitiative.runCount],
                  ["Evals", activeInitiative.evalCount],
                  ["Reviews", activeInitiative.reviewCount],
                  ["Audit events", activeInitiative.auditCount],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-950">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Panel>

      <Panel className="mb-5 overflow-hidden border-[var(--primary)]/18" data-testid="home-primary-mission">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextEnablementStep ? "blue" : "green"}>{nextEnablementStep ? "do this today" : "ready to scale"}</Badge>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                operating loop {enablementScore}%
              </span>
            </div>
            <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-[-0.01em] text-slate-950 sm:text-[30px]">
              {todayTitle}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">{todayBody}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={nextEnablementStep?.action ?? onOpenReports} data-testid="home-primary-action">
                <Rocket size={16} />
                {primaryActionLabel}
              </Button>
              <span className="inline-flex min-h-9 items-center text-xs font-medium leading-5 text-slate-500">
                One best next click. Use the shortcuts if you came here for something specific.
              </span>
            </div>

            <details className="group mt-6 rounded-lg border border-slate-200/70 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]" data-testid="home-recommendation-proof">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">Why this recommendation?</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {enablementComplete}/{enablementPath.length} stages complete · {nextEnablementStep?.label ?? "Scale and report"} is the current gap
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={nextEnablementStep ? "blue" : "green"}>{enablementScore}%</Badge>
                  <ChevronRight size={16} className="text-slate-400 transition group-open:rotate-90" />
                </span>
              </summary>
              <div className="hidden grid-cols-1 gap-px overflow-hidden border-t border-slate-200/70 bg-slate-200/70 group-open:grid sm:grid-cols-2 xl:grid-cols-4">
                {homeHealthTiles.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={`Open health signal: ${item.label}`}
                    onClick={item.action}
                    className="min-h-[104px] bg-white/72 px-4 py-3 text-left transition-colors hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">{item.label}</div>
                        <div className="mt-2 text-xl font-bold tracking-tight text-slate-950">{item.value}</div>
                      </div>
                      <Badge tone={item.tone}>{item.badge}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.helper}</p>
                  </button>
                ))}
              </div>
            </details>
          </section>

          <aside className="min-w-0 border-t border-slate-200/70 bg-slate-50/54 p-5 xl:border-l xl:border-t-0 sm:p-6" data-testid="home-common-moves">
            <SectionTitle title="Need something else?" helper="Three plain shortcuts without searching the app." compact />
            <div className="mt-4 space-y-2">
              {quickStartActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    aria-label={`Open shortcut: ${action.label}`}
                    onClick={action.action}
                    className="group flex w-full items-start gap-3 rounded-lg border border-slate-200/70 bg-white/70 p-3 text-left transition-colors hover:border-[var(--primary)]/25 hover:bg-white"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      <ActionIcon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-950">{action.label}</span>
                        <Badge tone={action.tone}>open</Badge>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{action.helper}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-slate-200/70 bg-white/70 px-4 py-3 shadow-[var(--shadow-button)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Proof status</div>
                  <div className="mt-1 text-xs text-slate-500">Runs, evals, reviews</div>
                </div>
                <div className="text-2xl font-bold text-slate-950">{evidenceChainCount}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["runs", runs.length],
                  ["evals", evalResults.length],
                  ["reviews", governanceReviews.length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md bg-slate-50 px-2 py-2">
                    <div className="text-sm font-bold text-slate-950">{value}</div>
                    <div className="text-[11px] font-medium text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Panel>

      <Panel className="mb-5 overflow-hidden" data-testid="enterprise-ai-control-tower">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={enterpriseControlPlane.score >= 82 ? "green" : enterpriseControlPlane.score >= 62 ? "blue" : "amber"}>
                    {enterpriseControlPlane.posture.replace("-", " ")}
                  </Badge>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    enterprise control tower
                  </span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950">
                  Enterprise AI Control Tower
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{enterpriseControlPlane.summary}</p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[190px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Readiness</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{enterpriseControlPlane.score}%</div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${enterpriseControlPlane.score}%` }} />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={downloadControlPlanePacket}
                  disabled={controlPlaneExportStatus === "loading"}
                >
                  {controlPlaneExportStatus === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Download packet
                </Button>
                {controlPlaneExportNotice ? (
                  <div role="status" aria-live="polite" className="text-center text-xs font-medium text-slate-500">
                    {controlPlaneExportNotice}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {enterpriseControlPlane.capabilities.map((capability) => {
                const CapabilityIcon = enterpriseCapabilityIcon[capability.id] ?? BrainCircuit;
                return (
                  <button
                    key={capability.id}
                    type="button"
                    aria-label={`Open ${capability.title}`}
                    onClick={() => openOperatingView(capability.targetView)}
                    className="group flex min-h-[170px] flex-col rounded-lg border border-slate-200 bg-white/76 p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[var(--primary)] ring-1 ring-slate-200">
                        <CapabilityIcon size={18} />
                      </span>
                      <Badge tone={capability.tone}>{capability.status}</Badge>
                    </span>
                    <span className="mt-4 text-sm font-semibold text-slate-950">{capability.title}</span>
                    <span className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{capability.value}</span>
                    <span className="mt-2 block flex-1 text-xs leading-5 text-slate-600">{capability.helper}</span>
                    <span className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                      <span>{capability.score}% ready</span>
                      <span className="inline-flex items-center gap-1 text-[var(--primary)]">
                        Open
                        <ChevronRight size={13} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="border-t border-slate-200 bg-slate-50/58 p-5 xl:border-l xl:border-t-0 sm:p-6">
            <SectionTitle title="Operating gaps" helper="Lowest-scoring capabilities to fix before broad rollout." compact />
            <div className="mt-4 space-y-3">
              {enterpriseControlPlane.priorityActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open operating gap",
                    context: action.title,
                    helper: action.nextAction,
                    destination: action.targetView,
                  })}
                  onClick={() => openOperatingView(action.targetView)}
                  className="w-full rounded-lg border border-slate-200 bg-white/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{action.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{action.nextAction}</p>
                    </div>
                    <Badge tone={action.tone}>{action.score}%</Badge>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Shadow AI" value={String(enterpriseControlPlane.metrics.shadowCandidates)} />
              <MiniMetric label="High risk" value={String(enterpriseControlPlane.metrics.highRiskAssets)} />
              <MiniMetric label="Open reviews" value={String(enterpriseControlPlane.metrics.openReviews)} />
              <MiniMetric label="Traces" value={String(enterpriseControlPlane.metrics.traceableRuns)} />
            </div>
          </aside>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200/70 xl:grid-cols-2">
          <div className="bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="Workflow redesign plays"
                helper="The product should help teams redesign work, not only add an assistant to a broken process."
                compact
              />
              <Badge tone="blue">process-first</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {workflowRedesignPlays.map((play) => (
                <button
                  key={play.step}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open workflow redesign play",
                    context: play.step,
                    helper: play.decision,
                    destination: play.targetView,
                  })}
                  onClick={() => openOperatingView(play.targetView)}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-white"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Workflow size={15} className="text-[var(--primary)]" />
                    {play.step}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{play.decision}</p>
                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{play.evidence}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="AI literacy operating model"
                helper="Different enterprise audiences need different enablement, evidence, and success measures."
                compact
              />
              <Badge tone="purple">adoption loop</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {adoptionEnablementTracks.slice(0, 4).map((track) => (
                <button
                  key={track.audience}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open adoption track",
                    context: track.audience,
                    helper: track.outcome,
                    destination: "training",
                  })}
                  onClick={() => openOperatingView("training")}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{track.audience}</div>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{track.outcome}</p>
                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{track.measure}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <details className="group mb-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-950">Full enablement path and director queue</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Open this when you want the complete signal-to-value proof chain, stage-by-stage actions, and decision queue.
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-slate-400 transition group-open:rotate-90" />
        </summary>
        <div className="mt-4 space-y-4">
          <OperatingBrief
            eyebrow={`enablement loop ${enablementScore}%`}
            title={briefTitle}
            body={briefBody}
            status={{
              label: operatingStage,
              tone: enablementScore >= 75 ? "green" : enablementScore >= 40 ? "amber" : "blue",
            }}
            progress={{ value: enablementScore, label: `${enablementComplete}/${enablementPath.length} stages` }}
            secondaryAction={{ label: "Guided setup", onClick: onOpenSetup, icon: Sparkles }}
            primaryAction={{
              label: nextEnablementStep ? enablementStageActionText(nextEnablementStep) : "Open reports",
              onClick: nextEnablementStep?.action ?? onOpenReports,
              icon: Rocket,
            }}
            signals={cockpitSignals.map((signal) => ({
              ...signal,
              onClick:
                signal.label === "Next move"
                  ? nextEnablementStep?.action
                  : signal.label === "Open reviews"
                    ? onOpenGovernance
                    : signal.label === "Evidence chain"
                      ? onOpenEvidence
                      : onOpenMetrics,
            }))}
            checklistTitle="Enablement path"
            checklistHelper="Every stage needs proof before it becomes scalable enterprise capability."
            checklist={enablementPath.map((item) => ({
              label: item.label,
              helper: `${item.value} · ${item.proof}`,
              complete: item.complete,
              active: item.label === nextEnablementStep?.label,
              actionLabel: enablementStageActionText(item),
              destinationLabel: item.destination,
              onClick: item.action,
            }))}
          />

          <Panel className="overflow-hidden">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Enablement path</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">Signal to reusable, governed, measurable capability</div>
              </div>
              <Badge tone={nextEnablementStep ? "amber" : "green"}>
                {nextEnablementStep ? `next: ${nextEnablementStep.label}` : "loop complete"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {enablementPath.map((stageItem, index) => (
                <button
                  key={stageItem.label}
                  type="button"
                  aria-label={actionLabel({
                    action: enablementStageActionText(stageItem),
                    context: `${stageItem.label}: ${stageItem.value}`,
                    helper: stageItem.proof,
                    destination: stageItem.destination,
                  })}
                  data-testid="home-enablement-stage-action"
                  onClick={stageItem.action}
                  className={`group rounded-xl border p-4 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/55 ${
                    stageItem.label === nextEnablementStep?.label
                      ? "border-[var(--primary)]/30 bg-[var(--primary-soft)]/44"
                      : "border-slate-200/70 bg-slate-50/62"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          stageItem.complete ? "bg-green-50 text-green-700" : "bg-white text-slate-400 ring-1 ring-slate-200"
                        }`}>
                          {stageItem.complete ? <Check size={13} /> : index + 1}
                        </span>
                        <span className="text-sm font-semibold text-slate-950">{stageItem.label}</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-700">{stageItem.value}</div>
                    </div>
                    <ChevronRight className="mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" size={15} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{stageItem.proof}</p>
                  <div className="mt-3 text-[11px] font-semibold text-[var(--primary)]">
                    {enablementStageActionText(stageItem)} · {stageItem.destination}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {operatingLanes.map((lane) => (
                <button
                  key={lane.label}
                  type="button"
                  aria-label={`Open operating lane: ${lane.label}`}
                  onClick={lane.action}
                  className="rounded-lg border border-slate-200/70 bg-white px-3 py-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/50"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{lane.label}</span>
                    <Badge tone={lane.tone}>{lane.value}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-slate-500">{lane.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <aside className="border-t border-slate-200/70 bg-slate-50/58 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="Director queue" helper="Decisions to move today" compact />
              <Badge tone={decisionQueue.some((decision) => decision.priority === "risk") ? "amber" : "blue"}>
                {decisionQueue.length}
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {decisionQueue.slice(0, 3).map((decision) => (
                <button
                  key={`${decision.label}-${decision.helper}`}
                  type="button"
                  aria-label={`${decision.actionLabel}: ${decision.label}`}
                  onClick={decision.action}
                  className="w-full rounded-xl border border-slate-200/70 bg-white/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{decision.label}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{decision.helper}</p>
                    </div>
                    <Badge tone={decision.priority === "risk" ? "amber" : "purple"}>{decision.actionLabel}</Badge>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["runs", runs.length],
                ["evals", evalResults.length],
                ["reviews", governanceReviews.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/60">
                  <div className="text-base font-bold text-slate-950">{value}</div>
                  <div className="text-[11px] font-medium text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </aside>
            </div>
          </Panel>
        </div>
      </details>

      <details className="group mb-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-950">Program intelligence and command orders</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Open for the transformation loop, command orders, proof debt, and board-ready operating signals.
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-slate-400 transition group-open:rotate-90" />
        </summary>

      <Panel className="mt-4 overflow-hidden border-slate-200/70 bg-white/90">
        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <div className="border-b border-slate-200 bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={transformationPostureTone[transformationCommand.posture]}>
                command system {transformationCommand.score}/100
              </Badge>
              <Bot size={20} className="text-indigo-200" />
            </div>
            <h3 className="mt-4 text-lg font-bold">{transformationCommand.directive}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{transformationCommand.operatorBrief}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Why this matters now</div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{transformationCommand.whyNow}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{transformationCommand.proofDebt}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">proof debt</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{transformationCommand.scaleReadiness}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">scale ready</div>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Transformation operating loop</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  This is the command spine: detect work, choose the right bets, industrialize Skills, run them safely,
                  prove trust, measure adoption, and turn wins into repeatable patterns.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={transformationActionByView[transformationCommand.nextAction.targetView] ?? onOpenSetup}
              >
                <Rocket size={16} />
                Open command move
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70">
              {transformationCommand.stages.map((stageItem) => (
                <button
                  key={stageItem.id}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open transformation stage",
                    context: `${stageItem.label}: ${stageItem.score}% ${stageItem.status}`,
                    helper: stageItem.nextAction,
                    destination: stageItem.targetView,
                  })}
                  data-testid="home-transformation-stage-action"
                  onClick={transformationActionByView[stageItem.targetView] ?? onOpenSetup}
                  className="group min-h-[150px] bg-white/90 p-4 text-left transition hover:bg-[var(--primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{stageItem.label}</div>
                      <span className="mt-2 inline-block">
                        <Badge tone={transformationStatusTone[stageItem.status]}>{stageItem.score}</Badge>
                      </span>
                    </div>
                    <ChevronRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${stageItem.score}%` }} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{stageItem.signal}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{stageItem.nextAction}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/55 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Today's command orders" helper="Ranked by leverage, missing proof, and operational urgency" compact />
            <div className="mt-4 space-y-3">
              {liveCommandOrders.length ? liveCommandOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg bg-white/85 p-4 ring-1 ring-slate-200/70 transition hover:bg-white hover:ring-[var(--primary)]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{order.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{order.why}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={commandOrderPriorityTone[order.priority]}>{order.priority}</Badge>
                      <Badge tone={commandOrderStatusTone[order.status]}>{order.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    Proof needed: {order.evidenceNeeded}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      due {order.dueDate} · {order.confidence}% confidence
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`Mark ${order.title} done`}
                        onClick={() => onCompleteCommandOrder(order.id)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        aria-label={`Open ${order.title}`}
                        onClick={() => onOpenCommandOrder(order.id)}
                        className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-sm leading-6 text-slate-500">
                  No active command orders. The OS will create them automatically when the operating loop detects missing evidence or blocked work.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="grid gap-3 md:grid-cols-5">
            {transformationCommand.boardProof.map((proof) => (
              <button
                key={proof.label}
                type="button"
                aria-label={actionLabel({
                  action: "Open board proof signal",
                  context: `${proof.label}: ${proof.value}`,
                  helper: proof.helper,
                  destination: proof.targetView,
                })}
                onClick={transformationActionByView[proof.targetView] ?? onOpenSetup}
                className="rounded-lg bg-slate-50/80 p-3 text-left ring-1 ring-slate-200/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{proof.label}</div>
                <div className="mt-2 text-lg font-bold text-slate-950">{proof.value}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{proof.helper}</div>
              </button>
            ))}
          </div>
        </div>
      </Panel>
      </details>

      <details className="group mt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-950">Strategic detail, benchmarks, and charts</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Open when you need maturity, market radar, integration, learning-loop, and executive signal analysis.
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-slate-400 transition group-open:rotate-90" />
        </summary>
        <div className="mt-4 space-y-4">
      <Panel className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[330px_minmax(0,1fr)_360px]">
          <div className="border-b border-slate-200 bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={compoundStatusTone[compoundLearningLoop.status]}>
                loop {compoundLearningLoop.score}/100
              </Badge>
              <BrainCircuit size={20} className="text-indigo-200" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Compounding intelligence loop</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{compoundLearningLoop.summary}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Weakest link</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{compoundLearningLoop.weakestStage.name}</div>
                <Badge tone={compoundStageTone[compoundLearningLoop.weakestStage.status]}>
                  {compoundLearningLoop.weakestStage.score}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{compoundLearningLoop.weakestStage.nextAction}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {compoundLearningLoop.moatSignals.map((signal) => (
                <div key={signal.label} className="rounded-xl bg-white/[0.06] p-3">
                  <div className="text-lg font-bold text-white">{signal.value}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {signal.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">How the OS gets smarter</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  The highest-value version of this product is a learning system: demand becomes assets, assets create
                  traces, traces create trust, trust drives adoption, and adoption produces reusable patterns.
                </p>
              </div>
              <Button variant="secondary" onClick={compoundActionByView[compoundLearningLoop.weakestStage.targetView] ?? onOpenSetup}>
                Open weakest link
              </Button>
            </div>
            <div className="mt-5 grid gap-px overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70 md:grid-cols-2">
              {compoundLearningLoop.stages.map((stage, index) => (
                <button
                  key={stage.id}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open learning loop stage",
                    context: `${stage.name}: ${stage.score}% ${stage.status}`,
                    helper: stage.nextAction,
                    destination: stage.targetView,
                  })}
                  data-testid="home-compound-stage-action"
                  onClick={compoundActionByView[stage.targetView] ?? onOpenSetup}
                  className="group bg-white/90 p-4 text-left transition hover:bg-[var(--primary-soft)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 group-hover:bg-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-950">{stage.name}</span>
                        <Badge tone={compoundStageTone[stage.status]}>{stage.score}</Badge>
                      </span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${stage.score}%` }} />
                      </span>
                      <span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-500">{stage.signal}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/55 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Autopilot next moves" helper="Ranked by leverage, effort, and missing evidence" compact />
            <div className="mt-4 space-y-3">
              {compoundLearningLoop.autopilotMoves.map((move) => (
                <button
                  key={move.id}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open autopilot move",
                    context: move.title,
                    helper: `${move.impact} impact, ${move.effort} effort, ${move.confidence}% confidence`,
                    destination: move.targetView,
                  })}
                  onClick={compoundActionByView[move.targetView] ?? onOpenSetup}
                  className="w-full rounded-lg bg-white/85 p-4 text-left ring-1 ring-slate-200/70 transition hover:bg-white hover:ring-[var(--primary)]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{move.title}</div>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{move.body}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-slate-300" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={move.impact === "high" ? "green" : move.impact === "medium" ? "blue" : "slate"}>
                      {move.impact} impact
                    </Badge>
                    <Badge tone={move.effort === "low" ? "green" : move.effort === "medium" ? "amber" : "red"}>
                      {move.effort} effort
                    </Badge>
                    <Badge tone="blue">{move.confidence}% confidence</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mb-5 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="min-w-0 xl:w-[310px]">
            <Badge tone={marketStatusTone[marketBenchmark.status]}>
              market benchmark {marketBenchmark.score}/100
            </Badge>
            <h3 className="mt-3 text-base font-bold text-slate-950">Enterprise AI platform radar</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Research-backed patterns from control towers, agent observability platforms, governed builders, and responsible AI systems.
            </p>
            <button
              type="button"
              aria-label={actionLabel({
                action: "Open highest leverage market gap",
                context: marketBenchmark.highestLeverageGap.name,
                helper: marketBenchmark.highestLeverageGap.nextAction,
                destination: marketDestinationByPattern[marketBenchmark.highestLeverageGap.id],
              })}
              onClick={marketActionByPattern[marketBenchmark.highestLeverageGap.id]}
              className="mt-4 w-full rounded-lg bg-slate-50/75 p-3 text-left ring-1 ring-slate-200/60 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Highest leverage gap</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{marketBenchmark.highestLeverageGap.name}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{marketBenchmark.highestLeverageGap.nextAction}</p>
            </button>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {marketBenchmark.patterns.map((pattern) => (
              <button
                key={pattern.id}
                type="button"
                aria-label={actionLabel({
                  action: "Open market pattern",
                  context: `${pattern.name}: ${pattern.score}%`,
                  helper: pattern.marketSignal,
                  destination: marketDestinationByPattern[pattern.id],
                })}
                onClick={marketActionByPattern[pattern.id]}
                className="group min-w-0 rounded-lg bg-white/75 p-3 text-left ring-1 ring-slate-200/60 transition hover:bg-white hover:ring-[var(--primary)]/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{pattern.name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{pattern.sourceExamples.join(" / ")}</div>
                  </div>
                  <Badge tone={marketStatusTone[pattern.status]}>{pattern.score}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pattern.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{pattern.marketSignal}</p>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-4 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <Badge tone={maturityTone[enterpriseMaturity.status]}>
              enterprise maturity {enterpriseMaturity.score}/100
            </Badge>
            <h3 className="mt-3 text-base font-bold">Highest-order operating standard</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Built-in readiness model for an enterprise AI transformation OS: strategy, factory, Skills, Harness,
              connector security, context governance, evals, evidence, adoption, and production operations.
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Highest leverage next</div>
              <div className="mt-2 text-sm font-semibold text-white">{enterpriseMaturity.highestLeveragePillar.name}</div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{enterpriseMaturity.highestLeveragePillar.nextAction}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{enterpriseMaturity.eliteCount}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">elite pillars</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{enterpriseMaturity.gapCount}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">gaps</div>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-slate-100 md:grid-cols-2 2xl:grid-cols-5">
            {enterpriseMaturity.pillars.map((pillar) => (
              <div key={pillar.id} className="bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{pillar.name}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{pillar.standard}</div>
                  </div>
                  <Badge tone={maturityTone[pillar.status]}>{pillar.score}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pillar.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{pillar.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-4 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 bg-white p-5 xl:border-b-0 xl:border-r">
            <Badge tone={integrationTone[integrationBlueprint.status]}>
              integration blueprint {integrationBlueprint.score}/100
            </Badge>
            <h3 className="mt-3 text-base font-bold text-slate-950">How this plugs into the company</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{integrationBlueprint.summary}</p>
            <button
              type="button"
              aria-label={actionLabel({
                action: "Open next connector move",
                context: integrationBlueprint.primaryNextAction.name,
                helper: integrationBlueprint.primaryNextAction.nextAction,
                destination: integrationBlueprint.primaryNextAction.targetView,
              })}
              onClick={integrationActionByView[integrationBlueprint.primaryNextAction.targetView] ?? onOpenBroker}
              className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Next connector move</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{integrationBlueprint.primaryNextAction.name}</div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                {integrationBlueprint.primaryNextAction.nextAction}
              </p>
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {integrationBlueprint.connectedCategories.length ? (
                integrationBlueprint.connectedCategories.slice(0, 6).map((category) => (
                  <Badge key={category} tone="blue">{category}</Badge>
                ))
              ) : (
                <Badge tone="amber">no connectors yet</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-px bg-slate-100 lg:grid-cols-2 2xl:grid-cols-3">
            {integrationBlueprint.zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                aria-label={actionLabel({
                  action: "Open integration zone",
                  context: `${zone.name}: ${zone.score}% ${zone.status}`,
                  helper: zone.purpose,
                  destination: zone.targetView,
                })}
                onClick={integrationActionByView[zone.targetView] ?? onOpenBroker}
                className="group bg-white p-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{zone.name}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{zone.purpose}</div>
                  </div>
                  <Badge tone={integrationTone[zone.status]}>{zone.status}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${zone.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{zone.evidence}</p>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden border-slate-200/70 bg-white/95">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <div>
            <SectionTitle title="Executive Signal Rail" helper="Click any signal to shift the portfolio lens below" compact />
          </div>
          <Badge tone="blue">{lens}</Badge>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px bg-slate-200/70">
          {kpiRail.map((item) => {
            const Icon = item.icon;
            const active = (
              item.label === "Use Cases" && lens === "Use Case Portfolio"
            ) || (
              item.label === "Active Pilots" && lens === "Pilot Readiness"
            ) || (
              item.label === "Skills" && lens === "Reusable Skills"
            ) || item.label === lens || (
              item.label === "Hours Saved" && lens === "Value Realization"
            ) || (
              item.label === "Risk Open" && lens === "Risk Posture"
            );

            return (
              <button
                key={item.label}
                type="button"
                aria-label={`Open portfolio lens: ${item.label}`}
                onClick={item.action}
                className={`group min-h-[128px] bg-white px-4 py-4 text-left transition hover:bg-[var(--primary-soft)] ${
                  active ? "shadow-[inset_0_-3px_0_var(--primary)]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex size-9 items-center justify-center rounded-full ${
                    active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-slate-50 text-slate-500"
                  }`}>
                    <Icon size={18} />
                  </span>
                  <Badge tone={item.tone}>{active ? "active" : "signal"}</Badge>
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">{item.label}</div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{item.value}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden border-slate-200/70 bg-white/95">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-950">{lens} Lens</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {lens === "Risk Posture"
                ? "Focus on high-risk Skills, governance blockers, approval queues, and policy gaps."
                : lens === "Value Realization"
                  ? "Focus on adoption-adjusted hours saved, annualized value, and top ROI candidates."
                  : lens === "Pilot Readiness"
                    ? "Focus on active pilots, launch readiness, eval pass rates, and stakeholder decisions."
                    : "Portfolio health across opportunities, Skills, adoption, governance, and measurable value."}
            </div>
          </div>
          <Button variant="secondary" onClick={onViewBacklog}>
            View Backlog
          </Button>
        </div>

        <div className="grid gap-0 xl:grid-cols-[320px_340px_minmax(0,1fr)]">
          <section className="border-b border-slate-200/70 p-5 xl:border-b-0 xl:border-r" aria-label="Use cases by function">
            <SectionTitle title="Use Cases by Function" compact />
            <div className="flex h-[230px] items-center justify-center">
              <div
                className="relative size-44 rounded-full"
                style={{ background: donutGradient(functionData) }}
                aria-label="Use cases by function"
              >
                <div className="absolute inset-12 rounded-full bg-white shadow-inner" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-semibold">
                      {functionData.reduce((sum, item) => sum + item.value, 0)}
                    </div>
                    <div className="text-xs text-slate-500">use cases</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {functionData.length ? functionData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />
                    <span className="truncate text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  No function data yet. Add or import use cases to populate this chart.
                </div>
              )}
            </div>
          </section>

          <section className="border-b border-slate-200/70 p-5 xl:border-b-0 xl:border-r" aria-label="Pilot status">
            <SectionTitle title="Pilot Status" compact />
            <div className="h-[300px]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                  <BarChart data={statusData} layout="vertical" margin={{ left: 20, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: "#64748b" }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#635bff" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </section>

          <section className="p-5" aria-label="Value delivered trend">
            <SectionTitle title="Value Delivered Trend" helper={formatCurrency(metrics.annualValue)} compact />
            <div className="h-[300px]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                  <AreaChart data={valueTrend}>
                    <defs>
                      <linearGradient id="valueFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#635bff" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#635bff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Area type="monotone" dataKey="value" stroke="#635bff" fill="url(#valueFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </section>
        </div>
      </Panel>
        </div>
      </details>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <SectionTitle title="Top Priority Use Cases" compact />
            <button
              type="button"
              className="inline-flex min-h-8 items-center rounded-lg px-2 text-sm font-semibold text-[#5147e8] transition hover:bg-[var(--primary-soft)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              onClick={onViewBacklog}
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {useCases.length ? [...useCases]
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .slice(0, 5)
              .map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={`Open priority use case: ${item.title}`}
                  onClick={() => onOpenUseCase(item.id)}
                  className="grid w-full min-w-0 grid-cols-1 items-start gap-2 px-5 py-4 text-left text-sm hover:bg-slate-50 sm:grid-cols-[minmax(0,1.6fr)_0.7fr_0.6fr_0.6fr_32px] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{item.description}</div>
                  </div>
                  <span className="min-w-0 text-slate-600">{item.department}</span>
                  <Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge>
                  <span className="font-semibold">{item.priorityScore}/100</span>
                  <ChevronRight size={16} className="hidden text-slate-400 sm:block" />
                </button>
              )) : (
                <div className="p-5">
                  <EmptyState
                    title="No AI opportunities yet"
                    body="Capture a workflow pain point or import a portfolio to begin scoring and routing opportunities."
                    action="New Use Case"
                    onAction={onNewUseCase}
                  />
                </div>
              )}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Upcoming Governance Reviews" />
          <div className="mt-4 space-y-3">
            {governanceReviews.length ? governanceReviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{review.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{review.reviewer} · due {review.dueDate}</div>
                  </div>
                  <Badge tone={riskTone(review.riskLevel)}>{review.riskLevel}</Badge>
                </div>
                <div className="mt-3 text-xs text-slate-600">{review.blockers[0] ?? "No blockers"}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                No governance reviews scheduled.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {skills.slice(0, 3).map((skill) => (
          <Panel key={skill.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{skill.name}</div>
                <div className="mt-1 text-xs text-slate-500">{skill.department} · {skill.version}</div>
              </div>
              <Badge tone={statusTone(skill.status)}>{statusLabels[skill.status]}</Badge>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <MiniMetric label="Eval" value={`${skill.evalPassRate}%`} />
              <MiniMetric label="Runs" value={skill.runs.toLocaleString()} />
              <MiniMetric label="Value" value={formatCurrency(skill.valueDelivered)} />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
