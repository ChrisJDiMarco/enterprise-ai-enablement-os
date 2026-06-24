"use client";

import { useState, type KeyboardEvent } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Database,
  KeyRound,
  Network,
  Rocket,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { Badge, Button, Field, Panel, SectionTitle } from "@/components/ui";
import type { Department } from "@/lib/enterprise-ai-data";
import { DEFAULT_TENANT_SETTINGS } from "@/lib/ui/constants";
import { useDialogFocus } from "@/lib/ui/dialog-focus";
import type { OnboardingDraft, OnboardingPermissionId } from "@/lib/ui/types";
import type { OrganizationSettings } from "@/lib/workspace-schema";

export function OnboardingWizard({
  organization,
  onClose,
  onComplete,
}: {
  organization: OrganizationSettings;
  onClose: () => void;
  onComplete: (draft: OnboardingDraft) => void;
}) {
  const [step, setStep] = useState(0);
  const {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  } = useDialogFocus<HTMLDivElement, HTMLButtonElement>();
  const initialDraft: OnboardingDraft = {
    companyName: organization.name === DEFAULT_TENANT_SETTINGS.name ? "" : organization.name,
    workspaceLabel: organization.workspaceLabel || "AI Enablement OS",
    setupMode: "pilot",
    functions: ["HR", "Finance", "Legal"],
    permissions: ["identity", "knowledge", "workSignals", "governance"],
  };
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  // Dirty once the operator advances a step or edits any field, so an accidental
  // backdrop/Escape dismiss can't silently throw away an in-progress setup.
  const isDirty = step > 0 || JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const steps = ["Company", "First teams", "Safe access", "Review"];
  const setupPresets: {
    id: OnboardingDraft["setupMode"];
    label: string;
    helper: string;
    badge: string;
    functions: Department[];
    permissions: OnboardingPermissionId[];
  }[] = [
    {
      id: "pilot",
      label: "Start with a pilot",
      helper: "Best when you want a real workspace quickly with tight access and useful launch records.",
      badge: "Recommended",
      functions: ["HR", "Finance", "Legal"],
      permissions: ["identity", "knowledge", "workSignals", "governance"],
    },
    {
      id: "real",
      label: "Prepare production",
      helper: "Best when SSO, approvals, and more departments need to be ready from day one.",
      badge: "Advanced",
      functions: ["HR", "Finance", "Legal", "Procurement", "IT", "Operations"],
      permissions: ["identity", "knowledge", "workSignals", "tickets", "calendar", "governance"],
    },
    {
      id: "demo",
      label: "Executive demo",
      helper: "Best for a conservative buyer or leadership review without broad access.",
      badge: "Demo",
      functions: ["HR", "Finance", "Legal"],
      permissions: ["identity", "knowledge", "governance"],
    },
  ];

  const functionOptions: {
    id: Department;
    label: string;
    helper: string;
  }[] = [
    { id: "HR", label: "HR", helper: "Employee questions, policies, case volume" },
    { id: "Finance", label: "Finance", helper: "Close work, reporting, control checks" },
    { id: "Legal", label: "Legal", helper: "Intake, triage, contract review" },
    { id: "Procurement", label: "Procurement", helper: "Suppliers, sourcing, RFP comparison" },
    { id: "IT", label: "IT", helper: "Tickets, service desk, knowledge answers" },
    { id: "Operations", label: "Operations", helper: "Exceptions, handoffs, repeatable work" },
    { id: "Marketing", label: "Marketing", helper: "Briefs, campaigns, approved drafts" },
    { id: "Compliance", label: "Compliance", helper: "Controls, evidence, review readiness" },
  ];

  const permissionOptions: {
    id: OnboardingPermissionId;
    title: string;
    body: string;
    badge: string;
    recommended?: boolean;
  }[] = [
    {
      id: "identity",
      title: "People, teams, and roles",
      body: "Read groups and reviewer roles so every action follows the right permissions.",
      badge: "Required",
      recommended: true,
    },
    {
      id: "knowledge",
      title: "Approved company knowledge",
      body: "Index only approved repositories with source owners and data labels.",
      badge: "Required",
      recommended: true,
    },
    {
      id: "workSignals",
      title: "Work patterns, not private messages",
      body: "Use ticket categories, delays, and feedback patterns without storing raw private messages.",
      badge: "Privacy-safe",
      recommended: true,
    },
    {
      id: "tickets",
      title: "Ticket and case metadata",
      body: "Read status, category, timestamps, and queues to find repeatable pain points.",
      badge: "Read-only",
    },
    {
      id: "calendar",
      title: "Calendar availability metadata",
      body: "Support office hours, review scheduling, and stakeholder follow-up planning.",
      badge: "Optional",
    },
    {
      id: "governance",
      title: "Risk and approval controls",
      body: "Map use cases, Skills, tests, and approvals to the control frameworks your company uses.",
      badge: "Recommended",
      recommended: true,
    },
    {
      id: "desktopBridge",
      title: "Optional desktop helper",
      body: "Observe approved business-app metadata for workflow discovery. Off unless explicitly approved.",
      badge: "Advanced",
    },
  ];

  const selectedPermissionTitles = permissionOptions.filter((item) => draft.permissions.includes(item.id));
  const setupReadiness = Math.round(
    ([
      Boolean(draft.companyName.trim()),
      Boolean(draft.workspaceLabel.trim()),
      draft.functions.length > 0,
      draft.permissions.includes("identity"),
      draft.permissions.includes("knowledge"),
      draft.permissions.includes("governance"),
    ].filter(Boolean).length /
      6) *
      100,
  );
  const launchArtifacts = [
    `${draft.functions.length || 3} first AI opportunities`,
    "1 governed AI Skill",
    "1 workflow map",
    "1 risk review packet",
    "1 quality check",
    "1 leadership brief",
  ];
  const launchRecipe = [
    {
      label: "Choose the pilot",
      helper: `${draft.functions[0] ?? "HR"} becomes the first safe lane unless you choose another team.`,
      actionLabel: "Pick teams",
      targetStep: 1,
      icon: Building2,
      ready: draft.functions.length > 0,
    },
    {
      label: "Set safe access",
      helper: "Use identity, approved knowledge, work signals, and governance before any real tool action.",
      actionLabel: "Choose access",
      targetStep: 2,
      icon: ShieldCheck,
      ready: draft.permissions.includes("identity") && draft.permissions.includes("knowledge"),
    },
    {
      label: "Create the proof path",
      helper: "Generate the first use case, Skill, workflow, eval, risk review, ledger record, and brief.",
      actionLabel: "Review output",
      targetStep: 3,
      icon: Rocket,
      ready: setupReadiness >= 80,
    },
  ];
  const stepDetails = [
    {
      eyebrow: "Workspace name",
      title: "Name the AI workspace",
      helper:
        "Give it the company name and choose how bold this first launch should be.",
    },
    {
      eyebrow: "Where to begin",
      title: "Pick the first teams",
      helper:
        "Choose teams with painful, repeatable work. The app will turn them into the first AI opportunity list.",
    },
    {
      eyebrow: "Trust boundary",
      title: "Choose safe access",
      helper:
        "Start with the smallest useful set of read-only or approval-gated access.",
    },
    {
      eyebrow: "Create workspace",
      title: "Review and create",
      helper:
        "Confirm what will be generated. You can edit every record after setup.",
    },
  ];
  const sideSignals = [
    ["Mode", draft.setupMode === "real" ? "Production" : draft.setupMode === "demo" ? "Evaluation" : "Pilot"],
    ["Teams", String(draft.functions.length || 3)],
    ["Access", String(draft.permissions.length || 3)],
  ];
  const trustControls = [
    "No raw private message storage",
    "No individual productivity scoring",
    "Approval required for write actions",
    "Audit trail from day one",
  ];
  const footerHints = [
    {
      label: "Next: pick first teams",
      helper: "Choose where AI should help first.",
    },
    {
      label: "Next: choose safe access",
      helper: "Select the metadata and controls this workspace can use.",
    },
    {
      label: "Next: review workspace",
      helper: "See the records that will be created before launch.",
    },
    {
      label: "Ready to create",
      helper: "Open Home with the first launch path already prepared.",
    },
  ];
  const selectedPreset = setupPresets.find(
    (preset) =>
      preset.id === draft.setupMode &&
      preset.functions.every((item) => draft.functions.includes(item)),
  );
  const currentStepDetail = stepDetails[step];
  const footerHint = footerHints[step] ?? footerHints.at(-1);
  const StepIcon = [Building2, Network, KeyRound, Rocket][step] ?? Building2;
  const modeLabel = draft.setupMode === "real" ? "Production" : draft.setupMode === "demo" ? "Evaluation" : "Pilot";

  function applySetupPreset(preset: (typeof setupPresets)[number]) {
    setDraft((current) => ({
      ...current,
      setupMode: preset.id,
      functions: preset.functions,
      permissions: preset.permissions,
    }));
  }

  function toggleFunction(department: Department) {
    setDraft((current) => ({
      ...current,
      functions: current.functions.includes(department)
        ? current.functions.filter((item) => item !== department)
        : [...current.functions, department],
    }));
  }

  function togglePermission(permission: OnboardingPermissionId) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }

  function continueSetup() {
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    disableFocusRestore();
    onComplete({
      ...draft,
      companyName: draft.companyName.trim() || "Your Company",
      workspaceLabel: draft.workspaceLabel.trim() || "AI Enablement OS",
      functions: draft.functions.length ? draft.functions : ["HR", "Finance", "Legal"],
      permissions: draft.permissions.length ? draft.permissions : ["identity", "knowledge", "governance"],
    });
  }

  function closeSetup() {
    if (isDirty && typeof window !== "undefined" && !window.confirm("Finish setup later? Your in-progress answers won't be saved, but you can resume guided setup anytime from Help (\"Start guided setup\") or Settings.")) {
      return;
    }
    enableFocusRestore();
    onClose();
  }

  function handleSetupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDialogKeyDown(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSetup();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/24 p-3 backdrop-blur-md sm:p-5" onMouseDown={closeSetup}>
      <div
        ref={dialogRef}
        aria-labelledby="onboarding-wizard-title"
        aria-describedby="onboarding-wizard-description"
        aria-modal="true"
        className="ea-surface grid max-h-[92vh] w-[min(96vw,1460px)] overflow-hidden rounded-lg lg:grid-cols-[264px_minmax(0,1fr)] 2xl:grid-cols-[264px_minmax(0,1fr)_336px]"
        data-testid="onboarding-wizard"
        onKeyDown={handleSetupKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <aside className="hidden min-h-0 flex-col border-r border-[var(--border)]/64 bg-[var(--surface)]/50 lg:flex">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)]/64 bg-[var(--surface)]/40 p-4 backdrop-blur-xl">
            <div>
              <Badge tone="purple">first run</Badge>
              <h2 className="mt-2 text-lg font-semibold tracking-normal text-[var(--text)]">
                Set up your AI workspace
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                Create a usable company AI workspace in a few guided steps.
              </p>
            </div>
            <button
              aria-label="Close setup"
              ref={initialFocusRef}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              onClick={closeSetup}
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {steps.map((item, index) => {
                const active = index === step;
                const complete = index < step;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                      active
                        ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_16px_40px_rgba(15,23,42,0.08)] ring-1 ring-[var(--border)]/80"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface)]/78 hover:text-[var(--text)]"
                    }`}
                    onClick={() => setStep(index)}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        complete
                          ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]"
                          : active
                            ? "bg-[var(--primary)] text-[var(--primary-contrast)]"
                            : "bg-[var(--surface-subtle)] text-[var(--text-muted)] group-hover:bg-[var(--border)]/80"
                      }`}
                    >
                      {complete ? <Check size={14} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                        {stepDetails[index].eyebrow}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)]"
              data-testid="setup-live-preview"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Setup preview</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {draft.companyName.trim() || "Company pending"}
                  </div>
                </div>
                <div className="text-2xl font-bold tracking-tight text-[var(--text)]">{setupReadiness}%</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${setupReadiness}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {sideSignals.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                <ShieldCheck size={16} />
                Privacy stance
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--success)]">
                Approved metadata only. No raw private messages, individual scoring, or covert monitoring.
              </p>
            </div>
          </div>
        </aside>

        <section className={`flex max-h-[92vh] min-w-0 flex-col ${step === 3 ? "2xl:col-span-2" : ""}`}>
          <header className="border-b border-[var(--border)]/64 bg-[var(--surface)]/56 px-5 py-5 backdrop-blur-xl lg:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="hidden size-12 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/12 sm:flex">
                    <StepIcon size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                      {currentStepDetail.eyebrow} · step {step + 1} of {steps.length}
                    </div>
                    <h2 id="onboarding-wizard-title" className="mt-2 text-2xl font-semibold tracking-normal text-[var(--text)]">
                      {currentStepDetail.title}
                    </h2>
                    <p id="onboarding-wizard-description" className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                      {currentStepDetail.helper}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <div className="flex items-center justify-between gap-8 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                    <span>Readiness</span>
                    <span className="text-[var(--text)]">{setupReadiness}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border)] lg:w-56">
                    <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${setupReadiness}%` }} />
                  </div>
                </div>
              </div>
              <button
                aria-label="Close setup"
                ref={initialFocusRef}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] lg:hidden"
                onClick={closeSetup}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]/35 px-6 py-6 lg:px-8">
            {step === 0 ? (
              <div className="mx-auto max-w-6xl space-y-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_14px_42px_rgba(15,23,42,0.055)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Badge tone="purple">guided setup</Badge>
                      <h2 className="mt-2 text-base font-semibold tracking-normal text-[var(--text)]">
                        Start with a workspace people can use
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                        This creates the first opportunities, safe access choices, proof records, and a leadership brief.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Time", "10 min"],
                        ["Assets", "6"],
                        ["Mode", modeLabel],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                          <div className="mt-1 text-sm font-bold text-[var(--text)]">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-soft)]/40 p-4 shadow-[0_14px_42px_rgba(99,91,255,0.08)]" data-testid="onboarding-launch-recipe">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">First launch recipe</div>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text)]">
                        Set up the first AI pilot without guessing
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                        This setup creates a small operating loop: one useful workflow, one governed Skill, and proof leaders can review.
                      </p>
                    </div>
                    <Button className="shrink-0 whitespace-nowrap" onClick={() => applySetupPreset(setupPresets[0])}>
                      Use pilot recipe
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {launchRecipe.map((item, index) => {
                      const RecipeIcon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          className="group rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/72 p-4 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--surface)]"
                          onClick={() => setStep(item.targetStep)}
                          data-testid={`onboarding-recipe-step-${index + 1}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                              <RecipeIcon size={17} />
                            </span>
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                item.ready ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]" : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                              }`}
                            >
                              {item.ready ? <Check size={13} /> : index + 1}
                            </span>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-[var(--text)]">{item.label}</div>
                          <p className="mt-1 min-h-12 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                          <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                            {item.actionLabel}
                            <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                  <SectionTitle
                    title="Company identity"
                    helper="These labels appear in Home, reports, proof packets, and AI Skills."
                  />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Company name">
                      <input
                        aria-label="Company name"
                        className="input h-12"
                        placeholder="Foundever, Acme, Northwind..."
                        value={draft.companyName}
                        onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))}
                      />
                    </Field>
                    <Field label="Workspace label">
                      <input
                        aria-label="Workspace label"
                        className="input h-12"
                        value={draft.workspaceLabel}
                        onChange={(event) => setDraft((current) => ({ ...current, workspaceLabel: event.target.value }))}
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <SectionTitle
                      title="Recommended paths"
                      helper="Choose the closest starting point. Everything can be edited after setup."
                    />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {setupPresets.map((preset) => {
                      const selected =
                        draft.setupMode === preset.id &&
                        preset.functions.every((item) => draft.functions.includes(item));
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`min-h-[124px] rounded-lg border p-4 text-left transition ${
                            selected
                              ? "border-[var(--primary)] bg-[var(--surface)] shadow-[0_16px_42px_rgba(99,91,255,0.12)] ring-4 ring-[var(--primary-soft)]"
                              : "border-[var(--border)] bg-[var(--surface)]/82 hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
                          }`}
                          onClick={() => applySetupPreset(preset)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                                <Rocket size={17} />
                              </span>
                              <div className="truncate text-base font-semibold leading-6 text-[var(--text)]">
                                {preset.label}
                              </div>
                            </div>
                            <Badge tone={preset.id === "pilot" ? "green" : "slate"}>{preset.badge}</Badge>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{preset.helper}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mx-auto max-w-5xl space-y-5">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">Recommended first teams</div>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                        Select 3-6 teams. The app creates one priority opportunity per team and turns the strongest
                        candidate into the first governed AI Skill.
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => applySetupPreset(setupPresets[0])}>
                      Use recommended
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {functionOptions.map((option) => {
                    const selected = draft.functions.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`min-h-[128px] rounded-lg border p-4 text-left transition ${
                          selected
                            ? "border-[var(--primary)] bg-[var(--surface)] shadow-[0_16px_42px_rgba(99,91,255,0.12)] ring-4 ring-[var(--primary-soft)]"
                            : "border-[var(--border)] bg-[var(--surface)]/82 hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
                        }`}
                        onClick={() => toggleFunction(option.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-sm font-bold text-[var(--text-muted)]">
                              {option.label.slice(0, 1)}
                            </span>
                            <div className="text-sm font-semibold text-[var(--text)]">{option.label}</div>
                          </div>
                          <span
                            className={`flex size-5 items-center justify-center rounded-full border ${
                              selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)]"
                            }`}
                          >
                            {selected ? <Check size={12} /> : null}
                          </span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{option.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mx-auto max-w-5xl space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 text-[var(--success)]" size={20} />
                      <div>
                        <div className="text-sm font-semibold text-[var(--success)]">Safe-by-default access</div>
                        <p className="mt-1 text-sm leading-6 text-[var(--success)]">
                          Connectors start as read-only or approval-gated. Raw private messages, individual scoring, and
                          covert monitoring remain blocked by product policy.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="text-sm font-semibold text-[var(--text)]">Trust controls</div>
                    <div className="mt-3 space-y-2">
                      {trustControls.map((item) => (
                        <div key={item} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                          <Check size={14} className="text-[var(--success)]" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {permissionOptions.map((option) => {
                    const selected = draft.permissions.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`rounded-lg border p-4 text-left transition ${
                          selected
                            ? "border-[var(--primary)] bg-[var(--surface)] shadow-[0_16px_42px_rgba(99,91,255,0.12)] ring-4 ring-[var(--primary-soft)]"
                            : "border-[var(--border)] bg-[var(--surface)]/82 hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
                        }`}
                        onClick={() => togglePermission(option.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-[var(--text)]">{option.title}</div>
                              <Badge tone={option.recommended ? "green" : "slate"}>{option.badge}</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{option.body}</p>
                          </div>
                          <span
                            className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                              selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)]"
                            }`}
                          >
                            {selected ? <Check size={12} /> : null}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-5">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Ready to create</div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-normal">
                          Generate {draft.companyName.trim() || "the company"} workspace
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                          The app will open Home with the next action, a launch checklist, proof status, and a leadership brief.
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {sideSignals.map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-[var(--border)]/18 bg-[var(--surface)]/[0.06] px-3 py-3">
                            <div className="text-lg font-bold">{value}</div>
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                              {label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Panel className="p-5">
                    <SectionTitle title="What gets created" />
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        ...launchArtifacts,
                        "Privacy-safe work-pattern records",
                        "Connector and knowledge catalog entries",
                        "Setup audit event",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
                          <Check className="text-[var(--success)]" size={16} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <Panel className="p-5">
                  <SectionTitle title="Selected access" />
                  <div className="mt-4 space-y-3">
                    {selectedPermissionTitles.length ? (
                      selectedPermissionTitles.map((item) => (
                        <div key={item.id} className="rounded-lg bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
                          <div className="text-sm font-semibold text-[var(--text)]">{item.title}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{item.badge}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-[var(--text-muted)]">
                        No permissions selected yet. The launch plan will use the conservative default.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)]/64 bg-[var(--surface)]/58 px-6 py-4 backdrop-blur-xl lg:px-8">
            <Button variant="ghost" onClick={closeSetup}>
              Finish later
            </Button>
            {footerHint ? (
              <div className="hidden min-w-0 flex-1 px-3 text-center sm:block">
                <div className="truncate text-sm font-semibold text-[var(--text)]">{footerHint.label}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{footerHint.helper}</div>
              </div>
            ) : null}
            <div className="flex gap-2">
              {step > 0 ? (
                <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>
                  Back
                </Button>
              ) : null}
              <Button onClick={continueSetup}>
                {step === steps.length - 1 ? "Generate workspace" : "Continue"}
                {step === steps.length - 1 ? <Rocket size={16} /> : <ChevronRight size={16} />}
              </Button>
            </div>
          </footer>
        </section>

        {step === 3 ? null : (
        <aside className="hidden min-h-0 flex-col border-l border-[var(--border)]/64 bg-[var(--surface)]/50 2xl:flex">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_52px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                    What gets created
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">{selectedPreset?.label ?? "Custom launch"}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                Setup creates records you can inspect, edit, export, and test.
              </p>
              <div className="mt-4 space-y-2">
                {launchArtifacts.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]">
                      <Check size={13} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {sideSignals.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                  <div className="mt-1 truncate text-sm font-bold text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Building2 size={16} className="text-[var(--primary)]" />
                Tenant preview
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Company</div>
                  <div className="mt-1 font-semibold text-[var(--text)]">{draft.companyName.trim() || "Company pending"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Workspace</div>
                  <div className="mt-1 text-[var(--text-muted)]">{draft.workspaceLabel || "AI Enablement OS"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Mode</div>
                  <div className="mt-1 text-[var(--text-muted)]">{modeLabel}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Database size={16} className="text-[var(--primary)]" />
                Selected access
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedPermissionTitles.length ? (
                  selectedPermissionTitles.slice(0, 6).map((item) => (
                    <span key={item.id} className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                      {item.title.replace(" metadata", "")}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">No permissions selected</span>
                )}
              </div>
            </div>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
