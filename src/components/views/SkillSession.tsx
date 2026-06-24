import {
  BrainCircuit,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Avatar, Badge, Button, MiniMetric, Panel, SectionTitle, riskTone, statusTone } from "@/components/ui";
import { initials } from "@/components/factory/shared";
import type { AuditLog, Run, RunTraceStep, Skill, ToolRequest } from "@/lib/enterprise-ai-data";
import { statusLabels } from "@/lib/ui/constants";

function formatLatency(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} sec`;
  return `${ms} ms`;
}

function traceTone(status: RunTraceStep["status"]) {
  if (status === "completed") return "bg-[var(--success)] text-white";
  if (status === "blocked") return "bg-[var(--danger)] text-white";
  if (status === "waiting") return "bg-[var(--warning)] text-white";
  return "bg-[var(--primary)] text-white";
}

function previewText(text: string, max = 520) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export function SkillSession({
  skill,
  run,
  toolRequests,
  auditLogs,
  followUp,
  setFollowUp,
  replies,
  onSendFollowUp,
  onNewConversation,
  onViewTrace,
  onOpenSettings,
  onViewBroker,
}: {
  skill: Skill;
  run: Run;
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  followUp: string;
  setFollowUp: (value: string) => void;
  replies: string[];
  onSendFollowUp: () => void;
  onNewConversation: () => void;
  onViewTrace: () => void;
  onOpenSettings: () => void;
  onViewBroker: () => void;
}) {
  const latestRequest = toolRequests.find((request) => request.runId === run.id) ?? null;
  const waitingForApproval = run.status === "waiting_for_approval" || latestRequest?.status === "pending";
  const resolved = run.status === "completed" || latestRequest?.status === "approved";
  const sessionSources = skill.contextSources;
  const tracePreview = run.trace.slice(0, 6);
  const brokerLogs = auditLogs.filter((log) => log.message.includes(skill.name) || log.actor === "AI Harness").slice(0, 3);
  const answerPreview = previewText(run.output);
  const hasLongAnswer = answerPreview !== run.output;
  const runCost = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(run.costUsd);
  const completedTraceSteps = run.trace.filter((step) => step.status === "completed").length;
  const followUpDisabledReason = followUp.trim() ? "" : "Enter a follow-up before sending.";

  const nextMove =
    waitingForApproval && latestRequest
      ? {
          title: "Review the requested action",
          body: `${skill.name} is asking to use ${latestRequest.toolId}. Check the reason and approve only if the action matches policy.`,
          label: "Open broker",
          action: onViewBroker,
          tone: "amber" as const,
          icon: LockKeyhole,
        }
      : !sessionSources.length
        ? {
            title: "Add trusted context",
            body: "This Skill answered without approved source material. Add source policy before using it for real decisions.",
            label: "Open settings",
            action: onOpenSettings,
            tone: "red" as const,
            icon: FileText,
          }
        : resolved
          ? {
              title: "Capture proof from this run",
              body: "The session is ready to review. Open the trace to inspect grounding, tool policy, latency, and evidence.",
              label: "View trace",
              action: onViewTrace,
              tone: "green" as const,
              icon: ShieldCheck,
            }
          : {
              title: "Check the current stage",
              body: `${skill.name} is still at ${run.currentStage}. Use the trace to see what is running and what needs attention.`,
              label: "View trace",
              action: onViewTrace,
              tone: "blue" as const,
              icon: ClipboardCheck,
            };
  const NextMoveIcon = nextMove.icon;

  const sessionPath = [
    {
      label: "Ask",
      helper: run.triggeredBy,
      complete: true,
      action: onNewConversation,
    },
    {
      label: "Ground",
      helper: sessionSources.length ? `${sessionSources.length} approved source${sessionSources.length === 1 ? "" : "s"}` : "No approved sources",
      complete: sessionSources.length > 0,
      action: onOpenSettings,
    },
    {
      label: "Act",
      helper: latestRequest ? `${latestRequest.toolId} ${latestRequest.status}` : "No tool request",
      complete: !latestRequest || latestRequest.status === "approved",
      action: latestRequest ? onViewBroker : onViewTrace,
    },
    {
      label: "Prove",
      helper: resolved ? "Trace ready" : run.currentStage,
      complete: resolved,
      action: onViewTrace,
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-eyebrow text-[var(--text-soft)]">Skill session</span>
            <Badge tone={statusTone(skill.status)}>{statusLabels[skill.status]}</Badge>
            <Badge tone={riskTone(run.riskLevel)}>{run.riskLevel} risk</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">Skill Session</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">{skill.name}</span>
            {" · "}
            {skill.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onNewConversation}>
            <Plus size={15} />
            New test
          </Button>
          <Button variant="secondary" onClick={onOpenSettings} aria-label="Open Skill settings">
            <Settings size={15} />
            Settings
          </Button>
          <Button onClick={nextMove.action} data-testid="skill-session-next-action">
            <NextMoveIcon size={15} />
            {nextMove.label}
          </Button>
        </div>
      </div>

      <Panel className="overflow-hidden border-[var(--elev-2-border)] bg-[var(--elev-2)] shadow-[var(--elev-2-shadow)]" data-testid="skill-session-workbench">
        <div className="grid min-h-[640px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col">
            <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="skill-session-path">
                {sessionPath.map((step, index) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={step.action}
                    className="grid min-h-[68px] grid-cols-[28px_minmax(0,1fr)] items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)] sm:gap-3"
                    data-testid={`skill-session-path-step-${index + 1}`}
                  >
                    <span
                      className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold ${
                        step.complete ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                      }`}
                    >
                      {step.complete ? <Check size={14} /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--text)]">{step.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{step.helper}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-5 px-4 py-5 sm:px-5">
              <div className={`rounded-lg border px-4 py-3 ${waitingForApproval ? "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)]" : resolved ? "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)]" : "border-[color-mix(in_srgb,var(--info)_28%,var(--border))] bg-[var(--info-soft)]"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${waitingForApproval ? "bg-[var(--warning)] text-white" : resolved ? "bg-[var(--success)] text-white" : "bg-[var(--info)] text-white"}`}>
                      {waitingForApproval ? <LockKeyhole size={17} /> : resolved ? <Check size={18} /> : <BrainCircuit size={18} />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">
                        {waitingForApproval ? "Waiting for human approval" : resolved ? "Run completed" : "Run in progress"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{run.currentStage}</div>
                    </div>
                  </div>
                  <Badge tone={statusTone(run.status)}>{run.status.replace(/_/g, " ")}</Badge>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <Avatar label={initials(run.triggeredBy)} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-[var(--text)]">{run.triggeredBy}</span>
                    <span className="text-xs text-[var(--text-soft)]">{run.startedAt}</span>
                  </div>
                  <div className="max-w-[820px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--text)]">
                    {run.trace[0]?.detail ?? "Skill test request"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                  <BrainCircuit size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-[var(--text)]">{skill.name}</span>
                    <span className="text-xs text-[var(--text-soft)]">Current answer</span>
                    <Badge tone={sessionSources.length ? "green" : "amber"}>{sessionSources.length ? "grounded" : "needs sources"}</Badge>
                  </div>
                  <div className="max-w-[860px] rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--text-muted)]">
                    <p>{answerPreview}</p>

                    {hasLongAnswer ? (
                      <details className="mt-4 border-t border-[var(--border)] pt-3">
                        <summary className="-mx-1 flex min-h-8 cursor-pointer items-center rounded-md px-1 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]">
                          Read full answer
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">{run.output}</p>
                      </details>
                    ) : null}

                    <div className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                      <details>
                        <summary className="-mx-1 flex min-h-8 cursor-pointer items-center rounded-md px-1 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]">
                          Sources ({sessionSources.length})
                        </summary>
                        {sessionSources.length ? (
                          <div className="mt-3 space-y-2">
                            {sessionSources.map((source) => (
                              <div key={source} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                                <FileText size={15} className="mt-0.5 shrink-0 text-[var(--text-soft)]" />
                                <span>{source}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-[var(--warning)]">No context sources are configured for this Skill.</p>
                        )}
                      </details>

                      <details>
                        <summary className="-mx-1 flex min-h-8 cursor-pointer items-center rounded-md px-1 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]">
                          Tool action ({latestRequest?.status ?? "none"})
                        </summary>
                        {latestRequest ? (
                          <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                            <div className="font-semibold text-[var(--text)]">{latestRequest.toolId}</div>
                            <p>{latestRequest.reason}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone={riskTone(latestRequest.riskLevel)}>{latestRequest.riskLevel} risk</Badge>
                              <Badge tone={statusTone(latestRequest.status)}>{latestRequest.status}</Badge>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">This answer did not request a tool action.</p>
                        )}
                      </details>
                    </div>
                  </div>
                </div>
              </div>

              {replies.map((reply, index) => (
                <div key={reply + index} className="flex items-start gap-3 sm:gap-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                    <BrainCircuit size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <span className="font-semibold text-[var(--text)]">{skill.name}</span>
                      <span className="text-xs text-[var(--text-soft)]">Follow-up</span>
                    </div>
                    <div className="max-w-[860px] rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                      {reply}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                <Sparkles size={16} className="shrink-0 text-[var(--primary)]" />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                  placeholder="Ask a follow-up or request a safer version..."
                  value={followUp}
                  onChange={(event) => setFollowUp(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && followUp.trim()) onSendFollowUp();
                  }}
                />
                <button
                  type="button"
                  aria-label="Send follow-up"
                  aria-describedby={followUpDisabledReason ? "skill-session-follow-up-disabled-reason" : undefined}
                  title={followUpDisabledReason || undefined}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={onSendFollowUp}
                  disabled={Boolean(followUpDisabledReason)}
                >
                  <Play size={15} />
                </button>
              </div>
              {followUpDisabledReason ? (
                <div id="skill-session-follow-up-disabled-reason" className="sr-only">
                  {followUpDisabledReason}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-[var(--text-soft)]">AI-generated content. Verify critical details before using it with customers or employees.</div>
            </div>
          </div>

          <aside className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-5 xl:border-l xl:border-t-0">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <NextMoveIcon size={18} />
                </span>
                <div className="min-w-0">
                  <span className="t-eyebrow text-[var(--text-soft)]">{nextMove.label}</span>
                  <h2 className="mt-3 text-lg font-semibold text-[var(--text)]">{nextMove.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{nextMove.body}</p>
                </div>
              </div>
              <Button onClick={nextMove.action} className="mt-4 w-full whitespace-nowrap">
                {nextMove.label}
                <ChevronRight size={14} />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Status" value={run.status.replace(/_/g, " ")} />
              <MiniMetric label="Risk" value={run.riskLevel} />
              <MiniMetric label="Cost" value={runCost} />
              <MiniMetric label="Latency" value={formatLatency(run.latencyMs)} />
            </div>

            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <SectionTitle title="Proof drawers" helper="Collapsed until someone needs the audit trail." compact />
              <div className="mt-4 space-y-2">
                <details className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2" open>
                  <summary className="-mx-1 flex min-h-8 cursor-pointer items-center rounded-md px-1 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]">
                    Harness trace (<span className="tabular-nums">{completedTraceSteps}/{Math.max(run.trace.length, 1)}</span>)
                  </summary>
                  <div className="mt-3 space-y-3">
                    {tracePreview.map((step) => (
                      <div key={step.label} className="grid grid-cols-[24px_minmax(0,1fr)_56px] items-start gap-3 text-sm">
                        <span className={`flex size-5 items-center justify-center rounded-full ${traceTone(step.status)}`}>
                          <Check size={12} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--text)]">{step.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{step.detail}</span>
                        </span>
                        <span className="text-right text-xs text-[var(--text-muted)]">{formatLatency(step.latencyMs)}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex min-h-8 items-center rounded-md pr-2 text-xs font-semibold text-[var(--primary)] hover:underline focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={onViewTrace}
                  >
                    View full trace
                  </button>
                </details>

                <details className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                  <summary className="-mx-1 flex min-h-8 cursor-pointer items-center rounded-md px-1 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]">
                    Source policy ({sessionSources.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {sessionSources.length ? sessionSources.map((source) => (
                      <div key={source} className="flex items-start gap-2 text-sm leading-6 text-[var(--text-muted)]">
                        <FileText size={15} className="mt-0.5 shrink-0 text-[var(--text-soft)]" />
                        <span>{source}</span>
                      </div>
                    )) : (
                      <p className="text-sm leading-6 text-[var(--warning)]">Add source policy before scaling this Skill.</p>
                    )}
                  </div>
                </details>

                <details className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                  <summary className="-mx-1 flex min-h-8 cursor-pointer items-center rounded-md px-1 text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]">
                    Broker activity ({brokerLogs.length})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {brokerLogs.length ? brokerLogs.map((log) => (
                      <div key={log.id} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 text-sm">
                        <span className="flex size-5 items-center justify-center rounded-full bg-[var(--success)] text-white">
                          <Check size={12} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--text)]">{log.eventType.replace(/_/g, " ")}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{log.message}</span>
                        </span>
                      </div>
                    )) : (
                      <p className="text-sm leading-6 text-[var(--text-muted)]">No broker events recorded for this run yet.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex min-h-8 items-center rounded-md pr-2 text-xs font-semibold text-[var(--primary)] hover:underline focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={onViewBroker}
                  >
                    Open broker policy
                  </button>
                </details>
              </div>
            </div>
          </aside>
        </div>
      </Panel>
    </div>
  );
}
