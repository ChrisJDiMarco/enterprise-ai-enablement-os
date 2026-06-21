import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDashed,
  CircleDollarSign,
  Database,
  FileText,
  GraduationCap,
  Library,
  Plus,
  Radar,
  Rocket,
  Route,
  ShieldCheck,
  Target,
  TestTube2,
  Workflow,
} from "lucide-react";

import { Badge, Button, EmptyState, MetricCard, MiniMetric, Panel, ReadinessTile, SectionTitle, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import {
  formatCurrency,
  type ContextSource,
  type EvalResult,
  type GovernanceReview,
  type Run,
  type Skill,
  type UseCase,
  type WorkSignal,
} from "@/lib/enterprise-ai-data";
import { deriveWorkflowOptimizationModel, type OptimizationLane } from "@/lib/workflow-optimization";
import type { View } from "@/lib/ui/types";

export function StrategyRoadmap({
  metrics,
  useCases,
  skills,
  governanceReviews,
  evalResults,
  runs,
  workSignals,
  contextSources,
  onNewUseCase,
  onOpenFactory,
  onOpenGovernance,
  onOpenSkills,
  onOpenEvals,
  onOpenRoi,
  onOpenReports,
  onOpenView,
}: {
  metrics: {
    totalUseCases: number;
    activePilots: number;
    skills: number;
    adoptionRate: number;
    hoursSaved: number;
    riskItemsOpen: number;
    annualValue: number;
  };
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  runs: Run[];
  workSignals: WorkSignal[];
  contextSources: ContextSource[];
  onNewUseCase: () => void;
  onOpenFactory: () => void;
  onOpenGovernance: () => void;
  onOpenSkills: () => void;
  onOpenEvals: () => void;
  onOpenRoi: () => void;
  onOpenReports: () => void;
  onOpenView: (view: View) => void;
}) {
  const departmentCounts = useCases.reduce<Record<string, number>>((acc, useCase) => {
    acc[useCase.department] = (acc[useCase.department] ?? 0) + 1;
    return acc;
  }, {});
  const topDepartments = Object.entries(departmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const blockedReviews = governanceReviews.filter((review) =>
    ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  );
  const lowEvalSkills = skills.filter((skill) => skill.evalPassRate < 85);
  const productionSkills = skills.filter((skill) => ["pilot", "production"].includes(skill.status));
  const roadmapStages = [
    {
      label: "Discover",
      helper: "Pain points captured",
      count: useCases.filter((item) => ["draft", "submitted", "triage"].includes(item.status)).length,
      tone: "purple" as const,
    },
    {
      label: "Shape",
      helper: "Discovery and scoring",
      count: useCases.filter((item) => ["discovery", "scored"].includes(item.status)).length,
      tone: "blue" as const,
    },
    {
      label: "Govern",
      helper: "Review and controls",
      count: useCases.filter((item) => item.status === "governance_review").length + governanceReviews.length,
      tone: "amber" as const,
    },
    {
      label: "Pilot",
      helper: "Validated pilots",
      count: metrics.activePilots,
      tone: "green" as const,
    },
    {
      label: "Scale",
      helper: "Reusable assets",
      count: useCases.filter((item) => item.status === "scaled").length + productionSkills.length,
      tone: "green" as const,
    },
  ];
  const weeklyPriorityQueue = [
    {
      title: useCases.length ? "Choose the next function bet" : "Capture the first function pain point",
      body: useCases.length
        ? `${useCases.length} opportunities are in the funnel. Pick the best next lane before adding more scattered demand.`
        : "A roadmap becomes real when one team problem has an owner, volume, risk, and expected value.",
      status: useCases.length ? `${useCases.length} opportunities` : "No portfolio yet",
      actionLabel: useCases.length ? "Open opportunity funnel" : "Add opportunity",
      action: useCases.length ? onOpenFactory : onNewUseCase,
      tone: useCases.length ? "blue" : "purple",
      icon: Target,
    },
    {
      title: blockedReviews.length ? "Clear governance blockers" : "Keep risk review ahead of launch",
      body: blockedReviews.length
        ? `${blockedReviews.length} item${blockedReviews.length === 1 ? "" : "s"} need reviewer decisions before the roadmap can move cleanly.`
        : governanceReviews.length
          ? "The review path is clear. Keep using governance as the promotion lane for every new Skill."
          : "Submit the first governance review so risk, privacy, legal, and compliance have a visible decision path.",
      status: blockedReviews.length ? `${blockedReviews.length} blocked` : governanceReviews.length ? "Review path clear" : "No reviews yet",
      actionLabel: "Open governance",
      action: onOpenGovernance,
      tone: blockedReviews.length ? "amber" : governanceReviews.length ? "green" : "blue",
      icon: ShieldCheck,
    },
    {
      title: lowEvalSkills.length ? "Repair Skill quality gaps" : skills.length ? "Promote reusable Skills" : "Create the first reusable Skill",
      body: lowEvalSkills.length
        ? `${lowEvalSkills.length} Skill${lowEvalSkills.length === 1 ? "" : "s"} need stronger eval evidence before another rollout wave.`
        : skills.length
          ? "Current Skill quality is usable. Package the strongest pattern so other teams can adopt it without restarting discovery."
          : "Turn the best opportunity into a governed Skill with prompt, context, tools, evals, owner, and rollback notes.",
      status: lowEvalSkills.length ? `${lowEvalSkills.length} quality gaps` : skills.length ? `${skills.length} Skills` : "No Skills yet",
      actionLabel: lowEvalSkills.length ? "Open quality evals" : "Open AI Skills",
      action: lowEvalSkills.length ? onOpenEvals : onOpenSkills,
      tone: lowEvalSkills.length ? "amber" : skills.length ? "green" : "blue",
      icon: lowEvalSkills.length ? TestTube2 : Library,
    },
    {
      title: metrics.annualValue > 0 ? "Package the scale story" : "Attach value proof",
      body: metrics.annualValue > 0
        ? `${formatCurrency(metrics.annualValue)} in annualized value is tracked. Turn the evidence into a leadership-ready decision packet.`
        : "Baseline volume, handling time, quality, cost, and adoption during pilot design so value claims are believable later.",
      status: metrics.annualValue > 0 ? formatCurrency(metrics.annualValue) : "Value missing",
      actionLabel: metrics.annualValue > 0 ? "Generate briefing" : "Open Value & ROI",
      action: metrics.annualValue > 0 ? onOpenReports : onOpenRoi,
      tone: metrics.annualValue > 0 ? "green" : "amber",
      icon: metrics.annualValue > 0 ? FileText : CircleDollarSign,
    },
  ] satisfies {
    title: string;
    body: string;
    status: string;
    actionLabel: string;
    action: () => void;
    tone: BadgeTone;
    icon: typeof Target;
  }[];
  const operatingRisks = [
    {
      label: "Scattered pilots",
      active: useCases.length > skills.length && useCases.length > 0,
      helper: "Convert proven use cases into reusable Skills and patterns.",
    },
    {
      label: "Governance drag",
      active: blockedReviews.length > 0,
      helper: "Resolve review blockers and approval conditions before launch.",
    },
    {
      label: "Low adoption signal",
      active: skills.length > 0 && metrics.adoptionRate < 20,
      helper: "Create training, champions, and workflow embedding plans.",
    },
    {
      label: "Unproven ROI",
      active: metrics.annualValue === 0 && useCases.length > 0,
      helper: "Baseline handling time, volume, quality, and cost assumptions.",
    },
  ];
  const scaleReadinessChecks = [
    productionSkills.length > 0,
    evalResults.length > 0 && lowEvalSkills.length === 0,
    runs.length > 0,
    governanceReviews.length > 0 && blockedReviews.length === 0,
    metrics.annualValue > 0,
  ];
  const roadmapHealth = Math.round((scaleReadinessChecks.filter(Boolean).length / scaleReadinessChecks.length) * 100);
  const optimization = deriveWorkflowOptimizationModel({ workSignals, useCases, skills, runs, contextSources });
  const primaryFunction = topDepartments[0]?.[0] ?? "No function selected";
  const nextRoadmapAction =
    useCases.length === 0
      ? {
          title: "Start with one real business pain point",
          body: "A roadmap becomes useful only after the first team problem is captured with owner, volume, risk, and expected value.",
          label: "Add opportunity",
          action: onNewUseCase,
          tone: "purple" as BadgeTone,
          icon: Target,
        }
      : blockedReviews.length
        ? {
            title: "Unblock review decisions before more pilots",
            body: `${blockedReviews.length} item${blockedReviews.length === 1 ? "" : "s"} need governance decisions or blocker removal before the roadmap can move cleanly.`,
            label: "Open risk review",
            action: onOpenGovernance,
            tone: "amber" as BadgeTone,
            icon: ShieldCheck,
          }
        : lowEvalSkills.length
          ? {
              title: "Raise quality before scaling Skills",
              body: `${lowEvalSkills.length} Skill${lowEvalSkills.length === 1 ? "" : "s"} need stronger eval evidence so teams can trust the next rollout wave.`,
              label: "Open quality evals",
              action: onOpenEvals,
              tone: "amber" as BadgeTone,
              icon: TestTube2,
            }
          : !productionSkills.length
            ? {
                title: "Turn the best pilot into a reusable Skill",
                body: "The roadmap has opportunities, but it still needs an approved Skill that can be reused across teams.",
                label: "Open AI Skills",
                action: onOpenSkills,
                tone: "blue" as BadgeTone,
                icon: Library,
              }
            : metrics.annualValue <= 0
              ? {
                  title: "Attach value proof to the roadmap",
                  body: "Leadership needs baseline value before scaling: time saved, quality lift, volume, cost, and adoption signal.",
                  label: "Open Value & ROI",
                  action: onOpenRoi,
                  tone: "amber" as BadgeTone,
                  icon: CircleDollarSign,
                }
              : {
                  title: "Package the scale decision for leaders",
                  body: "The roadmap has opportunity, quality, governance, and value evidence. Turn it into the next executive update.",
                  label: "Generate briefing",
                  action: onOpenReports,
                  tone: "green" as BadgeTone,
                  icon: FileText,
                };
  const NextRoadmapIcon = nextRoadmapAction.icon;
  const decisionPath = [
    {
      label: "Find work",
      helper: useCases.length ? `${useCases.length} opportunities captured` : "Capture the first use case",
      complete: useCases.length > 0,
      action: onOpenFactory,
    },
    {
      label: "Govern risk",
      helper: blockedReviews.length ? `${blockedReviews.length} reviews need action` : governanceReviews.length ? "Review path is clear" : "Submit the first review",
      complete: governanceReviews.length > 0 && blockedReviews.length === 0,
      action: onOpenGovernance,
    },
    {
      label: "Prove quality",
      helper: lowEvalSkills.length ? `${lowEvalSkills.length} Skills below target` : evalResults.length ? `${evalResults.length} eval evidence records` : "Run evals before scale",
      complete: evalResults.length > 0 && lowEvalSkills.length === 0,
      action: onOpenEvals,
    },
    {
      label: "Scale value",
      helper: metrics.annualValue > 0 ? `${formatCurrency(metrics.annualValue)} tracked` : "Attach ROI evidence",
      complete: metrics.annualValue > 0 && productionSkills.length > 0,
      action: onOpenRoi,
    },
  ];
  const laneTone: Record<OptimizationLane, BadgeTone> = {
    capture: "purple",
    standardize: "blue",
    train: "amber",
    agent_context: "slate",
    automate: "blue",
    prove: "green",
  };
  const laneIcon: Record<OptimizationLane, typeof Target> = {
    capture: FileText,
    standardize: Route,
    train: GraduationCap,
    agent_context: Database,
    automate: Workflow,
    prove: CircleDollarSign,
  };
  const leadOptimization = optimization.recommendations[0];
  const LeadOptimizationIcon = leadOptimization ? laneIcon[leadOptimization.lane] : Radar;
  const openOptimizationTarget = (view: View) => {
    if (view === "factory") {
      onOpenFactory();
      return;
    }

    if (view === "skills") {
      onOpenSkills();
      return;
    }

    if (view === "evals") {
      onOpenEvals();
      return;
    }

    if (view === "governance") {
      onOpenGovernance();
      return;
    }

    if (view === "roi") {
      onOpenRoi();
      return;
    }

    if (view === "reports") {
      onOpenReports();
      return;
    }

    onOpenView(view);
  };

  return (
    <div>
      <PageHeader
        title="AI Roadmap"
        subtitle="Decide what to start, unblock, prove, and scale next across the company."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onOpenReports}>
              <FileText size={16} />
              Briefing
            </Button>
            <Button onClick={onNewUseCase}>
              <Plus size={16} />
              Add Opportunity
            </Button>
          </div>
        }
      />

      <Panel className="mb-5 overflow-hidden" data-testid="workflow-optimization-radar">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.54fr)]">
          <div className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(66,72,217,0.08),transparent_46%,rgba(15,138,157,0.07))]" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--text)] text-[var(--surface)] shadow-[var(--shadow-button)]">
                    <Radar size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Workflow Optimization Radar</div>
                    <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-[var(--text)]">One operating queue for SOPs, training, AI context, automation, and proof</h2>
                  </div>
                </div>
                <Badge tone={optimization.metrics.agentContextCoverage >= 70 ? "green" : "amber"}>
                  {optimization.metrics.agentContextCoverage}% agent-ready
                </Badge>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <MiniMetric label="Observed workflows" value={optimization.metrics.workflowsObserved.toLocaleString()} />
                <MiniMetric label="SOP backlog" value={`${optimization.metrics.documentationBacklog} playbooks`} />
                <MiniMetric label="Training backlog" value={`${optimization.metrics.trainingBacklog} cohorts`} />
                <MiniMetric label="Automation candidates" value={`${optimization.metrics.automationCandidates}`} />
                <MiniMetric label="ROI proof gaps" value={`${optimization.metrics.roiProofGaps}`} />
                <MiniMetric label="Signals connected" value={`${workSignals.length}`} />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {optimization.lanes.map((lane) => {
                  const LaneIcon = laneIcon[lane.id];
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      className="group min-h-[88px] rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3 text-left shadow-[var(--shadow-button)] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/32 hover:bg-[var(--surface)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                      onClick={() => openOptimizationTarget(lane.targetView)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)] ring-1 ring-[var(--border)]/80">
                          <LaneIcon size={17} />
                        </span>
                        <Badge tone={lane.count ? laneTone[lane.id] : "slate"}>{lane.count}</Badge>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-[var(--text)]">{lane.label}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">{lane.helper}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/68 p-5 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="Next Best Optimizations" helper="Ranked from work telemetry, playbook readiness, knowledge health, and proof gaps." compact />
              {leadOptimization ? (
                <Button variant="secondary" onClick={() => openOptimizationTarget(leadOptimization.targetView)}>
                  <LeadOptimizationIcon size={15} />
                  Open top move
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {optimization.recommendations.slice(0, 5).map((recommendation) => {
                const RecommendationIcon = laneIcon[recommendation.lane];
                return (
                  <button
                    key={recommendation.id}
                    type="button"
                    className="w-full rounded-lg border border-[var(--border)]/76 bg-[var(--surface)]/84 p-3 text-left shadow-[var(--shadow-button)] transition hover:border-[var(--primary)]/32 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={() => openOptimizationTarget(recommendation.targetView)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                        <RecommendationIcon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--text)]">{recommendation.title}</span>
                          <Badge tone={laneTone[recommendation.lane]}>{recommendation.impactScore}</Badge>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                          {recommendation.department} · {recommendation.confidence}% confidence · {recommendation.effort} effort
                        </span>
                        <span className="mt-2 block rounded-md border border-[var(--border)]/64 bg-[var(--surface-muted)]/72 px-2.5 py-2 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                          {recommendation.evidence[0]}
                        </span>
                      </span>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-[var(--text-soft)]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mb-5 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextRoadmapAction.tone}>{roadmapHealth}% scale-ready</Badge>
              <Badge tone={topDepartments.length ? "blue" : "slate"}>{primaryFunction}</Badge>
              <Badge tone={blockedReviews.length ? "amber" : "green"}>{blockedReviews.length ? `${blockedReviews.length} blockers` : "no blockers"}</Badge>
            </div>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                    <NextRoadmapIcon size={20} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{nextRoadmapAction.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{nextRoadmapAction.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenReports}>
                  <FileText size={15} />
                  Briefing
                </Button>
                <Button onClick={nextRoadmapAction.action}>
                  <ArrowRight size={15} />
                  {nextRoadmapAction.label}
                </Button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Focus lane" value={primaryFunction} />
              <MiniMetric label="Open blockers" value={`${blockedReviews.length} reviews`} />
              <MiniMetric label="Quality gaps" value={`${lowEvalSkills.length} Skills`} />
              <MiniMetric label="Value proof" value={metrics.annualValue > 0 ? formatCurrency(metrics.annualValue) : "Missing"} />
            </div>
          </div>
          <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/72 p-6 xl:border-l xl:border-t-0">
            <SectionTitle title="Decision Path" helper="The few moves that turn AI activity into a real company roadmap." compact />
            <div className="mt-4 space-y-2">
              {decisionPath.map((step) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={step.action}
                  className="flex w-full gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/74 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                      step.complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"
                    }`}
                  >
                    {step.complete ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">{step.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{step.helper}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Boxes} label="Opportunity Funnel" value={metrics.totalUseCases} trend="corporate functions" onClick={onOpenFactory} />
        <MetricCard icon={Rocket} label="Pilots In Motion" value={metrics.activePilots} trend="approved or measuring" onClick={onOpenFactory} />
        <MetricCard icon={Library} label="Reusable Skills" value={metrics.skills} trend="industrialized assets" />
        <MetricCard icon={CircleDollarSign} label="Tracked Value" value={formatCurrency(metrics.annualValue)} trend="annualized" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <SectionTitle title="Enterprise AI Roadmap" helper="Operating loop: strategy to opportunity to process redesign to Skill to measurable scale" />
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {roadmapStages.map((stage, index) => (
              <div key={stage.label} className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                {index < roadmapStages.length - 1 ? (
                  <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-[var(--border)] md:block" />
                ) : null}
                <Badge tone={stage.tone}>{stage.label}</Badge>
                <div className="mt-4 text-3xl font-semibold tracking-normal">{stage.count}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{stage.helper}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="text-sm font-semibold text-[var(--text)]">Director Operating Loop</div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-[var(--text-muted)] md:grid-cols-5">
              {["Strategy", "Opportunity", "Process", "Skill", "Scale"].map((item) => (
                <div key={item} className="rounded-lg bg-[var(--surface)] px-3 py-2 text-center shadow-sm">{item}</div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="order-first p-5 xl:order-none">
          <SectionTitle title="This Week's Operating Queue" helper="Four concrete moves that turn the roadmap into company progress." />
          <div className="mt-4 space-y-3">
            {weeklyPriorityQueue.map((priority, index) => {
              const PriorityIcon = priority.icon;
              return (
                <div
                  key={priority.title}
                  data-testid={`roadmap-weekly-priority-${index + 1}`}
                  className="rounded-lg border border-[var(--border)]/75 bg-[var(--surface)]/80 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      <PriorityIcon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-[var(--text)]">{priority.title}</div>
                        <Badge tone={priority.tone}>{priority.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{priority.body}</p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={priority.action} className="mt-3 w-full whitespace-nowrap">
                    {priority.actionLabel}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel className="p-5">
          <SectionTitle title="Function Focus" helper="Where the opportunity pipeline is concentrated" />
          <div className="mt-4 space-y-3">
            {topDepartments.length ? topDepartments.map(([department, count]) => (
              <div key={department}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{department}</span>
                  <span className="text-[var(--text-muted)]">{count} opportunities</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--surface-subtle)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.max(8, Math.round((count / Math.max(1, useCases.length)) * 100))}%` }}
                  />
                </div>
              </div>
            )) : (
              <EmptyState
                title="No roadmap data yet"
                body="Start by capturing opportunities from HR, Finance, Legal, Procurement, IT, Marketing, or Operations."
                action="Create Opportunity"
                onAction={onNewUseCase}
              />
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Transformation Risks" helper="Risks that prevent pilots from becoming enterprise capability" />
          <div className="mt-4 space-y-3">
            {operatingRisks.map((risk) => (
              <div key={risk.label} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{risk.label}</div>
                  <Badge tone={risk.active ? "amber" : "green"}>{risk.active ? "Watch" : "Clear"}</Badge>
                </div>
                <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{risk.helper}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Scale Readiness" helper="Signals needed before global rollout" />
          <div className="mt-4 space-y-3">
            <ReadinessTile label="Reusable pattern" value={productionSkills.length ? `${productionSkills.length} Skills` : "Not yet"} tone={productionSkills.length ? "green" : "amber"} />
            <ReadinessTile label="Eval evidence" value={evalResults.length ? `${evalResults.length} artifacts` : "Missing"} tone={evalResults.length ? "green" : "amber"} />
            <ReadinessTile label="Runtime traceability" value={runs.length ? `${runs.length} runs` : "No runs"} tone={runs.length ? "green" : "amber"} />
            <ReadinessTile label="Governance path" value={governanceReviews.length ? `${governanceReviews.length} reviews` : "Not submitted"} tone={governanceReviews.length ? "green" : "amber"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
