"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  Database,
  KeyRound,
  Rocket,
  ShieldCheck,
  TestTube2,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shell";
import { Badge, Button, DataTable, MiniMetric, Panel, SectionTitle, StatusNotice } from "@/components/ui";
import type { PrimetimeGateItem, PrimetimeLaunchGate } from "@/lib/primetime-launch-gate";
import { openClawIntegration, openClawLaunchReadiness, openClawStatusTone } from "@/lib/openclaw-integration";
import type { ProviderReadiness } from "@/lib/provider-registry";
import {
  launchPackTemplates,
  type InstalledLaunchPackRecord,
  type LaunchPackTemplateId,
  type ReportScheduleRecord,
} from "@/lib/runtime-control-plane";
import type { ProductionReadiness, View } from "@/lib/ui/types";
import type { WorkspaceMode } from "@/lib/workspace-schema";

type LaunchAction = NonNullable<ProductionReadiness["manualActions"]>[number];

function statusTone(status?: string): "green" | "amber" | "red" | "blue" | "slate" {
  if (["ready", "pass"].includes(status ?? "")) return "green";
  if (["degraded", "needs-work", "warn"].includes(status ?? "")) return "amber";
  if (["blocked", "block", "fail"].includes(status ?? "")) return "red";
  if (["demo", "production"].includes(status ?? "")) return "blue";
  return "slate";
}

function actionView(action: LaunchAction): View {
  const text = `${action.id} ${action.title} ${action.action} ${action.env.join(" ")}`.toLowerCase();
  if (
    /connector|mcp|broker|slack|teams|jira|servicenow|sharepoint|workday|confluence|salesforce|github|azure devops|zendesk|snowflake|databricks|sap|netsuite|hubspot|gong|langfuse|langsmith|phoenix|braintrust/.test(
      text,
    )
  ) {
    return "connectors";
  }
  if (/workflow|temporal|worker|job/.test(text)) return "workflow";
  if (/eval|red.team|artifact/.test(text)) return "evals";
  if (/trace|audit|observability|otel|sentry|log|backup|migration/.test(text)) return "evidence";
  if (/privacy|retention|dsr|governance/.test(text)) return "governance";
  if (/model|provider|secret|vault|api.key|openai|openrouter|anthropic|gemini|kimi|glm|deepseek/.test(text)) return "admin";
  if (/database|auth|oidc|sso|provisioning|session|rate|origin/.test(text)) return "admin";
  return "launch";
}

const launchViewLabels: Partial<Record<View, string>> = {
  admin: "Settings",
  broker: "Tool Permissions",
  connectors: "Connect Apps",
  evidence: "Proof Ledger",
  evals: "Quality Evals",
  factory: "Use Cases",
  governance: "Risk Review",
  harness: "AI Harness",
  launch: "Launch controls",
  reports: "Reports",
  roi: "Value & ROI",
  skills: "AI Skills",
  training: "Adoption Plan",
  work: "Work Signals",
  workflow: "Workflow Builder",
};

function launchViewLabel(view: View) {
  return launchViewLabels[view] ?? view;
}

function launchFixActionLabel(view: View) {
  const labels: Partial<Record<View, string>> = {
    admin: "Settings",
    broker: "Tools",
    connectors: "Apps",
    evidence: "Proof",
    evals: "Evals",
    governance: "Risk",
    harness: "Harness",
    workflow: "Workflow",
  };
  return labels[view] ?? launchViewLabel(view);
}

function launchGateActionLabel(item: PrimetimeGateItem) {
  if (item.targetView === "launch") {
    return item.id === "production-runtime" ? "Open fix list" : "Open gate matrix";
  }
  return `Open ${launchViewLabel(item.targetView)}`;
}

function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return Promise.resolve();
  return navigator.clipboard.writeText(value);
}

function envTemplate(actions: LaunchAction[]) {
  const env = Array.from(new Set(actions.flatMap((action) => action.env))).sort();
  if (!env.length) return "# No launch environment gaps are currently reported.\n";
  return env.map((name) => `${name}=`).join("\n");
}

