import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  Database,
  FileCheck2,
  PlugZap,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  OperatingBrief,
  Panel,
  SectionTitle,
  riskTone,
  statusTone,
  type BadgeTone,
} from "@/components/ui";
import {
  formatCurrency,
  type AuditLog,
  type GovernanceReview,
  type Run,
  type Skill,
  type ToolRequest,
  type UseCase,
  type User,
} from "@/lib/enterprise-ai-data";
import type { IntegrationBlueprint } from "@/lib/integration-blueprint";
import type { ProviderReadiness } from "@/lib/provider-registry";
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
  governanceReviews,
  toolRequests,
  auditLogs,
  users,
  providerVault,
  productionReadiness,
  integrationBlueprint,
  onOpenView,
  onOpenSettings,
}: {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  governanceReviews: GovernanceReview[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  users: User[];
  providerVault: ProviderReadiness[];
  productionReadiness: ProductionReadiness | null;
  integrationBlueprint: IntegrationBlueprint;
  onOpenView: (view: View) => void;
  onOpenSettings: () => void;
}) {
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
  const externalAiCandidates = [
    ["Microsoft Copilot", "Microsoft 365", "identity + data boundary review"],
    ["ChatGPT Enterprise", "General AI workspace", "tenant policy and data controls"],
    ["Glean / enterprise search", "Knowledge assistant", "source permissions and citations"],
    ["ServiceNow AI Agents", "IT and HR workflows", "ticket actions through Broker"],
    ["Salesforce Einstein", "CRM workflows", "customer-data governance"],
    ["Slack AI / agents", "Collaboration", "privacy-safe signal aggregation"],
  ];

  return (
    <div>
      <PageHeader
        title="AI Inventory"
        subtitle="See every AI asset, owner, risk, provider, connector, and proof point in one place."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenSettings}>
              <BrainCircuit size={16} />
              AI Providers
            </Button>
            <Button onClick={() => onOpenView("connectors")}>
              <PlugZap size={16} />
              Connector Setup
            </Button>
          </div>
        }
      />

      <OperatingBrief
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
          { label: "Owners assigned", helper: missingOwner ? `${missingOwner} gaps remain` : "No unassigned records", complete: missingOwner === 0 && registry.length > 0, onClick: () => onOpenView("admin"), actionLabel: "Open admin" },
          { label: "Proof attached", helper: `${evidenceCount} evidence links`, complete: evidenceCount > 0, onClick: () => onOpenView("evidence"), actionLabel: "Open proof" },
          { label: "Next inventory move", helper: integrationBlueprint.primaryNextAction.name, complete: estateScore >= 80, onClick: () => onOpenView(integrationBlueprint.primaryNextAction.targetView), actionLabel: "Open" },
        ]}
      />

      <Panel className="mt-4 overflow-hidden">
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
                    onClick={() => onOpenView(lane.view)}
                    className="group flex min-h-[184px] flex-col rounded-lg border border-slate-200 bg-white/70 p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-slate-50 text-[#5147e8] ring-1 ring-slate-200/70">
                        <LaneIcon size={18} />
                      </span>
                      <Badge tone={lane.tone}>{lane.readiness}% ready</Badge>
                    </span>
                    <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{lane.label}</span>
                    <span className="mt-1 text-base font-semibold text-slate-950">{lane.title}</span>
                    <span className="mt-2 block flex-1 text-sm leading-6 text-slate-600">{lane.body}</span>
                    <span className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(5, lane.readiness)}%` }} />
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold">
                      <span className="text-slate-500">{lane.count} total · {lane.stat}</span>
                      <span className="inline-flex items-center gap-1 text-[#5147e8]">
                        {lane.action}
                        <ArrowRight size={13} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/60 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Fix this lane first" helper="The weakest lane is where the inventory is least trustworthy." compact />
            <div className="mt-4 rounded-lg border border-white bg-white/80 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone={weakestInventoryLane.tone}>{weakestInventoryLane.label}</Badge>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{weakestInventoryLane.title}</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-slate-950">{weakestInventoryLane.readiness}%</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">ready</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{weakestInventoryLane.body}</p>
              <Button
                className="mt-4 w-full"
                data-testid="inventory-next-lane-action"
                onClick={() => onOpenView(weakestInventoryLane.view)}
              >
                {weakestInventoryLane.action}
                <ArrowRight size={14} />
              </Button>
            </div>
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-6 text-[#5147e8]">
              Inventory becomes useful when each lane has an owner, a control, and proof. The table below is for detail; this map is the operating view.
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
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
                  onClick={() => onOpenView(record.targetView)}
                  className="text-left"
                >
                  <span className="block font-semibold text-slate-950">{record.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{record.department} · {record.id}</span>
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="p-5">
          <SectionTitle
            title="Discover Shadow AI Apps"
            helper="Use this intake list to classify AI tools people may already be using, then decide whether to govern, replace, integrate, or block."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {externalAiCandidates.map(([name, category, control]) => (
              <button
                key={name}
                type="button"
                onClick={() => onOpenView("governance")}
                className="rounded-lg bg-white/75 p-4 text-left ring-1 ring-slate-200/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{name}</div>
                    <div className="mt-1 text-xs text-slate-500">{category}</div>
                  </div>
                  <Badge tone="blue">intake</Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">{control}</p>
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
              <div key={String(label)} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="text-sm font-medium text-slate-700">{label}</div>
                <Badge tone={complete ? "green" : "amber"}>{complete ? "covered" : "open"}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Database size={16} className="text-indigo-200" />
              Inventory source of truth
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Near-term: workspace records and readiness checks. Production: SSO app catalog, SIEM/DLP signals,
              procurement vendor list, connector vault, and runtime trace store.
            </p>
            <div className="mt-3 text-sm font-semibold text-white">{formatCurrency(registry.reduce((sum, record) => sum + record.value, 0))}</div>
            <div className="text-xs text-slate-400">tracked and estimated annualized value in this estate</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
