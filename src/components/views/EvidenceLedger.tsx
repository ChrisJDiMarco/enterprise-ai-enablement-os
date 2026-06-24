import { useMemo, useState, type KeyboardEvent } from "react";
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
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import { deriveAdoptionRate } from "@/lib/adoption-model";
import type { AuditIntegrityVerification } from "@/lib/audit-integrity";
import { deriveAgentControlPlane } from "@/lib/agent-control-plane";
import { deriveEvidenceGraph, type EvidenceGraphNode } from "@/lib/evidence-graph";
import { openClawIntegration, openClawStatusTone } from "@/lib/openclaw-integration";
import { deriveOperatingModel } from "@/lib/ui/operating-model";
import { usePersistedState } from "@/lib/ui/use-persisted-filters";
import { nextTabId, type TabNavigationItem } from "@/lib/ui/tab-navigation";
import type { View } from "@/lib/ui/types";
import { statusLabels } from "@/lib/ui/constants";
import { copyTextOrDownload, downloadJsonFile, timestampedExportFilename } from "@/lib/ui/export-utils";
import { Badge, Button, MiniMetric, Panel, riskTone, SectionTitle, StatusNotice } from "@/components/ui";
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

type EvidencePacketTab = "packet" | "trace" | "controls" | "records";

export function EvidenceLedger({
  auditLogs,
  evalResults,
  governanceReviews,
  runs,
  skills,
  toolRequests,
  useCases,
  workSignals,
  selectedUseCase,
  selectedSkill,
  auditIntegrity,
  onVerifyAuditChain,
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
  workSignals: WorkSignal[];
  selectedUseCase: UseCase | null;
  selectedSkill: Skill | null;
  auditIntegrity: AuditIntegrityVerification | null;
  onVerifyAuditChain: () => Promise<void>;
  onOpenView: (view: View) => void;
  onOpenRun: (runId: string) => void;
  onOpenUseCase: (useCaseId: string) => void;
  onOpenSkill: (skillId: string) => void;
}) {
  const [packetStatus, setPacketStatus] = useState("");
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [query, setQuery] = usePersistedState("eaieos:evidence-ledger:query", "");
  const [sourceFilter, setSourceFilter] = usePersistedState("eaieos:evidence-ledger:sourceFilter", "all");
  const [frameworkFilter, setFrameworkFilter] = usePersistedState("eaieos:evidence-ledger:frameworkFilter", "all");
  const [riskFilter, setRiskFilter] = usePersistedState("eaieos:evidence-ledger:riskFilter", "all");
  const [activePacketTab, setActivePacketTab] = useState<EvidencePacketTab>("packet");
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
  const operatingModel = useMemo(
    () => deriveOperatingModel({
      useCases,
      skills,
      runs,
      evalResults,
      governanceReviews,
      auditLogs,
      toolRequests,
      metrics: {
        totalUseCases: useCases.length,
        activePilots: skills.filter((skill) => ["pilot", "production"].includes(skill.status)).length,
        skills: skills.length,
        adoptionRate: deriveAdoptionRate(skills, useCases),
        hoursSaved: 0,
        riskItemsOpen: governanceReviews.filter(
          (review) => ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
        ).length,
        annualValue: skills.reduce((total, skill) => total + skill.valueDelivered, 0),
      },
      workflowNodeCount: Math.max(0, ...runs.map((run) => run.trace.length)),
      workflowStatus: "Ledger",
      selectedUseCase,
      selectedSkill,
      workSignals,
    }),
    [auditLogs, evalResults, governanceReviews, runs, selectedSkill, selectedUseCase, skills, toolRequests, useCases, workSignals],
  );
  const activeTraceRun =
    (operatingModel.initiative.skill
      ? runs.find((run) => run.skillId === operatingModel.initiative.skill?.id)
      : null) ??
    (operatingModel.initiative.useCase
      ? runs.find((run) => run.useCaseId === operatingModel.initiative.useCase?.id)
      : null) ??
    runs[0] ??
    null;
  const replaySteps = activeTraceRun?.trace.length
    ? activeTraceRun.trace
    : operatingModel.stages.map((stage) => ({
        label: stage.label,
        status: stage.complete ? "completed" : stage.active ? "running" : "waiting",
        detail: stage.evidence,
        latencyMs: 0,
      }));

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
      evidence: `${run.executionMode === "simulated" ? "[SIMULATED — no model call or external action] " : ""}${run.id} is ${statusLabels[run.status] ?? run.status} at ${run.currentStage}; ${run.trace.length} trace steps, ${run.latencyMs}ms, $${run.costUsd.toFixed(4)} cost.`,
      control: "NIST.MEASURE / OTEL.TRACE",
      framework: "NIST AI RMF",
      risk: run.riskLevel,
      time: run.startedAt,
      confidence: run.executionMode === "simulated" ? "needs_review" : run.trace.length >= 6 ? "strong" : "moderate",
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
    !workSignals.length && !useCases.length ? "Capture or import work signals so the packet starts with a real business demand source." : "",
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
        : !workSignals.length && !useCases.length
          ? {
              label: "Need signal proof",
              headline: "Next: capture work signal proof",
              body: "Start with a repeated work pain, request pattern, or manual demand signal so later use case, Skill, and value claims have a real source.",
              button: "Open Work Signals",
              view: "work",
              tone: "amber",
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
                  button: "Open AI Harness",
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
      label: "Work signal",
      body:
        workSignals.length > 0
          ? "A repeated work signal anchors the packet before solution design."
          : useCases.length > 0
            ? "A business demand signal exists through the scored use case."
            : "Capture a repeated work pain or request pattern first.",
      complete: workSignals.length > 0 || useCases.length > 0,
      view: "work",
      action: "Open Work Signals",
    },
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
      action: "Open AI Harness",
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
  const packetTabs: { id: EvidencePacketTab; label: string; meta: string }[] = [
    { id: "packet", label: "Packet", meta: packetReady ? "ready" : filteredRows.length ? "draft" : "empty" },
    { id: "trace", label: "Trace", meta: activeTraceRun ? activeTraceRun.status.replace(/_/g, " ") : "planned" },
    { id: "controls", label: "Controls", meta: `${coverageBase}%` },
    { id: "records", label: "Records", meta: String(filteredRows.length) },
  ];
  const packetTabItems: TabNavigationItem[] = packetTabs.map((tab) => [tab.id, tab.label]);
  const packetCommandCards = [
    {
      label: "Packet readiness",
      value: packetReady ? "Ready" : `${proofPillarCoverage}%`,
      helper: packetReady ? "Export or attach this packet to reporting." : `${nextProofPillar?.label ?? "Proof cleanup"} is the next reviewer gap.`,
      tone: packetReady ? "green" : nextProofAction.tone,
      actionLabel: packetReady ? "Open Reports" : nextProofPillar?.action ?? nextProofAction.button,
      action: () => onOpenView(packetReady ? "reports" : nextProofPillar?.view ?? nextProofAction.view),
    },
    {
      label: "Missing proof",
      value: String(evidenceGaps.length),
      helper: evidenceGaps[0] ?? "No major proof gaps are visible in the current packet.",
      tone: evidenceGaps.length ? "amber" : "green",
      actionLabel: evidenceGaps.length ? "Open next gap" : "Review packet",
      action: () => onOpenView(nextProofPillar?.view ?? nextProofAction.view),
    },
    {
      label: "Traceability",
      value: runs.length ? `${runs.length} run${runs.length === 1 ? "" : "s"}` : "No trace",
      helper: runs.length ? "Runtime traces can support evidence review." : "Run the Skill through Harness before launch review.",
      tone: runs.length ? "blue" : "red",
      actionLabel: "Open trace",
      action: () => selectPacketTab("trace", true),
    },
    {
      label: "Reviewer export",
      value: filteredRows.length ? `${filteredRows.length} records` : "Empty",
      helper: "Copy markdown for reviewers or export machine-readable JSON.",
      tone: filteredRows.length ? "purple" : "slate",
      actionLabel: "Prepare export",
      action: () => selectPacketTab("records", true),
    },
  ] as const;

  function handlePacketTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = nextTabId(packetTabItems, activePacketTab, event.key);
    if (!next) return;

    event.preventDefault();
    setActivePacketTab(next as EvidencePacketTab);

    const tabList = event.currentTarget.closest("[role='tablist']");
    const nextIndex = packetTabItems.findIndex(([id]) => id === next);
    window.requestAnimationFrame(() => {
      const nextTab = tabList?.querySelector<HTMLButtonElement>(`[data-tab-index="${nextIndex}"]`);
      nextTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
      nextTab?.focus();
    });
  }

  function selectPacketTab(tab: EvidencePacketTab, scrollToWorkspace = false) {
    setActivePacketTab(tab);
    if (!scrollToWorkspace) return;

    window.requestAnimationFrame(() => {
      document.getElementById("evidence-primary-packet")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selectEvidence(rowId: string) {
    setSelectedEvidenceId(rowId);
    setSourceRecordStatus("");
  }

  function handleEvidenceRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, rowId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    selectEvidence(rowId);
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

  async function handleVerifyAuditChain() {
    setVerifyState("verifying");
    setPacketStatus("Verifying the audit hash-chain…");
    try {
      await onVerifyAuditChain();
      setVerifyState("done");
    } catch (error) {
      setVerifyState("error");
      setPacketStatus(error instanceof Error ? error.message : "Audit chain verification failed.");
    }
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
    const downloaded = downloadJsonFile(timestampedExportFilename("enterprise ai evidence ledger export", "json"), {
      schema: "enterprise-ai-enablement-os.evidence-ledger-export.v1",
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
        ? "Evidence ledger export JSON staged for download."
        : "Evidence ledger export JSON could not be downloaded in this browser session.",
    );
  }

  return (
    <div>
      <PageHeader
        title="Proof Ledger"
        subtitle="Reviewer-ready traces, controls, approvals, and value evidence."
        compact
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {auditIntegrity ? (
              <Badge tone={auditIntegrity.verified ? "green" : "red"}>
                {auditIntegrity.verified
                  ? `Chain verified · ${auditIntegrity.checked}`
                  : `${auditIntegrity.gaps.length} gap${auditIntegrity.gaps.length === 1 ? "" : "s"}`}
              </Badge>
            ) : null}
            <Button
              variant="secondary"
              className="min-h-8 px-2.5 py-1.5 text-xs"
              onClick={handleVerifyAuditChain}
              disabled={verifyState === "verifying"}
              data-testid="evidence-verify-integrity"
              title="Recompute the SHA-256 audit hash-chain and confirm no records were altered."
            >
              <ShieldCheck size={14} />
              {verifyState === "verifying" ? "Verifying…" : "Verify integrity"}
            </Button>
            <Button variant="secondary" className="min-h-8 px-2.5 py-1.5 text-xs" onClick={copyPacket}>
              <Copy size={14} />
              Copy
            </Button>
            <Button className="min-h-8 px-2.5 py-1.5 text-xs" onClick={downloadPacketJson}>
              <Download size={14} />
              Export
            </Button>
          </div>
        }
      />

      <Panel className="mb-3 overflow-hidden" data-testid="evidence-reviewer-command-strip">
        <div className="grid gap-px bg-[var(--border)] md:grid-cols-2 lg:grid-cols-4">
          {packetCommandCards.map((card) => (
            <button
              key={card.label}
              type="button"
              aria-label={`${card.actionLabel}: ${card.label}`}
              onClick={card.action}
              className="group min-h-[76px] bg-[var(--surface)] p-3 text-left transition hover:bg-[var(--primary-soft)]/38 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="t-eyebrow block text-[var(--text-soft)]">{card.label}</span>
                  <span className="mt-1 block truncate text-lg font-semibold tracking-tight tabular-nums text-[var(--text)]">{card.value}</span>
                </span>
                <Badge tone={card.tone}>{card.tone === "green" ? "ok" : card.tone === "red" ? "blocker" : "next"}</Badge>
              </span>
              <span className="mt-1 line-clamp-1 block text-xs leading-5 text-[var(--text-muted)]">{card.helper}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                {card.actionLabel}
                <ChevronRight size={13} className="transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="mb-3 overflow-hidden" data-testid="openclaw-proof-ledger">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">Agent runtime proof stream</span>
                <Badge tone="blue">{openClawIntegration.gateway.evidenceEvents.toLocaleString()} events</Badge>
                <Badge tone={openClawStatusTone(openClawIntegration.gateway.status)}>
                  {openClawIntegration.gateway.status.replace("_", " ")}
                </Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                Approvals, policy decisions, evals, update gates, and blocked-source signals.
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
          </summary>
        <div className="grid gap-0 border-t border-[var(--border)] lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-eyebrow text-[var(--text-soft)]">Agent runtime proof stream</span>
              <Badge tone="blue">{openClawIntegration.gateway.evidenceEvents.toLocaleString()} events</Badge>
              <Badge tone={openClawStatusTone(openClawIntegration.gateway.status)}>
                gateway {openClawIntegration.gateway.status.replace("_", " ")}
              </Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Treat every agent run as audit-ready evidence, not loose chat history
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Connected runtime sessions export approvals, policy decisions, evals, update gates, and blocked-source signals into
              the same packet builder used for launch review and executive reporting.
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {openClawIntegration.proofEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Open agent runtime ${event.type} proof: ${event.label}`}
                  data-testid={`openclaw-proof-event-${event.id}`}
                  onClick={() => selectPacketTab(event.type === "policy" ? "controls" : event.type === "run" ? "trace" : "records", true)}
                  className="group flex min-h-[118px] min-w-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                >
                  <span className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <Badge tone={event.type === "approval" ? "amber" : event.type === "eval" ? "purple" : event.type === "policy" ? "blue" : "slate"}>
                      {event.type}
                    </Badge>
                    <Badge tone={riskTone(event.risk)}>{event.risk}</Badge>
                  </span>
                  <span className="mt-3 line-clamp-3 text-sm font-semibold text-[var(--text)]">{event.label}</span>
                  <span className="mt-2 line-clamp-2 flex-1 text-xs leading-5 text-[var(--text-muted)]">{event.summary}</span>
                  <span className="t-eyebrow mt-3 truncate text-[var(--text-soft)]">
                    {event.createdAt}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 lg:max-h-[720px] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <SectionTitle title="Packet routing" helper="Where runtime proof lands in the reviewer workspace" compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Approvals" value={String(openClawIntegration.proofEvents.filter((event) => event.type === "approval").length)} />
              <MiniMetric label="Policies" value={String(openClawIntegration.proofEvents.filter((event) => event.type === "policy").length)} />
              <MiniMetric label="Evals" value={String(openClawIntegration.proofEvents.filter((event) => event.type === "eval").length)} />
              <MiniMetric label="Runs" value={String(openClawIntegration.sessions.length)} />
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: "Trace", helper: "Runtime steps, source trust, tool requests", tab: "trace" as EvidencePacketTab },
                { label: "Controls", helper: "Gateway policy, sandbox, skill provenance", tab: "controls" as EvidencePacketTab },
                { label: "Records", helper: "Approvals, evals, update decisions, packet exports", tab: "records" as EvidencePacketTab },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`Open ${item.label} proof packet tab`}
                  onClick={() => selectPacketTab(item.tab, true)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--primary-soft)]/35"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{item.helper}</span>
                  </span>
                  <ChevronRight size={15} className="text-[var(--text-soft)]" />
                </button>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={() => onOpenView("launch")}>
              <FileCheck2 size={15} />
              Attach to launch
            </Button>
          </div>
        </div>
        </details>
      </Panel>

      <Panel id="evidence-primary-packet" className="scroll-mt-24 overflow-hidden border-[var(--elev-2-border)] bg-[var(--elev-2)] shadow-[var(--elev-2-shadow)]" data-testid="evidence-primary-packet">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Proof Ledger workspace">
            {packetTabs.map((tab, index) => (
              <button
                key={tab.id}
                id={`evidence-${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={activePacketTab === tab.id}
                aria-controls={activePacketTab === tab.id ? `evidence-${tab.id}-panel` : undefined}
                tabIndex={activePacketTab === tab.id ? 0 : -1}
                data-tab-index={index}
                data-testid={`evidence-tab-${tab.id}`}
                onClick={() => setActivePacketTab(tab.id)}
                onKeyDown={handlePacketTabKeyDown}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                  activePacketTab === tab.id
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
                    activePacketTab === tab.id ? "bg-[var(--surface)] text-[var(--primary)]" : "bg-[var(--surface-subtle)] text-[var(--text-soft)]"
                  }`}
                >
                  {tab.meta}
                </span>
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold text-[var(--text-soft)]">{filteredRows.length} visible records</div>
        </div>
        {activePacketTab === "packet" ? (
        <div
          id="evidence-packet-panel"
          role="tabpanel"
          aria-labelledby="evidence-packet-tab"
          className="grid xl:grid-cols-[minmax(0,1fr)_340px]"
          data-testid="evidence-tabpanel-packet"
        >
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-eyebrow text-[var(--text-soft)]">Packet builder</span>
              <Badge tone={nextProofAction.tone}>{nextProofAction.label}</Badge>
              <Badge tone={packetReady ? "green" : filteredRows.length ? "amber" : "slate"}>
                {packetReady ? "ready" : filteredRows.length ? "draft" : "empty"}
              </Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
              {nextProofAction.headline}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">{nextProofAction.body}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => onOpenView(nextProofAction.view)}>
                <ChevronRight size={15} />
                {nextProofAction.button}
              </Button>
            </div>

            <details
              className="group mt-4 border-t border-[var(--border)] pt-4"
              data-testid="evidence-proof-path"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)]">What this packet proves</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                    {proofPillars.filter((pillar) => pillar.complete).length}/{proofPillars.length} reviewer checks complete · {nextProofPillar?.label ?? "Packet can move forward"} is next
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={nextProofPillar ? "amber" : "green"}>{proofPillarCoverage}%</Badge>
                  <ChevronRight size={16} className="text-[var(--text-soft)] transition group-open:rotate-90" />
                </span>
              </summary>
              <div className="mt-4 hidden overflow-hidden rounded-lg border border-[var(--border)] group-open:block">
                <div className="grid gap-px bg-[var(--border)] md:grid-cols-2 xl:grid-cols-3">
                  {proofPillars.map((pillar, index) => {
                    const isNext = nextProofPillar?.label === pillar.label;
                    return (
                      <button
                        key={pillar.label}
                        type="button"
                        aria-label={`${pillar.action}: ${pillar.label} proof pillar`}
                        className={`group flex min-h-[108px] w-full items-start gap-3 bg-[var(--surface)] p-3 text-left transition ${
                          pillar.complete
                            ? "hover:bg-[var(--success-soft)]"
                            : isNext
                              ? "bg-[var(--warning-soft)] hover:bg-[var(--warning-soft)]"
                              : "hover:bg-[var(--primary-soft)]"
                        }`}
                        onClick={() => onOpenView(pillar.view)}
                      >
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            pillar.complete
                              ? "bg-[var(--success)] text-white"
                              : isNext
                                ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[var(--border)]"
                                : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                          }`}
                          aria-hidden="true"
                        >
                          {pillar.complete ? <Check size={14} /> : index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[var(--text)]">{pillar.label}</span>
                            {isNext ? <Badge tone="amber">next</Badge> : null}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{pillar.body}</span>
                          {!pillar.complete ? (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                              {pillar.action}
                              <ChevronRight size={13} />
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
                  {[
                    { label: "Evidence items", value: String(evidenceRows.length), helper: `${filteredRows.length} visible` },
                    { label: "Proof path", value: `${proofPillarCoverage}%`, helper: `${proofPillars.filter((pillar) => pillar.complete).length}/${proofPillars.length} reviewer checks` },
                    { label: "Control checks", value: `${coverageBase}%`, helper: "framework checks" },
                    { label: "Traceable runs", value: String(runs.length), helper: "runtime proof" },
                  ].map((item) => (
                    <div key={item.label} className="bg-[var(--surface)] p-4">
                      <div className="t-eyebrow text-[var(--text-soft)]">{item.label}</div>
                      <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{item.value}</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>

          <div className="ea-calm-rail min-w-0 border-t p-5 xl:border-t-0">
            <SectionTitle title="Packet health" helper="What a reviewer needs before trusting the packet" compact />
            <div className="mt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="t-eyebrow text-[var(--text-soft)]">Framework checks</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{coverageBase}%</div>
                </div>
                <Badge tone={coverageBase >= 85 ? "green" : coverageBase > 0 ? "amber" : "slate"}>
                  {evidenceGaps.length ? `${evidenceGaps.length} gaps` : "no major gaps"}
                </Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border)]">
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
            {packetStatus ? (
              <StatusNotice
                tone={verifyState === "error" ? "red" : "blue"}
                className="mt-4"
                testId="evidence-packet-status"
              >
                {packetStatus}
                {verifyState === "error" ? (
                  <Button
                    variant="secondary"
                    className="mt-3 min-h-8 px-2.5 py-1.5 text-xs"
                    onClick={handleVerifyAuditChain}
                    data-testid="evidence-verify-retry"
                  >
                    <ShieldCheck size={14} />
                    Retry
                  </Button>
                ) : null}
              </StatusNotice>
            ) : null}
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">Live Ledger</div>
                  <div className="t-eyebrow mt-0.5 text-[var(--text-soft)]">
                    Evidence Graph
                  </div>
                </div>
                <Badge tone={evidenceGraph.score >= 80 ? "green" : evidenceGraph.score > 0 ? "blue" : "slate"}>
                  {evidenceGraph.score}/100
                </Badge>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">{evidenceGraph.summary}</p>
              {selectedEvidence ? (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${evidenceSourceIconTone(selectedEvidence.source)}`}>
                      <FileCheck2 size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--text)]">{selectedEvidence.item}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                        {selectedEvidence.source} · {selectedEvidence.control}
                      </div>
                    </div>
                  </div>
                  <Button className="mt-3 w-full justify-center" onClick={() => openSelectedEvidence(selectedEvidence)}>
                    <ChevronRight size={15} />
                    Open Source Record
                  </Button>
                  {sourceRecordStatus ? (
                    <StatusNotice tone="blue" compact className="mt-3" testId="evidence-source-record-status">
                      {sourceRecordStatus}
                    </StatusNotice>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                  Create the first use case, Skill, run, eval, or review to populate live provenance.
                </div>
              )}
            </div>
            <div className={`mt-4 rounded-lg border p-4 ${evidenceGaps.length ? "border-[var(--border)] bg-[var(--warning-soft)]" : "border-[var(--border)] bg-[var(--success-soft)]"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                {evidenceGaps.length ? <AlertTriangle size={16} className="text-[var(--warning)]" /> : <ShieldCheck size={16} className="text-[var(--success)]" />}
                {evidenceGaps.length ? "Most important gap" : "Packet can move forward"}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {evidenceGaps[0] ?? "No major evidence gaps detected for a pilot packet."}
              </p>
            </div>

            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
              data-testid="evidence-trace-replay"
              onClick={() => selectPacketTab("trace", true)}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <GitBranch size={16} className="text-[var(--primary)]" />
                  Trace replay
                </span>
                <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                  {activeTraceRun ? activeTraceRun.id : "planned proof path"} · {replaySteps.length} steps
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={activeTraceRun ? "green" : "amber"}>{activeTraceRun ? "runtime" : "planned"}</Badge>
                <ChevronRight size={15} className="text-[var(--text-soft)]" />
              </span>
            </button>
          </div>
        </div>
        ) : null}
        {activePacketTab === "trace" ? (
          <div
            id="evidence-trace-panel"
            role="tabpanel"
            aria-labelledby="evidence-trace-tab"
            className="grid xl:grid-cols-[minmax(0,1fr)_340px]"
            data-testid="evidence-tabpanel-trace"
          >
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-eyebrow text-[var(--text-soft)]">Trace replay</span>
                <Badge tone={activeTraceRun ? "green" : "amber"}>{activeTraceRun ? "runtime" : "planned"}</Badge>
                <Badge tone={operatingModel.nextStage?.complete ? "green" : "amber"}>
                  {operatingModel.nextStage?.label ?? "Signal"} next
                </Badge>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                {activeTraceRun ? `Replay ${activeTraceRun.id}` : "Planned trace for the next proof step"}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                {activeTraceRun
                  ? "A reviewer can follow the request from identity and policy through context, tools, output, cost, latency, and evidence."
                  : "No runtime trace exists yet, so the ledger shows the planned proof path needed before this can be reviewer-ready."}
              </p>

              <div className="mt-6 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Timeline</div>
                    <div className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                      {operatingModel.initiative.title} · {replaySteps.length} step{replaySteps.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => activeTraceRun ? onOpenRun(activeTraceRun.id) : onOpenView("harness")}
                  >
                    <ChevronRight size={15} />
                    {activeTraceRun ? "Open run" : "Open Harness"}
                  </Button>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {replaySteps.map((step, index) => (
                    <div key={`${step.label}-${index}`} className="grid gap-3 bg-[var(--surface)] px-4 py-4 sm:grid-cols-[40px_minmax(0,1fr)_100px]">
                      <span
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                          step.status === "completed"
                            ? "bg-[var(--success)] text-[var(--primary-contrast)]"
                            : step.status === "blocked"
                              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                              : step.status === "running"
                                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                                : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {step.status === "completed" ? <Check size={15} /> : index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-[var(--text)]">{step.label}</div>
                          <Badge
                            tone={
                              step.status === "completed"
                                ? "green"
                                : step.status === "blocked"
                                  ? "red"
                                  : step.status === "running"
                                    ? "amber"
                                    : "slate"
                            }
                          >
                            {step.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{step.detail}</p>
                      </div>
                      <div className="text-right text-xs font-semibold text-[var(--text-soft)]">
                        {step.latencyMs ? `${step.latencyMs}ms` : activeTraceRun ? "captured" : "planned"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="ea-calm-rail min-w-0 border-t p-5 xl:border-t-0">
              <SectionTitle title="Trace facts" helper="What this run contributes to proof" compact />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="Run" value={activeTraceRun?.id ?? "not run"} />
                <MiniMetric label="Status" value={activeTraceRun ? (statusLabels[activeTraceRun.status] ?? activeTraceRun.status) : "planned"} />
                <MiniMetric label="Latency" value={activeTraceRun ? `${activeTraceRun.latencyMs}ms` : "none"} />
                <MiniMetric label="Cost" value={activeTraceRun ? `$${activeTraceRun.costUsd.toFixed(4)}` : "$0.0000"} />
              </div>
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <GitBranch size={16} className="text-[var(--primary)]" />
                  Evidence graph
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{evidenceGraph.summary}</p>
                <div className="mt-3 space-y-2">
                  {evidenceGraph.nodes.slice(0, 5).map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      aria-label={`Open evidence graph node: ${node.label}`}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                      onClick={() => openEvidenceGraphNode(node)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-[var(--text)]">{node.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{node.evidenceCount} evidence records</span>
                      </span>
                      <Badge tone={graphStatusTone(node.status)}>{node.status}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
        {activePacketTab === "controls" ? (
          <div
            id="evidence-controls-panel"
            role="tabpanel"
            aria-labelledby="evidence-controls-tab"
            className="grid xl:grid-cols-[minmax(0,1fr)_340px]"
            data-testid="evidence-tabpanel-controls"
          >
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-eyebrow text-[var(--text-soft)]">Control coverage</span>
                <Badge tone={coverageBase >= 85 ? "green" : coverageBase > 0 ? "amber" : "slate"}>{coverageBase}% covered</Badge>
                <Badge tone={evidenceGaps.length ? "amber" : "green"}>{evidenceGaps.length ? `${evidenceGaps.length} gaps` : "no major gaps"}</Badge>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                Framework evidence map
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                Each framework card shows the controls the packet can already defend, plus the evidence still needed before review.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {controlCards.map((card) => (
                  <div key={card.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{card.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{card.subtitle}</div>
                      </div>
                      <Badge tone={card.coverage >= 85 ? "green" : card.coverage > 0 ? "amber" : "slate"}>{card.coverage}%</Badge>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[var(--surface-subtle)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${card.coverage}%` }} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {card.items.map((item) => (
                        <div key={item.label} className="flex items-start gap-2 text-sm leading-5">
                          {item.complete ? (
                            <Check size={15} className="mt-0.5 shrink-0 text-[var(--success)]" />
                          ) : (
                            <span className="mt-1 size-[14px] shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--surface)]" aria-hidden="true" />
                          )}
                          <span className={item.complete ? "text-[var(--text-muted)]" : "text-[var(--text-soft)]"}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="ea-calm-rail min-w-0 border-t p-5 xl:border-t-0">
              <SectionTitle title="Control gaps" helper="What must be added before review" compact />
              <div className="mt-4 space-y-2">
                {evidenceGaps.length ? (
                  evidenceGaps.slice(0, 6).map((gap) => (
                    <button
                      key={gap}
                      type="button"
                      aria-label={`Open next proof action for control gap: ${gap}`}
                      className="flex w-full items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-left text-sm leading-5 text-[var(--warning)] transition hover:bg-[var(--warning-soft)]"
                      onClick={() => onOpenView(nextProofAction.view)}
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{gap}</span>
                    </button>
                  ))
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--success-soft)] px-3 py-2 text-sm leading-5 text-[var(--success)]">
                    <Check size={14} className="mt-0.5 shrink-0" />
                    <span>No major evidence gaps detected for a pilot packet.</span>
                  </div>
                )}
              </div>
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="text-sm font-semibold text-[var(--text)]">Evidence sources</div>
                <div className="mt-3 space-y-2">
                  {evidenceSourceBreakdown.map((source) => (
                    <div key={source.store} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-[var(--text)]">{source.label}</span>
                        <code className="mt-0.5 block truncate text-[10px] text-[var(--text-soft)]">{source.store}</code>
                      </span>
                      <Badge tone={source.count ? "blue" : "slate"}>{source.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
        {activePacketTab === "records" ? (
          <div
            id="evidence-records-panel"
            role="tabpanel"
            aria-labelledby="evidence-records-tab"
            className="grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_360px]"
            data-testid="evidence-tabpanel-records"
          >
            <div className="min-w-0">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionTitle title="Evidence records" helper="Filter proof from audit logs, evals, reviews, runs, Skills, and use cases" compact />
                  <Badge tone="blue">{filteredRows.length} visible</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(220px,1fr)_160px_160px_130px]">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} />
                    <input
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
                      placeholder="Search records..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select
                    className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
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
                    className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
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
                    className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
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
                <>
                <div
                  aria-label="Evidence records table scroll area"
                  className="max-h-[680px] overflow-auto focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)]"
                  data-testid="data-table-scroll"
                  role="region"
                  tabIndex={0}
                >
                  <table aria-label="Evidence records" className="w-full min-w-[860px] text-left text-sm">
                    <caption className="sr-only">Evidence records</caption>
                    <thead className="sticky top-0 z-[1] bg-[var(--surface-muted)] text-xs font-semibold uppercase tracking-normal text-[var(--text-muted)]">
                      <tr>
                        {["Evidence", "Control", "Risk", "Confidence", "Time"].map((column) => (
                          <th key={column} scope="col" className="px-5 py-3">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredRows.map((row) => {
                        const selected = selectedEvidence?.id === row.id;
                        return (
                          <tr
                            key={row.id}
                            aria-label={`Select evidence record ${row.item}`}
                            aria-selected={selected}
                            className={`cursor-pointer transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)] focus-visible:ring-inset ${
                              selected ? "bg-[var(--primary-soft)]/80" : "hover:bg-[var(--surface-muted)]"
                            }`}
                            tabIndex={0}
                            onClick={() => selectEvidence(row.id)}
                            onKeyDown={(event) => handleEvidenceRowKeyDown(event, row.id)}
                          >
                            <td className="px-5 py-4 align-top">
                              <div className="flex items-start gap-3">
                                <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg ${evidenceSourceIconTone(row.source)}`}>
                                  <FileCheck2 size={16} />
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone={evidenceSourceTone(row.source)}>{row.source}</Badge>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">{row.type.replace(/_/g, " ")}</span>
                                  </div>
                                  <div className="mt-2 font-semibold text-[var(--text)]">{row.item}</div>
                                  <div className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{row.evidence}</div>
                                  <code className="mt-2 block text-[11px] text-[var(--text-soft)]">{row.store} / {row.id}</code>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="space-y-2">
                                <Badge tone={frameworkTone(row.framework)}>{row.framework}</Badge>
                                <code className="block rounded bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">{row.control}</code>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <Badge tone={riskTone(row.risk)}>{row.risk}</Badge>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <Badge tone={evidenceConfidenceTone(row.confidence)}>{row.confidence.replace("_", " ")}</Badge>
                            </td>
                            <td className="px-5 py-4 align-top text-[var(--text-muted)]">{row.time}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-xs font-medium text-[var(--text-muted)]">
                  Showing {filteredRows.length.toLocaleString()} evidence record{filteredRows.length === 1 ? "" : "s"}
                </div>
                </>
              ) : (
                <div className="p-8">
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
                    <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] shadow-sm">
                      <FileCheck2 size={18} />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-[var(--text)]">No evidence recorded yet</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                      Evidence appears after real workspace actions: use case submissions, Skill updates, Harness runs, approvals, evals, governance reviews, or imports.
                    </p>
                    <Button className="mt-4" onClick={() => onOpenView("factory")}>
                      <Plus size={16} />
                      Create First Evidence Source
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <aside className="ea-calm-rail min-w-0 border-t p-5 xl:border-l xl:border-t-0">
              {selectedEvidence ? (
                <div className="space-y-4">
                  <div>
                    <div className="t-eyebrow text-[var(--text-soft)]">Selected evidence</div>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">{selectedEvidence.item}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{selectedEvidence.evidence}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniMetric label="Source" value={selectedEvidence.source} />
                    <MiniMetric label="Risk" value={selectedEvidence.risk} />
                    <MiniMetric label="Framework" value={selectedEvidence.framework} />
                    <MiniMetric label="Confidence" value={selectedEvidence.confidence.replace("_", " ")} />
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="t-eyebrow text-[var(--text-soft)]">Provenance</div>
                    <code className="mt-2 block whitespace-pre-wrap text-xs leading-5 text-[var(--text-muted)]">
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
                    <StatusNotice tone="blue" testId="evidence-source-record-detail-status">
                      {sourceRecordStatus}
                    </StatusNotice>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </Panel>
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
  if (source.includes("Eval")) return "bg-[var(--primary-soft)] text-[var(--primary)]";
  if (source.includes("Governance")) return "bg-[var(--success-soft)] text-[var(--success)]";
  if (source.includes("Harness")) return "bg-[var(--info-soft)] text-[var(--info)]";
  if (source.includes("Use case")) return "bg-[var(--warning-soft)] text-[var(--warning)]";
  if (source.includes("Skill")) return "bg-[var(--info-soft)] text-[var(--info)]";
  return "bg-[var(--surface-subtle)] text-[var(--text-muted)]";
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
    `- Eval evidence records: ${params.evalResults.length}`,
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
