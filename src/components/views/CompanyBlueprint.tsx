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
import { Badge, Button, CollapsibleSection, MetricCard, MiniMetric, Panel, SectionTitle, type BadgeTone } from "@/components/ui";
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
          className="mb-5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/85 px-4 py-3 text-sm font-medium text-[var(--text-muted)] shadow-[var(--shadow-card)]"
        >
          {exportStatus.message}
        </div>
      ) : null}

      <Panel className="mb-5 overflow-hidden border-[var(--primary)]/20 bg-[var(--surface)]/90" data-testid="blueprint-launch-path">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">Start here</Badge>
              <Badge tone={launchPathCompletion >= 80 ? "green" : launchPathCompletion >= 40 ? "blue" : "slate"}>
                {launchPathCompletion}% path complete
              </Badge>
              <Badge tone={blueprint.score >= 70 ? "green" : blueprint.score >= 40 ? "blue" : "slate"}>{blueprint.archetype}</Badge>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)]/80 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Next best move</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--text)]">{nextLaunchStep.title}</div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{nextLaunchStep.detail}</p>
                </div>
                <Button onClick={nextLaunchStep.onClick} className="shrink-0 whitespace-nowrap" data-testid="blueprint-next-launch-action">
                  {nextLaunchStep.actionLabel}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>

            <h2 className="mt-5 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)]">
              Launch AI like a company program, not a collection of experiments.
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">{blueprint.summary}</p>
          </div>

          <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/50 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Company launch path</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">The plain-language route from setup to scale.</div>
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
                  className="group grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-[var(--border)]/75 bg-[var(--surface)]/85 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      step.complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                    }`}
                    aria-hidden="true"
                  >
                    {step.complete ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">{step.label}</span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text)]">{step.title}</span>
                  </span>
                  <span className="mt-0.5 whitespace-nowrap rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
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
        <div className="border-b border-[var(--border)]/70 px-6 py-5">
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
              className={`p-6 text-left transition hover:bg-[var(--surface-muted)]/70 ${index ? "border-t border-[var(--border)] lg:border-l lg:border-t-0" : ""} ${mode.recommended ? "bg-[var(--primary-soft)]/35" : "bg-[var(--surface)]/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--text)]">{mode.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{mode.score}/100 fit</div>
                </div>
                {mode.recommended ? <Badge tone="purple">Recommended</Badge> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{mode.bestFor}</p>
              <div className="mt-4 rounded-lg bg-[var(--surface)]/80 p-4 text-xs leading-5 text-[var(--text-muted)] ring-1 ring-[var(--border)]/70">
                {mode.operatingThesis}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {mode.requiredProof.slice(0, 4).map((proof) => (
                  <span key={proof} className="rounded-full bg-[var(--surface)]/80 px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] ring-1 ring-[var(--border)]/70">
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
          <div className="border-b border-[var(--border)]/70 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{blueprint.stage.replace("_", " ")}</Badge>
                  <Badge tone={blueprint.score >= 70 ? "green" : blueprint.score >= 40 ? "blue" : "slate"}>
                    {blueprint.score}/100
                  </Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)]">This is how the company should implement AI</h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">{blueprint.summary}</p>
              </div>
              <Button onClick={openFirstMove}>
                {blueprint.firstMove.title}
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg bg-[var(--surface-muted)]/80 p-5 ring-1 ring-[var(--border)]/70">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">First move</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text)]">{blueprint.firstMove.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{blueprint.firstMove.detail}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={readinessTone(blueprint.firstMove.readiness)}>{readinessLabel(blueprint.firstMove.readiness)}</Badge>
                <span className="text-xs text-[var(--text-muted)]">{blueprint.firstMove.evidence}</span>
              </div>
            </div>
            <div className="rounded-lg bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]/70">
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
                className="w-full rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/75 p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--text)]">{role.role}</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{role.owns}</p>
                  </div>
                  <Badge tone={readinessTone(role.readiness)}>{readinessLabel(role.readiness)}</Badge>
                </div>
                <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{role.nextAction}</div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <CollapsibleSection
        className="mt-5"
        title="Executive Decision Packet"
        summary="The decisions that make this a real company operating system instead of another AI experiment."
      >
        <div className="grid gap-0 lg:grid-cols-4">
          {blueprint.launchDecisions.map((decision, index) => (
            <button
              key={decision.id}
              type="button"
              aria-label={`${actionLabelForView(decision.targetView)}: ${decision.title} decision`}
              onClick={() => onOpenView(decision.targetView)}
              className={`p-5 text-left transition hover:bg-[var(--surface-muted)]/80 ${index ? "border-t border-[var(--border)] lg:border-l lg:border-t-0" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-[var(--text)]">{decision.title}</div>
                <Badge tone={readinessTone(decision.readiness)}>{readinessLabel(decision.readiness)}</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{decision.decision}</p>
              <div className="mt-4 rounded-lg bg-[var(--surface-muted)]/80 p-3 text-xs leading-5 text-[var(--text-muted)] ring-1 ring-[var(--border)]/60">
                {decision.whyItMatters}
              </div>
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <CollapsibleSection
          title="Function Rollout Map"
          summary="Where to start, what pattern fits, and which functions are ready to scale."
        >
          <div className="divide-y divide-[var(--border)]">
            {blueprint.functionRollout.map((item) => (
              <button
                key={item.department}
                type="button"
                aria-label={`${actionLabelForView(item.targetView)}: ${item.department} rollout lane`}
                onClick={() => onOpenView(item.targetView)}
                className="grid w-full gap-4 px-6 py-4 text-left transition hover:bg-[var(--surface-muted)]/70 lg:grid-cols-[140px_minmax(0,1fr)_120px]"
              >
                <div>
                  <div className="font-semibold text-[var(--text)]">{item.department}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{item.score}/100 readiness</div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text)]">{item.recommendedPattern}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.nextAction}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1">{item.opportunityCount} opportunities</span>
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1">{item.skillCount} Skills</span>
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1">{item.signalCount} signals</span>
                    {item.riskCount ? <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-[var(--warning)]">{item.riskCount} risk flags</span> : null}
                  </div>
                </div>
                <div className="flex items-start justify-end">
                  <Badge tone={functionTone(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
              </button>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Connection Plan"
          summary="The minimum enterprise wiring needed before AI can safely act in real workflows."
        >
          <div className="divide-y divide-[var(--border)]">
            {blueprint.connections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                aria-label={`${actionLabelForView(connection.targetView)}: ${connection.name} connection plan`}
                onClick={() => onOpenView(connection.targetView)}
                className="w-full px-6 py-4 text-left transition hover:bg-[var(--surface-muted)]/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--text)]">{connection.name}</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{connection.purpose}</p>
                  </div>
                  <Badge tone={readinessTone(connection.readiness)}>{connection.score}/100</Badge>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-subtle)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${connection.score}%` }} />
                </div>
                <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{connection.nextAction}</div>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      <CollapsibleSection
        className="mt-5"
        title="90-Day Implementation Path"
        summary="A practical sequence for a company that wants AI deployed into daily work without creating ungoverned pilots."
      >
        <div className="grid gap-0 lg:grid-cols-3">
          {blueprint.phases.map((phase, index) => (
            <div key={phase.id} className={`p-6 ${index ? "border-t border-[var(--border)] lg:border-l lg:border-t-0" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <GitBranch size={17} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">{phase.label}</div>
                  <div className="mt-1 text-base font-semibold text-[var(--text)]">{phase.title}</div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{phase.outcome}</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {phase.steps.map((phaseStep) => (
                  <button
                    key={phaseStep.id}
                    type="button"
                    aria-label={`${actionLabelForView(phaseStep.targetView)}: ${phaseStep.title} implementation step`}
                    onClick={() => onOpenView(phaseStep.targetView)}
                    className="flex w-full items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                  >
                    <div className="mt-0.5">
                      {phaseStep.readiness === "ready" ? (
                        <CheckCircle2 size={17} className="text-[var(--success)]" />
                      ) : (
                        <CircleDashed size={17} className="text-[var(--text-soft)]" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{phaseStep.title}</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{phaseStep.detail}</p>
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
      </CollapsibleSection>

      <CollapsibleSection
        className="mt-5"
        title="The product principle"
        summary="Why the OS should start as a transformation concierge, not a chatbot."
      >
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              <UsersRound size={18} />
            </div>
            <p className="max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
              For any company, the OS should not start as a chatbot. It should start as a transformation concierge: understand the company, find the best opportunities, wire the right systems, govern every action, prove value, and turn successful pilots into reusable patterns.
            </p>
          </div>
          <Button variant="secondary" onClick={() => onOpenView("orchestrator")}>
            Ask Orchestrator
            <ArrowRight size={14} />
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
