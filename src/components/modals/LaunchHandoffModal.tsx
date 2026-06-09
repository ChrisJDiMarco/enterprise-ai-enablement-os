"use client";

import type { KeyboardEvent } from "react";
import { AlertTriangle, Bot, Check, ChevronDown, ChevronRight, Clock3, Flag, Rocket, X } from "lucide-react";

import { Badge, Button, IconButton } from "@/components/ui";
import type { LaunchHandoff, LaunchHandoffStep } from "@/lib/launch-handoff";
import { useDialogFocus } from "@/lib/ui/dialog-focus";

export function LaunchHandoffModal({
  handoff,
  onClose,
  onOpenStep,
  onOpenOrchestrator,
}: {
  handoff: LaunchHandoff;
  onClose: () => void;
  onOpenStep: (step: LaunchHandoffStep) => void;
  onOpenOrchestrator: () => void;
}) {
  const { dialogRef, enableFocusRestore, disableFocusRestore, handleDialogKeyDown } =
    useDialogFocus<HTMLElement, HTMLElement>();
  const statusMeta: Record<LaunchHandoffStep["status"], { label: string; tone: "green" | "blue" | "red"; iconClass: string }> = {
    done: { label: "Done", tone: "green", iconClass: "bg-green-50 text-green-700" },
    ready: { label: "Next", tone: "blue", iconClass: "bg-[var(--primary-soft)] text-[var(--primary)]" },
    blocked: { label: "Blocked", tone: "red", iconClass: "bg-red-50 text-red-700" },
  };
  const next = handoff.nextStep;
  const openSteps = handoff.steps.filter((step) => step.status !== "done");
  const firstOperatingBlock = openSteps.length ? openSteps.slice(0, 3) : handoff.steps.slice(-2);
  const doneCount = handoff.steps.filter((step) => step.status === "done").length;
  const blockedCount = handoff.steps.filter((step) => step.status === "blocked").length;
  const readyCount = handoff.steps.filter((step) => step.status === "ready").length;
  const totalMinutes = firstOperatingBlock.reduce((total, step) => total + step.minutes, 0);
  const readiness =
    handoff.score >= 85
      ? { label: "Pilot ready", tone: "green" as const, helper: "The launch packet is nearly complete." }
      : handoff.score >= 45
        ? { label: "Proof needed", tone: "blue" as const, helper: "A few evidence steps will make this launchable." }
        : handoff.generated
          ? { label: "Start here", tone: "blue" as const, helper: "Follow the first action to build the proof packet." }
          : { label: "Setup needed", tone: "red" as const, helper: "Start with the first opportunity and governed Skill." };
  const phases = [
    {
      title: "Choose the pilot",
      helper: "Confirm the business problem and the first Skill before teams get invited.",
      stepIds: ["inspect-portfolio", "review-skill-package"],
    },
    {
      title: "Prove it is safe",
      helper: "Create the evidence reviewers need: evals, governance, workflow, and trace.",
      stepIds: ["run-launch-eval", "resolve-governance", "validate-workflow", "run-harness-trace"],
    },
    {
      title: "Share the plan",
      helper: "Turn the evidence into a short executive brief and pilot decision.",
      stepIds: ["brief-executives"],
    },
  ].map((phase) => ({
    ...phase,
    steps: phase.stepIds
      .map((id) => handoff.steps.find((step) => step.id === id))
      .filter((step): step is LaunchHandoffStep => Boolean(step)),
  }));
  const launchCommandPacket = [
    {
      label: "Portfolio signal",
      detail: handoff.steps.find((step) => step.id === "inspect-portfolio")?.evidence ?? "Opportunity funnel",
      ready: handoff.steps.find((step) => step.id === "inspect-portfolio")?.status === "done",
    },
    {
      label: "Governed Skill",
      detail: handoff.steps.find((step) => step.id === "review-skill-package")?.evidence ?? "Skill package",
      ready: handoff.steps.find((step) => step.id === "review-skill-package")?.status === "done",
    },
    {
      label: "Runtime proof",
      detail: handoff.steps.find((step) => step.id === "run-harness-trace")?.evidence ?? "Harness trace",
      ready: handoff.steps.find((step) => step.id === "run-harness-trace")?.status === "done",
    },
    {
      label: "Executive narrative",
      detail: handoff.steps.find((step) => step.id === "brief-executives")?.evidence ?? "Launch brief",
      ready: handoff.steps.find((step) => step.id === "brief-executives")?.status === "done",
    },
  ];

  function closeHandoff() {
    enableFocusRestore();
    onClose();
  }

  function openHandoffStep(step: LaunchHandoffStep) {
    disableFocusRestore();
    onOpenStep(step);
  }

  function openOrchestrator() {
    disableFocusRestore();
    onOpenOrchestrator();
  }

  function handleHandoffKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (handleDialogKeyDown(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeHandoff();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/24 p-4 backdrop-blur-md" onMouseDown={closeHandoff}>
      <section
        ref={dialogRef}
        aria-labelledby="launch-handoff-title"
        aria-describedby="launch-handoff-description"
        aria-modal="true"
        className="ea-surface grid max-h-[92vh] w-[min(94vw,1120px)] overflow-hidden rounded-lg xl:grid-cols-[minmax(0,1fr)_320px]"
        data-testid="launch-handoff"
        onKeyDown={handleHandoffKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex max-h-[92vh] min-h-0 flex-col">
          <div className="border-b border-slate-200/64 bg-white/56 px-6 py-5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Badge tone={readiness.tone}>{readiness.label}</Badge>
                <h2 id="launch-handoff-title" className="mt-3 text-[24px] font-semibold tracking-[-0.01em] text-slate-950">
                  Launch this workspace without guessing
                </h2>
                <p id="launch-handoff-description" className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {handoff.summary} {readiness.helper}
                </p>
              </div>
              <IconButton label="Close launch handoff" onClick={closeHandoff}>
                <X size={16} />
              </IconButton>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--primary)]/16 bg-[var(--primary-soft)]/42 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                    <Rocket size={14} />
                    Do this next
                  </div>
                  <div className="mt-2 text-lg font-bold tracking-[-0.01em] text-slate-950">{next.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{next.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/72 px-2.5 py-1 text-slate-700">
                      <Clock3 size={13} />
                      {next.minutes} min
                    </span>
                    <span className="min-w-0 truncate rounded-full bg-white/72 px-2.5 py-1">{next.evidence}</span>
                  </div>
                </div>
                <Button className="w-full shrink-0 lg:w-auto" onClick={() => openHandoffStep(next)}>
                  {next.actionLabel}
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/30 px-6 py-5">
            <div className="space-y-5">
              {phases.map((phase, phaseIndex) => {
                const completed = phase.steps.filter((step) => step.status === "done").length;

                return (
                  <section key={phase.title} className="rounded-xl border border-slate-200/58 bg-white/74 p-4 shadow-[0_1px_0_rgba(15,23,42,0.014)]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                            {phaseIndex + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-slate-950">{phase.title}</h3>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{phase.helper}</p>
                      </div>
                      <Badge tone={completed === phase.steps.length ? "green" : "slate"}>
                        {completed}/{phase.steps.length} done
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {phase.steps.map((item, index) => {
                        const meta = statusMeta[item.status];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="group flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition hover:border-[var(--primary)]/16 hover:bg-[var(--primary-soft)]/34 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                            onClick={() => openHandoffStep(item)}
                          >
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
                              {item.status === "done" ? <Check size={15} /> : item.status === "blocked" ? <AlertTriangle size={15} /> : index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-950">{item.title}</span>
                                <Badge tone={meta.tone}>{meta.label}</Badge>
                              </span>
                              <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</span>
                              <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-600">{item.minutes} min</span>
                                <span className="hidden text-slate-300 sm:inline">/</span>
                                <span className="min-w-0 truncate">{item.evidence}</span>
                              </span>
                            </span>
                            <ChevronRight className="mt-1 text-slate-300 group-hover:text-[var(--primary)]" size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <details className="group mt-5 rounded-xl border border-slate-200/58 bg-white/74 p-4 shadow-[0_1px_0_rgba(15,23,42,0.014)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-950">
                <span className="flex items-center gap-2">
                  <Flag size={16} className="text-[var(--primary)]" />
                  Reviewer proof packet
                </span>
                <ChevronDown className="text-slate-400 transition group-open:rotate-180" size={16} />
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Keep this tucked away until a sponsor, security reviewer, or team lead asks what has been proven.
              </p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {launchCommandPacket.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-lg bg-slate-50/74 px-3 py-2.5">
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                        item.ready ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {item.ready ? <Check size={13} /> : <ChevronRight size={13} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{item.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        <aside className="max-h-[92vh] overflow-y-auto border-t border-slate-200/52 bg-white/50 p-5 xl:border-l xl:border-t-0">
          <div>
            <div className="text-sm font-semibold text-slate-950">{handoff.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">A plain-language rollout guide for the first pilot.</div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Launch packet</div>
              <div className="mt-1 text-3xl font-bold tracking-[-0.02em] text-slate-950">{handoff.score}%</div>
            </div>
            <Badge tone={readiness.tone}>{readiness.label}</Badge>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${handoff.score}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: "Done", value: doneCount, tone: "text-green-700 bg-green-50" },
              { label: "Ready", value: readyCount, tone: "text-sky-700 bg-sky-50" },
              { label: "Blocked", value: blockedCount, tone: "text-red-700 bg-red-50" },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg px-3 py-2.5 ${item.tone}`}>
                <div className="text-lg font-bold leading-none">{item.value}</div>
                <div className="mt-1 text-[11px] font-semibold">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200/58 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">First work session</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">Do these in order. Nothing here is filler.</div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                <Clock3 size={12} />
                {totalMinutes} min
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {firstOperatingBlock.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition hover:bg-[var(--primary-soft)]/62 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => openHandoffStep(item)}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">{item.actionLabel}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{item.evidence}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <Button onClick={() => openHandoffStep(next)}>
              {next.actionLabel}
              <ChevronRight size={16} />
            </Button>
            <Button variant="secondary" onClick={openOrchestrator}>
              <Bot size={16} />
              Ask AI Assistant
            </Button>
            <Button variant="ghost" onClick={closeHandoff}>
              Back to Command Center
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}
