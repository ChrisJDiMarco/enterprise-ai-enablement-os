import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  Compass,
  Copy,
  Download,
  GitBranch,
  Network,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Badge, Button, MetricCard, MiniMetric, Panel, SectionTitle, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type {
  CompanyBlueprint as CompanyBlueprintModel,
  CompanyBlueprintFunctionStatus,
  CompanyBlueprintReadiness,
} from "@/lib/company-blueprint";
import { formatCompanyBlueprintBrief } from "@/lib/company-blueprint";
import { copyTextOrDownload, downloadJsonFile, timestampedExportFilename, type ExportCopyResult } from "@/lib/ui/export-utils";
import type { View } from "@/lib/ui/types";
import { useMemo, useState } from "react";

function readinessTone(readiness: CompanyBlueprintReadiness): BadgeTone {
  if (readiness === "ready") return "green";
  if (readiness === "partial") return "blue";
  return "slate";
}

function functionTone(status: CompanyBlueprintFunctionStatus): BadgeTone {
  if (status === "scale") return "green";
  if (status === "start_now") return "purple";
  if (status === "next") return "blue";
  return "slate";
}

function readinessLabel(readiness: CompanyBlueprintReadiness) {
  if (readiness === "ready") return "Ready";
  if (readiness === "partial") return "In progress";
  return "Not started";
}

function statusLabel(status: CompanyBlueprintFunctionStatus) {
  if (status === "scale") return "Scale";
  if (status === "start_now") return "Start now";
  if (status === "next") return "Next";
  return "Monitor";
}

const viewActionLabels: Record<View, string> = {
  command: "Open Command Center",
  blueprint: "Open Company Plan",
  strategy: "Open AI Roadmap",
  process: "Open Process Redesign",
  work: "Open Work Signals",
  factory: "Open Use Cases",
  harness: "Open Test Harness",
  skills: "Open AI Skills",
  workflow: "Open Workflow Builder",
  broker: "Open Model Broker",
  context: "Open Context Fabric",
  evals: "Open Evals",
  governance: "Open Risk Review",
  launch: "Open Launch Center",
  roi: "Open ROI",
  training: "Open Training",
  reports: "Open Reports",
  admin: "Open Settings",
  evidence: "Open Proof Ledger",
  orchestrator: "Open Orchestrator",
  estate: "Open AI Estate",
  connectors: "Open Connectors",
  session: "Open Session",
};

function actionLabelForView(view: View) {
  return viewActionLabels[view] ?? "Open destination";
}

