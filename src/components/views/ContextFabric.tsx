import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Badge, Button, EmptyState, Field, MetricCard, MiniMetric, Panel, SectionTitle, StatusNotice } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { ContextSource, Skill } from "@/lib/enterprise-ai-data";

type RetrievalItem = {
  sourceId: string;
  sourceName: string;
  score: number;
  snippet: string;
  permission: "allowed" | "filtered";
};

type RetrievalDecision = {
  status: "approved" | "requires_approval" | "blocked";
  reason: string;
  policyId: string;
  riskLevel: string;
  allowedSourceIds: string[];
};

type RetrievalResponse = {
  schema: string;
  organizationId: string;
  decision: RetrievalDecision;
  results: RetrievalItem[];
  indexedResults: RetrievalItem[];
};

type ContextIndexStats = {
  totalDocuments: number;
  sources: {
    sourceId: string;
    sourceName: string;
    documents: number;
    classification: string;
    lastUpdatedAt: string;
  }[];
};

function sourceAllowedForSkill(source: ContextSource, skill: Skill | null) {
  if (!skill) return false;
  const allowed = new Set(skill.contextSources.map((item) => item.toLowerCase()));
  return allowed.has(source.id.toLowerCase()) || allowed.has(source.name.toLowerCase());
}

function sourceTone(source: ContextSource): "green" | "amber" | "red" | "blue" {
  if (!source.enabled) return "red";
  if (source.health === "stale") return "red";
  if (source.health === "attention") return "amber";
  if (["restricted", "regulated"].includes(source.classification)) return "amber";
  return "green";
}