export function LaunchCenter({
  productionReadiness,
  primetimeLaunchGate,
  providerVault,
  workspaceMode,
  installedLaunchPacks,
  reportSchedules,
  onInstallLaunchPack,
  onOpenView,
  onOpenSettings,
  onOpenSetup,
}: {
  productionReadiness: ProductionReadiness | null;
  primetimeLaunchGate: PrimetimeLaunchGate;
  providerVault: ProviderReadiness[];
  workspaceMode: WorkspaceMode;
  installedLaunchPacks: InstalledLaunchPackRecord[];
  reportSchedules: ReportScheduleRecord[];
  onInstallLaunchPack: (templateId: LaunchPackTemplateId) => void;
  onOpenView: (view: View) => void;
  onOpenSettings: () => void;
  onOpenSetup: () => void;
}) {
  const [checkedReadiness, setCheckedReadiness] = useState<ProductionReadiness | null>(null);
  const [readinessMessage, setReadinessMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [selectedGateId, setSelectedGateId] = useState(primetimeLaunchGate.nextAction.id);
  const [selectedPackId, setSelectedPackId] = useState<LaunchPackTemplateId>("first_90_days_ai_office");
  const readiness = checkedReadiness ?? productionReadiness;
  const manualActions = readiness?.manualActions ?? [];
  const blockers = readiness?.blockers ?? [];
  const warnings = readiness?.warnings ?? [];
  const customerContract = readiness?.customerLaunchContract;
  const configuredProviders = providerVault.filter((provider) => provider.id !== "local" && provider.configured);
  const pilotBlocks = primetimeLaunchGate.blockers.filter((item) => item.requiredFor === "pilot");
  const productionBlocks = primetimeLaunchGate.items.filter((item) => item.requiredFor === "production" && item.status === "block");
  const privateBetaStatus = pilotBlocks.length ? "blocked" : primetimeLaunchGate.warnings.length ? "needs-work" : "ready";
  const customerLaunchStatus =
    productionBlocks.length || readiness?.status === "blocked"
      ? "blocked"
      : readiness?.status === "ready" && primetimeLaunchGate.status === "ready"
        ? "ready"
        : "needs-work";
  const launchScore = customerContract?.score ?? primetimeLaunchGate.score;
  const nextGate = primetimeLaunchGate.nextAction;
  const launchDecision: {
    badge: string;
    headline: string;
    body: string;
    tone: ReturnType<typeof statusTone>;
    lane: string;
  } =
    customerLaunchStatus === "ready"
      ? {
          badge: "customer launch ready",
          headline: "Next: open the rollout for customers",
          body: "The operating gates are passing. Keep the proof packet attached, confirm owners, and move the launch plan into customer rollout.",
          tone: "green",
          lane: "Customer rollout",
        }
      : privateBetaStatus !== "blocked"
        ? {
            badge: "pilot with guardrails",
            headline: `Next: close ${nextGate.label}`,
            body: "A bounded pilot can move forward only if scope, owners, human oversight, and proof stay explicit. Customer launch still needs the remaining gates closed.",
            tone: "amber",
            lane: "Private beta",
          }
        : {
            badge: "do not launch yet",
            headline: `Next: unblock ${nextGate.label}`,
            body: "The launch path is blocked. Fix the next gate before inviting a pilot group or promising a customer rollout.",
            tone: "red",
            lane: "Preparation",
          };
  const gateMap = new Map(primetimeLaunchGate.items.map((item) => [item.id, item]));
  const selectedPack = launchPackTemplates.find((pack) => pack.id === selectedPackId) ?? launchPackTemplates[0];
  const installedPackIds = new Set(installedLaunchPacks.map((pack) => pack.templateId));
  const selectedPackInstalled = installedPackIds.has(selectedPack.id);
  const selectedPackPreviewSections: { label: string; items: string[] }[] = [
    { label: "Generated use cases", items: selectedPack.generatedUseCases },
    { label: "Controls", items: selectedPack.controls },
    { label: "Eval suites", items: selectedPack.evalSuites },
    { label: "Checklist", items: selectedPack.checklistItems },
  ];

  function gateGroup(ids: string[]) {
    const gates = ids.map((id) => gateMap.get(id)).filter((item): item is PrimetimeGateItem => Boolean(item));
    const status: PrimetimeGateItem["status"] = gates.some((item) => item.status === "block")
      ? "block"
      : gates.some((item) => item.status === "warn")
        ? "warn"
        : "pass";
    const action = gates.find((item) => item.status === "block") ?? gates.find((item) => item.status === "warn") ?? gates[0];
    return { status, action };
  }

  const rolloutPath = [
    {
      label: "1. Pick the pilot",
      helper: "A real opportunity and owner exist.",
      ids: ["portfolio"],
    },
    {
      label: "2. Prepare the Skill",
      helper: "Skill package, workflow, evals, and trace evidence must be complete.",
      ids: ["skill-package", "workflow", "evals", "harness-trace"],
    },
    {
      label: "3. Approve the risk",
      helper: "Review decision and executive proof must be attached.",
      ids: ["governance", "executive-proof"],
    },
    {
      label: "4. Harden production",
      helper: "Integrations, runtime controls, and OS maturity must support rollout.",
      ids: ["integration", "production-runtime", "maturity"],
    },
  ].map((step) => ({ ...step, ...gateGroup(step.ids) }));

  async function testReadiness() {
    setReadinessMessage("Testing server readiness...");
    try {
      const response = await fetch("/api/readiness", { cache: "no-store" });
      if (!response.ok) throw new Error(`Readiness API returned ${response.status}`);
      const payload = (await response.json()) as ProductionReadiness;
      setCheckedReadiness(payload);
      setReadinessMessage(`Readiness checked: ${payload.status ?? "unknown"}`);
    } catch (error) {
      setReadinessMessage(error instanceof Error ? error.message : "Readiness test failed");
    }
  }

  async function copyManualActions() {
    await copyToClipboard(readiness?.manualActionsMarkdown || "All launch readiness checks are passing.");
    setCopyMessage("Launch checklist copied");
  }

  async function copyEnvTemplate() {
    await copyToClipboard(envTemplate(manualActions));
    setCopyMessage("Environment template copied");
  }

  function gateTone(status: PrimetimeGateItem["status"]): "green" | "amber" | "red" {
    if (status === "pass") return "green";
    if (status === "warn") return "amber";
    return "red";
  }

  function openLaunchGate(item: PrimetimeGateItem) {
    setSelectedGateId(item.id);
    if (item.targetView === "launch") {
      const targetId = item.id === "production-runtime" ? "launch-fix-list" : "launch-gate-matrix";
      const target = document.getElementById(targetId);
      if (target instanceof HTMLDetailsElement) target.open = true;
      window.requestAnimationFrame(() => {
        scrollLaunchTarget(target);
      });
      return;
    }
    onOpenView(item.targetView);
  }

  function scrollLaunchTarget(target: HTMLElement | null) {
    if (!target) return;
    const workspaceScroller = document.getElementById("workspace-main-content");
    if (!workspaceScroller) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const scrollerRect = workspaceScroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = targetRect.top - scrollerRect.top + workspaceScroller.scrollTop - 12;
    workspaceScroller.scrollTop = Math.max(0, nextTop);
  }

  const roleModes = [
    {
      label: "Executive",
      body: "Starts in launch proof, ROI, risk posture, and the decisions needed for pilot or rollout.",
      view: "reports" as View,
      icon: Clipboard,
    },
    {
      label: "AI Director",
      body: "Runs the operating loop across strategy, opportunities, Skills, governance, adoption, and value.",
      view: "command" as View,
      icon: Rocket,
    },
    {
      label: "Builder",
      body: "Configures Skills, context, workflow blueprints, broker policy, evals, and Harness runs.",
      view: "skills" as View,
      icon: TestTube2,
    },
    {
      label: "Reviewer",
      body: "Reviews risk, approvals, evidence packets, human oversight, and launch conditions.",
      view: "governance" as View,
      icon: ShieldCheck,
    },
    {
      label: "Function Leader",
      body: "Submits opportunities, checks pilot scope, validates value, and approves adoption plans.",
      view: "factory" as View,
      icon: Users,
    },
  ];
  const launchSignals: {
    label: string;
    value: string;
    helper: string;
    tone: ReturnType<typeof statusTone>;
  }[] = [
    {
      label: "Private beta",
      value: privateBetaStatus === "ready" ? "Ready" : privateBetaStatus === "blocked" ? "Blocked" : "Guarded",
      helper: pilotBlocks.length ? `${pilotBlocks.length} pilot blocker${pilotBlocks.length === 1 ? "" : "s"}` : "bounded launch path",
      tone: statusTone(privateBetaStatus),
    },
    {
      label: "Customer rollout",
      value: customerLaunchStatus === "ready" ? "Ready" : customerLaunchStatus === "blocked" ? "Blocked" : "Not yet",
      helper: `${launchScore}/100 launch score`,
      tone: statusTone(customerLaunchStatus),
    },
    {
      label: "Runtime check",
      value: readiness?.status ?? "Unknown",
      helper: `${workspaceMode} mode · ${blockers.length} blockers · ${warnings.length} warnings`,
      tone: statusTone(readiness?.status),
    },
    {
      label: "Model lane",
      value: configuredProviders.length ? `${configuredProviders.length} ready` : "Local",
      helper: configuredProviders.length ? "provider keys configured" : "add provider for rollout",
      tone: configuredProviders.length ? "green" : "amber",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Launch Plan"
        subtitle="Decide what can launch, what must be fixed, and who owns the next rollout step."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void testReadiness()}>
              <TestTube2 size={16} />
              Test Readiness
            </Button>
            <Button onClick={onOpenSettings}>
              <KeyRound size={16} />
              Keys & Secrets
            </Button>
          </div>
        }
      />

      <Panel className="overflow-hidden" data-testid="launch-primary-decision">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={launchDecision.tone}>{launchDecision.badge}</Badge>
              <Badge tone={statusTone(privateBetaStatus)}>{launchDecision.lane}</Badge>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] tabular-nums text-[var(--text-soft)]">
                {primetimeLaunchGate.passes.length}/{primetimeLaunchGate.items.length} gates passing
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{launchDecision.headline}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{launchDecision.body}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => openLaunchGate(nextGate)}>
                <ArrowRight size={15} />
                {launchGateActionLabel(nextGate)}
              </Button>
              <Button variant="secondary" onClick={onOpenSetup}>
                <Rocket size={15} />
                Guided setup
              </Button>
            </div>

            <details
              className="group mt-4 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72"
              data-testid="launch-decision-proof"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)]">Why this launch decision?</span>
                  <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--text-muted)]">
                    {primetimeLaunchGate.passes.length}/{primetimeLaunchGate.items.length} gates pass · {blockers.length} blocker{blockers.length === 1 ? "" : "s"} · {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
              </summary>
              <div className="hidden grid-cols-1 gap-px overflow-hidden border-t border-[var(--border)]/70 bg-[var(--border)]/70 group-open:grid md:grid-cols-2 xl:grid-cols-4">
                {launchSignals.map((signal) => (
                  <div key={signal.label} className="bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{signal.label}</div>
                      <Badge tone={signal.tone}>{signal.value}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{signal.helper}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-4 lg:border-l lg:border-t-0">
            <SectionTitle title="Decision health" helper="Launch evidence and unresolved gaps" compact />
            <div className="mt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Launch score</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{launchScore}%</div>
                </div>
                <Badge tone={statusTone(customerLaunchStatus)}>{customerLaunchStatus}</Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(4, Math.min(100, launchScore))}%` }}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniMetric label="Pass" value={String(primetimeLaunchGate.passes.length)} />
              <MiniMetric label="Warn" value={String(primetimeLaunchGate.warnings.length)} />
              <MiniMetric label="Block" value={String(primetimeLaunchGate.blockers.length)} />
            </div>
            <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/72 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text)]">Next gate</div>
                <Badge tone={statusTone(nextGate.status)}>{nextGate.status}</Badge>
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--text)]">{nextGate.label}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{nextGate.nextAction}</p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden" data-testid="launch-pack-installer">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={installedLaunchPacks.length ? "green" : "amber"}>{installedLaunchPacks.length} installed</Badge>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">template installer</span>
              <Badge tone={reportSchedules.length ? "blue" : "slate"}>{reportSchedules.length} report cadence{reportSchedules.length === 1 ? "" : "s"}</Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Install launch packs
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Packs create the operating artifacts a company needs: use case starters, controls, report cadences,
              eval suites, checklist items, and a proof record showing what was installed.
            </p>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {launchPackTemplates.map((pack) => {
                const selected = pack.id === selectedPack.id;
                const installed = installedPackIds.has(pack.id);

                return (
                  <button
                    key={pack.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary-soft)]/58 shadow-[var(--shadow-button)]"
                        : "border-[var(--border)] bg-[var(--surface)]/76 hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)]">{pack.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{pack.audience}</div>
                      </div>
                      <Badge tone={installed ? "green" : "blue"}>{installed ? "installed" : "preview"}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{pack.purpose}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/64 p-4 lg:max-h-[760px] lg:overflow-y-auto lg:border-l lg:border-t-0 sm:p-5">
            <SectionTitle title={selectedPack.title} helper={selectedPack.audience} compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Use cases" value={String(selectedPack.generatedUseCases.length)} />
              <MiniMetric label="Controls" value={String(selectedPack.controls.length)} />
              <MiniMetric label="Reports" value={String(selectedPack.reportCadences.length)} />
              <MiniMetric label="Evals" value={String(selectedPack.evalSuites.length)} />
            </div>

            <div className="mt-4 space-y-3">
              {selectedPackPreviewSections.map(({ label, items }) => (
                <div key={label} className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                  <div className="mt-2 space-y-1">
                    {items.slice(0, 3).map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs leading-5 text-[var(--text-muted)]">
                        <Check size={13} className="mt-0.5 shrink-0 text-[var(--success)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button className="mt-4 w-full" onClick={() => onInstallLaunchPack(selectedPack.id)} disabled={selectedPackInstalled}>
              <Clipboard size={15} />
              {selectedPackInstalled ? "Installed with proof" : "Install pack"}
            </Button>
          </div>
        </div>
      </Panel>

      {(readinessMessage || copyMessage) ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="launch-status-notices">
          {readinessMessage ? (
            <StatusNotice
              tone={readinessMessage.includes("failed") || readinessMessage.includes("returned") ? "red" : "blue"}
              compact
              testId="launch-readiness-status"
            >
              {readinessMessage}
            </StatusNotice>
          ) : null}
          {copyMessage ? (
            <StatusNotice tone="green" compact testId="launch-copy-status">
              {copyMessage}
            </StatusNotice>
          ) : null}
        </div>
      ) : null}

      <Panel className="mt-4 overflow-hidden" data-testid="openclaw-launch-cockpit">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">Agent runtime launch checklist</span>
              <Badge tone={openClawLaunchReadiness >= 80 ? "green" : "amber"}>{openClawLaunchReadiness}% ready</Badge>
              <Badge tone={openClawStatusTone(openClawIntegration.gateway.status)}>
                gateway {openClawIntegration.gateway.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                  Launch connected agents only when setup, policy, evals, risk, proof, and value are connected
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  This checklist gives platform, governance, and finance teams the same gate for agent rollout:
                  import the gateway, compile policy, run upgrade-safe evals, approve risk, attach proof, then baseline value.
                </p>
              </div>
              <Button className="whitespace-nowrap" onClick={() => onOpenView("broker")}>
                <ShieldCheck size={15} />
                Compile policy
              </Button>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {openClawIntegration.launchSteps.map((step, index) => {
                const destinationLabel = launchViewLabel(step.targetView);
                return (
                  <button
                    key={step.id}
                    type="button"
                    aria-label={`${step.label}: open ${destinationLabel}`}
                    onClick={() => onOpenView(step.targetView)}
                    className={`group flex min-h-[118px] flex-col rounded-lg border p-3 text-left transition ${
                      step.status === "done"
                        ? "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] hover:border-[color-mix(in_srgb,var(--success)_36%,var(--border))]"
                        : step.status === "next"
                          ? "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_38%,var(--border))]"
                          : "border-[var(--border)] bg-[var(--surface)]/72 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          step.status === "done"
                            ? "bg-[var(--success)] text-white"
                            : step.status === "next"
                              ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_28%,var(--border))]"
                              : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {step.status === "done" ? <Check size={14} /> : index + 1}
                      </span>
                      <Badge tone={openClawStatusTone(step.status)}>{step.status}</Badge>
                    </span>
                    <span className="mt-3 text-sm font-semibold text-[var(--text)]">{step.label}</span>
                    <span className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{step.evidence}</span>
                    <span className="mt-auto pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{step.owner}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                      Open {destinationLabel}
                      <ArrowRight size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/72 p-4 lg:max-h-[760px] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <SectionTitle title="Update cockpit" helper="Keep connected runtimes current without surprise production changes" compact />
            <div className="mt-4 space-y-2">
              {openClawIntegration.updateChecks.map((check) => {
                const destinationView = check.status === "warn" ? "harness" : "launch";
                return (
                <button
                  key={check.label}
                  type="button"
                  aria-label={`${check.label}: open ${launchViewLabel(destinationView)}`}
                  onClick={() => onOpenView(destinationView)}
                  className="flex w-full gap-3 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/76 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                      check.status === "pass" ? "bg-[var(--success-soft)] text-[var(--success)]" : check.status === "warn" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"
                    }`}
                  >
                    {check.status === "pass" ? <Check size={14} /> : <AlertTriangle size={14} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">{check.label}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{check.detail}</span>
                  </span>
                  <span className="ml-auto flex shrink-0 flex-col items-end gap-2">
                    <Badge tone={openClawStatusTone(check.status)}>{check.status}</Badge>
                    <span className="text-[11px] font-semibold text-[var(--primary)]">Open {launchViewLabel(destinationView)}</span>
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="p-5">
          <SectionTitle
            title="Rollout path"
            helper="The smallest understandable path from approved idea to governed launch."
            compact
          />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {rolloutPath.map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={() => step.action ? openLaunchGate(step.action) : undefined}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/72 p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--text)]">{step.label}</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{step.helper}</p>
                  </div>
                  <Badge tone={gateTone(step.status)}>{step.status === "pass" ? "ready" : step.status === "warn" ? "needs work" : "blocked"}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                  <span className="line-clamp-2">{step.action?.status === "pass" ? "Evidence present" : step.action ? launchGateActionLabel(step.action) : "Open launch gate"}</span>
                  <ArrowRight size={13} />
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Launch lane</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{launchDecision.lane}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {privateBetaStatus === "blocked"
                    ? "Hold launch until pilot blockers are cleared."
                    : customerLaunchStatus === "ready"
                      ? "Customer rollout can proceed with proof attached."
                      : "Keep this in private beta until production gates harden."}
                </p>
              </div>
              <Badge tone={launchDecision.tone}>{launchDecision.badge}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Private beta", privateBetaStatus],
                ["Customer", customerLaunchStatus],
              ].map(([label, status]) => <MiniMetric key={label} label={label} value={status} />)}
            </div>
            <Button className="mt-4 w-full" onClick={() => openLaunchGate(primetimeLaunchGate.nextAction)}>
              {launchGateActionLabel(primetimeLaunchGate.nextAction)}
            </Button>
          </Panel>

          <Panel className="p-5">
            <SectionTitle
              title="Private Beta vs Customer Launch"
              helper="Use private beta for narrow pilots with explicit constraints. Use customer launch when runtime and operations controls are durable."
              compact
            />
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Private beta",
                  status: privateBetaStatus,
                  body: pilotBlocks.length ? "Pilot blockers remain. Close the first operating-loop gaps before inviting a pilot group." : "Bounded launch is viable if scope, owners, human oversight, and proof packet are explicit.",
                },
                {
                  label: "Customer launch",
                  status: customerLaunchStatus,
                  body: customerLaunchStatus === "ready" ? "Runtime and operating controls are ready for broader customer rollout." : "Customer launch still needs infrastructure, operations, or evidence hardening.",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/75 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[var(--text)]">{item.label}</div>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.body}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle
              title="Role Cockpits"
              helper="Same workspace, different starting surface depending on who signs in."
              compact
            />
            <div className="mt-4 space-y-2">
              {roleModes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.label}
                    type="button"
                    onClick={() => onOpenView(mode.view)}
                    className="flex w-full items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/75 p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--primary)]">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--text)]">{mode.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{mode.body}</span>
                    </span>
                    <ArrowRight size={15} className="ml-auto mt-1 shrink-0 text-[var(--text-soft)]" />
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <details
        id="launch-fix-list"
        open={manualActions.length > 0}
        className="group mt-4 scroll-mt-24 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Production fix list</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {manualActions.length ? `${manualActions.length} technical action${manualActions.length === 1 ? "" : "s"} from the readiness contract.` : "No technical launch fixes are currently reported."}
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>
        <div className="border-t border-[var(--border)] p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copyManualActions()}>
              <Copy size={15} />
              Copy Checklist
            </Button>
            <Button variant="secondary" onClick={() => void copyEnvTemplate()}>
              <Database size={15} />
              Copy Env
            </Button>
          </div>
          <DataTable
            caption="Launch readiness manual action list"
            minWidth={1040}
            columns={["Action", "Severity", "Owner", "Variables", "Verify", "Fix"]}
            rows={manualActions.map((action) => {
              const destinationView = actionView(action);
              const destinationLabel = launchViewLabel(destinationView);
              return [
                <div key="action" className="max-w-xl">
                  <div className="font-semibold text-[var(--text)]">{action.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{action.action}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{action.why}</div>
                </div>,
                <Badge key="severity" tone={action.severity === "blocker" ? "red" : "amber"}>{action.severity}</Badge>,
                <Badge key="owner" tone="slate">{action.owner}</Badge>,
                action.env.length ? (
                  <div key="env" className="flex max-w-xs flex-wrap gap-1.5">
                    {action.env.slice(0, 5).map((name) => (
                      <span key={name} className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                        {name}
                      </span>
                    ))}
                    {action.env.length > 5 ? <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">+{action.env.length - 5}</span> : null}
                  </div>
                ) : "None",
                <span key="verify" className="text-sm leading-6 text-[var(--text-muted)]">{action.verify}</span>,
                <Button
                  key="fix"
                  variant="secondary"
                  className="h-8 whitespace-nowrap px-2.5 text-xs"
                  onClick={() => onOpenView(destinationView)}
                  aria-label={`Open ${destinationLabel} fix for ${action.title}`}
                  title={`Open ${destinationLabel}`}
                >
                  {launchFixActionLabel(destinationView)}
                </Button>,
              ];
            })}
            emptyMessage="All launch readiness checks are passing. Keep this API in CI so the launch state stays true over time."
          />
        </div>
      </details>

      <details
        id="launch-gate-matrix"
        open
        className="group mt-4 scroll-mt-24 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">All launch gates</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">Open for the full pilot and production gate matrix.</div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>
        <div className="grid gap-px border-t border-[var(--border)] bg-[var(--surface-subtle)] md:grid-cols-2 xl:grid-cols-5">
          {primetimeLaunchGate.items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={`${item.label}: ${item.status === "pass" ? "evidence present" : launchGateActionLabel(item)}`}
              onClick={() => openLaunchGate(item)}
              className={`bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--primary-soft)] ${
                selectedGateId === item.id ? "shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--primary)_32%,transparent)]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{item.requiredFor === "production" ? "Production" : "Pilot"} gate</div>
                </div>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{item.evidence}</p>
              {item.status !== "pass" ? (
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                  <span>{launchGateActionLabel(item)}</span>
                  <ArrowRight size={13} />
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
                  <Check size={13} />
                  Evidence present
                </div>
              )}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
