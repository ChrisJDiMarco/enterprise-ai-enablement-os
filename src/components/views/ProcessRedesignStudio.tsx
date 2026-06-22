import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Boxes,
  BrainCircuit,
  Check,
  CircleDashed,
  FilePlus2,
  FileText,
  GitBranch,
  GraduationCap,
  Import,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  MonitorPlay,
  Share2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Badge, Button, Field, MiniMetric, Panel, SectionTitle, riskTone, statusTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";
import { statusLabels } from "@/lib/ui/constants";
import { deriveWorkflowCapturePacket, type WorkflowProcedureArtifact } from "@/lib/workflow-capture";

function blockTone(tone: string) {
  if (tone === "green") return "bg-[var(--success-soft)] text-[var(--success)]";
  if (tone === "blue") return "bg-[var(--info-soft)] text-[var(--info)]";
  if (tone === "purple") return "bg-[var(--primary-soft)] text-[var(--primary)]";
  if (tone === "amber") return "bg-[var(--warning-soft)] text-[var(--warning)]";
  if (tone === "red") return "bg-[var(--danger-soft)] text-[var(--danger)]";
  return "bg-[var(--surface-subtle)] text-[var(--text-muted)]";
}

function decisionTone(value: string) {
  if (value.includes("Human-led")) return "amber";
  if (value.includes("approval gates")) return "blue";
  if (value.includes("Reusable")) return "green";
  return "slate";
}

function procedureStatusLabel(status: WorkflowProcedureArtifact["status"]) {
  if (status === "ready_to_publish") return "ready to publish";
  if (status === "needs_sources") return "needs sources";
  if (status === "needs_skill") return "needs Skill";
  return "draft";
}

function procedureStatusTone(status: WorkflowProcedureArtifact["status"]) {
  if (status === "ready_to_publish") return "green";
  if (status === "needs_sources" || status === "needs_skill") return "amber";
  return "slate";
}

function captureReviewTone(status: "empty" | "needs_capture" | "needs_review" | "publish_ready") {
  if (status === "publish_ready") return "green";
  if (status === "needs_review") return "blue";
  if (status === "needs_capture") return "amber";
  return "slate";
}

function captureItemTone(status: "ready" | "attention" | "missing") {
  if (status === "ready") return "green";
  if (status === "attention") return "amber";
  return "slate";
}

function pipelineStageTone(status: "ready" | "next" | "blocked") {
  if (status === "ready") return "green";
  if (status === "next") return "blue";
  return "slate";
}

function insightTone(status: "ready" | "attention" | "missing") {
  if (status === "ready") return "green";
  if (status === "attention") return "amber";
  return "slate";
}

function captureSourceTone(status: "ready" | "available" | "missing") {
  if (status === "ready") return "green";
  if (status === "available") return "blue";
  return "slate";
}