function decisionTone(status?: RetrievalDecision["status"]): "green" | "amber" | "red" | "blue" {
  if (status === "approved") return "green";
  if (status === "requires_approval") return "amber";
  if (status === "blocked") return "red";
  return "blue";
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function formatIndexDate(value: string) {
  if (!value) return "Not indexed";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

export function ContextFabric({
  query,
  setQuery,
  selectedSkill,
  skills,
  sources,
  onSelectSkill,
  onOpenAdmin,
  onOpenSkills,
}: {
  query: string;
  setQuery: (value: string) => void;
  selectedSkill: Skill | null;
  skills: Skill[];
  sources: ContextSource[];
  onSelectSkill: (skillId: string) => void;
  onOpenAdmin: () => void;
  onOpenSkills: () => void;
}) {
  const effectiveSkill = selectedSkill ?? skills[0] ?? null;
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [retrievalMessage, setRetrievalMessage] = useState("");
  const [retrievalError, setRetrievalError] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [indexStats, setIndexStats] = useState<ContextIndexStats | null>(null);
  const [indexMessage, setIndexMessage] = useState("");

  const enabledSources = sources.filter((source) => source.enabled);
  const healthySources = sources.filter((source) => source.health === "healthy");
  const sensitiveSources = sources.filter((source) => ["confidential", "restricted", "regulated"].includes(source.classification));
  const totalDocs = sources.reduce((sum, source) => sum + source.documentCount, 0);
  const staleSources = sources.filter((source) => source.health !== "healthy");
  const approvedSourceCount = sources.filter((source) => sourceAllowedForSkill(source, effectiveSkill)).length;
  const missingApprovedSources = (effectiveSkill?.contextSources ?? []).filter(
    (sourceName) => !sources.some((source) => source.id.toLowerCase() === sourceName.toLowerCase() || source.name.toLowerCase() === sourceName.toLowerCase()),
  );
  const sourceCoverage = Math.round((enabledSources.length / Math.max(sources.length, 1)) * 100);

  const retrievalSources = useMemo(() => sources.filter((source) => source.enabled), [sources]);
  const filteredSources = useMemo(
    () => retrievalSources.filter((source) => !sourceAllowedForSkill(source, effectiveSkill)),
    [effectiveSkill, retrievalSources],
  );
  const allowedSources = useMemo(
    () => sources.filter((source) => sourceAllowedForSkill(source, effectiveSkill)),
    [effectiveSkill, sources],
  );
  const permissionScore = Math.round(
    (
      (effectiveSkill ? 100 : 0) +
      (allowedSources.length ? 100 : 0) +
      (enabledSources.length ? 100 : 0) +
      (staleSources.length ? 35 : 100) +
      (missingApprovedSources.length ? 35 : 100)
    ) / 5,
  );

  function focusKnowledgeQuestion() {
    setRetrievalError("");
    const questionInput =
      document.getElementById("context-primary-question") ?? document.getElementById("context-packet-question");
    if (!questionInput) return;

    const workspaceScroller = document.getElementById("workspace-main-content");
    if (workspaceScroller) {
      const scrollerRect = workspaceScroller.getBoundingClientRect();
      const inputRect = questionInput.getBoundingClientRect();
      const nextTop =
        inputRect.top - scrollerRect.top + workspaceScroller.scrollTop - workspaceScroller.clientHeight / 2 + inputRect.height / 2;
      workspaceScroller.scrollTop = Math.max(0, nextTop);
    } else {
      questionInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (questionInput instanceof HTMLTextAreaElement) {
      questionInput.focus();
    }
  }

  const nextContextAction =
    !effectiveSkill
      ? {
          title: "Choose a Skill before testing knowledge",
          body: "Context safety is evaluated per Skill. Pick or create the Skill, then approve the sources it is allowed to retrieve.",
          label: "Open Skills",
          action: onOpenSkills,
          tone: "purple" as const,
          icon: SlidersHorizontal,
        }
      : !effectiveSkill.contextSources.length
        ? {
            title: "Attach approved sources to this Skill",
            body: `${effectiveSkill.name} has no context contract yet, so every knowledge request will be blocked or empty.`,
            label: "Configure Skill Context",
            action: onOpenSkills,
            tone: "amber" as const,
            icon: LockKeyhole,
          }
        : !retrievalSources.length
          ? {
              title: "Enable a source before running retrieval",
              body: "The Skill has source references, but the tenant does not have enabled context sources available for a model packet.",
              label: "Open Settings",
              action: onOpenAdmin,
              tone: "red" as const,
              icon: Database,
            }
          : staleSources.length || missingApprovedSources.length
            ? {
                title: "Fix context gaps before launch",
                body: `${staleSources.length + missingApprovedSources.length} source issue${staleSources.length + missingApprovedSources.length === 1 ? "" : "s"} could weaken answers or hide approved knowledge.`,
                label: staleSources.length ? "Check Index" : "Configure Skill Context",
                action: staleSources.length ? () => void refreshIndexStats() : onOpenSkills,
                tone: "amber" as const,
                icon: AlertTriangle,
              }
            : !query.trim()
              ? {
                  title: "Enter a knowledge-check question",
                  body: `${effectiveSkill.name} has approved, enabled context. Add a realistic company question so the model packet can be previewed before any answer is generated.`,
                  label: "Enter Question",
                  action: focusKnowledgeQuestion,
                  tone: "blue" as const,
                  icon: Search,
                }
              : {
                  title: "Run a safe knowledge check",
                  body: `${effectiveSkill.name} has approved, enabled context. Ask a realistic question and preview exactly what reaches the model.`,
                  label: "Run Retrieval Test",
                  action: () => void runRetrievalTest(),
                  tone: "green" as const,
                  icon: BookOpenCheck,
                };
  const NextContextIcon = nextContextAction.icon;

  useEffect(() => {
    void refreshIndexStats();
  }, []);

  async function refreshIndexStats() {
    setIndexMessage("Checking index...");
    try {
      const response = await fetch("/api/context/index", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { stats?: ContextIndexStats; error?: string; detail?: string } | null;
      if (!response.ok) throw new Error(payload?.detail || payload?.error || `Context index returned ${response.status}`);
      setIndexStats(payload?.stats ?? null);
      setIndexMessage(payload?.stats ? `Index checked: ${payload.stats.totalDocuments.toLocaleString()} indexed documents` : "Index checked");
    } catch (error) {
      setIndexMessage(error instanceof Error ? error.message : "Context index check failed");
    }
  }

  async function runRetrievalTest() {
    setRetrievalError("");
    setRetrievalMessage("");
    setRetrieval(null);

    if (!effectiveSkill) {
      setRetrievalError("Select or create a Skill before running a retrieval test.");
      return;
    }
    if (!query.trim()) {
      setRetrievalError("Enter a retrieval question before running the test.");
      return;
    }
    if (!effectiveSkill.contextSources.length) {
      setRetrievalError("No context sources are approved for this Skill yet. Open AI Skills to attach approved sources.");
      return;
    }
    if (!retrievalSources.length) {
      setRetrievalError("No enabled context sources are available. Connect and classify sources before testing retrieval.");
      return;
    }

    setIsRetrieving(true);
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/context/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: effectiveSkill.id,
          query: query.trim(),
          limit: 6,
        }),
      });
      const payload = (await response.json().catch(() => null)) as RetrievalResponse | { error?: string; detail?: string } | null;
      if (!response.ok || !payload || !("results" in payload)) {
        throw new Error((payload as { detail?: string; error?: string } | null)?.detail || (payload as { error?: string } | null)?.error || `Retrieval API returned ${response.status}`);
      }
      setRetrieval(payload);
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      setRetrievalMessage(
        `Retrieval test completed for ${effectiveSkill.name}: ${payload.results.length} model packet item${payload.results.length === 1 ? "" : "s"}, ${payload.indexedResults.length} indexed result${payload.indexedResults.length === 1 ? "" : "s"}, ${filteredSources.length} filtered source${filteredSources.length === 1 ? "" : "s"} in ${elapsedMs} ms.`,
      );
    } catch (error) {
      setRetrievalError(error instanceof Error ? error.message : "Retrieval test failed");
    } finally {
      setIsRetrieving(false);
    }
  }

  const modelPacket = retrieval?.results ?? [];
  const decision = retrieval?.decision;
  const contextPathSteps: {
    label: string;
    body: string;
    complete: boolean;
    action: string;
    onClick: () => void;
    tone: "green" | "amber" | "red" | "blue" | "slate";
  }[] = [
    {
      label: "Choose a Skill",
      body: effectiveSkill
        ? `${effectiveSkill.name} is the Skill being tested.`
        : "Pick the Skill before approving knowledge.",
      complete: Boolean(effectiveSkill),
      action: "Open Skills",
      onClick: onOpenSkills,
      tone: effectiveSkill ? "green" : "amber",
    },
    {
      label: "Approve sources",
      body: allowedSources.length
        ? `${allowedSources.length} source${allowedSources.length === 1 ? "" : "s"} are approved for this Skill.`
        : "Attach the exact sources this Skill may retrieve.",
      complete: allowedSources.length > 0,
      action: "Configure Context",
      onClick: onOpenSkills,
      tone: allowedSources.length ? "green" : "amber",
    },
    {
      label: "Check source health",
      body: staleSources.length || missingApprovedSources.length
        ? `${staleSources.length + missingApprovedSources.length} source issue${staleSources.length + missingApprovedSources.length === 1 ? "" : "s"} need owner attention.`
        : "Enabled sources are indexed and catalog references resolve.",
      complete: !staleSources.length && !missingApprovedSources.length && sources.length > 0,
      action: staleSources.length ? "Check Index" : "Open Settings",
      onClick: staleSources.length ? () => void refreshIndexStats() : onOpenAdmin,
      tone: staleSources.length || missingApprovedSources.length ? "amber" : sources.length ? "green" : "slate",
    },
    {
      label: "Preview model packet",
      body: decision
        ? `${decision.status.replace("_", " ")} by ${decision.policyId}; ${modelPacket.length} snippet${modelPacket.length === 1 ? "" : "s"} would reach the model.`
        : query.trim()
          ? "Run a retrieval test to see the exact permission-filtered packet."
          : "Enter a realistic question before previewing the permission-filtered packet.",
      complete: Boolean(decision && decision.status === "approved"),
      action: query.trim() ? "Run Test" : "Enter Question",
      onClick: query.trim() ? () => void runRetrievalTest() : focusKnowledgeQuestion,
      tone: decision ? decisionTone(decision.status) : "blue",
    },
  ];
  const contextPathComplete = Math.round(
    (contextPathSteps.filter((step) => step.complete).length / contextPathSteps.length) * 100,
  );
  const nextContextPathStep = contextPathSteps.find((step) => !step.complete);
  const retrievalDisabledReason =
    isRetrieving
      ? ""
      : !effectiveSkill
        ? "Create or select a Skill before running a retrieval test."
        : !query.trim()
          ? "Enter a knowledge-check question to preview the model packet."
          : !effectiveSkill.contextSources.length
            ? "Attach approved sources to this Skill before testing retrieval."
            : !retrievalSources.length
              ? "Enable at least one knowledge source before testing retrieval."
              : "";
  const retrievalControlReason = isRetrieving ? "Retrieval test is running." : retrievalDisabledReason;
  const retrievalTestDisabled = isRetrieving || Boolean(retrievalDisabledReason);

  return (
    <div>
      <PageHeader
        title="Knowledge Sources"
        subtitle="Make sure each AI Skill can retrieve the right company knowledge, with permissions, citations, and source health intact."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refreshIndexStats()}>
              <RefreshCcw size={16} />
              Check Index
            </Button>
            <Button variant="secondary" onClick={onOpenSkills}>
              <SlidersHorizontal size={16} />
              Skill Context
            </Button>
          </div>
        }
      />

      <Panel className="mb-5 overflow-hidden" data-testid="context-primary-decision">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextContextAction.tone}>{permissionScore >= 80 ? "safe to test" : permissionScore >= 55 ? "needs attention" : "setup needed"}</Badge>
              <Badge tone={effectiveSkill ? "blue" : "slate"}>{effectiveSkill?.name ?? "No Skill selected"}</Badge>
              <Badge tone={staleSources.length ? "amber" : "green"}>{staleSources.length ? `${staleSources.length} source gaps` : "sources healthy"}</Badge>
            </div>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                    <NextContextIcon size={20} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{nextContextAction.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{nextContextAction.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenSkills}>
                  <SlidersHorizontal size={15} />
                  Skill context
                </Button>
                <Button
                  onClick={nextContextAction.action}
                  disabled={nextContextAction.label === "Run Test" && retrievalTestDisabled}
                  aria-describedby={nextContextAction.label === "Run Test" && retrievalControlReason ? "context-retrieval-disabled-reason" : undefined}
                  title={nextContextAction.label === "Run Test" && retrievalControlReason ? retrievalControlReason : undefined}
                >
                  <ArrowRight size={15} />
                  {nextContextAction.label}
                </Button>
              </div>
            </div>
            <div className="mt-6 hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Allowed sources" value={`${allowedSources.length} approved`} />
              <MiniMetric label="Filtered sources" value={`${filteredSources.length} blocked`} />
              <MiniMetric label="Indexed documents" value={(indexStats?.totalDocuments ?? totalDocs).toLocaleString()} />
              <MiniMetric label="Source coverage" value={`${sourceCoverage}% enabled`} />
            </div>
          </div>

          <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-5 sm:p-6 xl:border-l xl:border-t-0">
            <SectionTitle title="Knowledge Check" helper="Ask a real business question and preview the packet before the model sees it." compact />
            <div className="mt-4 space-y-4">
              <Field label="Skill">
                <select
                  className="input"
                  value={effectiveSkill?.id ?? ""}
                  onChange={(event) => onSelectSkill(event.target.value)}
                >
                  {!skills.length ? <option value="">No Skills</option> : null}
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Knowledge check question">
                <textarea
                  id="context-primary-question"
                  className="input min-h-[80px] sm:min-h-[104px]"
                  value={query}
                  placeholder="Ask a question this Skill should answer from approved company knowledge."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Field>
              <Button
                className="w-full"
                onClick={() => void runRetrievalTest()}
                disabled={retrievalTestDisabled}
                aria-describedby={retrievalControlReason ? "context-retrieval-disabled-reason" : undefined}
                title={retrievalControlReason || undefined}
              >
                <Search size={15} />
                {isRetrieving ? "Running..." : "Run safe retrieval test"}
              </Button>
              {retrievalControlReason ? (
                <StatusNotice tone={isRetrieving ? "blue" : "amber"} compact>
                  <span id="context-retrieval-disabled-reason">
                    {retrievalControlReason}
                  </span>
                </StatusNotice>
              ) : null}
              {retrievalMessage ? (
                <StatusNotice tone="blue" compact testId="context-retrieval-status">
                  {retrievalMessage}
                </StatusNotice>
              ) : null}
              {retrievalError ? (
                <StatusNotice tone="red" compact testId="context-retrieval-error">
                  {retrievalError}
                </StatusNotice>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      <details
        className="mb-5 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="context-model-path"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Model packet path and readiness</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {contextPathComplete}% ready. Open to see the checks that decide what company knowledge reaches a model.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="grid border-t border-[var(--border)] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                title="Model packet path"
                helper="The four checks that decide what company knowledge can reach a model."
                compact
              />
              <Badge tone={nextContextPathStep ? "amber" : "green"}>{contextPathComplete}% ready</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {contextPathSteps.map((step, index) => {
                const isNext = nextContextPathStep?.label === step.label;
                return (
                  <button
                    key={step.label}
                    type="button"
                    onClick={step.onClick}
                    className={`group flex min-h-[150px] flex-col rounded-lg border p-4 text-left transition ${
                      step.complete
                        ? "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] hover:border-[color-mix(in_srgb,var(--success)_36%,var(--border))]"
                        : isNext
                          ? "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_38%,var(--border))]"
                          : "border-[var(--border)] bg-[var(--surface)]/70 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                          step.complete
                            ? "bg-[var(--success)] text-white"
                            : isNext
                              ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_32%,var(--border))]"
                              : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                        }`}
                        aria-hidden="true"
                      >
                        {step.complete ? <Check size={14} /> : index + 1}
                      </span>
                      <Badge tone={step.tone}>{isNext ? "next" : step.complete ? "ready" : "open"}</Badge>
                    </span>
                    <span className="mt-4 text-sm font-semibold text-[var(--text)]">{step.label}</span>
                    <span className="mt-2 block flex-1 text-sm leading-6 text-[var(--text-muted)]">{step.body}</span>
                    {!step.complete ? (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                        {step.action}
                        <ArrowRight size={13} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Packet rule" helper="What this page is protecting" compact />
            <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <ShieldCheck size={16} className="text-[var(--primary)]" />
                Nothing reaches the model by default
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                A source must be enabled, healthy, attached to the Skill, and allowed by policy before its snippets appear in the model packet.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric label="Allowed" value={String(allowedSources.length)} />
              <MiniMetric label="Filtered" value={String(filteredSources.length)} />
              <MiniMetric label="Packet" value={`${modelPacket.length} snippets`} />
              <MiniMetric label="Policy" value={decision?.status.replace("_", " ") ?? "not tested"} />
            </div>
          </div>
        </div>
      </details>

      <details
        className="mb-5 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="context-source-catalog"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Source catalog and index health</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {enabledSources.length} enabled, {approvedSourceCount} approved for the selected Skill, {staleSources.length} needing attention.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="space-y-4 border-t border-[var(--border)] p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={Database} label="Connected Sources" value={enabledSources.length} trend={`${sources.length} cataloged`} />
            <MetricCard icon={FileText} label="Indexed Documents" value={(indexStats?.totalDocuments ?? totalDocs).toLocaleString()} trend={indexStats ? "server index" : "catalog baseline"} />
            <MetricCard icon={ShieldCheck} label="Skill-Approved" value={approvedSourceCount} trend={effectiveSkill?.name ?? "no Skill selected"} />
            <MetricCard icon={RefreshCcw} label="Healthy Indexes" value={`${healthySources.length}/${Math.max(sources.length, 1)}`} trend={`${sensitiveSources.length} sensitive sources`} danger={staleSources.length > 0} />
          </div>

          {sources.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sources.map((source) => {
                const allowed = sourceAllowedForSkill(source, effectiveSkill);
                const indexSource = indexStats?.sources.find(
                  (item) => item.sourceId === source.id || item.sourceName.toLowerCase() === source.name.toLowerCase(),
                );
                return (
                  <div key={source.id} className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition ${allowed ? "border-[var(--primary)]/35 bg-[var(--primary-soft)]/16" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{source.name}</div>
                        <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{source.type} · {source.ownerDepartment}</div>
                      </div>
                      <Badge tone={sourceTone(source)}>{source.health}</Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <MiniMetric label="Docs" value={(indexSource?.documents ?? source.documentCount).toLocaleString()} />
                      <MiniMetric label="Skills" value={String(source.skillsUsing)} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                      <Badge tone={source.classification === "restricted" || source.classification === "regulated" ? "red" : source.classification === "confidential" ? "amber" : "green"}>
                        {source.classification}
                      </Badge>
                      <Badge tone={allowed ? "green" : "slate"}>{allowed ? "Skill allowed" : "Filtered"}</Badge>
                    </div>
                    <div className="mt-3 text-[11px] leading-5 text-[var(--text-muted)]">
                      Last indexed: {formatIndexDate(indexSource?.lastUpdatedAt ?? source.lastIndexedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No context sources configured"
              body="Connect enterprise knowledge systems, classify data, and index approved sources before retrieval tests can pass context to a Skill."
              action="Open Settings"
              onAction={onOpenAdmin}
            />
          )}
        </div>
      </details>

      <details
        className="mb-5 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="context-retrieval-packet"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Retrieval result and model packet</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {modelPacket.length ? `${modelPacket.length} snippet${modelPacket.length === 1 ? "" : "s"} ready for preview.` : "Run the knowledge check above, then inspect the exact packet here."}
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="border-t border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <SectionTitle title="Retrieval Test" helper="Preview the exact permission-filtered context packet before it reaches a model." compact />
            <div className="flex flex-wrap gap-2">
              {decision ? <Badge tone={decisionTone(decision.status)}>{decision.status}</Badge> : null}
              {indexMessage ? (
                <StatusNotice
                  tone={indexMessage.includes("failed") || indexMessage.includes("returned") ? "red" : "blue"}
                  compact
                  testId="context-index-status"
                  className="max-w-[280px]"
                >
                  {indexMessage}
                </StatusNotice>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_520px]">
          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <Field label="Retrieval test question">
                <textarea
                  id="context-packet-question"
                  className="input min-h-[116px]"
                  value={query}
                  placeholder="Ask the Skill a realistic question, e.g. What PTO carryover rules apply after 3 years?"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Field>
              <Field label="Skill">
                <select
                  className="input"
                  value={effectiveSkill?.id ?? ""}
                  onChange={(event) => onSelectSkill(event.target.value)}
                >
                  {!skills.length ? <option value="">No Skills</option> : null}
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                  ))}
                </select>
                <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  {effectiveSkill ? `${effectiveSkill.contextSources.length} approved source reference${effectiveSkill.contextSources.length === 1 ? "" : "s"}` : "Create a Skill to test context retrieval."}
                </div>
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => void runRetrievalTest()}
                disabled={retrievalTestDisabled}
                aria-describedby={retrievalControlReason ? "context-retrieval-disabled-reason" : undefined}
                title={retrievalControlReason || undefined}
              >
                <Search size={16} />
                {isRetrieving ? "Running..." : "Run Retrieval Test"}
              </Button>
              <Button variant="secondary" onClick={onOpenSkills}>
                Configure Skill Context
              </Button>
            </div>

            {retrievalMessage ? (
              <StatusNotice tone="blue" className="mt-4" testId="context-packet-retrieval-status">
                {retrievalMessage}
              </StatusNotice>
            ) : null}
            {retrievalError ? (
              <StatusNotice tone="red" className="mt-4" testId="context-packet-retrieval-error">
                {retrievalError}
              </StatusNotice>
            ) : null}

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniMetric label="Allowed by Skill" value={String(approvedSourceCount)} />
              <MiniMetric label="Filtered" value={String(filteredSources.length)} />
              <MiniMetric label="Indexed hits" value={String(retrieval?.indexedResults.length ?? 0)} />
            </div>

            {decision ? (
              <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Policy Decision</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{decision.reason}</p>
                  </div>
                  <Badge tone={decisionTone(decision.status)}>{decision.policyId}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {decision.allowedSourceIds.map((source) => (
                    <span key={source} className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">{source}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">What would be passed to the model</div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Only allowed, permission-filtered snippets with source names, relevance scores, and redaction metadata.</p>
              </div>
              <Badge tone={modelPacket.length ? "green" : "slate"}>{modelPacket.length} snippets</Badge>
            </div>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {modelPacket.map((item) => {
                const source = sources.find((candidate) => candidate.id === item.sourceId || candidate.name === item.sourceName);
                return (
                  <div key={`${item.sourceId}-${item.snippet}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{item.sourceName}</div>
                        <div className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
                          {source ? `${source.type} · ${source.ownerDepartment} · ${source.classification}` : "Indexed source"}
                        </div>
                      </div>
                      <Badge tone={item.score >= 0.78 ? "green" : item.score >= 0.58 ? "amber" : "slate"}>{formatScore(item.score)}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{item.snippet}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge tone="green">permission passed</Badge>
                      <Badge tone="blue">citations retained</Badge>
                      <Badge tone="purple">PII redaction on</Badge>
                    </div>
                  </div>
                );
              })}
              {!modelPacket.length ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                  Run a retrieval test to preview the model packet. If no snippets appear, attach approved context sources to the Skill or index source documents.
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </details>

      <details
        className="overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="context-permission-proof"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Permission proof and knowledge gaps</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {missingApprovedSources.length + staleSources.length ? `${missingApprovedSources.length + staleSources.length} gap${missingApprovedSources.length + staleSources.length === 1 ? "" : "s"} need attention.` : "No source gaps are currently flagged."}
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="grid gap-4 border-t border-[var(--border)] p-5 xl:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <SectionTitle title="Permission Simulation" helper="What the Harness checks before context reaches a model" />
            <div className="mt-4 space-y-3">
              {[
                ["User role", "Only users with approved function, region, and role access can retrieve source snippets."],
                ["Skill policy", `${effectiveSkill?.name ?? "Selected Skill"} can retrieve only sources attached to its context contract.`],
                ["Data classification", "Restricted and regulated sources require stronger approval and redaction controls."],
                ["Citation boundary", "Retrieved snippets keep source names and relevance scores for traceability."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <SectionTitle title="Knowledge Gaps" helper="Sources that need owner attention before scale" />
            <div className="mt-4 space-y-3">
              {missingApprovedSources.map((sourceName) => (
                <div key={sourceName} className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] px-4 py-3">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[var(--danger)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{sourceName}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Skill policy references this source, but it is not in the tenant source catalog yet.</div>
                  </div>
                </div>
              ))}
              {staleSources.map((source) => (
                <div key={source.id} className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] px-4 py-3">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{source.name}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                      {source.health === "stale" ? "Index is stale. Re-index before relying on this source for launch decisions." : "Source needs data owner attention."}
                    </div>
                  </div>
                </div>
              ))}
              {!missingApprovedSources.length && !staleSources.length ? (
                <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] px-4 py-3 text-sm font-medium text-[var(--success)]">
                  <CheckCircle2 size={17} />
                  No source gaps are currently flagged.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
