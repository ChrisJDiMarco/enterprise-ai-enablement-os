import type React from "react";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Check,
  ChevronRight,
  Database,
  FileText,
  Fingerprint,
  GitBranch,
  Library,
  LockKeyhole,
  Network,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  TestTube2,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Button, DataTable, EmptyState, MiniMetric, Panel, riskTone, SectionTitle, SimulationBadge, statusTone, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { deriveAgentControlPlane, type AgentAssetStatus, type AgentSecurityFindingSeverity } from "@/lib/agent-control-plane";
import { deriveAgentOpsBlueprint } from "@/lib/agent-ops-blueprint";
import { deriveAgentIdentityGovernance, type AgentIdentityStatus } from "@/lib/agent-identity-governance";
import { type AuditLog, getUserName, type Run, type Skill, type ToolRequest, type User } from "@/lib/enterprise-ai-data";
import { openClawIntegration, openClawStatusTone } from "@/lib/openclaw-integration";
import { autonomyLabels, statusLabels } from "@/lib/ui/constants";
import type { HarnessMode } from "@/lib/ui/types";

export function Harness({
  runs,
  selectedRun,
  mode,
  setMode,
  setSelectedRunId,
  skills,
  toolRequests,
  auditLogs,
  users,
  onDecision,
  onRerun,
  onOpenSkills,
  onOpenSkill,
  onOpenBroker,
  onToggleSkillKillSwitch,
}: {
  runs: Run[];
  selectedRun: Run | null;
  mode: HarnessMode;
  setMode: (mode: HarnessMode) => void;
  setSelectedRunId: (id: string) => void;
  skills: Skill[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  users: User[];
  onDecision: (request: ToolRequest, decision: "approved" | "rejected") => void;
  onRerun: (skill?: Skill | null) => void;
  onOpenSkills: () => void;
  onOpenSkill: (skill: Skill) => void;
  onOpenBroker: () => void;
  onToggleSkillKillSwitch: (skill: Skill) => void;
}) {
  const [tab, setTab] = useState("trace");
  const pendingApprovals = toolRequests.filter((request) => request.status === "pending");
  const completedRuns = runs.filter((run) => run.status === "completed");
  const activeRuns = runs.filter((run) => run.status === "running" || run.status === "waiting_for_approval" || run.status === "queued");
  const blockedRuns = runs.filter((run) => run.status === "blocked" || run.status === "failed");
  const totalCost = runs.reduce((sum, run) => sum + run.costUsd, 0);
  const avgLatency = runs.length ? Math.round(runs.reduce((sum, run) => sum + run.latencyMs, 0) / runs.length) : 0;
  const runSkills = new Set(runs.map((run) => run.skillId));
  const runtimeSkillCount = skills.filter((skill) => runSkills.has(skill.id)).length;
  const agentOpsBlueprint = deriveAgentOpsBlueprint({ runs, skills, toolRequests, auditLogs });
  const identityGovernance = deriveAgentIdentityGovernance({ skills, runs, toolRequests, auditLogs });
  const agentControlPlane = deriveAgentControlPlane({ skills, runs, toolRequests, auditLogs });
  const identityStatusTone: Record<AgentIdentityStatus, "green" | "blue" | "amber" | "red"> = {
    active: "green",
    restricted: "amber",
    disabled: "red",
    "needs-owner": "blue",
  };
  const agentAssetTone: Record<AgentAssetStatus, "green" | "blue" | "amber" | "red" | "slate"> = {
    active: "green",
    learning: "blue",
    restricted: "amber",
    disabled: "red",
    unmanaged: "slate",
  };
  const findingTone: Record<AgentSecurityFindingSeverity, "green" | "blue" | "amber" | "red" | "purple"> = {
    low: "blue",
    medium: "amber",
    high: "red",
    critical: "purple",
  };
  const blueprintIcon = {
    "durable-runtime": GitBranch,
    "guardrail-stack": ShieldCheck,
    "connector-broker": Network,
    telemetry: Activity,
    evaluation: TestTube2,
    "governance-evidence": FileText,
  };
  const stageMetrics = [
    { label: "Request intake", count: runs.length, latency: "18 ms", errors: 0 },
    { label: "Identity check", count: runs.length, latency: "52 ms", errors: 0 },
    { label: "Context retrieval", count: runs.filter((run) => run.trace.some((step) => /context|retrieval/i.test(step.label))).length, latency: "610 ms", errors: 0 },
    { label: "Policy engine", count: runs.filter((run) => run.trace.some((step) => /policy|permission/i.test(step.label))).length, latency: "124 ms", errors: blockedRuns.length },
    { label: "Model routing", count: runs.filter((run) => run.trace.some((step) => /model|llm/i.test(step.label))).length, latency: avgLatency ? `${(avgLatency / 1000).toFixed(1)} s` : "0 ms", errors: 0 },
    { label: "Tool broker", count: toolRequests.length, latency: "215 ms", errors: toolRequests.filter((request) => request.status === "blocked" || request.status === "rejected").length },
    { label: "Approval gate", count: pendingApprovals.length, latency: pendingApprovals.length ? "Pending" : "0 ms", errors: 0 },
    { label: "Audit evidence", count: auditLogs.length, latency: "real time", errors: 0 },
  ];
  const recommendedSkill =
    skills.find((skill) => ["pilot", "approved", "production"].includes(skill.status)) ?? skills[0] ?? null;
  const firstTestProof = [
    {
      label: "Identity",
      helper: "Confirms which user and AI Skill started the run.",
      icon: UserRound,
    },
    {
      label: "Context",
      helper: "Shows which approved knowledge sources were retrieved.",
      icon: Database,
    },
    {
      label: "Permissions",
      helper: "Records tool requests, approval gates, and policy decisions.",
      icon: LockKeyhole,
    },
    {
      label: "Evidence",
      helper: "Creates a trace the risk, launch, and proof views can reuse.",
      icon: FileText,
    },
  ];

  function openRun(run: Run) {
    setSelectedRunId(run.id);
    setMode("detail");
    setTab("trace");
  }

  function runSkillName(run: Run) {
    return skills.find((skill) => skill.id === run.skillId)?.name ?? run.skillId;
  }

  function userName(userId?: string) {
    if (!userId) return "Unassigned";
    const workspaceUser = users.find((user) => user.id === userId);
    if (workspaceUser) return workspaceUser.name;
    const catalogUserName = getUserName(userId);
    return catalogUserName === "User not configured" ? userId : catalogUserName;
  }

  function userProfile(userId?: string) {
    if (!userId) {
      return { name: "Unassigned", detail: "No accountable user configured", initials: "UA" };
    }
    const workspaceUser = users.find((user) => user.id === userId);
    const name = workspaceUser?.name ?? userName(userId);
    const detail = workspaceUser ? `${workspaceUser.title} · ${workspaceUser.department}` : "External or system identity";
    const initials = name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ID";

    return { name, detail, initials };
  }

  function runTriggerName(run: Run) {
    return userName(run.triggeredBy);
  }

  if (mode === "overview") {
    const latestRun = runs[0] ?? null;
    const needsApproval = pendingApprovals.length > 0;
    const hasFailures = blockedRuns.length > 0;
    const hasRuns = runs.length > 0;
    const nextTitle = hasFailures
      ? "Next: review failed tests"
      : needsApproval
        ? "Next: decide the pending approval"
        : hasRuns
          ? "Next: run another test"
          : "Start with the first Skill test";
    const nextBody = hasFailures
      ? `${blockedRuns.length} run${blockedRuns.length === 1 ? "" : "s"} stopped or failed. Open the run ledger, inspect the trace, and fix the Skill, tool policy, or approval gate before launch.`
      : needsApproval
        ? `${pendingApprovals.length} tool request${pendingApprovals.length === 1 ? "" : "s"} need a human decision before the test can finish.`
        : hasRuns
          ? "Recent tests have no blocking failures. Run the selected Skill again to create fresh trace evidence before moving toward launch."
          : "Run a Skill through the Harness to capture identity, context, policy checks, model calls, tool requests, approvals, output checks, and audit evidence.";
    const nextActionLabel = hasFailures ? "Open failed runs" : needsApproval ? "Open approval trace" : hasRuns ? "Run test" : skills.length ? "Run first test" : "Open AI Skills";
    const readinessSteps = [
      {
        label: "Run",
        complete: hasRuns,
        helper: hasRuns ? `${runs.length.toLocaleString()} test run${runs.length === 1 ? "" : "s"} recorded.` : "Run one Skill through the Harness.",
      },
      {
        label: "Approve",
        complete: !needsApproval,
        helper: needsApproval ? `${pendingApprovals.length} human decision${pendingApprovals.length === 1 ? "" : "s"} waiting.` : "No approvals are waiting.",
      },
      {
        label: "Fix",
        complete: !hasFailures,
        helper: hasFailures ? `${blockedRuns.length} blocked or failed run${blockedRuns.length === 1 ? "" : "s"}.` : "No blocked or failed runs.",
      },
      {
        label: "Prove",
        complete: auditLogs.length > 0,
        helper: auditLogs.length ? `${auditLogs.length.toLocaleString()} audit event${auditLogs.length === 1 ? "" : "s"} captured.` : "Evidence appears after the first run.",
      },
    ];
    const testHealth = [
      ["Runs", runs.length.toLocaleString()],
      ["Passed", completedRuns.length.toLocaleString()],
      ["Waiting", activeRuns.length.toLocaleString()],
      ["Cost", `$${totalCost.toFixed(3)}`],
    ];
    const primaryApproval = pendingApprovals[0] ?? null;
    function openApprovalTrace(request = primaryApproval) {
      if (!request?.runId) {
        onOpenBroker();
        return;
      }
      setSelectedRunId(request.runId);
      setMode("detail");
    }
    const completedReadinessSteps = readinessSteps.filter((step) => step.complete).length;
    const proofHealthItems = [
      { label: "Runs", value: runs.length.toLocaleString(), helper: `${runtimeSkillCount} Skill${runtimeSkillCount === 1 ? "" : "s"} tested` },
      { label: "Passed", value: completedRuns.length.toLocaleString(), helper: "completed without a waiting gate" },
      { label: "Waiting", value: activeRuns.length.toLocaleString(), helper: "queued, running, or approval paused" },
      { label: "Cost", value: `$${totalCost.toFixed(3)}`, helper: avgLatency ? `${(avgLatency / 1000).toFixed(1)}s average latency` : "no latency yet" },
    ];

    return (
      <div>
        <PageHeader
          title="AI Harness"
          subtitle="Run governed Skill and workflow tests with trace evidence, approvals, tool policy, safety checks, cost, latency, and audit proof."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setMode("runs")}>
                <Activity size={15} />
                Run history
              </Button>
              <Button onClick={skills.length ? () => onRerun() : onOpenSkills}>
                {skills.length ? <Play size={15} /> : <Library size={15} />}
                {skills.length ? "Run test" : "Open AI Skills"}
              </Button>
            </div>
          }
        />

        {hasRuns ? (
          <>
            <Panel className="overflow-hidden" data-testid="harness-primary-decision">
              <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={hasFailures ? "red" : needsApproval ? "amber" : "green"}>
                      {hasFailures ? "review needed" : needsApproval ? "approval waiting" : "tests clean"}
                    </Badge>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      {runs.length.toLocaleString()} runs · {runtimeSkillCount} Skills · {avgLatency ? `${(avgLatency / 1000).toFixed(1)}s avg` : "0s avg"}
                    </span>
                  </div>
                  <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">{nextTitle}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">{nextBody}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={() => {
                      if (hasFailures) {
                        setMode("runs");
                        return;
                      }
                      if (needsApproval) {
                        openApprovalTrace();
                        return;
                      }
                      if (skills.length) {
                        onRerun();
                        return;
                      }
                      onOpenSkills();
                    }}>
                      {hasFailures ? <AlertTriangle size={15} /> : needsApproval ? <LockKeyhole size={15} /> : <Play size={15} />}
                      {nextActionLabel}
                    </Button>
                    <Button variant="secondary" onClick={() => setMode("runs")}>
                      Run history
                      <ChevronRight size={14} />
                    </Button>
                  </div>

                  <details
                    className="group mt-6 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72"
                    data-testid="harness-test-proof"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--text)]">What this test evidence proves</span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                          {completedReadinessSteps}/{readinessSteps.length} checks ready · {pendingApprovals.length} approval{pendingApprovals.length === 1 ? "" : "s"} waiting · {blockedRuns.length} blocked
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={hasFailures ? "red" : needsApproval ? "amber" : "green"}>
                          {hasFailures ? "blocked" : needsApproval ? "waiting" : "clean"}
                        </Badge>
                        <ChevronRight size={16} className="text-[var(--text-soft)] transition group-open:rotate-90" />
                      </span>
                    </summary>
                    <div className="hidden border-t border-[var(--border)]/70 group-open:block">
                      <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-2 xl:grid-cols-4">
                        {readinessSteps.map((step, index) => (
                          <div key={step.label} className="min-h-[112px] bg-[var(--surface)] p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  step.complete ? "bg-[var(--success)] text-white" : "bg-[var(--surface-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                                }`}
                              >
                                {step.complete ? <Check size={14} /> : index + 1}
                              </span>
                              <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
                            </div>
                            <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{step.helper}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-px border-t border-[var(--border)]/70 bg-[var(--border)]/70 sm:grid-cols-2 xl:grid-cols-4">
                        {proofHealthItems.map((item) => (
                          <div key={item.label} className="bg-[var(--surface)] p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                            <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)] tabular-nums">{item.value}</div>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>

                <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
                  <SectionTitle title={primaryApproval ? "Pending approval" : "Test health"} helper={primaryApproval ? "Human gate for the next pending run" : "What the current test set can prove"} compact />
                  {primaryApproval ? (
                    <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">{primaryApproval.toolId}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{primaryApproval.requestedAt}</div>
                        </div>
                        <Badge tone={riskTone(primaryApproval.riskLevel)}>{primaryApproval.riskLevel}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{primaryApproval.reason}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => onDecision(primaryApproval, "approved")}>
                          <Check size={15} />
                          Approve
                        </Button>
                        <Button variant="danger" onClick={() => onDecision(primaryApproval, "rejected")}>
                          <X size={15} />
                          Reject
                        </Button>
                        <Button variant="secondary" onClick={() => openApprovalTrace()}>
                          <GitBranch size={15} />
                          Open trace
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {testHealth.map(([label, value]) => (
                        <MiniMetric key={label} label={label} value={value} />
                      ))}
                    </div>
                  )}
                  <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                      {hasFailures ? <X size={16} className="text-[var(--danger)]" /> : needsApproval ? <LockKeyhole size={16} className="text-[var(--warning)]" /> : <ShieldCheck size={16} className="text-[var(--success)]" />}
                      {hasFailures ? "Launch is blocked" : needsApproval ? "A human gate is waiting" : "Ready for more test evidence"}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {latestRun
                        ? `Latest: ${runSkillName(latestRun)} is ${statusLabels[latestRun.status] ?? latestRun.status} at ${latestRun.currentStage}.`
                        : "Run a Skill to create the first trace."}
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="mt-4 overflow-hidden" data-testid="openclaw-mission-control">
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <SectionTitle
                      title="Agent Runtime Mission Control"
                      helper="Live agent sessions, long-running work, waiting approvals, blocked source events, tools used, and proof IDs."
                      compact
                    />
                    <Badge tone="purple">{openClawIntegration.sessions.length} sessions</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                    {openClawIntegration.sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => session.status === "waiting" ? onOpenBroker() : setMode("runs")}
                        aria-label={`${session.status === "waiting" ? "Review waiting runtime session" : "Open Harness runs for runtime session"}: ${session.agent}`}
                        title={`${session.status === "waiting" ? "Review waiting session" : "Open run history"} for ${session.agent}`}
                        className={`group flex min-h-[188px] flex-col rounded-lg border p-4 text-left transition ${
                          session.status === "blocked"
                            ? "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] hover:border-[color-mix(in_srgb,var(--danger)_42%,var(--border))]"
                            : session.status === "waiting"
                              ? "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_42%,var(--border))]"
                              : "border-[var(--border)] bg-[var(--surface)]/76 hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-5 text-[var(--text)]">{session.agent}</span>
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">{session.channel}</span>
                          </span>
                          <Badge tone={openClawStatusTone(session.status)}>{session.status}</Badge>
                        </span>
                        <span className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[var(--text-muted)]">{session.objective}</span>
                        <span className="mt-3 flex flex-wrap gap-1.5">
                          {session.toolsUsed.slice(0, 3).map((tool) => (
                            <span key={tool} className="rounded-full bg-[var(--surface)]/70 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)]/70">
                              {tool}
                            </span>
                          ))}
                        </span>
                        <span className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)]/70 pt-3 text-xs">
                          <span className="font-semibold text-[var(--text-muted)]">{session.age}</span>
                          <span className="truncate font-semibold text-[var(--primary)]">{session.proofId}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
                  <SectionTitle title="Session controls" helper="Operational actions for long-running agent work." compact />
                  <div className="mt-4 space-y-2">
                    {[
                      ["Waiting approvals", `${openClawIntegration.sessions.filter((session) => session.status === "waiting").length} session paused`, onOpenBroker],
                      ["Blocked source events", `${openClawIntegration.sessions.filter((session) => session.status === "blocked").length} blocked`, () => setMode("runs")],
                      ["Update smoke tests", "Run before promoting beta channel", () => onRerun()],
                      ["Proof export", `${openClawIntegration.gateway.evidenceEvents.toLocaleString()} evidence events`, () => setMode("runs")],
                    ].map(([label, helper, action]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={action as () => void}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--text)]">{label as string}</span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{helper as string}</span>
                        </span>
                        <ChevronRight size={15} className="shrink-0 text-[var(--text-soft)]" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <details
              className="group mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
              data-testid="harness-run-ledger"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--text)]">Run ledger and approval queue</div>
                  <div className="mt-1 truncate text-sm text-[var(--text-muted)]">
                    {runs.length.toLocaleString()} run{runs.length === 1 ? "" : "s"} · {pendingApprovals.length} approval{pendingApprovals.length === 1 ? "" : "s"} waiting
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
              </summary>
              <div className="hidden gap-4 border-t border-[var(--border)] p-5 group-open:grid xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <SectionTitle title="Recent test results" helper="Open any run to inspect its full trace, approvals, output, and evidence." compact />
                    <Button variant="secondary" onClick={() => setMode("runs")}>All runs</Button>
                  </div>
                  <DataTable
                    caption="Recent Harness test runs"
                    columns={["Run", "Skill", "Result", "Risk", "Stage", "Started", "Cost"]}
                  rows={runs.slice(0, 6).map((run) => [
                    <button key="run" type="button" onClick={() => openRun(run)} className="font-semibold text-[var(--primary)] hover:underline">{run.id}</button>,
                    runSkillName(run),
                    <span key="status" className="inline-flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(run.status)}>{statusLabels[run.status] ?? run.status}</Badge>
                      <SimulationBadge mode={run.executionMode} reason={run.simulationReason} />
                    </span>,
                    <Badge key="risk" tone={riskTone(run.riskLevel)}>{run.riskLevel}</Badge>,
                    run.currentStage,
                    run.startedAt,
                      `$${run.costUsd.toFixed(4)}`,
                    ])}
                  />
                </div>

                <div className="min-w-0">
                  <SectionTitle title="Approval queue" helper="Tool actions waiting on a human decision" compact />
                  <div className="mt-4 space-y-3">
                    {pendingApprovals.length ? pendingApprovals.slice(0, 4).map((request) => (
                      <div key={request.id} className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--text)]">{request.toolId}</div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{request.requestedAt}</div>
                          </div>
                          <Badge tone={riskTone(request.riskLevel)}>{request.riskLevel}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]">{request.reason}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button onClick={() => onDecision(request, "approved")}>Approve</Button>
                          <Button variant="danger" onClick={() => onDecision(request, "rejected")}>Reject</Button>
                          <Button variant="secondary" onClick={() => openApprovalTrace(request)}>
                            <GitBranch size={15} />
                            Open trace
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
                        No approvals are pending. New requests appear here as soon as a Skill asks for a governed action.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>

            <details
              className="group mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
              data-testid="harness-advanced-controls"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--text)]">Advanced controls, security operations, and identity governance</div>
                  <div className="mt-1 truncate text-sm text-[var(--text-muted)]">Open for the full control plane, pipeline stages, agent assets, baselines, findings, and kill switches.</div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
              </summary>
              <div className="hidden space-y-4 border-t border-[var(--border)] p-5 group-open:block">
                <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <Panel className="bg-slate-950 p-5 text-white">
                    <Badge tone={agentControlPlane.posture === "ready" ? "green" : agentControlPlane.posture === "watch" ? "amber" : "red"}>
                      control plane {agentControlPlane.score}/100
                    </Badge>
                    <h3 className="mt-3 text-lg font-bold">Agent security operations</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                      Inventory, behavior baselines, prompt-injection detection, connector boundaries, kill switches, and audit handoff for every governed agent.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MiniMetric label="Agents" value={String(agentControlPlane.metrics.agents)} />
                      <MiniMetric label="Findings" value={String(agentControlPlane.metrics.openFindings)} />
                      <MiniMetric label="Baselines" value={String(agentControlPlane.metrics.stableBaselines)} />
                      <MiniMetric label="Injection signals" value={String(agentControlPlane.metrics.promptInjectionAttempts)} />
                    </div>
                  </Panel>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Panel className="p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        <Fingerprint size={17} className="text-[var(--primary)]" />
                        Agent assets
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{agentControlPlane.summary}</p>
                      <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                        {agentControlPlane.inventory.slice(0, 5).map((asset) => (
                          <div key={asset.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[var(--text)]">{asset.name}</div>
                                <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">{asset.subject}</div>
                              </div>
                              <Badge tone={agentAssetTone[asset.status]}>{asset.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel className="p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        <Radar size={17} className="text-[var(--primary)]" />
                        Behavior baselines
                      </div>
                      <div className="mt-4 space-y-2">
                        {agentControlPlane.baselines.slice(0, 5).map((baseline) => (
                          <div key={baseline.skillId} className="rounded-lg border border-[var(--border)] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 truncate text-sm font-semibold text-[var(--text)]">{baseline.skillName}</div>
                              <Badge tone={baseline.status === "stable" ? "green" : baseline.status === "drift-watch" ? "amber" : "blue"}>{baseline.status}</Badge>
                            </div>
                            <div className="mt-2 text-xs text-[var(--text-muted)]">
                              {baseline.sampleSize} runs · {(baseline.avgLatencyMs / 1000).toFixed(1)}s avg
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel className="p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        <AlertTriangle size={17} className="text-[var(--primary)]" />
                        Security findings
                      </div>
                      <div className="mt-4 space-y-2">
                        {agentControlPlane.nextActions.length ? agentControlPlane.nextActions.map((finding) => (
                          <div key={finding.id} className="rounded-lg border border-[var(--border)] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-semibold text-[var(--text)]">{finding.title}</div>
                              <Badge tone={findingTone[finding.severity]}>{finding.severity}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{finding.nextAction}</p>
                          </div>
                        )) : (
                          <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-3 text-sm leading-6 text-[var(--success)]">
                            No open high-priority security findings.
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>
                </div>

                <Panel className="overflow-hidden">
                  <div className="border-b border-[var(--border)] px-5 py-4">
                    <SectionTitle title="Harness pipeline" helper="Control chain around every model call and connector action. Stage timings are representative reference values; model routing reflects measured run latency." compact />
                  </div>
                  <div className="grid gap-px bg-[var(--surface-subtle)] md:grid-cols-2 xl:grid-cols-4">
                    {stageMetrics.map((stage, index) => (
                      <div key={stage.label} className="bg-[var(--surface)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)] tabular-nums">{index + 1}</span>
                          <Badge tone={stage.errors ? "red" : stage.count ? "green" : "slate"}>{stage.errors ? `${stage.errors} issue${stage.errors === 1 ? "" : "s"}` : stage.count ? "online" : "idle"}</Badge>
                        </div>
                        <div className="mt-4 text-sm font-semibold text-[var(--text)]">{stage.label}</div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
                          <div>
                            <div className="font-semibold text-[var(--text)] tabular-nums">{stage.count}</div>
                            <div>events</div>
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text)] tabular-nums">{stage.latency}</div>
                            <div>typical latency</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="overflow-hidden">
                  <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <SectionTitle title="Agent Ops Blueprint" helper="Runtime, guardrails, broker, telemetry, evals, and evidence" compact />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={agentOpsBlueprint.status === "ready" ? "green" : agentOpsBlueprint.status === "partial" ? "amber" : "red"}>
                        {agentOpsBlueprint.score}/100
                      </Badge>
                      <span className="text-sm text-[var(--text-muted)]">{agentOpsBlueprint.summary}</span>
                    </div>
                  </div>
                  <div className="grid gap-px bg-[var(--surface-subtle)] md:grid-cols-2 xl:grid-cols-3">
                    {agentOpsBlueprint.capabilities.map((capability) => {
                      const CapabilityIcon = blueprintIcon[capability.id];
                      return (
                        <div key={capability.id} className="bg-[var(--surface)] p-5">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                              <CapabilityIcon size={18} />
                            </span>
                            <Badge tone={capability.status === "ready" ? "green" : capability.status === "partial" ? "amber" : "red"}>
                              {capability.status}
                            </Badge>
                          </div>
                          <div className="mt-4 text-sm font-semibold text-[var(--text)]">{capability.name}</div>
                          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{capability.evidence}</p>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel className="overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <SectionTitle title="Agent identity governance" helper="Agent owners, scopes, approval history, and kill switches" compact />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={identityGovernance.score >= 80 ? "green" : identityGovernance.score >= 55 ? "amber" : "red"}>
                        {identityGovernance.score}/100
                      </Badge>
                      <span className="text-sm text-[var(--text-muted)]">{identityGovernance.summary}</span>
                    </div>
                  </div>
                  <DataTable
                    caption="Agent identity governance records"
                    columns={["Agent Identity", "Owner", "Status", "Scopes", "Policy Decisions", "Last Run", "Control"]}
                    rows={identityGovernance.records.map((record) => {
                      const skill = skills.find((item) => item.id === record.skillId);
                      return [
                        <div key={`${record.skillId}-identity`}>
                          <div className="font-semibold text-[var(--text)]">{record.name}</div>
                          <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">{record.subject}</div>
                        </div>,
                        record.owner,
                        <Badge key={`${record.skillId}-status`} tone={identityStatusTone[record.status]}>{record.status}</Badge>,
                        <div key={`${record.skillId}-scopes`} className="flex flex-wrap gap-1">
                          {record.scopes.slice(0, 3).map((scope) => (
                            <span key={scope} className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]">{scope}</span>
                          ))}
                          {record.scopes.length > 3 ? <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)]">+{record.scopes.length - 3}</span> : null}
                        </div>,
                        `${record.policyDecisions} decisions · ${record.approvalHistory} approvals`,
                        record.lastRun,
                        skill ? (
                          <Button
                            key={`${record.skillId}-kill-switch`}
                            variant={record.killSwitchEngaged ? "secondary" : "danger"}
                            onClick={() => onToggleSkillKillSwitch(skill)}
                          >
                            {record.killSwitchEngaged ? "Reactivate" : "Kill switch"}
                          </Button>
                        ) : (
                          "Unavailable"
                        ),
                      ];
                    })}
                  />
                </Panel>
              </div>
            </details>
          </>
        ) : (
          <>
            <Panel className="overflow-hidden">
              <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-5 sm:p-6">
                  <Badge tone="blue">start here</Badge>
                  <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">Run the first Skill test</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                    Click once to see exactly how a Skill behaves before anyone launches it. The test records who ran it, what knowledge it used, which tools it requested, what needed approval, and what evidence was saved.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={skills.length ? () => onRerun() : onOpenSkills}>
                      {skills.length ? <Play size={15} /> : <Library size={15} />}
                      {skills.length ? "Run first test" : "Open AI Skills"}
                    </Button>
                    <Button variant="secondary" onClick={onOpenSkills}>
                      <Library size={15} />
                      Review Skills
                    </Button>
                  </div>

                  <div className="mt-7 grid gap-3 md:grid-cols-4">
                    {firstTestProof.map((item, index) => {
                      const ProofIcon = item.icon;
                      return (
                        <div key={item.label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-4">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                              <ProofIcon size={16} />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-[var(--text)]">{index + 1}. {item.label}</div>
                            </div>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
                  <SectionTitle title="Recommended test" helper="Start with the first governed Skill in this workspace" compact />
                  {recommendedSkill ? (
                    <div className="mt-4 rounded-lg border border-[var(--primary)]/16 bg-[var(--surface)] p-4 shadow-[0_16px_42px_rgba(99,91,255,0.08)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text)]">{recommendedSkill.name}</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            {recommendedSkill.department} · {recommendedSkill.version}
                          </div>
                        </div>
                        <Badge tone={statusTone(recommendedSkill.status)}>{statusLabels[recommendedSkill.status]}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniMetric label="Eval" value={`${recommendedSkill.evalPassRate}%`} />
                        <MiniMetric label="Risk" value={recommendedSkill.riskLevel} />
                      </div>
                      <div className="mt-4 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                        Autonomy: {autonomyLabels[recommendedSkill.autonomyTier]}
                      </div>
                      <Button className="mt-4 w-full" onClick={() => onRerun(recommendedSkill)}>
                        <Play size={15} />
                        Test this Skill
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/70 p-4">
                      <div className="text-sm font-semibold text-[var(--text)]">No Skill is ready to test</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                        Create or review the first AI Skill, then return here to run the first governed test.
                      </p>
                      <Button className="mt-4 w-full" onClick={onOpenSkills}>
                        <Library size={15} />
                        Open AI Skills
                      </Button>
                    </div>
                  )}
                  <div className="mt-4 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                      <ShieldCheck size={16} className="text-[var(--primary)]" />
                      Where the proof goes
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      The first test feeds run history, approvals, risk review, proof ledger, launch plan, and executive reports.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
            <Panel className="mt-4 overflow-hidden" data-testid="openclaw-mission-control">
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <SectionTitle
                      title="Agent Runtime Mission Control"
                      helper="Live agent sessions, waiting approvals, blocked source events, tools used, and proof IDs are visible even before local Harness runs exist."
                      compact
                    />
                    <Badge tone="purple">{openClawIntegration.sessions.length} sessions</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                    {openClawIntegration.sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => session.status === "waiting" ? onOpenBroker() : setMode("runs")}
                        aria-label={`${session.status === "waiting" ? "Review waiting runtime session" : "Open Harness runs for runtime session"}: ${session.agent}`}
                        title={`${session.status === "waiting" ? "Review waiting session" : "Open run history"} for ${session.agent}`}
                        className="group flex min-h-[164px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-5 text-[var(--text)]">{session.agent}</span>
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">{session.channel}</span>
                          </span>
                          <Badge tone={openClawStatusTone(session.status)}>{session.status}</Badge>
                        </span>
                        <span className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[var(--text-muted)]">{session.objective}</span>
                        <span className="mt-3 truncate text-xs font-semibold text-[var(--primary)]">{session.proofId}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
                  <SectionTitle title="Import health" helper="Operational controls inherited from the connected runtime." compact />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MiniMetric label="Waiting" value={String(openClawIntegration.sessions.filter((session) => session.status === "waiting").length)} />
                    <MiniMetric label="Blocked" value={String(openClawIntegration.sessions.filter((session) => session.status === "blocked").length)} />
                    <MiniMetric label="Agents" value={String(openClawIntegration.agents.length)} />
                    <MiniMetric label="Events" value={openClawIntegration.gateway.evidenceEvents.toLocaleString()} />
                  </div>
                  <Button className="mt-4 w-full" onClick={onOpenBroker}>
                    <LockKeyhole size={15} />
                    Review approvals
                  </Button>
                </div>
              </div>
            </Panel>
            <details className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="font-semibold text-[var(--text)]">Advanced controls before the first test</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">Open for the Harness pipeline and security operations that activate once a Skill runs.</div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)]" />
              </summary>
              <div className="grid gap-4 border-t border-[var(--border)] p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Panel className="bg-slate-950 p-5 text-white">
                  <Badge tone={agentControlPlane.posture === "ready" ? "green" : agentControlPlane.posture === "watch" ? "amber" : "red"}>
                    control plane {agentControlPlane.score}/100
                  </Badge>
                  <h3 className="mt-3 text-lg font-bold">Agent security operations</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                    The first run will register behavior evidence for agent identity, scopes, prompts, context, tools, approvals, cost, latency, and audit handoff.
                  </p>
                </Panel>
                <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] md:grid-cols-2 xl:grid-cols-4">
                  {stageMetrics.slice(0, 8).map((stage, index) => (
                    <div key={stage.label} className="bg-[var(--surface)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)] tabular-nums">{index + 1}</span>
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--text-soft)]" />
                      </div>
                      <div className="mt-4 text-sm font-semibold text-[var(--text)]">{stage.label}</div>
                      <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Captured when a Skill test runs.</div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    );
  }

  if (mode === "runs") {
    return (
      <div>
        <div className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <button
            type="button"
            data-testid="harness-overview-breadcrumb"
            title="Back to AI Harness overview"
            onClick={() => setMode("overview")}
            className="-mx-2 flex min-h-8 items-center rounded-md px-2 font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
          >
            AI Harness
          </button>
          <ChevronRight size={14} />
          <span className="font-medium text-[var(--text)]">Runs</span>
        </div>
        <PageHeader
          title="Harness Runs"
          subtitle="Searchable execution history across Skill tests, production workflows, approvals, broker calls, and policy decisions"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setMode("overview")}>Back to Harness</Button>
              <Button onClick={skills.length ? () => onRerun() : onOpenSkills}>
                {skills.length ? <Play size={15} /> : <Library size={15} />}
                {skills.length ? "Run Selected Skill" : "Open AI Skills"}
              </Button>
            </div>
          }
        />

        {runs.length ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Panel className="overflow-hidden">
              <DataTable
                caption="Harness runs ledger"
                columns={["Run", "Skill", "User", "Status", "Risk", "Current Stage", "Trace Steps", "Started", "Cost", "Latency"]}
                rows={runs.map((run) => [
                  <button
                    key="run"
                    type="button"
                    onClick={() => openRun(run)}
                    className="-my-1 inline-flex min-h-8 items-center rounded-md pr-2 font-semibold text-[var(--primary)] hover:underline focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  >
                    {run.id}
                  </button>,
                  runSkillName(run),
                  runTriggerName(run),
                  <span key="status" className="inline-flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(run.status)}>{statusLabels[run.status] ?? run.status}</Badge>
                    <SimulationBadge mode={run.executionMode} reason={run.simulationReason} />
                  </span>,
                  <Badge key="risk" tone={riskTone(run.riskLevel)}>{run.riskLevel}</Badge>,
                  run.currentStage,
                  run.trace.length.toLocaleString(),
                  run.startedAt,
                  `$${run.costUsd.toFixed(4)}`,
                  `${(run.latencyMs / 1000).toFixed(1)}s`,
                ])}
              />
            </Panel>

            <div className="space-y-4">
              <Panel className="p-5">
                <SectionTitle title="Run Health" compact />
                <div className="mt-4 space-y-3">
                  <MiniMetric label="Completed" value={completedRuns.length.toLocaleString()} />
                  <MiniMetric label="Active / Waiting" value={activeRuns.length.toLocaleString()} />
                  <MiniMetric label="Blocked / Failed" value={blockedRuns.length.toLocaleString()} />
                </div>
              </Panel>
              <Panel className="p-5">
                <SectionTitle title="Failure Analysis" helper="Failures should be policy-visible, explainable, and recoverable" />
                <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
                  {blockedRuns.length ? blockedRuns.map((run) => (
                    <button key={run.id} type="button" onClick={() => openRun(run)} className="block w-full rounded-lg border border-[color-mix(in_srgb,var(--danger)_26%,var(--border))] bg-[var(--danger-soft)] p-3 text-left">
                      <div className="font-semibold text-[var(--danger)]">{run.id}</div>
                      <div className="mt-1 text-[var(--danger)]">{run.currentStage}</div>
                    </button>
                  )) : (
                    <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-3 text-[var(--success)]">
                      No blocked or failed runs in the current workspace.
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No run history yet"
            body="The run ledger starts when a Skill or Workflow is executed through the Harness. Each entry stores trace steps, policy decisions, tool requests, cost, latency, and output state."
            action={skills.length ? "Run selected Skill" : "Open AI Skills"}
            onAction={skills.length ? () => onRerun() : onOpenSkills}
          />
        )}
      </div>
    );
  }

  if (!selectedRun) {
    return (
      <div>
        <PageHeader
          title="AI Harness"
          subtitle="Runtime control plane for governed Skill execution, approvals, traces, and audit evidence"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setMode("runs")}>
                <Activity size={15} />
                Run history
              </Button>
              <Button onClick={skills.length ? () => onRerun() : onOpenSkills}>
                {skills.length ? <Play size={15} /> : <Library size={15} />}
                {skills.length ? "Run test" : "Open AI Skills"}
              </Button>
            </div>
          }
        />
        <Panel className="overflow-hidden" data-testid="harness-empty-detail">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">No run selected</Badge>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Detail links need a trace record
                </span>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                Select or create a trace before inspecting runtime details
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                A Harness detail page is only trustworthy when it is attached to a concrete run. Choose an existing run, or execute a Skill test so identity, prompt, context, tool policy, approvals, output, cost, latency, and audit evidence can be inspected together.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => setMode("runs")}>
                  <Activity size={15} />
                  Open run history
                </Button>
                <Button variant="secondary" onClick={skills.length ? () => onRerun() : onOpenSkills}>
                  {skills.length ? <Play size={15} /> : <Library size={15} />}
                  {skills.length ? "Run selected Skill" : "Open AI Skills"}
                </Button>
              </div>

              <div className="mt-7 grid gap-3 md:grid-cols-4">
                {[
                  { label: "Identity", body: "Who requested the run and which Skill identity acted.", icon: Fingerprint },
                  { label: "Prompt", body: "The assembled Skill contract, policy boundary, and model input.", icon: BrainCircuit },
                  { label: "Tools", body: "Connector requests, approval gates, and broker decisions.", icon: LockKeyhole },
                  { label: "Evidence", body: "Trace, output, cost, latency, eval, and audit handoff.", icon: FileText },
                ].map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                          <ItemIcon size={16} />
                        </span>
                        <div className="text-sm font-semibold text-[var(--text)]">{index + 1}. {item.label}</div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{item.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
              <SectionTitle title="Trace availability" helper="What the workspace can inspect right now" compact />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="Runs" value={runs.length.toLocaleString()} />
                <MiniMetric label="Skills" value={String(skills.length)} />
                <MiniMetric label="Approvals" value={String(pendingApprovals.length)} />
                <MiniMetric label="Audit logs" value={auditLogs.length.toLocaleString()} />
              </div>
              <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <GitBranch size={16} className="text-[var(--primary)]" />
                  Safe deep-link behavior
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  If a saved link points to a deleted or unavailable run, the Harness now makes the missing dependency explicit and sends the user to the next best operational action.
                </p>
              </div>
              <Button className="mt-4 w-full justify-center" onClick={() => setMode("runs")}>
                <ChevronRight size={15} />
                Open run history
              </Button>
            </aside>
          </div>
        </Panel>
      </div>
    );
  }
  const activeRun = selectedRun;
  const selectedSkill = skills.find((skill) => skill.id === activeRun.skillId) ?? skills[0];
  const operatorProfile = userProfile(activeRun.triggeredBy);
  const skillOwnerProfile = userProfile(selectedSkill?.ownerId);
  const runRequests = toolRequests.filter((request) => request.runId === activeRun.id);
  const selectedBaseline = agentControlPlane.baselines.find((baseline) => baseline.skillId === activeRun.skillId);
  const selectedSecurityFindings = agentControlPlane.findings.filter(
    (finding) => finding.runId === activeRun.id || finding.agentId === activeRun.skillId,
  );
  const approvalRequest =
    runRequests.find((request) => request.status === "pending") ??
    runRequests[0];
  const missingApprovalRequest = activeRun.status === "waiting_for_approval" && !approvalRequest;
  const approvalEvidenceLabel = missingApprovalRequest ? "Missing" : approvalRequest ? "1" : "0";
  const approvalProfile = userProfile(approvalRequest?.user);
  const accountabilityProfiles = [
    { label: "Operator", profile: operatorProfile },
    { label: "Skill Owner", profile: skillOwnerProfile },
    { label: "Approval Contact", profile: approvalProfile },
  ];
  const totalSeconds = activeRun.latencyMs / 1000;
  const isSimulatedRun = activeRun.executionMode === "simulated";
  // Token counts are not persisted on Run records yet. Show "Not recorded"
  // rather than inventing numbers from cost.
  const tokensLabel = "Not recorded";
  const evalScore = selectedSkill?.evalPassRate;
  const promptTrace = activeRun.trace.find((step) => step.label.toLowerCase().includes("prompt"));
  const tabs: [string, string][] = [
    ["trace", "Trace"],
    ["prompt", "Prompt"],
    ["context", "Context"],
    ["tools", `Tool Calls (${runRequests.length})`],
    ["security", `Security (${selectedSecurityFindings.length})`],
    ["approvals", `Approvals (${approvalEvidenceLabel})`],
    ["output", "Output"],
    ["evaluations", "Evaluations"],
    ["logs", "Logs"],
  ];
  const runOutcome =
    activeRun.status === "waiting_for_approval"
      ? {
          badge: "approval needed",
          tone: "amber" as const,
          title: "This run is safely paused for a human decision",
          body: approvalRequest
            ? `${selectedSkill?.name ?? "This Skill"} requested ${approvalRequest.toolId}. Review the reason, then approve or reject before the run continues.`
            : "The run is marked waiting for approval, but no approval request is attached to this trace. Inspect the evidence before deciding.",
          actionLabel: approvalRequest ? "Review approval" : "Inspect approval evidence",
          action: () => setTab("approvals"),
          icon: LockKeyhole,
        }
      : activeRun.status === "blocked" || activeRun.status === "failed"
        ? {
            badge: "blocked safely",
            tone: "red" as const,
            title: "The Harness stopped this run before launch risk escaped",
            body: "Inspect the blocked trace step, fix the Skill prompt, tool policy, context, or approval path, then rerun the test.",
            actionLabel: "Inspect blocked step",
            action: () => setTab("trace"),
            icon: AlertTriangle,
          }
        : {
            badge: "test passed",
            tone: "green" as const,
            title: "This run created launch-ready evidence",
            body: "The trace, policy checks, output, and audit events can now support risk review, proof ledger, launch planning, and executive reporting.",
            actionLabel: "View output",
            action: () => setTab("output"),
            icon: Check,
          };
  const RunOutcomeIcon = runOutcome.icon;
  const proofSummary = [
    {
      label: "Trace",
      value: `${activeRun.trace.length} steps`,
      helper: activeRun.currentStage,
      action: () => setTab("trace"),
    },
    {
      label: "Approvals",
      value: missingApprovalRequest ? "Missing" : approvalRequest ? statusLabels[approvalRequest.status] ?? approvalRequest.status : "None",
      helper: missingApprovalRequest ? "Trace says waiting" : approvalRequest?.toolId ?? "No human gate",
      action: () => setTab("approvals"),
    },
    {
      label: "Safety",
      value: selectedSecurityFindings.length ? `${selectedSecurityFindings.length} finding${selectedSecurityFindings.length === 1 ? "" : "s"}` : "Clear",
      helper: selectedSecurityFindings[0]?.title ?? "No high-priority signal",
      action: () => setTab("security"),
    },
    {
      label: "Evidence",
      value: `${auditLogs.length} logs`,
      helper: "Reusable proof chain",
      action: () => setTab("logs"),
    },
  ];

  // Render the run's REAL persisted trace — never a fabricated walkthrough.
  // Icons are inferred from the step label; latency comes from the record.
  const traceIconFor = (label: string): React.ComponentType<{ size?: number; className?: string }> => {
    const normalized = label.toLowerCase();
    if (normalized.includes("request received")) return Play;
    if (normalized.includes("identity")) return UserRound;
    if (normalized.includes("context")) return Database;
    if (normalized.includes("prompt")) return FileText;
    if (normalized.includes("model")) return Sparkles;
    if (normalized.includes("budget")) return Activity;
    if (normalized.includes("approval")) return LockKeyhole;
    if (normalized.includes("tool")) return Network;
    if (normalized.includes("policy") || normalized.includes("output")) return ShieldCheck;
    return Check;
  };
  const formatTraceLatency = (ms: number) =>
    ms > 0 ? (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`) : "—";
  const maxTraceLatency = Math.max(1, ...activeRun.trace.map((step) => step.latencyMs));
  const traceSteps = activeRun.trace.map((step, index) => {
    const cumulativeMs = activeRun.trace
      .slice(0, index + 1)
      .reduce((sum, item) => sum + Math.max(0, item.latencyMs || 0), 0);
    return {
      label: step.label,
      detail: step.detail,
      latency: formatTraceLatency(step.latencyMs),
      cumulativeLatency: formatTraceLatency(cumulativeMs),
      latencyShare: step.latencyMs > 0 ? Math.max(0.04, step.latencyMs / maxTraceLatency) : 0,
      status: step.status,
      icon: traceIconFor(step.label),
      approval: /approval/i.test(step.label) || (/tool request/i.test(step.label) && step.status === "waiting"),
    };
  });

  function renderStatusIcon(status: string, index: number, Icon: React.ComponentType<{ size?: number; className?: string }>) {
    const className =
      status === "completed"
        ? "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]"
        : status === "running"
          ? "border-[color-mix(in_srgb,var(--primary)_30%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)] motion-safe:animate-pulse"
          : status === "waiting"
            ? "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]"
            : status === "blocked"
              ? "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]";

    return (
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${className}`}>
        {status === "completed" ? <Check size={15} /> : status === "blocked" ? <X size={15} /> : <Icon size={15} />}
        <span className="sr-only">Step {index + 1}</span>
      </span>
    );
  }

  function renderEvidencePanel() {
    if (tab === "prompt") {
      return (
        <Panel className="p-5">
          <SectionTitle title="Prompt Assembly" helper="What the model receives after policy and context controls" />
          <pre className="mt-4 max-h-[560px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
{`SYSTEM
${selectedSkill?.systemPrompt ?? "No system prompt configured."}

HARNESS CONTRACT
- User: ${runTriggerName(activeRun)}
- Skill: ${selectedSkill?.name ?? "Unknown"} v${selectedSkill?.version ?? "1.0"}
- Autonomy: ${selectedSkill ? autonomyLabels[selectedSkill.autonomyTier] : "Unknown"}
- Risk: ${activeRun.riskLevel}
- Allowed tools: ${(selectedSkill?.allowedTools ?? []).join(", ") || "None"}
- Blocked tools: ${(selectedSkill?.blockedTools ?? []).join(", ") || "None"}
- Prompt contract: ${promptTrace?.detail ?? "Assembled by the Harness before model routing."}

USER INPUT
${activeRun.trace[0]?.detail ?? "Not recorded."}`}
          </pre>
        </Panel>
      );
    }

    if (tab === "context") {
      const contextTraceStep = activeRun.trace.find((step) => step.label.toLowerCase().includes("context"));
      return (
        <Panel className="p-5">
          <SectionTitle title="Context Packet" helper="Approved sources this Skill is allowed to read" />
          {contextTraceStep ? (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)]">
              {contextTraceStep.detail}
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {(selectedSkill?.contextSources ?? []).length ? (
              (selectedSkill?.contextSources ?? []).map((source) => (
                <div key={source} className="flex items-start justify-between rounded-lg border border-[var(--border)] p-4">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{source}</div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">Approved source · policy-gated access</div>
                  </div>
                  <Badge tone="blue">approved</Badge>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                No context sources are configured for this Skill. Retrieval relevance scores appear here once sources are connected and a live retrieval runs.
              </div>
            )}
          </div>
        </Panel>
      );
    }

    if (tab === "tools") {
      return (
        <Panel className="p-5">
          <SectionTitle title="Tool Calls" helper="Every connector action is mediated by the MCP Broker" />
          <div className="mt-4 space-y-3">
            {runRequests.length ? runRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{request.toolId}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{request.reason}</div>
                  </div>
                  <Badge tone={statusTone(request.status)}>{request.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <MiniMetric label="Risk" value={request.riskLevel} />
                  <MiniMetric label="Policy" value="Allowed" />
                  <MiniMetric label="Approval" value={request.status === "pending" ? "Required" : request.status} />
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                No tool calls were requested during this run. Add approved connector tools to the Skill policy to exercise broker-mediated actions.
              </div>
            )}
          </div>
        </Panel>
      );
    }

    if (tab === "approvals") {
      return (
        <Panel className="p-5">
          <SectionTitle title="Approval Queue" helper="Approvers act on the raw tool action, reason, and policy outcome" />
          {approvalRequest ? (
            <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">{approvalRequest.toolId}</div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{approvalRequest.reason}</p>
                </div>
                <Badge tone={statusTone(approvalRequest.status)}>{approvalRequest.status}</Badge>
              </div>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                <MiniMetric label="Requested by" value={selectedSkill?.name ?? "Skill"} />
                <MiniMetric label="Approver" value="Assigned approver" />
                <MiniMetric label="Requested" value={approvalRequest.requestedAt} />
              </div>
              {approvalRequest.status === "pending" ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => onDecision(approvalRequest, "approved")}>Approve</Button>
                  <Button variant="danger" onClick={() => onDecision(approvalRequest, "rejected")}>Reject</Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--text-muted)]">
              {missingApprovalRequest
                ? "This run is marked waiting for approval, but no approval request is attached to the selected trace."
                : "No approval is required for this run."}
            </div>
          )}
        </Panel>
      );
    }

    if (tab === "security") {
      return (
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <SectionTitle
                title="Agent Security Operations"
                helper="Runtime anomaly checks, behavior baseline, prompt-injection signals, and forensic controls for this run"
              />
              <Badge tone={selectedSecurityFindings.some((finding) => ["critical", "high"].includes(finding.severity)) ? "red" : selectedSecurityFindings.length ? "amber" : "green"}>
                {selectedSecurityFindings.length ? `${selectedSecurityFindings.length} finding${selectedSecurityFindings.length === 1 ? "" : "s"}` : "clear"}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MiniMetric label="Baseline" value={selectedBaseline?.status ?? "none"} />
              <MiniMetric label="Sample Size" value={String(selectedBaseline?.sampleSize ?? 0)} />
              <MiniMetric label="Avg Latency" value={selectedBaseline ? `${(selectedBaseline.avgLatencyMs / 1000).toFixed(1)}s` : "0s"} />
              <MiniMetric label="Approval Rate" value={`${selectedBaseline?.approvalRate ?? 0}%`} />
            </div>
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Baseline contract</div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <div className="font-semibold text-[var(--text)]">Normal tools</div>
                  <div className="mt-2 text-[var(--text-muted)]">{selectedBaseline?.normalTools.join(", ") || "No tool calls observed yet"}</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text)]">Normal context</div>
                  <div className="mt-2 text-[var(--text-muted)]">{selectedBaseline?.normalContextSources.join(", ") || "No context baseline yet"}</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text)]">Normal stages</div>
                  <div className="mt-2 text-[var(--text-muted)]">{selectedBaseline?.normalStages.slice(0, 4).join(" → ") || "No stage baseline yet"}</div>
                </div>
              </div>
              {selectedBaseline?.deviationSignals.length ? (
                <div className="mt-4 space-y-2">
                  {selectedBaseline.deviationSignals.map((signal) => (
                    <div key={signal} className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm leading-5 text-[var(--warning)]">
                      {signal}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <SectionTitle title="Forensic Findings" helper="Evidence generated from trace, tool, prompt, and audit behavior" compact />
            </div>
            {selectedSecurityFindings.length ? (
              <div className="divide-y divide-[var(--border)]">
                {selectedSecurityFindings.map((finding) => (
                  <div key={finding.id} className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={findingTone[finding.severity]}>{finding.severity}</Badge>
                          <Badge tone={finding.status === "contained" ? "green" : finding.status === "monitoring" ? "amber" : "red"}>
                            {finding.status}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-[var(--text)]">{finding.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{finding.evidence}</p>
                      </div>
                      <code className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">{finding.control}</code>
                    </div>
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text)]">Next action:</span> {finding.nextAction}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-xl border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-4 text-sm leading-6 text-[var(--success)]">
                  No prompt-injection, tool-boundary, external-egress, privilege-escalation, or baseline-drift findings are attached to this run.
                </div>
              </div>
            )}
          </Panel>
        </div>
      );
    }

    if (tab === "output") {
      return (
        <Panel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Run Output" helper={isSimulatedRun ? "Simulated placeholder — no model produced this text" : "Validated response returned to the user"} />
            <SimulationBadge mode={activeRun.executionMode} reason={activeRun.simulationReason} showLive />
          </div>
          <div className={`mt-4 rounded-xl border p-5 text-sm leading-6 ${isSimulatedRun ? "border-dashed border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--text-muted)]" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
            {activeRun.output}
          </div>
        </Panel>
      );
    }

    if (tab === "evaluations") {
      return (
        <Panel className="p-5">
          <SectionTitle title="Evaluation Snapshot" helper="Launch checks applied to this Skill family" />
          {typeof evalScore === "number" ? (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <MiniMetric label="Eval Pass Rate" value={`${evalScore}/100`} />
                <MiniMetric label="Source" value="Skill eval history" />
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                This score reflects the Skill&apos;s recorded eval pass rate. Per-dimension scores (grounding, permissions, tool safety)
                appear here once eval suites with those dimensions have been run against this Skill.
              </p>
            </>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--border-strong)]/72 bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)]">
              No evals have been recorded for this Skill yet. Run a quality eval suite to attach evaluation evidence to this run family.
            </div>
          )}
        </Panel>
      );
    }

    if (tab === "logs") {
      return (
        <Panel className="p-5">
          <SectionTitle title="Runtime Logs" />
          <div className="mt-4 space-y-3">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="border-b border-[var(--border)] pb-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">{log.eventType}</div>
                  <Badge tone={riskTone(log.riskLevel)}>{log.riskLevel}</Badge>
                </div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">{log.message}</div>
                <div className="mt-1 text-xs text-[var(--text-soft)]">{log.createdAt}</div>
              </div>
            ))}
          </div>
        </Panel>
      );
    }

    return (
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <SectionTitle title="Execution Trace" helper="Recorded chain of custody from request to response — every row below comes from the persisted run record" compact />
          <SimulationBadge mode={activeRun.executionMode} reason={activeRun.simulationReason} showLive />
        </div>
        {isSimulatedRun ? (
          <div className="border-b border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] bg-[var(--warning-soft)] px-5 py-3 text-sm leading-6 text-[var(--warning)]">
            This trace was produced by the deterministic local runtime. No model was called and no external action was executed.
            {activeRun.simulationReason ? ` ${activeRun.simulationReason}` : ""}
          </div>
        ) : null}
        <div>
          {traceSteps.map((step, index) => (
            <div key={`${step.label}-${index}`} className={`relative flex gap-4 border-b border-[var(--border)] px-5 py-4 last:border-b-0 ${step.approval && approvalRequest?.status === "pending" ? "bg-[var(--warning-soft)]" : "bg-[var(--surface)]"}`}>
              <div className="flex flex-col items-center">
                {renderStatusIcon(step.status, index, step.icon)}
                {index < traceSteps.length - 1 ? (
                  <span
                    className={`mt-2 h-full min-h-8 w-px ${
                      step.status === "completed"
                        ? "bg-[color-mix(in_srgb,var(--success)_45%,var(--border))]"
                        : "bg-[var(--border)]"
                    }`}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--text)]">
                      <span className="mr-3 text-xs font-bold text-[var(--text-soft)] tabular-nums">{index + 1}</span>
                      {step.label}
                    </div>
                    <div className="mt-1 text-sm leading-5 text-[var(--text-muted)]">{step.detail}</div>
                    {step.latencyShare > 0 ? (
                      <div className="mt-2 h-1 w-full max-w-[240px] overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                        <div
                          className={`h-full rounded-full ${step.status === "blocked" ? "bg-[var(--danger)]" : step.status === "waiting" ? "bg-[var(--warning)]" : "bg-[var(--primary)]/45"}`}
                          style={{ width: `${Math.round(step.latencyShare * 100)}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-xs text-[var(--text-muted)]">
                    <div className="tabular-nums">{step.latency}</div>
                    {step.cumulativeLatency !== "—" ? (
                      <div className="mt-0.5 text-[11px] tabular-nums text-[var(--text-soft)]" title="Elapsed at this step">
                        Σ {step.cumulativeLatency}
                      </div>
                    ) : null}
                  </div>
                </div>

                {step.approval && approvalRequest ? (
                  <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--surface)] p-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-muted)]">Approval Request</div>
                        <div className="mt-2 text-sm text-[var(--text-muted)]">Tool: {approvalRequest.toolId}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">Risk: {approvalRequest.riskLevel}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-muted)]">Reason</div>
                        <p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">{approvalRequest.reason}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-muted)]">Approver</div>
                        <div className="mt-2 text-sm font-medium text-[var(--text)]">Assigned approver</div>
                        <div className="text-xs text-[var(--text-muted)]">Configured approval role</div>
                      </div>
                    </div>
                    {approvalRequest.status === "pending" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => onDecision(approvalRequest, "approved")}>Approve</Button>
                        <Button variant="danger" onClick={() => onDecision(approvalRequest, "rejected")}>Reject</Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <button
          type="button"
          data-testid="harness-overview-breadcrumb"
          title="Back to AI Harness overview"
          onClick={() => setMode("overview")}
          className="-mx-2 flex min-h-8 items-center rounded-md px-2 font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
        >
          AI Harness
        </button>
        <ChevronRight size={14} />
        <button
          type="button"
          title="Back to Harness runs"
          onClick={() => setMode("runs")}
          className="-mx-2 flex min-h-8 items-center rounded-md px-2 font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
        >
          Runs
        </button>
        <ChevronRight size={14} />
        <span className="font-medium text-[var(--text)]">{activeRun.id}</span>
      </div>

      <PageHeader
        title="AI Harness"
        subtitle={`Harness run ${activeRun.id.replace("run-", "")} · ${selectedSkill?.name ?? "Unknown Skill"} v${selectedSkill?.version ?? "1.0"} · Triggered by ${runTriggerName(activeRun)} · ${activeRun.startedAt}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onRerun(selectedSkill)}>
              <Play size={15} />
              Rerun
            </Button>
          </div>
        }
      />

      <Panel className="mb-4 overflow-hidden border-[var(--primary)]/18 bg-[var(--surface)]/94">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={runOutcome.tone}>{runOutcome.badge}</Badge>
              <Badge tone={riskTone(activeRun.riskLevel)}>{activeRun.riskLevel} risk</Badge>
              <SimulationBadge mode={activeRun.executionMode} reason={activeRun.simulationReason} showLive />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                {activeRun.currentStage}
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-[-0.01em] text-[var(--text)]">
              {runOutcome.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{runOutcome.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={runOutcome.action}>
                <RunOutcomeIcon size={15} />
                {runOutcome.actionLabel}
              </Button>
              {approvalRequest?.status === "pending" ? (
                <>
                  <Button variant="secondary" onClick={() => onDecision(approvalRequest, "approved")}>
                    <Check size={15} />
                    Approve
                  </Button>
                  <Button variant="danger" onClick={() => onDecision(approvalRequest, "rejected")}>
                    <X size={15} />
                    Reject
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" onClick={() => onRerun(selectedSkill)}>
                <Play size={15} />
                Rerun
              </Button>
            </div>
          </section>
          <aside className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="What this run proves" helper="Open any proof area for the underlying evidence" compact />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {proofSummary.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 px-3 py-2.5 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{item.value}</div>
                    </div>
                    <ChevronRight size={15} className="mt-1 shrink-0 text-[var(--text-soft)]" />
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">{item.helper}</p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </Panel>

      <div className="mb-4" data-testid="harness-run-tabs">
        <Tabs
          tabs={tabs}
          active={tab}
          onChange={setTab}
          ariaLabel="Harness run evidence sections"
          idBase="harness-run"
          panelId={(id) => `harness-run-panel-${id}`}
        />
      </div>

      <div className="grid gap-4 min-[980px]:grid-cols-[240px_minmax(0,1fr)] min-[1500px]:grid-cols-[240px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Panel className="p-4">
            <SectionTitle title="Run Overview" compact />
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Status", statusLabels[activeRun.status]],
                ["Operator", operatorProfile.name],
                ["Skill Owner", skillOwnerProfile.name],
                ["Total Time", totalSeconds > 0 ? `${totalSeconds.toFixed(1)} seconds` : "Not recorded"],
                ["Total Cost", `$${activeRun.costUsd.toFixed(4)}`],
                ["Tokens", tokensLabel],
                ["Mode", isSimulatedRun ? "Simulated" : activeRun.executionMode === "live" ? "Live" : "Unknown"],
                ["Risk Level", activeRun.riskLevel],
                ["Autonomy Tier", selectedSkill ? autonomyLabels[selectedSkill.autonomyTier] : "Unknown"],
                ["Model", selectedSkill?.model ?? "Configured"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="max-w-[130px] truncate text-right font-semibold text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-[var(--border)] pt-4">
              <div className="flex size-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                {operatorProfile.initials}
              </div>
              <div>
                <div className="text-sm font-semibold">{operatorProfile.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{operatorProfile.detail}</div>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Accountability" helper="Who owns this evidence trail" compact />
            <div className="mt-4 space-y-3">
              {accountabilityProfiles.map(({ label, profile }) => {
                return (
                  <div key={label} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--text-muted)]">
                      {profile.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                      <div className="truncate text-sm font-semibold text-[var(--text)]">{profile.name}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">{profile.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Tags" compact />
            <div className="mt-4 flex flex-wrap gap-2">
              {[selectedSkill?.department ?? "AI", selectedSkill?.name.split(" ")[0] ?? "Skill", activeRun.currentStage, activeRun.riskLevel].map((tag, index) => (
                <span key={`${tag}-${index}`} className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">{tag}</span>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Feedback" compact />
            <div className="mt-4 text-sm">
              <div className="font-semibold text-[var(--success)]">Helpful</div>
              <p className="mt-2 leading-5 text-[var(--text-muted)]">Accurate, source-backed, and saved manual review time.</p>
              <div className="mt-3 text-xs text-[var(--text-soft)]">Submitted May 28, 2026</div>
            </div>
          </Panel>
        </div>

        <div
          id={`harness-run-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`harness-run-${tab}-tab`}
          data-testid={`harness-run-panel-${tab}`}
        >
          {renderEvidencePanel()}
        </div>

        <div className="space-y-4 min-[980px]:col-span-2 min-[1500px]:col-span-1">
          <Panel className="p-4">
            <SectionTitle title="Run Result" compact />
            <div className={`mt-4 flex gap-3 rounded-lg p-3 ${
              activeRun.status === "blocked"
                ? "bg-[var(--danger-soft)]"
                : activeRun.status === "waiting_for_approval"
                  ? "bg-[var(--warning-soft)]"
                  : "bg-[var(--success-soft)]"
            }`}>
              <span className={`flex size-8 items-center justify-center rounded-full text-white ${
                activeRun.status === "blocked"
                  ? "bg-[var(--danger)]"
                  : activeRun.status === "waiting_for_approval"
                    ? "bg-[var(--warning)]"
                    : "bg-[var(--success)]"
              }`}>
                {activeRun.status === "blocked" ? <X size={16} /> : activeRun.status === "waiting_for_approval" ? <LockKeyhole size={16} /> : <Check size={16} />}
              </span>
              <div>
                <div className={`text-sm font-semibold ${
                  activeRun.status === "blocked"
                    ? "text-[var(--danger)]"
                    : activeRun.status === "waiting_for_approval"
                      ? "text-[var(--warning)]"
                      : "text-[var(--success)]"
                }`}>
                  {activeRun.status === "blocked" ? "Blocked Safely" : activeRun.status === "waiting_for_approval" ? "Waiting for Approval" : "Completed Successfully"}
                </div>
                <div className={`mt-1 text-xs ${
                  activeRun.status === "blocked"
                    ? "text-[var(--danger)]"
                    : activeRun.status === "waiting_for_approval"
                      ? "text-[var(--warning)]"
                      : "text-[var(--success)]"
                }`}>
                  {activeRun.status === "blocked" ? "No unsafe action was executed." : activeRun.status === "waiting_for_approval" ? "The run is paused at the approval gate." : "The run completed without issues."}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Total Time", totalSeconds > 0 ? `${totalSeconds.toFixed(1)} seconds` : "Not recorded"],
                ["Total Cost", `$${activeRun.costUsd.toFixed(4)}`],
                ["Tokens", tokensLabel],
                ["Tool Calls", String(runRequests.length)],
                ["Approvals", approvalEvidenceLabel],
                ["Evaluation Score", typeof evalScore === "number" ? `${evalScore} / 100` : "No evals yet"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="font-semibold text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Risk & Safety" compact />
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Risk Level</span>
                <Badge tone={riskTone(activeRun.riskLevel)}>{activeRun.riskLevel}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Policy Violations</span>
                <span className={`font-semibold tabular-nums ${selectedSecurityFindings.length ? "text-[var(--warning)]" : ""}`}>{selectedSecurityFindings.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Safety Checks</span>
                <span className={`font-semibold ${
                  selectedSecurityFindings.some((finding) => ["critical", "high"].includes(finding.severity))
                    ? "text-[var(--danger)]"
                    : selectedSecurityFindings.length
                      ? "text-[var(--warning)]"
                      : "text-[var(--success)]"
                }`}>
                  {selectedSecurityFindings.some((finding) => ["critical", "high"].includes(finding.severity))
                    ? "Review"
                    : selectedSecurityFindings.length
                      ? "Monitoring"
                      : "Passed"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Prompt Injection</span>
                <span className={`font-semibold ${
                  selectedSecurityFindings.some((finding) => finding.type === "prompt_injection")
                    ? "text-[var(--danger)]"
                    : "text-[var(--success)]"
                }`}>
                  {selectedSecurityFindings.some((finding) => finding.type === "prompt_injection") ? "Signal" : "No"}
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Related" compact />
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--text-muted)]">Skill</span>
                <button
                  type="button"
                  className="-my-1 inline-flex min-h-8 items-center rounded-md pl-2 text-right font-semibold text-[var(--primary)] hover:underline focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={selectedSkill ? () => onOpenSkill(selectedSkill) : onOpenSkills}
                >
                  {selectedSkill?.name}
                </button>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--text-muted)]">Workflow</span>
                <span className="text-right font-semibold">Linked workflow</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--text-muted)]">Evidence</span>
                <span className="text-right font-semibold">{auditLogs.length} logs</span>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <SectionTitle title="Recent Runs" compact />
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {runs.slice(0, 6).map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm last:border-b-0 ${
                    run.id === activeRun.id ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text)]">{run.id}</span>
                    <Badge tone={statusTone(run.status)}>{statusLabels[run.status]}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{run.currentStage}</div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
