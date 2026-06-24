import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FilePlus2,
  FileText,
  Gauge,
  GraduationCap,
  Library,
  Megaphone,
  MessageSquareText,
  Network,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  WandSparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, EmptyState, MetricCard, MiniMetric, Panel, SectionTitle, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import {
  deriveEnablementPlaybookProgram,
  type EnablementPlaybook,
  type PlaybookOptimizationRecommendation,
} from "@/lib/enablement-playbooks";
import { adoptionEnablementTracks } from "@/lib/enterprise-ai-control-plane";
import { adoptionReachableUsers } from "@/lib/adoption-model";
import { type Skill, type UseCase, type WorkSignal } from "@/lib/enterprise-ai-data";
import type { View } from "@/lib/ui/types";

type TrainingAdoptionProps = {
  skills: Skill[];
  useCases: UseCase[];
  workSignals: WorkSignal[];
  onOpenSkills: () => void;
  onOpenWork: () => void;
  onOpenFactory: () => void;
  onOpenReports: () => void;
  onOpenView: (view: View) => void;
};

function progressTone(score: number): BadgeTone {
  if (score >= 80) return "green";
  if (score >= 55) return "blue";
  if (score >= 30) return "amber";
  return "slate";
}

function progressLabel(score: number) {
  if (score >= 80) return "Ready";
  if (score >= 55) return "Building";
  if (score >= 30) return "Needs push";
  return "Unstarted";
}

function playbookStageLabel(stage: EnablementPlaybook["stage"]) {
  if (stage === "agent_ready") return "Agent ready";
  if (stage === "validated") return "Validated";
  if (stage === "assigned") return "Assigned";
  if (stage === "captured") return "Captured";
  return "Draft";
}

function playbookStageTone(stage: EnablementPlaybook["stage"]): BadgeTone {
  if (stage === "agent_ready") return "green";
  if (stage === "validated") return "blue";
  if (stage === "assigned") return "purple";
  if (stage === "captured") return "amber";
  return "slate";
}

function lifecycleTaskTone(status: EnablementPlaybook["lifecycle"]["assignments"][number]["status"]): BadgeTone {
  if (status === "ready") return "green";
  if (status === "attention") return "amber";
  return "slate";
}

function lifecycleStatusTone(status: EnablementPlaybook["lifecycle"]["status"]): BadgeTone {
  if (status === "publish_ready") return "green";
  if (status === "controlled") return "blue";
  if (status === "review_due") return "amber";
  return "slate";
}

function optimizationIcon(kind: PlaybookOptimizationRecommendation["kind"]) {
  if (kind === "automate") return Zap;
  if (kind === "context") return BrainCircuit;
  if (kind === "train") return GraduationCap;
  if (kind === "review") return ShieldAlert;
  if (kind === "publish") return Sparkles;
  if (kind === "roadmap") return Gauge;
  return SearchCheck;
}

