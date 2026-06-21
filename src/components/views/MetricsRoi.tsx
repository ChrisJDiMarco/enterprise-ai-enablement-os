import { Check, ChevronRight, CircleDollarSign, Info, ReceiptText, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, CollapsibleSection, DataTable, EmptyState, MiniMetric, Panel, Provenance, SectionTitle } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { financeValueControls } from "@/lib/enterprise-ai-control-plane";
import { formatCurrency, type Skill, type UseCase } from "@/lib/enterprise-ai-data";
import { openClawIntegration } from "@/lib/openclaw-integration";
import { buildRoiPortfolio, ROI_MODEL_ASSUMPTIONS } from "@/lib/roi-model";
import type { View } from "@/lib/ui/types";
import type { WorkspaceMode } from "@/lib/workspace-schema";

export function MetricsRoi({
  useCases,
  skills,
  workspaceMode,
  onOpenFactory,
  onOpenSkills,
  onOpenTests,
  onOpenEvidence,
  onOpenGovernance,
  onOpenLaunch,
  onOpenReports,
}: {
  useCases: UseCase[];
  skills: Skill[];
  workspaceMode: WorkspaceMode;
  onOpenFactory: () => void;
  onOpenSkills: () => void;
  onOpenTests: () => void;
  onOpenEvidence: () => void;
  onOpenGovernance: () => void;
  onOpenLaunch: () => void;
  onOpenReports: () => void;
}) {
  const roiPortfolio = buildRoiPortfolio(useCases);
  const roiRows = roiPortfolio.rows;
  const isProduction = workspaceMode === "production";
  const modeledRecordCount = roiRows.length;
  const skillValue = skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);
  const skillRuns = skills.reduce((sum, skill) => sum + skill.runs, 0);
  const activeUsers = skills.reduce((sum, skill) => sum + skill.adoptionCount, 0);
  const highConfidenceRows = roiRows.filter((row) => row.confidence === "high");
  const topValueRow = [...roiRows].sort((a, b) => b.expected - a.expected)[0] ?? null;
  const valueGap = Math.max(roiPortfolio.expected - skillValue, 0);
  const valueProofSteps: {
    label: string;
    body: string;
    complete: boolean;
    actionLabel: string;
    action: () => void;
  }[] = [
    {
      label: "Model baseline",
      body: modeledRecordCount
        ? `${modeledRecordCount} use case${modeledRecordCount === 1 ? "" : "s"} have volume, time, adoption, and confidence assumptions.`
        : "Create a use case with volume, handling time, adoption, and confidence.",
      complete: modeledRecordCount > 0,
      actionLabel: "Open Use Cases",
      action: onOpenFactory,
    },
    {
      label: "Pilot Skill",
      body: skills.length
        ? `${skills.length} governed Skill${skills.length === 1 ? "" : "s"} can turn the model into an operating pilot.`
        : "Convert the highest-value use case into a governed AI Skill.",
      complete: skills.length > 0,
      actionLabel: "Open AI Skills",
      action: onOpenSkills,
    },
    {
      label: "Run telemetry",
      body: skillRuns
        ? `${skillRuns.toLocaleString()} run${skillRuns === 1 ? "" : "s"} provide usage, cost, latency, and trace evidence.`
        : "Run the Skill so value can move beyond spreadsheet assumptions.",
      complete: skillRuns > 0,
      actionLabel: "Open AI Harness",
      action: onOpenTests,
    },
    {
      label: "Measured impact",
      body: skillValue
        ? `${formatCurrency(skillValue)} is recorded as delivered value on Skills.`
        : "Record measured savings, cycle-time reduction, or revenue impact.",
      complete: skillValue > 0,
      actionLabel: "Open AI Skills",
      action: onOpenSkills,
    },
    {
      label: "Finance story",
      body: skillValue && highConfidenceRows.length
        ? "Measured impact and high-confidence assumptions are ready for executive reporting."
        : "Package the measured impact, assumptions, and remaining gap for leaders.",
      complete: skillValue > 0 && highConfidenceRows.length > 0,
      actionLabel: "Open Reports",
      action: onOpenReports,
    },
  ];
  const valueProofScore = Math.round((valueProofSteps.filter((step) => step.complete).length / valueProofSteps.length) * 100);
  const nextValueProofStep = valueProofSteps.find((step) => !step.complete);
  const claimStage =
    !modeledRecordCount
      ? { label: "No value claim", tone: "slate" as const }
      : !skillRuns
        ? { label: "Modeled forecast", tone: "amber" as const }
        : !skillValue
          ? { label: "Telemetry only", tone: "amber" as const }
          : { label: "Measured impact", tone: "green" as const };
  const valueProof =
    !modeledRecordCount
      ? {
          label: "No baseline yet",
          headline: "Next: create a value baseline",
          body: "Add a use case with volume, handling time, adoption, and confidence so Finance has a real model to review.",
          button: "Open Use Cases",
          action: onOpenFactory,
          tone: "slate" as const,
        }
      : !skills.length
        ? {
            label: "Modeled, not piloted",
            headline: "Next: turn the top value case into an AI Skill",
            body: `${topValueRow?.name ?? "The leading opportunity"} has a modeled expected value of ${formatCurrency(topValueRow?.expected ?? roiPortfolio.expected)}. Convert it into a governed Skill before claiming realized value.`,
            button: "Open AI Skills",
            action: onOpenSkills,
            tone: "amber" as const,
          }
        : !skillRuns
          ? {
              label: "Needs telemetry",
              headline: "Next: collect pilot run evidence",
              body: "The portfolio has Skills, but value needs run telemetry before it can move from assumption to measured impact.",
              button: "Open AI Harness",
              action: onOpenTests,
              tone: "amber" as const,
            }
          : !skillValue
            ? {
                label: "Needs value capture",
                headline: "Next: record realized value",
                body: "Runs exist, but no value delivered has been recorded on Skills yet. Add measured savings, cycle-time reduction, or revenue impact.",
                button: "Open AI Skills",
                action: onOpenSkills,
                tone: "red" as const,
              }
            : {
                label: "Value story ready",
                headline: "Next: brief the value story",
                body: `${formatCurrency(skillValue)} is tracked from Skill records. Compare it with the modeled forecast and share the executive update.`,
                button: "Open Reports",
                action: onOpenReports,
                tone: "green" as const,
              };
  const roiViewLabels: Partial<Record<View, string>> = {
    evidence: "Proof Ledger",
    factory: "Use Cases",
    governance: "Risk Review",
    harness: "AI Harness",
    launch: "Launch Plan",
    reports: "Reports",
    roi: "Value Proof",
    skills: "AI Skills",
  };
  const roiViewLabel = (targetView: View) => roiViewLabels[targetView] ?? targetView;

  function scrollRoiSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const workspaceScroller = document.getElementById("workspace-main-content");
    if (!workspaceScroller) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const scrollerRect = workspaceScroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = targetRect.top - scrollerRect.top + workspaceScroller.scrollTop - 12;
    workspaceScroller.scrollTop = Math.max(0, nextTop);
  }

  const openFinanceControl = (targetView: View) => {
    if (targetView === "factory") {
      onOpenFactory();
      return;
    }
    if (targetView === "skills") {
      onOpenSkills();
      return;
    }
    if (targetView === "harness" || targetView === "evals") {
      onOpenTests();
      return;
    }
    if (targetView === "evidence") {
      onOpenEvidence();
      return;
    }
    if (targetView === "governance") {
      onOpenGovernance();
      return;
    }
    if (targetView === "launch") {
      onOpenLaunch();
      return;
    }
    if (targetView === "roi") {
      scrollRoiSection("roi-value-proof");
      return;
    }
    onOpenReports();
  };

  return (
    <div>
      <PageHeader
        title="Value & ROI"
        subtitle="Prove whether AI work is creating measurable value, where assumptions remain, and what to validate next."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenEvidence}>
              <ShieldCheck size={16} />
              Open proof
            </Button>
            <Button onClick={onOpenReports}>
              <ReceiptText size={16} />
              Generate ROI memo
            </Button>
          </div>
        }
      />

      <Panel className="mb-4 overflow-hidden" data-testid="openclaw-value-dashboard">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">Agent runtime value dashboard</Badge>
              <Badge tone="green">{openClawIntegration.valueMetrics[1]?.value ?? "tracked"}</Badge>
              <Badge tone="amber">Finance baseline pending</Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Show where agent work is saving time, reducing risk, and earning a real business case
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Agent adoption is useful only when it ties back to use cases, governed Skills, proof events, blocked
              risk, and Finance-approved assumptions. This dashboard turns runtime activity into an executive value story.
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {openClawIntegration.valueMetrics.map((metric) => (
                <button
                  key={metric.label}
                  type="button"
                  onClick={metric.label === "Finance baseline" ? onOpenReports : metric.label === "Risk avoided" ? onOpenTests : onOpenSkills}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{metric.label}</div>
                      <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">{metric.value}</div>
                    </div>
                    <Badge tone={metric.tone}>{metric.tone === "green" ? "value" : metric.tone === "amber" ? "review" : "signal"}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{metric.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/72 p-4 lg:border-l lg:border-t-0">
            <SectionTitle title="Value chain" helper="The evidence Finance needs before it trusts the claim" compact />
            <div className="mt-4 space-y-2">
              {[
                ["Use case", "Map each agent workflow to a business process and owner.", onOpenFactory],
                ["Skill run", "Measure adoption, latency, cost, and blocked actions.", onOpenTests],
                ["Proof event", "Attach approvals, evals, and policy outcomes.", onOpenEvidence],
                ["Finance claim", "Separate estimated value from realized value.", onOpenReports],
              ].map(([label, helper, action], index) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={action as () => void}
                  className="flex w-full gap-3 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/76 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index < 2 ? "bg-[var(--success)] text-white" : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"}`}>
                    {index < 2 ? <Check size={14} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">{label as string}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{helper as string}</span>
                  </span>
                  <ChevronRight size={15} className="ml-auto mt-1 shrink-0 text-[var(--text-soft)]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel id="roi-value-proof" className="overflow-hidden" data-testid="roi-value-proof">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={valueProof.tone}>{valueProof.label}</Badge>
              <Badge tone={isProduction ? "green" : "blue"}>
                {isProduction ? "live workspace" : "demo sandbox"}
              </Badge>
              <Provenance
                kind="modeled"
                label="Modeled estimate"
                title="ROI figures are projected from volume, time, adoption, and confidence assumptions — not measured outcomes. Replace with pilot telemetry and Finance-approved baselines."
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                {modeledRecordCount} modeled record{modeledRecordCount === 1 ? "" : "s"}
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{valueProof.headline}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{valueProof.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={valueProof.action}>
                <ChevronRight size={15} />
                {valueProof.button}
              </Button>
            </div>

            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Value proof path</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    The Finance-friendly sequence from estimated value to measurable business impact.
                  </p>
                </div>
                <Badge tone={claimStage.tone}>{claimStage.label}</Badge>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {valueProofSteps.map((step, index) => {
                  const isNext = nextValueProofStep?.label === step.label;
                  return (
                    <button
                      key={step.label}
                      type="button"
                      data-testid={`value-proof-step-${index + 1}`}
                      onClick={step.action}
                      className={`group flex min-h-[118px] flex-col rounded-lg border p-3 text-left transition ${
                        step.complete
                          ? "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] hover:border-[color-mix(in_srgb,var(--success)_36%,var(--border))]"
                          : isNext
                            ? "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_38%,var(--border))]"
                            : "border-[var(--border)] bg-[var(--surface)]/70 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            step.complete
                              ? "bg-[var(--success)] text-white"
                              : isNext
                                ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_32%,var(--border))]"
                                : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                          }`}
                          aria-hidden="true"
                        >
                          {step.complete ? <Check size={14} /> : index + 1}
                        </span>
                        <Badge tone={step.complete ? "green" : isNext ? "amber" : "slate"}>
                          {step.complete ? "done" : isNext ? "next" : "open"}
                        </Badge>
                      </span>
                      <span className="mt-3 text-sm font-semibold text-[var(--text)]">{step.label}</span>
                      <span className="mt-2 line-clamp-2 block flex-1 text-xs leading-5 text-[var(--text-muted)]">{step.body}</span>
                      {!step.complete ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                          {step.actionLabel}
                          <ChevronRight size={13} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-4">
              {[
                { label: "Tracked value", value: formatCurrency(skillValue), helper: "from Skill records" },
                { label: "Modeled expected", value: formatCurrency(roiPortfolio.expected), helper: "adoption-adjusted" },
                { label: "Value gap", value: formatCurrency(valueGap), helper: "model minus tracked" },
                { label: "Active users", value: activeUsers.toLocaleString(), helper: "from adoption records" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/62 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">{item.value}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-4 lg:max-h-[760px] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <SectionTitle title="Value proof health" helper="How close the ROI story is to executive-ready" compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Proof path" value={`${valueProofScore}%`} />
              <MiniMetric label="Runs" value={skillRuns.toLocaleString()} />
              <MiniMetric label="High confidence" value={String(highConfidenceRows.length)} />
              <MiniMetric label="Adoption" value={`${Math.round(ROI_MODEL_ASSUMPTIONS.adoptionCaptureRate * 100)}%`} />
            </div>
            <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/72 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <CircleDollarSign size={16} className="text-[var(--primary)]" />
                {topValueRow ? "Top value candidate" : "No candidate yet"}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {topValueRow
                  ? `${topValueRow.name} carries ${formatCurrency(topValueRow.expected)} expected annualized value at ${topValueRow.confidence} confidence.`
                  : "Create a value-modeled use case before the ROI packet can be trusted."}
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] bg-[var(--warning-soft)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Info size={16} className="text-[var(--warning)]" />
                Assumption status
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {isProduction
                  ? modeledRecordCount
                    ? "Production records are modeled until pilot telemetry and Finance-approved baselines replace the assumptions."
                    : "Production mode has no ROI baseline yet."
                  : "Demo values are illustrative and should not be treated as realized impact."}
              </p>
              <div className="mt-3 border-t border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] pt-3 text-xs leading-5 text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-muted)]">
                  {roiPortfolio.usingDefaults ? "Platform default assumptions (not your numbers):" : "Tenant assumptions:"}
                </span>{" "}
                ${roiPortfolio.assumptions.loadedHourlyCostUsd}/hr loaded cost · {Math.round(roiPortfolio.assumptions.adoptionCaptureRate * 100)}% adoption
                capture · {roiPortfolio.assumptions.conservativeMultiplier}x / {roiPortfolio.assumptions.optimisticMultiplier}x scenario band. Every dollar
                figure on this page is an estimate derived from these values — have Finance confirm or replace them before sharing externally.
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden" data-testid="finance-grade-value-controls">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="Finance-Grade Value Controls"
                helper="Make ROI credible by tying every claim to baseline assumptions, usage telemetry, quality conditions, and a named owner."
                compact
              />
              <Badge tone={valueProofScore >= 80 ? "green" : valueProofScore >= 40 ? "amber" : "red"}>
                {valueProofScore}% proof path
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {financeValueControls.map((control, index) => (
                <button
                  key={control.control}
                  type="button"
                  aria-label={`${control.control}: open ${roiViewLabel(control.targetView)}`}
                  onClick={() => openFinanceControl(control.targetView)}
                  className="group flex min-h-[128px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/45"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                      {index === 2 ? <ShieldCheck size={17} /> : <ReceiptText size={17} />}
                    </span>
                    <Badge tone={valueProofSteps[index]?.complete ? "green" : index === valueProofSteps.findIndex((step) => !step.complete) ? "amber" : "slate"}>
                      {valueProofSteps[index]?.complete ? "covered" : index === valueProofSteps.findIndex((step) => !step.complete) ? "next" : "required"}
                    </Badge>
                  </span>
                  <span className="mt-3 text-sm font-semibold text-[var(--text)]">{control.control}</span>
                  <span className="mt-2 line-clamp-2 block flex-1 text-xs leading-5 text-[var(--text-muted)]">{control.evidence}</span>
                  <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-soft)]">{control.owner}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    Open {roiViewLabel(control.targetView)}
                    <ChevronRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/58 p-4 lg:border-l lg:border-t-0">
            <SectionTitle title="Executive value gate" helper="A value story should not scale faster than its proof." compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Modeled" value={formatCurrency(roiPortfolio.expected)} />
              <MiniMetric label="Measured" value={formatCurrency(skillValue)} />
              <MiniMetric label="Gap" value={formatCurrency(valueGap)} />
              <MiniMetric label="High confidence" value={String(highConfidenceRows.length)} />
            </div>
            <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] bg-[var(--warning-soft)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Info size={16} className="text-[var(--warning)]" />
                Finance rule
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Keep modeled forecasts separate from realized value until run telemetry, adoption, quality gates, and a Finance-reviewed baseline are attached.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_440px]">
        <Panel className="p-5">
          <SectionTitle title="Value forecast" helper="Modeled annual value before pilot telemetry replaces assumptions" />
          <div className="mt-4 h-[360px]">
            {roiRows.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={roiRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-12} textAnchor="end" height={72} />
                <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="conservative" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expected" fill="#635bff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="optimistic" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No ROI records yet"
                body="Create or import scored use cases with volume and handling-time data to populate the ROI model."
                action="Open Use Cases"
                onAction={onOpenFactory}
              />
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="ROI model" helper="Assumption based until pilot telemetry is attached" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric label="Conservative" value={formatCurrency(roiPortfolio.conservative)} />
            <MiniMetric label="Expected" value={formatCurrency(roiPortfolio.expected)} />
            <MiniMetric label="Optimistic" value={formatCurrency(roiPortfolio.optimistic)} />
          </div>
          <div className="mt-4 rounded-lg bg-[var(--surface-muted)] p-4 font-mono text-xs leading-6 text-[var(--text-muted)]">
            Monthly hours saved = monthly volume x minutes saved per item / 60
            <br />
            Monthly value = monthly hours saved x loaded hourly cost
            <br />
            Annualized value = monthly value x 12
            <br />
            Adoption-adjusted value = estimated value x adoption rate
          </div>
          <div className="mt-5 space-y-3">
            {roiRows.slice(0, 4).map((row) => (
              <div key={row.name} className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="text-sm font-semibold">{row.name}</div>
                <div className="text-sm text-[var(--text-muted)]">{formatCurrency(row.expected)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <CollapsibleSection
        className="mt-4"
        title="Use case economics"
        summary="Transparent, replaceable assumptions by opportunity."
      >
        {roiRows.length ? (
          <DataTable
            caption="Use case ROI economics"
            columns={["Use Case", "Monthly Hours", "Adoption", "Confidence", "Source", "Conservative", "Expected", "Optimistic"]}
            rows={roiRows.map((row) => [
              row.name,
              Math.round(row.hours).toLocaleString(),
              `${row.adoption}%`,
              <Badge key={`${row.name}-confidence`} tone={row.confidence === "high" ? "green" : row.confidence === "medium" ? "amber" : "slate"}>{row.confidence}</Badge>,
              <Badge key={`${row.name}-source`} tone={isProduction ? "green" : "blue"}>{isProduction ? "workspace record" : "demo record"}</Badge>,
              formatCurrency(row.conservative),
              formatCurrency(row.expected),
              formatCurrency(row.optimistic),
            ])}
          />
        ) : (
          <div className="p-6">
            <EmptyState
              title="No economic assumptions yet"
              body="Use cases need volume, handling time, adoption, and confidence assumptions before Finance can trust the value model."
              action="Open Use Cases"
              onAction={onOpenFactory}
            />
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
