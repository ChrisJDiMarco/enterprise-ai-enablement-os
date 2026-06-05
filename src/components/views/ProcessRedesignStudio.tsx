import { ArrowRight, Boxes, Check, GitBranch, ShieldCheck, Workflow } from "lucide-react";

import { Badge, Button, Field, MiniMetric, Panel, SectionTitle, riskTone, statusTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { UseCase } from "@/lib/enterprise-ai-data";
import { statusLabels } from "@/lib/ui/constants";

function blockTone(tone: string) {
  if (tone === "green") return "bg-green-50 text-green-700";
  if (tone === "blue") return "bg-sky-50 text-sky-700";
  if (tone === "purple") return "bg-[var(--primary-soft)] text-[var(--primary)]";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  if (tone === "red") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function decisionTone(value: string) {
  if (value.includes("Human-led")) return "amber";
  if (value.includes("approval gates")) return "blue";
  if (value.includes("Reusable")) return "green";
  return "slate";
}

export function ProcessRedesignStudio({
  useCases,
  selectedUseCase,
  setSelectedUseCaseId,
  onOpenFactory,
  onOpenWorkflow,
}: {
  useCases: UseCase[];
  selectedUseCase: UseCase | null;
  setSelectedUseCaseId: (id: string) => void;
  onOpenFactory: () => void;
  onOpenWorkflow: () => void;
}) {
  const activeUseCase = selectedUseCase ?? useCases[0] ?? null;
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
      actionLabel: "Build workflow",
      action: onOpenWorkflow,
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

  return (
    <div>
      <PageHeader
        title="Process Redesign"
        subtitle="Turn a use case into a clear human and AI workflow before anything launches."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenFactory}>
              <Boxes size={16} />
              Open Use Cases
            </Button>
            <Button onClick={onOpenWorkflow}>
              <Workflow size={16} />
              Build workflow
            </Button>
          </div>
        }
      />

      {!activeUseCase ? (
        <Panel className="p-5 sm:p-6">
          <Badge tone="blue">start here</Badge>
          <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Choose a use case before designing the workflow</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
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
              <div key={label} className="border-l border-slate-200 pl-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-slate-50 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{index + 1}</span>
                  <div className="font-semibold text-slate-950">{label}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
              </div>
            ))}
          </div>
        </Panel>
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
                <h2 className="mt-4 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  {nextRedesignStep.title}
                </h2>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 sm:text-base">
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

                <div className="mt-5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Process being redesigned</div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">{activeUseCase.title}</div>
                    </div>
                    <Badge tone={decisionTone(redesignRecommendation)}>{redesignRecommendation}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{activeUseCase.businessProblem}</p>
                </div>

              </div>

              <div className="hidden border-t border-slate-200 bg-slate-50/56 p-5 md:block xl:border-l xl:border-t-0">
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
                <div className="mt-4 rounded-lg border border-white bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">Value baseline</div>
                    <Badge tone={hasValueBaseline ? "green" : "amber"}>{hasValueBaseline ? "modeled" : "needed"}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[var(--primary)]">
                    {hasValueBaseline ? `${monthlyHoursSaved.toLocaleString()} hours/month potential` : "Add volume and handling time"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
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

          <details
            className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl"
            data-testid="process-redesign-path"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-slate-950">Redesign checklist and baseline</div>
                <div className="mt-1 text-sm text-slate-500">
                  {completedRedesignSteps}/{redesignPathSteps.length} steps ready, {monthlyHoursSaved ? `${monthlyHoursSaved.toLocaleString()} hours/month modeled` : "value baseline pending"}.
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-slate-400" />
            </summary>
            <div className="grid gap-0 border-t border-slate-200 xl:grid-cols-[minmax(0,1fr)_390px]">
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
                    <div key={step.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-green-50 text-green-700 ring-1 ring-green-100" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                          {step.complete ? <Check size={13} /> : index + 1}
                        </span>
                        <div className="text-sm font-semibold text-slate-950">{step.label}</div>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{step.helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/56 p-5 xl:border-l xl:border-t-0">
                <SectionTitle title="Redesign path" helper="The order that keeps AI assistance understandable and safe." compact />
                <div className="mt-4 space-y-2">
                  {redesignPathSteps.map((step, index) => (
                    <button
                      key={step.label}
                      type="button"
                      onClick={step.action}
                      data-testid={`process-redesign-path-step-${index + 1}`}
                      className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-slate-200/70 bg-white/78 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-white"
                    >
                      <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${step.complete ? "bg-green-50 text-green-700" : "bg-[var(--primary-soft)] text-[var(--primary)]"}`}>
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{step.label}</span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-950">{step.title}</span>
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

          <details className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-slate-950">Detailed current state, future state, and controls</div>
                <div className="mt-1 text-sm text-slate-500">Open when the team needs the full redesign evidence.</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-slate-400" />
            </summary>
            <div className="grid gap-4 border-t border-slate-200 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
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
                    <div key={control} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <Check size={15} className={index < 3 ? "text-green-600" : "text-slate-400"} />
                      {control}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-green-100 bg-green-50 p-4 text-sm leading-6 text-green-800">
                  <div className="flex items-center gap-2 font-semibold text-green-900">
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
    <div className="relative rounded-lg border border-slate-200 bg-white/62 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${blockTone(tone)}`}>{index}</span>
        <GitBranch size={15} className="text-slate-300" />
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{owner}</div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p>
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
    <div className="grid grid-cols-[32px_1fr] gap-3 rounded-lg border border-slate-200 p-3">
      <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${blockTone(tone)}`}>
        {index}
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-600">{body}</div>
      </div>
    </div>
  );
}
