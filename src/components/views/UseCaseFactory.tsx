import type React from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Database,
  FileCheck2,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  calculatePriorityScore,
  formatCurrency,
  getUserName,
  riskToScore,
  type Department,
  type RiskLevel,
  type UseCase,
} from "@/lib/enterprise-ai-data";
import { requestUseCaseDraft } from "@/lib/use-case-drafting";
import {
  deriveFactoryIntelligence,
  deriveIntakeIntelligence,
  deriveUseCaseIntelligence,
  type IntelligenceAction,
  type UseCaseIntelligence,
} from "@/lib/use-case-intelligence";
import type { IntakeForm } from "@/lib/ui/types";
import { autonomyLabels, statusLabels } from "@/lib/ui/constants";
import {
  Badge,
  Button,
  CheckRow,
  DataTable,
  EmptyState,
  Field,
  MiniMetric,
  OperatingBrief,
  Panel,
  ReadinessTile,
  riskTone,
  ScoreBar,
  SectionTitle,
  statusTone,
  Stepper,
  Tabs,
  TextBlock,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import {
  capitalize,
  factoryDepartmentLabel,
  factoryIconTone,
  factoryPriorityScore,
  factoryStatusLabel,
  factoryStatusTone,
  factorySubtitle,
  FactoryMetricCard,
  FactoryUseCaseGlyph,
  opportunityAnnualValue,
  opportunityFteImpact,
  opportunityImpactBullets,
  OwnerAvatar,
  PriorityRing,
  StakeholderRow,
  TimelineLine,
} from "@/components/factory/shared";

function intakeSourcesFromText(value: string) {
  return value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function intakeStepMissing(intake: IntakeForm, step: number) {
  if (step === 0) {
    return [
      ["Use case title", intake.title.trim()],
      ["Business problem", intake.businessProblem.trim()],
      ["Current process", intake.currentProcess.trim()],
    ].filter(([, value]) => !value).map(([label]) => label);
  }
  if (step === 1) {
    return [
      ["Desired outcome", intake.desiredOutcome.trim()],
      ["What AI should help with", intake.aiHelp.trim()],
      ["What AI should not do", intake.aiNotDo.trim()],
    ].filter(([, value]) => !value).map(([label]) => label);
  }
  if (step === 2) {
    return intakeSourcesFromText(intake.dataSources).length ? [] : ["At least one data source"];
  }
  if (step === 3) {
    return [
      ["Monthly volume", intake.monthlyVolume > 0],
      ["Average handling time", intake.avgHandlingTimeMinutes > 0],
      ["Estimated users", intake.estimatedUsers > 0],
    ].filter(([, value]) => !value).map(([label]) => String(label));
  }
  return [];
}

function intakeStepGuidance(step: number) {
  return [
    {
      title: "Problem framing",
      body: "Capture the pain in business language. The AI Assistant uses this to infer department fit, value driver, likely risk, and process boundaries.",
      output: "Problem statement, affected function, current process baseline",
    },
    {
      title: "Future-state boundary",
      body: "Separate what AI should help with from what it must never decide or execute. This is where autonomy and human oversight start.",
      output: "Capability pattern, autonomy guardrails, decision boundaries",
    },
    {
      title: "Context and risk",
      body: "Name the systems and sources the Skill would need. Sensitivity, human review, and external communication determine governance routing.",
      output: "Data readiness, risk categories, reviewer map",
    },
    {
      title: "Value model",
      body: "Add enough volume and handling-time data to create an auditable baseline. These assumptions can be replaced later by pilot telemetry.",
      output: "Hours saved, annualized value, adoption baseline",
    },
    {
      title: "AI review",
      body: "Review the AI-generated brief before submission. Nothing launches here; it creates a scored opportunity that can move to discovery, governance, and Skill creation.",
      output: "Scored use case, audit event, next-step recommendation",
    },
  ][step];
}

const messyIdeaExamples: { label: string; department: Department; text: string }[] = [
  {
    label: "HR policy answers",
    department: "HR",
    text: "HR keeps answering the same benefits eligibility questions by email and tickets. Employees wait several days, answers vary by person, and People Ops wants a safe AI assistant that cites approved policy and escalates edge cases.",
  },
  {
    label: "Invoice exceptions",
    department: "Finance",
    text: "Finance spends too much time resolving invoice exceptions. Missing PO context, receipt mismatches, and repeated supplier follow-ups slow down payment, and the team wants AI to summarize the issue and draft the next request for review.",
  },
  {
    label: "IT access help",
    department: "IT",
    text: "IT gets repeated access questions from new hires and managers. Tickets bounce between teams because policy, role, and app ownership are unclear, and IT wants an assistant that explains the approved path and flags risky access changes.",
  },
];

type AdvancedUseCaseLens = "all" | "reusable" | "data_ready" | "human_oversight";

const advancedLensOptions: { id: AdvancedUseCaseLens; label: string; helper: string }[] = [
  { id: "all", label: "All opportunities", helper: "Show every active record" },
  { id: "reusable", label: "Reusable patterns", helper: "Prioritize work that can become repeatable Skills" },
  { id: "data_ready", label: "Ready data", helper: "Show opportunities with enough approved context to pilot" },
  { id: "human_oversight", label: "Human oversight", helper: "Focus on cases that need explicit review gates" },
];

function matchesAdvancedUseCaseLens(useCase: UseCase, lens: AdvancedUseCaseLens) {
  if (lens === "all") return true;
  if (lens === "reusable") return useCase.reuseScore >= 4 || Boolean(useCase.linkedSkillId);
  if (lens === "data_ready") return useCase.dataReadinessScore >= 4 || useCase.dataSources.length >= 2;
  return useCase.riskLevel === "high" || useCase.riskLevel === "restricted" || useCase.risks.length > 0;
}

function factoryActionLabel(action: IntelligenceAction) {
  if (action.targetTab === "intake") return "Open intake";
  if (action.targetTab === "scoring") return "Open scoring review";
  if (action.targetTab === "pilot") return "Open pilot plan";
  if (action.targetTab === "detail") return "Open opportunity brief";
  if (action.targetTab === "value") return "Open value proof";
  if (action.targetTab === "backlog") return "Open backlog";
  return "Open factory overview";
}

function intakeStepChecklist(step: number, missing: string[]) {
  if (step === 0) {
    return missing.length
      ? ["Paste a messy request or use an example.", "Click Structure idea.", `Fill: ${missing.join(", ")}.`]
      : ["The problem is framed.", "Move to Solution.", "Keep business language; avoid tool details for now."];
  }
  if (step === 1) {
    return missing.length
      ? ["Describe the desired business outcome.", "Say exactly what AI may help with.", "Name what AI must not decide or execute."]
      : ["The AI boundary is clear.", "Move to Data & Risk.", "Keep human review explicit."];
  }
  if (step === 2) {
    return missing.length
      ? ["List approved documents, systems, or teams.", "Choose data sensitivity.", "Flag human review and external communication."]
      : ["Sources and risk are mapped.", "Move to Value.", "Governance routing can now be inferred."];
  }
  if (step === 3) {
    return missing.length
      ? ["Add monthly volume.", "Add average handling time.", "Add estimated user count."]
      : ["The value baseline is ready.", "Move to Review.", "Replace assumptions later with pilot telemetry."];
  }
  return missing.length
    ? ["Review remaining missing fields.", "Go back to fix the first gap.", "Submit only when the score preview is ready."]
    : ["Review the generated brief.", "Check risk and reviewer routing.", "Submit and score the opportunity."];
}

function confidenceTone(value: number): "green" | "amber" | "red" {
  if (value >= 75) return "green";
  if (value >= 45) return "amber";
  return "red";
}

function FactoryAction({
  icon: Icon,
  title,
  body,
  action,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${action}: ${title}`}
      onClick={onClick}
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--text)]">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{body}</span>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
            {action}
            <ChevronRight size={13} />
          </span>
        </span>
      </div>
    </button>
  );
}

function FactoryWorklist({
  title,
  helper,
  empty,
  items,
  onOpen,
}: {
  title: string;
  helper: string;
  empty: string;
  items: UseCase[];
  onOpen: (useCase: UseCase) => void;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <SectionTitle title={title} helper={helper} compact />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {items.length ? items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 text-left hover:bg-[var(--surface-muted)]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--text)]">{item.title}</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">{factoryDepartmentLabel(item.department)} · {factoryStatusLabel(item.status)}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={riskTone(item.riskLevel)}>{item.riskLevel}</Badge>
              <ChevronRight size={15} className="text-[var(--text-soft)]" />
            </span>
          </button>
        )) : (
          <div className="px-5 py-8 text-sm leading-6 text-[var(--text-muted)]">{empty}</div>
        )}
      </div>
    </Panel>
  );
}

export function UseCaseFactory({
  tab,
  setTab,
  intakeStep,
  setIntakeStep,
  intake,
  setIntake,
  onSubmit,
  useCases,
  selectedUseCase,
  setSelectedUseCaseId,
  onConvert,
  onImport,
  onGovernance,
}: {
  tab: string;
  setTab: (tab: string) => void;
  intakeStep: number;
  setIntakeStep: (step: number) => void;
  intake: IntakeForm;
  setIntake: React.Dispatch<React.SetStateAction<IntakeForm>>;
  onSubmit: () => void;
  useCases: UseCase[];
  selectedUseCase: UseCase | null;
  setSelectedUseCaseId: (id: string) => void;
  onConvert: (useCase: UseCase) => void;
  onImport: () => void;
  onGovernance: (useCase: UseCase) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const [detailTab, setDetailTab] = useState("overview");
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedLens, setAdvancedLens] = useState<AdvancedUseCaseLens>("all");
  const [factoryNotice, setFactoryNotice] = useState("");
  const [factoryPageIndex, setFactoryPageIndex] = useState(0);
  const [factoryRowsPerPage, setFactoryRowsPerPage] = useState(7);
  const [messyIdea, setMessyIdea] = useState("");
  const advancedFiltersId = "use-case-advanced-filters";
  const filteredUseCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...useCases]
      .filter((item) => {
        if (item.status === "scaled") return false;
        const matchesQuery =
          !normalized ||
          item.title.toLowerCase().includes(normalized) ||
          item.description.toLowerCase().includes(normalized) ||
          item.department.toLowerCase().includes(normalized);
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;
        const matchesRisk = riskFilter === "all" || item.riskLevel === riskFilter;
        const matchesDepartment = departmentFilter === "all" || item.department === departmentFilter;
        const matchesOwner = ownerFilter === "all" || item.ownerId === ownerFilter;
        const matchesAdvancedLens = matchesAdvancedUseCaseLens(item, advancedLens);
        return matchesQuery && matchesStatus && matchesRisk && matchesDepartment && matchesOwner && matchesAdvancedLens;
      })
      .sort((a, b) => {
        if (sortMode === "updated") return b.updatedAt.localeCompare(a.updatedAt);
        if (sortMode === "risk") return b.riskScore - a.riskScore;
        if (sortMode === "value") return b.valueScore - a.valueScore;
        return factoryPriorityScore(b) - factoryPriorityScore(a);
      });
  }, [advancedLens, departmentFilter, ownerFilter, query, riskFilter, sortMode, statusFilter, useCases]);
  const factoryIntelligence = useMemo(() => deriveFactoryIntelligence(useCases), [useCases]);
  const intakeIntelligence = useMemo(() => deriveIntakeIntelligence(intake), [intake]);
  const selectedUseCaseIntelligence = useMemo(
    () => (selectedUseCase ? deriveUseCaseIntelligence(selectedUseCase) : null),
    [selectedUseCase],
  );

  const portfolioTotal = useCases.length;
  const readyForPilot = useCases.filter((item) =>
    ["approved_for_pilot", "governance_review", "in_pilot"].includes(item.status),
  ).length;
  const highPriority = useCases.filter((item) => factoryPriorityScore(item) >= 75).length;
  const estimatedAnnualValue = useCases.reduce((sum, item) => sum + opportunityAnnualValue(item), 0);
  const avgPriority = useCases.length
    ? Math.round(useCases.reduce((sum, item) => sum + factoryPriorityScore(item), 0) / useCases.length)
    : 0;
  const departments = Array.from(new Set(useCases.map((item) => item.department))).sort();
  const owners = Array.from(new Set(useCases.map((item) => item.ownerId).filter(Boolean))) as string[];
  const advancedLensCounts = useMemo(
    () =>
      advancedLensOptions.reduce<Record<AdvancedUseCaseLens, number>>(
        (counts, option) => {
          counts[option.id] = useCases.filter(
            (item) => item.status !== "scaled" && matchesAdvancedUseCaseLens(item, option.id),
          ).length;
          return counts;
        },
        {
          all: 0,
          reusable: 0,
          data_ready: 0,
          human_oversight: 0,
        },
      ),
    [useCases],
  );
  const activeAdvancedLensLabel = advancedLensOptions.find((option) => option.id === advancedLens)?.label ?? "All opportunities";
  const stageCounts = {
    intake: useCases.filter((item) => ["draft", "submitted", "triage"].includes(item.status)).length,
    discovery: useCases.filter((item) => ["discovery", "scored"].includes(item.status)).length,
    governance: useCases.filter((item) => item.status === "governance_review").length,
    pilot: useCases.filter((item) => ["approved_for_pilot", "in_pilot"].includes(item.status)).length,
    scale: useCases.filter((item) => ["measuring", "scaled"].includes(item.status)).length,
  };
  const pipelineStages = [
    {
      label: "Intake",
      count: stageCounts.intake,
      helper: "New demand, requests, and messy ideas",
      tabId: "intake",
    },
    {
      label: "Discovery",
      count: stageCounts.discovery,
      helper: "Scored for value, feasibility, reuse, and data",
      tabId: "scoring",
    },
    {
      label: "Governance",
      count: stageCounts.governance,
      helper: "Risk review, owners, and approval routing",
      tabId: "detail",
    },
    {
      label: "Pilot",
      count: stageCounts.pilot,
      helper: "Skill plan, tests, rollout gates, and controls",
      tabId: "pilot",
    },
    {
      label: "Value",
      count: stageCounts.scale,
      helper: "Measured impact, adoption, and scaling evidence",
      tabId: "value",
    },
  ] as const;
  const topOpportunities = [...useCases].sort((a, b) => factoryPriorityScore(b) - factoryPriorityScore(a)).slice(0, 4);
  const needsDiscovery = useCases.filter((item) => ["submitted", "triage", "discovery", "scored"].includes(item.status)).slice(0, 4);
  const governanceCandidates = useCases.filter((item) => ["scored", "governance_review", "approved_for_pilot"].includes(item.status)).slice(0, 4);
  const reusablePatterns = useCases.filter((item) => item.reuseScore >= 4).slice(0, 4);
  const factoryTabs: [string, string][] = [
    ["overview", "Start"],
    ["intake", "New idea"],
    ["backlog", "Backlog"],
    ["scoring", "Prioritize"],
    ["detail", "Brief"],
    ["pilot", "Pilot"],
    ["value", "Value"],
  ];
  const activeFactoryLabel = factoryTabs.find(([id]) => id === tab)?.[1] ?? "Backlog";
  const factoryPageCount = Math.max(1, Math.ceil(filteredUseCases.length / factoryRowsPerPage));
  const safeFactoryPageIndex = Math.min(factoryPageIndex, factoryPageCount - 1);
  const factoryPageStart = safeFactoryPageIndex * factoryRowsPerPage;
  const factoryPageRows = filteredUseCases.slice(factoryPageStart, factoryPageStart + factoryRowsPerPage);
  const factoryPageNumbers = Array.from(
    new Set(
      [0, safeFactoryPageIndex - 1, safeFactoryPageIndex, safeFactoryPageIndex + 1, factoryPageCount - 1].filter(
        (pageNumber) => pageNumber >= 0 && pageNumber < factoryPageCount,
      ),
    ),
  ).sort((a, b) => a - b);
  const intakeSources = intakeIntelligence.contextSources;
  const intakeRiskDrivers = intakeIntelligence.riskCategories;
  const intakeReviews = intakeIntelligence.requiredReviews;
  const intakePattern = intakeIntelligence.recommendedPattern;
  const intakeMonthlyHours = Math.round((intake.monthlyVolume * intake.avgHandlingTimeMinutes) / 60);
  const intakeMonthlyValue = Math.round(intakeMonthlyHours * 68);
  const intakeAnnualValue = intakeMonthlyValue * 12;
  const intakeCurrentMissing = intakeStepMissing(intake, intakeStep);
  const intakeAllMissing = [0, 1, 2, 3].flatMap((step) => intakeStepMissing(intake, step));
  const intakeReadiness = Math.round(((12 - Math.min(12, intakeAllMissing.length)) / 12) * 100);
  const intakeValueScore = intake.monthlyVolume > 5000 ? 5 : intake.monthlyVolume > 1000 ? 4 : intake.monthlyVolume > 0 ? 3 : 1;
  const intakeFeasibilityScore = intakeSources.length >= 2 ? 4 : intakeSources.length === 1 ? 3 : 2;
  const intakeReuseScore = ["HR", "IT", "Operations"].includes(intake.department) ? 5 : 4;
  const intakeUrgencyScore = intake.humanReview ? 4 : 3;
  const intakeDataReadinessScore = intakeSources.length >= 2 ? 4 : intakeSources.length === 1 ? 3 : 1;
  const intakePriorityPreview = calculatePriorityScore({
    valueScore: intakeValueScore,
    feasibilityScore: intakeFeasibilityScore,
    reuseScore: intakeReuseScore,
    urgencyScore: intakeUrgencyScore,
    dataReadinessScore: intakeDataReadinessScore,
    riskScore: riskToScore(intake.dataSensitivity),
  });
  const guidance = intakeStepGuidance(intakeStep);
  const intakeChecklist = intakeStepChecklist(intakeStep, intakeCurrentMissing);
  const generatedSummary = intakeIntelligence.generatedSummary;
  const overviewNextTitle = portfolioTotal ? "Decide which use case should move next" : "Capture the first AI opportunity";
  const overviewNextBody = portfolioTotal
    ? factoryIntelligence.nextBestAction.body
    : "Start with a real business pain point. The OS will structure it, score it, classify risk, and show whether it is worth turning into an AI Skill.";
  const overviewPrimaryAction = portfolioTotal ? () => performFactoryAction() : () => setTab("intake");
  const factoryNextActionLabel = factoryActionLabel(factoryIntelligence.nextBestAction);
  const overviewPrimaryLabel = portfolioTotal ? factoryNextActionLabel : "Create use case";
  const primaryOpportunity = topOpportunities[0] ?? null;
  const primaryOpportunityScore = primaryOpportunity ? factoryPriorityScore(primaryOpportunity) : 0;
  const graduationSteps = [
    {
      label: "Capture",
      title: portfolioTotal ? "Demand is in the funnel" : "Capture a real business pain",
      body: portfolioTotal
        ? `${portfolioTotal} opportunity${portfolioTotal === 1 ? "" : "ies"} captured across ${departments.length || 1} function${departments.length === 1 ? "" : "s"}.`
        : "Paste a messy request, interview note, or work signal and let the factory structure the first opportunity.",
      status: portfolioTotal ? `${portfolioTotal} live` : "Start here",
      complete: portfolioTotal > 0,
      actionLabel: "Open intake",
      action: () => setTab("intake"),
    },
    {
      label: "Score",
      title: primaryOpportunity ? `${primaryOpportunity.title} is leading` : "Score value, risk, and fit",
      body: primaryOpportunity
        ? `${primaryOpportunity.department} has the strongest current score. Compare value, feasibility, reuse, urgency, data readiness, and risk before build work starts.`
        : "Use prioritization to decide whether the idea deserves discovery, governance, pilot, or parking.",
      status: primaryOpportunity ? `${primaryOpportunityScore}/100` : "No score",
      complete: primaryOpportunityScore >= 55,
      actionLabel: "Prioritize",
      action: () => {
        if (primaryOpportunity) setSelectedUseCaseId(primaryOpportunity.id);
        setTab("scoring");
      },
    },
    {
      label: "Govern",
      title: governanceCandidates.length ? "Risk path is visible" : "Route the risk decision",
      body: governanceCandidates.length
        ? `${governanceCandidates.length} candidate${governanceCandidates.length === 1 ? "" : "s"} can move through governance review or approval conditions.`
        : "Before Skill build, confirm sensitive data, human review, external communication, and reviewer ownership.",
      status: governanceCandidates.length ? `${governanceCandidates.length} candidate${governanceCandidates.length === 1 ? "" : "s"}` : "Needs routing",
      complete: governanceCandidates.length > 0,
      actionLabel: governanceCandidates.length ? "Open review" : "Open backlog",
      action: () => {
        const candidate = governanceCandidates[0] ?? primaryOpportunity;
        if (candidate) {
          setSelectedUseCaseId(candidate.id);
          setDetailPanelOpen(true);
        }
        if (governanceCandidates[0]) {
          onGovernance(governanceCandidates[0]);
          return;
        }
        setTab("backlog");
      },
    },
    {
      label: "Build",
      title: readyForPilot ? "Ready to become a Skill" : "Convert only when proof exists",
      body: readyForPilot
        ? `${readyForPilot} opportunity${readyForPilot === 1 ? "" : "ies"} can move toward Skill packaging, workflow design, Harness runs, and value proof.`
        : "The best ideas should become governed Skills only after scoring, ownership, data sources, and review gates are clear.",
      status: readyForPilot ? `${readyForPilot} ready` : "Not ready",
      complete: readyForPilot > 0,
      actionLabel: "Open pilot",
      action: () => {
        if (primaryOpportunity) setSelectedUseCaseId(primaryOpportunity.id);
        setTab("pilot");
      },
    },
  ];
  const completedGraduationSteps = graduationSteps.filter((step) => step.complete).length;
  const nextGraduationStep = graduationSteps.find((step) => !step.complete) ?? graduationSteps[graduationSteps.length - 1];

  function goToFactoryPage(nextPageIndex: number) {
    const clamped = Math.min(Math.max(nextPageIndex, 0), factoryPageCount - 1);
    setFactoryPageIndex(clamped);
    setFactoryNotice(`Page ${clamped + 1} selected.`);
  }

  function advanceIntakeStep() {
    const missing = intakeStepMissing(intake, intakeStep);
    if (missing.length) {
      setFactoryNotice(`Complete ${missing.join(", ")} before moving to ${intakeStepGuidance(Math.min(4, intakeStep + 1)).title}.`);
      return;
    }
    setFactoryNotice("");
    setIntakeStep(Math.min(4, intakeStep + 1));
  }

  function submitIntakeFromFactory() {
    const firstIncompleteStep = [0, 1, 2, 3].find((step) => intakeStepMissing(intake, step).length > 0);
    if (firstIncompleteStep !== undefined) {
      const missing = intakeStepMissing(intake, firstIncompleteStep);
      setIntakeStep(firstIncompleteStep);
      setFactoryNotice(`Complete ${missing.join(", ")} before submitting this opportunity.`);
      return;
    }
    setFactoryNotice("");
    onSubmit();
  }

  function draftNotice(provenance: "model" | "heuristic", clampReason?: string) {
    const base =
      provenance === "model"
        ? "AI model drafted the first-pass intake (validated against policy floors)."
        : "Heuristic draft — no model is configured, so this is a deterministic template, not AI output.";
    const clamp = clampReason ? ` Autonomy was policy-capped: ${clampReason}` : "";
    return `${base}${clamp} Confirm the problem, sources, risk, and value assumptions before submitting.`;
  }

  async function structureMessyIdea() {
    if (!messyIdea.trim()) {
      setFactoryNotice("Paste a business pain point or stakeholder request before asking the AI Assistant to draft the intake.");
      return;
    }
    setFactoryNotice("Drafting the intake…");
    const result = await requestUseCaseDraft(messyIdea);
    setIntake((current) => ({ ...current, ...result.draft }));
    setIntakeStep(0);
    setFactoryNotice(draftNotice(result.provenance, result.autonomyPreview?.clamped ? result.autonomyPreview.clampReason : undefined));
  }

  async function draftFromExample(example: (typeof messyIdeaExamples)[number]) {
    setMessyIdea(example.text);
    setFactoryNotice("Drafting the intake…");
    const result = await requestUseCaseDraft(example.text);
    setIntake((current) => ({ ...current, ...result.draft, department: example.department }));
    setIntakeStep(0);
    setFactoryNotice(`${example.label}: ${draftNotice(result.provenance, result.autonomyPreview?.clamped ? result.autonomyPreview.clampReason : undefined)}`);
  }

  function performFactoryAction(action = factoryIntelligence.nextBestAction) {
    if (action.useCaseId) {
      setSelectedUseCaseId(action.useCaseId);
      setDetailPanelOpen(true);
    }
    setTab(action.targetTab);
    setFactoryNotice(action.title);
  }

  function emptyArtifactCopy() {
    if (tab === "pilot") {
      return {
        title: "Select an opportunity before opening Pilot",
        body: "Create or import an opportunity, then open Pilot to define scope, guardrails, success metrics, and launch readiness.",
      };
    }

    if (tab === "value") {
      return {
        title: "Select an opportunity before opening Value",
        body: "Create or import an opportunity, then open Value to review hours saved, annualized value, confidence bands, and ROI assumptions.",
      };
    }

    return {
      title: "Select an opportunity before opening Brief",
      body: "Create or import an opportunity, then open Brief to review the problem, process, desired outcome, scoring, risks, and stakeholders.",
    };
  }

  const selectedArtifactCopy = emptyArtifactCopy();
  const emptyArtifactPrimaryLabel = useCases.length ? "Open backlog" : "Create use case";
  const emptyArtifactPrimaryAction = () => setTab(useCases.length ? "backlog" : "intake");
  const emptyArtifactSteps = [
    {
      label: "Capture demand",
      body: "Start from a real stakeholder request, work signal, support pattern, or manual process pain.",
      icon: Sparkles,
    },
    {
      label: "Score the opportunity",
      body: "Confirm value, feasibility, reuse, data readiness, risk, owner, and approval path before build work.",
      icon: SlidersHorizontal,
    },
    {
      label: "Open the artifact",
      body: tab === "pilot"
        ? "Select a scored opportunity to build scope, guardrails, success metrics, and readiness gates."
        : tab === "value"
          ? "Select a scored opportunity to inspect assumptions, confidence, and ROI proof."
          : "Select a scored opportunity to inspect the reviewer-ready business brief.",
      icon: FileCheck2,
    },
  ];

  function renderFactoryTabs() {
    return (
      <div data-testid="use-case-factory-tabs">
        <Tabs
          tabs={factoryTabs}
          active={tab}
          onChange={setTab}
          ariaLabel="Use case factory sections"
          idBase="use-case-factory"
          panelId={(id) => `use-case-factory-panel-${id}`}
        />
      </div>
    );
  }

  function factoryTabPanelProps(activeTab = tab) {
    return {
      id: `use-case-factory-panel-${activeTab}`,
      role: "tabpanel",
      "aria-labelledby": `use-case-factory-${activeTab}-tab`,
      "data-testid": `use-case-factory-panel-${activeTab}`,
    } as const;
  }

  if (tab === "overview") {
    return (
      <div>
        <PageHeader
          title="Use Cases"
          subtitle="Turn business pain into a clear AI opportunity, decide if it is worth building, and move it toward a governed AI Skill."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onImport}>
                <Upload size={16} />
                Import ideas
              </Button>
              <Button onClick={() => setTab("intake")}>
                <Plus size={16} />
                New use case
              </Button>
            </div>
          }
        />

        {renderFactoryTabs()}

        <Panel className="mt-4 overflow-hidden" data-testid="use-case-pipeline-map">
          <div className="border-b border-[var(--border)]/70 bg-[var(--surface-muted)]/54 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="Opportunity Pipeline"
                helper="Move AI demand from raw business pain to governed pilot and measurable value."
                compact
              />
              <Badge tone={portfolioTotal ? "blue" : "slate"}>{portfolioTotal} total</Badge>
            </div>
          </div>
          <div className="grid gap-px bg-[var(--border)]/70 sm:grid-cols-2 xl:grid-cols-5">
            {pipelineStages.map((stage, index) => {
              const isActive =
                (stage.tabId === "intake" && !portfolioTotal) ||
                (stage.count > 0 && pipelineStages.findIndex((item) => item.count > 0) === index);

              return (
                <button
                  key={stage.label}
                  type="button"
                  aria-label={`Open ${stage.label} pipeline stage`}
                  onClick={() => setTab(stage.tabId)}
                  className={`group min-h-[132px] bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--primary-soft)]/42 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                    isActive ? "relative z-[1] ring-2 ring-[var(--primary)]/30" : ""
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                      {index + 1}
                    </span>
                    <Badge tone={stage.count ? "blue" : "slate"}>{stage.count}</Badge>
                  </span>
                  <span className="mt-3 block text-sm font-semibold text-[var(--text)]">{stage.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{stage.helper}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    Open stage
                    <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel {...factoryTabPanelProps()} className="mt-4 overflow-hidden border-[var(--primary)]/16 bg-[var(--surface)]/92">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={portfolioTotal ? "green" : "blue"}>{portfolioTotal ? "live portfolio" : "start here"}</Badge>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  {portfolioTotal} use case{portfolioTotal === 1 ? "" : "s"} · {highPriority} high priority
                </span>
              </div>
              <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-[-0.02em] text-[var(--text)] sm:text-[30px]">
                {overviewNextTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-[15px]">{overviewNextBody}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={overviewPrimaryAction}>
                  <Sparkles size={16} />
                  {overviewPrimaryLabel}
                </Button>
                <Button variant="secondary" onClick={() => setTab("intake")}>
                  <Plus size={16} />
                  Capture idea
                </Button>
              </div>
              <details
                className="group mt-6 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72"
                data-testid="factory-simple-path"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">How this becomes an AI Skill</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      Capture the pain, prioritize it, then build only after ownership and risk are clear.
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
                </summary>
                <div className="hidden grid-cols-1 gap-px overflow-hidden border-t border-[var(--border)]/70 bg-[var(--border)]/70 group-open:grid md:grid-cols-3">
                  {[
                    ["1", "Capture", "Describe the pain, workflow, owner, and desired outcome."],
                    ["2", "Prioritize", "Compare value, feasibility, reuse, data readiness, and risk."],
                    ["3", "Build", "Convert the best opportunity into a governed AI Skill."],
                  ].map(([number, title, helper]) => (
                    <div key={title} className="bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--primary)] ring-1 ring-[var(--border)]">
                          {number}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text)]">{title}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{helper}</p>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <aside className="min-w-0 border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-5 lg:border-l lg:border-t-0 sm:p-6">
              <SectionTitle title="Lead candidate" helper="The strongest current use case to inspect first" compact />
              <div className="mt-4">
                {primaryOpportunity ? (
                  <button
                    type="button"
                    aria-label={`Open lead opportunity brief: ${primaryOpportunity.title}`}
                    onClick={() => {
                      setSelectedUseCaseId(primaryOpportunity.id);
                      setTab("detail");
                    }}
                    className="w-full rounded-lg border border-[var(--primary)]/18 bg-[var(--surface)] p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-px hover:border-[var(--primary)]/30"
                    data-testid="factory-lead-opportunity"
                  >
                    <span className="flex items-start gap-3">
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${factoryIconTone(primaryOpportunity.department)}`}>
                        <FactoryUseCaseGlyph useCase={primaryOpportunity} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--text)]">{primaryOpportunity.title}</span>
                          <Badge tone={riskTone(primaryOpportunity.riskLevel)}>{primaryOpportunityScore}</Badge>
                        </span>
                        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                          {primaryOpportunity.department} · {statusLabels[primaryOpportunity.status] ?? primaryOpportunity.status}
                        </span>
                        <span className="mt-2 line-clamp-3 block text-xs leading-5 text-[var(--text-muted)]">{primaryOpportunity.businessProblem}</span>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                          Open brief <ChevronRight size={13} />
                        </span>
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/70 p-4 text-sm leading-6 text-[var(--text-muted)]">
                    Capture the first business pain point to create a prioritized list.
                  </div>
                )}
              </div>
              {topOpportunities.length > 1 ? (
                <details
                  className="group mt-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/72"
                  data-testid="factory-ranked-candidates"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Other ranked candidates</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{topOpportunities.length - 1} more high-priority options</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
                  </summary>
                  <div className="hidden space-y-2 border-t border-[var(--border)]/70 p-2 group-open:block">
                    {topOpportunities.slice(1, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedUseCaseId(item.id);
                          setTab("detail");
                        }}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition hover:bg-[var(--primary-soft)]/60"
                      >
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${factoryIconTone(item.department)}`}>
                          <FactoryUseCaseGlyph useCase={item} size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-[var(--text)]">{item.title}</span>
                            <Badge tone={riskTone(item.riskLevel)}>{factoryPriorityScore(item)}</Badge>
                          </span>
                          <span className="mt-1 line-clamp-1 block text-[11px] text-[var(--text-muted)]">{item.businessProblem}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["ready", readyForPilot],
                  ["value", estimatedAnnualValue ? formatCurrency(estimatedAnnualValue) : "$0"],
                  ["avg", avgPriority || "-"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-[var(--surface)] px-3 py-2 ring-1 ring-[var(--border)]/60">
                    <div className="truncate text-base font-bold text-[var(--text)]">{value}</div>
                    <div className="text-[11px] font-medium text-[var(--text-soft)]">{label}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </Panel>

        <Panel className="mt-4 overflow-hidden" data-testid="factory-graduation-path">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={completedGraduationSteps >= 3 ? "green" : completedGraduationSteps ? "blue" : "slate"}>
                  {completedGraduationSteps}/{graduationSteps.length} ready
                </Badge>
                <Badge tone={primaryOpportunityScore >= 75 ? "green" : primaryOpportunityScore >= 55 ? "blue" : "slate"}>
                  {primaryOpportunity ? `${primaryOpportunityScore}/100 top fit` : "No scored idea"}
                </Badge>
              </div>
              <div className="mt-4 rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)]/80 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Next factory move</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--text)]">{nextGraduationStep.title}</div>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{nextGraduationStep.body}</p>
                  </div>
                  <Button onClick={nextGraduationStep.action} className="shrink-0 whitespace-nowrap" data-testid="factory-next-graduation-action">
                    {nextGraduationStep.actionLabel}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniMetric label="Opportunities" value={String(portfolioTotal)} />
                <MiniMetric label="High priority" value={String(highPriority)} />
                <MiniMetric label="Ready for pilot" value={String(readyForPilot)} />
                <MiniMetric label="Modeled value" value={estimatedAnnualValue ? formatCurrency(estimatedAnnualValue) : "$0"} />
              </div>
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
              <SectionTitle title="Opportunity graduation path" helper="The plain route from rough request to governed Skill candidate." compact />
              <div className="mt-4 space-y-2">
                {graduationSteps.map((step, index) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={step.action}
                    data-testid={`factory-graduation-step-${index + 1}`}
                    className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                  >
                    <span
                      className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${
                        step.complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">{step.label}</span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text)]">{step.title}</span>
                    </span>
                    <Badge tone={step.complete ? "green" : "slate"}>{step.status}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 px-5 py-4 text-left shadow-[var(--shadow-card)]">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text)]">Advanced scoring and diagnostics</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                Open for the full control loop, scoring model, stage counts, and recommended moves.
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
          </summary>
          <div className="mt-4 space-y-4">
        <OperatingBrief
          className="mt-4"
          eyebrow="factory control loop"
          title={factoryIntelligence.nextBestAction.title}
          body={factoryIntelligence.operatingNarrative}
          status={{
            label: portfolioTotal ? "live funnel" : "production-empty",
            tone: portfolioTotal ? "green" : "blue",
          }}
          progress={{ value: portfolioTotal ? Math.min(100, Math.max(avgPriority, 24)) : 0, label: "factory score" }}
          secondaryAction={{ label: "Import Ideas", onClick: onImport, icon: Upload }}
          primaryAction={{ label: factoryNextActionLabel, onClick: () => performFactoryAction(), icon: Sparkles }}
          signals={[
            {
              label: "Opportunities",
              value: portfolioTotal,
              helper: `${departments.length || 0} departments represented`,
              tone: portfolioTotal ? "green" : "amber",
              badge: portfolioTotal ? "live" : "empty",
              onClick: () => setTab("backlog"),
            },
            {
              label: "Ready for pilot",
              value: readyForPilot,
              helper: `${portfolioTotal ? Math.round((readyForPilot / portfolioTotal) * 100) : 0}% of total`,
              tone: readyForPilot ? "blue" : "slate",
              badge: readyForPilot ? "ready" : "none",
              onClick: () => setTab("pilot"),
            },
            {
              label: "High priority",
              value: highPriority,
              helper: avgPriority ? `Avg. score ${avgPriority}/100` : "No scored records yet",
              tone: highPriority ? "purple" : "slate",
              badge: highPriority ? "ranked" : "score",
              onClick: () => setTab("scoring"),
            },
            {
              label: "Annual value",
              value: formatCurrency(estimatedAnnualValue),
              helper: "from current opportunities",
              tone: estimatedAnnualValue ? "green" : "amber",
              badge: estimatedAnnualValue ? "modeled" : "baseline",
              onClick: () => setTab("value"),
            },
          ]}
          checklistTitle="Factory stages"
          checklistHelper="Each stage should leave an artifact the business, builder, and reviewer can trust."
          checklist={[
            { label: "Intake", helper: `${stageCounts.intake} ideas captured`, complete: stageCounts.intake > 0, onClick: () => setTab("intake") },
            { label: "Discovery", helper: `${stageCounts.discovery} opportunities being structured`, complete: stageCounts.discovery > 0, onClick: () => setTab("detail") },
            { label: "Governance", helper: `${stageCounts.governance} under review`, complete: stageCounts.governance > 0, onClick: () => setTab("backlog") },
            { label: "Pilot", helper: `${stageCounts.pilot} launch candidates`, complete: stageCounts.pilot > 0, onClick: () => setTab("pilot") },
            { label: "Scale", helper: `${stageCounts.scale} reusable patterns`, complete: stageCounts.scale > 0, onClick: () => setTab("value") },
          ]}
        />

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Panel className="overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <SectionTitle title="Factory Operating System" helper="Every opportunity moves through the same disciplined path before becoming a governed Skill" compact />
            </div>
            <div className="grid gap-px bg-[var(--surface-subtle)] md:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Intake", helper: "Capture pain", count: stageCounts.intake, tone: "purple" as const },
                { label: "Discovery", helper: "Structure value", count: stageCounts.discovery, tone: "blue" as const },
                { label: "Governance", helper: "Review risk", count: stageCounts.governance, tone: "amber" as const },
                { label: "Pilot", helper: "Test adoption", count: stageCounts.pilot, tone: "green" as const },
                { label: "Scale", helper: "Reuse pattern", count: stageCounts.scale, tone: "green" as const },
              ].map((stage, index) => (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => setTab(index === 0 ? "intake" : index === 1 ? "scoring" : index === 2 ? "backlog" : index === 3 ? "pilot" : "value")}
                  className="bg-[var(--surface)] p-5 text-left hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">{index + 1}</span>
                    <Badge tone={stage.tone}>{stage.count}</Badge>
                  </div>
                  <div className="mt-4 text-sm font-semibold text-[var(--text)]">{stage.label}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{stage.helper}</div>
                </button>
              ))}
            </div>
            <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5">
              <div className="text-sm font-semibold text-[var(--text)]">Industrialization Chain</div>
              <div className="mt-3 grid gap-2 text-xs font-semibold text-[var(--text-muted)] md:grid-cols-6">
                {["Pain", "Brief", "Score", "Skill", "Harness", "ROI"].map((item, index) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 shadow-sm">
                    <span className="flex size-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[10px] text-[var(--primary)]">{index + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                The factory is the controlled conversion point from business demand to governed, measurable AI capability. No Skill should bypass scoring, risk classification, ownership, and value assumptions.
              </p>
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Factory Next Actions" helper="The highest-value moves from the current funnel" />
            <div className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)]/50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--primary)] shadow-sm">
                  <Sparkles size={17} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">Factory intelligence</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{factoryIntelligence.nextBestAction.body}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-[var(--surface)]/75 p-3">
                  <div className="font-semibold text-[var(--text)]">{factoryIntelligence.departmentCoverage.represented}/7 functions covered</div>
                  <div className="mt-1 text-[var(--text-muted)]">
                    {factoryIntelligence.departmentCoverage.missing.length
                      ? `Missing ${factoryIntelligence.departmentCoverage.missing.slice(0, 2).join(", ")}`
                      : "Enterprise coverage active"}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface)]/75 p-3">
                  <div className="font-semibold text-[var(--text)]">{factoryIntelligence.reusablePatternSignals[0]?.label ?? "No pattern yet"}</div>
                  <div className="mt-1 text-[var(--text-muted)]">{factoryIntelligence.reusablePatternSignals[0]?.helper ?? "Capture opportunities to reveal patterns"}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <FactoryAction
                icon={Sparkles}
                title={factoryIntelligence.nextBestAction.title}
                body={factoryIntelligence.nextBestAction.body}
                action={factoryNextActionLabel}
                onClick={() => performFactoryAction()}
              />
              <FactoryAction
                icon={Plus}
                title={portfolioTotal ? "Capture next department pain point" : "Create the first opportunity"}
                body={portfolioTotal ? "Add the next HR, Finance, Legal, Procurement, IT, or Operations workflow pain point." : "Start with a real workflow pain point and the factory will structure and score it."}
                action="Open intake"
                onClick={() => setTab("intake")}
              />
              <FactoryAction
                icon={FileText}
                title="Review prioritized backlog"
                body={`${filteredUseCases.length} opportunities match the current factory filters.`}
                action="Open backlog"
                onClick={() => setTab("backlog")}
              />
              <FactoryAction
                icon={ShieldCheck}
                title="Prepare governance candidates"
                body={`${governanceCandidates.length} opportunities are near a governance or pilot decision.`}
                action="Review"
                onClick={() => setTab("scoring")}
              />
            </div>
          </Panel>
        </div>
          </div>
        </details>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel className="overflow-hidden xl:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <SectionTitle title="Priority Queue" helper="Top opportunities by value, feasibility, reuse, urgency, data readiness, and risk" compact />
              <Button variant="secondary" onClick={() => setTab("backlog")}>Open backlog</Button>
            </div>
            {topOpportunities.length ? (
              <div className="divide-y divide-[var(--border)]">
                {topOpportunities.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Open opportunity brief: ${item.title}`}
                    onClick={() => {
                      setSelectedUseCaseId(item.id);
                      setTab("detail");
                    }}
                    className="grid w-full gap-4 px-5 py-4 text-left hover:bg-[var(--surface-muted)] md:grid-cols-[44px_minmax(0,1fr)_120px_110px]"
                  >
                    <span className={`flex size-10 items-center justify-center rounded-lg ${factoryIconTone(item.department)}`}>
                      <FactoryUseCaseGlyph useCase={item} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-[var(--text)]">{item.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm leading-6 text-[var(--text-muted)]">{item.businessProblem}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--text)]">{factoryPriorityScore(item)}</span>
                      <PriorityRing value={factoryPriorityScore(item)} />
                    </span>
                    <span className="flex items-center">
                      <Badge tone={riskTone(item.riskLevel)}>{item.riskLevel}</Badge>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No AI opportunities yet"
                  body="Start by capturing a workflow pain point. The factory will structure it, score it, route it, and prepare it for Skill industrialization."
                  action="Create first use case"
                  onAction={() => setTab("intake")}
                />
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="How decisions work" helper="A simple path for choosing what should become an AI Skill" />
            <div className="mt-4 space-y-3">
              {[
                ["Rank", "Sort opportunities by value, feasibility, reuse, urgency, data readiness, and risk."],
                ["Review", "Check ownership, human oversight, data sources, and risk before work moves forward."],
                ["Build", "Convert the strongest use cases into governed AI Skills with tests and proof."],
              ].map(([label, helper], index) => (
                <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--surface)] text-[11px] font-bold text-[var(--primary)] ring-1 ring-[var(--border)]">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-[var(--text)]">{label}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{helper}</p>
                </div>
              ))}
            </div>
            <details className="group mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                <span>Show scoring weights</span>
                <ChevronRight size={14} className="text-[var(--text-soft)] transition group-open:rotate-90" />
              </summary>
              <div className="space-y-2 border-t border-[var(--border)] p-3">
                {[
                  ["Value", "30%", "Productivity, quality, cycle time, cost, and strategic lift"],
                  ["Feasibility", "20%", "Data availability, process clarity, and system readiness"],
                  ["Reuse", "20%", "Pattern value across functions, regions, or processes"],
                  ["Urgency", "15%", "Stakeholder need, timing, and executive priority"],
                  ["Data readiness", "10%", "Approved sources and permission clarity"],
                  ["Risk", "-15%", "Privacy, legal, security, employee, customer, and financial exposure"],
                ].map(([label, weight, helper]) => (
                  <div key={label} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[var(--text)]">{label}</span>
                      <Badge tone={weight.startsWith("-") ? "amber" : "blue"}>{weight}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{helper}</p>
                  </div>
                ))}
              </div>
            </details>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <FactoryWorklist
            title="Needs Discovery"
            helper="Shape vague ideas into business cases"
            empty="No opportunities need discovery right now."
            items={needsDiscovery}
            onOpen={(item) => {
              setSelectedUseCaseId(item.id);
              setTab("detail");
            }}
          />
          <FactoryWorklist
            title="Governance Candidates"
            helper="Prepare risk, context, tool, and oversight evidence"
            empty="No governance candidates yet."
            items={governanceCandidates}
            onOpen={(item) => {
              setSelectedUseCaseId(item.id);
              setTab("scoring");
            }}
          />
          <FactoryWorklist
            title="Reusable Patterns"
            helper="Convert strong candidates into Skills"
            empty="No reusable patterns identified yet."
            items={reusablePatterns}
            onOpen={(item) => {
              setSelectedUseCaseId(item.id);
              setTab("detail");
            }}
          />
        </div>
      </div>
    );
  }

  if (tab === "backlog" || tab === "scoring") {
    const visibleRows = factoryPageRows;
    const visibleStart = visibleRows.length ? factoryPageStart + 1 : 0;
    const visibleEnd = Math.min(factoryPageStart + visibleRows.length, filteredUseCases.length);
    const isFirstFactoryPage = safeFactoryPageIndex === 0;
    const isLastFactoryPage = safeFactoryPageIndex >= factoryPageCount - 1;
    const previousPageDisabledReason = "Already on the first page of the filtered use case list.";
    const nextPageDisabledReason =
      factoryPageCount <= 1 ? "All filtered use cases fit on one page." : "Already on the last page of the filtered use case list.";

    return (
      <div className={detailPanelOpen && selectedUseCase ? "grid min-w-0 min-h-[calc(100svh-112px)] gap-0 xl:grid-cols-[minmax(0,1fr)_430px]" : ""}>
        <div className={detailPanelOpen && selectedUseCase ? "min-w-0 xl:pr-5" : ""}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <button
                  type="button"
                  data-testid="factory-overview-breadcrumb"
                  title="Back to Use Cases overview"
                  onClick={() => setTab("overview")}
                  className="-mx-2 flex min-h-8 items-center rounded-md px-2 font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                >
                  Use Cases
                </button>
                <ChevronRight size={14} />
                <span className="font-medium text-[var(--text-muted)]">{activeFactoryLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-[26px] font-semibold tracking-normal text-[var(--text)]">Use Cases</h1>
                <Badge tone={tab === "scoring" ? "purple" : "slate"}>{activeFactoryLabel}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {tab === "scoring"
                  ? "Compare value, feasibility, reuse, data readiness, and risk before work moves forward."
                  : "Discover, evaluate, and prioritize AI opportunities across the enterprise."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                className="whitespace-nowrap"
                onClick={onImport}
              >
                <Upload size={16} />
                Import ideas
              </Button>
              <Button className="whitespace-nowrap" onClick={() => setTab("intake")}>
                <Plus size={16} />
                Add use case
              </Button>
              <Button
                variant="secondary"
                className="shrink-0 whitespace-nowrap"
                aria-label="Toggle advanced filters"
                aria-controls={advancedFiltersOpen ? advancedFiltersId : undefined}
                aria-expanded={advancedFiltersOpen}
                onClick={() => setAdvancedFiltersOpen((current) => !current)}
              >
                <SlidersHorizontal size={16} />
                Filters
                {advancedLens !== "all" ? (
                  <span className="rounded-full bg-[var(--primary-soft)] px-1.5 text-[10px] font-bold uppercase text-[var(--primary)]">1</span>
                ) : null}
              </Button>
            </div>
          </div>

          {renderFactoryTabs()}

          <div {...factoryTabPanelProps()} className="mt-4">
            {factoryNotice ? (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 flex items-center justify-between rounded-xl border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)] px-4 py-3 text-sm font-medium text-[var(--primary)]"
              >
                <span>{factoryNotice}</span>
                <button
                  type="button"
                  aria-label="Dismiss factory notice"
                  onClick={() => setFactoryNotice("")}
                  className="text-[var(--primary)] hover:text-[var(--primary-strong)]"
                >
                  <X size={16} />
                </button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FactoryMetricCard title="Total use cases" value={portfolioTotal.toString()} helper={`${departments.length || 0} departments represented`} />
              <FactoryMetricCard title="Ready for Pilot" value={readyForPilot.toString()} helper={`${portfolioTotal ? Math.round((readyForPilot / portfolioTotal) * 100) : 0}% of total`} />
              <FactoryMetricCard title="High Priority" value={highPriority.toString()} helper={avgPriority ? `Avg. score ${avgPriority}/100` : "No scored records yet"} />
              <FactoryMetricCard title="Estimated Annual Value" value={formatCurrency(estimatedAnnualValue)} helper="From current opportunities" />
            </div>

            <Panel className="mt-6 overflow-hidden">
              <div className="border-b border-[var(--border)] p-4">
                <div className="grid gap-3 lg:flex lg:items-center lg:overflow-x-auto lg:pb-1">
                  <div className="relative min-w-0 lg:w-[250px] lg:shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} />
                    <input
                      className="input h-10 pl-9"
                      placeholder="Search use cases..."
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setFactoryPageIndex(0);
                      }}
                    />
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:shrink-0 lg:items-center lg:gap-3">
                    <select
                      aria-label="Filter use cases by department"
                      className="input h-10 w-full min-w-0 lg:w-[142px] lg:shrink-0"
                      value={departmentFilter}
                      onChange={(event) => {
                        setDepartmentFilter(event.target.value);
                        setFactoryPageIndex(0);
                      }}
                    >
                      <option value="all">Department</option>
                      {departments.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter use cases by risk level"
                      className="input h-10 w-full min-w-0 lg:w-[132px] lg:shrink-0"
                      value={riskFilter}
                      onChange={(event) => {
                        setRiskFilter(event.target.value);
                        setFactoryPageIndex(0);
                      }}
                    >
                      <option value="all">Risk Level</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="restricted">Restricted</option>
                    </select>
                    <select
                      aria-label="Filter use cases by status"
                      className="input h-10 w-full min-w-0 lg:w-[126px] lg:shrink-0"
                      value={statusFilter}
                      onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setFactoryPageIndex(0);
                      }}
                    >
                      <option value="all">Status</option>
                      {Object.entries(statusLabels)
                        .filter(([status]) => useCases.some((item) => item.status === status))
                        .map(([status, label]) => (
                          <option key={status} value={status}>{label}</option>
                        ))}
                    </select>
                    <select
                      aria-label="Filter use cases by owner"
                      className="input h-10 w-full min-w-0 lg:w-[126px] lg:shrink-0"
                      value={ownerFilter}
                      onChange={(event) => {
                        setOwnerFilter(event.target.value);
                        setFactoryPageIndex(0);
                      }}
                    >
                      <option value="all">Owner</option>
                      {owners.map((ownerId) => (
                        <option key={ownerId} value={ownerId}>{getUserName(ownerId)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid min-w-0 grid-cols-[minmax(118px,auto)_minmax(0,1fr)_auto] gap-2 lg:ml-auto lg:flex lg:shrink-0 lg:items-center lg:justify-end">
                    <Button
                      variant="secondary"
                      className="h-10 justify-center whitespace-nowrap"
                      aria-controls={advancedFiltersOpen ? advancedFiltersId : undefined}
                      aria-expanded={advancedFiltersOpen}
                      onClick={() => setAdvancedFiltersOpen((current) => !current)}
                    >
                      <SlidersHorizontal size={15} />
                      More filters
                    </Button>
                    <select
                      aria-label="Sort use cases"
                      className="input h-10 w-full min-w-0 lg:w-[190px] lg:shrink-0"
                      value={sortMode}
                      onChange={(event) => {
                        setSortMode(event.target.value);
                        setFactoryPageIndex(0);
                      }}
                    >
                      <option value="priority">Sort by: Priority Score</option>
                      <option value="value">Sort by: Value</option>
                      <option value="risk">Sort by: Risk</option>
                      <option value="updated">Sort by: Updated</option>
                    </select>
                    <Button
                      variant="secondary"
                      className="h-10 w-10 px-0"
                      aria-label="Show compact table view status"
                      onClick={() => setFactoryNotice("Compact table view is active.")}
                    >
                      <FileText size={16} />
                    </Button>
                  </div>
                </div>

              {advancedFiltersOpen ? (
                <div
                  id={advancedFiltersId}
                  aria-label="Use case advanced filter lenses"
                  className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]"
                  role="region"
                >
                  <span className="font-semibold text-[var(--text-muted)]">Advanced lens:</span>
                  {advancedLensOptions.map((option) => {
                    const selected = option.id === advancedLens;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        title={option.helper}
                        onClick={() => {
                          setAdvancedLens(option.id);
                          setFactoryPageIndex(0);
                        }}
                        className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 font-semibold transition ${
                          selected
                            ? "border-[var(--primary)]/30 bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className="rounded-full bg-[var(--surface)]/78 px-1.5 text-[10px] text-[var(--text-muted)]">{advancedLensCounts[option.id]}</span>
                      </button>
                    );
                  })}
                  <span className="sr-only">Current advanced lens: {activeAdvancedLensLabel}</span>
                  <button
                    type="button"
                    className="-my-1 ml-auto inline-flex min-h-8 items-center rounded-md px-1.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    onClick={() => {
                      setQuery("");
                      setDepartmentFilter("all");
                      setRiskFilter("all");
                      setStatusFilter("all");
                      setOwnerFilter("all");
                      setAdvancedLens("all");
                      setFactoryPageIndex(0);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </div>

            {visibleRows.length ? (
            <div
              aria-label="Use case opportunity backlog horizontal scroll area"
              className="overflow-x-auto focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)]"
              data-testid="data-table-scroll"
              role="region"
              tabIndex={0}
            >
              <table aria-label="Use case opportunity backlog" className="w-full min-w-[980px] text-left text-sm">
                <caption className="sr-only">Use case opportunity backlog</caption>
                <thead className="bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="w-11 px-4 py-3">
                      <span className="block size-4 rounded border border-[var(--border-strong)]" aria-hidden="true" />
                      <span className="sr-only">Select opportunity</span>
                    </th>
                    <th scope="col" className="px-2 py-3">Use Case</th>
                    <th scope="col" className="px-4 py-3">Department</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Priority Score</th>
                    <th scope="col" className="px-4 py-3">Risk</th>
                    <th scope="col" className="px-4 py-3">Reusability</th>
                    <th scope="col" className="px-4 py-3">Owner</th>
                    <th scope="col" className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visibleRows.map((item) => {
                    const selected = selectedUseCase?.id === item.id;
                    const score = factoryPriorityScore(item);
                    return (
                      <tr key={item.id} className={selected ? "bg-[var(--primary-soft)]" : "bg-[var(--surface)] hover:bg-[var(--surface-muted)]"}>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-label={`Select ${item.title}`}
                            className={`flex size-8 items-center justify-center rounded-lg border ${
                              selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)]"
                            }`}
                            onClick={() => {
                              setSelectedUseCaseId(item.id);
                              setDetailPanelOpen(true);
                            }}
                          >
                            {selected ? <Check size={13} /> : null}
                          </button>
                        </td>
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            aria-label={`Open use case detail: ${item.title}`}
                            className="flex items-center gap-3 text-left"
                            onClick={() => {
                              setSelectedUseCaseId(item.id);
                              setDetailPanelOpen(true);
                            }}
                          >
                            <span className={`flex size-10 items-center justify-center rounded-lg ${factoryIconTone(item.department)}`}>
                              <FactoryUseCaseGlyph useCase={item} size={18} />
                            </span>
                            <span>
                              <span className="block font-semibold text-[var(--text)]">{item.title}</span>
                              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{factorySubtitle(item)}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{factoryDepartmentLabel(item.department)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={factoryStatusTone(item.status)}>{factoryStatusLabel(item.status)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[var(--text)]">{score}</span>
                            <PriorityRing value={score} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
                            <span className={`size-2 rounded-full ${item.riskLevel === "low" ? "bg-[var(--success)]" : item.riskLevel === "medium" ? "bg-[var(--warning)]" : "bg-[var(--danger)]"}`} />
                            {capitalize(item.riskLevel)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={item.reuseScore >= 5 ? "green" : item.reuseScore >= 4 ? "amber" : "red"}>
                            {item.reuseScore >= 5 ? "High" : item.reuseScore >= 4 ? "Medium" : "Low"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <OwnerAvatar ownerId={item.ownerId} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">{item.updatedAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  title={useCases.length ? "No use cases match these filters" : "No use cases in this workspace"}
                  body={
                    useCases.length
                      ? "Clear filters or adjust the search query to see more records."
                      : "Start with a real business pain point, or import a production portfolio from Settings. The OS will score, classify, and route it."
                  }
                  action={useCases.length ? "Clear filters" : "Add use case"}
                  onAction={() => {
                    if (useCases.length) {
                      setQuery("");
                      setDepartmentFilter("all");
                      setRiskFilter("all");
                      setStatusFilter("all");
                      setOwnerFilter("all");
                      setFactoryPageIndex(0);
                    } else {
                      setTab("intake");
                    }
                  }}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 text-sm text-[var(--text-muted)]">
              <span>
                {visibleRows.length ? `Showing ${visibleStart}-${visibleEnd} of ${filteredUseCases.length}` : `Showing 0 of ${filteredUseCases.length}`}
                {filteredUseCases.length !== portfolioTotal ? ` filtered from ${portfolioTotal}` : ""}
              </span>
              <div className="flex items-center gap-2">
                <span id="factory-previous-page-disabled-reason" className="sr-only">
                  {previousPageDisabledReason}
                </span>
                <Button
                  variant="secondary"
                  className="h-9 w-9 px-0"
                  onClick={() => goToFactoryPage(safeFactoryPageIndex - 1)}
                  disabled={isFirstFactoryPage}
                  aria-label="Previous page"
                  aria-describedby={isFirstFactoryPage ? "factory-previous-page-disabled-reason" : undefined}
                  title={isFirstFactoryPage ? previousPageDisabledReason : undefined}
                >
                  <ArrowLeft size={15} />
                </Button>
                {factoryPageNumbers.map((pageNumber, index) => (
                  <span key={pageNumber} className="flex items-center gap-2">
                    {index > 0 && pageNumber - factoryPageNumbers[index - 1] > 1 ? <span>...</span> : null}
                    <button
                      type="button"
                      aria-label={`Page ${pageNumber + 1}`}
                      className={`flex size-9 items-center justify-center rounded-lg font-semibold ${
                        pageNumber === safeFactoryPageIndex ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                      }`}
                      onClick={() => goToFactoryPage(pageNumber)}
                    >
                      {pageNumber + 1}
                    </button>
                  </span>
                ))}
                <Button
                  variant="secondary"
                  className="h-9 w-9 px-0"
                  onClick={() => goToFactoryPage(safeFactoryPageIndex + 1)}
                  disabled={isLastFactoryPage}
                  aria-label="Next page"
                  aria-describedby={isLastFactoryPage ? "factory-next-page-disabled-reason" : undefined}
                  title={isLastFactoryPage ? nextPageDisabledReason : undefined}
                >
                  <ChevronRight size={15} />
                </Button>
                <span id="factory-next-page-disabled-reason" className="sr-only">
                  {nextPageDisabledReason}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  className="input h-9 w-20"
                  value={factoryRowsPerPage}
                  onChange={(event) => {
                    setFactoryRowsPerPage(Number(event.target.value));
                    setFactoryPageIndex(0);
                  }}
                >
                  <option value={7}>7</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            </Panel>
          </div>
        </div>

        {detailPanelOpen && selectedUseCase ? (
          <UseCaseBacklogDetail
            useCase={selectedUseCase}
            intelligence={selectedUseCaseIntelligence ?? deriveUseCaseIntelligence(selectedUseCase)}
            activeTab={detailTab}
            onTabChange={setDetailTab}
            onClose={() => setDetailPanelOpen(false)}
            onGeneratePilotBrief={() => setTab("pilot")}
            onConvert={() => onConvert(selectedUseCase)}
            onGovernance={() => onGovernance(selectedUseCase)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Use Cases"
        subtitle="Capture, structure, score, and route AI opportunities"
        action={
          <Button onClick={() => setTab("intake")}>
            <Plus size={16} />
            New use case
          </Button>
        }
      />
      {renderFactoryTabs()}

      <div {...factoryTabPanelProps()}>
        {tab === "intake" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="p-6">
            <Stepper
              steps={["Problem", "Solution", "Data & Risk", "Value", "Review"]}
              current={intakeStep}
            />
            {factoryNotice ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-5 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] px-4 py-3 text-sm leading-5 text-[var(--warning)]"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                <span>{factoryNotice}</span>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)]/55 p-4 shadow-sm shadow-[color-mix(in_srgb,var(--primary)_16%,transparent)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--primary)] shadow-sm">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <div className="font-semibold text-[var(--text)]">One-minute use case creator</div>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                      Start with a messy business ask, not perfect AI language. The OS turns it into a scored opportunity with risk, sources, value, and the next governed step.
                    </p>
                  </div>
                </div>
                <Badge tone={intakeCurrentMissing.length ? "amber" : "green"}>
                  {intakeCurrentMissing.length ? `${intakeCurrentMissing.length} fields needed` : "step complete"}
                </Badge>
              </div>
              <details className="group mt-4 rounded-xl border border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-[var(--surface)]/72">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                  <span>Show score preview</span>
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    {intakeReadiness}% ready
                    <ChevronRight size={14} className="transition group-open:rotate-90" />
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] p-3 sm:grid-cols-2 xl:grid-cols-6">
                  <MiniMetric label="Readiness" value={`${intakeReadiness}%`} />
                  <MiniMetric label="Pattern" value={intakePattern} />
                  <MiniMetric label="Score preview" value={intakeAllMissing.length ? "pending" : `${intakePriorityPreview}/100`} />
                  <MiniMetric label="Annual value" value={intakeAnnualValue ? formatCurrency(intakeAnnualValue) : "pending"} />
                  <MiniMetric label="Autonomy" value={autonomyLabels[intakeIntelligence.autonomyTier]} />
                  <MiniMetric label="Intake completeness" value={`${intakeIntelligence.confidenceScore}%`} />
                </div>
              </details>
            </div>

            <div className="mt-8">
              {intakeStep === 0 ? (
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm shadow-slate-200/40" data-testid="use-case-intake-quickstart">
                    <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                            <Sparkles size={16} className="text-[var(--primary)]" />
                            Start from a rough request
                          </div>
                          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                            Paste a stakeholder note, meeting comment, or recurring pain point. The assistant drafts the fields; you correct the business truth.
                          </p>
                        </div>
                        <Badge tone={messyIdea.trim() ? "blue" : "amber"}>
                          {messyIdea.trim() ? "ready to draft" : "paste or pick one"}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-px bg-[var(--border)]/70 lg:grid-cols-3">
                      {messyIdeaExamples.map((example, index) => (
                        <button
                          key={example.label}
                          type="button"
                          aria-label={`Draft use case example: ${example.label}`}
                          data-testid={`use-case-example-${index + 1}`}
                          className="group bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--primary-soft)]/55"
                          onClick={() => void draftFromExample(example)}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span>
                              <span className="block text-sm font-semibold text-[var(--text)]">{example.label}</span>
                              <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{example.department}</span>
                            </span>
                            <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition group-hover:bg-[var(--surface)] group-hover:text-[var(--primary)]">
                              Draft
                            </span>
                          </span>
                          <span className="mt-3 line-clamp-3 block text-xs leading-5 text-[var(--text-muted)]">{example.text}</span>
                        </button>
                      ))}
                    </div>
                    <div className="p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Or paste your own</div>
                        <Badge tone="slate">manual draft</Badge>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <textarea
                          className="input min-h-[92px]"
                          value={messyIdea}
                          placeholder="Example: Legal spends hours triaging the same contract questions, and reviewers want AI to summarize the request, cite policy, and route risky cases."
                          onChange={(event) => setMessyIdea(event.target.value)}
                        />
                        <Button className="self-end whitespace-nowrap" onClick={() => void structureMessyIdea()} data-testid="structure-use-case-idea">
                          <Sparkles size={16} />
                          Draft intake
                        </Button>
                      </div>
                      <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                        Drafting does not submit anything. It only creates a first-pass opportunity you can inspect before scoring.
                      </div>
                    </div>
                  </div>
                  <Field label="Use Case Title">
                    <input
                      className="input"
                      placeholder="Benefits Knowledge Assistant"
                      value={intake.title}
                      onChange={(event) => setIntake((current) => ({ ...current, title: event.target.value }))}
                    />
                  </Field>
                  <Field label="Business Problem">
                    <textarea
                      className="input min-h-[96px]"
                      placeholder="Employees ask repeated benefits questions across email and tickets. HR spends too much time searching policy pages, and answers are inconsistent."
                      value={intake.businessProblem}
                      onChange={(event) => setIntake((current) => ({ ...current, businessProblem: event.target.value }))}
                    />
                  </Field>
                  <Field label="Current Process">
                    <textarea
                      className="input min-h-[96px]"
                      placeholder="Employees email HR or open a People Ops ticket. HR checks approved policy sources, handles edge cases manually, and replies in 2-4 business days."
                      value={intake.currentProcess}
                      onChange={(event) => setIntake((current) => ({ ...current, currentProcess: event.target.value }))}
                    />
                  </Field>
                  <Field label="Which function is this for?">
                    <select
                      className="input"
                      value={intake.department}
                      onChange={(event) => setIntake((current) => ({ ...current, department: event.target.value as Department }))}
                    >
                      {["HR", "Finance", "Legal", "Procurement", "IT", "Marketing", "Operations", "Security", "Compliance", "Data", "Other"].map((department) => (
                        <option key={department}>{department}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}

              {intakeStep === 1 ? (
                <div className="grid gap-4">
                  <Field label="Desired Outcome">
                    <textarea
                      className="input min-h-[96px]"
                      placeholder="Employees get fast, cited answers from approved sources, while ambiguous or sensitive cases route to HR."
                      value={intake.desiredOutcome}
                      onChange={(event) => setIntake((current) => ({ ...current, desiredOutcome: event.target.value }))}
                    />
                  </Field>
                  <Field label="What should AI help with?">
                    <textarea
                      className="input min-h-[88px]"
                      placeholder="Answer routine questions, cite sources, summarize eligibility rules, and draft escalation notes when confidence is low."
                      value={intake.aiHelp}
                      onChange={(event) => setIntake((current) => ({ ...current, aiHelp: event.target.value }))}
                    />
                  </Field>
                  <Field label="What should AI not do?">
                    <textarea
                      className="input min-h-[88px]"
                      placeholder="Approve benefits, change employee records, give legal or medical advice, or send messages without review."
                      value={intake.aiNotDo}
                      onChange={(event) => setIntake((current) => ({ ...current, aiNotDo: event.target.value }))}
                    />
                  </Field>
                </div>
              ) : null}

              {intakeStep === 2 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Data Sources">
                    <textarea
                      className="input min-h-[96px]"
                      placeholder="Benefits Guide 2026, HR Policy Manual, People Ops SOP"
                      value={intake.dataSources}
                      onChange={(event) => setIntake((current) => ({ ...current, dataSources: event.target.value }))}
                    />
                  </Field>
                  <Field label="Data Sensitivity">
                    <select
                      className="input"
                      value={intake.dataSensitivity}
                      onChange={(event) => setIntake((current) => ({ ...current, dataSensitivity: event.target.value as RiskLevel }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </Field>
                  <CheckRow
                    checked={intake.humanReview}
                    label="Human review is required"
                    onChange={() => setIntake((current) => ({ ...current, humanReview: !current.humanReview }))}
                  />
                  <CheckRow
                    checked={intake.externalCommunication}
                    label="External communication is involved"
                    onChange={() => setIntake((current) => ({ ...current, externalCommunication: !current.externalCommunication }))}
                  />
                </div>
              ) : null}

              {intakeStep === 3 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Monthly Volume">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={intake.monthlyVolume}
                      onChange={(event) => setIntake((current) => ({ ...current, monthlyVolume: Number(event.target.value) }))}
                    />
                  </Field>
                  <Field label="Avg Handling Time">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={intake.avgHandlingTimeMinutes}
                      onChange={(event) => setIntake((current) => ({ ...current, avgHandlingTimeMinutes: Number(event.target.value) }))}
                    />
                  </Field>
                  <Field label="Estimated Users">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={intake.estimatedUsers}
                      onChange={(event) => setIntake((current) => ({ ...current, estimatedUsers: Number(event.target.value) }))}
                    />
                  </Field>
                  <Panel className="p-4 md:col-span-3">
                    <div className="grid gap-4 md:grid-cols-3">
                      <MiniMetric
                        label="Monthly hours saved"
                        value={Math.round((intake.monthlyVolume * intake.avgHandlingTimeMinutes) / 60).toLocaleString()}
                      />
                      <MiniMetric
                        label="Expected monthly value"
                        value={formatCurrency((intake.monthlyVolume * intake.avgHandlingTimeMinutes * 68) / 60)}
                      />
                      <MiniMetric
                        label="Annualized value"
                        value={formatCurrency(((intake.monthlyVolume * intake.avgHandlingTimeMinutes * 68) / 60) * 12)}
                      />
                    </div>
                  </Panel>
                </div>
              ) : null}

              {intakeStep === 4 ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <Panel className="p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Generated brief</div>
                      <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">{intake.title || "Untitled opportunity"}</h3>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{generatedSummary}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <TextBlock title="Business problem" body={intake.businessProblem || "Add a business problem before submitting."} />
                        <TextBlock title="AI boundary" body={intake.aiNotDo || "Add what AI must not decide or execute."} />
                      </div>
                    </Panel>
                    <Panel className="p-5">
                      <SectionTitle title="Governance routing" helper="Rule-based from data sensitivity, decision boundary, and tool intent" />
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Required reviews</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {intakeReviews.map((review) => (
                              <Badge key={review} tone="blue">{review}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Likely risk categories (rule-based)</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {intakeRiskDrivers.map((risk) => (
                              <Badge key={risk} tone={risk === "External communication" ? "amber" : "slate"}>{risk}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Context sources</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                            {intakeSources.length ? intakeSources.join(", ") : "Add at least one approved source."}
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <ReadinessTile label="Priority Preview" value={intakeAllMissing.length ? "Pending" : `${intakePriorityPreview}/100`} tone={intakePriorityPreview >= 75 ? "green" : "amber"} />
                    <ReadinessTile label="Initial Risk" value={intake.dataSensitivity} tone={riskTone(intake.dataSensitivity)} />
                    <ReadinessTile label="Recommended Pattern" value={intakePattern} tone="blue" />
                    <ReadinessTile label="Next Step" value={intakeIntelligence.nextBestAction.title} tone={intakeAllMissing.length ? "amber" : "green"} />
                  </div>
                  <Panel className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--text)]">Submission creates the first factory artifact</div>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                          The opportunity will be scored, added to the backlog, linked to an audit record, and ready to convert into a governed Skill package.
                        </p>
                      </div>
                      <Badge tone={intakeAllMissing.length ? "amber" : "green"}>
                        {intakeAllMissing.length ? `${intakeAllMissing.length} fields remaining` : "ready to submit"}
                      </Badge>
                    </div>
                  </Panel>
                </div>
              ) : null}
            </div>

            <div className={intakeStep === 4
              ? "sticky bottom-4 z-10 mt-8 flex justify-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 shadow-lg shadow-slate-200/40 backdrop-blur"
              : "mt-8 flex justify-end gap-2 border-t border-[var(--border)] pt-5"}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setFactoryNotice("");
                  setIntakeStep(Math.max(0, intakeStep - 1));
                }}
              >
                Back
              </Button>
              {intakeStep < 4 ? (
                <Button onClick={advanceIntakeStep}>Next</Button>
              ) : (
                <Button onClick={submitIntakeFromFactory}>
                  <Sparkles size={16} />
                  Submit & Score
                </Button>
              )}
            </div>
          </Panel>

          <Panel className="p-5 xl:sticky xl:top-24 xl:self-start">
            <SectionTitle title="What to do now" helper={guidance.title} />
            <div className="mt-4 space-y-2">
              {intakeChecklist.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-2">
                  <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    intakeCurrentMissing.length ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]"
                  }`}>
                    {index + 1}
                  </span>
                  <span className="text-sm leading-5 text-[var(--text-muted)]">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{guidance.body}</p>
            <div className="mt-5 rounded-xl bg-[var(--surface-muted)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">This step produces</div>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-muted)]">{guidance.output}</p>
            </div>
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text)]">Live quality checks</div>
                <Badge tone={intakeReadiness >= 75 ? "green" : intakeReadiness >= 45 ? "amber" : "red"}>{intakeReadiness}%</Badge>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Problem framed", !intakeStepMissing(intake, 0).length],
                  ["AI boundary clear", !intakeStepMissing(intake, 1).length],
                  ["Sources identified", intakeSources.length > 0],
                  ["Value baseline ready", !intakeStepMissing(intake, 3).length],
                ].map(([label, checked]) => (
                  <div key={String(label)} className="flex items-center gap-3 text-[var(--text-muted)]">
                    <span className={`flex size-5 items-center justify-center rounded-full ${checked ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-subtle)] text-[var(--text-soft)]"}`}>
                      <Check size={13} />
                    </span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="text-sm font-semibold text-[var(--text)]">AI-inferred routing</div>
              <div className="mt-3 grid gap-3">
                <MiniMetric label="Pattern" value={intakePattern} />
                <MiniMetric label="Risk drivers" value={intakeRiskDrivers.length.toString()} />
                <MiniMetric label="Reviewers" value={intakeReviews.join(", ")} />
              </div>
            </div>
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text)]">Recommended move</div>
                <Badge tone={intakeIntelligence.missingEvidence.length ? "amber" : "green"}>
                  {intakeIntelligence.dataReadinessLabel}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{intakeIntelligence.nextBestAction.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {intakeIntelligence.missingEvidence.slice(0, 4).map((item) => (
                  <Badge key={item} tone="amber">{item}</Badge>
                ))}
                {!intakeIntelligence.missingEvidence.length ? <Badge tone="green">Ready to submit</Badge> : null}
              </div>
            </div>
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="text-sm font-semibold text-[var(--text)]">Discovery questions</div>
              <div className="mt-3 space-y-2">
                {intakeIntelligence.discoveryQuestions.slice(0, 3).map((question) => (
                  <div key={question} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                    {question}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          </div>
        ) : null}

        {tab === "backlog" || tab === "scoring" ? (
          <div className="mt-4 space-y-4">
          <Panel className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} />
                <input
                  className="input pl-9"
                  placeholder="Search title, function, or description..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {Object.entries(statusLabels)
                  .filter(([status]) => useCases.some((item) => item.status === status))
                  .map(([status, label]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
              </select>
              <select className="input" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                <option value="all">All risk</option>
                <option value="low">Low risk</option>
                <option value="medium">Medium risk</option>
                <option value="high">High risk</option>
                <option value="restricted">Restricted</option>
              </select>
              <select className="input" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option value="priority">Sort by priority</option>
                <option value="value">Sort by value</option>
                <option value="risk">Sort by risk</option>
                <option value="updated">Sort by updated</option>
              </select>
            </div>
            <div className="mt-3 text-sm text-[var(--text-muted)]">
              Showing {filteredUseCases.length} of {useCases.length} AI opportunities.
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            {filteredUseCases.length > 0 ? (
              <DataTable
                caption="Use case opportunity backlog"
                columns={["Title", "Department", "Status", "Risk", "Value", "Feasibility", "Reuse", "Owner", "Priority"]}
                rows={filteredUseCases.map((item) => [
                  <button type="button"
                    key="title"
                    className="text-left font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                    onClick={() => {
                      setSelectedUseCaseId(item.id);
                      setTab("detail");
                    }}
                  >
                    {item.title}
                  </button>,
                  item.department,
                  <Badge key="status" tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge>,
                  <Badge key="risk" tone={riskTone(item.riskLevel)}>{item.riskLevel}</Badge>,
                  item.valueScore,
                  item.feasibilityScore,
                  item.reuseScore,
                  getUserName(item.ownerId),
                  <span key="priority" className="font-semibold">{item.priorityScore}/100</span>,
                ])}
              />
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Search size={22} />
                </div>
                <div className="mt-4 text-lg font-semibold">No matching AI opportunities</div>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                  Adjust filters or start a new intake. The factory will score, classify, and route it for review.
                </p>
                <Button className="mt-5" onClick={() => setTab("intake")}>Create use case</Button>
              </div>
            )}
          </Panel>
          </div>
        ) : null}

        {tab === "detail" || tab === "pilot" || tab === "value" ? (
          selectedUseCase ? (
            <UseCaseDetail mode={tab as "detail" | "pilot" | "value"} useCase={selectedUseCase} onConvert={onConvert} onGovernance={onGovernance} />
          ) : (
            <Panel className="mt-4 overflow-hidden" data-testid="use-case-empty-artifact">
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">No selection</Badge>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      {activeFactoryLabel} needs an opportunity record
                    </span>
                  </div>
                  <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                    {selectedArtifactCopy.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">{selectedArtifactCopy.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={emptyArtifactPrimaryAction}>
                      <ChevronRight size={15} />
                      {emptyArtifactPrimaryLabel}
                    </Button>
                    <Button variant="secondary" onClick={() => setTab("intake")}>
                      <Plus size={15} />
                      New use case
                    </Button>
                    <Button variant="secondary" onClick={onImport}>
                      <Upload size={15} />
                      Import ideas
                    </Button>
                  </div>

                  <div className="mt-7 grid gap-3 md:grid-cols-3">
                    {emptyArtifactSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      return (
                        <div key={step.label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-4">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                              <StepIcon size={16} />
                            </span>
                            <div className="text-sm font-semibold text-[var(--text)]">{index + 1}. {step.label}</div>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{step.body}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <aside className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
                  <SectionTitle title="What appears here" helper="The artifact is generated from a selected opportunity" compact />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MiniMetric label="Opportunities" value={String(useCases.length)} />
                    <MiniMetric label="Ready for pilot" value={String(readyForPilot)} />
                    <MiniMetric label="High priority" value={String(highPriority)} />
                    <MiniMetric label="Avg score" value={portfolioTotal ? `${avgPriority}/100` : "-"} />
                  </div>
                  <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-4">
                    <div className="text-sm font-semibold text-[var(--text)]">Professional recovery path</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      Direct links to Brief, Pilot, or Value stay useful even when no record is selected. The workspace now routes the user to the right source of truth instead of showing a thin placeholder.
                    </p>
                  </div>
                  <Button className="mt-4 w-full" variant="secondary" onClick={emptyArtifactPrimaryAction}>
                    <ArrowRight size={15} />
                    {emptyArtifactPrimaryLabel}
                  </Button>
                </aside>
              </div>
            </Panel>
          )
        ) : null}
      </div>
    </div>
  );
}

function UseCaseBacklogDetail({
  useCase,
  intelligence,
  activeTab,
  onTabChange,
  onClose,
  onGeneratePilotBrief,
  onConvert,
  onGovernance,
}: {
  useCase: UseCase;
  intelligence: UseCaseIntelligence;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  onGeneratePilotBrief: () => void;
  onConvert: () => void;
  onGovernance: () => void;
}) {
  const score = factoryPriorityScore(useCase);
  const annualValue = opportunityAnnualValue(useCase);
  const fte = opportunityFteImpact(useCase);
  const impacts = opportunityImpactBullets(useCase);
  const detailTabs: [string, string][] = [
    ["overview", "Overview"],
    ["analysis", "Analysis"],
    ["stakeholders", "Stakeholders"],
    ["history", "History"],
  ];

  return (
    <aside className="mt-4 min-w-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-4 xl:mt-0 xl:border-l xl:border-t-0 sm:px-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--text)]">{useCase.title}</div>
        <button
          type="button"
          aria-label={`Close ${useCase.title} detail`}
          className="flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-6 flex items-start gap-4">
        <div className={`flex size-12 items-center justify-center rounded-xl ${factoryIconTone(useCase.department)}`}>
          <FactoryUseCaseGlyph useCase={useCase} size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-[var(--text)]">{useCase.title}</h2>
            <Badge tone={factoryStatusTone(useCase.status)}>{factoryStatusLabel(useCase.status)}</Badge>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{useCase.department}</span>
            <span>•</span>
            <span>{factorySubtitle(useCase)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold text-[var(--text-muted)]">Priority Score</div>
        <div className="mt-2 flex items-end gap-3">
          <div className="text-3xl font-semibold">{score}</div>
          <div className="pb-1 text-sm text-[var(--text-muted)]">/100</div>
          <Badge tone={score >= 75 ? "green" : score >= 55 ? "amber" : "slate"}>{score >= 75 ? "High priority" : score >= 55 ? "Medium priority" : "Needs discovery"}</Badge>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${score}%` }} />
        </div>
        <button
          type="button"
          className="mt-3 inline-flex min-h-8 items-center rounded-md px-1.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
          onClick={() => onTabChange("analysis")}
        >
          Why this score?
        </button>
      </div>

      <div className="mt-4" data-testid="use-case-detail-tabs">
        <Tabs
          tabs={detailTabs}
          active={activeTab}
          onChange={onTabChange}
          ariaLabel="Use case detail sections"
          idBase="use-case-detail"
          panelId={(id) => `use-case-detail-panel-${id}`}
        />
      </div>

      <Panel
        id={`use-case-detail-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`use-case-detail-${activeTab}-tab`}
        className="mt-4 p-4"
        data-testid={`use-case-detail-panel-${activeTab}`}
      >
        {activeTab === "overview" ? (
          <div>
            <div className="text-sm font-semibold">Business Problem</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{useCase.businessProblem}</p>
            <div className="mt-4 text-sm font-semibold">Potential Impact</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-[var(--text-muted)]">
              {impacts.map((impact) => (
                <li key={impact}>{impact}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {activeTab === "analysis" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)]/45 p-3">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)]">
                  <Sparkles size={15} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">{intelligence.recommendedPattern}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{intelligence.patternReason}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniMetric label="Autonomy" value={autonomyLabels[intelligence.autonomyTier]} />
                <MiniMetric label="Intake completeness" value={`${intelligence.confidenceScore}%`} />
              </div>
            </div>
            {[
              ["Value", useCase.valueScore],
              ["Feasibility", useCase.feasibilityScore],
              ["Reuse", useCase.reuseScore],
              ["Data readiness", useCase.dataReadinessScore],
            ].map(([label, value]) => (
              <ScoreBar key={String(label)} label={String(label)} value={Number(value)} />
            ))}
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Next best action</div>
              <div className="mt-2 text-sm font-semibold text-[var(--text)]">{intelligence.nextBestAction.title}</div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{intelligence.nextBestAction.body}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Evidence gaps</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.missingEvidence.length ? intelligence.missingEvidence.slice(0, 5).map((item) => (
                  <Badge key={item} tone="amber">{item}</Badge>
                )) : <Badge tone="green">No critical gaps</Badge>}
              </div>
            </div>
          </div>
        ) : null}
        {activeTab === "stakeholders" ? (
          <div className="space-y-3">
            <StakeholderRow label="Owner" value={getUserName(useCase.ownerId)} />
            <StakeholderRow label="Requestor" value={getUserName(useCase.requestorId)} />
            <StakeholderRow label="Function" value={factoryDepartmentLabel(useCase.department)} />
            <StakeholderRow label="Reviewers" value={intelligence.requiredReviews.join(" / ")} />
          </div>
        ) : null}
        {activeTab === "history" ? (
          <div className="space-y-3 text-sm">
            <TimelineLine label="Opportunity captured" value={useCase.createdAt} />
            <TimelineLine label="Scored by factory" value={useCase.updatedAt} />
            <TimelineLine label="Pilot readiness checked" value="May 28, 2026" />
          </div>
        ) : null}
      </Panel>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Panel className="p-4">
          <div className="text-sm font-semibold">Recommended AI Pattern</div>
          <div className="mt-3 flex gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--info-soft)] text-[var(--info)]">
              <Database size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">{intelligence.recommendedPattern}</div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                {intelligence.patternReason}
              </p>
              <p className="mt-1.5 text-[11px] leading-4 text-[var(--text-soft)]">
                Rule-based default from data sensitivity and decision boundary — a starting point to confirm, not a model decision.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 inline-flex min-h-8 items-center rounded-md px-1.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
            onClick={() => onTabChange("analysis")}
          >
            View details
          </button>
        </Panel>
        <Panel className="p-4">
          <div className="text-sm font-semibold">Estimated Annual Value</div>
          <div className="mt-4 text-2xl font-semibold">{formatCurrency(annualValue)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Cost savings</div>
          <div className="mt-4 text-2xl font-semibold">{fte.toFixed(1)} FTE</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Capacity impact</div>
        </Panel>
        <Panel className="p-4">
          <div className="text-sm font-semibold">Risk Level</div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${useCase.riskLevel === "low" ? "bg-[var(--success)]" : useCase.riskLevel === "medium" ? "bg-[var(--warning)]" : "bg-[var(--danger)]"}`} />
            <span className="font-medium">{capitalize(useCase.riskLevel)}</span>
            <span className="text-[var(--text-muted)]">with mitigations</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
            Key risks: {(useCase.risks.length ? useCase.risks : intelligence.riskCategories).slice(0, 3).join(", ")}.
          </p>
        </Panel>
        <Panel className="p-4">
          <div className="text-sm font-semibold">Reusability</div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="size-2 rounded-full bg-[var(--success)]" />
            <span className="font-medium">{useCase.reuseScore >= 5 ? "High" : "Medium"}</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
            {useCase.reuseScore >= 4
              ? `Strong candidate for a reusable ${intelligence.recommendedPattern.toLowerCase()} pattern.`
              : "Likely needs more discovery before it becomes a reusable enterprise template."}
          </p>
        </Panel>
      </div>

      <SkillConversionGuide
        className="mt-4"
        useCase={useCase}
        intelligence={intelligence}
        onConvert={onConvert}
        onGovernance={onGovernance}
        onPilotBrief={onGeneratePilotBrief}
      />
    </aside>
  );
}

function SkillConversionGuide({
  useCase,
  intelligence,
  onConvert,
  onGovernance,
  onPilotBrief,
  pilotBriefLoading = false,
  className = "",
}: {
  useCase: UseCase;
  intelligence: UseCaseIntelligence;
  onConvert: () => void;
  onGovernance: () => void;
  onPilotBrief?: () => void;
  pilotBriefLoading?: boolean;
  className?: string;
}) {
  const skillAlreadyExists = Boolean(useCase.linkedSkillId);
  const conversionChecks = [
    {
      label: "Problem and outcome",
      ready: Boolean(useCase.businessProblem.trim() && useCase.desiredOutcome.trim()),
      helper: "The Skill knows what business pain it serves.",
    },
    {
      label: "Approved sources",
      ready: useCase.dataSources.length > 0,
      helper: "Context can be grounded in named systems or documents.",
    },
    {
      label: "Risk route",
      ready: useCase.risks.length > 0 || intelligence.requiredReviews.length > 0,
      helper: "Reviewers and guardrails are visible before build.",
    },
    {
      label: "Value baseline",
      ready: useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0,
      helper: "Impact can be checked after pilot runs.",
    },
  ];
  const readyCount = conversionChecks.filter((check) => check.ready).length;

  return (
    <Panel className={`p-4 ${className}`} data-testid="skill-conversion-guide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <Sparkles size={16} className="text-[var(--primary)]" />
            Build this as an AI Skill
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
            A Skill is the governed package: prompt, model route, allowed tools, approved context, tests, owner, and value tracking.
          </p>
        </div>
        <Badge tone={readyCount >= 3 ? "green" : "amber"}>{readyCount}/{conversionChecks.length} ready</Badge>
      </div>

      <div className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Recommended move</div>
        <div className="mt-2 text-sm font-semibold text-[var(--text)]">{intelligence.nextBestAction.title}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{intelligence.nextBestAction.body}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {conversionChecks.map((check) => (
          <div key={check.label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                check.ready ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"
              }`}>
                {check.ready ? <Check size={13} /> : <AlertTriangle size={13} />}
              </span>
              {check.label}
            </div>
            <p className="mt-1 pl-7 text-xs leading-5 text-[var(--text-muted)]">{check.helper}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <Button onClick={onConvert}>
          <Sparkles size={16} />
          {skillAlreadyExists ? "Open linked Skill" : "Create Skill package"}
        </Button>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" className="h-auto min-h-9 whitespace-normal border-[#c7d2fe] px-2 py-2 text-center leading-snug text-[var(--primary)]" onClick={onGovernance}>
            <ShieldCheck size={16} />
            Route risk review
          </Button>
          {onPilotBrief ? (
            <Button
              variant="secondary"
              className="h-auto min-h-9 whitespace-normal border-[#c7d2fe] px-2 py-2 text-center leading-snug text-[var(--primary)]"
              onClick={onPilotBrief}
              disabled={pilotBriefLoading}
            >
              <FileCheck2 size={16} />
              {pilotBriefLoading ? "Generating..." : "Draft pilot brief"}
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function UseCaseDetail({
  mode,
  useCase,
  onConvert,
  onGovernance,
}: {
  mode: "detail" | "pilot" | "value";
  useCase: UseCase;
  onConvert: (useCase: UseCase) => void;
  onGovernance: (useCase: UseCase) => void;
}) {
  const [pilotBrief, setPilotBrief] = useState("");
  const [pilotBriefLoading, setPilotBriefLoading] = useState(false);
  const [pilotBriefError, setPilotBriefError] = useState("");
  const [pilotBriefMeta, setPilotBriefMeta] = useState<{
    mode: "ai_assisted" | "deterministic_fallback";
    generatedAt: string;
    provider: string;
    modelRef: string;
    routeReason: string;
    localFallback: boolean;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  } | null>(null);
  const intelligence = useMemo(() => deriveUseCaseIntelligence(useCase), [useCase]);
  const monthlyHours = Math.round((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60);
  const annualValue = monthlyHours * 68 * 12;
  const modeCopy = {
    detail: {
      eyebrow: "Discovery Brief",
      title: `${useCase.title} Discovery Brief`,
      helper: "Structured problem, process, outcome, risk, scoring, sources, and stakeholder evidence.",
    },
    pilot: {
      eyebrow: "Pilot Plan",
      title: `${useCase.title} Pilot Plan`,
      helper: "Scope the pilot, define human oversight, launch controls, success metrics, and governance evidence.",
    },
    value: {
      eyebrow: "Value Estimate",
      title: `${useCase.title} Value Estimate`,
      helper: "Translate volume, effort, adoption, and confidence assumptions into executive-ready ROI ranges.",
    },
  }[mode];
  const conservativeValue = Math.round(annualValue * 0.55);
  const expectedValue = Math.round(annualValue * 0.8);
  const optimisticValue = Math.round(annualValue * 1.15);
  const estimatedFte = opportunityFteImpact(useCase);

  async function generatePilotBrief() {
    setPilotBriefLoading(true);
    setPilotBriefError("");

    try {
      const response = await fetch("/api/use-cases/pilot-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useCaseId: useCase.id }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Pilot brief generation failed.");
      }

      if (typeof payload.brief !== "string" || !payload.brief.trim()) {
        throw new Error("The pilot brief generator returned an empty brief.");
      }

      setPilotBrief(payload.brief);
      setPilotBriefMeta({
        mode: payload.mode === "ai_assisted" ? "ai_assisted" : "deterministic_fallback",
        generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : new Date().toISOString(),
        provider: typeof payload.model?.provider === "string" ? payload.model.provider : "local",
        modelRef: typeof payload.model?.modelRef === "string" ? payload.model.modelRef : "local/local-enterprise-reasoner",
        routeReason: typeof payload.model?.routeReason === "string" ? payload.model.routeReason : "No route metadata returned.",
        localFallback: Boolean(payload.model?.localFallback),
        inputTokens: Number(payload.model?.inputTokens ?? 0),
        outputTokens: Number(payload.model?.outputTokens ?? 0),
        latencyMs: Number(payload.model?.latencyMs ?? 0),
      });
    } catch (error) {
      setPilotBriefError(error instanceof Error ? error.message : "Pilot brief generation failed.");
    } finally {
      setPilotBriefLoading(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
      <Panel className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone={mode === "pilot" ? "blue" : mode === "value" ? "green" : "purple"}>{modeCopy.eyebrow}</Badge>
            <h2 className="mt-3 text-xl font-semibold">{modeCopy.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{modeCopy.helper}</p>
          </div>
          <Badge tone={statusTone(useCase.status)}>{statusLabels[useCase.status]}</Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MiniMetric label="Priority" value={`${useCase.priorityScore}/100`} />
          <MiniMetric label="Risk" value={useCase.riskLevel} />
          <MiniMetric label="Monthly volume" value={useCase.monthlyVolume.toLocaleString()} />
          <MiniMetric label="Annual value" value={formatCurrency(annualValue)} />
        </div>

        <div className="mt-6 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)]/45 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Sparkles size={16} className="text-[var(--primary)]" />
                Rule-based recommendation
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                {intelligence.patternReason}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={confidenceTone(intelligence.confidenceScore)}>{intelligence.confidenceScore}% intake completeness</Badge>
              <Badge tone="blue">{intelligence.recommendedPattern}</Badge>
              <Badge tone="slate">{intelligence.dataReadinessLabel} data</Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MiniMetric label="Autonomy default (rule-based)" value={autonomyLabels[intelligence.autonomyTier]} />
            <MiniMetric label="Required reviews" value={intelligence.requiredReviews.join(", ")} />
            <MiniMetric label="Value confidence" value={intelligence.valueConfidence} />
          </div>
        </div>

        {mode === "detail" ? (
          <>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <TextBlock title="Business Problem" body={useCase.businessProblem} />
              <TextBlock title="Current Process" body={useCase.currentProcess} />
              <TextBlock title="Desired Outcome" body={useCase.desiredOutcome} />
              <TextBlock title="Proposed Capability" body={useCase.capabilityType.replace(/_/g, " ")} />
            </div>

            <div className="mt-6">
              <SectionTitle title="Discovery Evidence" helper="The brief makes vague demand inspectable before any Skill is created." />
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <ScoreBar label="Value" value={useCase.valueScore} />
                <ScoreBar label="Feasibility" value={useCase.feasibilityScore} />
                <ScoreBar label="Reuse" value={useCase.reuseScore} />
                <ScoreBar label="Urgency" value={useCase.urgencyScore} />
                <ScoreBar label="Data Readiness" value={useCase.dataReadinessScore} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Panel className="p-4">
                <SectionTitle title="Discovery Questions" helper="Use these in stakeholder interviews before converting the opportunity to a Skill." compact />
                <div className="mt-4 space-y-3">
                  {intelligence.discoveryQuestions.map((question, index) => (
                    <div key={question} className="flex gap-3 text-sm leading-6 text-[var(--text-muted)]">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">{index + 1}</span>
                      <span>{question}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel className="p-4">
                <SectionTitle title="Evidence To Close" helper="Each item should become an approval, trace, assumption owner, or source record." compact />
                <div className="mt-4 flex flex-wrap gap-2">
                  {intelligence.missingEvidence.length ? intelligence.missingEvidence.map((item) => (
                    <Badge key={item} tone="amber">{item}</Badge>
                  )) : <Badge tone="green">Ready for governance packet</Badge>}
                </div>
              </Panel>
            </div>
          </>
        ) : null}

        {mode === "pilot" ? (
          <div className="mt-6 space-y-5">
            <SectionTitle title="Pilot Operating Plan" helper="A production pilot should prove value, safety, adoption, and repeatability before scale." />
            <div className="grid gap-4 md:grid-cols-2">
              <TextBlock title="Pilot Objective" body={`Validate whether ${useCase.title} can improve ${factoryDepartmentLabel(useCase.department)} work while preserving human oversight, policy boundaries, and measurable evidence.`} />
              <TextBlock title="Pilot Group" body={`${Math.min(useCase.estimatedUsers, 250).toLocaleString()} users or stakeholders, prioritized by volume, process clarity, and data readiness.`} />
              <TextBlock title="Success Metrics" body={intelligence.successMetrics.join(" ")} />
              <TextBlock title="Guardrails" body={intelligence.pilotGuardrails.join(" ")} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel className="p-4">
                <SectionTitle title="Pilot Guardrail Checklist" helper="Controls that should be visible in the Skill, Harness, and governance packet." compact />
                <div className="mt-4 space-y-3">
                  {intelligence.pilotGuardrails.map((guardrail) => (
                    <div key={guardrail} className="flex items-start gap-3 text-sm leading-6 text-[var(--text-muted)]">
                      <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                        <Check size={13} />
                      </span>
                      <span>{guardrail}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel className="p-4">
                <SectionTitle title="Launch Evidence Owners" helper="Who should produce the proof before pilot expansion." compact />
                <div className="mt-4 space-y-2">
                  {intelligence.readinessItems.map((item) => (
                    <div key={item.label} className="rounded-xl bg-[var(--surface-muted)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[var(--text)]">{item.label}</span>
                        <Badge tone={item.complete ? "green" : "amber"}>{item.owner}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.action}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Pilot owner assigned", Boolean(useCase.ownerId)],
                ["Data sources identified", useCase.dataSources.length > 0],
                ["Risk controls drafted", useCase.risks.length > 0],
                ["Success metrics quantified", useCase.monthlyVolume > 0 && useCase.avgHandlingTimeMinutes > 0],
                ["Human oversight defined", useCase.riskLevel !== "restricted"],
                ["Governance route ready", ["scored", "governance_review", "approved_for_pilot", "in_pilot"].includes(useCase.status)],
              ].map(([label, complete]) => (
                <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm font-semibold text-[var(--text-muted)]">
                  <span className={`flex size-5 items-center justify-center rounded-full ${complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
                    {complete ? <Check size={13} /> : <AlertTriangle size={13} />}
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mode === "value" ? (
          <div className="mt-6 space-y-5">
            <SectionTitle title="ROI Model" helper="Value estimates stay assumption-based until pilot telemetry replaces the baseline." />
            <div className="grid gap-4 md:grid-cols-3">
              <ReadinessTile label="Conservative" value={formatCurrency(conservativeValue)} tone="amber" />
              <ReadinessTile label="Expected" value={formatCurrency(expectedValue)} tone="green" />
              <ReadinessTile label="Optimistic" value={formatCurrency(optimisticValue)} tone="blue" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <TextBlock title="Formula" body="Monthly hours saved = monthly volume x minutes saved per item / 60. Annualized value = monthly hours saved x loaded hourly cost x 12, then adjusted by adoption and confidence." />
              <TextBlock title="Baseline Assumptions" body={`${useCase.monthlyVolume.toLocaleString()} monthly items, ${useCase.avgHandlingTimeMinutes} minutes average handling time, ${useCase.estimatedUsers.toLocaleString()} affected users, and a $68 loaded hourly cost assumption.`} />
              <TextBlock title="Adoption Adjustment" body={`Expected value assumes roughly 80% adoption-adjusted capture. Pilot telemetry should replace this with active-user, repeat-usage, and cycle-time evidence.`} />
              <TextBlock title="Capacity Impact" body={`${estimatedFte.toFixed(1)} FTE equivalent capacity could be redirected if the Skill reaches expected adoption without increasing risk or rework.`} />
            </div>
            <Panel className="p-4">
              <SectionTitle title="Value Evidence Model" helper="Keep every ROI claim tied to an owner, source, and freshness window." compact />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MiniMetric label="Confidence" value={intelligence.valueConfidence} />
                <MiniMetric label="Assumption owner" value="Finance partner" />
                <MiniMetric label="Telemetry needed" value="Run + adoption data" />
              </div>
              <div className="mt-4 space-y-2">
                {intelligence.successMetrics.slice(0, 4).map((metric) => (
                  <div key={metric} className="flex items-start gap-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--text-muted)]">
                    <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                      <FileCheck2 size={12} />
                    </span>
                    {metric}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}
      </Panel>

      <div className="space-y-4">
        <SkillConversionGuide
          useCase={useCase}
          intelligence={intelligence}
          onConvert={() => onConvert(useCase)}
          onGovernance={() => onGovernance(useCase)}
          onPilotBrief={() => void generatePilotBrief()}
          pilotBriefLoading={pilotBriefLoading}
        />

        {pilotBriefError ? (
          <Panel className="border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] p-4">
            <div className="flex items-start gap-3 text-sm leading-6 text-[var(--danger)]">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <div>
                <div className="font-semibold">Pilot brief generation failed</div>
                <p className="mt-1">{pilotBriefError}</p>
              </div>
            </div>
          </Panel>
        ) : null}

        {pilotBrief ? (
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="Pilot Brief" compact />
              <div className="flex items-center gap-2">
                {pilotBriefMeta ? (
                  <Badge tone={pilotBriefMeta.mode === "ai_assisted" ? "green" : "amber"}>
                    {pilotBriefMeta.mode === "ai_assisted" ? "AI assisted" : "local fallback"}
                  </Badge>
                ) : null}
                <button
                  type="button"
                  className="-my-1 inline-flex min-h-8 items-center rounded-md px-1.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                  onClick={() => {
                    setPilotBrief("");
                    setPilotBriefMeta(null);
                  }}
                >
                  Collapse
                </button>
              </div>
            </div>
            {pilotBriefMeta ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--text-muted)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Model route</span>
                  <span>{new Date(pilotBriefMeta.generatedAt).toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{pilotBriefMeta.modelRef}</Badge>
                  <Badge tone={pilotBriefMeta.localFallback ? "amber" : "green"}>
                    {pilotBriefMeta.localFallback ? "fallback runtime" : "live provider"}
                  </Badge>
                  <span>{pilotBriefMeta.inputTokens.toLocaleString()} input tokens</span>
                  <span>·</span>
                  <span>{pilotBriefMeta.outputTokens.toLocaleString()} output tokens</span>
                  <span>·</span>
                  <span>{pilotBriefMeta.latencyMs.toLocaleString()} ms</span>
                </div>
                <p className="mt-2">{pilotBriefMeta.routeReason}</p>
              </div>
            ) : null}
            <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-4 font-sans text-sm leading-6 text-[var(--text-muted)]">
              {pilotBrief}
            </pre>
          </Panel>
        ) : null}

        <Panel className="p-5">
          <SectionTitle title="Data Sources" />
          <div className="mt-3 space-y-2">
            {useCase.dataSources.map((source) => (
              <div key={source} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                {source}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Risks" />
          <div className="mt-3 space-y-2">
            {useCase.risks.map((risk) => (
              <div key={risk} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <AlertTriangle size={14} className="text-[var(--warning)]" />
                {risk}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
