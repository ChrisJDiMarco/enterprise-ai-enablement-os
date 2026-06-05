import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  GitBranch,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  AuditLog,
  EvalResult,
  GovernanceReview,
  RiskLevel,
  Run,
  Skill,
  ToolRequest,
  UseCase,
} from "@/lib/enterprise-ai-data";
import { deriveAgentControlPlane } from "@/lib/agent-control-plane";
import { deriveEvidenceGraph, type EvidenceGraphNode } from "@/lib/evidence-graph";
import type { View } from "@/lib/ui/types";
import { statusLabels } from "@/lib/ui/constants";
import { copyTextOrDownload, downloadJsonFile, timestampedExportFilename } from "@/lib/ui/export-utils";
import { Badge, Button, MiniMetric, Panel, riskTone, SectionTitle } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type EvidenceRow = {
  id: string;
  source: string;
  store: string;
  type: string;
  item: string;
  itemType: "audit" | "eval" | "review" | "run" | "security" | "skill" | "use_case";
  relatedId?: string;
  evidence: string;
  control: string;
  framework: string;
  risk: RiskLevel;
  time: string;
  confidence: "strong" | "moderate" | "needs_review";
  targetView: View;
};

export function EvidenceLedger({
  auditLogs,
  evalResults,
  governanceReviews,
  runs,
  skills,
  toolRequests,
  useCases,
  onOpenView,
  onOpenRun,
  onOpenUseCase,
  onOpenSkill,
}: {
  auditLogs: AuditLog[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
  runs: Run[];
  skills: Skill[];
  toolRequests: ToolRequest[];
  useCases: UseCase[];
  onOpenView: (view: View) => void;
  onOpenRun: (runId: string) => void;
  onOpenUseCase: (useCaseId: string) => void;
  onOpenSkill: (skillId: string) => void;
}) {
  const [packetStatus, setPacketStatus] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [sourceRecordStatus, setSourceRecordStatus] = useState("");
  const agentControlPlane = useMemo(
    () => deriveAgentControlPlane({ skills, runs, toolRequests, auditLogs }),
    [skills, runs, toolRequests, auditLogs],
  );
  const evidenceGraph = useMemo(
    () => deriveEvidenceGraph({ useCases, skills, runs, evalResults, governanceReviews, auditLogs }),
    [useCases, skills, runs, evalResults, governanceReviews, auditLogs],
  );

  const evidenceRows = useMemo<EvidenceRow[]>(() => [
    ...auditLogs.map((log): EvidenceRow => ({
      id: log.id,
      source: "Audit log",
      store: "eaieos:auditLogs",
      type: log.eventType,
      item: log.actor,
      itemType: "audit",
      relatedId: log.id,
      evidence: log.message,
      control: mapControl(log.eventType),
      framework: mapControlFramework(mapControl(log.eventType)),
      risk: log.riskLevel,
      time: log.createdAt,
      confidence: log.message.length > 24 ? "moderate" : "needs_review",
      targetView: auditLogTargetView(log),
    })),
    ...evalResults.map((result): EvidenceRow => ({
      id: result.id,
      source: "Eval result",
      store: "eaieos:evalResults",
      type: "eval_result",
      item: skills.find((skill) => skill.id === result.skillId)?.name ?? result.skillId,
      itemType: "eval",
      relatedId: result.skillId,
      evidence: `${result.suiteName} scored ${result.score}% with ${result.criticalFailures} critical failures.`,
      control: "NIST.MEASURE / OWASP.LLM09",
      framework: "NIST AI RMF",
      risk: result.passed ? ("low" as RiskLevel) : ("high" as RiskLevel),
      time: result.createdAt,
      confidence: result.passed && result.score >= 90 && result.criticalFailures === 0 ? "strong" : "needs_review",
      targetView: "evals",
    })),
    ...governanceReviews.map((review): EvidenceRow => ({
      id: review.id,
      source: "Governance review",
      store: "eaieos:governanceReviews",
      type: "governance_review",
      item: review.title,
      itemType: "review",
      relatedId: review.itemId,
      evidence: `${review.reviewer} review is ${statusLabels[review.status]}. ${review.blockers.join(", ") || "No blockers."}`,
      control: "ISO42001.AI_LIFECYCLE / EUAI.HUMAN_OVERSIGHT",
      framework: "ISO/IEC 42001",
      risk: review.riskLevel,
      time: review.dueDate,
      confidence: ["approved", "approved_with_conditions"].includes(review.status)
        ? "strong"
        : review.blockers.length
          ? "needs_review"
          : "moderate",
      targetView: "governance",
    })),
    ...runs.map((run): EvidenceRow => ({
      id: run.id,
      source: "Harness run",
      store: "eaieos:runs",
      type: "runtime_trace",
      item: skills.find((skill) => skill.id === run.skillId)?.name ?? run.skillId,
      itemType: "run",
      relatedId: run.id,
      evidence: `${run.id} is ${statusLabels[run.status] ?? run.status} at ${run.currentStage}; ${run.trace.length} trace steps, ${run.latencyMs}ms, $${run.costUsd.toFixed(4)} cost.`,
      control: "NIST.MEASURE / OTEL.TRACE",
      framework: "NIST AI RMF",
      risk: run.riskLevel,
      time: run.startedAt,
      confidence: run.trace.length >= 6 ? "strong" : "moderate",
      targetView: "harness",
    })),
    ...agentControlPlane.findings.map((finding): EvidenceRow => ({
      id: `security-${finding.id}`,
      source: "Agent security",
      store: "eaieos:agentControlPlane",
      type: finding.type,
      item: finding.title,
      itemType: "security",
      relatedId: finding.runId ?? finding.agentId,
      evidence: `${finding.evidence} Next action: ${finding.nextAction}`,
      control: finding.control,
      framework: mapControlFramework(finding.control),
      risk: finding.severity === "critical" || finding.severity === "high"
        ? ("high" as RiskLevel)
        : finding.severity === "medium"
          ? ("medium" as RiskLevel)
          : ("low" as RiskLevel),
      time:
        runs.find((run) => run.id === finding.runId)?.startedAt ??
        auditLogs.find((log) => finding.id.includes(log.id))?.createdAt ??
        "Live",
      confidence: finding.status === "contained" ? "strong" : finding.severity === "low" ? "moderate" : "needs_review",
      targetView: "harness",
    })),
    ...useCases.map((useCase): EvidenceRow => ({
      id: `usecase-${useCase.id}`,
      source: "Use case control",
      store: "eaieos:useCases",
      type: "risk_value_classification",
      item: useCase.title,
      itemType: "use_case",
      relatedId: useCase.id,
      evidence: `${useCase.department} opportunity scored ${useCase.priorityScore}/100 with ${useCase.riskLevel} risk, value ${useCase.valueScore}/5, feasibility ${useCase.feasibilityScore}/5, reuse ${useCase.reuseScore}/5.`,
      control: "NIST.MAP / ISO42001.PLANNING",
      framework: "NIST AI RMF",
      risk: useCase.riskLevel,
      time: useCase.updatedAt,
      confidence: useCase.priorityScore > 0 && useCase.businessProblem.length > 20 ? "moderate" : "needs_review",
      targetView: "factory",
    })),
    ...skills.map((skill): EvidenceRow => ({
      id: `skill-${skill.id}`,
      source: "Skill specification",
      store: "eaieos:skills",
      type: "governed_skill_spec",
      item: skill.name,
      itemType: "skill",
      relatedId: skill.id,
      evidence: `Version ${skill.version}; ${skill.autonomyTier}; ${skill.allowedTools.length} allowed tools, ${skill.contextSources.length} context sources, ${skill.evalPassRate}% eval score.`,
      control: "ISO42001.AI_LIFECYCLE / OWASP.MCP04",
      framework: "ISO/IEC 42001",
      risk: skill.riskLevel,
      time: skill.updatedAt,
      confidence: skill.systemPrompt.length > 120 && skill.allowedTools.length > 0 && skill.contextSources.length > 0 ? "strong" : "moderate",
      targetView: "skills",
    })),
  ], [auditLogs, evalResults, governanceReviews, runs, skills, useCases, agentControlPlane.findings]);

  const sourceOptions = Array.from(new Set(evidenceRows.map((row) => row.source))).sort();
  const frameworkOptions = Array.from(new Set(evidenceRows.map((row) => row.framework))).sort();
  const filteredRows = evidenceRows.filter((row) => {
    const search = query.trim().toLowerCase();
    const matchesQuery =
      !search ||
      row.item.toLowerCase().includes(search) ||
      row.evidence.toLowerCase().includes(search) ||
      row.type.toLowerCase().includes(search) ||
      row.control.toLowerCase().includes(search);
    const matchesSource = sourceFilter === "all" || row.source === sourceFilter;
    const matchesFramework = frameworkFilter === "all" || row.framework === frameworkFilter;
    const matchesRisk = riskFilter === "all" || row.risk === riskFilter;
    return matchesQuery && matchesSource && matchesFramework && matchesRisk;
  });
  const selectedEvidence = filteredRows.find((row) => row.id === selectedEvidenceId) ?? filteredRows[0] ?? null;
  const evidenceSourceBreakdown = [
    { label: "Audit log events", count: auditLogs.length, store: "eaieos:auditLogs" },
    { label: "Eval result records", count: evalResults.length, store: "eaieos:evalResults" },
    { label: "Governance review records", count: governanceReviews.length, store: "eaieos:governanceReviews" },
    { label: "Harness run traces", count: runs.length, store: "eaieos:runs" },
    { label: "Agent security findings", count: agentControlPlane.findings.length, store: "eaieos:agentControlPlane" },
    { label: "Use case classifications", count: useCases.length, store: "eaieos:useCases" },
    { label: "Skill specifications", count: skills.length, store: "eaieos:skills" },
  ];

  const completedCoverage = (items: { complete: boolean }[]) =>
    items.length ? Math.round((items.filter((item) => item.complete).length / items.length) * 100) : 0;
  const nistItems = [
    {
      label: "Risk classification evidence",
      complete: useCases.some((useCase) => Boolean(useCase.riskLevel)) || skills.some((skill) => Boolean(skill.riskLevel)),
    },
    {
      label: "Evaluation evidence",
      complete: evalResults.length > 0,
    },
    {
      label: "Runtime monitoring logs",
      complete: runs.length > 0 || auditLogs.some((log) => log.eventType.includes("run")),
    },
  ];
  const isoItems = [
    {
      label: "Owners assigned",
      complete: skills.some((skill) => Boolean(skill.ownerId)) || useCases.some((useCase) => Boolean(useCase.ownerId)),
    },
    {
      label: "Lifecycle reviews",
      complete: governanceReviews.length > 0,
    },
    {
      label: "Change records",
      complete: auditLogs.some((log) => log.eventType.includes("created") || log.eventType.includes("updated")),
    },
  ];
  const euAiItems = [
    {
      label: "Human oversight evidence",
      complete:
        governanceReviews.some((review) => ["approved", "approved_with_conditions", "changes_requested"].includes(review.status)) ||
        runs.some((run) => run.status === "waiting_for_approval"),
    },
    {
      label: "Traceability",
      complete: runs.length > 0 || auditLogs.length > 0,
    },
    {
      label: "Technical documentation",
      complete: skills.some((skill) => skill.systemPrompt.length > 0 && skill.model.length > 0),
    },
  ];
  const owaspItems = [
    {
      label: "Prompt injection tests",
      complete: evalResults.some((result) => result.suiteName.toLowerCase().includes("injection")) || evalResults.length > 0,
    },
    {
      label: "Tool policies",
      complete: skills.some((skill) => skill.allowedTools.length > 0 || skill.blockedTools.length > 0),
    },
    {
      label: "Data exfiltration gates",
      complete: auditLogs.some((log) => log.eventType.includes("tool") || log.eventType.includes("policy")),
    },
  ];
  const controlEvidenceItems = [...nistItems, ...isoItems, ...euAiItems, ...owaspItems];
  const coverageBase = completedCoverage(controlEvidenceItems);
  const controlCards = [
    {
      title: "NIST AI RMF",
      subtitle: "Govern, Map, Measure, Manage",
      coverage: completedCoverage(nistItems),
      items: nistItems,
    },
    {
      title: "ISO/IEC 42001",
      subtitle: "AI management system readiness",
      coverage: completedCoverage(isoItems),
      items: isoItems,
    },
    {
      title: "EU AI Act",
      subtitle: "High-risk oversight evidence",
      coverage: highRiskReviewsCoverage(governanceReviews, euAiItems),
      items: euAiItems,
    },
    {
      title: "OWASP LLM/MCP",
      subtitle: "Prompt, tool, and connector safety",
      coverage: completedCoverage(owaspItems),
      items: owaspItems,
    },
  ];
  const evidenceGaps = [
    !useCases.length ? "Create or import scored use cases so the ledger has risk and value classification evidence." : "",
    !skills.length ? "Convert an approved use case into a governed Skill specification." : "",
    !runs.length ? "Run a Skill through the Harness to create trace, policy, tool, latency, and cost evidence." : "",
    !evalResults.length ? "Run launch-readiness evals for grounding, permissions, prompt injection, tool safety, cost, and latency." : "",
    !governanceReviews.length ? "Submit a Skill to governance so legal, security, privacy, and business review decisions are recorded." : "",
    runs.some((run) => run.trace.length < 6) ? "Some runs have thin traces; rerun through the full Harness to capture every runtime step." : "",
    governanceReviews.some((review) => review.blockers.length) ? "Resolve governance blockers before packaging board-ready evidence." : "",
  ].filter(Boolean);
  const packetMarkdown = buildEvidencePacketMarkdown({
    coverage: coverageBase,
    evidenceRows: filteredRows,
    controlCards,
    evidenceGaps,
    useCases,
    skills,
    runs,
    evalResults,
    governanceReviews,
  });
  const packetSummaryItems = [
    { label: "Use cases", value: useCases.length },
    { label: "Skills", value: skills.length },
    { label: "Runs", value: runs.length },
    { label: "Evals", value: evalResults.length },
    { label: "Reviews", value: governanceReviews.length },
    { label: "Audit events", value: auditLogs.length },
  ];
  const packetHighlights = filteredRows.slice(0, 4);
  const packetReady = filteredRows.length > 0 && evidenceGaps.length === 0;
  const nextProofAction: {
    label: string;
    headline: string;
    body: string;
    button: string;
    view: View;
    tone: "green" | "amber" | "red" | "slate";
  } =
    !filteredRows.length
      ? {
          label: "No packet yet",
          headline: "Next: create the first proof source",
          body: "Create a use case, Skill, run, eval, or review so the ledger has real proof to package.",
          button: "Create evidence source",
          view: "factory",
          tone: "slate",
        }
      : packetReady
        ? {
            label: "Pilot packet ready",
            headline: "Next: export the evidence packet",
            body: "The filtered evidence set has control mapping and no major packet gaps. Export it for review or executive reporting.",
            button: "Open Reports",
            view: "reports",
            tone: "green",
          }
        : !useCases.length
          ? {
              label: "Need use case proof",
              headline: "Next: create use case proof",
              body: "Start with a scored opportunity so every later Skill, test, review, and value claim has a business reason.",
              button: "Open Use Cases",
              view: "factory",
              tone: "amber",
            }
          : !skills.length
            ? {
                label: "Need Skill proof",
                headline: "Next: create Skill proof",
                body: "Convert the approved opportunity into an AI Skill with prompt, model, tools, context, owner, and controls.",
                button: "Open AI Skills",
                view: "skills",
                tone: "amber",
              }
            : !runs.length
              ? {
                  label: "Need runtime proof",
                  headline: "Next: run a traceable test",
                  body: "Run the Skill through tests so the packet can prove identity, context, policy, tools, approvals, output, cost, and latency.",
                  button: "Run Tests",
                  view: "harness",
                  tone: "red",
                }
              : !evalResults.length
                ? {
                    label: "Need quality proof",
                    headline: "Next: run quality evals",
                    body: "Run launch evals for grounding, permissions, prompt injection, tool safety, latency, cost, and regression.",
                    button: "Open Quality Evals",
                    view: "evals",
                    tone: "red",
                  }
                : !governanceReviews.length || governanceReviews.some((review) => review.blockers.length)
                  ? {
                      label: "Need review proof",
                      headline: "Next: record risk review proof",
                      body: "Submit the Skill to risk review or clear blockers before treating the packet as board-ready.",
                      button: "Open Risk Review",
                      view: "governance",
                      tone: "red",
                    }
                  : {
                      label: "Packet needs cleanup",
                      headline: "Next: close the remaining proof gap",
                      body: evidenceGaps[0] ?? "Resolve the remaining proof gap before exporting this evidence packet.",
                      button: "Open Proof Work",
                      view: "harness",
                      tone: "amber",
                    };
  const hasRiskReview = governanceReviews.length > 0;
  const hasResolvedRiskReview =
    governanceReviews.length > 0 &&
    governanceReviews.every(
      (review) => ["approved", "approved_with_conditions"].includes(review.status) && review.blockers.length === 0,
    );
  const hasValueStory =
    useCases.some((useCase) => useCase.priorityScore > 0 || useCase.valueScore > 0 || useCase.expectedBenefits.length > 0) ||
    skills.some((skill) => skill.valueDelivered > 0);
  const proofPillars: {
    label: string;
    body: string;
    complete: boolean;
    view: View;
    action: string;
  }[] = [
    {
      label: "Business reason",
      body: useCases.length ? "A scored use case explains why the Skill should exist." : "Create a scored use case first.",
      complete: useCases.length > 0,
      view: "factory",
      action: "Open Use Cases",
    },
    {
      label: "Skill contract",
      body: skills.length ? "Prompt, model, tools, context, owner, and controls are documented." : "Create the governed Skill spec.",
      complete: skills.length > 0,
      view: "skills",
      action: "Open AI Skills",
    },
    {
      label: "Runtime trace",
      body: runs.length ? "A test run captured identity, policy, tools, output, cost, and latency." : "Run the Skill through the Harness.",
      complete: runs.length > 0,
      view: "harness",
      action: "Run Tests",
    },
    {
      label: "Quality checks",
      body: evalResults.length ? "Launch evals provide grounding, safety, cost, and latency evidence." : "Run quality and safety evals.",
      complete: evalResults.length > 0,
      view: "evals",
      action: "Open Quality Evals",
    },
    {
      label: "Risk decision",
      body: hasResolvedRiskReview
        ? "Governance approval is recorded without open blockers."
        : hasRiskReview
          ? "A review exists, but blockers or approvals still need closure."
          : "Record the risk review decision.",
      complete: hasResolvedRiskReview,
      view: "governance",
      action: "Open Risk Review",
    },
    {
      label: "Value story",
      body: hasValueStory ? "The packet includes business impact or expected benefit evidence." : "Add expected benefits or measured value.",
      complete: hasValueStory,
      view: "roi",
      action: "Open Value & ROI",
    },
  ];
  const proofPillarCoverage = completedCoverage(proofPillars);
  const nextProofPillar = proofPillars.find((pillar) => !pillar.complete);

  function selectEvidence(rowId: string) {
    setSelectedEvidenceId(rowId);
    setSourceRecordStatus("");
  }

  function openSelectedEvidence(row: EvidenceRow) {
    if (row.itemType === "run" && row.relatedId) {
      onOpenRun(row.relatedId);
      return;
    }
    if (row.itemType === "security") {
      if (row.relatedId?.startsWith("run-")) {
        onOpenRun(row.relatedId);
        return;
      }
      onOpenView("harness");
      return;
    }
    if (row.itemType === "use_case" && row.relatedId) {
      onOpenUseCase(row.relatedId);
      return;
    }
    if ((row.itemType === "skill" || row.itemType === "eval") && row.relatedId) {
      onOpenSkill(row.relatedId);
      return;
    }
    if (row.targetView === "evidence") {
      setSourceRecordStatus(
        `Source record ${row.id} is a native ledger audit event. Its full provenance is shown in the selected evidence panel.`,
      );
      return;
    }
    onOpenView(row.targetView);
  }

  function openEvidenceGraphNode(node: EvidenceGraphNode) {
    if (node.layer === "opportunity" && node.targetId) {
      onOpenUseCase(node.targetId);
      return;
    }
    if (node.layer === "skill" && node.targetId) {
      onOpenSkill(node.targetId);
      return;
    }
    if (node.layer === "run" && node.targetId) {
      onOpenRun(node.targetId);
      return;
    }
    onOpenView(node.targetView);
  }

  function copyPacket() {
    void copyTextOrDownload({
      contents: packetMarkdown,
      copiedMessage: `Evidence packet copied with ${filteredRows.length} filtered evidence items.`,
      fallbackFilename: timestampedExportFilename("enterprise ai evidence packet", "md"),
      fallbackMimeType: "text/markdown;charset=utf-8",
      emptyMessage: "No evidence items are available yet. Create or import use cases, Skills, runs, evals, and reviews first.",
      downloadedMessage: "Clipboard permission blocked. Evidence packet markdown downloaded instead.",
    }).then((result) => setPacketStatus(result.message));
  }

  function downloadPacketJson() {
    const downloaded = downloadJsonFile(timestampedExportFilename("enterprise ai evidence packet", "json"), {
      schema: "enterprise-ai-enablement-os.evidence-packet.v1",
      generatedAt: new Date().toISOString(),
      coverage: coverageBase,
      filters: { query, sourceFilter, frameworkFilter, riskFilter },
      evidenceRows: filteredRows,
      controlCards,
      gaps: evidenceGaps,
      proofPillars,
      evidenceGraph,
    });
    setPacketStatus(
      downloaded
        ? "Evidence packet JSON staged for download."
        : "Evidence packet JSON could not be downloaded in this browser session.",
    );
  }

  return (
    <div>
      <PageHeader
        title="Proof Ledger"
        subtitle="Package the evidence that proves an AI Skill is controlled, tested, approved, and ready to discuss."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copyPacket}>
              <Copy size={16} />
              Copy Packet
            </Button>
            <Button onClick={downloadPacketJson}>
              <Download size={16} />
              Export JSON
            </Button>
          </div>
        }
      />

      <Panel className="overflow-hidden" data-testid="evidence-primary-packet">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextProofAction.tone}>{nextProofAction.label}</Badge>
              <Badge tone={packetReady ? "green" : filteredRows.length ? "amber" : "slate"}>
                {packetReady ? "ready" : filteredRows.length ? "draft" : "empty"}
              </Badge>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {filteredRows.length} visible records
              </span>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {nextProofAction.headline}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{nextProofAction.body}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => onOpenView(nextProofAction.view)}>
                <ChevronRight size={15} />
                {nextProofAction.button}
              </Button>
            </div>

            <details
              className="group mt-6 rounded-lg border border-slate-200/70 bg-slate-50/72"
              data-testid="evidence-proof-path"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">What this packet proves</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {proofPillars.filter((pillar) => pillar.complete).length}/{proofPillars.length} reviewer checks complete · {nextProofPillar?.label ?? "Packet can move forward"} is next
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={nextProofPillar ? "amber" : "green"}>{proofPillarCoverage}%</Badge>
                  <ChevronRight size={16} className="text-slate-400 transition group-open:rotate-90" />
                </span>
              </summary>
              <div className="hidden border-t border-slate-200/70 group-open:block">
                <div className="grid gap-px bg-slate-200/70 md:grid-cols-2 xl:grid-cols-3">
                  {proofPillars.map((pillar, index) => {
                    const isNext = nextProofPillar?.label === pillar.label;
                    return (
                      <button
                        key={pillar.label}
                        type="button"
                        className={`group flex min-h-[108px] w-full items-start gap-3 bg-white p-3 text-left transition ${
                          pillar.complete
                            ? "hover:bg-green-50/48"
                            : isNext
                              ? "bg-amber-50/72 hover:bg-amber-50"
                              : "hover:bg-[var(--primary-soft)]"
                        }`}
                        onClick={() => onOpenView(pillar.view)}
                      >
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            pillar.complete
                              ? "bg-green-600 text-white"
                              : isNext
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                                : "bg-slate-100 text-slate-500"
                          }`}
                          aria-hidden="true"
                        >
                          {pillar.complete ? <Check size={14} /> : index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-950">{pillar.label}</span>
                            {isNext ? <Badge tone="amber">next</Badge> : null}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{pillar.body}</span>
                          {!pillar.complete ? (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#5147e8]">
                              {pillar.action}
                              <ChevronRight size={13} />
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-px border-t border-slate-200/70 bg-slate-200/70 md:grid-cols-4">
                  {[
                    { label: "Evidence items", value: String(evidenceRows.length), helper: `${filteredRows.length} visible` },
                    { label: "Proof path", value: `${proofPillarCoverage}%`, helper: `${proofPillars.filter((pillar) => pillar.complete).length}/${proofPillars.length} reviewer checks` },
                    { label: "Control checks", value: `${coverageBase}%`, helper: "framework checks" },
                    { label: "Traceable runs", value: String(runs.length), helper: "runtime proof" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                      <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{item.value}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.helper}</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>

          <div className="min-w-0 border-t border-slate-200 bg-slate-50/56 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Packet health" helper="What a reviewer needs before trusting the packet" compact />
            <div className="mt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Framework checks</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{coverageBase}%</div>
                </div>
                <Badge tone={coverageBase >= 85 ? "green" : coverageBase > 0 ? "amber" : "slate"}>
                  {evidenceGaps.length ? `${evidenceGaps.length} gaps` : "no major gaps"}
                </Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(4, Math.min(100, coverageBase))}%` }}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Proof path" value={`${proofPillarCoverage}%`} />
              <MiniMetric label="Graph score" value={`${evidenceGraph.score}/100`} />
              <MiniMetric label="Sources" value={String(evidenceSourceBreakdown.filter((source) => source.count > 0).length)} />
              <MiniMetric label="Gaps" value={String(evidenceGaps.length)} />
            </div>
            <div className={`mt-4 rounded-lg border p-4 ${evidenceGaps.length ? "border-amber-100 bg-amber-50/72" : "border-green-100 bg-green-50/72"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                {evidenceGaps.length ? <AlertTriangle size={16} className="text-amber-700" /> : <ShieldCheck size={16} className="text-green-700" />}
                {evidenceGaps.length ? "Most important gap" : "Packet can move forward"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {evidenceGaps[0] ?? "No major evidence gaps detected for a pilot packet."}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle title="Evidence records" helper="Filterable proof from audit logs, evals, reviews, runs, Skills, and use cases" compact />
              <Badge tone="blue">{filteredRows.length} visible</Badge>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_140px]">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-indigo-50"
                  placeholder="Search evidence, controls, records..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-indigo-50"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                aria-label="Filter evidence source"
              >
                <option value="all">All sources</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-indigo-50"
                value={frameworkFilter}
                onChange={(event) => setFrameworkFilter(event.target.value)}
                aria-label="Filter control framework"
              >
                <option value="all">All frameworks</option>
                {frameworkOptions.map((framework) => (
                  <option key={framework} value={framework}>{framework}</option>
                ))}
              </select>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-indigo-50"
                value={riskFilter}
                onChange={(event) => setRiskFilter(event.target.value)}
                aria-label="Filter evidence risk"
              >
                <option value="all">All risks</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          </div>
          {filteredRows.length ? (
            <div className="grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="max-h-[760px] overflow-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
                    <tr>
                      {["Evidence", "Control", "Risk", "Confidence", "Time"].map((column) => (
                        <th key={column} className="px-5 py-3">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const selected = selectedEvidence?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer transition ${selected ? "bg-indigo-50/80" : "hover:bg-slate-50"}`}
                          onClick={() => selectEvidence(row.id)}
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl ${evidenceSourceIconTone(row.source)}`}>
                                <FileCheck2 size={16} />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={evidenceSourceTone(row.source)}>{row.source}</Badge>
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.type.replace(/_/g, " ")}</span>
                                </div>
                                <div className="mt-2 font-semibold text-slate-950">{row.item}</div>
                                <div className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-slate-600">{row.evidence}</div>
                                <code className="mt-2 block text-[11px] text-slate-400">{row.store} / {row.id}</code>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-2">
                              <Badge tone={frameworkTone(row.framework)}>{row.framework}</Badge>
                              <code className="block rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.control}</code>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <Badge tone={riskTone(row.risk)}>{row.risk}</Badge>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <Badge tone={evidenceConfidenceTone(row.confidence)}>{row.confidence.replace("_", " ")}</Badge>
                          </td>
                          <td className="px-5 py-4 align-top text-slate-500">{row.time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-l border-slate-200 bg-slate-50/60 p-5">
                {selectedEvidence ? (
                  <div className="sticky top-4 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Selected evidence</div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">{selectedEvidence.item}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedEvidence.evidence}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <MiniMetric label="Source" value={selectedEvidence.source} />
                      <MiniMetric label="Risk" value={selectedEvidence.risk} />
                      <MiniMetric label="Framework" value={selectedEvidence.framework} />
                      <MiniMetric label="Confidence" value={selectedEvidence.confidence.replace("_", " ")} />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Provenance</div>
                      <code className="mt-2 block whitespace-pre-wrap text-xs leading-5 text-slate-600">
{`record_id: ${selectedEvidence.id}
store: ${selectedEvidence.store}
type: ${selectedEvidence.type}
control: ${selectedEvidence.control}
time: ${selectedEvidence.time}`}
                      </code>
                    </div>
                    <Button className="w-full" onClick={() => openSelectedEvidence(selectedEvidence)}>
                      <ChevronRight size={16} />
                      Open Source Record
                    </Button>
                    {sourceRecordStatus ? (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-[#5147e8]">
                        {sourceRecordStatus}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-white text-[#5147e8] shadow-sm">
                  <FileCheck2 size={18} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">No evidence recorded yet</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Evidence appears after real workspace actions: use case submissions, Skill updates, Harness runs, approvals, evals, governance reviews, or imports.
                </p>
                <Button className="mt-4" onClick={() => onOpenView("factory")}>
                  <Plus size={16} />
                  Create First Evidence Source
                </Button>
              </div>
            </div>
          )}
        </Panel>

        <aside className="hidden min-h-0 space-y-4 overflow-y-auto pr-1 xl:block">
          <Panel className="p-5" data-testid="evidence-graph">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle
                title="Evidence Graph"
                helper="Closed-loop proof from opportunity to reusable, measured capability"
                compact
              />
              <Badge tone={evidenceGraph.score >= 85 ? "green" : evidenceGraph.score >= 55 ? "amber" : "blue"}>
                {evidenceGraph.score}/100
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{evidenceGraph.summary}</p>
            <div className="mt-4 space-y-2">
              {evidenceGraph.nodes.map((node, index) => (
                <button
                  key={node.id}
                  type="button"
                  className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  onClick={() => openEvidenceGraphNode(node)}
                >
                  <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${graphStatusIconTone(node.status)}`}>
                    {node.status === "complete" ? <Check size={15} /> : <GitBranch size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-950">{node.label}</span>
                      <Badge tone={graphStatusTone(node.status)}>{node.status}</Badge>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{node.detail}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      <span>{node.evidenceCount} evidence</span>
                      {index < evidenceGraph.nodes.length - 1 ? (
                        <span>{evidenceGraph.edges[index]?.status === "complete" ? "connected" : "needs link"}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {evidenceGraph.gaps.length ? (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Next proof actions</div>
                <div className="mt-2 space-y-1">
                  {evidenceGraph.gaps.slice(0, 3).map((gap) => (
                    <div key={gap} className="text-xs leading-5 text-amber-800">{gap}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Control Map" />
            <div className="mt-4 space-y-4">
              {controlCards.map((card) => (
                <div key={card.title} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{card.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{card.subtitle}</div>
                    </div>
                    <Badge tone={card.coverage >= 85 ? "green" : card.coverage > 0 ? "amber" : "slate"}>{card.coverage}%</Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#635bff]" style={{ width: `${card.coverage}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {evidenceRows.filter((row) => row.framework === card.title || row.control.includes(card.title.split(" ")[0])).length} evidence records mapped
                  </div>
                  <div className="mt-3 space-y-1">
                    {card.items.map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
                        {item.complete ? (
                          <Check size={13} className="text-green-600" />
                        ) : (
                          <span className="size-[13px] rounded-full border border-slate-300 bg-white" aria-hidden="true" />
                        )}
                        <span className={item.complete ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Evidence Gaps" helper="What to create before an executive or audit packet" />
            <div className="mt-4 space-y-2">
              {evidenceGaps.length ? (
                evidenceGaps.slice(0, 5).map((gap) => (
                  <div key={gap} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{gap}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm leading-5 text-green-700">
                  <Check size={14} className="mt-0.5 shrink-0" />
                  <span>No major evidence gaps detected for a pilot packet.</span>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Evidence Sources" helper="What feeds the live ledger count" />
            <div className="mt-4 space-y-3">
              {evidenceSourceBreakdown.map((source) => (
                <div key={source.store} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{source.label}</div>
                    <code className="mt-1 block text-[11px] text-slate-400">{source.store}</code>
                  </div>
                  <Badge tone={source.count ? "blue" : "slate"}>{source.count}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Evidence Packet" helper="Generated from current portfolio state" />
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Packet status</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {packetReady ? "Pilot-ready evidence packet" : filteredRows.length ? "Draft evidence packet" : "No packet evidence yet"}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {filteredRows.length
                      ? `${filteredRows.length} filtered evidence records are mapped to controls and ready for review.`
                      : "Create use cases, Skills, runs, evals, and review decisions to assemble an audit packet."}
                  </p>
                </div>
                <Badge tone={packetReady ? "green" : filteredRows.length ? "amber" : "slate"}>
                  {packetReady ? "ready" : filteredRows.length ? "draft" : "empty"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {packetSummaryItems.map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="mt-1 text-base font-semibold text-slate-950">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Executive preview</div>
                  <div className="mt-1 text-xs text-slate-500">The export payload stays available through the header actions.</div>
                </div>
                <Badge tone={coverageBase >= 85 ? "green" : coverageBase > 0 ? "amber" : "slate"}>{coverageBase}% covered</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {packetHighlights.length ? (
                  packetHighlights.map((row, index) => (
                    <button type="button"
                      key={row.id}
                      className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                      onClick={() => selectEvidence(row.id)}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-[#5147e8] shadow-sm">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{row.item}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{row.evidence}</span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          <Badge tone={frameworkTone(row.framework)}>{row.framework}</Badge>
                          <Badge tone={riskTone(row.risk)}>{row.risk}</Badge>
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    No executive packet highlights are available yet.
                  </div>
                )}
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() =>
                setPacketStatus(
                  filteredRows.length
                    ? `Governance packet prepared with ${filteredRows.length} filtered evidence items.`
                    : "No evidence items are available yet. Create or import use cases, Skills, runs, evals, and reviews first.",
                )
              }
            >
              <FileCheck2 size={16} />
              Generate Governance Packet
            </Button>
            {packetStatus ? (
              <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-[#5147e8]">
                {packetStatus}
              </div>
            ) : null}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function mapControl(eventType: string) {
  if (eventType.includes("tool")) return "OWASP.MCP04 / NIST.MANAGE";
  if (eventType.includes("eval")) return "NIST.MEASURE / OWASP.LLM09";
  if (eventType.includes("approval")) return "EUAI.HUMAN_OVERSIGHT";
  if (eventType.includes("policy")) return "ISO42001.CONTROL / OWASP.LLM01";
  if (eventType.includes("provider")) return "NIST.GOVERN / ISO42001.RESOURCE";
  if (eventType.includes("workspace")) return "ISO42001.CHANGE_RECORD";
  if (eventType.includes("workflow")) return "ISO42001.AI_LIFECYCLE";
  if (eventType.includes("created")) return "NIST.GOVERN";
  return "NIST.MAP";
}

function mapControlFramework(control: string) {
  if (control.includes("OWASP")) return "OWASP LLM/MCP";
  if (control.includes("EUAI")) return "EU AI Act";
  if (control.includes("ISO42001")) return "ISO/IEC 42001";
  return "NIST AI RMF";
}

function auditLogTargetView(log: AuditLog): View {
  const eventType = log.eventType.toLowerCase();
  const actor = log.actor.toLowerCase();
  const message = log.message.toLowerCase();

  if (eventType.includes("tool") || actor.includes("broker") || message.includes("tool request")) return "broker";
  if (eventType.includes("eval") || actor.includes("evaluation")) return "evals";
  if (eventType.includes("workflow") || actor.includes("workflow")) return "workflow";
  if (eventType.includes("use_case") || actor.includes("use case")) return "factory";
  if (eventType.includes("skill") || actor.includes("skill")) return "skills";
  if (eventType.includes("provider") || eventType.includes("workspace") || actor.includes("admin")) return "admin";
  if (eventType.includes("context") || actor.includes("context")) return "context";
  if (eventType.includes("governance") || message.includes("governance review")) return "governance";
  if (eventType.includes("orchestrator") || actor.includes("orchestrator")) return "orchestrator";
  if (eventType.includes("approval")) return message.includes("tool") ? "broker" : "governance";
  if (eventType.includes("output_generated") || actor.includes("report") || actor.includes("brief")) return "reports";
  if (eventType.includes("feedback") || actor.includes("session")) return "session";
  if (eventType.includes("policy_violation") || actor.includes("harness")) return "harness";
  if (eventType.includes("pattern")) return "skills";
  if (actor.includes("command")) return "command";

  return "evidence";
}

function evidenceSourceTone(source: string): "slate" | "green" | "amber" | "red" | "blue" | "purple" {
  if (source.includes("Eval")) return "purple";
  if (source.includes("Governance")) return "green";
  if (source.includes("Harness")) return "blue";
  if (source.includes("Use case")) return "amber";
  if (source.includes("Skill")) return "blue";
  return "slate";
}

function evidenceSourceIconTone(source: string) {
  if (source.includes("Eval")) return "bg-indigo-50 text-indigo-600";
  if (source.includes("Governance")) return "bg-green-50 text-green-600";
  if (source.includes("Harness")) return "bg-sky-50 text-sky-600";
  if (source.includes("Use case")) return "bg-amber-50 text-amber-600";
  if (source.includes("Skill")) return "bg-blue-50 text-blue-600";
  return "bg-slate-100 text-slate-500";
}

function frameworkTone(framework: string): "slate" | "green" | "amber" | "red" | "blue" | "purple" {
  if (framework.includes("NIST")) return "blue";
  if (framework.includes("ISO")) return "green";
  if (framework.includes("EU")) return "amber";
  if (framework.includes("OWASP")) return "purple";
  return "slate";
}

function evidenceConfidenceTone(confidence: EvidenceRow["confidence"]): "slate" | "green" | "amber" | "red" | "blue" | "purple" {
  if (confidence === "strong") return "green";
  if (confidence === "moderate") return "blue";
  return "amber";
}

function graphStatusTone(status: EvidenceGraphNode["status"]): "slate" | "green" | "amber" | "red" | "blue" | "purple" {
  if (status === "complete") return "green";
  if (status === "attention") return "amber";
  if (status === "partial") return "blue";
  return "slate";
}

function graphStatusIconTone(status: EvidenceGraphNode["status"]) {
  if (status === "complete") return "bg-green-50 text-green-600";
  if (status === "attention") return "bg-amber-50 text-amber-600";
  if (status === "partial") return "bg-sky-50 text-sky-600";
  return "bg-slate-100 text-slate-400";
}

function buildEvidencePacketMarkdown(params: {
  coverage: number;
  evidenceRows: EvidenceRow[];
  controlCards: {
    title: string;
    coverage: number;
    items: { label: string; complete: boolean }[];
  }[];
  evidenceGaps: string[];
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
}) {
  const includedRows = params.evidenceRows.slice(0, 12);
  return [
    "# Enterprise AI Evidence Packet",
    "",
    "## Coverage",
    `- Overall control coverage: ${params.coverage}%`,
    `- Evidence items in scope: ${params.evidenceRows.length}`,
    `- Use cases: ${params.useCases.length}`,
    `- Skills: ${params.skills.length}`,
    `- Harness runs: ${params.runs.length}`,
    `- Eval artifacts: ${params.evalResults.length}`,
    `- Governance reviews: ${params.governanceReviews.length}`,
    "",
    "## Control Framework Map",
    ...params.controlCards.map((card) => `- ${card.title}: ${card.coverage}% (${card.items.filter((item) => item.complete).length}/${card.items.length} controls covered)`),
    "",
    "## Evidence Highlights",
    ...(includedRows.length
      ? includedRows.map((row, index) => `${index + 1}. ${row.item} - ${row.source} - ${row.control} - ${row.evidence}`)
      : ["No evidence rows are currently in scope."]),
    "",
    "## Open Evidence Gaps",
    ...(params.evidenceGaps.length ? params.evidenceGaps.map((gap) => `- ${gap}`) : ["- No major evidence gaps detected for a pilot packet."]),
  ].join("\n");
}

function highRiskReviewsCoverage(reviews: GovernanceReview[], fallbackItems: { complete: boolean }[]) {
  const highRisk = reviews.filter((review) => ["high", "restricted"].includes(review.riskLevel));
  if (!highRisk.length) return fallbackItems.some((item) => item.complete) ? Math.round((fallbackItems.filter((item) => item.complete).length / fallbackItems.length) * 100) : 0;
  return Math.round((highRisk.filter((review) => ["approved", "approved_with_conditions"].includes(review.status)).length / highRisk.length) * 100);
}
