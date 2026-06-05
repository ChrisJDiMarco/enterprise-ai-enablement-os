"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  KeyRound,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge, Button, Panel } from "@/components/ui";
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
} from "@/lib/enterprise-ai-data";
import type { PrimetimeLaunchGate } from "@/lib/primetime-launch-gate";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { TransformationCommandSystem } from "@/lib/transformation-command-system";
import type { OrchestratorAction, OrchestratorMessage, ProductionReadiness } from "@/lib/ui/types";

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

export function AIOrchestrator({
  messages,
  input,
  setInput,
  onSend,
  onAction,
  onClear,
  metrics,
  runs,
  toolRequests,
  auditLogs,
  governanceReviews,
  evalResults,
  workflowStatus,
  workflowValidation,
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
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  workflowStatus: string;
  workflowValidation: WorkflowValidationSummary;
  selectedSkill: Skill | null;
  productionReadiness: ProductionReadiness | null;
  providerVault: ProviderReadiness[];
  actionInboxItems: ActionInboxItem[];
  primetimeLaunchGate: PrimetimeLaunchGate;
  transformationCommand: TransformationCommandSystem;
  commandOrders: CommandOrderRecord[];
}) {
  const promptStarters: PromptStarter[] = [
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
  const configuredProviders = providerVault.filter((provider) => provider.configured && provider.id !== "local");
  const pendingApprovals = toolRequests.filter((request) => request.status === "pending").length;
  const activeInboxCount = actionInboxItems.filter((item) => item.severity !== "success").length;
  const latestMessage = messages[messages.length - 1];
  const liveCommandOrders = activeCommandOrders(commandOrders).slice(0, 3);
  const nextCommandOrder = liveCommandOrders[0];
  const nextMoveTitle = nextCommandOrder?.title ?? transformationCommand.nextAction.title;
  const nextMoveWhy = nextCommandOrder?.why ?? transformationCommand.nextAction.why;
  const gateTone = primetimeLaunchGate.status === "ready" ? "green" : primetimeLaunchGate.status === "needs-work" ? "amber" : "red";
  const readinessStatus = productionReadiness?.status ?? "unchecked";
  const readinessTone = readinessStatus === "ready" ? "green" : readinessStatus === "blocked" ? "red" : readinessStatus === "degraded" ? "amber" : "slate";
  const evidenceCount = auditLogs.length + runs.length + evalResults.length + governanceReviews.length;
  const operatingPath = [
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
  const canSend = input.trim().length > 0;

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
    <div className="-mb-6 flex h-[calc(100dvh-151px)] min-h-0 flex-col">
      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200/70 bg-white/94 px-3 py-2 backdrop-blur-xl md:px-4">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white shadow-sm">
                <Bot size={17} />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-slate-950">AI Assistant</h1>
                <p className="truncate text-xs text-slate-500">{messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "Ready for the next move"}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
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

          <details data-testid="orchestrator-context-drawer" className="group mx-auto mt-2 max-w-4xl rounded-lg border border-slate-200/76 bg-white/72">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                  next
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-950">{nextMoveTitle}</span>
                  <span className="hidden truncate text-xs font-medium text-slate-500 md:block">{nextMoveWhy}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="hidden gap-2 text-xs lg:flex">
                  <StatusPill label="Path" value={nextOperatingPathItem?.label ?? "ready"} tone={nextOperatingPathItem ? "amber" : "green"} />
                  <StatusPill label="Launch" value={`${primetimeLaunchGate.score}/100`} tone={gateTone} />
                  <StatusPill label="Queue" value={activeInboxCount ? `${activeInboxCount} open` : "clear"} tone={activeInboxCount ? "amber" : "green"} />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200/70">
                  <MessageSquareText size={14} />
                  <span className="hidden sm:inline">Context</span>
                  <ChevronDown size={15} className="transition group-open:rotate-180" />
                </span>
              </span>
            </summary>
            <div className="max-h-[220px] overflow-y-auto overscroll-contain border-t border-slate-200/72">
              <div className="grid gap-0 text-sm md:grid-cols-4">
                <ContextBlock title="Recommended move">
                  <button
                    type="button"
                    className="w-full text-left transition hover:text-[var(--primary)]"
                    onClick={() => onSend("What should I do next?")}
                  >
                    <span className="block font-semibold text-slate-950">{nextCommandOrder?.title ?? transformationCommand.nextAction.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {nextCommandOrder?.why ?? transformationCommand.nextAction.why}
                    </span>
                  </button>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone={transformationCommand.posture === "scaling" ? "green" : transformationCommand.posture === "command-ready" ? "blue" : transformationCommand.posture === "forming" ? "amber" : "red"}>
                      {transformationCommand.score}/100
                    </Badge>
                    <span className="text-xs text-slate-500">{transformationCommand.directive}</span>
                  </div>
                </ContextBlock>

                <ContextBlock title="Workspace health">
                  <ContextStat label="Readiness" value={readinessStatus} tone={readinessTone} />
                  <ContextStat label="Workflow" value={workflowStatus} tone={workflowValidation.valid && workflowValidation.triggerCount ? "green" : "amber"} />
                  <ContextStat label="Evidence" value={String(evidenceCount)} />
                  <ContextStat label="Value" value={formatCurrency(metrics.annualValue)} />
                  <ContextStat label="Providers" value={configuredProviders.length ? String(configuredProviders.length) : "local"} />
                  <ContextStat label="Tool approvals" value={String(pendingApprovals)} tone={pendingApprovals ? "amber" : "green"} />
                  <ContextStat label="Focus" value={selectedSkill?.name ?? "No Skill selected"} />
                </ContextBlock>

                <ContextBlock title="Progress path">
                  <div className="grid grid-cols-2 gap-1.5">
                    {operatingPath.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                          item.complete
                            ? "border-green-100 bg-green-50 text-green-700"
                            : item.label === nextOperatingPathItem?.label
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-500"
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
                </ContextBlock>

                <ContextBlock title="Helpful shortcuts">
                  <div className="space-y-1">
                    {launchShortcuts.map((shortcut) => {
                      const Icon = shortcut.icon;
                      return (
                        <button
                          key={shortcut.label}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-white hover:text-[var(--primary)]"
                          onClick={() => void onAction(shortcut.action)}
                        >
                          <Icon size={15} className="shrink-0 text-slate-500" />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-800">{shortcut.label}</span>
                            <span className="block truncate text-[11px] text-slate-500">{shortcut.helper}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </ContextBlock>
              </div>

              <div className="border-t border-slate-200/72 px-3 py-2">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {promptStarters.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                      onClick={() => onSend(starter.prompt)}
                    >
                      {starter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-5 md:px-6">
            {!messages.length ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-2xl text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm ring-1 ring-slate-200/80">
                    <Bot size={24} />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-950">Tell me what you want moved forward.</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    I can inspect this workspace, explain the next step, open the right screen, draft a plan, and keep actions reviewable.
                  </p>
                  <div className="mt-5 grid gap-2 text-left sm:grid-cols-2" data-testid="orchestrator-empty-starters">
                    {compactPrompts.map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        className="group rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-px hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)]/55"
                        onClick={() => onSend(starter.prompt)}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-950">{starter.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">{starter.helper}</span>
                          </span>
                          <ChevronRight size={15} className="mt-0.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onAction={onAction} />
                ))}
                <div ref={messageEndRef} aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 bg-white p-3" data-testid="orchestrator-composer">
          <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-2 shadow-sm focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-indigo-50">
            <textarea
              className="max-h-[132px] min-h-[58px] w-full resize-none rounded-lg border-0 px-3 py-2 text-sm leading-6 outline-none"
              placeholder="Ask for the next move, a Skill plan, launch risk, proof, or an executive update..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            {messages.length ? (
              <details className="group mx-2 mb-2 rounded-lg border border-slate-200/70 bg-slate-50/70" data-testid="orchestrator-prompt-starters">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Prompt starters</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">Use these when you know the goal but not the right words.</span>
                  </span>
                  <ChevronDown size={15} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <div className="hidden grid-cols-1 gap-px overflow-hidden border-t border-slate-200/70 bg-slate-200/70 group-open:grid sm:grid-cols-2 lg:grid-cols-3">
                  {promptStarters.slice(0, 6).map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      className="bg-white px-3 py-2.5 text-left transition hover:bg-[var(--primary-soft)]"
                      onClick={() => onSend(starter.prompt)}
                    >
                      <span className="block text-xs font-semibold text-slate-950">{starter.label}</span>
                      <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-500">{starter.helper}</span>
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2 pt-2">
              <div className="text-xs text-slate-500">
                {latestMessage ? "Uses current workspace data. Actions stay reviewable." : "Pick a starter or type a goal."}
              </div>
              <Button type="submit" className="h-8" disabled={!canSend} data-testid="orchestrator-send-button">
                <Sparkles size={15} />
                Send
              </Button>
            </div>
          </div>
        </form>
      </Panel>
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
        className={`${isUser ? "max-w-[min(560px,88%)]" : "max-w-[min(760px,94%)]"} min-w-0 rounded-lg border px-4 py-3 shadow-sm ${
          isUser
            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
            : "border-slate-200 bg-white text-slate-800"
        }`}
      >
        <div className={`text-xs font-semibold ${isUser ? "text-indigo-100" : "text-slate-500"}`}>
          {isUser ? "You" : "AI Assistant"} · {message.createdAt}
        </div>
        <div className="mt-2 whitespace-pre-line text-sm leading-6 text-balance">{content.preview}</div>
        {!isUser && content.overflow ? (
          <details className="group mt-2 min-w-0 rounded-lg border border-slate-200 bg-slate-50/80">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-700">
              <span>Read details</span>
              <ChevronDown size={15} className="text-slate-400 transition group-open:rotate-180" />
            </summary>
            <div className="whitespace-pre-line border-t border-slate-200 px-3 py-2 text-sm leading-6 text-slate-700">
              {content.overflow}
            </div>
          </details>
        ) : null}

        {!isUser && message.evidence?.length ? <EvidenceDisclosure evidence={message.evidence} /> : null}
        {!isUser && message.actions?.length ? (
          <details className="group mt-2 min-w-0 rounded-lg border border-slate-200 bg-slate-50/80">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles size={14} className="text-[var(--primary)]" />
                <span className="truncate">{actionSummary}</span>
              </span>
              <ChevronDown size={15} className="text-slate-400 transition group-open:rotate-180" />
            </summary>
            <div className="space-y-1.5 border-t border-slate-200 px-2 py-2">
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
          ? "border-[var(--primary)] bg-white text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          : isDanger
            ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={() => void onAction(action)}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">{displayLabel}</span>
        {displayDescription ? (
          <span className={`mt-0.5 hidden truncate text-xs sm:block ${isDanger ? "text-red-500" : "text-slate-500"}`}>
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
    <details className="group mt-2 min-w-0 rounded-lg border border-slate-200 bg-slate-50/80">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold text-slate-700">
        <span>Proof used</span>
        <span className="flex items-center gap-2 text-slate-500">
          {evidence.length} item{evidence.length === 1 ? "" : "s"}
          <ChevronDown size={15} className="transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="grid min-w-0 gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
        {evidence.map((item) => (
          <div key={`${item.label}-${item.value}`} className="min-w-0 bg-white px-3 py-2 text-xs">
            <div className="truncate text-slate-500">{plainProductLanguage(item.label)}</div>
            <div className="mt-1 truncate font-semibold text-slate-950">{plainProductLanguage(item.value)}</div>
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
    [/\bAI Harness\b/g, "Run Tests"],
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
    slate: "border-slate-200 bg-white text-slate-600",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`shrink-0 rounded-full border px-2.5 py-1 ${tones[tone]}`}>
      <span className="text-slate-500">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
    </div>
  );
}

function ContextBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200/72 px-3 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-400">{title}</div>
      {children}
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
      <span className="text-slate-500">{label}</span>
      {tone ? (
        <Badge tone={tone}>{value}</Badge>
      ) : (
        <span className="min-w-0 truncate font-semibold text-slate-900">{value}</span>
      )}
    </div>
  );
}
