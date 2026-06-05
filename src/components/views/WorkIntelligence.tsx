import {
  ArrowRight,
  Braces,
  EyeOff,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge, Button, DataTable, MiniMetric, Panel, riskTone, SectionTitle, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { ContextSource, Run, Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";
import { deriveWorkIntelligence, type WorkOpportunity } from "@/lib/work-intelligence";

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function hours(value: number) {
  if (!value) return "0h";
  if (value >= 24) return `${Math.round((value / 24) * 10) / 10}d`;
  return `${Math.round(value * 10) / 10}h`;
}

function eventLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function opportunityTone(opportunity: WorkOpportunity): BadgeTone {
  if (opportunity.score >= 75) return "green";
  if (opportunity.score >= 55) return "blue";
  if (opportunity.riskLevel === "high" || opportunity.riskLevel === "restricted") return "amber";
  return "slate";
}

export function WorkIntelligence({
  workSignals,
  useCases,
  skills,
  runs,
  contextSources,
  onOpenFactory,
  onOpenProcess,
  onOpenContext,
  onOpenTraining,
  onOpenGovernance,
  onCreateOpportunityFromSignal,
}: {
  workSignals: WorkSignal[];
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  contextSources: ContextSource[];
  onOpenFactory: () => void;
  onOpenProcess: () => void;
  onOpenContext: () => void;
  onOpenTraining: () => void;
  onOpenGovernance: () => void;
  onCreateOpportunityFromSignal: (opportunity: WorkOpportunity) => void;
}) {
  const intelligence = deriveWorkIntelligence({ workSignals, useCases, skills, runs, contextSources });
  const privacySafe =
    intelligence.privacyPosture.allContentRedacted &&
    intelligence.privacyPosture.allPiiRedacted &&
    !intelligence.privacyPosture.rawContentStored &&
    !intelligence.privacyPosture.individualScoringAllowed;
  const topOpportunity = intelligence.opportunityRadar[0];
  const safeSignalCount = workSignals.filter((signal) => signal.privacy.contentRedacted && signal.privacy.piiRedacted).length;
  const highRiskCount = workSignals.filter((signal) => signal.riskLevel === "high" || signal.riskLevel === "restricted").length;
  const nextTitle = topOpportunity ? `Promote ${topOpportunity.process}` : "Start with one safe work signal";
  const nextBody = topOpportunity
    ? `${topOpportunity.department} has repeated evidence for ${topOpportunity.recommendedPattern.toLowerCase()}. Create the use case so the owner, value, risk, process, and AI boundary are clear before anyone builds.`
    : "Connect approved work metadata or capture a manual signal. The OS should learn from patterns in work, not private employee messages.";
  const nextActionLabel = topOpportunity ? "Create use case" : "Open Use Cases";
  const readinessSteps = [
    {
      label: "Capture",
      helper: workSignals.length
        ? `${safeSignalCount.toLocaleString()} redacted signals are available.`
        : "Bring in redacted ticket, workflow, training, run, or context signals.",
      complete: workSignals.length > 0,
    },
    {
      label: "Protect",
      helper: privacySafe ? "Guardrails look clean." : "Review privacy before scaling this signal source.",
      complete: privacySafe,
    },
    {
      label: "Promote",
      helper: topOpportunity ? `${topOpportunity.process} is ready for intake.` : "Promote the first repeatable pain point into a use case.",
      complete: Boolean(topOpportunity),
    },
  ];
  const privacyItems = [
    { label: "Raw content stored", value: intelligence.privacyPosture.rawContentStored ? "Yes" : "No", ok: !intelligence.privacyPosture.rawContentStored },
    { label: "PII redacted", value: intelligence.privacyPosture.allPiiRedacted ? "Yes" : "Needs review", ok: intelligence.privacyPosture.allPiiRedacted },
    { label: "Individual scoring", value: intelligence.privacyPosture.individualScoringAllowed ? "Allowed" : "Blocked", ok: !intelligence.privacyPosture.individualScoringAllowed },
    {
      label: "Max retention",
      value: intelligence.privacyPosture.maxRetentionDays ? `${intelligence.privacyPosture.maxRetentionDays} days` : "Not set",
      ok: intelligence.privacyPosture.maxRetentionDays > 0 && intelligence.privacyPosture.maxRetentionDays <= 365,
    },
  ];
  const signalConversionSteps = [
    {
      label: "Observed pattern",
      title: topOpportunity ? `${topOpportunity.process} keeps repeating` : "Find one repeatable work pattern",
      body: topOpportunity
        ? `${topOpportunity.volume.toLocaleString()} work items and ${Math.round(topOpportunity.confidence * 100)}% confidence point to a real business workflow, not a one-off complaint.`
        : "Look for repeated tickets, delays, questions, rework, handoffs, or context gaps before asking AI to help.",
      status: topOpportunity ? `${topOpportunity.score}/100 fit` : "Needs signals",
      tone: topOpportunity ? opportunityTone(topOpportunity) : "slate",
      actionLabel: "Open Use Cases",
      action: onOpenFactory,
    },
    {
      label: "Best AI shape",
      title: topOpportunity?.recommendedPattern ?? "Choose a safe capability",
      body: topOpportunity?.recommendedAction ?? "Decide whether this needs a Knowledge Skill, process redesign, source remediation, training, or a human-gated workflow.",
      status: topOpportunity?.department ?? "No lane",
      tone: topOpportunity ? "blue" : "slate",
      actionLabel: topOpportunity?.recommendedPattern === "Workflow Redesign" ? "Map process" : "Review backlog",
      action: topOpportunity?.recommendedPattern === "Workflow Redesign" ? onOpenProcess : onOpenFactory,
    },
    {
      label: "Safety boundary",
      title: privacySafe ? "Safe to reason from" : "Review privacy first",
      body: privacySafe
        ? "The OS can use aggregated, redacted signal patterns while keeping raw content, PII, and individual scoring out of bounds."
        : "Resolve privacy posture before scaling this signal source. Work Signals should never become employee surveillance.",
      status: privacySafe ? "Protected" : `${highRiskCount.toLocaleString()} risk signals`,
      tone: privacySafe ? "green" : "amber",
      actionLabel: privacySafe ? "Open context" : "Open governance",
      action: privacySafe ? onOpenContext : onOpenGovernance,
    },
    {
      label: "Next click",
      title: topOpportunity ? "Promote it into a use case" : "Capture the first opportunity",
      body: topOpportunity
        ? "Create the use case so the owner, value, risk, process, data, human review, and AI boundary become explicit."
        : "Use the intake flow to turn the first safe pattern into a scoped AI opportunity.",
      status: topOpportunity ? "Ready for intake" : "Start intake",
      tone: topOpportunity ? "purple" : "blue",
      actionLabel: topOpportunity ? "Create use case" : "Open Use Cases",
      action: () => (topOpportunity ? onCreateOpportunityFromSignal(topOpportunity) : onOpenFactory()),
    },
  ] satisfies {
    label: string;
    title: string;
    body: string;
    status: string;
    tone: BadgeTone;
    actionLabel: string;
    action: () => void;
  }[];

  return (
    <div>
      <PageHeader
        title="Work Signals"
        subtitle="Privacy-safe evidence that turns repeated work pain into AI use cases, process changes, Skills, and proof."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenProcess}>
              <Route size={15} />
              Map process
            </Button>
            <Button onClick={onOpenFactory}>
              <Sparkles size={15} />
              Create use case
            </Button>
          </div>
        }
      />

      {workSignals.length ? (
        <>
          <Panel className="overflow-hidden" data-testid="work-primary-opportunity">
            <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={topOpportunity ? opportunityTone(topOpportunity) : "slate"}>{topOpportunity ? `${topOpportunity.score}/100 fit` : "start here"}</Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {intelligence.totals.signals.toLocaleString()} signals · {intelligence.totals.departments} departments
                  </span>
                </div>
                <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{nextTitle}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{nextBody}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => (topOpportunity ? onCreateOpportunityFromSignal(topOpportunity) : onOpenFactory())}>
                    <Sparkles size={15} />
                    {nextActionLabel}
                  </Button>
                  <Button variant="secondary" onClick={topOpportunity?.recommendedPattern === "Workflow Redesign" ? onOpenProcess : onOpenFactory}>
                    {topOpportunity?.recommendedPattern === "Workflow Redesign" ? "Map process" : "Review backlog"}
                    <ArrowRight size={14} />
                  </Button>
                </div>

                {topOpportunity ? (
                  <div className="mt-5 hidden rounded-lg border border-slate-200/80 bg-slate-50/80 p-4 sm:block">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Why this is first</div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">{topOpportunity.recommendedPattern}</div>
                      </div>
                      <Badge tone={opportunityTone(topOpportunity)}>{topOpportunity.volume.toLocaleString()} work items</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{topOpportunity.summaries[0]}</p>
                  </div>
                ) : null}
              </div>

              <div className="hidden border-t border-slate-200 bg-slate-50/56 p-5 md:block xl:border-l xl:border-t-0">
                <SectionTitle title="Signal health" helper="What this page can safely prove" compact />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric label="Signals" value={intelligence.totals.signals.toLocaleString()} />
                  <MiniMetric label="Safe" value={percent(intelligence.totals.privacyCoverage)} />
                  <MiniMetric label="Processes" value={String(intelligence.totals.processes)} />
                  <MiniMetric label="Avg delay" value={hours(intelligence.totals.avgDelayHours)} />
                </div>
                <div className="mt-4 rounded-lg border border-white bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    {privacySafe ? <ShieldCheck size={16} className="text-green-600" /> : <LockKeyhole size={16} className="text-amber-600" />}
                    {privacySafe ? "Privacy posture is clean" : "Privacy review needed"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {privacySafe
                      ? "Signals are aggregated, redacted, retention-limited, and blocked from individual productivity scoring."
                      : `${highRiskCount.toLocaleString()} higher-risk signal${highRiskCount === 1 ? "" : "s"} should be reviewed before broad use.`}
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <details
            className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl"
            data-testid="work-signal-to-use-case-path"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-slate-950">Signal-to-use-case proof path</div>
                <div className="mt-1 text-sm text-slate-500">
                  Open to see capture, privacy, promotion, and intake evidence for this recommendation.
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-slate-400" />
            </summary>
            <div className="border-t border-slate-200 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                {readinessSteps.map((step, index) => (
                  <div key={step.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-green-50 text-green-700 ring-1 ring-green-100" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                        {index + 1}
                      </span>
                      <div className="text-sm font-semibold text-slate-950">{step.label}</div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{step.helper}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-0 overflow-hidden rounded-lg border border-slate-200 lg:grid-cols-4">
                {signalConversionSteps.map((step, index) => (
                  <div
                    key={step.label}
                    data-testid={`work-signal-path-step-${index + 1}`}
                    className={`bg-white p-4 ${index ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{step.label}</div>
                      <Badge tone={step.tone}>{step.status}</Badge>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-950">{step.title}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{step.body}</p>
                    <Button variant={index === signalConversionSteps.length - 1 ? "primary" : "secondary"} onClick={step.action} className="mt-4 w-full whitespace-nowrap">
                      {step.actionLabel}
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details
            className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl"
            data-testid="work-opportunity-proof"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-slate-950">Other ranked opportunities and decisions</div>
                <div className="mt-1 text-sm text-slate-500">
                  Open for the full opportunity radar and enablement-lead decisions.
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-slate-400" />
            </summary>
            <div className="grid gap-4 border-t border-slate-200 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <SectionTitle title="Best opportunities" helper="Ranked work pain that can become use cases, process changes, or reusable Skills" compact />
                </div>
                <div className="divide-y divide-slate-100">
                  {intelligence.opportunityRadar.slice(0, 5).map((opportunity, index) => (
                    <div key={opportunity.key} className="grid gap-4 px-5 py-4 lg:grid-cols-[40px_minmax(0,1fr)_170px]">
                      <div className="flex size-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-slate-950">{opportunity.process}</div>
                          <Badge tone={opportunityTone(opportunity)}>{opportunity.score}/100</Badge>
                          <Badge tone={riskTone(opportunity.riskLevel)}>{opportunity.riskLevel}</Badge>
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {opportunity.department} · {opportunity.recommendedPattern}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.summaries[0]}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{opportunity.volume.toLocaleString()} work items</span>
                          <span>{hours(opportunity.avgDelayHours)} avg delay</span>
                          <span>{Math.round(opportunity.confidence * 100)}% confidence</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center gap-2">
                        <Button onClick={() => onCreateOpportunityFromSignal(opportunity)}>
                          Create use case
                          <ArrowRight size={14} />
                        </Button>
                        <Button variant="secondary" onClick={opportunity.recommendedPattern === "Workflow Redesign" ? onOpenProcess : onOpenFactory}>
                          {opportunity.recommendedPattern === "Workflow Redesign" ? "Map process" : "Open Use Cases"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <SectionTitle title="Decisions" helper="What an enablement lead should decide next" compact />
                <div className="mt-4 space-y-3">
                  {intelligence.executiveDecisions.length ? intelligence.executiveDecisions.slice(0, 4).map((decision) => (
                    <button
                      key={decision.id}
                      type="button"
                      onClick={decision.id.includes("context") ? onOpenContext : decision.id.includes("privacy") ? onOpenGovernance : onOpenFactory}
                      className="w-full rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold text-slate-950">{decision.label}</div>
                        <Badge tone={decision.priority === "high" ? "red" : decision.priority === "medium" ? "amber" : "slate"}>{decision.priority}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{decision.detail}</p>
                    </button>
                  )) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No decisions are waiting. Keep collecting governed work patterns.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details>

          <details className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-slate-950">Privacy guardrails and signal details</div>
                <div className="mt-1 text-sm text-slate-500">Open for policy checks, process mining, adoption, context quality, ledger rows, and Skill learning.</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-slate-400" />
            </summary>
            <div className="space-y-4 border-t border-slate-200 p-5">
              <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div>
                  <SectionTitle title="Privacy guardrails" helper="The OS learns from work patterns, not private surveillance." compact />
                  <div className="mt-4 space-y-3">
                    {privacyItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                        <div className="flex items-center gap-2 font-medium text-slate-700">
                          {item.ok ? <ShieldCheck size={15} className="text-green-600" /> : <LockKeyhole size={15} className="text-red-600" />}
                          {item.label}
                        </div>
                        <Badge tone={item.ok ? "green" : "red"}>{item.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <SectionTitle title="Process friction" helper="Where work slows down before automation." compact />
                    <div className="mt-4 space-y-3">
                      {intelligence.processInsights.slice(0, 3).map((insight) => (
                        <div key={`${insight.department}-${insight.process}`} className="rounded-lg border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-950">{insight.process}</div>
                              <div className="mt-1 text-xs text-slate-500">{insight.department}</div>
                            </div>
                            <Badge tone={insight.delays + insight.rework ? "amber" : "green"}>{insight.delays + insight.rework} flags</Badge>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-slate-500">{insight.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <SectionTitle title="Adoption" helper="Where teams are using or avoiding AI." compact />
                    <div className="mt-4 space-y-3">
                      {intelligence.adoptionInsights.slice(0, 3).map((insight) => (
                        <button key={insight.department} type="button" onClick={onOpenTraining} className="w-full rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-slate-950">{insight.department}</div>
                            <Badge tone={insight.adoptionHealth === "strong" ? "green" : insight.adoptionHealth === "building" ? "blue" : "amber"}>{insight.adoptionHealth}</Badge>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-slate-500">{insight.recommendation}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <SectionTitle title="Knowledge gaps" helper="Sources that may weaken grounded answers." compact />
                    <div className="mt-4 space-y-3">
                      {intelligence.contextQuality.length ? intelligence.contextQuality.slice(0, 3).map((item) => (
                        <button key={item.sourceName} type="button" onClick={onOpenContext} className="w-full rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-950">{item.sourceName}</div>
                              <div className="mt-1 text-xs text-slate-500">{item.department}</div>
                            </div>
                            <Badge tone={item.sourceHealth === "stale" ? "red" : item.gapSignals ? "amber" : "slate"}>{item.sourceHealth}</Badge>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-slate-500">{item.recommendation}</p>
                        </button>
                      )) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No context quality alerts are recorded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DataTable
                caption="Privacy-filtered work signal ledger"
                columns={["Source", "Event", "Department", "Process", "Privacy", "Risk", "Created"]}
                rows={workSignals.slice(0, 12).map((signal) => [
                  eventLabel(signal.source),
                  eventLabel(signal.eventType),
                  signal.department,
                  signal.process,
                  <div key="privacy" className="flex items-center gap-2 text-xs text-slate-500">
                    <EyeOff size={14} className={signal.privacy.contentRedacted && signal.privacy.piiRedacted ? "text-green-600" : "text-amber-600"} />
                    {signal.privacy.consentBasis}
                  </div>,
                  <Badge key="risk" tone={riskTone(signal.riskLevel)}>{signal.riskLevel}</Badge>,
                  signal.createdAt,
                ])}
              />

              <DataTable
                caption="Adaptive Skill learning recommendations"
                columns={["Skill", "Signals", "Successful Runs", "Posture", "Recommendation"]}
                rows={intelligence.skillLearning.map((item) => [
                  item.skillName,
                  item.signals.toLocaleString(),
                  item.successfulRuns.toLocaleString(),
                  <Badge key="posture" tone={item.needsTuning ? "amber" : "green"}>{item.needsTuning ? "Tune before scale" : "Pattern candidate"}</Badge>,
                  item.recommendation,
                ])}
              />
            </div>
          </details>
        </>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel className="p-5 sm:p-6">
            <Badge tone="blue">start here</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Start with privacy-safe work evidence</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Add aggregated metadata from tickets, workflows, training, context retrieval, or test runs. Work Signals should reveal repeatable pain and proof without storing raw messages or ranking employees.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={onOpenFactory}>
                <Sparkles size={15} />
                Create first use case
              </Button>
              <Button variant="secondary" onClick={onOpenGovernance}>
                <ShieldCheck size={15} />
                Review guardrails
              </Button>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {[
                ["Connect", "Use approved system metadata from tickets, workflows, learning, runs, and context retrieval."],
                ["Redact", "Keep raw content, private messages, unredacted PII, and individual productivity scoring out."],
                ["Promote", "Turn the first repeatable pain point into a use case with value, risk, owner, and AI boundary."],
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

          <Panel className="overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <SectionTitle title="Signal ingestion contract" helper="Use this API shape for approved connectors." compact />
            </div>
            <div className="p-5">
              <div className="grid gap-3">
                {[
                  ["Endpoint", "POST /api/work-signals"],
                  ["Batch limit", "100 signals"],
                  ["Privacy", "redacted only"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">{value}</div>
                  </div>
                ))}
              </div>
              <details className="mt-4 rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-950">Open example payload</summary>
                <pre className="max-h-[320px] overflow-auto border-t border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
{`{
  "signals": [
    {
      "source": "service_now",
      "eventType": "workflow_delayed",
      "department": "HR",
      "process": "Employee policy support",
      "summary": "Aggregated metadata shows repeated policy handoff delays.",
      "metadata": {
        "volume": 420,
        "delayHours": 18,
        "cycleTimeHours": 34,
        "confidence": 0.86,
        "system": "ServiceNow"
      },
      "privacy": {
        "contentRedacted": true,
        "piiRedacted": true,
        "consentBasis": "system_metadata",
        "retentionDays": 90,
        "individualScoringAllowed": false,
        "rawContentStored": false
      },
      "riskLevel": "medium"
    }
  ]
}`}
                </pre>
              </details>
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm leading-6 text-green-800">
                  <div className="flex items-center gap-2 font-semibold text-green-900">
                    <ShieldCheck size={15} />
                    Accepted
                  </div>
                  Aggregated event counts, delay metadata, context gaps, run outcomes, training completion, and explicit opt-in feedback.
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-800">
                  <div className="flex items-center gap-2 font-semibold text-red-900">
                    <Braces size={15} />
                    Rejected
                  </div>
                  Raw message bodies, private chat content, employee surveillance, individual productivity scoring, or unredacted PII.
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
