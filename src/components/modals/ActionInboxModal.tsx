"use client";

import { useEffect } from "react";
import { AlertTriangle, Bell, Check, ChevronRight, Clock3, X } from "lucide-react";

import { Badge } from "@/components/ui";
import type { ActionInboxItem, ActionInboxSeverity } from "@/lib/action-inbox";

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
  const severityMeta: Record<
    ActionInboxSeverity,
    {
      label: string;
      tone: "green" | "blue" | "amber" | "red";
      iconClass: string;
      panelClass: string;
    }
  > = {
    critical: {
      label: "Do now",
      tone: "red",
      iconClass: "bg-red-50 text-red-700 ring-red-100",
      panelClass: "border-red-200 bg-red-50/75",
    },
    warning: {
      label: "Needs decision",
      tone: "amber",
      iconClass: "bg-amber-50 text-amber-700 ring-amber-100",
      panelClass: "border-amber-200 bg-amber-50/75",
    },
    info: {
      label: "Suggested",
      tone: "blue",
      iconClass: "bg-sky-50 text-sky-700 ring-sky-100",
      panelClass: "border-sky-200 bg-sky-50/75",
    },
    success: {
      label: "Healthy",
      tone: "green",
      iconClass: "bg-green-50 text-green-700 ring-green-100",
      panelClass: "border-green-200 bg-green-50/75",
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
    if (item.id === "pending-tool-requests" || item.targetView === "broker") {
      return {
        stage: "Approve action",
        why: "A Skill is asking to use a company tool. This needs a human yes/no decision before the run can move.",
        result: "You will land on Tool Permissions with the requested action ready to review.",
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/20 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        aria-labelledby="action-inbox-title"
      >
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone={openCount ? (criticalCount ? "red" : "amber") : "green"}>
                {openCount ? `${openCount} item${openCount === 1 ? "" : "s"} need${openCount === 1 ? "s" : ""} attention` : "all clear"}
              </Badge>
              <h2 id="action-inbox-title" className="mt-3 text-xl font-bold tracking-tight text-slate-950">Needs attention</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start with the first item. The rest can wait unless it blocks launch, trust, or proof.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <div className="text-lg font-bold text-red-700">{criticalCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-red-500">do now</div>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <div className="text-lg font-bold text-amber-700">{warningCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-500">decide</div>
            </div>
            <div className="rounded-lg bg-sky-50 px-3 py-2">
              <div className="text-lg font-bold text-sky-700">{suggestionCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-500">suggested</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="action-inbox-lanes">
            {laneSummary.map(([stage, count]) => (
              <span key={stage} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {stage}
                <span className="text-slate-400">{count}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {primaryItem && primaryMeta && primaryGuidance ? (
            <button
              type="button"
              onClick={() => onOpenItem(primaryItem)}
              className={`group w-full rounded-lg border p-4 text-left transition hover:border-[var(--primary)]/45 hover:bg-white ${primaryMeta.panelClass}`}
              data-testid="action-inbox-primary"
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${primaryMeta.iconClass}`}>
                  {inboxIcon(primaryItem, 18)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={primaryMeta.tone}>{primaryMeta.label}</Badge>
                    <Badge tone={primaryGuidance.tone}>{primaryGuidance.stage}</Badge>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Do first</span>
                  </span>
                  <span className="mt-2 block text-lg font-semibold tracking-tight text-slate-950">
                    {primaryItem.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-700">{primaryItem.body}</span>
                  <span className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-slate-200/70">{primaryItem.source}</span>
                    {primaryItem.count ? <span className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-slate-200/70">{primaryItem.count} related</span> : null}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition group-hover:bg-[var(--primary-hover)]">
                    {primaryItem.actionLabel}
                    <ChevronRight size={15} />
                  </span>
                  <span className="mt-4 grid gap-2 rounded-lg bg-white/72 p-3 ring-1 ring-white/70 sm:grid-cols-2">
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Why this matters</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{primaryGuidance.why}</span>
                    </span>
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">After you click</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{primaryGuidance.result}</span>
                    </span>
                  </span>
                </span>
              </div>
            </button>
          ) : null}

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {remainingItems.length ? "Other items" : "No other items"}
              </div>
              <div className="text-xs font-medium text-slate-400">{items.length} total</div>
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
                      onClick={() => onOpenItem(item)}
                      className="group flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--primary)]/35 hover:bg-slate-50"
                    >
                      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.iconClass}`}>
                        {inboxIcon(item)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">{item.title}</span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <Badge tone={guidance.tone}>{guidance.stage}</Badge>
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-slate-600">{item.body}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{guidance.result}</span>
                        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                          <span>{item.source}</span>
                          {item.count ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{item.count} related</span> : null}
                        </span>
                      </span>
                      <span className="mt-1 flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 group-hover:bg-[var(--primary-soft)] group-hover:text-[var(--primary)]">
                        {item.actionLabel}
                        <ChevronRight size={13} />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-500">
                  The highest-priority item above is the only thing waiting right now.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-500">
          Derived from workspace records only. No raw private messages or individual productivity scoring.
        </div>
      </section>
    </div>
  );
}
