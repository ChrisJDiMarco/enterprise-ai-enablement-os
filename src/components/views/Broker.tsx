import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Clock3, LockKeyhole, Network, ShieldCheck, Workflow, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge, Button, CollapsibleSection, DataTable, EmptyState, MiniMetric, OperatingBrief, Panel, SectionTitle, riskTone, statusTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { tools, type AuditLog, type ToolRequest } from "@/lib/enterprise-ai-data";
import type { IntegrationBlueprint, IntegrationZone } from "@/lib/integration-blueprint";
import { openClawIntegration, openClawPolicyPatch, openClawRiskScore, openClawStatusTone } from "@/lib/openclaw-integration";
import type { ProductionReadiness } from "@/lib/ui/types";

function formatBrokerTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatBrokerEvent(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function Broker({
  toolRequests,
  auditLogs,
  onDecision,
  onOpenConnectors,
  integrationBlueprint,
  productionReadiness,
}: {
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  onDecision: (request: ToolRequest, decision: "approved" | "rejected") => void;
  onOpenConnectors: () => void;
  integrationBlueprint: IntegrationBlueprint;
  productionReadiness: ProductionReadiness | null;
}) {
  const [decisionNotice, setDecisionNotice] = useState("");

  if (!tools.length && !toolRequests.length && !auditLogs.length) {
    return (
      <div>
        <PageHeader title="Tool Permissions" subtitle="Approve or block the moments when AI wants to use real company tools." />
        <EmptyState
          title="No connector tools configured"
          body="Add approved tools and connector policies before Skills can request enterprise actions. Production deployments should bind these tools to real identity, permission, approval, and audit services."
          action="Open Connect Apps"
          onAction={onOpenConnectors}
        />
      </div>
    );
  }

  const enabledTools = tools.filter((tool) => tool.enabled).length;
  const approvalTools = tools.filter((tool) => tool.requiresApprovalByDefault).length;
  const pendingRequests = toolRequests.filter((request) => request.status === "pending").length;
  const blockedEvents = [
    ...toolRequests.filter((request) => request.status === "blocked" || request.status === "rejected"),
    ...auditLogs.filter((log) => log.eventType.includes("blocked") || log.eventType.includes("violation")),
  ].length;
  const toolCategories = [...new Set(tools.map((tool) => tool.category))];
  const highRiskTools = tools.filter((tool) => ["high", "restricted"].includes(tool.riskLevel));
  const integrationTone: Record<IntegrationZone["status"], "green" | "amber" | "red"> = {
    ready: "green",
    partial: "amber",
    missing: "red",
  };
  const connectorStatusTone: Record<string, "green" | "blue" | "amber" | "red"> = {
    ready: "green",
    "broker-managed": "blue",
    partial: "amber",
    missing: "red",
  };
  const connectorCatalog = productionReadiness?.connectors?.catalog;
  const connectorMode = productionReadiness?.connectors?.mode ?? connectorCatalog?.brokerMode ?? "policy-only";
  const connectorProgress = connectorCatalog
    ? Math.round(
        ((connectorCatalog.readyCount + connectorCatalog.partialCount * 0.5) /
          Math.max(connectorCatalog.requiredCount, 1)) *
          100,
      )
    : integrationBlueprint.score;
  const executionModeLabel =
    connectorMode === "mcp-broker"
      ? "External MCP broker"
      : connectorMode === "connector-broker"
        ? "External connector broker"
        : connectorCatalog?.readyCount
          ? "Native connector-ready"
          : "Policy-only simulation";
  const executionModeShortLabel =
    connectorMode === "mcp-broker"
      ? "MCP broker"
      : connectorMode === "connector-broker"
        ? "Connector broker"
        : connectorCatalog?.readyCount
          ? "Native-ready"
          : "Policy-only";
  const executionModeTone =
    connectorMode === "policy-only" ? (connectorCatalog?.readyCount ? "amber" : "red") : "green";
  const executionModeDescription =
    connectorMode === "mcp-broker"
      ? "Tool actions are routed to the external MCP broker after local policy approval."
      : connectorMode === "connector-broker"
        ? "Tool actions are routed to the external connector broker after local policy approval."
        : connectorCatalog?.readyCount
          ? "Recognized connectors can run through native adapters; unknown tools are still recorded as policy-only events."
          : "No external action is executed. The OS evaluates policy, records evidence, and echoes payloads until a broker or native connector secrets are configured.";
  const nextPendingRequest = toolRequests.find((request) => request.status === "pending");
  const riskyPendingRequests = toolRequests.filter((request) => request.status === "pending" && ["high", "restricted"].includes(request.riskLevel));
  const permissionControls = [
    enabledTools > 0,
    approvalTools > 0,
    pendingRequests === 0,
    auditLogs.length > 0,
    connectorMode !== "policy-only" || Boolean(connectorCatalog?.readyCount),
  ];
  const permissionScore = Math.round((permissionControls.filter(Boolean).length / permissionControls.length) * 100);
  const nextPermissionAction =
    nextPendingRequest
      ? {
          title: `Review ${nextPendingRequest.toolId} before it acts`,
          body: `${nextPendingRequest.user} requested a ${nextPendingRequest.riskLevel}-risk tool action. Decide here before any external system is touched.`,
          label: "Review request",
          tone: nextPendingRequest.riskLevel === "high" || nextPendingRequest.riskLevel === "restricted" ? "red" : "amber",
          icon: AlertTriangle,
        }
      : connectorMode === "policy-only" && !connectorCatalog?.readyCount
        ? {
            title: "Connect the first real action system",
            body: "The permission layer is evaluating policy, but actions are still simulation-only until a connector or broker is configured.",
            label: "Open Connect Apps",
            tone: "amber",
            icon: Network,
          }
        : approvalTools === 0
          ? {
              title: "Add approval gates before broad rollout",
              body: "At least one tool should require human approval by default so risky actions pause before execution.",
              label: "Configure approval gates",
              tone: "amber",
              icon: LockKeyhole,
            }
          : {
              title: "No tool decisions are waiting",
              body: "The queue is clear. New AI tool actions will appear here when a Skill asks to use a governed company system.",
              label: "Review controls",
              tone: "green",
              icon: CheckCircle2,
            };
  const NextPermissionIcon = nextPermissionAction.icon;
  const pendingDecisionGuide = nextPendingRequest
    ? [
        {
          label: "AI wants to use",
          value: nextPendingRequest.toolId,
          helper: `Requested by ${nextPendingRequest.user}`,
        },
        {
          label: "Why it paused",
          value: `${nextPendingRequest.riskLevel} risk`,
          helper: nextPendingRequest.reason,
        },
        {
          label: "If approved",
          value: "Run can continue",
          helper:
            connectorMode === "policy-only" && !connectorCatalog?.readyCount
              ? "The decision is recorded, but external execution stays simulated until connectors are configured."
              : "The approved action can route through the configured broker or connector path.",
        },
        {
          label: "If rejected",
          value: "No action runs",
          helper: "The run is blocked safely and the rejection becomes audit evidence.",
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Tool Permissions"
        subtitle="Approve, reject, and audit the moments when AI wants to use real company tools."
        action={
          <Button variant="secondary" onClick={onOpenConnectors}>
            <Network size={16} />
            Open Connect Apps
          </Button>
        }
      />
      <Panel className="mb-4 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextPermissionAction.tone as "green" | "amber" | "red"}>{permissionScore}% controlled</Badge>
              <Badge tone={pendingRequests ? "amber" : "green"}>{pendingRequests ? `${pendingRequests} waiting` : "queue clear"}</Badge>
              <Badge tone={executionModeTone}>{executionModeShortLabel}</Badge>
            </div>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                    <NextPermissionIcon size={20} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{nextPermissionAction.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{nextPermissionAction.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {nextPendingRequest ? (
                  <>
                    <Button
                      onClick={() => {
                        onDecision(nextPendingRequest, "approved");
                        setDecisionNotice(`Approval granted for ${nextPendingRequest.toolId}. The run can continue and the decision is now audit evidence.`);
                      }}
                    >
                      <CheckCircle2 size={15} />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        onDecision(nextPendingRequest, "rejected");
                        setDecisionNotice(`Tool request rejected for ${nextPendingRequest.toolId}. No external action will be executed.`);
                      }}
                    >
                      <XCircle size={15} />
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button className="whitespace-nowrap" onClick={onOpenConnectors}>
                    <ArrowRight size={15} />
                    {nextPermissionAction.label}
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Pending" value={`${pendingRequests} requests`} />
              <MiniMetric label="Risky pending" value={`${riskyPendingRequests.length} high risk`} />
              <MiniMetric label="Approval tools" value={`${approvalTools} gated`} />
              <MiniMetric label="Audit events" value={`${auditLogs.length} logged`} />
            </div>
          </div>
          <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/72 p-6 xl:border-l xl:border-t-0">
            {nextPendingRequest ? (
              <>
                <SectionTitle title="Decision guide" helper="Everything an approver needs before choosing." compact />
                <div className="mt-4 space-y-2">
                  {pendingDecisionGuide.map((item) => (
                    <div key={item.label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--text)]">{item.value}</div>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <SectionTitle title="Permission Path" helper="The plain-English control chain before AI touches company systems." compact />
                <div className="mt-4 space-y-2">
                  {[
                    ["Policy check", "Skill, user, tool, risk, and action are evaluated.", true],
                    ["Human pause", `${approvalTools} tools require approval by default.`, approvalTools > 0],
                    ["Decision queue", pendingRequests ? `${pendingRequests} request${pendingRequests === 1 ? "" : "s"} waiting.` : "No decisions waiting.", pendingRequests === 0],
                    ["Execution route", executionModeDescription, connectorMode !== "policy-only" || Boolean(connectorCatalog?.readyCount)],
                  ].map(([label, helper, complete]) => (
                    <div key={String(label)} className="flex gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/74 p-3">
                      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"}`}>
                        {complete ? <CheckCircle2 size={15} /> : <Clock3 size={14} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--text)]">{label as string}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{helper as string}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Panel>
      <Panel className="mb-4 overflow-hidden" data-testid="openclaw-policy-compiler">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">Agent gateway policy compiler</span>
              <Badge tone={openClawRiskScore >= 80 ? "green" : "amber"}>{openClawRiskScore}% controls passing</Badge>
              <Badge tone={openClawStatusTone(openClawIntegration.gateway.sandboxMode)}>
                {openClawIntegration.gateway.sandboxMode.replace("-", " ")}
              </Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Generate the policy a connected agent gateway should actually run with
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Enablement OS turns risk decisions into a concrete gateway policy: internal-only exposure,
              user-scoped auth, Skill allowlists, approval-gated writes, untrusted-source blocking, and proof export.
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {openClawIntegration.riskControls.slice(0, 6).map((control) => (
                <button
                  key={control.id}
                  type="button"
                  onClick={onOpenConnectors}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/74 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{control.label}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{control.why}</p>
                    </div>
                    <Badge tone={openClawStatusTone(control.status)}>
                      {control.status === "pass" ? "pass" : control.status === "warn" ? "review" : "block"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-slate-950 p-4 text-white lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle title="Generated policy" helper="Draft patch ready for gateway review" compact />
              <Badge tone="blue">YAML</Badge>
            </div>
            <pre className="mt-4 max-h-[300px] overflow-auto rounded-lg bg-black/30 p-3 text-xs leading-5 text-slate-200">
              {openClawPolicyPatch}
            </pre>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[var(--text)]">
              <MiniMetric label="Agents covered" value={String(openClawIntegration.agents.length)} />
              <MiniMetric label="Skill assets" value={String(openClawIntegration.skills.length)} />
            </div>
            <Button className="mt-4 w-full" onClick={onOpenConnectors}>
              <ShieldCheck size={15} />
              Open Connect Apps
            </Button>
          </div>
        </div>
      </Panel>
      <details className="group mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)]">Advanced broker control chain</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
              Open for connector readiness, policy stages, broker mode, and audit controls.
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>
        <div className="border-t border-[var(--border)] p-4">
          <OperatingBrief
            eyebrow="tool action safety boundary"
            title="Keep AI helpful without letting it act unreviewed"
            body="Tool Permissions is the control layer for Skills and agents: it checks policy, pauses risky actions for a human decision, routes approved work to connectors, and turns every decision into audit evidence."
            status={{ label: executionModeLabel, tone: executionModeTone }}
            progress={{ value: connectorProgress, label: "connector readiness" }}
            primaryAction={{ label: "Open Connect Apps", onClick: onOpenConnectors, icon: Network }}
            signals={[
              {
                label: "Mode",
                value: executionModeShortLabel,
                helper: connectorMode === "policy-only" ? "safe fallback; no external action" : "live broker path after policy",
                tone: executionModeTone,
                badge: connectorMode,
              },
              { label: "Enabled tools", value: enabledTools, helper: `${tools.length} registered in catalog`, tone: "blue" },
              { label: "Approval-gated", value: approvalTools, helper: "human review by default", tone: "amber" },
              {
                label: "Pending / blocked",
                value: `${pendingRequests} / ${blockedEvents}`,
                helper: pendingRequests || blockedEvents ? "review evidence captured" : "queue clear",
                tone: pendingRequests ? "amber" : blockedEvents ? "red" : "green",
                badge: pendingRequests ? "review" : "clear",
              },
            ]}
            checklistTitle="Broker control chain"
            checklistHelper="A production tool call should pass each stage before anything touches Slack, Teams, Jira, ServiceNow, Workday, or internal systems."
            checklist={[
              { label: "Policy evaluated before execution", helper: "Skill, user, tool, and action are checked", complete: true },
              { label: "Human approval gates configured", helper: `${approvalTools} default approval tools`, complete: approvalTools > 0 },
              {
                label: "MCP/native execution configured",
                helper: executionModeDescription,
                complete: connectorMode !== "policy-only" || Boolean(connectorCatalog?.readyCount),
                onClick: onOpenConnectors,
              },
              {
                label: "Approval queue under control",
                helper: pendingRequests ? `${pendingRequests} pending request${pendingRequests === 1 ? "" : "s"}` : "No pending tool approvals",
                complete: pendingRequests === 0,
              },
              {
                label: "Audit evidence captured",
                helper: `${auditLogs.length} Broker or Harness events available`,
                complete: auditLogs.length > 0,
              },
            ]}
          />
        </div>
      </details>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <SectionTitle title="Tools" compact />
          </div>
          <DataTable
            caption="MCP Broker tool catalog"
            columns={["Tool", "Category", "Action", "Risk", "Enabled", "Default Approval", "Usage", "Last Used"]}
            rows={tools.map((tool) => [
              <div key="tool">
                <div className="font-semibold text-[var(--text)]">{tool.id}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{tool.description}</div>
              </div>,
              tool.category,
              tool.actionType,
              <Badge key="risk" tone={riskTone(tool.riskLevel)}>{tool.riskLevel}</Badge>,
              <Badge key="enabled" tone={tool.enabled ? "green" : "red"}>{tool.enabled ? "Enabled" : "Disabled"}</Badge>,
              <Badge key="approval" tone={tool.requiresApprovalByDefault ? "amber" : "green"}>{tool.requiresApprovalByDefault ? "Required" : "None"}</Badge>,
              tool.usage.toLocaleString(),
              tool.lastUsed,
            ])}
          />
        </Panel>

        <Panel className="p-5">
          <SectionTitle title="Connector Control Plane" helper="Enterprise broker posture" />
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <ShieldCheck size={16} className="text-[var(--primary)]" />
                  {executionModeLabel}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{executionModeDescription}</p>
              </div>
              <Badge tone={executionModeTone}>{connectorMode}</Badge>
            </div>
            <div className="mt-4 h-2 rounded-full bg-[var(--border)]/80">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500"
                style={{ width: `${Math.min(Math.max(connectorProgress, 0), 100)}%` }}
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric label="Categories" value={String(toolCategories.length)} />
            <MiniMetric label="High-risk tools" value={String(highRiskTools.length)} />
          </div>
          {connectorCatalog?.connectors.length ? (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">MCP Server Registry</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">Connector endpoints treated as security-critical assets</div>
                </div>
                <Badge tone={connectorCatalog.productionReady ? "green" : "amber"}>
                  {connectorCatalog.readyCount}/{connectorCatalog.requiredCount} ready
                </Badge>
              </div>
              <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {connectorCatalog.connectors.map((connector) => {
                  const completedSteps = connector.activationChecklist?.filter((step) => step.status === "complete").length ?? 0;
                  const totalSteps = connector.activationChecklist?.length ?? 0;
                  return (
                    <div key={connector.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">{connector.label}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{connector.system}</div>
                        </div>
                        <Badge tone={connectorStatusTone[connector.status]}>{connector.status}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                        <span>{connector.executionMode}</span>
                        <span>{completedSteps}/{totalSteps} activation checks</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {[
              ["Identity-bound execution", "Every tool call is evaluated against user, Skill, action, and policy context."],
              ["Human approval gates", "Write, external, high-risk, or default approval tools pause before execution."],
              ["Complete audit trail", "Requests, decisions, blocks, and executions feed the Evidence Ledger."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <LockKeyhole size={15} className="text-[var(--primary)]" />
                  {title}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <CollapsibleSection
        className="mt-4"
        title="Execution ecosystem"
        summary="The Broker's policy boundary across real tools, automation platforms, durable workflows, RPA, and persistent agents."
      >
        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <Badge tone={integrationTone[integrationBlueprint.status]}>
              integration posture {integrationBlueprint.score}/100
            </Badge>
            <h2 className="mt-3 text-lg font-bold">Execution Ecosystem</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              The Broker is the policy boundary between the OS and the company&apos;s real tools, automation platforms,
              durable workflows, RPA, persistent agents, and human approvals.
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-[var(--surface)]/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Next integration move</div>
              <div className="mt-2 text-sm font-semibold text-white">{integrationBlueprint.primaryNextAction.name}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{integrationBlueprint.primaryNextAction.nextAction}</p>
            </div>
          </div>

          <div className="grid gap-px bg-[var(--surface-subtle)] md:grid-cols-2 2xl:grid-cols-3">
            {integrationBlueprint.runners.map((runner) => (
              <div key={runner.id} className="bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                      {runner.id === "persistent-agent" ? <Bot size={15} className="text-[var(--primary)]" /> : <Workflow size={15} className="text-[var(--primary)]" />}
                      {runner.name}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{runner.bestFor}</p>
                  </div>
                  <Badge tone={integrationTone[runner.status]}>{runner.status}</Badge>
                </div>
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">When to use</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{runner.whenToUse}</p>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{runner.guardrail}</p>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle title="Tool Requests Queue" />
          {decisionNotice ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-4 py-3 text-sm font-medium text-[var(--primary)]"
            >
              {decisionNotice}
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {!toolRequests.length ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/70 p-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text)]">
                  <ShieldCheck size={18} className="text-[var(--success)]" />
                  Approval queue is clear
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  When a Skill requests a gated connector action, the Broker will pause the run here before anything is executed.
                </p>
              </div>
            ) : toolRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{request.toolId}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{request.requestedAt}</div>
                  </div>
                  <Badge tone={statusTone(request.status)}>{request.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--text-muted)]">{request.reason}</p>
                {request.status === "pending" ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        onDecision(request, "approved");
                        setDecisionNotice(`Approval granted for ${request.toolId}. The run can continue and the decision is now audit evidence.`);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        onDecision(request, "rejected");
                        setDecisionNotice(`Tool request rejected for ${request.toolId}. No external action will be executed.`);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <SectionTitle title="Broker Logs" compact />
          </div>
          <DataTable
            caption="MCP Broker audit log"
            columns={["Time", "Event", "Actor", "Risk", "Message"]}
            rows={auditLogs.map((log) => [
              formatBrokerTimestamp(log.createdAt),
              formatBrokerEvent(log.eventType),
              log.actor,
              <Badge key="risk" tone={riskTone(log.riskLevel)}>{log.riskLevel}</Badge>,
              log.message,
            ])}
          />
        </Panel>
      </div>
    </div>
  );
}