export function CompanyBlueprint({
  blueprint,
  onOpenView,
  onOpenSetup,
  onNewUseCase,
}: {
  blueprint: CompanyBlueprintModel;
  onOpenView: (view: View) => void;
  onOpenSetup: () => void;
  onNewUseCase: () => void;
}) {
  const [exportStatus, setExportStatus] = useState<ExportCopyResult | null>(null);
  const readyConnections = blueprint.connections.filter((connection) => connection.readiness === "ready").length;
  const functionsWithEvidence = blueprint.functionRollout.filter((item) => item.score > 0).length;
  const operatingRolesStarted = blueprint.operatingModel.filter((role) => role.readiness !== "missing").length;
  const operatingRolesReady = blueprint.operatingModel.filter((role) => role.readiness === "ready").length;
  const primaryFunction = [...blueprint.functionRollout].sort((a, b) => b.score - a.score)[0] ?? blueprint.functionRollout[0];
  const evidenceRecords =
    Number.parseInt(
      blueprint.proofPoints
        .find((point) => point.label === "Evidence records")
        ?.value.replace(/\D/g, "") ?? "0",
      10,
    ) || 0;
  const blueprintBrief = useMemo(() => formatCompanyBlueprintBrief(blueprint), [blueprint]);
  const openFirstMove = () => {
    if (blueprint.firstMove.id === "guided-setup") {
      onOpenSetup();
      return;
    }
    onOpenView(blueprint.firstMove.targetView);
  };
  const firstMoveActionLabel =
    blueprint.firstMove.id === "guided-setup" ? "Open guided setup" : actionLabelForView(blueprint.firstMove.targetView);
  const copyBrief = () => {
    void copyTextOrDownload({
      contents: blueprintBrief,
      copiedMessage: "Blueprint brief copied.",
      fallbackFilename: timestampedExportFilename(`${blueprint.organizationName} AI blueprint`, "md"),
      fallbackMimeType: "text/markdown;charset=utf-8",
    }).then(setExportStatus);
  };
  const exportBlueprint = () => {
    const filename = timestampedExportFilename(`${blueprint.organizationName} AI blueprint`, "json");
    const downloaded = downloadJsonFile(filename, {
      schema: "enterprise-ai-enablement-os.company-blueprint.v1",
      exportedAt: new Date().toISOString(),
      organizationName: blueprint.organizationName,
      blueprint,
      executiveBriefMarkdown: blueprintBrief,
    });
    setExportStatus({
      status: downloaded ? "downloaded" : "failed",
      message: downloaded ? `Blueprint JSON exported as ${filename}.` : "Blueprint export failed in this browser session.",
    });
  };
  const launchPathSteps = [
    {
      label: "Launch mode",
      title: blueprint.recommendedMode.name,
      detail: blueprint.recommendedMode.bestFor,
      status: `${blueprint.recommendedMode.score}/100 fit`,
      complete: blueprint.recommendedMode.score >= 60,
      actionLabel: actionLabelForView(blueprint.recommendedMode.targetView),
      onClick: () => onOpenView(blueprint.recommendedMode.targetView),
    },
    {
      label: "Next move",
      title: blueprint.firstMove.title,
      detail: blueprint.firstMove.detail,
      status: readinessLabel(blueprint.firstMove.readiness),
      complete: blueprint.firstMove.readiness === "ready",
      actionLabel: firstMoveActionLabel,
      onClick: openFirstMove,
    },
    {
      label: "Owners",
      title: "Assign the operating model",
      detail: "Make the sponsor, director, owners, reviewers, builders, and champions explicit.",
      status: `${operatingRolesStarted}/${blueprint.operatingModel.length} started`,
      complete: operatingRolesReady >= 3 || operatingRolesStarted === blueprint.operatingModel.length,
      actionLabel: actionLabelForView("strategy"),
      onClick: () => onOpenView("strategy"),
    },
    {
      label: "First lane",
      title: primaryFunction ? `${primaryFunction.department} rollout` : "Choose a function lane",
      detail: primaryFunction?.nextAction ?? "Capture the first function-level pain point and turn it into a scored opportunity.",
      status: primaryFunction ? `${primaryFunction.score}/100 ready` : "Needs intake",
      complete: Boolean(primaryFunction && primaryFunction.score >= 58),
      actionLabel: actionLabelForView(primaryFunction?.targetView ?? "factory"),
      onClick: () => onOpenView(primaryFunction?.targetView ?? "factory"),
    },
    {
      label: "Proof chain",
      title: "Connect trust and value proof",
      detail: "Tie sources, runs, evals, governance, adoption, and ROI into one executive-ready evidence trail.",
      status: `${readyConnections}/${blueprint.connections.length} connections`,
      complete: readyConnections >= 2 && evidenceRecords > 0,
      actionLabel: actionLabelForView("evidence"),
      onClick: () => onOpenView("evidence"),
    },
  ];
  const completedLaunchSteps = launchPathSteps.filter((step) => step.complete).length;
  const launchPathCompletion = Math.round((completedLaunchSteps / launchPathSteps.length) * 100);
  const nextLaunchStep = launchPathSteps.find((step) => !step.complete) ?? launchPathSteps[launchPathSteps.length - 1];

  return (
    <div>
      <PageHeader
        title="Company Plan"
        subtitle="A universal implementation blueprint for turning any company's AI ambition into governed, adopted, measurable capability."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenSetup}>
              <Sparkles size={15} />
              Guided setup
            </Button>
            <Button variant="secondary" onClick={copyBrief}>
              <Copy size={15} />
              Copy brief
            </Button>
            <Button variant="secondary" onClick={exportBlueprint}>
              <Download size={15} />
              Export
            </Button>
            <Button onClick={onNewUseCase}>
              <ArrowRight size={15} />
              Add opportunity
            </Button>
          </div>
        }
      />

      {exportStatus ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="blueprint-export-status"
          className="mb-5 rounded-lg border border-slate-200/80 bg-white/85 px-4 py-3 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)]"
        >
          {exportStatus.message}
        </div>
      ) : null}

      <Panel className="mb-5 overflow-hidden border-[var(--primary)]/20 bg-white/90" data-testid="blueprint-launch-path">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">Start here</Badge>
              <Badge tone={launchPathCompletion >= 80 ? "green" : launchPathCompletion >= 40 ? "blue" : "slate"}>
                {launchPathCompletion}% path complete
              </Badge>
              <Badge tone={blueprint.score >= 70 ? "green" : blueprint.score >= 40 ? "blue" : "slate"}>{blueprint.archetype}</Badge>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Next best move</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{nextLaunchStep.title}</div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{nextLaunchStep.detail}</p>
                </div>
                <Button onClick={nextLaunchStep.onClick} className="shrink-0 whitespace-nowrap" data-testid="blueprint-next-launch-action">
                  {nextLaunchStep.actionLabel}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>

            <h2 className="mt-5 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950">
              Launch AI like a company program, not a collection of experiments.
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">{blueprint.summary}</p>
          </div>

          <div className="border-t border-slate-200/70 bg-slate-50/50 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Company launch path</div>
                <div className="mt-1 text-xs text-slate-500">The plain-language route from setup to scale.</div>
              </div>
              <Badge tone="blue">
                {completedLaunchSteps}/{launchPathSteps.length} ready
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {launchPathSteps.map((step, index) => (
                <button
                  key={step.label}
                  type="button"
                  aria-label={`${step.actionLabel}: ${step.label} - ${step.title}`}
                  onClick={step.onClick}
                  data-testid={`blueprint-launch-step-${index + 1}`}
                  className="group grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-slate-200/75 bg-white/85 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-white"
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      step.complete ? "bg-green-50 text-green-700" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                    }`}
                    aria-hidden="true"
                  >
                    {step.complete ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{step.label}</span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-slate-950">{step.title}</span>
                  </span>
                  <span className="mt-0.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {step.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Compass} label="Blueprint Score" value={`${blueprint.score}/100`} trend={blueprint.archetype} />
        <MetricCard icon={Building2} label="Functions Mapped" value={functionsWithEvidence} trend={`${blueprint.functionRollout.length} rollout lanes`} />
        <MetricCard icon={Network} label="Connections Ready" value={`${readyConnections}/${blueprint.connections.length}`} trend="enterprise integration layers" />
        <MetricCard icon={ShieldCheck} label="Evidence Records" value={blueprint.proofPoints.at(-1)?.value ?? "0"} trend="live operating proof" />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="border-b border-slate-200/70 px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <SectionTitle
              title="Activation Modes"
              helper="The same OS can launch as a focused pilot, an enterprise rollout, or an executive proof experience. The recommended mode adapts to current evidence."
            />
            <Badge tone="purple">Recommended: {blueprint.recommendedMode.name}</Badge>
          </div>
        </div>
        <div className="grid gap-0 lg:grid-cols-3">
          {blueprint.activationModes.map((mode, index) => (
            <button
              key={mode.id}
              type="button"
              aria-label={`${actionLabelForView(mode.targetView)}: ${mode.name} activation mode`}
              onClick={() => onOpenView(mode.targetView)}
              className={`p-6 text-left transition hover:bg-slate-50/70 ${index ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""} ${mode.recommended ? "bg-[var(--primary-soft)]/35" : "bg-white/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-950">{mode.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{mode.score}/100 fit</div>
                </div>
                {mode.recommended ? <Badge tone="purple">Recommended</Badge> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{mode.bestFor}</p>
              <div className="mt-4 rounded-lg bg-white/80 p-4 text-xs leading-5 text-slate-600 ring-1 ring-slate-200/70">
                {mode.operatingThesis}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {mode.requiredProof.slice(0, 4).map((proof) => (
                  <span key={proof} className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200/70">
                    {proof}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Panel className="overflow-hidden">
          <div className="border-b border-slate-200/70 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{blueprint.stage.replace("_", " ")}</Badge>
                  <Badge tone={blueprint.score >= 70 ? "green" : blueprint.score >= 40 ? "blue" : "slate"}>
                    {blueprint.score}/100
                  </Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">This is how the company should implement AI</h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">{blueprint.summary}</p>
              </div>
              <Button onClick={openFirstMove}>
                {blueprint.firstMove.title}
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg bg-slate-50/80 p-5 ring-1 ring-slate-200/70">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">First move</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{blueprint.firstMove.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{blueprint.firstMove.detail}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={readinessTone(blueprint.firstMove.readiness)}>{readinessLabel(blueprint.firstMove.readiness)}</Badge>
                <span className="text-xs text-slate-500">{blueprint.firstMove.evidence}</span>
              </div>
            </div>
            <div className="rounded-lg bg-white p-5 ring-1 ring-slate-200/70">
              <SectionTitle title="Why this becomes useful fast" helper={blueprint.buyerNarrative} compact />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {blueprint.proofPoints.map((point) => (
                  <MiniMetric key={point.label} label={point.label} value={point.value} />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Operating Model" helper="The human system around the AI system: owners, reviews, builders, and champions." />
          <div className="mt-4 space-y-3">
            {blueprint.operatingModel.map((role) => (
              <button
                key={role.id}
                type="button"
                aria-label={`${actionLabelForView(role.targetView)}: ${role.role} operating-model role`}
                onClick={() => onOpenView(role.targetView)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/75 p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{role.role}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{role.owns}</p>
                  </div>
                  <Badge tone={readinessTone(role.readiness)}>{readinessLabel(role.readiness)}</Badge>
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-600">{role.nextAction}</div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="border-b border-slate-200/70 px-6 py-5">
          <SectionTitle title="Executive Decision Packet" helper="The decisions that make this a real company operating system instead of another AI experiment." />
        </div>
        <div className="grid gap-0 lg:grid-cols-4">
          {blueprint.launchDecisions.map((decision, index) => (
            <button
              key={decision.id}
              type="button"
              aria-label={`${actionLabelForView(decision.targetView)}: ${decision.title} decision`}
              onClick={() => onOpenView(decision.targetView)}
              className={`p-5 text-left transition hover:bg-slate-50/80 ${index ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-slate-950">{decision.title}</div>
                <Badge tone={readinessTone(decision.readiness)}>{readinessLabel(decision.readiness)}</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{decision.decision}</p>
              <div className="mt-4 rounded-lg bg-slate-50/80 p-3 text-xs leading-5 text-slate-500 ring-1 ring-slate-200/60">
                {decision.whyItMatters}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <Panel className="overflow-hidden">
          <div className="border-b border-slate-200/70 px-6 py-5">
            <SectionTitle title="Function Rollout Map" helper="Where to start, what pattern fits, and which functions are ready to scale." />
          </div>
          <div className="divide-y divide-slate-100">
            {blueprint.functionRollout.map((item) => (
              <button
                key={item.department}
                type="button"
                aria-label={`${actionLabelForView(item.targetView)}: ${item.department} rollout lane`}
                onClick={() => onOpenView(item.targetView)}
                className="grid w-full gap-4 px-6 py-4 text-left transition hover:bg-slate-50/70 lg:grid-cols-[140px_minmax(0,1fr)_120px]"
              >
                <div>
                  <div className="font-semibold text-slate-950">{item.department}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.score}/100 readiness</div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">{item.recommendedPattern}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.nextAction}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.opportunityCount} opportunities</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.skillCount} Skills</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.signalCount} signals</span>
                    {item.riskCount ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{item.riskCount} risk flags</span> : null}
                  </div>
                </div>
                <div className="flex items-start justify-end">
                  <Badge tone={functionTone(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-slate-200/70 px-6 py-5">
            <SectionTitle title="Connection Plan" helper="The minimum enterprise wiring needed before AI can safely act in real workflows." />
          </div>
          <div className="divide-y divide-slate-100">
            {blueprint.connections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                aria-label={`${actionLabelForView(connection.targetView)}: ${connection.name} connection plan`}
                onClick={() => onOpenView(connection.targetView)}
                className="w-full px-6 py-4 text-left transition hover:bg-slate-50/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{connection.name}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{connection.purpose}</p>
                  </div>
                  <Badge tone={readinessTone(connection.readiness)}>{connection.score}/100</Badge>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${connection.score}%` }} />
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-600">{connection.nextAction}</div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="border-b border-slate-200/70 px-6 py-5">
          <SectionTitle title="90-Day Implementation Path" helper="A practical sequence for a company that wants AI deployed into daily work without creating ungoverned pilots." />
        </div>
        <div className="grid gap-0 lg:grid-cols-3">
          {blueprint.phases.map((phase, index) => (
            <div key={phase.id} className={`p-6 ${index ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <GitBranch size={17} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{phase.label}</div>
                  <div className="mt-1 text-base font-semibold text-slate-950">{phase.title}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{phase.outcome}</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {phase.steps.map((phaseStep) => (
                  <button
                    key={phaseStep.id}
                    type="button"
                    aria-label={`${actionLabelForView(phaseStep.targetView)}: ${phaseStep.title} implementation step`}
                    onClick={() => onOpenView(phaseStep.targetView)}
                    className="flex w-full items-start gap-3 rounded-lg border border-slate-200/70 bg-white/70 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-white"
                  >
                    <div className="mt-0.5">
                      {phaseStep.readiness === "ready" ? (
                        <CheckCircle2 size={17} className="text-green-600" />
                      ) : (
                        <CircleDashed size={17} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{phaseStep.title}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{phaseStep.detail}</p>
                      <div className="mt-2">
                        <Badge tone={readinessTone(phaseStep.readiness)}>{readinessLabel(phaseStep.readiness)}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <UsersRound size={18} />
            </div>
            <div>
              <div className="font-semibold text-slate-950">The product principle</div>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
                For any company, the OS should not start as a chatbot. It should start as a transformation concierge: understand the company, find the best opportunities, wire the right systems, govern every action, prove value, and turn successful pilots into reusable patterns.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => onOpenView("orchestrator")}>
            Ask Orchestrator
            <ArrowRight size={14} />
          </Button>
        </div>
      </Panel>
    </div>
  );
}
