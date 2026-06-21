"use client";

import type { KeyboardEvent } from "react";
import { AlertTriangle, Bell, Check, ChevronRight, Clock3, X } from "lucide-react";

import { Badge } from "@/components/ui";
import type { ActionInboxItem, ActionInboxSeverity } from "@/lib/action-inbox";
import { useDialogFocus } from "@/lib/ui/dialog-focus";

export function ActionInboxModal({
  items,
  openCount,
  onClose,
  onOpenItem,
}: {
  items: ActionInboxItem[];
  openCount: number;
  onClose: () => void;
  onOpenItem: (item: ActionInboxItem) => void;
}) {
  const {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  } = useDialogFocus<HTMLElement, HTMLButtonElement>();
  const severityMeta: Record<
    ActionInboxSeverity,
    {
      label: string;
      tone: "green" | "blue" | "amber" | "red";
      toneClass: string;
    }
  > = {
    critical: {
      label: "Do now",
      tone: "red",
      toneClass: "ea-inbox-tone-danger",
    },
    warning: {
      label: "Needs decision",
      tone: "amber",
      toneClass: "ea-inbox-tone-warning",
    },
    info: {
      label: "Suggested",
      tone: "blue",
      toneClass: "ea-inbox-tone-info",
    },
    success: {
      label: "Healthy",
      tone: "green",
      toneClass: "ea-inbox-tone-success",
    },
  };
  const criticalCount = items.filter((item) => item.severity === "critical").length;
  const warningCount = items.filter((item) => item.severity === "warning").length;
  const suggestionCount = items.filter((item) => item.severity === "info").length;
  const primaryItem = items.find((item) => item.severity !== "success") ?? items[0];
  const remainingItems = items.filter((item) => item.id !== primaryItem?.id);
  const primaryMeta = primaryItem ? severityMeta[primaryItem.severity] : null;

  function itemGuidance(item: ActionInboxItem): {
    stage: string;
    why: string;
    result: string;
    tone: "green" | "blue" | "amber" | "red";
  } {
    if (item.id === "pending-tool-requests") {
      return {
        stage: "Approve action",
        why: "A Skill is asking to use a company tool. This needs a human yes/no decision before the run can move.",
        result: "You will open the Harness run with the approval and trace evidence in context.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "broker") {
      return {
        stage: "Review policy",
        why: "Tool access should stay inside approved scopes before any Skill can use company systems.",
        result: "You will open Tool Permissions to inspect broker policy, connector scope, and approval gates.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "governance") {
      return {
        stage: "Review risk",
        why: "A use case or Skill cannot safely move forward until the reviewer decision is clear.",
        result: "You will open Risk Review and resolve the approval, condition, or change request.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "harness") {
      return {
        stage: "Inspect run",
        why: "A run is blocked, failed, or waiting. The trace shows where the workflow stopped.",
        result: "You will open the Harness trace and see the exact stage, tool request, and evidence.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "evals") {
      return {
        stage: "Prove quality",
        why: "Launch evidence is weak until the Skill clears evals and critical failures are fixed.",
        result: "You will open Quality Evals to rerun checks or inspect the failing suite.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "workflow") {
      return {
        stage: "Fix workflow",
        why: "A workflow blueprint with unresolved issues should not be published or tested as launch proof.",
        result: "You will open Workflow Builder at the blueprint that needs cleanup.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "factory") {
      return {
        stage: "Shape use case",
        why: "A risky or incomplete opportunity needs value, owner, data, autonomy, and review boundaries.",
        result: "You will open Use Cases and triage the opportunity before anyone builds.",
        tone: item.severity === "critical" ? "red" : "amber",
      };
    }

    if (item.targetView === "roi") {
      return {
        stage: "Prove value",
        why: "Skills are harder to scale when the value story is missing.",
        result: "You will open Value & ROI to connect adoption, baseline, saved time, and impact.",
        tone: "blue",
      };
    }

    if (item.targetView === "reports") {
      return {
        stage: "Brief leaders",
        why: "Executives need the current decisions, blockers, proof, and value in one short update.",
        result: "You will generate or open a report from the latest workspace evidence.",
        tone: "blue",
      };
    }

    if (item.id === "workspace-healthy") {
      return {
        stage: "All clear",
        why: "No urgent approvals, blockers, or launch-proof gaps are currently waiting.",
        result: "You will return to Home and keep monitoring the operating loop.",
        tone: "green",
      };
    }

    return {
      stage: "Start here",
      why: "This is the most useful next workspace action from the current records.",
      result: "You will open the right surface and continue the operating loop.",
      tone: item.severity === "success" ? "green" : item.severity === "info" ? "blue" : item.severity === "critical" ? "red" : "amber",
    };
  }

  const primaryGuidance = primaryItem ? itemGuidance(primaryItem) : null;
  const laneCounts = items.reduce<Record<string, number>>((counts, item) => {
    const guidance = itemGuidance(item);
    return { ...counts, [guidance.stage]: (counts[guidance.stage] ?? 0) + 1 };
  }, {});
  const laneSummary = Object.entries(laneCounts).slice(0, 4);

  function inboxIcon(item: ActionInboxItem, size = 17) {
    if (item.severity === "success") return <Check size={size} />;
    if (item.severity === "info") return <Bell size={size} />;
    if (item.severity === "warning") return <Clock3 size={size} />;
    return <AlertTriangle size={size} />;
  }

  function closeInbox() {
    enableFocusRestore();
    onClose();
  }

  function openInboxItem(item: ActionInboxItem) {
    disableFocusRestore();
    onOpenItem(item);
  }

  function handleInboxKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (handleDialogKeyDown(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeInbox();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/20 p-2 backdrop-blur-md sm:items-start sm:justify-end sm:p-4" onMouseDown={closeInbox}>
      <section
        ref={dialogRef}
        id="action-inbox-dialog"
        className="ea-surface flex max-h-[calc(100dvh-1rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-lg sm:max-h-[calc(100dvh-2rem)]"
        data-testid="action-inbox-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleInboxKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-inbox-title"
        aria-describedby="action-inbox-description"
        tabIndex={-1}
      >
        <div className="shrink-0 border-b border-[var(--border)]/64 bg-[var(--surface)]/56 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone={openCount ? (criticalCount ? "red" : "amber") : "green"}>
                {openCount ? `${openCount} item${openCount === 1 ? "" : "s"} need${openCount === 1 ? "s" : ""} attention` : "all clear"}
              </Badge>
              <h2 id="action-inbox-title" className="mt-3 text-xl font-bold tracking-tight text-[var(--text)]">Action Inbox</h2>
              <p id="action-inbox-description" className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                Needs attention. Start with the first item. The rest can wait unless it blocks launch, trust, or proof.
              </p>
            </div>
            <button
              ref={initialFocusRef}
              type="button"
              onClick={closeInbox}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)]/74 bg-[var(--surface)]/76 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="ea-inbox-stat ea-inbox-tone-danger rounded-lg px-2.5 py-2 sm:px-3">
              <div className="ea-inbox-stat-count text-lg font-bold">{criticalCount}</div>
              <div className="ea-inbox-stat-label text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px]">do now</div>
            </div>
            <div className="ea-inbox-stat ea-inbox-tone-warning rounded-lg px-2.5 py-2 sm:px-3">
              <div className="ea-inbox-stat-count text-lg font-bold">{warningCount}</div>
              <div className="ea-inbox-stat-label text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px]">decide</div>
            </div>
            <div className="ea-inbox-stat ea-inbox-tone-info rounded-lg px-2.5 py-2 sm:px-3">
              <div className="ea-inbox-stat-count text-lg font-bold">{suggestionCount}</div>
              <div className="ea-inbox-stat-label text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px]">suggested</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="action-inbox-lanes">
            {laneSummary.map(([stage, count]) => (
              <span key={stage} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)]/72 px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)]/70">
                {stage}
                <span className="text-[var(--text-soft)]">{count}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]/30 p-3 sm:p-4">
          {primaryItem && primaryMeta && primaryGuidance ? (
            <button
              type="button"
              onClick={() => openInboxItem(primaryItem)}
              className={`ea-inbox-panel group w-full rounded-lg p-3 text-left transition hover:border-[var(--primary)]/45 hover:bg-[var(--surface)] sm:p-4 ${primaryMeta.toneClass}`}
              data-testid="action-inbox-primary"
            >
              <div className="flex items-start gap-3">
                <span className={`ea-inbox-icon mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex ${primaryMeta.toneClass}`}>
                  {inboxIcon(primaryItem, 18)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={primaryMeta.tone}>{primaryMeta.label}</Badge>
                    <Badge tone={primaryGuidance.tone}>{primaryGuidance.stage}</Badge>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Do first</span>
                  </span>
                  <span className="mt-2 block text-base font-semibold tracking-tight text-[var(--text)] sm:text-lg">
                    {primaryItem.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[var(--text-muted)]">{primaryItem.body}</span>
                  <span className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                    <span className="rounded-full bg-[var(--surface)]/80 px-2.5 py-1 ring-1 ring-[var(--border)]/70">{primaryItem.source}</span>
                    {primaryItem.count ? <span className="rounded-full bg-[var(--surface)]/80 px-2.5 py-1 ring-1 ring-[var(--border)]/70">{primaryItem.count} related</span> : null}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition group-hover:bg-[var(--primary-hover)]">
                    {primaryItem.actionLabel}
                    <ChevronRight size={15} />
                  </span>
                  <span className="mt-4 hidden gap-2 rounded-lg bg-[var(--surface)]/72 p-3 ring-1 ring-[var(--border)]/40 sm:grid sm:grid-cols-2">
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Why this matters</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{primaryGuidance.why}</span>
                    </span>
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">After you click</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{primaryGuidance.result}</span>
                    </span>
                  </span>
                </span>
              </div>
            </button>
          ) : null}

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                {remainingItems.length ? "Other items" : "No other items"}
              </div>
              <div className="text-xs font-medium text-[var(--text-soft)]">{items.length} total</div>
            </div>
            <div className="space-y-2">
              {remainingItems.length ? (
                remainingItems.map((item) => {
                  const meta = severityMeta[item.severity];
                  const guidance = itemGuidance(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openInboxItem(item)}
                      className="group flex w-full items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/66 p-3 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--surface)]"
                    >
                      <span className={`ea-inbox-icon mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.toneClass}`}>
                        {inboxIcon(item)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[var(--text)]">{item.title}</span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <Badge tone={guidance.tone}>{guidance.stage}</Badge>
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-[var(--text-muted)]">{item.body}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{guidance.result}</span>
                        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                          <span>{item.source}</span>
                          {item.count ? <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5">{item.count} related</span> : null}
                        </span>
                      </span>
                      <span className="mt-1 flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-xs font-semibold text-[var(--text-muted)] group-hover:bg-[var(--primary-soft)] group-hover:text-[var(--primary)]">
                        {item.actionLabel}
                        <ChevronRight size={13} />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/80 p-4 text-sm leading-6 text-[var(--text-muted)]">
                  The highest-priority item above is the only thing waiting right now.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-[var(--border)]/64 bg-[var(--surface)]/58 px-4 py-2 text-[11px] leading-4 text-[var(--text-muted)] sm:px-5 sm:py-3 sm:text-xs sm:leading-5">
          <span className="sm:hidden">Workspace records only.</span>
          <span className="hidden sm:inline">Derived from workspace records only. No raw private messages or individual productivity scoring.</span>
        </div>
      </section>
    </div>
  );
}
