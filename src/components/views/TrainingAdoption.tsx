import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FileText,
  GraduationCap,
  Library,
  Megaphone,
  MessageSquareText,
  Network,
  Target,
  Trophy,
  UserRound,
  Workflow,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, EmptyState, MetricCard, MiniMetric, Panel, SectionTitle, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { type Skill, type UseCase, type WorkSignal } from "@/lib/enterprise-ai-data";

type TrainingAdoptionProps = {
  skills: Skill[];
  useCases: UseCase[];
  workSignals: WorkSignal[];
  onOpenSkills: () => void;
  onOpenWork: () => void;
  onOpenFactory: () => void;
  onOpenReports: () => void;
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

export function TrainingAdoption({
  skills,
  useCases,
  workSignals,
  onOpenSkills,
  onOpenWork,
  onOpenFactory,
  onOpenReports,
}: TrainingAdoptionProps) {
  const activeUsers = skills.reduce((sum, skill) => sum + skill.adoptionCount, 0);
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
      audience: `${Math.max(activeUsers, trainedUsers) + 120} reachable employees`,
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
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{nextAction.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{nextAction.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenSkills}>
                  <Library size={15} />
                  Skill catalog
                </Button>
                <Button onClick={nextAction.action}>
                  <ArrowRight size={15} />
                  Next move
                </Button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Launch cohort" value={activeUsers ? `${activeUsers.toLocaleString()} active` : "Not selected"} />
              <MiniMetric label="Training gap" value={trainingGap ? `${trainingGap.toLocaleString()} users` : "Closed"} />
              <MiniMetric label="Habit signal" value={`${repeatUsage}x runs/user`} />
              <MiniMetric label="Champions" value={`${champions} named`} />
            </div>
          </div>
          <div className="border-t border-slate-200/70 bg-slate-50/70 p-6 xl:border-l xl:border-t-0">
            <SectionTitle title="Adoption Health" helper="Readiness for a wider rollout." compact />
            <div className="mt-5">
              <div className="flex items-end justify-between gap-4">
                <div className="text-5xl font-semibold leading-none tracking-tight text-slate-950">{adoptionScore}</div>
                <Badge tone={progressTone(adoptionScore)}>{progressLabel(adoptionScore)}</Badge>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white ring-1 ring-slate-200/70">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${adoptionScore}%` }} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <MiniMetric label="Training" value={`${trainedUsers.toLocaleString()} complete`} />
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
        <MetricCard icon={Network} label="Champion Network" value={champions} trend="department advocates" />
        <MetricCard icon={Trophy} label="Repeat Usage" value={`${repeatUsage}x`} trend="runs per active user" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-slate-200/70 px-5 py-4">
            <SectionTitle title="Cohort Readiness" helper="Who needs enablement before the rollout can scale." />
          </div>
          <div className="divide-y divide-slate-100">
            {cohortReadiness.map((cohort) => {
              const tone = progressTone(cohort.score);
              return (
                <div key={cohort.cohort} className="grid gap-4 px-5 py-4 lg:grid-cols-[150px_minmax(0,1fr)_116px]">
                  <div>
                    <div className="font-semibold text-slate-950">{cohort.cohort}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{cohort.audience}</div>
                  </div>
                  <div>
                    <p className="text-sm leading-6 text-slate-600">{cohort.next}</p>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-100">
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
                className="flex w-full gap-3 rounded-lg border border-slate-200/70 bg-white/70 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-white"
              >
                <div className="mt-0.5">
                  {step.complete ? <CheckCircle2 size={17} className="text-green-600" /> : <CircleDashed size={17} className="text-slate-400" />}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{step.label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{step.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>
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
                action="Open Skills Library"
                onAction={onOpenSkills}
              />
            )}
          </div>
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Skill Enablement Queue" helper="Where coaching should be pointed first." />
          <div className="mt-4 space-y-3">
            {topSkillEnablement.length ? topSkillEnablement.map((skill) => (
              <div key={skill.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <div className="truncate text-sm font-semibold text-slate-950">{skill.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{skill.department}</div>
                  </div>
                  <Badge tone={skill.status === "production" ? "green" : "blue"}>{skill.status.replaceAll("_", " ")}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniMetric label="Users" value={skill.adoptionCount.toLocaleString()} />
                  <MiniMetric label="Runs" value={skill.runs.toLocaleString()} />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {skill.runs < skill.adoptionCount
                    ? "Coach repeat use inside the workflow, not only initial awareness."
                    : "Capture examples and turn the strongest patterns into reusable training moments."}
                </p>
              </div>
            )) : (
              <EmptyState
                title="No Skills ready for enablement"
                body="Create or approve the first Skill before building a company-wide training motion."
                action="Open Skills Library"
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
              <div key={title} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{title}</div>
                  <Badge tone={state === "Live" ? "green" : "amber"}>{state}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
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
                <div key={String(title)} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <SessionIcon size={17} className="mt-0.5 shrink-0 text-[#5147e8]" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{title as string}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{body as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Adoption Funnel" helper="Where users are in the enablement journey" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric label="Aware" value={String(Math.max(activeUsers, trainedUsers) + 120)} />
            <MiniMetric label="Trained" value={String(trainedUsers)} />
            <MiniMetric label="Activated" value={String(activeUsers)} />
            <MiniMetric label="Champions" value={String(champions)} />
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={onOpenSkills}>
            <Library size={15} />
            Open Skills for enablement
          </Button>
        </Panel>
      </div>
    </div>
  );
}
