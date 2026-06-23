import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  ChevronDown,
  Database,
  FileCheck2,
  LockKeyhole,
  Network,
  PlugZap,
  Radar,
  ServerCog,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  MiniMetric,
  OperatingBrief,
  Panel,
  SectionTitle,
  riskTone,
  statusTone,
  type BadgeTone,
} from "@/components/ui";
import { deriveAdoptionRate } from "@/lib/adoption-model";
import { deriveEnterpriseAiOperatingSystem } from "@/lib/enterprise-ai-operating-system";
import {
  agentPermissionSurfaces,
  controlTowerPillars,
  deriveEnterpriseAiControlPlane,
  shadowAiDiscoveries,
  vendorRiskRecords,
} from "@/lib/enterprise-ai-control-plane";
import {
  formatCurrency,
  type AuditLog,
  type ContextSource,
  type EvalResult,
  type GovernanceReview,
  type Run,
  type Skill,
  type ToolRequest,
  type UseCase,
  type User,
  type WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { IntegrationBlueprint } from "@/lib/integration-blueprint";
import { deriveOpenAiControlPlane, type OpenAiControlPlaneTone } from "@/lib/open-ai-control-plane";
import type { ProviderReadiness } from "@/lib/provider-registry";
import {
  buildRuntimeGraphDrilldown,
  type InstalledLaunchPackRecord,
  type NormalizedRuntimeAssetRecord,
  type ReportScheduleRecord,
  type RuntimeAdapterRecord,
  type RuntimeImportAuditRecord,
  type RuntimeImportJobRecord,
} from "@/lib/runtime-control-plane";
import { statusLabels } from "@/lib/ui/constants";
import type { ProductionReadiness, View } from "@/lib/ui/types";

type RegistryRecord = {
  id: string;
  name: string;
  type: "Governed Skill" | "Opportunity" | "Model Provider" | "Connector Surface";
  owner: string;
  status: string;
  risk: "low" | "medium" | "high" | "restricted";
  department: string;
  evidence: number;
  value: number;
  nextControl: string;
  targetView: View;
};

function userName(users: User[], id?: string) {
  return users.find((user) => user.id === id)?.name ?? "Unassigned";
}

function recordStatusTone(record: RegistryRecord) {
  if (record.type === "Model Provider" || record.type === "Connector Surface") {
    return record.status === "Ready" || record.status === "Managed" ? "green" : record.status === "Partial" ? "amber" : "red";
  }
  return statusTone(record.status);
}

export function AIEstate({
  useCases,
  skills,
  runs,
  evalResults,
  governanceReviews,
  toolRequests,
  auditLogs,
  workSignals,
  contextSources,
  users,
  report,
  providerVault,
  productionReadiness,
  integrationBlueprint,
  runtimeAdapters,
  runtimeImportJobs,
  normalizedRuntimeAssets,
  installedLaunchPacks,
  reportSchedules,
  runtimeImportAudits,
  onOpenView,
  onOpenSettings,
}: {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  workSignals: WorkSignal[];
  contextSources: ContextSource[];
  users: User[];
  report: string;
  providerVault: ProviderReadiness[];
  productionReadiness: ProductionReadiness | null;
  integrationBlueprint: IntegrationBlueprint;
  runtimeAdapters: RuntimeAdapterRecord[];
  runtimeImportJobs: RuntimeImportJobRecord[];
  normalizedRuntimeAssets: NormalizedRuntimeAssetRecord[];
  installedLaunchPacks: InstalledLaunchPackRecord[];
  reportSchedules: ReportScheduleRecord[];
  runtimeImportAudits: RuntimeImportAuditRecord[];
  onOpenView: (view: View) => void;
  onOpenSettings: () => void;
}) {
  const [selectedDrilldown, setSelectedDrilldown] = useState<"runtime" | "mappings" | "evidence" | "packs">("runtime");
  const providerRecords: RegistryRecord[] = providerVault
    .filter((provider) => provider.id !== "local")
    .map((provider) => ({
      id: `provider-${provider.id}`,
      name: provider.label,
      type: "Model Provider",
      owner: "Platform",
      status: provider.configured ? "Ready" : "Needs key",
      risk: "low",
      department: "Cross-Functional",
      evidence: provider.configured ? 1 : 0,
      value: 0,
      nextControl: provider.configured ? "Monitor spend and routing" : provider.missing[0] ?? "Add provider key",
      targetView: "admin",
    }));

  const connectorRecords: RegistryRecord[] = (productionReadiness?.connectors?.catalog?.connectors ?? []).map((connector) => ({
    id: `connector-${connector.id}`,
    name: connector.label,
    type: "Connector Surface",
    owner: connector.system,
    status:
      connector.status === "ready" ? "Ready" : connector.status === "broker-managed" ? "Managed" : connector.status === "partial" ? "Partial" : "Missing",
    risk: connector.requiredScopes.some((scope) => /write|send|readwrite/i.test(scope)) ? "medium" : "low",
    department: connector.category,
    evidence: connector.configuredSecrets.length,
    value: 0,
    nextControl: connector.status === "ready" || connector.status === "broker-managed" ? "Bind policy to Skills" : connector.setupAction,
    targetView: "connectors",
  }));

  const skillRecords: RegistryRecord[] = skills.map((skill) => {
    const evidence =
      runs.filter((run) => run.skillId === skill.id).length +
      governanceReviews.filter((review) => review.itemId === skill.id).length +
      auditLogs.filter((log) => log.message.toLowerCase().includes(skill.name.toLowerCase())).length;
    return {
      id: skill.id,
      name: skill.name,
      type: "Governed Skill",
      owner: userName(users, skill.ownerId),
      status: statusLabels[skill.status] ?? skill.status,
      risk: skill.riskLevel,
      department: skill.department,
      evidence,
      value: skill.valueDelivered,
      nextControl: skill.evalPassRate >= 90 && governanceReviews.some((review) => review.itemId === skill.id)
        ? "Scale adoption"
        : "Complete evals and review",
      targetView: "skills",
    };
  });

  const opportunityRecords: RegistryRecord[] = useCases
    .filter((useCase) => !useCase.linkedSkillId)
    .map((useCase) => ({
      id: useCase.id,
      name: useCase.title,
      type: "Opportunity",
      owner: userName(users, useCase.ownerId ?? useCase.requestorId),
      status: statusLabels[useCase.status] ?? useCase.status,
      risk: useCase.riskLevel,
      department: useCase.department,
      evidence: governanceReviews.filter((review) => review.itemId === useCase.id).length,
      value: Math.round((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes * 12 * 65) / 60),
      nextControl: useCase.status === "approved_for_pilot" ? "Convert to Skill" : "Score and route",
      targetView: "factory",
    }));

  const registry = [...skillRecords, ...opportunityRecords, ...providerRecords, ...connectorRecords];
  const governedCount = skillRecords.filter((record) => ["Pilot", "Production", "Approved"].includes(record.status)).length;
  const missingOwner = registry.filter((record) => record.owner === "Unassigned").length;
  const evidenceCount = registry.reduce((sum, record) => sum + record.evidence, 0);
  const highRiskCount = registry.filter((record) => ["high", "restricted"].includes(record.risk)).length;
  const readyProviderCount = providerRecords.filter((record) => record.status === "Ready").length;
  const readyConnectorCount = connectorRecords.filter((record) => ["Ready", "Managed"].includes(record.status)).length;
  const runtimeDrilldown = buildRuntimeGraphDrilldown({
    adapters: runtimeAdapters,
    importJobs: runtimeImportJobs,
    runtimeAssets: normalizedRuntimeAssets,
  });
  const estateControlPlane = deriveEnterpriseAiControlPlane({
    useCases,
    skills,
    runs,
    governanceReviews,
    evalResults,
    auditLogs,
    toolRequests,
    workSignals,
    providerCount: providerRecords.length,
    providerReadyCount: readyProviderCount,
    connectorCount: connectorRecords.length,
    connectorReadyCount: readyConnectorCount,
  });
  const enterpriseOs = deriveEnterpriseAiOperatingSystem({
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
    auditLogs,
    toolRequests,
    workSignals,
    contextSources,
    productionReadiness,
    report,
  });
  const openAiControlPlane = deriveOpenAiControlPlane({
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
    auditLogs,
    toolRequests,
    workSignals,
    contextSources,
    report,
    providerCount: providerRecords.length,
    connectorCount: connectorRecords.length,
    metrics: {
      annualValue: skills.reduce((sum, skill) => sum + skill.valueDelivered, 0),
      adoptionRate: deriveAdoptionRate(skills, useCases),
    },
  });
  const enterpriseOsPriorityCapabilities = [...enterpriseOs.capabilities]
    .sort((left, right) => left.score - right.score)
    .slice(0, 4);
  const estateControls = [
    registry.length > 0,
    missingOwner === 0 && registry.length > 0,
    governedCount > 0,
    evidenceCount > 0,
    readyProviderCount > 0,
    readyConnectorCount > 0,
    highRiskCount === 0 || governanceReviews.length > 0,
  ];
  const estateScore = Math.round((estateControls.filter(Boolean).length / estateControls.length) * 100);
  const ownedCount = registry.filter((record) => record.owner !== "Unassigned").length;
  const skillReviewGaps = skills.filter(
    (skill) =>
      skill.evalPassRate < 90 ||
      !governanceReviews.some((review) => review.itemId === skill.id && ["approved", "approved_with_conditions"].includes(review.status)),
  ).length;
  const unconvertedOpportunities = opportunityRecords.length;
  const providerGapCount = providerRecords.filter((record) => record.status !== "Ready").length;
  const connectorGapCount = connectorRecords.filter((record) => !["Ready", "Managed"].includes(record.status)).length;
  const readinessPercent = (ready: number, total: number) => (total ? Math.round((ready / total) * 100) : 0);
  const inventoryLanes: {
    label: string;
    title: string;
    body: string;
    count: number;
    readiness: number;
    stat: string;
    action: string;
    view: View;
    icon: typeof Boxes;
    tone: BadgeTone;
  }[] = [
    {
      label: "Opportunities",
      title: "Ideas worth shaping",
      body: unconvertedOpportunities
        ? `${unconvertedOpportunities} opportunity${unconvertedOpportunities === 1 ? "" : "ies"} still need a Skill decision.`
        : "Every scored opportunity is either linked or ready for review.",
      count: useCases.length,
      readiness: readinessPercent(useCases.length - unconvertedOpportunities, useCases.length),
      stat: `${unconvertedOpportunities} unconverted`,
      action: "Open Use Cases",
      view: "factory",
      icon: Boxes,
      tone: unconvertedOpportunities ? "amber" : useCases.length ? "green" : "slate",
    },
    {
      label: "Skills",
      title: "AI work people use",
      body: skillReviewGaps
        ? `${skillReviewGaps} Skill${skillReviewGaps === 1 ? "" : "s"} need eval or governance proof.`
        : "Skills have the proof needed for inventory review.",
      count: skills.length,
      readiness: readinessPercent(skills.length - skillReviewGaps, skills.length),
      stat: `${skillReviewGaps} proof gaps`,
      action: "Open AI Skills",
      view: "skills",
      icon: BrainCircuit,
      tone: skillReviewGaps ? "amber" : skills.length ? "green" : "slate",
    },
    {
      label: "Providers",
      title: "Model access",
      body: providerGapCount
        ? `${providerGapCount} provider${providerGapCount === 1 ? "" : "s"} still need keys or routing decisions.`
        : "External model providers are configured for governed use.",
      count: providerRecords.length,
      readiness: readinessPercent(readyProviderCount, providerRecords.length),
      stat: `${readyProviderCount} ready`,
      action: "Open Providers",
      view: "admin",
      icon: Database,
      tone: providerGapCount ? "amber" : readyProviderCount ? "green" : "slate",
    },
    {
      label: "Connectors",
      title: "System access",
      body: connectorGapCount
        ? `${connectorGapCount} connector surface${connectorGapCount === 1 ? "" : "s"} need setup or Broker policy.`
        : "App connections are ready or Broker-managed.",
      count: connectorRecords.length,
      readiness: readinessPercent(readyConnectorCount, connectorRecords.length),
      stat: `${readyConnectorCount} governed`,
      action: "Open Connectors",
      view: "connectors",
      icon: PlugZap,
      tone: connectorGapCount ? "amber" : readyConnectorCount ? "green" : "slate",
    },
  ];
  const weakestInventoryLane = inventoryLanes.reduce((weakest, lane) =>
    lane.readiness < weakest.readiness ? lane : weakest,
  );
  const nextInventoryAction =
    registry.length === 0
      ? {
          label: "Add first AI use case",
          targetView: "factory" as View,
          icon: Boxes,
          status: "inventory empty",
          tone: "amber" as const,
          title: "Start the inventory with one real AI opportunity",
        }
      : missingOwner > 0
        ? {
            label: "Assign owners",
            targetView: "admin" as View,
            icon: UserRound,
            status: `${missingOwner} ownership gap${missingOwner === 1 ? "" : "s"}`,
            tone: "amber" as const,
            title: "Assign accountable owners before scaling",
          }
        : highRiskCount > 0 && !governanceReviews.length
          ? {
              label: "Review high-risk AI",
              targetView: "governance" as View,
              icon: ShieldCheck,
              status: `${highRiskCount} high-risk asset${highRiskCount === 1 ? "" : "s"}`,
              tone: "red" as const,
              title: "Send high-risk AI through review",
            }
          : readyProviderCount === 0
            ? {
                label: "Add AI provider",
                targetView: "admin" as View,
                icon: BrainCircuit,
                status: "provider missing",
                tone: "amber" as const,
                title: "Connect the model provider lane",
              }
            : readyConnectorCount === 0
              ? {
                  label: "Connect first app",
                  targetView: "connectors" as View,
                  icon: PlugZap,
                  status: "connector missing",
                  tone: "amber" as const,
                  title: "Connect the first governed app",
                }
              : evidenceCount === 0
                ? {
                    label: "Open proof ledger",
                    targetView: "evidence" as View,
                    icon: FileCheck2,
                    status: "proof missing",
                    tone: "blue" as const,
                    title: "Attach evidence to the inventory",
                  }
                : {
                    label: "Review proof",
                    targetView: "evidence" as View,
                    icon: FileCheck2,
                    status: "inventory controlled",
                    tone: "green" as const,
                    title: "Inventory is ready for proof review",
                  };
  const openControlPlaneProgressClassName: Record<OpenAiControlPlaneTone, string> = {
    green: "bg-green-500",
    blue: "bg-sky-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    purple: "bg-indigo-500",
    slate: "bg-[var(--border-strong)]",
  };
  return (
    <div className="flex flex-col">
      <PageHeader
        title="AI Inventory"
        subtitle="Every AI asset, owner, risk, provider, connector, and proof point."
        compact
        action={
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            <Button variant="secondary" className="min-h-8 min-w-0 px-2.5 py-1.5 text-xs sm:w-auto" onClick={onOpenSettings}>
              <BrainCircuit size={14} />
              AI Providers
            </Button>
            <Button className="min-h-8 min-w-0 px-2.5 py-1.5 text-xs sm:w-auto" onClick={() => onOpenView("connectors")}>
              <PlugZap size={14} />
              Connect Apps
            </Button>
          </div>
        }
      />

      <OperatingBrief
        compact
        className="order-[15] mt-3"
        title={nextInventoryAction.title}
        body="AI Inventory answers the practical questions leaders ask before scaling: what AI exists, who owns it, what systems it can touch, what risk it carries, and what proof says it is working."
        eyebrow="inventory control plane"
        status={{ label: nextInventoryAction.status, tone: nextInventoryAction.tone }}
        progress={{ value: estateScore, label: "inventory controls" }}
        secondaryAction={{ label: "AI Providers", onClick: onOpenSettings, icon: BrainCircuit }}
        primaryAction={{ label: nextInventoryAction.label, onClick: () => onOpenView(nextInventoryAction.targetView), icon: nextInventoryAction.icon }}
        signals={[
          { label: "AI assets", value: registry.length, helper: "Skills, use cases, providers, and connectors", tone: registry.length ? "green" : "amber", badge: registry.length ? "live" : "empty", onClick: () => onOpenView("factory") },
          { label: "Owned", value: `${ownedCount}/${Math.max(registry.length, 1)}`, helper: missingOwner ? "ownership gaps remain" : "accountability covered", tone: missingOwner ? "amber" : "green", badge: missingOwner ? "assign" : "ready", onClick: () => onOpenView("admin") },
          { label: "Proof links", value: evidenceCount, helper: "runs, reviews, and audit evidence", tone: evidenceCount ? "blue" : "amber", badge: evidenceCount ? "linked" : "missing", onClick: () => onOpenView("evidence") },
          { label: "Needs review", value: highRiskCount, helper: highRiskCount ? "high or restricted risk" : "no high-risk open", tone: highRiskCount ? "red" : "green", badge: highRiskCount ? "review" : "clear", onClick: () => onOpenView("governance") },
        ]}
        checklistTitle="Inventory next steps"
        checklistHelper="The goal is not more records. It is ownership, control, and proof."
        checklist={[
          { label: "Model provider ready", helper: `${readyProviderCount} external providers ready`, complete: readyProviderCount > 0, onClick: onOpenSettings, actionLabel: "Open settings" },
          { label: "App connections governed", helper: `${readyConnectorCount} connector surfaces ready · ${toolRequests.length} tool requests tracked`, complete: readyConnectorCount > 0, onClick: () => onOpenView("connectors"), actionLabel: "Open connectors" },
          { label: "Owners assigned", helper: missingOwner ? `${missingOwner} gaps remain` : "No unassigned records", complete: missingOwner === 0 && registry.length > 0, onClick: () => onOpenView("admin"), actionLabel: "Open settings" },
          { label: "Proof attached", helper: `${evidenceCount} evidence links`, complete: evidenceCount > 0, onClick: () => onOpenView("evidence"), actionLabel: "Open proof" },
          { label: "Next inventory move", helper: integrationBlueprint.primaryNextAction.name, complete: estateScore >= 80, onClick: () => onOpenView(integrationBlueprint.primaryNextAction.targetView), actionLabel: "Open" },
        ]}
      />

      <Panel className="order-[20] mt-3 overflow-hidden" data-testid="enterprise-ai-operating-system">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">Enterprise AI OS</span>
                <Badge tone={enterpriseOs.score >= 82 ? "green" : enterpriseOs.score >= 62 ? "blue" : enterpriseOs.score >= 38 ? "amber" : "red"}>
                  {enterpriseOs.score}% {enterpriseOs.posture.replace("-", " ")}
                </Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{enterpriseOs.headline}</span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-0 border-t border-[var(--border)]/70 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={enterpriseOs.score >= 82 ? "green" : enterpriseOs.score >= 62 ? "blue" : enterpriseOs.score >= 38 ? "amber" : "red"}>
                    {enterpriseOs.score}% {enterpriseOs.posture.replace("-", " ")}
                  </Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">enterprise AI OS</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">registry · lifecycle · workflow · assurance</span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-[30px]">{enterpriseOs.headline}</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">{enterpriseOs.summary}</p>
              </div>
              <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[260px]">
                <MiniMetric label="Assets" value={String(enterpriseOs.metrics.aiAssets)} />
                <MiniMetric label="Evals" value={`${enterpriseOs.metrics.evalCoverage}%`} />
                <MiniMetric label="Connectors" value={`${enterpriseOs.metrics.connectorReadiness}%`} />
                <MiniMetric label="Value" value={formatCurrency(enterpriseOs.metrics.valueTracked)} />
              </div>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
              {enterpriseOsPriorityCapabilities.map((capability) => (
                <button
                  key={capability.id}
                  type="button"
                  aria-label={`Open Enterprise AI OS capability: ${capability.title}`}
                  onClick={() => onOpenView(capability.targetView)}
                  className="group flex min-h-[132px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/72 p-3.5 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold leading-5 text-[var(--text)]">{capability.title}</span>
                    <Badge tone={capability.tone}>{capability.score}%</Badge>
                  </span>
                  <span className="mt-2 text-sm font-semibold text-[var(--primary)]">{capability.value}</span>
                  <span className="mt-2 block flex-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{capability.summary}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    <span className="line-clamp-1">{capability.nextAction}</span>
                    <ArrowRight size={13} className="shrink-0 transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border)]/72 bg-[var(--surface-muted)]/58 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionTitle title="Lifecycle Command Path" helper="The future-proof path from work demand to safe, measurable AI operations." compact />
                <Button variant="secondary" onClick={() => onOpenView(enterpriseOs.lifecycle.find((item) => item.readiness < 70)?.targetView ?? "reports")}>
                  Open lowest stage
                  <ArrowRight size={14} />
                </Button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3 2xl:grid-cols-6">
                {enterpriseOs.lifecycle.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    aria-label={`Open lifecycle stage ${stage.label}`}
                    onClick={() => onOpenView(stage.targetView)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/86 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[var(--text)]">{stage.label}</div>
                      <Badge tone={stage.tone}>{stage.readiness}%</Badge>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${stage.readiness}%` }} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--text-muted)]">{stage.evidence}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 lg:border-l lg:border-t-0 sm:p-5">
            <SectionTitle title="Next Best Moves" helper="What would make this feel better than any point solution." compact />
            <div className="mt-4 space-y-2">
              {enterpriseOs.recommendations.slice(0, 4).map((recommendation) => (
                <button
                  key={recommendation.id}
                  type="button"
                  aria-label={`Open recommendation: ${recommendation.title}`}
                  onClick={() => onOpenView(recommendation.targetView)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-5 text-[var(--text)]">{recommendation.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{recommendation.body}</p>
                    </div>
                    <Badge tone={recommendation.priority === "critical" ? "red" : recommendation.priority === "high" ? "amber" : "blue"}>
                      {recommendation.priority}
                    </Badge>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    {recommendation.actionLabel}
                    <ArrowRight size={13} />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-4">
              <SectionTitle title="Protocol Readiness" helper="MCP, A2A, app-owned orchestration, iPaaS, and observability." compact />
              <div className="mt-3 space-y-2">
                {enterpriseOs.protocols.slice(0, 3).map((protocol) => (
                  <button
                    key={protocol.id}
                    type="button"
                    aria-label={`Open protocol surface ${protocol.label}`}
                    onClick={() => onOpenView(protocol.targetView)}
                    className="w-full rounded-md bg-[var(--surface-muted)] px-3 py-2 text-left transition hover:bg-[var(--primary-soft)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[var(--text)]">{protocol.label}</div>
                        <div className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{protocol.currentSignal}</div>
                      </div>
                      <Badge tone={protocol.tone}>{protocol.readiness}%</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        </details>
      </Panel>

      <Panel className="order-[20] mt-3 overflow-hidden" data-testid="runtime-agent-inventory">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">Universal Runtime Inventory</span>
                <Badge tone="purple">{openAiControlPlane.runtimeAssets.length} assets</Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                Normalize owners, risks, activity, and proof from connected runtimes.
              </span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-0 border-t border-[var(--border)]/70 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="Universal Runtime Inventory"
                helper="AI assets from the native registry and any connected runtime adapter, normalized into owner, risk, activity, and proof."
                compact
              />
              <Badge tone="purple">{openAiControlPlane.runtimeAssets.length} assets</Badge>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/82">
              <DataTable
                caption="Universal runtime inventory"
                emptyMessage="No runtime assets imported yet. Create a Skill or connect a runtime adapter to populate this inventory."
                minWidth={920}
                columns={["Asset", "Runtime", "Owner", "Risk", "Activity", "Proof"]}
                rows={openAiControlPlane.runtimeAssets.map((asset) => [
                  <button
                    key={`${asset.id}-asset`}
                    type="button"
                    aria-label={`Open runtime asset ${asset.name}`}
                    onClick={() => onOpenView(asset.targetView)}
                    className="text-left"
                  >
                    <span className="block font-semibold text-[var(--text)]">{asset.name}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{asset.kind}</span>
                  </button>,
                  asset.runtime,
                  asset.owner === "Unassigned" ? "Unassigned" : userName(users, asset.owner),
                  <Badge key={`${asset.id}-risk`} tone={riskTone(asset.risk)}>{asset.risk}</Badge>,
                  asset.activity,
                  <button
                    key={`${asset.id}-proof`}
                    type="button"
                    aria-label={`Open proof for ${asset.name}`}
                    onClick={() => onOpenView("evidence")}
                    className="-mx-1.5 inline-flex min-h-8 items-center rounded-md px-1.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] hover:underline focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  >
                    {asset.proof}
                  </button>,
                ])}
              />
            </div>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Adapter Posture" helper="Connect whatever runtime the company already uses, then reconcile traces and controls into the OS." compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Adapters" value={String(openAiControlPlane.metrics.adapterCount)} />
              <MiniMetric label="Telemetry" value={`${openAiControlPlane.metrics.telemetryCoverage}%`} />
            </div>
            <div className="mt-4 space-y-2">
              {openAiControlPlane.adapters.slice(0, 5).map((adapter) => (
                <button
                  key={adapter.id}
                  type="button"
                  aria-label={`Open runtime adapter ${adapter.name}: ${adapter.statusLabel}`}
                  onClick={() => onOpenView(adapter.targetView)}
                  className="w-full rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/80 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{adapter.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{adapter.purpose}</p>
                    </div>
                    <Badge tone={adapter.tone}>{adapter.statusLabel}</Badge>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)] ring-1 ring-[var(--border)]/70">
                    <div className={`h-full rounded-full ${openControlPlaneProgressClassName[adapter.tone]}`} style={{ width: `${Math.max(5, adapter.coverage)}%` }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Button onClick={() => onOpenView("connectors")}>
                <PlugZap size={15} />
                Connect runtime
              </Button>
              <Button variant="secondary" onClick={() => onOpenView("broker")}>
                <ShieldCheck size={15} />
                Review policy
              </Button>
            </div>
          </div>
          </div>
        </details>
      </Panel>

      <Panel className="order-[20] mt-3 overflow-hidden" data-testid="estate-runtime-graph-drilldown">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">Runtime Graph Drill-Down</span>
                <Badge tone="blue">{runtimeDrilldown.traceSources} sources</Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                Inspect traces, mappings, evidence gaps, packs, reports, and proof activity.
              </span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-180" />
          </summary>
          <div className="border-y border-[var(--border)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Runtime Graph Drill-Down"
              helper="Click a graph lane to inspect imported traces, missing mappings, eval coverage, owners, report schedules, packs, and evidence gaps."
              compact
            />
            <div className="flex flex-wrap gap-2">
              {[
                ["runtime", "Runtime traces"],
                ["mappings", "Mappings"],
                ["evidence", "Evidence gaps"],
                ["packs", "Packs & reports"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedDrilldown(id as typeof selectedDrilldown)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selectedDrilldown === id
                      ? "bg-[var(--primary)] text-white shadow-[var(--shadow-button)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:bg-[var(--surface)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <MiniMetric label="Trace sources" value={String(runtimeDrilldown.traceSources)} />
              <MiniMetric label="Eval coverage" value={`${runtimeDrilldown.evalCoverage}%`} />
              <MiniMetric label="Owner coverage" value={`${runtimeDrilldown.ownerCoverage}%`} />
              <MiniMetric label="Import jobs" value={String(runtimeDrilldown.importJobs)} />
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/82">
              {selectedDrilldown === "runtime" ? (
                <DataTable
                  caption="Imported runtime sources"
                  minWidth={680}
                  columns={["Source", "Adapter", "Status", "Signals"]}
                  rows={normalizedRuntimeAssets.map((asset) => {
                    const adapter = runtimeAdapters.find((item) => item.id === asset.adapterId);
                    return [
                      <span key="source" className="block">
                        <span className="block font-semibold text-[var(--text)]">{asset.name}</span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">{asset.sourceType} · {asset.sourceId}</span>
                      </span>,
                      adapter?.name ?? asset.manifestId,
                      <span key="status" className="flex flex-wrap items-center gap-2">
                        <Badge tone={asset.status === "mapped" ? "green" : asset.status === "needs_owner" ? "amber" : "red"}>{asset.status.replace("_", " ")}</Badge>
                        <span className="text-xs text-[var(--text-muted)]">
                          {asset.proofIds.length} proof ref{asset.proofIds.length === 1 ? "" : "s"}
                        </span>
                      </span>,
                      `${asset.metrics.traces} trace · ${asset.metrics.evals} eval · ${asset.metrics.toolCalls} calls`,
                    ];
                  })}
                  emptyMessage="No runtime assets imported yet. Open Connect Apps and commit a runtime import."
                />
              ) : null}

              {selectedDrilldown === "mappings" ? (
                <DataTable
                  caption="Runtime mapping gaps"
                  minWidth={760}
                  columns={["Gap", "Type", "Action"]}
                  rows={[
                    ...runtimeDrilldown.missingMappings.map((gap) => [gap, "missing mapping", "Map source field to OS schema"]),
                    ...normalizedRuntimeAssets
                      .filter((asset) => asset.owner === "Unassigned")
                      .map((asset) => [`${asset.name}: owner`, "owner", "Assign accountable owner"]),
                  ]}
                  emptyMessage="No mapping or owner gaps detected in imported runtime assets."
                />
              ) : null}

              {selectedDrilldown === "evidence" ? (
                <DataTable
                  caption="Runtime evidence gaps"
                  minWidth={820}
                  columns={["Gap", "Risk", "Proof action"]}
                  rows={runtimeDrilldown.evidenceGaps.map((gap) => [gap, <Badge key={gap} tone="amber">needs proof</Badge>, "Attach trace, eval, approval, or value evidence"])}
                  emptyMessage="No runtime evidence gaps detected."
                />
              ) : null}

              {selectedDrilldown === "packs" ? (
                <DataTable
                  caption="Installed packs and reporting schedules"
                  minWidth={900}
                  columns={["Object", "Status", "Created", "Proof"]}
                  rows={[
                    ...installedLaunchPacks.map((pack) => [
                      pack.title,
                      <Badge key={pack.id} tone="green">installed</Badge>,
                      `${pack.createdObjects.useCases.length} use cases · ${pack.createdObjects.controls.length} controls`,
                      `${pack.proofIds.length} proof ref${pack.proofIds.length === 1 ? "" : "s"}`,
                    ]),
                    ...reportSchedules.map((schedule) => [
                      schedule.title,
                      <Badge key={schedule.id} tone={schedule.status === "active" ? "green" : schedule.status === "paused" ? "slate" : "amber"}>{schedule.status.replace("_", " ")}</Badge>,
                      `${schedule.cadence.replace("_", " ")} · ${schedule.deliveryTargets.length} targets`,
                      `${schedule.proofIds.length} proof ref${schedule.proofIds.length === 1 ? "" : "s"}`,
                    ]),
                  ]}
                  emptyMessage="No installed launch packs or report schedules yet."
                />
              ) : null}
            </div>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Proof-first activity" helper="Every adapter, import, pack, and report schedule action writes audit proof." compact />
            <div className="mt-4 space-y-2">
              {runtimeImportAudits.slice(0, 6).map((audit) => (
                <button
                  key={audit.id}
                  type="button"
                  onClick={() => onOpenView("evidence")}
                  className="w-full rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{audit.action.replaceAll("_", " ")}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{audit.message}</p>
                    </div>
                    <Badge tone={riskTone(audit.riskLevel)}>{audit.riskLevel}</Badge>
                  </div>
                  <div className="mt-2 truncate font-mono text-[11px] text-[var(--text-soft)]">{audit.proofId}</div>
                </button>
              ))}
              {!runtimeImportAudits.length ? (
                <EmptyState
                  title="No runtime proof yet"
                  body="Test an adapter, commit a runtime import, install a launch pack, or create report schedules to generate proof."
                  action="Open Connect Apps"
                  onAction={() => onOpenView("connectors")}
                />
              ) : null}
            </div>
          </div>
          </div>
        </details>
      </Panel>

      <Panel className="order-[10] mt-3 overflow-hidden" data-testid="ai-control-tower">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="AI Estate Control Plane"
                helper="The enterprise view of sanctioned AI, shadow AI, owners, providers, connectors, controls, and proof."
                compact
              />
              <Badge tone={estateControlPlane.score >= 82 ? "green" : estateControlPlane.score >= 62 ? "blue" : "amber"}>
                {estateControlPlane.score}% ready
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-5">
              {controlTowerPillars.map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  aria-label={`Open AI estate control pillar: ${pillar.title}`}
                  onClick={() => onOpenView(pillar.targetView)}
                  className="group flex min-h-[116px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/45"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    {pillar.id === "shadow-ai" ? (
                      <Radar size={16} className="text-[var(--primary)]" />
                    ) : pillar.id === "runtime-ops" ? (
                      <ServerCog size={16} className="text-[var(--primary)]" />
                    ) : (
                      <ShieldCheck size={16} className="text-[var(--primary)]" />
                    )}
                    {pillar.title}
                  </span>
                  <span className="mt-2 line-clamp-2 block flex-1 text-xs leading-5 text-[var(--text-muted)]">{pillar.body}</span>
                  <span className="mt-2 line-clamp-1 text-[11px] leading-5 text-[var(--text-soft)]">{pillar.evidence}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                    Open control
                    <ArrowRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/58 p-5 lg:border-l lg:border-t-0">
            <SectionTitle title="Control posture" helper={estateControlPlane.summary} compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Assets" value={String(estateControlPlane.metrics.governedAssets)} />
              <MiniMetric label="Shadow AI" value={String(estateControlPlane.metrics.shadowCandidates)} />
              <MiniMetric label="Permissions" value={`${estateControlPlane.metrics.permissionedSkills}/${Math.max(skills.length, 1)}`} />
              <MiniMetric label="Compliance" value={`${estateControlPlane.metrics.complianceCoverage}%`} />
            </div>
            <div className="mt-4 space-y-2">
              {estateControlPlane.priorityActions.slice(0, 3).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  aria-label={`Open AI estate priority action: ${action.title}`}
                  onClick={() => onOpenView(action.targetView)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/82 p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{action.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{action.nextAction}</p>
                    </div>
                    <Badge tone={action.tone}>{action.score}%</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="order-[30] mt-4 overflow-hidden">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="Inventory map"
                helper="A simple way to understand the estate before opening the full registry."
                compact
              />
              <Badge tone={weakestInventoryLane.readiness >= 100 ? "green" : "amber"}>
                {weakestInventoryLane.readiness >= 100 ? "all lanes ready" : `${weakestInventoryLane.label} needs attention`}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {inventoryLanes.map((lane) => {
                const LaneIcon = lane.icon;
                return (
                  <button
                    key={lane.label}
                    type="button"
                    aria-label={`Open inventory lane: ${lane.label}`}
                    onClick={() => onOpenView(lane.view)}
                    className="group flex min-h-[184px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)] ring-1 ring-[var(--border)]/70">
                        <LaneIcon size={18} />
                      </span>
                      <Badge tone={lane.tone}>{lane.readiness}% ready</Badge>
                    </span>
                    <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{lane.label}</span>
                    <span className="mt-1 text-base font-semibold text-[var(--text)]">{lane.title}</span>
                    <span className="mt-2 block flex-1 text-sm leading-6 text-[var(--text-muted)]">{lane.body}</span>
                    <span className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(5, lane.readiness)}%` }} />
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold">
                      <span className="text-[var(--text-muted)]">{lane.count} total · {lane.stat}</span>
                      <span className="inline-flex items-center gap-1 text-[var(--primary)]">
                        {lane.action}
                        <ArrowRight size={13} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Fix this lane first" helper="The weakest lane is where the inventory is least trustworthy." compact />
            <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/80 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone={weakestInventoryLane.tone}>{weakestInventoryLane.label}</Badge>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-[var(--text)]">{weakestInventoryLane.title}</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{weakestInventoryLane.readiness}%</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">ready</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{weakestInventoryLane.body}</p>
              <Button
                className="mt-4 w-full"
                data-testid="inventory-next-lane-action"
                onClick={() => onOpenView(weakestInventoryLane.view)}
              >
                {weakestInventoryLane.action}
                <ArrowRight size={14} />
              </Button>
            </div>
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-6 text-[var(--primary)]">
              Inventory becomes useful when each lane has an owner, a control, and proof. The table below is for detail; this map is the operating view.
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="order-[40] mt-4 overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Full registry"
              helper="A working list of governed Skills, proposed opportunities, model providers, and connector surfaces."
              compact
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onOpenView("governance")}>Governance</Button>
              <Button variant="secondary" onClick={() => onOpenView("evidence")}>Evidence</Button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {registry.length ? (
            <DataTable
              caption="AI estate registry"
              minWidth={1040}
              columns={["Asset", "Type", "Owner", "Status", "Risk", "Evidence", "Next control"]}
              rows={registry.map((record) => [
                <button
                  key="asset"
                  type="button"
                  aria-label={`Open AI estate asset: ${record.name}`}
                  onClick={() => onOpenView(record.targetView)}
                  className="text-left"
                >
                  <span className="block font-semibold text-[var(--text)]">{record.name}</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">{record.department} · {record.id}</span>
                </button>,
                record.type,
                record.owner,
                <Badge key="status" tone={recordStatusTone(record)}>{record.status}</Badge>,
                <Badge key="risk" tone={riskTone(record.risk)}>{record.risk}</Badge>,
                `${record.evidence} link${record.evidence === 1 ? "" : "s"}`,
                record.nextControl,
              ])}
            />
          ) : (
            <EmptyState
              title="No AI estate yet"
              body="Start with guided setup, add an AI opportunity, connect providers, and register the first governed Skill."
              action="Open guided setup"
              onAction={() => onOpenView("admin")}
            />
          )}
        </div>
      </Panel>

      <div className="order-[50] mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="p-5">
          <SectionTitle
            title="Shadow AI Intake"
            helper="Classify AI tools people may already be using, then decide whether to govern, integrate, replace, or block."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {shadowAiDiscoveries.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  aria-label={`Open shadow AI review: ${item.name}`}
                  onClick={() => onOpenView("governance")}
                  className="rounded-lg bg-[var(--surface)]/75 p-4 text-left ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
                >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{item.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{item.source}</div>
                  </div>
                  <Badge tone={riskTone(item.risk)}>{item.risk}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={item.disposition === "block" ? "red" : item.disposition === "replace" ? "amber" : "blue"}>
                    {item.disposition}
                  </Badge>
                  <span className="text-xs leading-5 text-[var(--text-muted)]">{item.usage}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{item.nextAction}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Inventory Standard" helper="What makes this enterprise-safe" />
          <div className="mt-4 space-y-3">
            {[
              ["Every AI asset has an accountable owner", skills.every((skill) => Boolean(skill.ownerId))],
              ["Every provider is stored in the tenant vault", providerRecords.some((record) => record.status === "Ready")],
              ["Every connector has setup evidence", connectorRecords.some((record) => record.status === "Ready" || record.status === "Managed")],
              ["Every production Skill has traces and evals", skills.filter((skill) => ["pilot", "production"].includes(skill.status)).every((skill) => skill.evalPassRate > 0 && runs.some((run) => run.skillId === skill.id))],
              ["Every high-risk asset has governance review", highRiskCount === 0 || governanceReviews.length > 0],
            ].map(([label, complete]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2.5">
                <div className="text-sm font-medium text-[var(--text-muted)]">{label}</div>
                <Badge tone={complete ? "green" : "amber"}>{complete ? "covered" : "open"}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Database size={16} className="text-indigo-200" />
              Inventory source of truth
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">
              Near-term: workspace records and readiness checks. Production: SSO app catalog, SIEM/DLP signals,
              procurement vendor list, connector vault, and runtime trace store.
            </p>
            <div className="mt-3 text-sm font-semibold tabular-nums text-white">{formatCurrency(registry.reduce((sum, record) => sum + record.value, 0))}</div>
            <div className="text-xs text-[var(--text-soft)]">tracked and estimated annualized value in this estate</div>
          </div>
        </Panel>
      </div>

      <div className="order-[60] mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Agent Permission Graph"
              helper="Every agent needs a visible path from identity to knowledge, tools, destinations, approvals, and rollback."
            />
            <Badge tone="purple">{agentPermissionSurfaces.length} surfaces</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {agentPermissionSurfaces.map((surface) => (
                <button
                  key={surface.surface}
                  type="button"
                  aria-label={`Open agent permission surface: ${surface.surface}`}
                  onClick={() => onOpenView(surface.targetView)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 p-4 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/45"
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    {surface.surface === "Tool actions" ? (
                      <Network size={16} className="text-[var(--primary)]" />
                    ) : surface.surface === "Knowledge access" ? (
                      <Database size={16} className="text-[var(--primary)]" />
                    ) : (
                      <LockKeyhole size={16} className="text-[var(--primary)]" />
                    )}
                    {surface.surface}
                  </div>
                  <Badge tone={riskTone(surface.risk)}>{surface.risk}</Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{surface.control}</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--text-soft)]">{surface.evidence}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <SectionTitle
              title="Vendor & Model Risk"
              helper="Track the external AI stack like a controlled vendor portfolio, not a loose list of tools."
              compact
            />
          </div>
          <DataTable
            caption="Vendor and model risk controls"
            minWidth={760}
            columns={["Category", "Examples", "Risk", "Required control"]}
            rows={vendorRiskRecords.map((record) => [
              <div key={`${record.category}-category`}>
                <div className="font-semibold text-[var(--text)]">{record.category}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{record.evidence}</div>
              </div>,
              record.examples,
              <Badge key={`${record.category}-risk`} tone={riskTone(record.risk)}>{record.risk}</Badge>,
              record.control,
            ])}
          />
        </Panel>
      </div>
    </div>
  );
}
