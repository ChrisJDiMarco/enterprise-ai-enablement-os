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
  FlaskConical,
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
  CollapsibleSection,
  EmptyState,
  MiniMetric,
  OperatingBrief,
  Panel,
  Provenance,
  SectionTitle,
  riskTone,
  statusTone,
} from "@/components/ui";
import { activeCommandOrders, type CommandOrderRecord } from "@/lib/command-orders";
import { deriveCostUsage } from "@/lib/cost-usage";
import type { CompoundLearningLoop, CompoundLoopStage } from "@/lib/compound-learning-loop";
import { deriveEnterpriseAiOperatingSystem } from "@/lib/enterprise-ai-operating-system";
import {
  adoptionEnablementTracks,
  deriveEnterpriseAiControlPlane,
  workflowRedesignPlays,
} from "@/lib/enterprise-ai-control-plane";
import type { EnterpriseMaturity, EnterpriseMaturityPillar } from "@/lib/enterprise-maturity";
import { deriveOpenAiControlPlane, type OpenAiControlPlaneTone } from "@/lib/open-ai-control-plane";
import {
  formatCurrency,
  type AuditLog,
  type ContextSource,
  type EvalResult,
  type GovernanceReview,
  type Run,
  type Skill,
  type ToolRequest,
  type UseCase,
  type WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { IntegrationBlueprint, IntegrationZone } from "@/lib/integration-blueprint";
import { deriveMarketBenchmark, type MarketBenchmarkPattern } from "@/lib/market-intelligence";
import type { TransformationCommandStage, TransformationCommandSystem } from "@/lib/transformation-command-system";
import { navItems, statusLabels } from "@/lib/ui/constants";
import { downloadTextFile, filenameFromContentDisposition, timestampedExportFilename } from "@/lib/ui/export-utils";
import { chartColors, donutGradient } from "@/lib/ui/format";
import { deriveOperatingModel } from "@/lib/ui/operating-model";
import type { ProductionReadiness, View } from "@/lib/ui/types";
import type { OrganizationSettings, WorkspaceMode } from "@/lib/workspace-schema";

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
  monthlyBudgetUsd,
  toolRequests,
  auditLogs,
  workSignals,
  contextSources,
  productionReadiness,
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
  workspaceMode,
  onLoadDemo,
  onWorkspaceModeChange,
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
  monthlyBudgetUsd?: number;
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  workSignals: WorkSignal[];
  contextSources: ContextSource[];
  productionReadiness: ProductionReadiness | null;
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
  workspaceMode: WorkspaceMode;
  onLoadDemo: () => void;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
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
  const enterpriseOs = deriveEnterpriseAiOperatingSystem({
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
    auditLogs,
    toolRequests,
    workSignals,
    contextSources,
    productionReadiness,
    report,
  });
  const openAiControlPlane = deriveOpenAiControlPlane({
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
    auditLogs,
    toolRequests,
    workSignals,
    contextSources,
    report,
    connectorCount: productionReadiness?.connectors?.catalog?.connectors?.length,
    metrics,
  });
  const enterpriseOsLowestStage = [...enterpriseOs.lifecycle].sort((left, right) => left.readiness - right.readiness)[0];
  const enterpriseOsTopRecommendation = enterpriseOs.recommendations[0];
  const enterpriseOsMetricTiles = [
    { label: "Assets", value: enterpriseOs.metrics.aiAssets.toLocaleString(), helper: "registered use cases + Skills" },
    { label: "Assurance", value: `${enterpriseOs.metrics.complianceCoverage}%`, helper: "review, eval, trace, audit coverage" },
    { label: "Connectors", value: `${enterpriseOs.metrics.connectorReadiness}%`, helper: "enterprise integration readiness" },
    { label: "Value", value: formatCurrency(enterpriseOs.metrics.valueTracked), helper: "measured business impact" },
  ];
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
  const costUsage = deriveCostUsage({ runs, monthlyBudgetUsd });
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
      helper: metrics.riskItemsOpen
        ? "Needs review attention"
        : metrics.totalUseCases
          ? "No open risk items"
          : "No portfolio yet to assess",
      tone: metrics.riskItemsOpen ? "red" as const : metrics.totalUseCases ? "green" as const : "slate" as const,
      badge: metrics.riskItemsOpen ? "review" : metrics.totalUseCases ? "clear" : "none",
      action: onOpenGovernance,
    },
  ];
  const cockpitSignals = [
    {
      label: "Next move",
      value: nextEnablementStep?.label ?? "Scale and report",
      helper: nextEnablementStep?.proof ?? "The operating loop has enough evidence to brief leadership.",
      tone: nextEnablementStep ? "slate" as const : "green" as const,
      badge: nextEnablementStep ? "stage" : "ready",
    },
    {
      label: "Open reviews",
      value: openGovernance.toString(),
      helper: openGovernance
        ? "active reviewer work"
        : governanceReviews.length
          ? "no review blockers"
          : "no reviews started yet",
      tone: openGovernance ? "amber" as const : governanceReviews.length ? "green" as const : "slate" as const,
      badge: openGovernance ? "review" : governanceReviews.length ? "clear" : "n/a",
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
  const heroMissionCards = [
    {
      label: "Next command",
      value: nextEnablementStep?.label ?? "Report",
      helper: nextEnablementStep?.proof ?? "The operating loop is ready to brief and reuse.",
      badge: nextEnablementStep ? "next" : "ready",
      tone: nextEnablementStep ? "blue" as const : "green" as const,
      icon: Rocket,
      action: nextEnablementStep?.action ?? onOpenReports,
    },
    {
      label: "Why now",
      value: nextEnablementStep?.destination ?? "Leadership",
      helper: nextEnablementStep
        ? "This clears the earliest weak link in the operating loop before teams scale the work."
        : "The loop has enough signal, proof, review, and value context for leadership.",
      badge: operatingStage,
      tone: enablementScore >= 63 ? "green" as const : "amber" as const,
      icon: Landmark,
      action: nextEnablementStep?.action ?? onOpenReports,
    },
    {
      label: "Proof gap",
      value: nextOperatingProof?.label ?? "Packet",
      helper: nextOperatingProof?.body ?? "Package trace, eval, review, value, and launch evidence for reviewers.",
      badge: `${operatingModel.proofScore}% proof`,
      tone: operatingModel.proofScore >= 80 ? "green" as const : operatingModel.proofScore >= 40 ? "amber" as const : "red" as const,
      icon: FileText,
      action: () => openOperatingView(nextOperatingProof?.view ?? "evidence"),
    },
  ];
  const heroOperatingLoop = enablementPath.map((step, index) => ({
    ...step,
    index,
    shortLabel:
      step.label === "Use case"
        ? "Case"
        : step.label === "Workflow"
          ? "Flow"
          : step.label === "Governance"
            ? "Risk"
            : step.label === "Evidence"
              ? "Proof"
              : step.label === "Harness"
                ? "Run"
              : step.label,
    active: nextEnablementStep?.label === step.label,
  }));

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
  const monitorNodeToneClassName = {
    blue: "border-[color-mix(in_srgb,var(--info)_28%,var(--border))] bg-[var(--info-soft)] text-[var(--info)] shadow-[var(--shadow-button)]",
    purple: "border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--shadow-button)]",
    green: "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] text-[var(--success)] shadow-[var(--shadow-button)]",
    amber: "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)] shadow-[var(--shadow-button)]",
    red: "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)] shadow-[var(--shadow-button)]",
    slate: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
  };
  const monitorNodePanelClassName = {
    blue: "border-[color-mix(in_srgb,var(--info)_28%,var(--border))] hover:border-[color-mix(in_srgb,var(--info)_42%,var(--border))]",
    purple: "border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] hover:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))]",
    green: "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] hover:border-[color-mix(in_srgb,var(--success)_42%,var(--border))]",
    amber: "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] hover:border-[color-mix(in_srgb,var(--warning)_42%,var(--border))]",
    red: "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] hover:border-[color-mix(in_srgb,var(--danger)_42%,var(--border))]",
    slate: "border-[var(--border)] hover:border-[var(--primary)]/30",
  };
  const monitorNodeSignalClassName = {
    blue: "bg-[var(--info)]",
    purple: "bg-[var(--primary)]",
    green: "bg-[var(--success)]",
    amber: "bg-[var(--warning)]",
    red: "bg-[var(--danger)]",
    slate: "bg-[var(--border-strong)]",
  };
  const monitorNodes = [
    {
      label: "Skills",
      value: metrics.skills.toLocaleString(),
      helper: "governed agents",
      status: metrics.skills ? "governed" : "needs first Skill",
      icon: Bot,
      tone: metrics.skills ? "purple" as const : "slate" as const,
      className: "left-[5%] top-[18%]",
      action: onOpenSkills,
    },
    {
      label: "Models",
      value: enterpriseOs.metrics.traceableRuns.toLocaleString(),
      helper: "traceable runs",
      status: enterpriseOs.metrics.traceableRuns ? "instrumented" : "needs traces",
      icon: BrainCircuit,
      tone: enterpriseOs.metrics.traceableRuns ? "blue" as const : "amber" as const,
      className: "right-[6%] top-[16%]",
      action: onOpenHarness,
    },
    {
      label: "Tools",
      value: toolRequests.length.toLocaleString(),
      helper: "permissioned calls",
      status: toolRequests.length ? "brokered" : "not connected",
      icon: Network,
      tone: toolRequests.length ? "green" as const : "slate" as const,
      className: "left-[8%] bottom-[25%]",
      action: onOpenConnectors,
    },
    {
      label: "Evidence",
      value: evidenceChainCount.toLocaleString(),
      helper: "proof records",
      status: evidenceChainCount ? "audit ready" : "needs packet",
      icon: ShieldCheck,
      tone: evidenceChainCount ? "green" as const : "amber" as const,
      className: "right-[8%] bottom-[25%]",
      action: onOpenEvidence,
    },
  ];
  const monitorChipToneClassName = {
    blue: "border-[color-mix(in_srgb,var(--info)_28%,var(--border))] bg-[var(--info-soft)] text-[var(--info)]",
    purple: "border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)]",
    green: "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    amber: "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    slate: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
  };
  const monitorProviderChips = [
    {
      label: "MCP",
      value: enterpriseOs.protocols.find((item) => item.id === "mcp")?.readiness ?? 0,
      helper: "tool protocol",
      tone: "purple" as const,
    },
    {
      label: "A2A",
      value: enterpriseOs.protocols.find((item) => item.id === "a2a")?.readiness ?? 0,
      helper: "agent handoff",
      tone: "blue" as const,
    },
    {
      label: "Evals",
      value: enterpriseOs.metrics.evalCoverage,
      helper: "release gates",
      tone: enterpriseOs.metrics.evalCoverage ? "green" as const : "amber" as const,
    },
    {
      label: "ROI",
      value: metrics.annualValue ? 100 : 0,
      helper: "value proof",
      tone: metrics.annualValue ? "green" as const : "slate" as const,
    },
  ];
  const recommendationTone = {
    critical: "red" as const,
    high: "amber" as const,
    medium: "blue" as const,
  };
  const monitorAttention = [
    ...enterpriseOs.recommendations.slice(0, 3).map((item) => ({
      label: item.title,
      helper: item.body,
      badge: item.priority,
      tone: recommendationTone[item.priority],
      actionLabel: item.actionLabel,
      action: () => openOperatingView(item.targetView),
    })),
    ...decisionQueue.slice(0, 2).map((item) => ({
      label: item.label,
      helper: item.helper,
      badge: item.priority === "risk" ? item.priority : item.priority === "next" ? "stage" : item.priority,
      tone: item.priority === "risk" ? "red" as const : "slate" as const,
      actionLabel: item.actionLabel,
      action: item.action,
    })),
  ].slice(0, 4);
  const monitorMetricStrip = [
    {
      label: "Safety",
      value: `${enterpriseOs.metrics.complianceCoverage}%`,
      helper: "Proof status and control coverage",
      tone: enterpriseOs.metrics.complianceCoverage >= 75 ? "green" as const : "amber" as const,
      action: onOpenGovernance,
    },
    {
      label: "Security",
      value: `${enterpriseOs.metrics.connectorReadiness}%`,
      helper: "connector and access readiness",
      tone: enterpriseOs.metrics.connectorReadiness >= 75 ? "green" as const : "amber" as const,
      action: onOpenConnectors,
    },
    {
      label: "Productivity",
      value: `${metrics.hoursSaved.toLocaleString()} hrs`,
      helper: "annualized operating time",
      tone: metrics.hoursSaved ? "green" as const : "slate" as const,
      action: onOpenMetrics,
    },
    {
      label: "AI value",
      value: metrics.annualValue ? formatCurrency(metrics.annualValue) : "Baseline",
      helper: metrics.annualValue ? "tracked value" : "needs measurement",
      tone: metrics.annualValue ? "green" as const : "amber" as const,
      action: onOpenMetrics,
    },
  ];
  const openControlPlaneToneClassName: Record<OpenAiControlPlaneTone, string> = {
    green: "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    blue: "border-[color-mix(in_srgb,var(--info)_28%,var(--border))] bg-[var(--info-soft)] text-[var(--info)]",
    amber: "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    red: "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
    purple: "border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)]",
    slate: "border-[var(--border)] bg-[var(--surface-muted)]/88 text-[var(--text-muted)]",
  };
  const openControlPlaneProgressClassName: Record<OpenAiControlPlaneTone, string> = {
    green: "bg-[var(--success)]",
    blue: "bg-[var(--info)]",
    amber: "bg-[var(--warning)]",
    red: "bg-[var(--danger)]",
    purple: "bg-[var(--primary)]",
    slate: "bg-[var(--border-strong)]",
  };
  const workflowContextLoop = [
    {
      label: "Capture",
      value: workSignals.length ? `${workSignals.length} signals` : "Work signal",
      helper: "Record how work happens",
      icon: Radar,
      action: onOpenWork,
      tone: workSignals.length ? "blue" as const : "amber" as const,
    },
    {
      label: "Document",
      value: useCases.length ? `${useCases.length} use cases` : "SOP packet",
      helper: "Convert demand into a repeatable process",
      icon: FileText,
      action: useCases.length ? onViewBacklog : onNewUseCase,
      tone: useCases.length ? "purple" as const : "blue" as const,
    },
    {
      label: "Train",
      value: skills.length ? `${skills.length} Skills` : "Skill plan",
      helper: "Create assignments, quizzes, and agent context",
      icon: Library,
      action: skills.length ? onOpenTraining : onViewBacklog,
      tone: skills.length ? "green" as const : "slate" as const,
    },
    {
      label: "Manage",
      value: governanceReviews.length ? `${openGovernance} open` : "Controls",
      helper: "Review owners, permissions, versions, and risk",
      icon: ShieldCheck,
      action: onOpenGovernance,
      tone: openGovernance ? "amber" as const : "green" as const,
    },
    {
      label: "Prove",
      value: metrics.annualValue ? formatCurrency(metrics.annualValue) : "ROI",
      helper: "Publish evidence and executive reports",
      icon: CircleDollarSign,
      action: metrics.annualValue ? onOpenReports : onOpenMetrics,
      tone: metrics.annualValue ? "green" as const : "amber" as const,
    },
  ];

  // First-run gate: a brand-new organization has no work to monitor. Rendering
  // the full analytics wall (control monitor, charts, maturity model) against
  // all-zero data reads as "broken/empty" in the first five seconds. Show a
  // focused getting-started hero instead; the dashboards appear once data exists.
  // "First run" means no portfolio AND no proof — a seeded demo workspace that
  // already carries evals/reviews is intentionally showing the dashboards.
  const isFirstRun =
    useCases.length === 0 &&
    skills.length === 0 &&
    workSignals.length === 0 &&
    runs.length === 0 &&
    governanceReviews.length === 0 &&
    evalResults.length === 0;

  if (isFirstRun) {
    return (
      <div className="space-y-4 pb-8" data-testid="home-first-run">
        <Panel className="ea-home-start-deck overflow-hidden" data-testid="home-workflow-context-deck">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">workflow context OS</Badge>
                <Badge tone="purple">runtime-neutral</Badge>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  {organization.name}
                </span>
              </div>
              <h1 className="mt-3 max-w-4xl text-[28px] font-semibold leading-[1.08] tracking-normal text-[var(--text)] sm:text-[38px]">
                Capture how work gets done. Turn it into governed AI.
              </h1>
              <p className="mt-3 max-w-3xl text-[14px] leading-6 text-[var(--text-muted)]" data-guided-copy="true">
                Start with one real workflow signal. Enablement OS turns it into a use case, Skill plan,
                training path, controls, evidence, and ROI report.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button onClick={nextEnablementStep?.action ?? onOpenWork}>
                  <Rocket size={16} />
                  {nextEnablementStep ? enablementStageActionText(nextEnablementStep) : "Capture signal"}
                </Button>
                <Button variant="secondary" onClick={onOpenOrchestrator}>
                  <Bot size={16} />
                  Ask assistant
                </Button>
                <Button variant="ghost" onClick={onOpenSetup}>
                  <Sparkles size={16} />
                  Guided setup
                </Button>
              </div>

              <button
                type="button"
                onClick={onLoadDemo}
                data-testid="home-explore-demo"
                className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--primary)]/40 bg-[var(--primary-soft)]/45 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]/60 hover:bg-[var(--primary-soft)]/75 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                    <Sparkles size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[var(--text)]">
                      Just exploring? Load a realistic sample workspace
                    </span>
                    <span className="block text-xs leading-5 text-[var(--text-muted)]">
                      See a fully populated tenant — use cases, Skills, runs, evals, proof, and ROI. Reset to empty anytime.
                    </span>
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1 text-[12px] font-semibold text-[var(--primary)] shadow-[var(--shadow-button)] sm:flex">
                  Explore demo
                  <ChevronRight size={14} />
                </span>
              </button>

              <div className="mt-5 grid grid-cols-3 gap-2" aria-label="First-run operating metrics">
                {[
                  { label: "Loop", value: `${enablementComplete}/${enablementPath.length}`, helper: "proof stages" },
                  { label: "Adapters", value: openAiControlPlane.adapters.length.toString(), helper: "ready to map" },
                  { label: "Reports", value: "4", helper: "digest, exec, audit, board" },
                ].map((metric) => (
                  <div key={metric.label} className="min-w-0 rounded-lg border border-[var(--border)]/64 bg-[var(--surface)]/68 p-2 shadow-[var(--shadow-button)] sm:p-3">
                    <div className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[var(--text-soft)] sm:text-[10px] sm:tracking-[0.14em]">{metric.label}</div>
                    <div className="mt-1 text-lg font-semibold tracking-normal text-[var(--text)] sm:text-xl">{metric.value}</div>
                    <div className="hidden text-xs font-medium text-[var(--text-muted)] sm:block">{metric.helper}</div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="border-t border-[var(--border)]/64 bg-[var(--surface)]/38 p-4 lg:border-l lg:border-t-0 sm:p-5">
              <SectionTitle title="Capture to Proof" helper="The minimal path from process knowledge to trusted AI." compact />
              <div className="mt-3 space-y-2">
                {workflowContextLoop.map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="group flex w-full items-center gap-3 rounded-lg border border-[var(--border)]/64 bg-[var(--surface)]/72 p-2.5 text-left shadow-[var(--shadow-button)] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/25 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                        <ItemIcon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">
                            {index + 1}. {item.label}
                          </span>
                          <Badge tone={item.tone}>{item.value}</Badge>
                        </span>
                        <span className="mt-1 block truncate text-[13px] font-semibold text-[var(--text)]">{item.helper}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)]" />
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>

          <div className="border-t border-[var(--border)]/64 bg-[var(--surface-muted)]/48 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Enablement path
              </div>
              <Badge tone={enablementScore >= 40 ? "amber" : "blue"}>{enablementScore}%</Badge>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
              {enablementPath.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  aria-label={`${enablementStageActionText(item)}: ${item.label}`}
                  className={`min-h-[50px] rounded-lg border px-2 py-1.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                    item.label === nextEnablementStep?.label
                      ? "border-[var(--primary)]/35 bg-[var(--primary-soft)] text-[var(--primary)]"
                      : item.complete
                        ? "border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]"
                        : "border-[var(--border)] bg-[var(--surface)]/76 text-[var(--text-muted)] hover:border-[var(--primary)]/24 hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="block truncate text-[11px] font-bold">{item.label}</span>
                  <span className="mt-1 block truncate text-[10px] font-semibold opacity-75">{item.value}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden" data-testid="home-open-control-plane">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">open control plane</Badge>
                <Badge tone="purple">runtime-neutral</Badge>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  starts empty · connects to any stack
                </span>
              </div>
              <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)]">
                Start with a control plane, not another isolated AI tool.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                Enablement OS can sit above agent builders, observability tools, MCP connectors, governance systems, and
                reporting workflows. Add one real work signal first, then the inventory, traces, reviews, reports, and ROI
                story become connected evidence.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {openAiControlPlane.templates.slice(0, 4).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    aria-label={`${template.actionLabel}: ${template.title}`}
                    onClick={() => openOperatingView(template.targetView)}
                    className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/74 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-5 text-[var(--text)]">{template.title}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{template.summary}</span>
                      </span>
                      <Badge tone={template.tone}>{template.category.replace("-", " ")}</Badge>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/68 p-5 lg:border-l lg:border-t-0 sm:p-6">
              <SectionTitle title="Adapter Ready" helper="Connect the tools your company already uses when data exists." compact />
              <div className="mt-4 space-y-2">
                {openAiControlPlane.adapters.slice(0, 4).map((adapter) => (
                  <button
                    key={adapter.id}
                    type="button"
                    onClick={() => openOperatingView(adapter.targetView)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--text)]">{adapter.name}</span>
                        <span className="mt-1 line-clamp-1 block text-xs text-[var(--text-muted)]">{adapter.capabilities.slice(0, 2).join(" · ")}</span>
                      </span>
                      <Badge tone={adapter.tone}>{adapter.statusLabel}</Badge>
                    </span>
                  </button>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={onOpenWork}>
                <Radar size={15} />
                Capture first signal
              </Button>
            </aside>
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Fast routes" helper="Common moves without scanning the sidebar" compact />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickStartActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  aria-label={`Open shortcut: ${action.label}`}
                  onClick={action.action}
                  className="group flex w-full items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                    <ActionIcon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-[var(--text)]">{action.label}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{action.helper}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {workspaceMode === "demo" && (
        <div
          data-testid="home-demo-banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--info)_30%,var(--border))] bg-[var(--info-soft)] px-4 py-3"
        >
          <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-[var(--text)]">
            <FlaskConical size={16} className="shrink-0 text-[var(--info)]" />
            <span className="min-w-0">
              <span className="font-semibold">You&apos;re exploring sample data.</span>{" "}
              <span className="text-[var(--text-muted)]">Northwind Group is a demo tenant — nothing here is real customer data.</span>
            </span>
          </span>
          <Button variant="secondary" onClick={() => onWorkspaceModeChange("production")} data-testid="home-exit-demo">
            Switch to live workspace
          </Button>
        </div>
      )}
      <Panel id="home-command-brief" className="ea-home-hero relative overflow-hidden" data-testid="home-command-brief">
        <div className="ea-home-hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative grid gap-0 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={enablementScore >= 75 ? "green" : enablementScore >= 40 ? "amber" : "blue"}>
                {operatingStage}
              </Badge>
              <Badge tone={activeInitiativeRiskTone}>{activeInitiative.risk}</Badge>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                {organization.name} operating layer
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl text-[32px] font-semibold leading-[1.04] tracking-tight text-[var(--text)] sm:text-[38px] 2xl:text-[46px]">
              Run the company AI rollout from one command center.
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--text-muted)]">
              {todayBody}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button onClick={nextEnablementStep?.action ?? onOpenReports} data-testid="home-command-brief-primary">
                <Rocket size={16} />
                {primaryActionLabel}
              </Button>
              <Button variant="secondary" onClick={onOpenOrchestrator}>
                <Bot size={16} />
                Ask assistant
              </Button>
              <Button variant="ghost" onClick={onGenerateBrief}>
                <FileText size={16} />
                Generate report
              </Button>
            </div>
            <div className="mt-6 grid gap-2 lg:grid-cols-3" data-testid="home-mission-cockpit">
              {heroMissionCards.map((card) => {
                const CardIcon = card.icon;

                return (
                  <button
                    key={card.label}
                    type="button"
                    aria-label={`${card.label}: ${card.value}`}
                    onClick={card.action}
                    className="group flex min-h-[112px] min-w-0 flex-col justify-between rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-3 text-left shadow-[var(--shadow-button)] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/28 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                          <CardIcon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">{card.label}</span>
                          <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-[var(--text)]">{card.value}</span>
                        </span>
                      </span>
                      <Badge tone={card.tone}>{card.badge}</Badge>
                    </span>
                    <span className="mt-3 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{card.helper}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/62 p-3 shadow-[var(--shadow-button)]" data-testid="home-operating-loop-strip">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">Operating loop</div>
                <Badge tone={enablementScore >= 63 ? "green" : enablementScore >= 38 ? "amber" : "blue"}>
                  {enablementComplete}/{enablementPath.length}
                </Badge>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
                {heroOperatingLoop.map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    aria-label={`Open ${step.destination}: ${step.label}`}
                    onClick={step.action}
                    className={`group min-h-[58px] rounded-lg border px-2 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                      step.active
                        ? "border-[var(--primary)]/35 bg-[var(--primary-soft)] text-[var(--primary)]"
                        : step.complete
                          ? "border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] text-[var(--success)] hover:border-[color-mix(in_srgb,var(--success)_42%,var(--border))]"
                          : "border-[var(--border)] bg-[var(--surface)]/72 text-[var(--text-muted)] hover:border-[var(--primary)]/24 hover:bg-[var(--primary-soft)]/35 hover:text-[var(--text)]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-bold uppercase tracking-normal">{step.shortLabel}</span>
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          step.complete
                            ? "bg-[var(--success)] text-white"
                            : step.active
                              ? "bg-[var(--primary)] text-white"
                              : "bg-[var(--surface-subtle)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"
                        }`}
                      >
                        {step.complete ? <Check size={12} /> : step.index + 1}
                      </span>
                    </span>
                    <span className="mt-1.5 block truncate text-[11px] leading-4 opacity-80">
                      {step.complete ? "done" : step.active ? "next" : "open"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="border-t border-[var(--border)]/70 bg-[var(--surface)]/48 p-5 backdrop-blur 2xl:border-l 2xl:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Today&apos;s operating brief</div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The highest-signal summary before opening any detailed surface.</p>
              </div>
              <Badge tone={nextEnablementStep ? "blue" : "green"}>{enablementScore}%</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {cockpitSignals.map((signal) => (
                <button
                  key={signal.label}
                  type="button"
                  className="group min-h-[118px] rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/78 p-2.5 text-left shadow-[var(--shadow-button)] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                  onClick={
                    signal.label === "Next move"
                      ? nextEnablementStep?.action ?? onOpenReports
                      : signal.label === "Open reviews"
                        ? onOpenGovernance
                        : signal.label === "Evidence chain"
                          ? onOpenEvidence
                          : onOpenMetrics
                  }
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">{signal.label}</span>
                      <span className="mt-1 block text-base font-semibold leading-5 tracking-tight text-[var(--text)]">{signal.value}</span>
                    </span>
                    <Badge tone={signal.tone}>{signal.badge}</Badge>
                  </span>
                  <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{signal.helper}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </Panel>

      <Panel id="home-monitor" className="overflow-hidden" data-testid="home-monitor-cockpit">
        <div className="border-b border-[var(--border)]/70 bg-[var(--surface)]/58 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                {organization.name} · AI Control Monitor
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-[32px]">Control Monitor</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                A live operating map for AI assets, providers, controls, proof, and the next action that needs human attention.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={enterpriseOs.score >= 75 ? "green" : enterpriseOs.score >= 45 ? "amber" : "red"}>
                {enterpriseOs.score}% OS
              </Badge>
              <Button variant="secondary" onClick={onOpenOrchestrator}>
                <Bot size={16} />
                Ask AI
              </Button>
              <Button onClick={onOpenEstate}>
                <Network size={16} />
                Open inventory
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 bg-[var(--surface)]/36 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2" aria-label="Monitor scope">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
                  Scope
                </span>
                {["All assets", "All providers", "Last 30 days", lens].map((filter) => (
                  <span
                    key={filter}
                    className="inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 text-xs font-medium text-[var(--text-muted)]"
                  >
                    {filter}
                  </span>
                ))}
              </div>
              <Button variant="ghost" onClick={() => setLens("Enterprise Monitor")}>
                <Radar size={15} />
                Overview
              </Button>
            </div>

            <div
              className="mt-4 hidden min-h-[500px] rounded-lg border border-[var(--border)]/70 bg-[var(--surface)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_18px_60px_rgba(15,23,42,0.06)] lg:block"
              data-testid="home-monitor-graph"
            >
              <div
                className="relative h-full min-h-[474px] overflow-hidden rounded-lg border border-[var(--border)]/60 bg-[var(--surface)]"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(148, 163, 184, 0.11) 1px, transparent 1px), linear-gradient(180deg, rgba(148, 163, 184, 0.11) 1px, transparent 1px)",
                  backgroundSize: "72px 72px",
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(99,91,255,0.13),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.18),rgba(248,250,252,0.74))]" />
                <div className="absolute left-4 top-4 z-[2] flex items-center gap-2 rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/86 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] shadow-[var(--shadow-button)]">
                  <span className="size-1.5 rounded-full bg-[var(--success)] motion-safe:animate-pulse" />
                  Live topology
                </div>
                <div
                  className="absolute left-1/2 top-4 z-[4] flex -translate-x-1/2 flex-wrap justify-center gap-2"
                  style={{ width: "min(560px, calc(100% - 2rem))" }}
                >
                  {monitorProviderChips.map((chip) => {
                    const chipValue = Math.max(0, Math.min(100, chip.value));
                    return (
                      <span
                        key={chip.label}
                        className={`min-w-[112px] rounded-lg border px-3 py-2 shadow-[var(--shadow-button)] ${monitorChipToneClassName[chip.tone]}`}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold">{chip.value}%</span>
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">{chip.label}</span>
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-black/5">
                          <span className="block h-full rounded-full bg-current" style={{ width: `${chipValue}%` }} />
                        </span>
                        <span className="mt-1 block text-[11px] font-medium opacity-75">{chip.helper}</span>
                      </span>
                    );
                  })}
                </div>

                <svg
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 500"
                >
                  <defs>
                    <linearGradient id="homeMonitorLine" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="rgba(99,91,255,0.06)" />
                      <stop offset="48%" stopColor="rgba(99,91,255,0.34)" />
                      <stop offset="100%" stopColor="rgba(14,165,233,0.10)" />
                    </linearGradient>
                    <linearGradient id="homeMonitorActiveLine" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(99,91,255,0.42)" />
                      <stop offset="100%" stopColor="rgba(34,197,94,0.34)" />
                    </linearGradient>
                  </defs>
                  <path d="M94 140 C255 188 335 208 500 250 C666 292 752 318 906 362" fill="none" stroke="url(#homeMonitorLine)" strokeWidth="2" />
                  <path d="M96 360 C260 306 338 286 500 250 C668 213 754 185 910 136" fill="none" stroke="url(#homeMonitorLine)" strokeWidth="2" />
                  <path d="M148 250 H852" fill="none" stroke="rgba(100,116,139,0.22)" strokeWidth="1.5" />
                  <path d="M500 84 V416" fill="none" stroke="rgba(100,116,139,0.18)" strokeWidth="1.5" />
                  <path d="M251 162 C333 171 411 201 500 250 C593 302 674 331 752 338" fill="none" stroke="url(#homeMonitorActiveLine)" strokeDasharray="10 14" strokeLinecap="round" strokeWidth="2.5" />
                  <circle cx="500" cy="250" r="160" fill="none" stroke="rgba(99,91,255,0.10)" strokeWidth="1.5" />
                  <circle cx="500" cy="250" r="113" fill="none" stroke="rgba(99,91,255,0.16)" strokeWidth="1.5" />
                  <circle cx="500" cy="250" r="5" fill="rgba(99,91,255,0.75)" />
                  {[250, 500, 750].map((x) => (
                    <circle key={x} cx={x} cy="250" r="3" fill="rgba(99,91,255,0.35)" />
                  ))}
                </svg>

                <button
                  type="button"
                  onClick={onOpenEstate}
                  className="group absolute left-1/2 top-1/2 z-[3] flex size-52 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/28 bg-[linear-gradient(145deg,var(--primary),#4f46e5)] text-center text-[var(--primary-contrast)] shadow-[0_30px_90px_rgba(79,70,229,0.30),inset_0_1px_0_rgba(255,255,255,0.26)] transition hover:-translate-y-[51%] hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  aria-label={`Open AI Inventory. ${enterpriseOs.metrics.aiAssets} AI assets monitored.`}
                >
                  <span className="absolute -inset-5 rounded-full border border-[var(--primary)]/10" />
                  <span className="absolute -inset-10 rounded-full border border-[var(--primary)]/5" />
                  <span className="text-[56px] font-semibold leading-none">{enterpriseOs.metrics.aiAssets}</span>
                  <span className="mt-3 text-[13px] font-bold uppercase tracking-[0.26em] opacity-90">AI assets</span>
                  <span className="mt-4 rounded-full bg-white/18 px-4 py-1.5 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.20)]">
                    {enterpriseOs.score}% operating system
                  </span>
                  <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">open inventory</span>
                </button>

                {monitorNodes.map((node) => {
                  const Icon = node.icon;
                  return (
                    <button
                      key={node.label}
                      type="button"
                      className={`group absolute z-[4] w-[226px] rounded-lg border bg-[var(--surface)]/96 p-3.5 text-left shadow-[0_18px_48px_rgba(15,23,42,0.10)] ring-1 ring-[var(--border)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(15,23,42,0.14)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${node.className} ${monitorNodePanelClassName[node.tone]}`}
                      onClick={node.action}
                      aria-label={`${node.label}: ${node.value}. ${node.helper}. ${node.status}.`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-3">
                          <span className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${monitorNodeToneClassName[node.tone]}`}>
                            <Icon size={20} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[30px] font-semibold leading-none text-[var(--text)]">{node.value}</span>
                            <span className="mt-1 block text-sm font-semibold text-[var(--text-muted)]">{node.label}</span>
                          </span>
                        </span>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                      </span>
                      <span className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)]/70 pt-3">
                        <span className="truncate text-xs font-medium text-[var(--text-muted)]">{node.helper}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                          <span className={`size-1.5 rounded-full ${monitorNodeSignalClassName[node.tone]}`} />
                          {node.status}
                        </span>
                      </span>
                    </button>
                  );
                })}

              </div>
            </div>

            <div className="mt-4 grid gap-2 lg:hidden" data-testid="home-monitor-mobile-assets">
              {monitorNodes.map((node) => {
                const Icon = node.icon;
                return (
                  <button
                    key={node.label}
                    type="button"
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-3 text-left shadow-[var(--shadow-button)]"
                    onClick={node.action}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${monitorNodeToneClassName[node.tone]}`}>
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--text)]">{node.label}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">{node.helper}</span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-[var(--text)]">{node.value}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/72 p-4 sm:p-5 2xl:border-l 2xl:border-t-0" data-testid="home-monitor-attention">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Needs attention</div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Critical AI work, proof gaps, and operating blockers.</p>
              </div>
              <Badge tone={monitorAttention.some((item) => item.tone === "red") ? "red" : "amber"}>
                {monitorAttention.length}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {monitorAttention.length ? monitorAttention.map((item) => (
                <button
                  key={`${item.label}-${item.actionLabel}`}
                  type="button"
                  aria-label={`${item.actionLabel}: ${item.label}`}
                  className="group w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/86 p-3 text-left shadow-[var(--shadow-button)] transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                  onClick={item.action}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <Badge tone={item.tone}>{item.badge}</Badge>
                      <span className="mt-2 block text-sm font-semibold leading-5 text-[var(--text)]">{item.label}</span>
                      <span className="mt-1 line-clamp-3 block text-xs leading-5 text-[var(--text-muted)]">{item.helper}</span>
                    </span>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                  </span>
                  <span className="mt-3 inline-flex text-xs font-semibold text-[var(--primary)]">{item.actionLabel}</span>
                </button>
              )) : (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-4 text-sm font-semibold text-[var(--success)]">
                  No immediate blockers. Keep monitoring drift, adoption, and proof freshness.
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="grid border-t border-[var(--border)]/70 bg-[var(--surface)]/72 md:grid-cols-4" data-testid="home-monitor-metrics">
        {monitorMetricStrip.map((metric) => (
          <button
            key={metric.label}
              type="button"
              className="min-h-[104px] border-b border-[var(--border)]/70 px-4 py-4 text-left transition hover:bg-[var(--primary-soft)]/35 md:border-b-0 md:border-r last:md:border-r-0"
              onClick={metric.action}
              aria-label={`${metric.label}: ${metric.value}. ${metric.helper}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-xs font-semibold text-[var(--text-muted)]">{metric.label}</span>
                  <span className="mt-2 block text-2xl font-semibold tracking-tight text-[var(--text)]">{metric.value}</span>
                </span>
                <Badge tone={metric.tone}>{metric.tone === "green" ? "good" : metric.tone === "amber" ? "watch" : "live"}</Badge>
              </span>
              <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">{metric.helper}</span>
            </button>
          ))}
        </div>
      </Panel>

      <CollapsibleSection
        id="home-open-control-plane"
        testId="home-open-control-plane"
        title="Open control plane"
        summary="Runtime-neutral integration: Langfuse, LangSmith, Phoenix, OTel, MCP, and any agent stack."
      >
        <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={openAiControlPlane.score >= 75 ? "green" : openAiControlPlane.score >= 45 ? "amber" : "red"}>
                    {openAiControlPlane.score}% open control plane
                  </Badge>
                  <Badge tone="blue">runtime-neutral</Badge>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Langfuse · LangSmith · Phoenix · OTel · MCP · any agent stack
                  </span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-[32px]">
                  {openAiControlPlane.headline}
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--text-muted)]">
                  {openAiControlPlane.summary}
                </p>
              </div>
              <div className="grid min-w-[260px] grid-cols-2 gap-2">
                <MiniMetric label="Assets" value={String(openAiControlPlane.metrics.assets)} />
                <MiniMetric label="Adapters" value={String(openAiControlPlane.metrics.adapterCount)} />
                <MiniMetric label="Telemetry" value={`${openAiControlPlane.metrics.telemetryCoverage}%`} />
                <MiniMetric label="Packs" value={String(openAiControlPlane.metrics.templateCount)} />
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
              <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface-muted)]/52 p-4">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle title="AI Estate Graph" helper="The operating path from demand to governed runtime, evidence, and value." compact />
                  <Button variant="secondary" onClick={onOpenEstate}>
                    <Network size={15} />
                    Open estate
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {openAiControlPlane.nodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      aria-label={`Open ${node.label}: ${node.description}`}
                      onClick={() => openOperatingView(node.targetView)}
                      className={`group min-h-[136px] rounded-lg border p-3 text-left shadow-[var(--shadow-button)] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/35 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${openControlPlaneToneClassName[node.tone]}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">{node.kind}</span>
                          <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--text)]">{node.label}</span>
                        </span>
                        <span className="shrink-0 text-xl font-semibold tracking-tight text-[var(--text)]">{node.value}</span>
                      </span>
                      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/76 ring-1 ring-black/5">
                        <span className={`block h-full rounded-full ${openControlPlaneProgressClassName[node.tone]}`} style={{ width: `${Math.max(5, node.readiness)}%` }} />
                      </span>
                      <span className="mt-3 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{node.description}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {openAiControlPlane.edges.slice(0, 4).map((edge) => (
                    <div key={edge.id} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/72 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text)]">
                        <span>{edge.label}</span>
                        <span className="text-[var(--text-muted)]">{edge.strength}%</span>
                      </div>
                      <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{edge.evidence}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/76 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <SectionTitle title="Runtime Adapters" helper="Connect what teams already use without making this app depend on one runtime." compact />
                    <Badge tone="purple">{openAiControlPlane.metrics.connectedAdapters} native</Badge>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {openAiControlPlane.adapters.slice(0, 6).map((adapter) => (
                      <button
                        key={adapter.id}
                        type="button"
                        aria-label={`Open adapter ${adapter.name}: ${adapter.statusLabel}`}
                        onClick={() => openOperatingView(adapter.targetView)}
                        className="group rounded-lg border border-[var(--border)]/72 bg-[var(--surface-muted)]/62 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-5 text-[var(--text)]">{adapter.name}</span>
                            <span className="mt-1 line-clamp-1 block text-xs leading-5 text-[var(--text-muted)]">{adapter.purpose}</span>
                          </span>
                          <Badge tone={adapter.tone}>{adapter.statusLabel}</Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface-muted)]/58 p-4">
                  <SectionTitle title="Launch Packs" helper="Open-source templates the OS can install, adapt, and prove." compact />
                  <div className="mt-4 grid gap-2">
                    {openAiControlPlane.templates.slice(0, 3).map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        aria-label={`${template.actionLabel}: ${template.title}`}
                        onClick={() => openOperatingView(template.targetView)}
                        className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--text)]">{template.title}</span>
                            <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{template.summary}</span>
                          </span>
                          <Badge tone={template.tone}>{template.category.replace("-", " ")}</Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-5 2xl:border-l 2xl:border-t-0 sm:p-6">
            <SectionTitle title="What to Add Next" helper="Highest leverage gaps against modern AI platform expectations." compact />
            <div className="mt-4 space-y-2">
              {openAiControlPlane.gaps.length ? openAiControlPlane.gaps.map((gap) => (
                <button
                  key={gap.id}
                  type="button"
                  aria-label={`${gap.actionLabel}: ${gap.title}`}
                  onClick={() => openOperatingView(gap.targetView)}
                  className="group w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="text-sm font-semibold leading-5 text-[var(--text)]">{gap.title}</span>
                      <span className="mt-1 line-clamp-3 block text-xs leading-5 text-[var(--text-muted)]">{gap.body}</span>
                    </span>
                    <Badge tone={gap.tone}>{gap.severity}</Badge>
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    {gap.actionLabel}
                    <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              )) : (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-4 text-sm leading-6 text-[var(--success)]">
                  The core control-plane loop has demand, assets, traces, assurance, reporting, and value evidence. Keep tightening adapters and rollout packs.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 p-4">
              <SectionTitle title="Reporting Cadence" helper="The always-on operating rhythm competitors usually hide in analytics suites." compact />
              <div className="mt-3 space-y-2">
                {openAiControlPlane.reportCadence.slice(0, 3).map((cadence) => (
                  <button
                    key={cadence.id}
                    type="button"
                    aria-label={`Open report cadence ${cadence.title}`}
                    onClick={onOpenReports}
                    className="w-full rounded-lg bg-[var(--surface-muted)]/72 px-3 py-2 text-left transition hover:bg-[var(--primary-soft)]/45"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">{cadence.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{cadence.cadence} · {cadence.audience}</span>
                      </span>
                      <Badge tone={cadence.tone}>{cadence.readiness}%</Badge>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </CollapsibleSection>

      <Panel id="home-today" className="overflow-hidden" data-testid="home-active-initiative">
        <div className="border-b border-[var(--border)]/70 bg-[var(--surface)]/50 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                {organization.name}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-[32px]">Operating Detail</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                One operating view for the next move, the active AI initiative, the proof gap, and the surfaces that move the rollout forward.
              </p>
            </div>
            <nav aria-label="Home sections" className="flex flex-wrap gap-1.5">
              {[
                ["Today", "#home-today"],
                ["OS", "#home-enterprise-os"],
                ["Operating radar", "#home-control-tower"],
                ["Path", "#home-full-path"],
                ["Program", "#home-program-intelligence"],
                ["Analytics", "#home-strategic-detail"],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="inline-flex min-h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface)]/76 px-3 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_370px]">
          <section
            className="min-w-0 p-5 sm:p-6"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.45)" }}
            data-testid="home-primary-mission"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextEnablementStep ? "blue" : "green"}>{nextEnablementStep ? "do this today" : "ready to scale"}</Badge>
              <Badge tone={activeInitiativeRiskTone}>{activeInitiative.risk}</Badge>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                operating loop {enablementScore}% · proof {operatingModel.proofScore}%
              </span>
            </div>

            <div className="mt-4 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-[38px]">
                  {todayTitle}
                </h2>
                <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--text-muted)]">{todayBody}</p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button onClick={nextEnablementStep?.action ?? onOpenReports} data-testid="home-primary-action">
                    <Rocket size={16} />
                    {primaryActionLabel}
                  </Button>
                  <Button variant="secondary" onClick={onOpenOrchestrator}>
                    <Bot size={16} />
                    Ask assistant
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">Readiness</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight text-[var(--text)]">{activeInitiative.readinessScore}%</div>
                  </div>
                  <Badge tone={activeInitiative.readinessScore >= 80 ? "green" : activeInitiative.readinessScore >= 45 ? "amber" : "blue"}>
                    {activeInitiative.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${activeInitiative.readinessScore}%` }} />
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Active initiative</div>
                <div className="mt-1 text-sm font-semibold leading-5 text-[var(--text)]">{activeInitiative.title}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{activeInitiative.subtitle}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Operating path</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Demand signal to reusable, governed, measurable capability.</p>
                  </div>
                  <Button variant="secondary" onClick={() => openOperatingView(nextOperatingStage?.view ?? "factory")}>
                    {nextOperatingStage?.actionLabel ?? "Open next step"}
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-10">
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
                      className={`group min-h-[92px] rounded-lg border p-2.5 text-left transition ${
                        stage.active
                          ? "border-[var(--primary)]/35 bg-[var(--primary-soft)]"
                          : stage.complete
                            ? "border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)]"
                            : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            stage.complete
                              ? "bg-[var(--success)] text-white"
                              : stage.active
                                ? "bg-[var(--primary)] text-white"
                                : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                          }`}
                        >
                          {stage.complete ? <Check size={13} /> : index + 1}
                        </span>
                        <ChevronRight size={13} className="text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                      </span>
                      <span className="mt-2 block text-[11px] font-semibold leading-4 text-[var(--text)]">{stage.label}</span>
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">{stage.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)]/70 bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={nextOperatingProof?.complete ? "green" : "amber"}>{nextOperatingProof?.label ?? "Proof packet"}</Badge>
                  <span className="text-3xl font-semibold tracking-tight">{operatingModel.proofScore}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                  {nextOperatingProof?.body ?? "The proof packet has the core use case, Skill, trace, eval, review, and value story."}
                </p>
                <Button className="mt-4" onClick={() => openOperatingView(nextOperatingProof?.view ?? operatingModel.nextStage?.view ?? "evidence")}>
                  <FileText size={16} />
                  {nextOperatingProof?.actionLabel ?? "Open proof"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--border)]/70">
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
                  className="bg-[var(--surface)]/74 px-3 py-3 text-left transition-colors hover:bg-[var(--surface)]"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                  <div className="mt-2 truncate text-sm font-semibold text-[var(--text)]">{item.value}</div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">{item.helper}</p>
                </button>
              ))}
            </div>
          </section>

          <aside className="ea-calm-rail border-t border-[var(--border)]/70 p-5 xl:border-l xl:border-t-0 sm:p-6">
            <SectionTitle title="Decision queue" helper="The shortest path through today’s work" compact />
            <div className="mt-4 space-y-2">
              {decisionQueue.slice(0, 3).map((decision) => (
                <button
                  key={`${decision.label}-${decision.helper}`}
                  type="button"
                  aria-label={`${decision.actionLabel}: ${decision.label}`}
                  onClick={decision.action}
                  className="w-full rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{decision.label}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{decision.helper}</p>
                    </div>
                    <Badge tone={decision.priority === "risk" ? "amber" : "purple"}>{decision.actionLabel}</Badge>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5" data-testid="home-common-moves">
              <SectionTitle title="Fast routes" helper="Common moves without scanning the sidebar" compact />
              <div className="mt-3 grid gap-2">
                {quickStartActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      aria-label={`Open shortcut: ${action.label}`}
                      onClick={action.action}
                      className="group flex w-full items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                        <ActionIcon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="text-sm font-semibold text-[var(--text)]">{action.label}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{action.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <details className="group mt-5 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70" data-testid="home-recommendation-proof">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)]">Workspace signals</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                    {enablementComplete}/{enablementPath.length} stages complete · {evidenceChainCount} proof records
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
              </summary>
              <div className="hidden grid-cols-1 gap-px overflow-hidden border-t border-[var(--border)]/70 bg-[var(--border)]/70 group-open:grid sm:grid-cols-2">
                {homeHealthTiles.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={`Open health signal: ${item.label}`}
                    onClick={item.action}
                    className="min-h-[96px] bg-[var(--surface)]/78 px-4 py-3 text-left transition-colors hover:bg-[var(--surface)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--text-soft)]">{item.label}</div>
                        <div className="mt-2 text-xl font-bold tracking-tight text-[var(--text)]">{item.value}</div>
                      </div>
                      <Badge tone={item.tone}>{item.badge}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                  </button>
                ))}
              </div>
            </details>

            <Panel className="mt-5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <CircleDollarSign size={16} className="text-[var(--primary)]" />
                  Cost &amp; Usage
                  <span className="text-[11px] font-medium text-[var(--text-soft)]">month to date</span>
                </div>
                {costUsage.monthlyBudgetUsd > 0 ? (
                  <Badge tone={costUsage.overBudget ? "red" : costUsage.projectedOverBudget ? "amber" : "green"}>
                    {costUsage.overBudget ? "over budget" : costUsage.projectedOverBudget ? "trending over" : "on track"}
                  </Badge>
                ) : (
                  <Badge tone="slate">no budget set</Badge>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniMetric label="Spend (MTD)" value={formatCurrency(costUsage.monthToDateUsd)} />
                <MiniMetric
                  label="Budget"
                  value={costUsage.monthlyBudgetUsd > 0 ? formatCurrency(costUsage.monthlyBudgetUsd) : "Not set"}
                />
                <MiniMetric
                  label="Projected"
                  value={costUsage.monthlyBudgetUsd > 0 ? formatCurrency(costUsage.projectedMonthEndUsd) : "—"}
                />
                <MiniMetric
                  label="Runway"
                  value={costUsage.runwayDays === null ? "—" : `${costUsage.runwayDays}d`}
                />
              </div>
              {costUsage.monthlyBudgetUsd > 0 ? (
                <div className="mt-3 h-2 rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]/70">
                  <div
                    className={`h-full rounded-full ${costUsage.overBudget ? "bg-red-500" : costUsage.projectedOverBudget ? "bg-amber-500" : "bg-[var(--primary)]"}`}
                    style={{ width: `${Math.min(100, costUsage.percentUsed)}%` }}
                  />
                </div>
              ) : null}
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                {costUsage.monthlyBudgetUsd > 0
                  ? `${costUsage.percentUsed}% of budget used across ${costUsage.monthRunCount} run${costUsage.monthRunCount === 1 ? "" : "s"} this month (${costUsage.liveRunCount} live).`
                  : `${formatCurrency(costUsage.monthToDateUsd)} across ${costUsage.monthRunCount} run${costUsage.monthRunCount === 1 ? "" : "s"} this month. Set a monthly budget in AI Settings to track runway and overage.`}
              </p>
            </Panel>

            <div className="mt-5 grid grid-cols-4 gap-2 text-center">
              {[
                ["runs", runs.length],
                ["evals", evalResults.length],
                ["reviews", governanceReviews.length],
                ["audit", activeInitiative.auditCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-md bg-[var(--surface)]/70 px-2 py-2 ring-1 ring-[var(--border)]/60">
                  <div className="text-sm font-bold text-[var(--text)]">{value}</div>
                  <div className="text-[11px] font-medium text-[var(--text-soft)]">{label}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </Panel>

      <CollapsibleSection
        id="home-enterprise-os"
        className="mb-5 scroll-mt-5"
        testId="home-enterprise-operating-system"
        title="Enterprise OS"
        summary="Lifecycle stages, maturity score, and future-proofing recommendations."
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={enterpriseOs.score >= 82 ? "green" : enterpriseOs.score >= 62 ? "blue" : enterpriseOs.score >= 38 ? "amber" : "red"}>
                    {enterpriseOs.score}% {enterpriseOs.posture.replace("-", " ")}
                  </Badge>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    enterprise AI operating system
                  </span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-[var(--text)]">
                  {enterpriseOs.headline}
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">{enterpriseOs.summary}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenEstate}>
                  <Library size={15} />
                  Open OS view
                </Button>
                <Button variant="secondary" onClick={onOpenReports}>
                  <FileText size={15} />
                  Prepare report
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {enterpriseOsMetricTiles.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  aria-label={`Open enterprise OS metric: ${tile.label}`}
                  onClick={
                    tile.label === "Connectors"
                      ? onOpenConnectors
                      : tile.label === "Assurance"
                        ? onOpenGovernance
                        : tile.label === "Value"
                          ? onOpenMetrics
                          : onOpenEstate
                  }
                  className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/76 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/45"
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">{tile.label}</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">{tile.value}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{tile.helper}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72">
              <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-6">
                {enterpriseOs.lifecycle.map((stageItem) => (
                  <button
                    key={stageItem.id}
                    type="button"
                    aria-label={actionLabel({
                      action: stageItem.nextAction,
                      context: `${stageItem.label}: ${stageItem.readiness}% ready`,
                      helper: stageItem.evidence,
                      destination: stageItem.targetView,
                    })}
                    onClick={() => openOperatingView(stageItem.targetView)}
                    className={`group min-h-[112px] bg-[var(--surface)] p-3 text-left transition hover:bg-[var(--primary-soft)]/45 ${
                      stageItem.id === enterpriseOsLowestStage?.id ? "ring-2 ring-inset ring-[var(--primary)]/25" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-soft)]">{stageItem.label}</span>
                      <Badge tone={stageItem.tone}>{stageItem.readiness}%</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{stageItem.evidence}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                      Open
                      <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="border-t border-[var(--border)] bg-[var(--surface-muted)]/58 p-5 xl:border-l xl:border-t-0 sm:p-6">
            <SectionTitle title="Future-proofing" helper="Protocol, reporting, and governance moves from the latest market scan." compact />
            <div className="mt-4 space-y-3">
              {enterpriseOs.recommendations.slice(0, 3).map((recommendation) => (
                <button
                  key={recommendation.id}
                  type="button"
                  aria-label={actionLabel({
                    action: recommendation.actionLabel,
                    context: recommendation.title,
                    helper: recommendation.body,
                    destination: recommendation.targetView,
                  })}
                  onClick={() => openOperatingView(recommendation.targetView)}
                  className="group w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{recommendation.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{recommendation.body}</p>
                    </div>
                    <Badge tone={recommendation.priority === "critical" ? "red" : recommendation.priority === "high" ? "amber" : "blue"}>
                      {recommendation.priority}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    {recommendation.actionLabel}
                    <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
              {!enterpriseOs.recommendations.length ? (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-3 text-sm leading-6 text-[var(--success)]">
                  The enterprise OS has no urgent gaps. Keep operating from reports, evals, adoption, and proof loops.
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text)]">Protocol readiness</div>
                <Badge tone={enterpriseOs.protocols[0]?.tone ?? "slate"}>{enterpriseOs.protocols[0]?.readiness ?? 0}%</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {enterpriseOs.protocols.slice(0, 3).map((protocol) => (
                  <button
                    key={protocol.id}
                    type="button"
                    aria-label={`Open protocol readiness: ${protocol.label}`}
                    onClick={() => openOperatingView(protocol.targetView)}
                    className="w-full rounded-md bg-[var(--surface-muted)] px-3 py-2 text-left transition hover:bg-[var(--primary-soft)]/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[var(--text)]">{protocol.label}</span>
                      <span className="text-xs font-bold text-[var(--text-muted)]">{protocol.readiness}%</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-muted)]">{protocol.nextAction}</p>
                  </button>
                ))}
              </div>
            </div>

            {enterpriseOsTopRecommendation ? (
              <Button className="mt-4 w-full" onClick={() => openOperatingView(enterpriseOsTopRecommendation.targetView)}>
                <Sparkles size={15} />
                {enterpriseOsTopRecommendation.actionLabel}
              </Button>
            ) : null}
          </aside>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="home-control-tower"
        className="mb-5 scroll-mt-5"
        testId="enterprise-ai-control-tower"
        title="Operating radar"
        summary="Control capabilities, workflow redesign plays, and the AI adoption model."
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={enterpriseControlPlane.score >= 82 ? "green" : enterpriseControlPlane.score >= 62 ? "blue" : "amber"}>
                    {enterpriseControlPlane.posture.replace("-", " ")}
                  </Badge>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    enterprise operating radar
                  </span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-[var(--text)]">
                  Enterprise AI Operating Radar
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{enterpriseControlPlane.summary}</p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[190px]">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-right">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">Readiness</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-[var(--text)]">{enterpriseControlPlane.score}%</div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]">
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
                  <div role="status" aria-live="polite" className="text-center text-xs font-medium text-[var(--text-muted)]">
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
                    className="group flex min-h-[170px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                        <CapabilityIcon size={18} />
                      </span>
                      <Badge tone={capability.tone}>{capability.status}</Badge>
                    </span>
                    <span className="mt-4 text-sm font-semibold text-[var(--text)]">{capability.title}</span>
                    <span className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">{capability.value}</span>
                    <span className="mt-2 block flex-1 text-xs leading-5 text-[var(--text-muted)]">{capability.helper}</span>
                    <span className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text-muted)]">
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

          <aside className="border-t border-[var(--border)] bg-[var(--surface-muted)]/58 p-5 xl:border-l xl:border-t-0 sm:p-6">
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
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{action.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{action.nextAction}</p>
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

        <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)]/70 xl:grid-cols-2">
          <div className="bg-[var(--surface)] p-5">
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
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Workflow size={15} className="text-[var(--primary)]" />
                    {play.step}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{play.decision}</p>
                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-soft)]">{play.evidence}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] p-5">
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
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">{track.audience}</div>
                    <ChevronRight size={14} className="text-[var(--text-soft)]" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{track.outcome}</p>
                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-soft)]">{track.measure}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <details id="home-full-path" className="group mb-5 scroll-mt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)]">Full enablement path and director queue</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
              Open this when you want the complete signal-to-value proof chain, stage-by-stage actions, and decision queue.
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
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
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Enablement path</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">Signal to reusable, governed, measurable capability</div>
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
                      : "border-[var(--border)]/70 bg-[var(--surface-muted)]/62"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          stageItem.complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"
                        }`}>
                          {stageItem.complete ? <Check size={13} /> : index + 1}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text)]">{stageItem.label}</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-[var(--text-muted)]">{stageItem.value}</div>
                    </div>
                    <ChevronRight className="mt-1 text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" size={15} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{stageItem.proof}</p>
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
                  className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/50"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">{lane.label}</span>
                    <Badge tone={lane.tone}>{lane.value}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-[var(--text-muted)]">{lane.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <aside className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/58 p-5 xl:border-l xl:border-t-0">
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
                  className="w-full rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{decision.label}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{decision.helper}</p>
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
                <div key={String(label)} className="rounded-xl bg-[var(--surface)] px-3 py-2 ring-1 ring-[var(--border)]/60">
                  <div className="text-base font-bold text-[var(--text)]">{value}</div>
                  <div className="text-[11px] font-medium text-[var(--text-soft)]">{label}</div>
                </div>
              ))}
            </div>
          </aside>
            </div>
          </Panel>
        </div>
      </details>

      <details id="home-program-intelligence" className="group mb-5 scroll-mt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)]">Program intelligence and command orders</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
              Open for the transformation loop, command orders, proof debt, and board-ready operating signals.
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>

      <Panel className="mt-4 overflow-hidden border-[var(--border)]/70 bg-[var(--surface)]/90">
        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <div className="border-b border-[var(--border)] bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={transformationPostureTone[transformationCommand.posture]}>
                command system {transformationCommand.score}/100
              </Badge>
              <Bot size={20} className="text-indigo-200" />
            </div>
            <h3 className="mt-4 text-lg font-bold">{transformationCommand.directive}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{transformationCommand.operatorBrief}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-[var(--surface)]/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Why this matters now</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{transformationCommand.whyNow}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold">{transformationCommand.proofDebt}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">proof debt</div>
              </div>
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold">{transformationCommand.scaleReadiness}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">scale ready</div>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Transformation operating loop</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
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
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden rounded-lg bg-[var(--surface-subtle)] ring-1 ring-[var(--border)]/70">
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
                  className="group min-h-[150px] bg-[var(--surface)]/90 p-4 text-left transition hover:bg-[var(--primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{stageItem.label}</div>
                      <span className="mt-2 inline-block">
                        <Badge tone={transformationStatusTone[stageItem.status]}>{stageItem.score}</Badge>
                      </span>
                    </div>
                    <ChevronRight size={15} className="text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${stageItem.score}%` }} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{stageItem.signal}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-soft)]">{stageItem.nextAction}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/55 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Today's command orders" helper="Ranked by leverage, missing proof, and operational urgency" compact />
            <div className="mt-4 space-y-3">
              {liveCommandOrders.length ? liveCommandOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg bg-[var(--surface)]/85 p-4 ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--surface)] hover:ring-[var(--primary)]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{order.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{order.why}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={commandOrderPriorityTone[order.priority]}>{order.priority}</Badge>
                      <Badge tone={commandOrderStatusTone[order.status]}>{order.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                    Proof needed: {order.evidenceNeeded}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                      due {order.dueDate} · rule-based priority {order.confidence}/100
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`Mark ${order.title} done`}
                        onClick={() => onCompleteCommandOrder(order.id)}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[color-mix(in_srgb,var(--success)_36%,var(--border))] hover:bg-[var(--success-soft)] hover:text-[var(--success)]"
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
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/70 p-4 text-sm leading-6 text-[var(--text-muted)]">
                  No active command orders. The OS will create them automatically when the operating loop detects missing evidence or blocked work.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
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
                className="rounded-lg bg-[var(--surface-muted)]/80 p-3 text-left ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{proof.label}</div>
                <div className="mt-2 text-lg font-bold text-[var(--text)]">{proof.value}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{proof.helper}</div>
              </button>
            ))}
          </div>
        </div>
      </Panel>
      </details>

      <details id="home-strategic-detail" className="group mt-5 scroll-mt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)]">Strategic detail, benchmarks, and charts</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
              Open when you need maturity, market radar, integration, learning-loop, and executive signal analysis.
            </span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>
        <div className="mt-4 space-y-4">
      <Panel className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[330px_minmax(0,1fr)_360px]">
          <div className="border-b border-[var(--border)] bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={compoundStatusTone[compoundLearningLoop.status]}>
                loop {compoundLearningLoop.score}/100
              </Badge>
              <BrainCircuit size={20} className="text-indigo-200" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Compounding intelligence loop</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{compoundLearningLoop.summary}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-[var(--surface)]/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Weakest link</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{compoundLearningLoop.weakestStage.name}</div>
                <Badge tone={compoundStageTone[compoundLearningLoop.weakestStage.status]}>
                  {compoundLearningLoop.weakestStage.score}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{compoundLearningLoop.weakestStage.nextAction}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {compoundLearningLoop.moatSignals.map((signal) => (
                <div key={signal.label} className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                  <div className="text-lg font-bold text-white">{signal.value}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                    {signal.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">How the OS gets smarter</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                  The highest-value version of this product is a learning system: demand becomes assets, assets create
                  traces, traces create trust, trust drives adoption, and adoption produces reusable patterns.
                </p>
              </div>
              <Button variant="secondary" onClick={compoundActionByView[compoundLearningLoop.weakestStage.targetView] ?? onOpenSetup}>
                Open weakest link
              </Button>
            </div>
            <div className="mt-5 grid gap-px overflow-hidden rounded-lg bg-[var(--surface-subtle)] ring-1 ring-[var(--border)]/70 md:grid-cols-2">
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
                  className="group bg-[var(--surface)]/90 p-4 text-left transition hover:bg-[var(--primary-soft)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-xs font-bold text-[var(--text-muted)] group-hover:bg-[var(--surface)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-[var(--text)]">{stage.name}</span>
                        <Badge tone={compoundStageTone[stage.status]}>{stage.score}</Badge>
                      </span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                        <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${stage.score}%` }} />
                      </span>
                      <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{stage.signal}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/55 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Autopilot next moves" helper="Ranked by leverage, effort, and missing evidence" compact />
            <div className="mt-4 space-y-3">
              {compoundLearningLoop.autopilotMoves.map((move) => (
                <button
                  key={move.id}
                  type="button"
                  aria-label={actionLabel({
                    action: "Open autopilot move",
                    context: move.title,
                    helper: `${move.impact} impact, ${move.effort} effort, rule-based priority ${move.confidence}/100`,
                    destination: move.targetView,
                  })}
                  onClick={compoundActionByView[move.targetView] ?? onOpenSetup}
                  className="w-full rounded-lg bg-[var(--surface)]/85 p-4 text-left ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--surface)] hover:ring-[var(--primary)]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{move.title}</div>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{move.body}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)]" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={move.impact === "high" ? "green" : move.impact === "medium" ? "blue" : "slate"}>
                      {move.impact} impact
                    </Badge>
                    <Badge tone={move.effort === "low" ? "green" : move.effort === "medium" ? "amber" : "red"}>
                      {move.effort} effort
                    </Badge>
                    <Badge tone="blue">priority {move.confidence}/100</Badge>
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
              platform coverage {marketBenchmark.score}/100
            </Badge>
            <h3 className="mt-3 text-base font-bold text-[var(--text)]">Enterprise AI platform radar</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Your coverage against a fixed reference set of enterprise-AI capability patterns (control towers, agent observability, governed builders, responsible AI). A self-assessment of what this workspace has in place — not a live external market benchmark.
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
              className="mt-4 w-full rounded-lg bg-[var(--surface-muted)]/75 p-3 text-left ring-1 ring-[var(--border)]/60 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Highest leverage gap</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">{marketBenchmark.highestLeverageGap.name}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{marketBenchmark.highestLeverageGap.nextAction}</p>
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
                className="group min-w-0 rounded-lg bg-[var(--surface)]/75 p-3 text-left ring-1 ring-[var(--border)]/60 transition hover:bg-[var(--surface)] hover:ring-[var(--primary)]/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{pattern.name}</div>
                    <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{pattern.sourceExamples.join(" / ")}</div>
                  </div>
                  <Badge tone={marketStatusTone[pattern.status]}>{pattern.score}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pattern.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{pattern.marketSignal}</p>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-4 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={maturityTone[enterpriseMaturity.status]}>
                enterprise maturity {enterpriseMaturity.score}/100
              </Badge>
              <Provenance
                kind="self-assessed"
                title="A readiness rating computed from this workspace's own configuration and activity — not an external benchmark or audit."
              />
            </div>
            <h3 className="mt-3 text-base font-bold">Highest-order operating standard</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              Built-in readiness model for an enterprise AI transformation OS: strategy, factory, Skills, Harness,
              connector security, context governance, evals, evidence, adoption, and production operations.
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-[var(--surface)]/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Highest leverage next</div>
              <div className="mt-2 text-sm font-semibold text-white">{enterpriseMaturity.highestLeveragePillar.name}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{enterpriseMaturity.highestLeveragePillar.nextAction}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold">{enterpriseMaturity.eliteCount}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">elite pillars</div>
              </div>
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold">{enterpriseMaturity.gapCount}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">gaps</div>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-[var(--surface-subtle)] md:grid-cols-2 2xl:grid-cols-5">
            {enterpriseMaturity.pillars.map((pillar) => (
              <div key={pillar.id} className="bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{pillar.name}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{pillar.standard}</div>
                  </div>
                  <Badge tone={maturityTone[pillar.status]}>{pillar.score}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pillar.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{pillar.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-4 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] p-5 xl:border-b-0 xl:border-r">
            <Badge tone={integrationTone[integrationBlueprint.status]}>
              integration blueprint {integrationBlueprint.score}/100
            </Badge>
            <h3 className="mt-3 text-base font-bold text-[var(--text)]">How this plugs into the company</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{integrationBlueprint.summary}</p>
            <button
              type="button"
              aria-label={actionLabel({
                action: "Open next connector move",
                context: integrationBlueprint.primaryNextAction.name,
                helper: integrationBlueprint.primaryNextAction.nextAction,
                destination: integrationBlueprint.primaryNextAction.targetView,
              })}
              onClick={integrationActionByView[integrationBlueprint.primaryNextAction.targetView] ?? onOpenBroker}
              className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Next connector move</div>
              <div className="mt-2 text-sm font-semibold text-[var(--text)]">{integrationBlueprint.primaryNextAction.name}</div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">
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

          <div className="grid gap-px bg-[var(--surface-subtle)] lg:grid-cols-2 2xl:grid-cols-3">
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
                className="group bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--surface-muted)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{zone.name}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{zone.purpose}</div>
                  </div>
                  <Badge tone={integrationTone[zone.status]}>{zone.status}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${zone.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{zone.evidence}</p>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden border-[var(--border)]/70 bg-[var(--surface)]/95">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)]/70 px-5 py-4">
          <div>
            <SectionTitle title="Executive Signal Rail" helper="Click any signal to shift the portfolio lens below" compact />
          </div>
          <Badge tone="blue">{lens}</Badge>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px bg-[var(--border)]/70">
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
                className={`group min-h-[128px] bg-[var(--surface)] px-4 py-4 text-left transition hover:bg-[var(--primary-soft)] ${
                  active ? "shadow-[inset_0_-3px_0_var(--primary)]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex size-9 items-center justify-center rounded-full ${
                    active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                  }`}>
                    <Icon size={18} />
                  </span>
                  <Badge tone={item.tone}>{active ? "active" : "signal"}</Badge>
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--text-soft)]">{item.label}</div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">{item.value}</div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden border-[var(--border)]/70 bg-[var(--surface)]/95">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/70 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">{lens} Lens</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
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
          <section className="border-b border-[var(--border)]/70 p-5 xl:border-b-0 xl:border-r" aria-label="Use cases by function">
            <SectionTitle title="Use Cases by Function" compact />
            <div className="flex h-[230px] items-center justify-center">
              <div
                className="relative size-44 rounded-full"
                style={{ background: donutGradient(functionData) }}
                aria-label="Use cases by function"
              >
                <div className="absolute inset-12 rounded-full bg-[var(--surface)] shadow-inner" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-semibold">
                      {functionData.reduce((sum, item) => sum + item.value, 0)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">use cases</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {functionData.length ? functionData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />
                    <span className="truncate text-[var(--text-muted)]">{item.name}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                  No function data yet. Add or import use cases to populate this chart.
                </div>
              )}
            </div>
          </section>

          <section className="border-b border-[var(--border)]/70 p-5 xl:border-b-0 xl:border-r" aria-label="Pilot status">
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

      <div id="home-portfolio" className="mt-4 grid scroll-mt-5 gap-4 xl:grid-cols-3">
        <Panel className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <SectionTitle title="Top Priority Use Cases" compact />
            <button
              type="button"
              className="inline-flex min-h-8 items-center rounded-lg px-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              onClick={onViewBacklog}
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {useCases.length ? [...useCases]
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .slice(0, 5)
              .map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={`Open priority use case: ${item.title}`}
                  onClick={() => onOpenUseCase(item.id)}
                  className="grid w-full min-w-0 grid-cols-1 items-start gap-2 px-5 py-4 text-left text-sm hover:bg-[var(--surface-muted)] sm:grid-cols-[minmax(0,1.6fr)_0.7fr_0.6fr_0.6fr_32px] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text)]">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.description}</div>
                  </div>
                  <span className="min-w-0 text-[var(--text-muted)]">{item.department}</span>
                  <Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge>
                  <span className="font-semibold">{item.priorityScore}/100</span>
                  <ChevronRight size={16} className="hidden text-[var(--text-soft)] sm:block" />
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
              <div key={review.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{review.title}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{review.reviewer} · due {review.dueDate}</div>
                  </div>
                  <Badge tone={riskTone(review.riskLevel)}>{review.riskLevel}</Badge>
                </div>
                <div className="mt-3 text-xs text-[var(--text-muted)]">{review.blockers[0] ?? "No blockers"}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)]">
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
                <div className="mt-1 text-xs text-[var(--text-muted)]">{skill.department} · {skill.version}</div>
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
