"use client";

import type React from "react";
import { useState } from "react";
import {
  Bot,
  Boxes,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDollarSign,
  HelpCircle,
  Home as HomeIcon,
  Rocket,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { Badge, Button, IconButton } from "@/components/ui";
import { navItems } from "@/lib/ui/constants";
import { getCurrentPageGuide, initialHelpActionId } from "@/lib/ui/page-guides";
import type { View } from "@/lib/ui/types";

type HelpAction = {
  id: string;
  label: string;
  helper: string;
  bestFor: string;
  outcome: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  checklist: string[];
  primary: { label: string; action: () => void };
  secondary?: { label: string; action: () => void };
};

export function HelpWalkthroughModal({
  activeView,
  onClose,
  onOpenSetup,
  onOpenView,
}: {
  activeView: View;
  onClose: () => void;
  onOpenSetup: () => void;
  onOpenView: (view: View) => void;
}) {
  const helpActions: HelpAction[] = [
    {
      id: "setup",
      label: "Set up the workspace",
      helper: "Name the company, pick first teams, and choose safe access.",
      bestFor: "New workspace",
      outcome: "A working Home view with first opportunities, proof records, and a launch brief.",
      icon: Sparkles,
      checklist: ["Company and workspace labels", "First teams to evaluate", "Safe access boundaries", "Initial launch records"],
      primary: { label: "Start guided setup", action: onOpenSetup },
      secondary: { label: "Open Home", action: () => onOpenView("command") },
    },
    {
      id: "next",
      label: "Know what to do next",
      helper: "Use Home and the AI Assistant when you are not sure where to go.",
      bestFor: "Daily work",
      outcome: "A short next-action path instead of a dashboard scavenger hunt.",
      icon: HomeIcon,
      checklist: ["Current next action", "Blocked reviews", "Launch warnings", "Executive-ready updates"],
      primary: { label: "Open Home", action: () => onOpenView("command") },
      secondary: { label: "Ask AI Assistant", action: () => onOpenView("orchestrator") },
    },
    {
      id: "find",
      label: "Find useful AI work",
      helper: "Turn team pain points into clear, scored AI opportunities.",
      bestFor: "Planning",
      outcome: "A prioritized use case with owner, value, risk, and the process it should improve.",
      icon: Boxes,
      checklist: ["Capture the business pain", "Score value and feasibility", "Classify risk", "Choose the first AI opportunity"],
      primary: { label: "Open Use Cases", action: () => onOpenView("factory") },
      secondary: { label: "Open Work Signals", action: () => onOpenView("work") },
    },
    {
      id: "build",
      label: "Build a safe AI Skill",
      helper: "Convert an approved opportunity into a reusable AI capability.",
      bestFor: "Builders",
      outcome: "A Skill with prompt, model, knowledge, tools, workflow, tests, and version history.",
      icon: BrainCircuit,
      checklist: ["Define the prompt and model", "Attach approved knowledge", "Choose tools and approvals", "Run tests before launch"],
      primary: { label: "Open AI Skills", action: () => onOpenView("skills") },
      secondary: { label: "Open Workflow Builder", action: () => onOpenView("workflow") },
    },
    {
      id: "trust",
      label: "Review risk and proof",
      helper: "Use reviews, evals, traces, and approvals to prove the AI is safe enough to launch.",
      bestFor: "Governance",
      outcome: "A reviewable packet for Legal, Security, Privacy, business owners, and auditors.",
      icon: ShieldCheck,
      checklist: ["Run quality checks", "Review risk and controls", "Approve or request changes", "Store proof in the ledger"],
      primary: { label: "Open Risk Review", action: () => onOpenView("governance") },
      secondary: { label: "Open Proof Ledger", action: () => onOpenView("evidence") },
    },
    {
      id: "scale",
      label: "Share results",
      helper: "Turn adoption, value, proof, and risk posture into a report leaders can use.",
      bestFor: "Leadership",
      outcome: "A clear story of what launched, what changed, what value appeared, and what needs attention.",
      icon: CircleDollarSign,
      checklist: ["Measure adoption and hours saved", "Track risk status", "Generate the leadership brief", "Scale what works"],
      primary: { label: "Open Reports", action: () => onOpenView("reports") },
      secondary: { label: "Open Value & ROI", action: () => onOpenView("roi") },
    },
  ];

  const simplePath: {
    label: string;
    helper: string;
    actionLabel: string;
    action: () => void;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    {
      label: "Start",
      helper: "Set up the workspace or open Home.",
      actionLabel: "Setup",
      action: onOpenSetup,
      icon: Sparkles,
    },
    {
      label: "Find",
      helper: "Choose the first useful AI opportunity.",
      actionLabel: "Use cases",
      action: () => onOpenView("factory"),
      icon: Boxes,
    },
    {
      label: "Build",
      helper: "Create the Skill and test it.",
      actionLabel: "Skills",
      action: () => onOpenView("skills"),
      icon: BrainCircuit,
    },
    {
      label: "Prove",
      helper: "Review risk, collect evidence, and report value.",
      actionLabel: "Proof",
      action: () => onOpenView("evidence"),
      icon: ShieldCheck,
    },
  ];

  const glossary = [
    ["AI Skill", "A reusable AI capability with prompt, model, knowledge, tools, approvals, tests, and history."],
    ["Proof Ledger", "The audit trail of runs, evals, reviews, approvals, and evidence used to justify launch."],
    ["Work Signals", "Privacy-safe patterns from business work that help find where AI can help."],
  ];

  const activeNavItem = navItems.find((item) => item.id === activeView);
  const activeGuide = getCurrentPageGuide(activeView);
  const [selectedId, setSelectedId] = useState(initialHelpActionId(activeView));
  const selectedAction = helpActions.find((action) => action.id === selectedId) ?? helpActions[0];
  const SelectedIcon = selectedAction.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5 lg:flex lg:items-center lg:justify-center">
      <div
        aria-modal="true"
        className="mx-auto my-3 grid w-[min(95vw,1220px)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.22)] lg:my-0 lg:max-h-[92vh] lg:grid-cols-[360px_minmax(0,1fr)]"
        data-testid="help-walkthrough"
        role="dialog"
      >
        <aside className="border-b border-slate-200 bg-slate-50/88 p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge tone="blue">help center</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">What are you trying to do?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pick a goal. The app will take you to the right place.
              </p>
            </div>
            <IconButton label="Close help" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>

          <div className="mt-5 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-soft)]/45 p-4 lg:hidden" data-testid="help-mobile-current-page-guide">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">You are here</Badge>
              <Badge tone="slate">{activeGuide.stage}</Badge>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-950">{activeNavItem?.label ?? "Current page"}</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">{activeGuide.plainUse}</p>
            <Button className="mt-3 w-full whitespace-nowrap" onClick={() => onOpenView(activeGuide.nextView)}>
              {activeGuide.nextLabel}
              <ChevronRight size={15} />
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            {helpActions.map((action) => {
              const ActionIcon = action.icon;
              const active = action.id === selectedAction.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                    active
                      ? "border-[var(--primary)] bg-white shadow-[0_12px_30px_rgba(99,91,255,0.1)]"
                      : "border-slate-200/70 bg-white/70 hover:border-slate-300 hover:bg-white"
                  }`}
                  onClick={() => setSelectedId(action.id)}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <ActionIcon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-950">{action.label}</span>
                      <ChevronRight
                        size={15}
                        className={`mt-0.5 shrink-0 ${active ? "text-[var(--primary)]" : "text-slate-300"}`}
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{action.helper}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col lg:max-h-[92vh]">
          <header className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <SelectedIcon size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{selectedAction.bestFor}</Badge>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">recommended path</span>
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{selectedAction.label}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedAction.helper}</p>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 sm:p-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-soft)]/45 p-5" data-testid="help-current-page-guide">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="blue">You are here</Badge>
                        <Badge tone="slate">{activeGuide.stage}</Badge>
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-slate-950">
                        {activeNavItem?.label ?? "Current page"}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{activeGuide.plainUse}</p>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Watch for: {activeGuide.watchFor}
                      </p>
                    </div>
                    <Button className="shrink-0 whitespace-nowrap" onClick={() => onOpenView(activeGuide.nextView)}>
                      {activeGuide.nextLabel}
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Result</div>
                  <p className="mt-2 text-base leading-7 text-slate-800">{selectedAction.outcome}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={selectedAction.primary.action}>
                      {selectedAction.primary.label}
                      <ChevronRight size={16} />
                    </Button>
                    {selectedAction.secondary ? (
                      <Button variant="secondary" onClick={selectedAction.secondary.action}>
                        {selectedAction.secondary.label}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={17} className="text-[var(--primary)]" />
                    <div className="text-sm font-semibold text-slate-950">The simple path</div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {simplePath.map((step, index) => {
                      const StepIcon = step.icon;

                      return (
                        <button
                          key={step.label}
                          type="button"
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)]/45"
                          onClick={step.action}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[var(--primary)] ring-1 ring-slate-200">
                              <StepIcon size={16} />
                            </span>
                            <span className="text-xs font-bold text-slate-400">{index + 1}</span>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-slate-950">{step.label}</div>
                          <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{step.helper}</p>
                          <div className="mt-3 text-xs font-semibold text-[var(--primary)]">{step.actionLabel}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-950">Plain-English glossary</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {glossary.map(([term, definition]) => (
                      <div key={term} className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
                        <div className="text-sm font-semibold text-slate-950">{term}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-950">What you will do</div>
                  <div className="mt-4 space-y-3">
                    {selectedAction.checklist.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
                          <Check size={12} />
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-soft)]/45 p-5">
                  <Bot className="text-[var(--primary)]" size={22} />
                  <div className="mt-3 text-sm font-semibold text-slate-950">Still not sure?</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ask the AI Assistant: “What should I do next?” It can inspect the workspace and route you.
                  </p>
                  <Button className="mt-4 w-full" onClick={() => onOpenView("orchestrator")}>
                    Ask AI Assistant
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
                  <Rocket size={20} className="text-indigo-200" />
                  <div className="mt-3 text-sm font-semibold">First 10 minutes</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Run setup, open Home, ask the assistant for priorities, then open the top use case.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