export function ProcessRedesignStudio({
  useCases,
  selectedUseCase,
  skills,
  workSignals,
  setSelectedUseCaseId,
  onOpenFactory,
  onOpenWorkflow,
  onOpenSkills,
  onOpenTraining,
  onOpenOrchestrator,
}: {
  useCases: UseCase[];
  selectedUseCase: UseCase | null;
  skills: Skill[];
  workSignals: WorkSignal[];
  setSelectedUseCaseId: (id: string) => void;
  onOpenFactory: () => void;
  onOpenWorkflow: () => void;
  onOpenSkills: () => void;
  onOpenTraining: () => void;
  onOpenOrchestrator: () => void;
}) {
  const activeUseCase = selectedUseCase ?? useCases[0] ?? null;
  const linkedSkill =
    activeUseCase
      ? skills.find((skill) => skill.id === activeUseCase.linkedSkillId) ??
        skills.find((skill) => skill.useCaseId === activeUseCase.id) ??
        null
      : null;
  const capturePacket = deriveWorkflowCapturePacket({
    useCase: activeUseCase,
    skill: linkedSkill,
    workSignals,
  });
  const monthlyVolume = activeUseCase?.monthlyVolume ?? 0;
  const currentMinutes = activeUseCase?.avgHandlingTimeMinutes ?? 0;
  const targetMinutes = Math.max(1, Math.round(currentMinutes * 0.58));
  const monthlyHoursSaved = Math.max(0, Math.round((monthlyVolume * Math.max(0, currentMinutes - targetMinutes)) / 60));
  const currentCycleDays = activeUseCase?.estimatedUsers ? Math.max(1, Math.round((activeUseCase.estimatedUsers / 40) * 2)) : 0;
  const futureCycleDays = currentCycleDays ? Math.max(1, Math.round(currentCycleDays * 0.62)) : 0;
  const redesignRecommendation = activeUseCase
    ? activeUseCase.riskLevel === "restricted"
      ? "Human-led redesign with AI drafting only"
      : activeUseCase.riskLevel === "high"
        ? "Augmented workflow with approval gates"
        : activeUseCase.reuseScore >= 4
          ? "Reusable Skill pattern with governed workflow"
          : "Targeted copilot or automation assist"
    : "No process selected";
  const readinessSteps = [
    {
      label: "Understand today",
      helper: activeUseCase?.currentProcess || "Capture the current handoffs, systems, delays, and exceptions.",
      complete: Boolean(activeUseCase?.currentProcess),
    },
    {
      label: "Design AI assist",
      helper: activeUseCase?.desiredOutcome || "Define the outcome, AI support, and what must stay human-owned.",
      complete: Boolean(activeUseCase?.desiredOutcome),
    },
    {
      label: "Add controls",
      helper: activeUseCase ? `${activeUseCase.riskLevel} risk sets the review, tool, and evidence gates.` : "Risk decides review, tool, and evidence gates.",
      complete: Boolean(activeUseCase),
    },
  ];
  const operatingFlow = [
    {
      title: "Intake is structured",
      owner: "Business owner",
      helper: "Volume, outcome, risk, data sources, and success metrics are captured before automation.",
      tone: "blue",
    },
    {
      title: "AI prepares the work",
      owner: "AI Skill",
      helper: "The Skill retrieves approved context, drafts the next action, and shows source evidence.",
      tone: "green",
    },
    {
      title: "Human reviews the boundary",
      owner: "Accountable approver",
      helper: "Sensitive decisions, external communication, and high-risk outputs stay human-gated.",
      tone: "purple",
    },
    {
      title: "Workflow executes safely",
      owner: "Workflow Builder",
      helper: "Tools, approvals, logs, and rollback points are explicit before launch.",
      tone: "amber",
    },
    {
      title: "Proof is captured",
      owner: "Evidence Ledger",
      helper: "Runs, evals, feedback, cycle time, and value flow into launch and executive reporting.",
      tone: "green",
    },
  ];
  const controlPoints = [
    "Data owner approval before indexing",
    "Human review for high-risk outputs",
    "Tool policy before write actions",
    "Eval suite before pilot expansion",
    "Evidence packet before executive readout",
  ];
  const hasCurrentProcess = Boolean(activeUseCase?.currentProcess);
  const hasDesiredOutcome = Boolean(activeUseCase?.desiredOutcome);
  const hasDataSources = Boolean(activeUseCase?.dataSources.length);
  const hasValueBaseline = monthlyVolume > 0 && currentMinutes > 0;
  const workflowReady = hasCurrentProcess && hasDesiredOutcome && hasDataSources && hasValueBaseline;
  const redesignPathSteps = [
    {
      label: "Choose work",
      title: activeUseCase?.title ?? "Select a use case",
      body: activeUseCase
        ? `${activeUseCase.department} has a scoped problem, risk level, and owner path ready for redesign.`
        : "Pick the business work before drawing an AI workflow.",
      status: activeUseCase ? statusLabels[activeUseCase.status] : "Not selected",
      complete: Boolean(activeUseCase),
      actionLabel: "Open Use Cases",
      action: onOpenFactory,
    },
    {
      label: "Map today",
      title: hasCurrentProcess ? "Current workflow captured" : "Capture today's workflow",
      body: activeUseCase?.currentProcess || "Document the handoffs, systems, delays, exceptions, and manual interpretation before adding AI.",
      status: hasCurrentProcess ? "Mapped" : "Needed",
      complete: hasCurrentProcess,
      actionLabel: "Open Use Cases",
      action: onOpenFactory,
    },
    {
      label: "Set AI boundary",
      title: redesignRecommendation,
      body: hasDesiredOutcome
        ? `${activeUseCase?.desiredOutcome} Keep sensitive decisions, high-risk output, and external actions human-accountable.`
        : "Define what AI drafts, retrieves, routes, or prepares, and what humans must still own.",
      status: activeUseCase?.riskLevel ?? "No risk",
      complete: hasDesiredOutcome && Boolean(activeUseCase),
      actionLabel: hasDesiredOutcome && activeUseCase ? "Build workflow" : "Open Use Cases",
      action: hasDesiredOutcome && activeUseCase ? onOpenWorkflow : onOpenFactory,
    },
    {
      label: "Compile safely",
      title: workflowReady ? "Ready for workflow build" : "Add baseline and data gates",
      body: workflowReady
        ? "The workflow can move into Builder with source boundaries, value baseline, and handoff intent."
        : "Add data sources plus volume and handling-time baseline so the workflow can prove impact after launch.",
      status: workflowReady ? "Ready" : "Needs inputs",
      complete: workflowReady,
      actionLabel: workflowReady ? "Build workflow" : "Open Use Cases",
      action: workflowReady ? onOpenWorkflow : onOpenFactory,
    },
  ];
  const completedRedesignSteps = redesignPathSteps.filter((step) => step.complete).length;
  const nextRedesignStep = redesignPathSteps.find((step) => !step.complete) ?? redesignPathSteps[redesignPathSteps.length - 1];
  const headerPrimaryAction = workflowReady
    ? {
        label: "Build workflow",
        icon: Workflow,
        action: onOpenWorkflow,
      }
    : {
        label: activeUseCase ? "Complete use case" : "Create use case",
        icon: Boxes,
        action: onOpenFactory,
      };
  const HeaderPrimaryIcon = headerPrimaryAction.icon;
  const pipelineActionMap = {
    capture: onOpenFactory,
    clean: onOpenFactory,
    write: onOpenSkills,
    train: onOpenTraining,
    publish: onOpenOrchestrator,
    prove: onOpenTraining,
  } satisfies Record<(typeof capturePacket.pipeline)[number]["id"], () => void>;

  return (
    <div>
      <PageHeader
        title="Process Redesign"
        subtitle="Turn a use case into a clear human and AI workflow before anything launches."
        action={
          <div className="flex flex-wrap gap-2">
            {activeUseCase ? (
              <Button variant="secondary" onClick={onOpenFactory}>
                <Boxes size={16} />
                Open Use Cases
              </Button>
            ) : null}
            <Button onClick={headerPrimaryAction.action}>
              <HeaderPrimaryIcon size={16} />
              {headerPrimaryAction.label}
            </Button>
          </div>
        }
      />

      {!activeUseCase ? (
        <>
          <Panel className="p-5 sm:p-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">start here</span>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">Choose a use case before designing the workflow</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
              Process Redesign starts from real demand: the business problem, today&apos;s work, desired outcome, risk, volume, and owner. Create a use case first, then return here to map the human and AI handoff.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={onOpenFactory}>
                <Boxes size={15} />
                Create use case
              </Button>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {[
                ["Pick the work", "Start from a repeated pain point with value and ownership."],
                ["Map the handoff", "Decide where AI drafts, retrieves, routes, or acts."],
                ["Prove control", "Add human review, tool policy, evals, and evidence before launch."],
              ].map(([label, helper], index) => (
                <div key={label} className="border-l border-[var(--border)] pl-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--text-muted)] ring-1 ring-[var(--border)]">{index + 1}</span>
                    <div className="font-semibold text-[var(--text)]">{label}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="mt-4 overflow-hidden" data-testid="workflow-capture-studio">
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="min-w-0 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">capture studio</Badge>
                  <Badge tone="amber">use case required</Badge>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/12">
                    <MonitorPlay size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Workflow Capture Studio</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text)]">{capturePacket.title}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{capturePacket.summary}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {capturePacket.captureModes.map((mode) => {
                    const ModeIcon =
                      mode.id === "record"
                        ? MonitorPlay
                        : mode.id === "import"
                          ? Import
                          : mode.id === "write"
                            ? BookOpenCheck
                            : mode.id === "quiz"
                              ? ListChecks
                              : BrainCircuit;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={onOpenFactory}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]/28 hover:shadow-[var(--shadow-button)]"
                      >
                        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                          <ModeIcon size={15} />
                        </span>
                        <span className="mt-3 block text-sm font-semibold text-[var(--text)]">{mode.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{mode.helper}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/82" data-testid="capture-recorder-review">
                  <div className="grid grid-cols-1 gap-px bg-[var(--border)]/70 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <div className="bg-[var(--surface)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Recorder review</div>
                          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Waiting for a workflow</h3>
                        </div>
                        <Badge tone={captureReviewTone(capturePacket.review.status)}>{capturePacket.review.statusLabel}</Badge>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-4">
                        <div className="text-4xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{capturePacket.review.qualityScore}</div>
                        <div className="min-w-0 flex-1">
                          <div className="h-2 rounded-full bg-[var(--surface-subtle)]">
                            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${capturePacket.review.qualityScore}%` }} />
                          </div>
                          <div className="mt-1 truncate text-[11px] font-medium text-[var(--text-muted)]">
                            {capturePacket.review.editQueue[0]?.helper ?? "Choose a use case to begin."}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[var(--surface)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <SectionTitle title="Capture checklist" helper="What the recorder will look for once a workflow exists." compact />
                        <Badge tone="purple">{capturePacket.review.artifacts.length} inputs</Badge>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {capturePacket.review.artifacts.map((artifact) => (
                          <button
                            key={artifact.id}
                            type="button"
                            onClick={onOpenFactory}
                            className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-[var(--text)]">{artifact.label}</span>
                              <Badge tone={captureItemTone(artifact.status)}>{artifact.status}</Badge>
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">{artifact.helper}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 lg:border-l lg:border-t-0">
                <SectionTitle title="What this creates" helper="The capture studio turns a workflow into reusable operating knowledge." compact />
                <div className="mt-4 space-y-3">
                  {[
                    ["SOP", "Step-by-step procedure with owner notes, exceptions, and source evidence."],
                    ["Training", "Role-based assignment, completion signal, and launch cohort readiness."],
                    ["Quiz", "Validation checks generated from the SOP and risk controls."],
                    ["Agent context", "Approved workflow context for assistant answers and governed Skills."],
                  ].map(([label, body]) => (
                    <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                      <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3" data-testid="procedure-packet-empty-preview">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Procedure packet output</div>
                    <Badge tone={procedureStatusTone(capturePacket.procedure.status)}>{procedureStatusLabel(capturePacket.procedure.status)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {capturePacket.procedure.exports.map((target) => (
                      <div key={target.id} className="flex items-start gap-2 rounded-md bg-[var(--surface-muted)] px-2.5 py-2">
                        <FileText size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-[var(--text)]">{target.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">{target.helper}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={onOpenFactory}>
                  <FilePlus2 size={15} />
                  Create first use case
                </Button>
              </div>
            </div>
          </Panel>
        </>
      ) : (
        <>
          <Panel className="overflow-hidden" data-testid="process-primary-decision">
            <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={riskTone(activeUseCase.riskLevel)}>{activeUseCase.riskLevel}</Badge>
                  <Badge tone={statusTone(activeUseCase.status)}>{statusLabels[activeUseCase.status]}</Badge>
                  <Badge tone="blue">{activeUseCase.department}</Badge>
                  <Badge tone={workflowReady ? "green" : "amber"}>
                    {completedRedesignSteps}/{redesignPathSteps.length} ready
                  </Badge>
                </div>
                <h2 className="mt-4 max-w-4xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                  {nextRedesignStep.title}
                </h2>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                  {nextRedesignStep.body}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={nextRedesignStep.action} data-testid="process-primary-next-action">
                    {workflowReady ? <Workflow size={15} /> : <Boxes size={15} />}
                    {nextRedesignStep.actionLabel}
                  </Button>
                  <Button variant="secondary" onClick={onOpenFactory}>
                    Open Use Cases
                    <ArrowRight size={14} />
                  </Button>
                </div>

                <div className="mt-5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)]/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Process being redesigned</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--text)]">{activeUseCase.title}</div>
                    </div>
                    <Badge tone={decisionTone(redesignRecommendation)}>{redesignRecommendation}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{activeUseCase.businessProblem}</p>
                </div>

              </div>

              <div className="hidden border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 md:block xl:border-l xl:border-t-0">
                <Field label="Selected use case">
                  <select
                    className="input"
                    value={activeUseCase.id}
                    onChange={(event) => setSelectedUseCaseId(event.target.value)}
                  >
                    {useCases.map((useCase) => (
                      <option key={useCase.id} value={useCase.id}>
                        {useCase.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Value baseline</div>
                    <Badge tone={hasValueBaseline ? "green" : "amber"}>{hasValueBaseline ? "modeled" : "needed"}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-semibold tabular-nums text-[var(--primary)]">
                    {hasValueBaseline ? `${monthlyHoursSaved.toLocaleString()} hours/month potential` : "Add volume and handling time"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Use this baseline to prove the redesigned workflow actually reduces cycle time after launch.
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric label="Monthly volume" value={monthlyVolume.toLocaleString()} />
                  <MiniMetric label="Hours saved" value={monthlyHoursSaved.toLocaleString()} />
                  <MiniMetric label="Today" value={currentMinutes ? `${currentMinutes} min` : "Unset"} />
                  <MiniMetric label="Target" value={currentMinutes ? `${targetMinutes} min` : "Unset"} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="mt-4 overflow-hidden" data-testid="workflow-capture-studio">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={capturePacket.readiness >= 78 ? "green" : capturePacket.readiness >= 45 ? "blue" : "amber"}>
                    {capturePacket.readiness}% capture-ready
                  </Badge>
                  <Badge tone={capturePacket.agentContext.ready ? "green" : "slate"}>
                    {capturePacket.agentContext.ready ? "agent context ready" : "context gaps"}
                  </Badge>
                  <Badge tone={linkedSkill ? "purple" : "amber"}>{linkedSkill ? "Skill attached" : "Skill needed"}</Badge>
                </div>
                <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/12">
                        <MonitorPlay size={20} />
                      </div>
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">
                          Workflow Capture Studio
                        </div>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text)]">{capturePacket.title}</h2>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{capturePacket.summary}</p>
                  </div>
                  <Button onClick={capturePacket.agentContext.ready ? onOpenOrchestrator : onOpenFactory}>
                    {capturePacket.agentContext.ready ? <BrainCircuit size={15} /> : <FilePlus2 size={15} />}
                    {capturePacket.agentContext.ready ? "Open Assistant Context" : "Complete Capture"}
                  </Button>
                </div>

	                <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/82" data-testid="workflow-guide-pipeline">
	                  <div className="grid gap-px bg-[var(--border)]/70 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
	                    <div className="bg-[var(--surface)] p-4">
	                      <div className="flex items-start justify-between gap-3">
	                        <div>
	                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Guide pipeline</div>
	                          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">{capturePacket.headline}</h3>
	                        </div>
	                        <Badge tone={capturePacket.readiness >= 78 ? "green" : capturePacket.readiness >= 45 ? "blue" : "amber"}>
	                          {capturePacket.readiness}%
	                        </Badge>
	                      </div>
	                      <div className="mt-4 grid grid-cols-2 gap-2">
	                        {capturePacket.insights.map((insight) => (
	                          <button
	                            key={insight.id}
	                            type="button"
	                            onClick={insight.id === "agent" ? onOpenOrchestrator : insight.id === "training" ? onOpenTraining : onOpenFactory}
	                            className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
	                          >
	                            <span className="flex items-center justify-between gap-2">
	                              <span className="text-xs font-semibold text-[var(--text-muted)]">{insight.label}</span>
	                              <Badge tone={insightTone(insight.status)}>{insight.status}</Badge>
	                            </span>
	                            <span className="mt-1 block text-lg font-semibold tracking-tight text-[var(--text)]">{insight.value}</span>
	                            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{insight.helper}</span>
	                          </button>
	                        ))}
	                      </div>
	                    </div>
	                    <div className="bg-[var(--surface)] p-4">
	                      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
	                        {capturePacket.pipeline.map((stage, index) => (
	                          <button
	                            key={stage.id}
	                            type="button"
	                            onClick={pipelineActionMap[stage.id]}
	                            className={`group rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-button)] ${
	                              stage.status === "ready"
	                                ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))] bg-[var(--success-soft)]"
	                                : stage.status === "next"
	                                  ? "border-[var(--primary)]/32 bg-[var(--primary-soft)]/58"
	                                  : "border-[var(--border)] bg-[var(--surface-muted)]/52"
	                            }`}
	                          >
	                            <span className="flex items-center justify-between gap-2">
	                              <span className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold ${stage.status === "ready" ? "bg-[var(--success-soft)] text-[var(--success)]" : stage.status === "next" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"}`}>
	                                {stage.status === "ready" ? <Check size={13} /> : index + 1}
	                              </span>
	                              <Badge tone={pipelineStageTone(stage.status)}>{stage.status}</Badge>
	                            </span>
	                            <span className="mt-3 block text-sm font-semibold text-[var(--text)]">{stage.label}</span>
	                            <span className="mt-1 block truncate text-[11px] leading-5 text-[var(--text-muted)]">{stage.helper}</span>
	                          </button>
	                        ))}
	                      </div>
	                    </div>
	                  </div>
	                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.05fr)_minmax(0,0.9fr)]" data-testid="workflow-capture-command-layer">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <SectionTitle title="Capture channels" helper="Scribe-style source paths for turning work into a guide." compact />
                      <MonitorPlay size={16} className="text-[var(--primary)]" />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {capturePacket.sources.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          onClick={source.id === "import" ? onOpenFactory : onOpenWorkflow}
                          className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/56 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-[var(--text)]">{source.label}</span>
                            <Badge tone={captureSourceTone(source.status)}>{source.status}</Badge>
                          </span>
                          <span className="mt-1 block truncate text-[11px] leading-4 text-[var(--text-muted)]">{source.evidence}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <SectionTitle title="Publish everywhere" helper="Whale/Scribe distribution without making people hunt for docs." compact />
                      <Share2 size={16} className="text-[var(--primary)]" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {capturePacket.distribution.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onClick={
                            target.id === "agent_context"
                              ? onOpenOrchestrator
                              : target.id === "training_flow"
                                ? onOpenTraining
                                : target.id === "audit_export"
                                  ? onOpenTraining
                                  : onOpenFactory
                          }
                          className="grid w-full grid-cols-[minmax(0,1fr)_72px] items-center gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/56 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-xs font-semibold text-[var(--text)]">{target.label}</span>
                              <Badge tone={captureItemTone(target.status)}>{target.audience}</Badge>
                            </span>
                            <span className="mt-1 block truncate text-[11px] leading-4 text-[var(--text-muted)]">{target.helper}</span>
                          </span>
                          <span className="text-right text-sm font-semibold tabular-nums text-[var(--text)]">{target.readiness}%</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <SectionTitle title="Security controls" helper="Redaction, permissions, review cadence, and versions." compact />
                        <LockKeyhole size={16} className="text-[var(--primary)]" />
                      </div>
                      <div className="mt-3 space-y-2">
                        {capturePacket.security.map((control) => (
                          <button
                            key={control.id}
                            type="button"
                            onClick={control.id === "permissions" ? onOpenSkills : onOpenFactory}
                            className="flex w-full items-start justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/56 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-[var(--text)]">{control.label}</span>
                              <span className="mt-1 block truncate text-[11px] leading-4 text-[var(--text-muted)]">{control.evidence}</span>
                            </span>
                            <Badge tone={captureItemTone(control.status)}>{control.status}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <SectionTitle title="Guide analytics" helper={capturePacket.analytics.summary} compact />
                        <BarChart3 size={16} className="text-[var(--primary)]" />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {capturePacket.analytics.signals.map((signal) => (
                          <div key={signal.label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/56 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-[11px] font-semibold text-[var(--text-muted)]">{signal.label}</div>
                              <Badge tone={captureItemTone(signal.status)}>{signal.status}</Badge>
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{signal.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/82" data-testid="capture-recorder-review">
                  <div className="grid gap-px bg-[var(--border)]/70 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="bg-[var(--surface)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Recorder review</div>
                          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Observed path quality</h3>
                        </div>
                        <Badge tone={captureReviewTone(capturePacket.review.status)}>{capturePacket.review.statusLabel}</Badge>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-4">
                        <div className="text-4xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{capturePacket.review.qualityScore}</div>
                        <div className="min-w-0 flex-1">
                          <div className="h-2 rounded-full bg-[var(--surface-subtle)]">
                            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${capturePacket.review.qualityScore}%` }} />
                          </div>
                          <div className="mt-1 truncate text-[11px] font-medium text-[var(--text-muted)]">
                            {capturePacket.review.editQueue[0]?.helper ?? "Steps, sources, controls, and context are ready."}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {capturePacket.review.artifacts.slice(0, 4).map((artifact) => (
                          <button
                            key={artifact.id}
                            type="button"
                            onClick={artifact.status === "ready" ? onOpenWorkflow : onOpenFactory}
                            className="flex w-full items-start justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-[var(--text)]">{artifact.label}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{artifact.helper}</span>
                            </span>
                            <Badge tone={captureItemTone(artifact.status)}>{artifact.status}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[var(--surface)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <SectionTitle title="Step evidence" helper="Captured path that becomes guide, training, and agent context." compact />
                        <Badge tone="purple">{capturePacket.review.observedSteps.length} steps</Badge>
                      </div>
                      <div className="mt-4 space-y-2">
                        {capturePacket.review.observedSteps.slice(0, 4).map((step, index) => (
                          <div key={step.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/54 p-2.5">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                              {index + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-[var(--text)]">{step.label}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{step.proof}</span>
                            </span>
                            <Badge tone={captureItemTone(step.status)}>{step.owner}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {capturePacket.review.publishGates.map((gate) => (
                          <button
                            key={gate.id}
                            type="button"
                            onClick={gate.status === "ready" ? onOpenTraining : onOpenFactory}
                            className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-[var(--text)]">{gate.label}</span>
                              <Badge tone={captureItemTone(gate.status)}>{gate.status}</Badge>
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">{gate.helper}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

	                <details className="mt-5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/78">
	                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-[var(--surface-muted)]/70 px-4 py-3">
	                    <div>
	                      <div className="text-sm font-semibold text-[var(--text)]">Generated workflow guide</div>
	                      <div className="mt-1 text-xs text-[var(--text-muted)]">{capturePacket.steps.length} steps available for SOP, training, quiz, and assistant context.</div>
	                    </div>
	                    <ArrowRight size={15} className="shrink-0 text-[var(--text-soft)]" />
	                  </summary>
	                  <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-5">
	                    {capturePacket.steps.map((step, index) => (
	                      <div key={step.id} className="bg-[var(--surface)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                            {index + 1}
                          </span>
                          <Badge tone={step.owner === "AI Skill" ? "purple" : step.owner === "Reviewer" ? "amber" : "slate"}>{step.owner}</Badge>
                        </div>
                        <div className="mt-4 text-sm font-semibold text-[var(--text)]">{step.title}</div>
                        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{step.body}</p>
                        <div className="mt-3 rounded-md bg-[var(--surface-muted)] px-2 py-1.5 text-[11px] font-medium leading-4 text-[var(--text-soft)]">
                          {step.evidence}
                        </div>
	                      </div>
	                    ))}
	                  </div>
	                </details>

	                <details className="mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/82" data-testid="procedure-packet-preview">
	                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-[var(--border)] bg-[linear-gradient(135deg,rgba(66,72,217,0.08),transparent_48%,rgba(15,138,157,0.08))] px-4 py-4">
	                    <div className="flex flex-wrap items-start justify-between gap-3">
	                      <div className="flex min-w-0 items-start gap-3">
	                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--text)] text-[var(--surface)] shadow-[var(--shadow-button)]">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Procedure packet preview</div>
                          <h3 className="mt-1 truncate text-xl font-semibold tracking-tight text-[var(--text)]">{capturePacket.procedure.title}</h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={procedureStatusTone(capturePacket.procedure.status)}>{procedureStatusLabel(capturePacket.procedure.status)}</Badge>
                            <Badge tone="slate">{capturePacket.procedure.version}</Badge>
                            <Badge tone="blue">{capturePacket.procedure.audience}</Badge>
	                          </div>
	                        </div>
	                      </div>
	                      <ArrowRight size={15} className="shrink-0 text-[var(--text-soft)]" />
	                    </div>
	                  </summary>

	                  <div className="grid gap-px bg-[var(--border)]/72 md:grid-cols-2 xl:grid-cols-3">
	                    {capturePacket.procedure.modules.map((module) => (
                      <div key={module.id} className="bg-[var(--surface)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-[var(--text)]">{module.label}</div>
                          <Badge tone={module.ready ? "green" : "amber"}>{module.publishTo}</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{module.body}</p>
                        <div className="mt-3 rounded-md bg-[var(--surface-muted)] px-2 py-1.5 text-[11px] font-medium leading-4 text-[var(--text-soft)]">
                          {module.evidence}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--border)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text)]">Operator step guide</div>
                      <Badge tone="purple">{capturePacket.procedure.stepGuide.length} governed steps</Badge>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
                      {capturePacket.procedure.stepGuide.map((step, index) => (
                        <div
                          key={step.id}
                          className={`grid gap-3 p-3 text-xs leading-5 md:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)] ${
                            index ? "border-t border-[var(--border)]" : ""
                          }`}
                        >
                          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] font-bold text-[var(--primary)]">{index + 1}</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--text)]">{step.action}</div>
                            <div className="mt-1 text-[var(--text-muted)]">{step.humanOwner} · {step.systemOfRecord}</div>
                          </div>
                          <div className="min-w-0 rounded-md bg-[var(--surface-muted)] px-2.5 py-2 text-[var(--text-muted)]">
                            <span className="font-semibold text-[var(--text)]">AI support:</span> {step.aiSupport}
                          </div>
                        </div>
	                      ))}
	                    </div>
	                  </div>
	                </details>
              </div>

              <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
                <SectionTitle title="SOP, quiz, and context packet" helper="What this captured workflow can publish." compact />
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">SOP outline</div>
                    <Badge tone="blue">{capturePacket.sopOutline.length} sections</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {capturePacket.sopOutline.map((line) => (
                      <div key={line} className="flex gap-2 text-xs leading-5 text-[var(--text-muted)]">
                        <BookOpenCheck size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Quiz checks</div>
                    <Badge tone="purple">{capturePacket.quizChecks.length} generated</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {capturePacket.quizChecks.map((check) => (
                      <div key={check} className="flex gap-2 text-xs leading-5 text-[var(--text-muted)]">
                        <GraduationCap size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Agent context</div>
                    <Badge tone={capturePacket.agentContext.ready ? "green" : "amber"}>
                      {capturePacket.agentContext.ready ? "ready" : "missing"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniMetric label="Sources" value={String(capturePacket.agentContext.sources.length)} />
                    <MiniMetric label="Gaps" value={String(capturePacket.agentContext.missing.length)} />
                  </div>
                  <div className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Next action</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{capturePacket.nextAction}</p>
                  </div>
                  <Button className="mt-3 w-full" variant="secondary" onClick={capturePacket.agentContext.ready ? onOpenOrchestrator : onOpenTraining}>
                    {capturePacket.agentContext.ready ? <BrainCircuit size={15} /> : <GraduationCap size={15} />}
                    {capturePacket.agentContext.ready ? "Ask from this context" : "Open adoption plan"}
                  </Button>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Publish targets</div>
                    <Badge tone="blue">{capturePacket.procedure.exports.filter((target) => target.ready).length}/{capturePacket.procedure.exports.length} ready</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {capturePacket.procedure.exports.map((target) => (
                      <div key={target.id} className="flex items-start gap-2 rounded-md border border-[var(--border)]/70 bg-[var(--surface-muted)]/58 px-2.5 py-2">
                        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${target.ready ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
                          {target.ready ? <Check size={12} /> : <CircleDashed size={12} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-[var(--text)]">{target.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">{target.helper}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Assistant brief</div>
                    <MessageSquareText size={16} className="text-[var(--primary)]" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {capturePacket.procedure.assistantBrief.map((line) => (
                      <div key={line} className="rounded-md bg-[var(--surface-muted)] px-2.5 py-2 text-xs leading-5 text-[var(--text-muted)]">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <details
            className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
            data-testid="process-redesign-path"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-[var(--text)]">Redesign checklist and baseline</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {completedRedesignSteps}/{redesignPathSteps.length} steps ready, {monthlyHoursSaved ? `${monthlyHoursSaved.toLocaleString()} hours/month modeled` : "value baseline pending"}.
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
            </summary>
            <div className="grid gap-0 border-t border-[var(--border)] xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="p-5">
                <SectionTitle title="Baseline" helper="The simple value model that will be proven after launch." compact />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniMetric label="Volume" value={monthlyVolume ? monthlyVolume.toLocaleString() : "Unset"} />
                  <MiniMetric label="Today" value={currentMinutes ? `${currentMinutes} min` : "Unset"} />
                  <MiniMetric label="Target" value={currentMinutes ? `${targetMinutes} min` : "Unset"} />
                  <MiniMetric label="Savings" value={monthlyHoursSaved ? `${monthlyHoursSaved.toLocaleString()}h` : "Pending"} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {readinessSteps.map((step, index) => (
                    <div key={step.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]" : "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"}`}>
                          {step.complete ? <Check size={13} /> : index + 1}
                        </span>
                        <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{step.helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
                <SectionTitle title="Redesign path" helper="The order that keeps AI assistance understandable and safe." compact />
                <div className="mt-4 space-y-2">
                  {redesignPathSteps.map((step, index) => (
                    <button
                      key={step.label}
                      type="button"
                      onClick={step.action}
                      data-testid={`process-redesign-path-step-${index + 1}`}
                      className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                    >
                      <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${step.complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--primary-soft)] text-[var(--primary)]"}`}>
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
          </details>

          <Panel className="mt-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle title="Human and AI operating flow" helper="The plain-language workflow the team can validate before implementation." />
              <Badge tone="blue">
                {currentCycleDays && futureCycleDays ? `${currentCycleDays}d to ${futureCycleDays}d cycle` : "cycle model pending"}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 xl:grid-cols-5">
              {operatingFlow.map((step, index) => (
                <FlowStep key={step.title} index={index + 1} title={step.title} owner={step.owner} helper={step.helper} tone={step.tone} />
              ))}
            </div>
          </Panel>

          <details className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-[var(--text)]">Detailed current state, future state, and controls</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">Open when the team needs the full redesign evidence.</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
            </summary>
            <div className="grid gap-4 border-t border-[var(--border)] p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
              <div>
                <SectionTitle title="Current work" helper="What the business does today" compact />
                <div className="mt-4 space-y-3">
                  <ProcessStep index={1} title="Request enters function" body={activeUseCase.currentProcess || "Current process details are not documented yet."} tone="slate" />
                  <ProcessStep index={2} title="Manual interpretation" body="Employees search systems, policy, messages, spreadsheets, or ticket history to understand the right next step." tone="amber" />
                  <ProcessStep index={3} title="Human follow-up" body="Owners draft responses, update systems, ask for clarification, and manually track status." tone="slate" />
                  <ProcessStep index={4} title="Limited evidence" body="Value, quality, cycle time, and governance proof are hard to reconstruct after the work is done." tone="red" />
                </div>
              </div>

              <div>
                <SectionTitle title="Future work" helper="AI-assisted operating model with explicit boundaries" compact />
                <div className="mt-4 space-y-3">
                  <ProcessStep index={1} title="Structured intake" body="The OS captures volume, value, risk, data needs, and success metrics at the start." tone="blue" />
                  <ProcessStep index={2} title="Context-aware Skill" body="A governed Skill retrieves approved context, drafts outputs, and separates source facts from model inference." tone="green" />
                  <ProcessStep index={3} title="Policy and approvals" body="Tool access, sensitive actions, and external communications pass through approval gates." tone="purple" />
                  <ProcessStep index={4} title="Measured scale" body="Runs, evals, feedback, adoption, and ROI flow into proof and executive reporting." tone="green" />
                </div>
              </div>

              <div>
                <SectionTitle title="Control points" helper="What must be true before launch" compact />
                <div className="mt-4 space-y-2">
                  {controlPoints.map((control, index) => (
                    <div key={control} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
                      <Check size={15} className={index < 3 ? "text-[var(--success)]" : "text-[var(--text-soft)]"} />
                      {control}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-4 text-sm leading-6 text-[var(--success)]">
                  <div className="flex items-center gap-2 font-semibold text-[var(--success)]">
                    <ShieldCheck size={15} />
                    Launch rule
                  </div>
                  Move forward only when the workflow has an owner, review gates, allowed tools, evals, and evidence capture.
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function FlowStep({
  index,
  title,
  owner,
  helper,
  tone,
}: {
  index: number;
  title: string;
  owner: string;
  helper: string;
  tone: string;
}) {
  return (
    <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)]/62 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${blockTone(tone)}`}>{index}</span>
        <GitBranch size={15} className="text-[var(--text-soft)]" />
      </div>
      <div className="mt-4 text-sm font-semibold text-[var(--text)]">{title}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">{owner}</div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
    </div>
  );
}

function ProcessStep({
  index,
  title,
  body,
  tone,
}: {
  index: number;
  title: string;
  body: string;
  tone: "slate" | "amber" | "red" | "blue" | "green" | "purple";
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 rounded-lg border border-[var(--border)] p-3">
      <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${blockTone(tone)}`}>
        {index}
      </span>
      <div>
        <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{body}</div>
      </div>
    </div>
  );
}