export function TrainingAdoption({
  skills,
  useCases,
  workSignals,
  onOpenSkills,
  onOpenWork,
  onOpenFactory,
  onOpenReports,
  onOpenView,
}: TrainingAdoptionProps) {
  const playbookProgram = useMemo(
    () => deriveEnablementPlaybookProgram({ skills, useCases, workSignals }),
    [skills, useCases, workSignals],
  );
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const selectedPlaybook =
    playbookProgram.playbooks.find((playbook) => playbook.id === selectedPlaybookId) ?? playbookProgram.playbooks[0]!;
  const activeUsers = skills.reduce((sum, skill) => sum + skill.adoptionCount, 0);
  const reachableUsers = adoptionReachableUsers(useCases);
  const adoption = [
    { week: "W1", users: 0 },
    { week: "W2", users: 0 },
    { week: "W3", users: 0 },
    { week: "Current", users: activeUsers },
  ];
  const liveSkills = skills.filter((skill) => ["pilot", "production", "approved"].includes(skill.status));
  const productionSkills = skills.filter((skill) => skill.status === "production");
  const launchableUseCases = useCases.filter((useCase) => ["approved_for_pilot", "in_pilot", "measuring", "scaled"].includes(useCase.status));
  const trainedUsers = Math.round(activeUsers * 0.72);
  const champions = Math.max(0, Math.round(liveSkills.length * 3));
  const totalRuns = skills.reduce((sum, skill) => sum + skill.runs, 0);
  const repeatUsage = activeUsers ? Math.round((totalRuns / Math.max(activeUsers, 1)) * 10) / 10 : 0;
  const trainingGap = Math.max(0, activeUsers - trainedUsers);
  const trainingSignals = workSignals.filter((signal) => ["training_completed", "feedback_given", "skill_used"].includes(signal.eventType));
  const adoptionScore = Math.round(
    (
      Math.min(100, liveSkills.length * 24) +
      Math.min(100, activeUsers / 2) +
      Math.min(100, repeatUsage * 28) +
      Math.min(100, champions * 8)
    ) / 4,
  );
  const nextAction =
    skills.length === 0
      ? {
          title: "Start with one useful AI Skill",
          body: "Adoption cannot happen until one real workflow has a safe, reusable Skill attached to it.",
          label: "Open AI Skills",
          action: onOpenSkills,
          icon: Library,
          tone: "purple" as BadgeTone,
        }
      : activeUsers === 0
        ? {
            title: "Pick the first launch cohort",
            body: "Choose a team already feeling the workflow pain, then give them one Skill and one office-hours rhythm.",
            label: "Find work signals",
            action: onOpenWork,
            icon: Target,
            tone: "blue" as BadgeTone,
          }
        : trainingGap > Math.max(8, Math.round(activeUsers * 0.2))
          ? {
              title: "Close the training gap",
              body: `${trainingGap.toLocaleString()} active users still need the baseline enablement path before the rollout can feel dependable.`,
              label: "Open AI Skills",
              action: onOpenSkills,
              icon: GraduationCap,
              tone: "amber" as BadgeTone,
            }
          : repeatUsage < 2
            ? {
                title: "Turn first usage into weekly habit",
                body: "Usage exists, but repeat behavior is still thin. Anchor Skills inside the real workflow moments people already repeat.",
                label: "Open work signals",
                action: onOpenWork,
                icon: Workflow,
                tone: "amber" as BadgeTone,
              }
            : {
                title: "Package the adoption proof",
                body: "The enablement motion is working. Send leaders the proof, cohort coverage, and next scale decision.",
                label: "Prepare report",
                action: onOpenReports,
                icon: FileText,
                tone: "green" as BadgeTone,
              };
  const NextActionIcon = nextAction.icon;
  const cohortReadiness = [
    {
      cohort: "Everyone",
      audience: `${reachableUsers.toLocaleString()} estimated reachable employees`,
      score: Math.min(100, Math.max(18, trainedUsers ? 76 : liveSkills.length ? 42 : 18)),
      next: "Baseline AI literacy, safe-use norms, and the first approved Skill catalog.",
    },
    {
      cohort: "Managers",
      audience: "Process owners and team leads",
      score: Math.min(100, liveSkills.length * 22 + (trainingSignals.length ? 18 : 0)),
      next: "Manager playbook for choosing use cases, measuring quality, and routing exceptions.",
    },
    {
      cohort: "Power users",
      audience: "High-volume operators",
      score: Math.min(100, Math.round(repeatUsage * 30) + productionSkills.length * 16),
      next: "Workflow-embedded coaching for the Skills people should use every week.",
    },
    {
      cohort: "AI builders",
      audience: "Analysts, ops builders, functional SMEs",
      score: Math.min(100, skills.length * 18 + launchableUseCases.length * 10),
      next: "Builder lab for turning approved use cases into prompts, tools, evals, and handoffs.",
    },
    {
      cohort: "Reviewers",
      audience: "Legal, risk, security, compliance",
      score: Math.min(100, liveSkills.length * 16 + trainingSignals.length * 8),
      next: "Reviewer enablement on autonomy tiers, evidence packets, and approval conditions.",
    },
  ];
  const topSkillEnablement = [...skills]
    .sort((a, b) => b.adoptionCount - a.adoptionCount)
    .slice(0, 4);
  const rolloutPath = [
    {
      label: "Week 1",
      title: "Anchor the launch cohort",
      detail: liveSkills.length
        ? `${liveSkills.length} approved Skill${liveSkills.length === 1 ? "" : "s"} can support the first cohort.`
        : "Choose one workflow and finish the first approved Skill.",
      complete: liveSkills.length > 0,
      action: onOpenSkills,
    },
    {
      label: "Week 2",
      title: "Run office-hours loops",
      detail: trainingSignals.length
        ? `${trainingSignals.length} training and feedback signal${trainingSignals.length === 1 ? "" : "s"} are flowing.`
        : "Capture questions, misses, and training completions as work signals.",
      complete: trainingSignals.length > 0,
      action: onOpenWork,
    },
    {
      label: "Week 3",
      title: "Embed repeat behavior",
      detail: repeatUsage >= 2 ? `${repeatUsage} runs per active user shows habit formation.` : "Move from one-off demos to repeated workflow moments.",
      complete: repeatUsage >= 2,
      action: onOpenWork,
    },
    {
      label: "Week 4",
      title: "Publish proof and scale ask",
      detail: adoptionScore >= 70 ? "Adoption proof is strong enough for the next scale conversation." : "Connect adoption, quality, risk, and value before scaling.",
      complete: adoptionScore >= 70,
      action: onOpenReports,
    },
  ];
  const trackActions: Record<string, { label: string; action: () => void }> = {
    Executives: { label: "Prepare Report", action: onOpenReports },
    Managers: { label: "Open Use Cases", action: onOpenFactory },
    Operators: { label: "Open Work Signals", action: onOpenWork },
    Builders: { label: "Open AI Skills", action: onOpenSkills },
    Reviewers: { label: "Prepare Report", action: onOpenReports },
  };
  const playbookMetricCards = [
    {
      icon: ClipboardList,
      label: "Playbooks",
      value: playbookProgram.metrics.total.toLocaleString(),
      helper: `${playbookProgram.metrics.avgCompletion}% average readiness`,
    },
    {
      icon: BrainCircuit,
      label: "Agent Context",
      value: `${playbookProgram.metrics.contextCoverage}%`,
      helper: `${playbookProgram.metrics.agentReady} ready for assistant use`,
    },
    {
      icon: GraduationCap,
      label: "Training Coverage",
      value: `${playbookProgram.metrics.trainingCoverage}%`,
      helper: `${playbookProgram.metrics.quizCoverage}% quiz readiness`,
    },
    {
      icon: RefreshCw,
      label: "Review Freshness",
      value: playbookProgram.metrics.needsReview ? `${playbookProgram.metrics.needsReview} stale` : "Current",
      helper: `${playbookProgram.metrics.assignmentCoverage}% assigned · ${playbookProgram.metrics.exportCoverage}% exportable`,
    },
  ];
  const optimizationPreview = playbookProgram.optimizationQueue.slice(0, 3);
  const optimizationGridClass = optimizationPreview.length >= 3 ? "md:grid-cols-3" : optimizationPreview.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1";
  const playbookActionMap: Record<View, () => void> = {
    command: () => onOpenView("command"),
    blueprint: () => onOpenView("blueprint"),
    strategy: () => onOpenView("strategy"),
    process: () => onOpenView("process"),
    work: onOpenWork,
    factory: onOpenFactory,
    harness: () => onOpenView("harness"),
    skills: onOpenSkills,
    workflow: () => onOpenView("workflow"),
    broker: () => onOpenView("broker"),
    context: () => onOpenView("context"),
    evals: () => onOpenView("evals"),
    governance: () => onOpenView("governance"),
    launch: () => onOpenView("launch"),
    roi: () => onOpenView("roi"),
    training: () => onOpenView("training"),
    reports: onOpenReports,
    admin: () => onOpenView("admin"),
    evidence: () => onOpenView("evidence"),
    orchestrator: () => onOpenView("orchestrator"),
    estate: () => onOpenView("estate"),
    connectors: () => onOpenView("connectors"),
    session: () => onOpenView("session"),
  };
  const openPlaybookTarget = (playbook: EnablementPlaybook) => {
    playbookActionMap[playbook.targetView]?.();
  };

  return (
    <div>
      <PageHeader
        title="Adoption Plan"
        subtitle="Turn approved AI Skills into trusted weekly behavior across teams, managers, builders, and reviewers."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenFactory}>
              <Target size={15} />
              Add opportunity
            </Button>
            <Button onClick={nextAction.action}>
              <NextActionIcon size={15} />
              {nextAction.label}
            </Button>
          </div>
        }
      />

      <Panel className="mb-5 overflow-hidden" data-testid="sop-intelligence-studio">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-eyebrow text-[var(--text-soft)]">workflow capture</span>
              <Badge tone={playbookProgram.metrics.agentReady ? "green" : "amber"}>
                {playbookProgram.metrics.agentReady}/{playbookProgram.metrics.total} agent-ready
              </Badge>
              <Badge tone={playbookProgram.metrics.needsReview ? "amber" : "green"}>
                {playbookProgram.metrics.needsReview ? `${playbookProgram.metrics.needsReview} reviews due` : "reviews current"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/15">
                    <WandSparkles size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="t-eyebrow text-[var(--text-soft)]">
                      SOP Intelligence Studio
                    </div>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                      Capture the work once. Train people and AI from the same source.
                    </h2>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                  Convert workflow evidence into operating playbooks, training assignments, validation checks, and approved assistant context. This turns hidden institutional process knowledge into something teams can follow and AI agents can safely use.
                </p>
                <details className="group mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-semibold text-[var(--text)]">Studio actions</span>
                    <span className="flex items-center gap-2">
                      <Badge tone="blue">{playbookProgram.intents.length}</Badge>
                      <ArrowRight size={14} className="text-[var(--text-soft)] transition group-open:rotate-90" />
                    </span>
                  </summary>
                  <div className="grid gap-2 border-t border-[var(--border)] p-2">
                    {playbookProgram.intents.map((intent) => (
                      <button
                        key={intent.id}
                        type="button"
                        className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
                        onClick={playbookActionMap[intent.view]}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[var(--text)]">{intent.label}</span>
                          <ArrowRight size={14} className="text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 lg:max-h-[430px] lg:overflow-y-auto">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle title="Capture-to-context pipeline" helper="From work signal to agent-ready knowledge." compact />
                  <Badge tone={progressTone(playbookProgram.metrics.avgCompletion)}>
                    {playbookProgram.metrics.avgCompletion}%
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {playbookProgram.captureStages.map((stage, index) => {
                    const completeThreshold = ((index + 1) / playbookProgram.captureStages.length) * 100;
                    const complete = playbookProgram.metrics.avgCompletion >= completeThreshold;
                    const Icon =
                      stage.id === "capture"
                        ? SearchCheck
                        : stage.id === "sop"
                          ? FilePlus2
                          : stage.id === "assign"
                            ? GraduationCap
                            : stage.id === "quiz"
                              ? CheckCircle2
                              : BrainCircuit;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                    className={`grid gap-3 rounded-lg border p-2.5 text-left transition sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center ${
                          complete
                            ? "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)]"
                            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/30 hover:bg-[var(--surface-muted)]"
                        }`}
                        onClick={
                          stage.id === "capture"
                            ? onOpenWork
                            : stage.id === "agent_context"
                              ? () => onOpenView("orchestrator")
                              : stage.id === "sop"
                                ? onOpenFactory
                                : onOpenSkills
                        }
                      >
                        <span
                          className={`flex size-8 items-center justify-center rounded-lg ${
                            complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--text)]">
                            {index + 1}. {stage.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{stage.helper}</span>
                        </span>
                        <Badge tone={complete ? "green" : "slate"}>{complete ? "live" : "next"}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {playbookMetricCards.map((metric) => {
                const MetricIcon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="t-eyebrow text-[var(--text-soft)]">{metric.label}</div>
                      <MetricIcon size={15} className="text-[var(--primary)]" />
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--text)]">{metric.value}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{metric.helper}</div>
                  </div>
                );
              })}
            </div>

            <details className="group mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]" data-testid="workflow-optimize-queue">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)]">Optimize queue</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">Open workflow findings when tuning the program.</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={playbookProgram.optimizationQueue.length ? "purple" : "slate"}>
                    {playbookProgram.optimizationQueue.length} signals
                  </Badge>
                  <ArrowRight size={15} className="text-[var(--text-soft)] transition group-open:rotate-90" />
                </span>
              </summary>
              <div className={`grid gap-px border-t border-[var(--border)] bg-[var(--border)] ${optimizationGridClass}`}>
                {optimizationPreview.map((recommendation) => {
                  const RecommendationIcon = optimizationIcon(recommendation.kind);
                  return (
                    <button
                      key={`${recommendation.playbookId}-${recommendation.id}`}
                      type="button"
                    className="group min-h-[106px] bg-[var(--surface)] p-3 text-left transition hover:bg-[var(--primary-soft)]/40"
                      onClick={() => {
                        setSelectedPlaybookId(recommendation.playbookId);
                        playbookActionMap[recommendation.targetView]?.();
                      }}
                    >
                      <span className="flex items-start justify-between gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/12">
                          <RecommendationIcon size={16} />
                        </span>
                        <Badge tone={recommendation.tone}>{recommendation.confidence}%</Badge>
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-[var(--text)]">{recommendation.label}</span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{recommendation.helper}</span>
                      <span className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--primary)]">
                        <span className="min-w-0 truncate">{recommendation.impact}</span>
                        <ArrowRight size={13} className="shrink-0 transition group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 lg:max-h-[760px] lg:overflow-y-auto lg:border-l lg:border-t-0 2xl:p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="Playbook Queue" helper="Click a playbook to inspect its launch packet." compact />
              <Badge tone={playbookStageTone(selectedPlaybook.stage)}>{playbookStageLabel(selectedPlaybook.stage)}</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {playbookProgram.playbooks.map((playbook) => {
                const selected = playbook.id === selectedPlaybook.id;
                return (
                  <button
                    key={playbook.id}
                    type="button"
                    aria-pressed={selected}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary-soft)]/72 shadow-[var(--shadow-button)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/28 hover:bg-[var(--surface-muted)]"
                    }`}
                    onClick={() => setSelectedPlaybookId(playbook.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">{playbook.title}</div>
                        <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{playbook.department} · {playbook.audience}</div>
                      </div>
                      <Badge tone={playbookStageTone(playbook.stage)}>{playbook.completion}%</Badge>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-subtle)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${playbook.completion}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="t-eyebrow text-[var(--text-soft)]">Selected packet</div>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">{selectedPlaybook.title}</h3>
                </div>
                <Badge tone={lifecycleStatusTone(selectedPlaybook.lifecycle.status)}>
                  {selectedPlaybook.lifecycle.statusLabel}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniMetric label="Training" value={`${selectedPlaybook.trainingCompletion}%`} />
                <MiniMetric label="Quiz" value={`${selectedPlaybook.quizReadiness}%`} />
                <MiniMetric label="Context" value={`${selectedPlaybook.contextReadiness}%`} />
              </div>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="t-eyebrow text-[var(--text-soft)]">Lifecycle</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                      v{selectedPlaybook.lifecycle.version} · {selectedPlaybook.lifecycle.permissionScope.label}
                    </div>
                  </div>
                  <Badge tone={selectedPlaybook.lifecycle.permissionScope.tone}>
                    {selectedPlaybook.lifecycle.reviewDueInDays < 0
                      ? `${Math.abs(selectedPlaybook.lifecycle.reviewDueInDays)}d overdue`
                      : `${selectedPlaybook.lifecycle.reviewDueInDays}d review`}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{selectedPlaybook.lifecycle.permissionScope.helper}</p>
              </div>
              <div className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3">
                <div className="t-eyebrow text-[var(--text-soft)]">Next action</div>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{selectedPlaybook.nextAction}</p>
              </div>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="t-eyebrow text-[var(--text-soft)]">Optimization moves</div>
                  <Badge tone={selectedPlaybook.optimizations[0]?.tone ?? "slate"}>
                    {selectedPlaybook.optimizations[0]?.confidence ?? 0}% top
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {selectedPlaybook.optimizations.slice(0, 3).map((recommendation) => {
                    const RecommendationIcon = optimizationIcon(recommendation.kind);
                    return (
                      <button
                        key={recommendation.id}
                        type="button"
                        onClick={playbookActionMap[recommendation.targetView]}
                        className="flex w-full min-w-0 items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface-muted)]"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                          <RecommendationIcon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--text)]">{recommendation.label}</span>
                            <Badge tone={recommendation.tone}>{recommendation.kind.replace("_", " ")}</Badge>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{recommendation.impact}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="t-eyebrow text-[var(--text-soft)]">Assignments</div>
                    <Badge tone="blue">{selectedPlaybook.lifecycle.assignments.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {selectedPlaybook.lifecycle.assignments.map((task) => (
                      <button
                        key={task.label}
                        type="button"
                        onClick={playbookActionMap[task.targetView]}
                        className="flex w-full items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface-muted)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--text)]">{task.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{task.helper}</span>
                        </span>
                        <Badge tone={lifecycleTaskTone(task.status)}>{task.status}</Badge>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 t-eyebrow text-[var(--text-soft)]">Approvals and exports</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...selectedPlaybook.lifecycle.approvalGates, ...selectedPlaybook.lifecycle.exports].slice(0, 8).map((task) => (
                      <button
                        key={`${task.label}-${task.targetView}`}
                        type="button"
                        onClick={playbookActionMap[task.targetView]}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface-muted)]"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--text)]">{task.label}</span>
                          <Badge tone={lifecycleTaskTone(task.status)}>{task.status}</Badge>
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">{task.helper}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 t-eyebrow text-[var(--text-soft)]">Version history</div>
                  <div className="space-y-2">
                    {selectedPlaybook.lifecycle.versionHistory.slice(-3).map((event) => (
                      <div key={`${event.label}-${event.date}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-semibold text-[var(--text)]">{event.label}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-[var(--text-soft)]">{event.date}</span>
                        </div>
                        <div className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{event.helper}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="t-eyebrow text-[var(--text-soft)]">Gaps</div>
                <div className="mt-2 space-y-2">
                  {(selectedPlaybook.gaps.length ? selectedPlaybook.gaps : ["Ready to publish into assistant context and launch proof."]).slice(0, 4).map((gap) => (
                    <div key={gap} className="flex gap-2 text-xs leading-5 text-[var(--text-muted)]">
                      <CircleDashed size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                      <span>{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className="flex-1" onClick={() => openPlaybookTarget(selectedPlaybook)}>
                  <ArrowRight size={15} />
                  Open next step
                </Button>
                <Button variant="secondary" onClick={() => setGuideOpen(true)}>
                  <BookOpen size={15} />
                  Preview guide
                </Button>
                <Button variant="secondary" onClick={() => onOpenView("orchestrator")}>
                  <MessageSquareText size={15} />
                  Ask assistant
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mb-5 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextAction.tone}>{progressLabel(adoptionScore)}</Badge>
              <Badge tone="blue">{liveSkills.length} launch-ready Skills</Badge>
              <Badge tone={trainingGap ? "amber" : "green"}>{trainingGap ? `${trainingGap} training gap` : "training covered"}</Badge>
            </div>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                    <NextActionIcon size={20} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{nextAction.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{nextAction.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenSkills}>
                  <Library size={15} />
                  Skill catalog
                </Button>
                <Button className="whitespace-nowrap" onClick={nextAction.action}>
                  <ArrowRight size={15} />
                  {nextAction.label}
                </Button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Launch cohort" value={activeUsers ? `${activeUsers.toLocaleString()} active` : "Not selected"} />
              <MiniMetric label="Training gap" value={trainingGap ? `${trainingGap.toLocaleString()} users` : "Closed"} />
              <MiniMetric label="Habit signal" value={`${repeatUsage}x runs/user`} />
              <MiniMetric label="Champions" value={`${champions} target`} />
            </div>
          </div>
          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-6 xl:border-l xl:border-t-0">
            <SectionTitle title="Adoption Health" helper="Readiness for a wider rollout." compact />
            <div className="mt-5">
              <div className="flex items-end justify-between gap-4">
                <div className="text-5xl font-semibold leading-none tabular-nums tracking-tight text-[var(--text)]">{adoptionScore}</div>
                <Badge tone={progressTone(adoptionScore)}>{progressLabel(adoptionScore)}</Badge>
              </div>
              <div className="mt-4 h-2 rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${adoptionScore}%` }} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <MiniMetric label="Training" value={`${trainedUsers.toLocaleString()} est.`} />
              <MiniMetric label="Signals" value={`${trainingSignals.length} captured`} />
              <MiniMetric label="Production" value={`${productionSkills.length} Skills`} />
              <MiniMetric label="Use cases" value={`${launchableUseCases.length} launchable`} />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={UserRound} label="Active Users" value={activeUsers.toLocaleString()} trend="from Skill adoption" />
        <MetricCard icon={BookOpen} label="Training Completed" value={trainedUsers.toLocaleString()} trend="estimated completion" />
        <MetricCard icon={Network} label="Champion Network" value={champions} trend="recruitment target" />
        <MetricCard icon={Trophy} label="Repeat Usage" value={`${repeatUsage}x`} trend="runs per active user" />
      </div>

      <Panel className="mt-4 overflow-hidden" data-testid="ai-literacy-tracks">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="AI Literacy Tracks"
              helper="Major-company adoption needs role-specific enablement, not one generic training deck."
              compact
            />
            <Badge tone={adoptionScore >= 70 ? "green" : adoptionScore >= 40 ? "amber" : "blue"}>
              {progressLabel(adoptionScore)}
            </Badge>
          </div>
        </div>
        <div className="grid gap-px bg-[var(--border)] md:grid-cols-2 xl:grid-cols-5">
          {adoptionEnablementTracks.map((track) => {
            const trackAction = trackActions[track.audience] ?? { label: "Prepare Report", action: onOpenReports };
            return (
              <button
                key={track.audience}
                type="button"
                aria-label={`${track.audience} enablement: ${trackAction.label}`}
                onClick={trackAction.action}
                className="group flex min-h-[190px] flex-col bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--primary-soft)]/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{track.audience}</div>
                  <GraduationCap size={16} className="text-[var(--primary)]" />
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{track.outcome}</p>
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{track.enablement}</p>
                <p className="mt-3 line-clamp-1 t-eyebrow text-[var(--text-soft)]">{track.measure}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-[var(--primary)]">
                  {trackAction.label}
                  <ArrowRight size={13} />
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <SectionTitle title="Cohort Readiness" helper="Who needs enablement before the rollout can scale." />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {cohortReadiness.map((cohort) => {
              const tone = progressTone(cohort.score);
              return (
                <div key={cohort.cohort} className="grid gap-4 px-5 py-4 lg:grid-cols-[150px_minmax(0,1fr)_116px]">
                  <div>
                    <div className="font-semibold text-[var(--text)]">{cohort.cohort}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{cohort.audience}</div>
                  </div>
                  <div>
                    <p className="text-sm leading-6 text-[var(--text-muted)]">{cohort.next}</p>
                    <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-subtle)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${cohort.score}%` }} />
                    </div>
                  </div>
                  <div className="flex items-start justify-end">
                    <Badge tone={tone}>{progressLabel(cohort.score)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="30-Day Rollout" helper="The next operating cadence." />
          <div className="mt-4 space-y-3">
            {rolloutPath.map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={step.action}
                className="flex w-full gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface-muted)]"
              >
                <div className="mt-0.5">
                  {step.complete ? <CheckCircle2 size={17} className="text-[var(--success)]" /> : <CircleDashed size={17} className="text-[var(--text-soft)]" />}
                </div>
                <div>
                  <div className="t-eyebrow text-[var(--text-soft)]">{step.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">{step.title}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{step.detail}</p>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel className="p-5">
          <SectionTitle title="Weekly Active Users" />
          <div className="mt-4 h-[320px]">
            {skills.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                <LineChart data={adoption}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke="#635bff" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No adoption data yet"
                body="Launch Skills and connect usage analytics to track active users, repeat usage, completion, champions, and feedback."
                action="Open AI Skills"
                onAction={onOpenSkills}
              />
            )}
          </div>
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Skill Enablement Queue" helper="Where coaching should be pointed first." />
          <div className="mt-4 space-y-3">
            {topSkillEnablement.length ? topSkillEnablement.map((skill) => (
              <div key={skill.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <div className="truncate text-sm font-semibold text-[var(--text)]">{skill.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{skill.department}</div>
                  </div>
                  <Badge tone={skill.status === "production" ? "green" : "blue"}>{skill.status.replaceAll("_", " ")}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniMetric label="Users" value={skill.adoptionCount.toLocaleString()} />
                  <MiniMetric label="Runs" value={skill.runs.toLocaleString()} />
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                  {skill.runs < skill.adoptionCount
                    ? "Coach repeat use inside the workflow, not only initial awareness."
                    : "Capture examples and turn the strongest patterns into reusable training moments."}
                </p>
              </div>
            )) : (
              <EmptyState
                title="No Skills ready for enablement"
                body="Create or approve the first Skill before building a company-wide training motion."
                action="Open AI Skills"
                onAction={onOpenSkills}
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel className="p-5">
          <SectionTitle title="Adoption Campaigns" helper="Behavior change motions that make Skills part of daily work" />
          <div className="mt-4 space-y-3">
            {[
              ["HR self-service launch", "Target HR and People Ops managers with office hours and prompt examples.", "Live"],
              ["Finance close power users", "Coach close owners on variance workflows and approval boundaries.", "Live"],
              ["Governance reviewer enablement", "Train reviewers on risk taxonomy, evidence packets, and approval decisions.", "Draft"],
            ].map(([title, body, state]) => (
              <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
                  <Badge tone={state === "Live" ? "green" : "amber"}>{state}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Office Hours" helper="Change management rhythm" />
          <div className="mt-4 space-y-3">
            {[
              [Megaphone, "Monday Launch Standup", "Confirm the cohort, owner, Skill, and adoption proof target."],
              [CalendarDays, "Tuesday Builder Lab", "Workflow Studio, Skills, prompt contracts, and eval setup."],
              [MessageSquareText, "Thursday Function Clinic", "Bring pain points and convert them into scored use cases."],
              [BookOpen, "Friday Reviewer Round", "Review high-risk items and evidence packets before pilot launch."],
            ].map(([Icon, title, body]) => {
              const SessionIcon = Icon as typeof CalendarDays;
              return (
                <div key={String(title)} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <SessionIcon size={17} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{title as string}</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{body as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5 bg-[var(--elev-2)] shadow-[var(--elev-2-shadow)] border-[var(--elev-2-border)]">
          <SectionTitle title="Adoption Funnel" helper="Activated is measured from runs; reachable, trained, and champions are planning estimates" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric label="Reachable (est.)" value={reachableUsers.toLocaleString()} />
            <MiniMetric label="Trained (est.)" value={trainedUsers.toLocaleString()} />
            <MiniMetric label="Activated" value={activeUsers.toLocaleString()} />
            <MiniMetric label="Champions (target)" value={champions.toLocaleString()} />
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={onOpenSkills}>
            <Library size={15} />
            Open Skills for enablement
          </Button>
        </Panel>
      </div>

      {guideOpen ? (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-black/40 p-2 backdrop-blur-sm sm:p-4"
          data-testid="playbook-guide-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedPlaybook.guide.title} preview`}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close guide preview"
            onClick={() => setGuideOpen(false)}
          />
          <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={playbookStageTone(selectedPlaybook.stage)}>{playbookStageLabel(selectedPlaybook.stage)}</Badge>
                  <Badge tone={lifecycleStatusTone(selectedPlaybook.lifecycle.status)}>
                    {selectedPlaybook.lifecycle.statusLabel}
                  </Badge>
                </div>
                <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight text-[var(--text)]">{selectedPlaybook.guide.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{selectedPlaybook.guide.summary}</p>
              </div>
              <button
                type="button"
                aria-label="Close guide preview"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]"
                onClick={() => setGuideOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Source" value={selectedPlaybook.guide.sourceLabel} />
                <MiniMetric label="Owner" value={selectedPlaybook.owner} />
                <MiniMetric label="Audience" value={selectedPlaybook.audience} />
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-start gap-3">
                  <FileText size={17} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Reader note</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{selectedPlaybook.guide.ownerNote}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle title="Workflow steps" helper="Scribe-style captured path converted into a governed guide." compact />
                  <Badge tone="purple">{selectedPlaybook.guide.steps.length} steps</Badge>
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                  {selectedPlaybook.guide.steps.map((step, index) => (
                    <div
                      key={`${step.label}-${index}`}
                      className={`grid gap-3 bg-[var(--surface)] p-4 sm:grid-cols-[40px_minmax(0,1fr)_minmax(180px,0.48fr)] ${
                        index ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{step.helper}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{step.owner}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{step.evidence}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle title="Training checks" helper="Generated from the workflow, risks, and source context." compact />
                    <GraduationCap size={16} className="text-[var(--primary)]" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedPlaybook.guide.quizChecks.map((check) => (
                      <div key={check} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                        {check}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle title="Assistant context" helper="What can safely become answerable knowledge." compact />
                    <BrainCircuit size={16} className="text-[var(--primary)]" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedPlaybook.guide.assistantContext.map((line) => (
                      <div key={line} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle title="Publish targets" helper="Whale-style SOP, training, quiz, context, and proof destinations." compact />
                  <Badge tone="blue">{selectedPlaybook.guide.publishTargets.filter((target) => target.status === "ready").length}/{selectedPlaybook.guide.publishTargets.length} ready</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedPlaybook.guide.publishTargets.map((target) => (
                    <button
                      key={target.label}
                      type="button"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-left transition hover:border-[var(--primary)]/28 hover:bg-[var(--surface)]"
                      onClick={playbookActionMap[target.targetView]}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-[var(--text)]">{target.label}</span>
                        <Badge tone={lifecycleTaskTone(target.status)}>{target.status}</Badge>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{target.helper}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
              <Button onClick={() => openPlaybookTarget(selectedPlaybook)}>
                <ArrowRight size={15} />
                Open next step
              </Button>
              <Button variant="secondary" onClick={() => onOpenView("orchestrator")}>
                <MessageSquareText size={15} />
                Ask from guide
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
