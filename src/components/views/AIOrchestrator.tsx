"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Compass,
  FileText,
  KeyRound,
  ListChecks,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Badge, Button, GlossaryTerm } from "@/components/ui";
import type { ActionInboxItem } from "@/lib/action-inbox";
import { activeCommandOrders, type CommandOrderRecord } from "@/lib/command-orders";
import {
  formatCurrency,
  type AuditLog,
  type EvalResult,
  type GovernanceReview,
  type Run,
  type Skill,
  type ToolRequest,
  type UseCase,
  type WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { PrimetimeLaunchGate } from "@/lib/primetime-launch-gate";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { TransformationCommandSystem } from "@/lib/transformation-command-system";
import { deriveOperatingModel } from "@/lib/ui/operating-model";
import type { OrchestratorAction, OrchestratorMessage, ProductionReadiness, View } from "@/lib/ui/types";

type WorkflowValidationSummary = {
  valid: boolean;
  issues: { severity: "error" | "warning"; message: string; nodeId?: string }[];
  warnings: { severity: "error" | "warning"; message: string; nodeId?: string }[];
  triggerCount: number;
  terminalCount: number;
  conditionCount: number;
  configuredCount: number;
};

type LaunchShortcut = {
  label: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: OrchestratorAction;
};

type PromptStarter = {
  label: string;
  helper: string;
  prompt: string;
};

type ActionPreviewItem = {
  label: string;
  body: string;
  view: View;
};

type HubCommand = {
  label: string;
  helper: string;
  prompt: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type AppSurfaceGroup = {
  title: string;
  items: {
    label: string;
    helper: string;
    view: View;
  }[];
};

export function AIOrchestrator({
  messages,
  input,
  isBusy,
  setInput,
  onSend,
  onAction,
  onClear,
  metrics,
  useCases,
  skills,
  runs,
  toolRequests,
  auditLogs,
  governanceReviews,
  evalResults,
  workSignals,
  workflowStatus,
  workflowValidation,
  selectedUseCase,
  selectedSkill,
  productionReadiness,
  providerVault,
  actionInboxItems,
  primetimeLaunchGate,
  transformationCommand,
  commandOrders,
}: {
  messages: OrchestratorMessage[];
  input: string;
  isBusy: boolean;
  setInput: (value: string) => void;
  onSend: (value?: string) => void;
  onAction: (action: OrchestratorAction) => void | Promise<void>;
  onClear: () => void | Promise<void>;
  metrics: {
    totalUseCases: number;
    activePilots: number;
    skills: number;
    adoptionRate: number;
    hoursSaved: number;
    riskItemsOpen: number;
    annualValue: number;
  };
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  workSignals: WorkSignal[];
  workflowStatus: string;
  workflowValidation: WorkflowValidationSummary;
  selectedUseCase: UseCase | null;
  selectedSkill: Skill | null;
  productionReadiness: ProductionReadiness | null;
  providerVault: ProviderReadiness[];
  actionInboxItems: ActionInboxItem[];
  primetimeLaunchGate: PrimetimeLaunchGate;
  transformationCommand: TransformationCommandSystem;
  commandOrders: CommandOrderRecord[];
}) {
  const operatingModel = deriveOperatingModel({
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
    auditLogs,
    toolRequests,
    metrics,
    workflowStatus,
    workflowNodeCount: workflowValidation.configuredCount,
    selectedUseCase,
    selectedSkill,
    workSignals,
  });
  const activeInitiative = operatingModel.initiative;
  const actionPreview: ActionPreviewItem[] = [
    {
      label: operatingModel.nextStage?.actionLabel ?? "Open the current initiative",
      body: operatingModel.nextStage?.helper ?? "Inspect the active initiative and choose the next controlled move.",
      view: operatingModel.nextStage?.view ?? "command",
    },
    {
      label: operatingModel.nextProof?.label ?? "Proof packet",
      body: operatingModel.nextProof?.body ?? "Package the use case, Skill, trace, eval, review, and value story.",
      view: operatingModel.nextProof?.view ?? "evidence",
    },
    {
      label: "Keep controls visible",
      body: `${activeInitiative.risk} risk, ${activeInitiative.proofCount} proof records, ${activeInitiative.openReviewCount} open reviews.`,
      view: "governance",
    },
  ];
  const promptStarters: PromptStarter[] = [
    {
      label: "Build from a business problem",
      helper: "Describe the work pain; I will turn it into a governed initiative.",
      prompt: "I have a business problem I want AI to help with. Interview me, then draft the use case, Skill plan, tests, controls, launch path, and proof packet.",
    },
    {
      label: "Find the next move",
      helper: "Reads the queue, launch gaps, and proof chain.",
      prompt: "What should I do next? Give me the one best move, why it matters, and where to go.",
    },
    {
      label: "Shape a use case",
      helper: "Turns messy demand into a buildable AI opportunity.",
      prompt: "Turn the top use case into an AI Skill plan with owner, data, risk, tests, and next action.",
    },
    {
      label: "Review launch risk",
      helper: "Explains blockers in plain business language.",
      prompt: "Show blocked reviews and launch risks. Tell me what must be fixed before rollout.",
    },
    {
      label: "Prepare leadership update",
      helper: "Summarizes value, adoption, evidence, and open risks.",
      prompt: "Prepare my executive update with value, proof, launch status, risks, and recommended next step.",
    },
    {
      label: "Check readiness",
      helper: "Looks across workflow, evals, tools, evidence, and keys.",
      prompt: "Run a readiness check and explain the gaps in priority order.",
    },
    {
      label: "Launch safely",
      helper: "Builds a cautious rollout path with human review.",
      prompt: "Help me launch safely. Show the smallest pilot path, proof needed, and approval steps.",
    },
  ];
  const compactPrompts = promptStarters.slice(0, 4);
  const composerCommands: { label: string; prompt: string }[] = [
    { label: "Status", prompt: "Give me the current portfolio status, metrics, blockers, and one next action." },
    { label: "Next", prompt: "What should I do next? Give me one action, why it matters, and the button to execute it." },
    { label: "Metrics", prompt: "Show me the current value, adoption, use case, Skill, run, risk, and evidence metrics." },
    { label: "Brief", prompt: "Generate an executive brief from the current workspace state." },
  ];
  const hubCommands: HubCommand[] = [
    {
      label: "Status and metrics",
      helper: "Portfolio health, blockers, value, adoption, and proof.",
      prompt: "Give me the current portfolio status, metrics, blockers, and one next action.",
      icon: BarChart3,
    },
    {
      label: "Next best move",
      helper: "One decision, why it matters, and the action button.",
      prompt: "What should I do next? Give me one action, why it matters, and the button to execute it.",
      icon: Compass,
    },
    {
      label: "Product feedback",
      helper: "Critique what is weak or missing in this workspace.",
      prompt: "Review this workspace like an enterprise AI operating team. Tell me what is weak, what is missing, and what to fix first.",
      icon: Activity,
    },
    {
      label: "Launch readiness",
      helper: "Customer-ready gate, blockers, and evidence gaps.",
      prompt: "Run a launch readiness review. Show blockers, evidence gaps, and the next button I should click.",
      icon: ListChecks,
    },
    {
      label: "Executive brief",
      helper: "Value, risk, adoption, proof, and recommended decision.",
      prompt: "Generate an executive brief from the current workspace state.",
      icon: FileText,
    },
    {
      label: "Build from pain",
      helper: "Turn a rough business problem into the governed path.",
      prompt: "Interview me about a business problem, then draft the use case, Skill plan, workflow, tests, controls, launch path, and proof packet.",
      icon: Sparkles,
    },
  ];
  const appSurfaceGroups: AppSurfaceGroup[] = [
    {
      title: "Start",
      items: [
        { label: "Home", helper: "Operating priorities", view: "command" },
        { label: "AI Inventory", helper: "Current AI estate", view: "estate" },
        { label: "Company Plan", helper: "Rollout model", view: "blueprint" },
      ],
    },
    {
      title: "Find and shape work",
      items: [
        { label: "AI Roadmap", helper: "Portfolio priorities", view: "strategy" },
        { label: "Process Redesign", helper: "Before automation", view: "process" },
        { label: "Work Signals", helper: "Demand radar", view: "work" },
        { label: "Use Cases", helper: "Intake and scoring", view: "factory" },
      ],
    },
    {
      title: "Build safely",
      items: [
        { label: "AI Skills", helper: "Prompt and policy", view: "skills" },
        { label: "Workflow Builder", helper: "Execution graph", view: "workflow" },
        { label: "AI Harness", helper: "Traceable runs", view: "harness" },
        { label: "Connect Apps", helper: "Enterprise stack", view: "connectors" },
      ],
    },
    {
      title: "Control and prove",
      items: [
        { label: "Tool Permissions", helper: "Broker policy", view: "broker" },
        { label: "Knowledge Sources", helper: "Context fabric", view: "context" },
        { label: "Quality Evals", helper: "Eval evidence", view: "evals" },
        { label: "Risk Review", helper: "Approval path", view: "governance" },
      ],
    },
    {
      title: "Launch and scale",
      items: [
        { label: "Launch Plan", helper: "Rollout gates", view: "launch" },
        { label: "Proof Ledger", helper: "Evidence packet", view: "evidence" },
        { label: "Value & ROI", helper: "Business impact", view: "roi" },
        { label: "Adoption Plan", helper: "Enablement", view: "training" },
        { label: "Reports", helper: "Executive story", view: "reports" },
        { label: "Settings", helper: "Tenant setup", view: "admin" },
      ],
    },
  ];
  const configuredProviders = providerVault.filter((provider) => provider.configured && provider.id !== "local");
  const pendingApprovals = toolRequests.filter((request) => request.status === "pending").length;
  const activeInboxCount = actionInboxItems.filter((item) => item.severity !== "success").length;
  const liveCommandOrders = activeCommandOrders(commandOrders).slice(0, 3);
  const nextCommandOrder = liveCommandOrders[0];
  const nextMoveTitle = operatingModel.nextStage
    ? `${operatingModel.nextStage.label}: ${operatingModel.nextStage.actionLabel}`
    : (nextCommandOrder?.title ?? transformationCommand.nextAction.title);
  const nextMoveWhy = operatingModel.nextStage?.evidence ?? nextCommandOrder?.why ?? transformationCommand.nextAction.why;
  const gateTone = primetimeLaunchGate.status === "ready" ? "green" : primetimeLaunchGate.status === "needs-work" ? "amber" : "red";
  const readinessStatus = productionReadiness?.status ?? "unchecked";
  const readinessTone = readinessStatus === "ready" ? "green" : readinessStatus === "blocked" ? "red" : readinessStatus === "degraded" ? "amber" : "slate";
  const evidenceCount = auditLogs.length + runs.length + evalResults.length + governanceReviews.length;
  const operatingPath = [
    { label: "Work signals", complete: workSignals.length > 0 || metrics.totalUseCases > 0, view: "work" },
    { label: "Use cases", complete: metrics.totalUseCases > 0, view: "factory" },
    { label: "AI Skills", complete: metrics.skills > 0, view: "skills" },
    { label: "Workflow", complete: workflowValidation.configuredCount > 0 && workflowValidation.triggerCount > 0, view: "workflow" },
    { label: "Run tests", complete: runs.length > 0, view: "harness" },
    { label: "Quality", complete: evalResults.length > 0, view: "evals" },
    { label: "Risk review", complete: governanceReviews.length > 0, view: "governance" },
    { label: "Proof", complete: evidenceCount > 0, view: "evidence" },
    { label: "Value", complete: metrics.annualValue > 0, view: "roi" },
  ] as const;
  const nextOperatingPathItem = operatingPath.find((item) => !item.complete);
  const launchShortcuts: LaunchShortcut[] = [
    {
      label: "Connect apps",
      helper: "Identity, models, work systems, and evidence.",
      icon: Network,
      action: {
        id: "orchestrator-open-connectors",
        type: "open_view",
        label: "Open Connect Apps",
        payload: { view: "connectors" },
        tone: "primary",
      },
    },
    {
      label: "Company setup",
      helper: "Apps, model keys, and tenant-safe secrets.",
      icon: KeyRound,
      action: {
        id: "orchestrator-open-ai-settings",
        type: "open_ai_settings",
        label: "Open company setup",
        tone: "secondary",
      },
    },
    {
      label: "Proof ledger",
      helper: "Runs, evals, controls, approvals, and ROI proof.",
      icon: ShieldCheck,
      action: {
        id: "orchestrator-open-evidence",
        type: "open_view",
        label: "Open Proof Ledger",
        payload: { view: "evidence" },
        tone: "secondary",
      },
    },
  ];
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const canSend = input.trim().length > 0 && !isBusy;
  const sendDisabledReason = "Type a message or choose a prompt starter before sending.";
  const sendBusyReason = "The AI Assistant is still planning the last request.";

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!canSend) return;
      onSend();
    }
  }

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <header className="shrink-0 border-b border-[var(--border)]/60 bg-[var(--surface)]/72 px-3 py-2 backdrop-blur-xl md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white shadow-sm">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-base font-semibold text-[var(--text)]">AI Assistant</h1>
                  <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] sm:inline-flex">
                    {isBusy ? "planning" : messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "ready"}
                  </span>
                </div>
                <p className="hidden max-w-[56vw] truncate text-xs text-[var(--text-muted)] md:block">
                  {nextMoveTitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                className="h-8 px-2.5"
                onClick={() => {
                  setHubOpen((open) => !open);
                  setContextOpen(false);
                }}
                aria-expanded={hubOpen}
                aria-controls={hubOpen ? "orchestrator-hub-panel" : undefined}
                data-testid="orchestrator-hub-toggle"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Command hub</span>
              </Button>
              <Button
                variant="secondary"
                className="h-8 px-2.5"
                onClick={() => {
                  setContextOpen((open) => !open);
                  setHubOpen(false);
                }}
                aria-expanded={contextOpen}
                aria-controls={contextOpen ? "orchestrator-context-panel" : undefined}
                data-testid="orchestrator-context-toggle"
              >
                <MessageSquareText size={14} />
                <span className="hidden sm:inline">Context</span>
              </Button>
              <Button variant="ghost" className="h-8 px-2.5" onClick={onClear}>
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear chat</span>
              </Button>
              <Button variant="secondary" className="h-8 px-2.5" onClick={() => onSend("What can you do?")}>
                <Sparkles size={14} />
                <span className="hidden sm:inline">What can you do?</span>
                <span className="sm:hidden">Help</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-transparent" data-testid="orchestrator-transcript">
          <div className="flex min-h-full w-full flex-col px-4 py-5 md:px-7">
            {!messages.length ? (
              <div className="flex min-h-full flex-col justify-center py-8">
                <div className="mx-auto w-full max-w-2xl text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                    <Bot size={24} />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text)]">Ask for the next governed AI move.</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                    I can turn a business problem into a use case, Skill contract, workflow, tests, review packet, launch path, and proof story.
                  </p>
                  <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-sm" data-testid="orchestrator-action-preview">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck size={16} className="text-[var(--primary)]" />
                          <span className="text-sm font-semibold text-[var(--text)]">Working object: {activeInitiative.title}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          Next proof: {operatingModel.nextProof?.label ?? "Proof packet"} · {activeInitiative.proofCount} records attached.
                        </p>
                      </div>
                      <Badge
                        tone={activeInitiative.readinessScore >= 80 ? "green" : activeInitiative.readinessScore >= 45 ? "amber" : "blue"}
                        title="Readiness averages stage completion and proof coverage for this initiative."
                      >
                        {activeInitiative.readinessScore}% ready
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {actionPreview.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]"
                          onClick={() => void onAction({
                            id: `orchestrator-empty-preview-${item.view}`,
                            type: "open_view",
                            label: item.label,
                            payload: { view: item.view },
                            tone: "secondary",
                          })}
                        >
                          <span className="block text-xs font-semibold text-[var(--text)]">{item.label}</span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[var(--text-muted)]">{item.body}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 text-left sm:grid-cols-2" data-testid="orchestrator-empty-starters">
                    {compactPrompts.map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)]/55"
                        onClick={() => onSend(starter.prompt)}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--text)]">{starter.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{starter.helper}</span>
                          </span>
                          <ChevronRight size={15} className="mt-0.5 shrink-0 text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-5">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onAction={onAction} />
                ))}
                {isBusy ? <AssistantWorking /> : null}
                <div ref={messageEndRef} aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border)]/70 bg-[var(--surface)]/82 px-3 py-1.5 backdrop-blur-xl" data-testid="orchestrator-composer">
          <div className="w-full">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-[var(--primary-soft)]">
              <label htmlFor="orchestrator-composer-input" className="sr-only">
                Ask Enterprise AI Assistant
              </label>
              <textarea
                id="orchestrator-composer-input"
                rows={1}
                className="max-h-24 min-h-10 w-full resize-none rounded-lg border-0 px-2.5 py-2 text-[15px] leading-6 outline-none"
                placeholder="Ask anything, request metrics, or tell me what to run..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy}
              />
              {!canSend ? (
                <span id="orchestrator-send-disabled-reason" className="sr-only">
                  {isBusy ? sendBusyReason : sendDisabledReason}
                </span>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-1 pt-1">
                <div
                  className="flex min-w-0 flex-wrap gap-1.5"
                  data-testid="orchestrator-context-prompt-rail"
                >
                  {composerCommands.map((command) => (
                    <button
                      key={command.label}
                      type="button"
                      className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                      disabled={isBusy}
                      onClick={() => onSend(command.prompt)}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>
                <Button
                  type="submit"
                  className="min-h-10 px-3"
                  disabled={!canSend}
                  aria-describedby={!canSend ? "orchestrator-send-disabled-reason" : undefined}
                  title={!canSend ? (isBusy ? sendBusyReason : sendDisabledReason) : undefined}
                  data-testid="orchestrator-send-button"
                >
                  <Sparkles size={15} />
                  {isBusy ? "Working" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {hubOpen ? (
          <RunAppDrawer
            commands={hubCommands}
            surfaceGroups={appSurfaceGroups}
            isBusy={isBusy}
            onClose={() => setHubOpen(false)}
            onSend={(prompt) => {
              setHubOpen(false);
              onSend(prompt);
            }}
            onAction={(action) => {
              setHubOpen(false);
              void onAction(action);
            }}
          />
        ) : null}

        {contextOpen ? (
          <div className="absolute inset-0 z-30 flex justify-end bg-slate-950/10 p-2 backdrop-blur-[1px] md:p-3">
            <aside
              id="orchestrator-context-panel"
              data-testid="orchestrator-context-drawer"
              role="dialog"
              aria-label="Signal context"
              className="flex h-full w-[min(430px,100%)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Signal context</div>
                  <h2 className="mt-1 truncate text-lg font-semibold text-[var(--text)]">{activeInitiative.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text-muted)]">{nextMoveWhy}</p>
                </div>
                <button
                  type="button"
                  aria-label="Minimize context"
                  title="Minimize context"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => setContextOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <StatusPill label="Path" value={nextOperatingPathItem?.label ?? "ready"} tone={nextOperatingPathItem ? "amber" : "green"} />
                  <StatusPill label="Launch" value={`${primetimeLaunchGate.score}/100`} tone={gateTone} />
                  <StatusPill label="Queue" value={activeInboxCount ? `${activeInboxCount} open` : "clear"} tone={activeInboxCount ? "amber" : "green"} />
                </div>

                <div className="mt-4 space-y-3">
                  <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Active <GlossaryTerm term="initiative">initiative</GlossaryTerm></div>
                        <button
                          type="button"
                          className="mt-2 w-full text-left transition hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                          onClick={() => onSend(`Move ${activeInitiative.title} forward. Tell me the next proof, the action, and the risk tradeoff.`)}
                        >
                          <span className="block font-semibold text-[var(--text)]">{activeInitiative.title}</span>
                          <span
                            className="mt-1 block text-xs leading-5 text-[var(--text-muted)]"
                            title="Readiness averages stage completion and proof coverage for this initiative."
                          >
                            {operatingModel.nextProof?.label ?? "Proof packet"} · {activeInitiative.readinessScore}% ready · {activeInitiative.department}
                          </span>
                        </button>
                      </div>
                      <Badge tone={activeInitiative.risk === "high" || activeInitiative.risk === "restricted" ? "red" : activeInitiative.risk === "medium" ? "amber" : "green"}>
                        {activeInitiative.risk}
                      </Badge>
                    </div>
                  </section>

                  <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Recommended move</div>
                    <div className="mt-2 space-y-1.5">
                      {actionPreview.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]"
                          onClick={() => void onAction({
                            id: `orchestrator-preview-${item.view}`,
                            type: "open_view",
                            label: item.label,
                            payload: { view: item.view },
                            tone: item.view === operatingModel.nextStage?.view ? "primary" : "secondary",
                          })}
                        >
                          <span className="block text-xs font-semibold text-[var(--text)]">{item.label}</span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[var(--text-muted)]">{item.body}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Workspace health</div>
                    <div className="mt-2">
                      <ContextStat label="Readiness" value={readinessStatus} tone={readinessTone} />
                      <ContextStat label="Workflow" value={workflowStatus} tone={workflowValidation.valid && workflowValidation.triggerCount ? "green" : "amber"} />
                      <ContextStat label="Evidence" value={String(evidenceCount)} />
                      <ContextStat label="Value" value={formatCurrency(metrics.annualValue)} />
                      <ContextStat label="Providers" value={configuredProviders.length ? String(configuredProviders.length) : "local"} />
                      <ContextStat label="Tool approvals" value={String(pendingApprovals)} tone={pendingApprovals ? "amber" : "green"} />
                      <ContextStat label="Focus" value={activeInitiative.skill?.name ?? activeInitiative.useCase?.title ?? "No initiative selected"} />
                    </div>
                  </section>

                  <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Progress path</div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {operatingPath.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                            item.complete
                              ? "border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]"
                              : item.label === nextOperatingPathItem?.label
                                ? "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
                          }`}
                          onClick={() => void onAction({
                            id: `orchestrator-path-${item.view}`,
                            type: "open_view",
                            label: `Open ${item.label}`,
                            payload: { view: item.view },
                          })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Helpful shortcuts</div>
                    <div className="mt-2 space-y-1.5">
                      {launchShortcuts.map((shortcut) => {
                        const Icon = shortcut.icon;
                        return (
                          <button
                            key={shortcut.label}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]"
                            onClick={() => void onAction(shortcut.action)}
                          >
                            <Icon size={15} className="shrink-0 text-[var(--text-muted)]" />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-[var(--text)]">{shortcut.label}</span>
                              <span className="block truncate text-[11px] text-[var(--text-muted)]">{shortcut.helper}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function RunAppDrawer({
  commands,
  surfaceGroups,
  isBusy,
  onClose,
  onSend,
  onAction,
}: {
  commands: HubCommand[];
  surfaceGroups: AppSurfaceGroup[];
  isBusy: boolean;
  onClose: () => void;
  onSend: (prompt: string) => void;
  onAction: (action: OrchestratorAction) => void | Promise<void>;
}) {
  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-slate-950/10 p-2 backdrop-blur-[1px] md:p-3">
      <aside
        id="orchestrator-hub-panel"
        data-testid="orchestrator-hub-drawer"
        role="dialog"
        aria-label="Run the OS from AI Assistant"
        className="flex h-full w-[min(560px,100%)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Run the OS</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Ask, navigate, execute</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
              Use chat as the operating hub: request analysis, get metrics, open any surface, and launch auditable actions.
            </p>
          </div>
          <button
            type="button"
            aria-label="Minimize app controls"
            title="Minimize app controls"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <div className="text-sm font-semibold text-[var(--text)]">Ask and act</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {commands.map((command) => {
                const Icon = command.icon;
                return (
                  <button
                    key={command.label}
                    type="button"
                    className="group flex min-h-[76px] items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)]/55 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    disabled={isBusy}
                    onClick={() => onSend(command.prompt)}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)] ring-1 ring-[var(--border)] transition group-hover:bg-[var(--surface)]">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--text)]">{command.label}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{command.helper}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <div className="text-sm font-semibold text-[var(--text)]">Navigate the app</div>
            <div className="mt-2 space-y-4">
              {surfaceGroups.map((group) => (
                <div key={group.title}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">{group.title}</div>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <button
                        key={`${group.title}-${item.label}`}
                        type="button"
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/65 px-3 py-2 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                        onClick={() => void onAction({
                          id: `orchestrator-hub-${item.view}`,
                          type: "open_view",
                          label: `Open ${item.label}`,
                          description: item.helper,
                          payload: { view: item.view },
                          tone: "secondary",
                        })}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[var(--text)]">{item.label}</span>
                          <span className="block truncate text-[11px] text-[var(--text-muted)]">{item.helper}</span>
                        </span>
                        <ChevronRight size={14} className="shrink-0 text-[var(--text-soft)]" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function AssistantWorking() {
  return (
    <div className="flex justify-start" role="status" aria-live="polite" data-testid="orchestrator-working-state">
      <div className="flex max-w-[760px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-2 text-sm font-medium text-[var(--text-muted)] shadow-sm">
        <span className="flex size-6 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
          <Bot size={13} />
        </span>
        <span>Planning from workspace state</span>
        <span className="flex gap-1" aria-hidden="true">
          <span className="size-1.5 rounded-full bg-[var(--border-strong)]" />
          <span className="size-1.5 rounded-full bg-[var(--border-strong)]" />
          <span className="size-1.5 rounded-full bg-[var(--border-strong)]" />
        </span>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: OrchestratorMessage;
  onAction: (action: OrchestratorAction) => void | Promise<void>;
}) {
  const isUser = message.role === "user";
  const displayContent = isUser ? message.content : plainProductLanguage(message.content);
  const content = isUser ? { preview: displayContent, overflow: "" } : splitAssistantContent(displayContent);
  const actionSummary =
    !isUser && message.actions?.length
      ? message.actions.length === 1
        ? plainProductLanguage(message.actions[0].label)
        : `${message.actions.length} actions`
      : "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article
        className={`${isUser ? "max-w-[min(560px,88%)] rounded-[20px] px-4 py-3 shadow-sm" : "w-full max-w-[760px] px-1 py-1"} min-w-0 ${
          isUser
            ? "bg-[var(--primary)] text-white"
            : "text-[var(--text)]"
        }`}
      >
        {!isUser ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <span className="flex size-6 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
              <Bot size={13} />
            </span>
            <span>AI Assistant</span>
            <span className="text-[var(--text-soft)]">·</span>
            <span>{message.createdAt}</span>
            {message.simulated ? (
              <span
                title="This reply came from the deterministic local planner — no model was called. Configure a provider in Settings for live planning."
                className="inline-flex items-center rounded-full border border-dashed border-[color-mix(in_srgb,var(--warning)_38%,var(--border))] bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--warning)]"
              >
                Offline guidance
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-xs font-semibold text-indigo-100">You · {message.createdAt}</div>
        )}
        <div className={`${isUser ? "mt-2 text-white" : "text-[var(--text)]"} whitespace-pre-line text-[15px] leading-7 text-balance`}>
          {content.preview}
        </div>
        {!isUser && content.overflow ? (
          <details className="group mt-3 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)]/85">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
              <span>Read details</span>
              <ChevronDown size={15} className="text-[var(--text-soft)] transition group-open:rotate-180" />
            </summary>
            <div className="whitespace-pre-line border-t border-[var(--border)] px-3 py-2 text-sm leading-6 text-[var(--text-muted)]">
              {content.overflow}
            </div>
          </details>
        ) : null}

        {!isUser && message.evidence?.length ? <EvidenceDisclosure evidence={message.evidence} /> : null}
        {!isUser && message.actions?.length ? (
          <details open className="group mt-3 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)]/85">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles size={14} className="text-[var(--primary)]" />
                <span className="truncate">{actionSummary}</span>
              </span>
              <ChevronDown size={15} className="text-[var(--text-soft)] transition group-open:rotate-180" />
            </summary>
            <div className="space-y-1.5 border-t border-[var(--border)] px-2 py-2">
              {message.actions.map((action) => (
                <CompactActionButton key={action.id} action={action} onAction={onAction} />
              ))}
            </div>
          </details>
        ) : null}
      </article>
    </div>
  );
}

function CompactActionButton({
  action,
  onAction,
}: {
  action: OrchestratorAction;
  onAction: (action: OrchestratorAction) => void | Promise<void>;
}) {
  const isPrimary = action.tone === "primary";
  const isDanger = action.tone === "danger";
  const displayLabel = plainProductLanguage(action.label);
  const displayDescription = action.description ? plainProductLanguage(action.description) : "";

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-left text-sm transition ${
        isPrimary
          ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          : isDanger
            ? "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
      }`}
      onClick={() => void onAction(action)}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">{displayLabel}</span>
        {displayDescription ? (
          <span className={`mt-0.5 hidden truncate text-xs sm:block ${isDanger ? "text-red-500" : "text-[var(--text-muted)]"}`}>
            {displayDescription}
          </span>
        ) : null}
      </span>
      <ChevronRight size={15} className="shrink-0 opacity-60" />
    </button>
  );
}

function EvidenceDisclosure({ evidence }: { evidence: NonNullable<OrchestratorMessage["evidence"]> }) {
  return (
    <details className="group mt-2 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/80">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
        <span>Proof used</span>
        <span className="flex items-center gap-2 text-[var(--text-muted)]">
          {evidence.length} item{evidence.length === 1 ? "" : "s"}
          <ChevronDown size={15} className="transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="grid min-w-0 gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
        {evidence.map((item) => (
          <div key={`${item.label}-${item.value}`} className="min-w-0 bg-[var(--surface)] px-3 py-2 text-xs">
            <div className="truncate text-[var(--text-muted)]">{plainProductLanguage(item.label)}</div>
            <div className="mt-1 truncate font-semibold text-[var(--text)]">{plainProductLanguage(item.value)}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function plainProductLanguage(text: string) {
  const replacements: [RegExp, string][] = [
    [/\bAI Orchestrator\b/g, "AI Assistant"],
    [/\bOrchestrator\b/g, "Assistant"],
    [/\bCommand Center\b/g, "Home"],
    [/\bUse Case Factory\b/g, "Use Cases"],
    [/\bSkills Library\b/g, "AI Skills"],
    [/\bWorkflow Studio\b/g, "Workflow Builder"],
    [/\bEvidence Ledger\b/g, "Proof Ledger"],
    [/\bMetrics & ROI\b/g, "Value & ROI"],
    [/\bWork Intelligence\b/g, "Work Signals"],
    [/\bContext Fabric\b/g, "Knowledge Sources"],
    [/\bMCP Broker\b/g, "Tool Permissions"],
    [/\bGovernance Review\b/g, "Risk Review"],
    [/\bOpen Governance\b/g, "Open Risk Review"],
    [/\bConnector Setup\b/g, "Connect Apps"],
  ];

  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function splitAssistantContent(content: string) {
  const lines = content.split("\n");
  const visibleLineLimit = 3;
  const visibleCharLimit = 440;

  if (lines.length > visibleLineLimit) {
    return {
      preview: lines.slice(0, visibleLineLimit).join("\n"),
      overflow: lines.slice(visibleLineLimit).join("\n"),
    };
  }

  if (content.length <= visibleCharLimit) {
    return { preview: content, overflow: "" };
  }

  const breakpoint = content.lastIndexOf(" ", visibleCharLimit);
  const splitAt = breakpoint > 320 ? breakpoint : visibleCharLimit;

  return {
    preview: `${content.slice(0, splitAt).trimEnd()}...`,
    overflow: content.slice(splitAt).trimStart(),
  };
}

function StatusPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "green" | "amber" | "red";
}) {
  const tones = {
    slate: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
    green: "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    amber: "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    red: "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
  };

  return (
    <div className={`shrink-0 rounded-full border px-2.5 py-1 ${tones[tone]}`}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
    </div>
  );
}

function ContextStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "red" | "blue" | "purple" | "slate";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      {tone ? (
        <Badge tone={tone}>{value}</Badge>
      ) : (
        <span className="min-w-0 truncate font-semibold text-[var(--text)]">{value}</span>
      )}
    </div>
  );
}
