"use client";

import { Edge, Node } from "@xyflow/react";

import { AuditLog, EvalResult, formatCurrency, GovernanceReview, Run, Skill, ToolRequest, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";
import { deriveActionInbox } from "@/lib/action-inbox";

import { derivePrimetimeLaunchGate } from "@/lib/primetime-launch-gate";

import { deriveTransformationCommandSystem } from "@/lib/transformation-command-system";
import { activeCommandOrders, type CommandOrderRecord } from "@/lib/command-orders";
import { deriveCompanyBlueprint } from "@/lib/company-blueprint";

import type { ProviderReadiness } from "@/lib/provider-registry";

import type { OrchestratorAction, OrchestratorMessage, ProductionReadiness } from "@/lib/ui/types";
import { autonomyLabels, navItems, statusLabels } from "@/lib/ui/constants";

import { buildOrchestratorAction as makeOrchestratorAction, orchestratorActionForView as actionForView, orchestratorViewFromPrompt as viewFromPrompt } from "@/lib/orchestrator-actions";



import { inferDepartmentFromPrompt } from "@/lib/use-case-drafting";
import { hasWorkSignalCaptureIntent, isThinWorkSignalPrompt } from "@/lib/work-signal-drafting";
import { acceptedExamplePayload, hasUseCaseDraftIntent, interpretOrchestratorMessage, isGetStartedIntent, isThinUseCaseDraftPrompt, recentUseCaseCandidate, routingMatchStrength, supportEmailUseCaseExample, topicLabelForUseCase } from "@/lib/orchestrator-conversation";
import { deriveAssistantQualityProgram, deriveConnectorPosture, deriveEvidenceQuality, deriveOperatingTimeline, deriveRoleOperatingMode, deriveWorkspaceSetupGuide } from "@/lib/enterprise-operating-intelligence";

import { analyzeWorkflow } from "@/components/views";

// Metrics snapshot the planner reads (mirrors the `metrics` useMemo in Home()).
type OrchestratorMetricsSnapshot = {
  totalUseCases: number;
  activePilots: number;
  skills: number;
  adoptionRate: number;
  hoursSaved: number;
  riskItemsOpen: number;
  annualValue: number;
};

export type ClientPlannerContext = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  auditLogs: AuditLog[];
  toolRequests: ToolRequest[];
  workSignals: WorkSignal[];
  commandOrders: CommandOrderRecord[];
  orchestratorMessages: OrchestratorMessage[];
  productionReadiness: ProductionReadiness | null;
  providerVault: ProviderReadiness[];
  nodes: Node[];
  edges: Edge[];
  selectedRun: Run | null;
  selectedSkill: Skill | null;
  actionInboxItems: ReturnType<typeof deriveActionInbox>;
  connectorPosture: ReturnType<typeof deriveConnectorPosture>;
  roleProfile: ReturnType<typeof deriveRoleOperatingMode>;
  setupGuide: ReturnType<typeof deriveWorkspaceSetupGuide>;
  evidenceQuality: ReturnType<typeof deriveEvidenceQuality>;
  assistantQuality: ReturnType<typeof deriveAssistantQualityProgram>;
  operatingTimeline: ReturnType<typeof deriveOperatingTimeline>;
  primetimeLaunchGate: ReturnType<typeof derivePrimetimeLaunchGate>;
  companyBlueprint: ReturnType<typeof deriveCompanyBlueprint>;
  transformationCommand: ReturnType<typeof deriveTransformationCommandSystem>;
  metrics: OrchestratorMetricsSnapshot;
  lastAssistantAskedForIntakeForm: () => boolean;
  lastAssistantAskedForWorkSignalForm: () => boolean;
  summarizeOrchestratorActionMemory: () => { lastAction: string; lastRecommendation: string; summary: string };
};

export type ClientOrchestratorPlan = {
  content: string;
  actions: OrchestratorAction[];
  autoActions: OrchestratorAction[];
  evidence: OrchestratorMessage["evidence"];
};

export function planClientOrchestratorResponse(message: string, ctx: ClientPlannerContext): ClientOrchestratorPlan {
  const {
    useCases, skills, runs, governanceReviews, evalResults, auditLogs, toolRequests, workSignals,
    commandOrders, orchestratorMessages, productionReadiness, providerVault, nodes, edges,
    selectedRun, selectedSkill, actionInboxItems, connectorPosture, roleProfile, setupGuide,
    evidenceQuality, assistantQuality, operatingTimeline, primetimeLaunchGate, companyBlueprint,
    transformationCommand, metrics, lastAssistantAskedForIntakeForm, lastAssistantAskedForWorkSignalForm,
    summarizeOrchestratorActionMemory,
  } = ctx;
    const text = message.trim();
    const lower = text.toLowerCase();
    const actions: OrchestratorAction[] = [];
    const autoActions: OrchestratorAction[] = [];
    const workflowValidation = analyzeWorkflow(nodes, edges);
    const configuredProviders = providerVault.filter((provider) => provider.configured && provider.id !== "local");
    const topUseCase = [...useCases].sort((a, b) => b.priorityScore - a.priorityScore)[0];
    const reviewBlockers = governanceReviews.filter((review) => review.blockers.length || ["changes_requested", "in_review"].includes(review.status));
    const activeGovernanceReview = reviewBlockers[0] ?? governanceReviews.find((review) => ["not_submitted", "in_review"].includes(review.status));
    const pendingToolRequest = toolRequests.find((request) => request.status === "pending");
    const openActionItems = actionInboxItems.filter((item) => item.severity !== "success");
    const hasCommandIntent = /\b(open|show|go to|take me|navigate|switch to)\b/.test(lower);
    const requestedView = viewFromPrompt(lower);
    const liveCommandOrders = activeCommandOrders(commandOrders);
    const evidenceCount = auditLogs.length + runs.length + evalResults.length + governanceReviews.length;
    const acceptedExample = acceptedExamplePayload(text, orchestratorMessages);
    const recentCandidate = recentUseCaseCandidate(orchestratorMessages);
    const actionMemory = summarizeOrchestratorActionMemory();
    const interpretation = interpretOrchestratorMessage({
      history: orchestratorMessages,
      message: text,
      workspace: {
        evidence: evidenceCount,
        governanceReviews: governanceReviews.length,
        launchScore: primetimeLaunchGate.score,
        pendingToolRequests: pendingToolRequest ? 1 : 0,
        requestedView: requestedView ?? undefined,
        runs: runs.length,
        skills: metrics.skills,
        useCases: metrics.totalUseCases,
        workflowIssues: workflowValidation.issues.length,
        workSignals: workSignals.length,
      },
    });

    const evidence = [
      { label: "Routing (rule-based)", value: `${interpretation.goal} — keyword match: ${routingMatchStrength(interpretation.confidence)}` },
      { label: "Matched rules", value: interpretation.rationale || "safe routing" },
      ...(actionMemory.lastAction || actionMemory.lastRecommendation
        ? [{ label: "Memory", value: actionMemory.summary }]
        : []),
      { label: "Use cases", value: String(metrics.totalUseCases) },
      { label: "Skills", value: String(metrics.skills) },
      { label: "Runs", value: String(runs.length) },
      { label: "Work signals", value: String(workSignals.length) },
      { label: "Evidence", value: String(evidenceCount) },
      { label: "Evidence quality", value: `${evidenceQuality.score}/100` },
      { label: "Connector posture", value: connectorPosture.summary },
      { label: "Role lens", value: roleProfile.lens },
      { label: "Annual value", value: formatCurrency(metrics.annualValue) },
      { label: "Adoption", value: `${metrics.adoptionRate}%` },
      { label: "Command system", value: `${transformationCommand.score}/100` },
    ].slice(0, 9);

    if (interpretation.intent === "launch_readiness_review") {
      const targetView = primetimeLaunchGate.nextAction.targetView ?? "launch";
      const nextButton =
        targetView === "evals"
          ? makeOrchestratorAction("run_selected_eval", "Run launch eval suite", "Generate launch-grade eval evidence for the selected Skill.", undefined, "primary")
          : targetView === "workflow"
            ? makeOrchestratorAction("validate_workflow", "Validate launch workflow", "Run graph and policy validation for the launch path.", undefined, "primary")
            : targetView === "harness"
              ? makeOrchestratorAction("run_selected_skill", "Run selected Skill", "Create the traceable Harness run needed for readiness.", undefined, "primary")
              : targetView === "governance"
                ? makeOrchestratorAction("submit_selected_governance", "Submit governance review", "Create or open the launch governance decision path.", undefined, "primary")
                : actionForView(targetView, "Open next readiness blocker");
      const blockerLines = [
        workflowValidation.issues.length ? `Workflow has ${workflowValidation.issues.length} blocking issue(s).` : "",
        pendingToolRequest ? `${pendingToolRequest.toolId} is waiting for approval.` : "",
        activeGovernanceReview?.blockers.length ? `Governance has ${activeGovernanceReview.blockers.length} blocker(s) on ${activeGovernanceReview.title}.` : "",
        primetimeLaunchGate.score < 85 ? primetimeLaunchGate.summary : "",
      ].filter(Boolean);
      const evidenceGaps = [
        runs.length ? "" : "Traceable Harness run",
        evalResults.length ? "" : "Launch eval result",
        governanceReviews.length ? "" : "Governance decision record",
        auditLogs.length ? "" : "Audit trail",
      ].filter(Boolean);

      actions.push(
        nextButton,
        actionForView("launch", "Open Launch Center"),
        actionForView("evidence", "Open Proof Ledger"),
        actionForView("governance", "Open Risk Review"),
        makeOrchestratorAction("generate_exec_brief", "Generate launch brief", "Package blockers, gaps, and next action for leadership."),
      );

      return {
        content: [
          `Launch readiness review: ${primetimeLaunchGate.status} at ${primetimeLaunchGate.score}/100.`,
          `Blockers: ${blockerLines.length ? blockerLines.join(" ") : "No blocking workflow, tool, or governance item is visible in the current workspace."}`,
          `Evidence gaps: ${evidenceGaps.length ? evidenceGaps.join(", ") : "Core trace, eval, governance, and audit evidence are present; inspect Proof Ledger for completeness."}`,
          `Next button to click: ${nextButton.label}. ${primetimeLaunchGate.nextAction.nextAction}`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "navigate" && hasCommandIntent && requestedView) {
      const action = actionForView(requestedView);
      autoActions.push(action);
      return {
        content: `Done. I’m opening ${navItems.find((item) => item.id === requestedView)?.label ?? requestedView}.`,
        actions: [actionForView("orchestrator", "Return to Orchestrator")],
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "accepted_example" && acceptedExample) {
      const draft = makeOrchestratorAction(
        "draft_use_case",
        "Draft intake from accepted example",
        "Prefill Use Cases from the example you approved.",
        { message: acceptedExample },
        "primary",
      );
      autoActions.push(draft);
      actions.push(actionForView("factory", "Open drafted intake"), actionForView("governance", "Review email-response boundaries"));

      return {
        content:
          "Got it. I’ll use the example as the seed intake now, keep risky assumptions reviewable, and open Use Cases so you can inspect the draft before converting it into a Skill.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "example_request" && (lastAssistantAskedForIntakeForm() || recentCandidate)) {
      actions.push(
        makeOrchestratorAction("draft_use_case", "Use this example", "Prefill the intake from the sample support email workflow.", { message: supportEmailUseCaseExample }, "primary"),
        makeOrchestratorAction("open_intake", "Open blank intake", "Open Use Cases without applying the example."),
      );

      return {
        content: [
          "A good response is specific enough to produce an intake without inventing business facts.",
          `Example: "${supportEmailUseCaseExample}"`,
          "If that is close enough for a starter draft, use the action below; otherwise replace the team, volume, systems, or human-review boundaries with the real values.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "use_case_intake" && isGetStartedIntent(text) && recentCandidate) {
      const topic = topicLabelForUseCase(recentCandidate);
      actions.push(
        makeOrchestratorAction("draft_use_case", "Draft support-email starter", "Use a realistic support email starter intake you can edit.", { message: supportEmailUseCaseExample }, "primary"),
        makeOrchestratorAction("open_intake", "Open intake form", "Open Use Cases while you answer."),
        actionForView("work", "Capture work signal first"),
      );

      return {
        content: [
          `Good. Let’s shape ${topic} into a first governed use case.`,
          "Reply with the owner, monthly volume, systems involved, and anything AI must not do. If you want a safe starter, use the support-email example action and edit it in Use Cases.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "use_case_intake" && isGetStartedIntent(text) && !metrics.totalUseCases) {
      actions.push(
        makeOrchestratorAction("open_intake", "Create first use case", "Start guided Use Cases intake.", undefined, "primary"),
        actionForView("work", "Capture work signal"),
        actionForView("blueprint", "Open company plan"),
      );

      return {
        content:
          "Let’s start by creating one governed use case, because the OS needs a real business workflow before it can build Skills, traces, approvals, ROI, or launch proof. Send me a workflow in one sentence, or open intake and I’ll guide the fields.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "fill_starter") {
      actions.push(
        makeOrchestratorAction(
          "draft_use_case",
          "Use support-email starter",
          "Prefill a realistic editable intake for routine support email drafts.",
          { message: supportEmailUseCaseExample },
          "primary",
        ),
        makeOrchestratorAction("open_intake", "Open blank intake", "Open the intake without starter assumptions."),
      );

      return {
        content:
          "I should not invent company facts, but I can give you a realistic starter intake and keep it clearly editable. Use the starter if you want a support-email draft, or replace it with your real owner, volume, systems, and human-review boundaries.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (lastAssistantAskedForIntakeForm() && text.length >= 16 && !hasUseCaseDraftIntent(text)) {
      actions.push(
        makeOrchestratorAction("draft_use_case", "Draft intake from answers", "Prefill the Use Cases intake form from your answers.", { message: text }, "primary"),
        actionForView("factory", "Open Use Cases"),
      );

      return {
        content:
          "That is enough to prepare a first intake draft. I’ll keep uncertain volume, risk, and data fields reviewable inside Use Cases instead of pretending they are confirmed.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (lastAssistantAskedForWorkSignalForm() && text.length >= 16 && !hasWorkSignalCaptureIntent(text)) {
      actions.push(
        makeOrchestratorAction("capture_work_signal", "Capture work signal", "Add this as a redacted aggregate Work Intelligence signal.", { message: text }, "primary"),
        actionForView("work", "Open Work Signals"),
        actionForView("factory", "Open Use Cases"),
      );

      return {
        content:
          "That is enough to capture a privacy-safe aggregate signal. I’ll store it as redacted Work Intelligence evidence, then you can promote it into a use case when the owner is ready.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "setup_guide") {
      actions.push(...setupGuide.firstActions.map((item) => actionForView(item.targetView, item.label)));

      return {
        content: [
          setupGuide.summary,
          "Setup questions:",
          ...setupGuide.questions.map((question, index) => `${index + 1}. ${question}`),
          "I can use those answers to create the company blueprint, first work signal, first use case, connector path, and reviewer plan.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "operating_timeline") {
      const lines = operatingTimeline.entries.slice(0, 6).map((entry, index) => `${index + 1}. ${entry.title} - ${entry.detail}`);
      actions.push(actionForView("command", "Open Command Center"), actionForView("evidence", "Open Proof Ledger"), actionForView("reports", "Generate timeline brief"));

      return {
        content: [
          `Operating timeline: ${operatingTimeline.total} workspace event(s) are visible.`,
          operatingTimeline.latestSummary || actionMemory.summary,
          lines.length ? "Recent activity:" : "No detailed timeline entries are available yet.",
          ...lines,
          actionMemory.lastAction || actionMemory.lastRecommendation ? `Assistant memory: ${actionMemory.summary}.` : "",
        ].filter(Boolean).join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "role_mode") {
      actions.push(actionForView(roleProfile.defaultView, "Open role home"), actionForView("evidence", "Open proof for this role"), actionForView("admin", "Review role settings"));

      return {
        content: [
          `Role lens: ${roleProfile.label} (${roleProfile.lens}).`,
          `Default surface: ${roleProfile.defaultView}.`,
          `Priorities: ${roleProfile.priorities.join("; ")}.`,
          `Guardrail: ${roleProfile.guardrail}`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "response_quality") {
      const checks = assistantQuality.checks.map((check, index) => `${index + 1}. ${check.label}: ${check.status} - ${check.evidence}`);
      actions.push(actionForView("evals", "Open Quality Evals"), actionForView("orchestrator", "Run assistant prompts"), actionForView("evidence", "Open assistant proof"));

      return {
        content: [
          `Assistant quality harness: ${assistantQuality.status} at ${assistantQuality.score}/100.`,
          assistantQuality.summary,
          "Checks:",
          ...checks,
          `Next action: ${assistantQuality.nextAction}`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "command_complete") {
      const firstOrder = liveCommandOrders[0];
      actions.push(
        firstOrder
          ? makeOrchestratorAction(
              "complete_command_order",
              `Complete ${firstOrder.title}`,
              "Mark this command order complete in the workspace ledger.",
              { orderId: firstOrder.id },
              "primary",
            )
          : actionForView("command", "Open Home"),
      );

      return {
        content: firstOrder
          ? `I found the next live command order: ${firstOrder.title}. Use the action to close it once the evidence is truly handled.`
          : "There are no active command orders to complete right now.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "capability_help") {
      actions.push(
        actionForView("factory", "Open Use Cases"),
        topUseCase
          ? makeOrchestratorAction("open_top_use_case", "Open top opportunity", "Open the highest-priority use case.", { useCaseId: topUseCase.id }, "primary")
          : makeOrchestratorAction("open_intake", "Create first use case", "Start structured intake.", undefined, "primary"),
        actionForView("strategy", "Open Strategy & Roadmap"),
        actionForView("process", "Open Process Studio"),
        actionForView("workflow", "Open Workflow Studio"),
        actionForView("harness", "Open AI Harness"),
        actionForView("evidence", "Open Proof Ledger"),
        makeOrchestratorAction("generate_exec_brief", "Generate exec brief", "Create a report from current workspace state.", undefined, "primary"),
      );

      return {
        content:
          "I can operate the whole OS from here: answer workspace questions, summarize metrics, critique gaps, draft use cases, route you to any surface, validate and test workflows, run selected Skills, run evals, submit governance reviews, inspect evidence, generate executive briefs, and open provider/admin settings. For high-impact actions like publishing, approvals, or connector writes, I return visible action buttons rather than silently doing it.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "command_system") {
      const firstOrder = liveCommandOrders[0];
      actions.push(
        firstOrder
          ? makeOrchestratorAction(
              "open_command_order",
              firstOrder.title,
              "Open this command order and mark it in progress.",
              { orderId: firstOrder.id },
              "primary",
            )
          : actionForView(transformationCommand.nextAction.targetView, transformationCommand.nextAction.title),
        ...liveCommandOrders.slice(1, 3).map((order) =>
          makeOrchestratorAction(
            "open_command_order",
            order.title,
            "Open this command order and mark it in progress.",
            { orderId: order.id },
          ),
        ),
        actionForView("command", "Open Home"),
      );

      return {
        content: [
          transformationCommand.operatorBrief,
          `Why now: ${transformationCommand.whyNow}`,
          `Proof needed: ${transformationCommand.nextAction.evidenceNeeded}`,
          liveCommandOrders.length ? `${liveCommandOrders.length} live command orders are persisted in this workspace.` : "",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "next_best_action") {
      const firstOrder = liveCommandOrders[0];
      const targetView = firstOrder?.targetView ?? transformationCommand.nextAction.targetView ?? "factory";
      const targetLabel =
        firstOrder?.title ??
        transformationCommand.nextAction.title ??
        (topUseCase ? `Advance ${topUseCase.title}` : "Create the first scored use case");
      const reason =
        firstOrder?.why ??
        transformationCommand.nextAction.why ??
        transformationCommand.nextAction.evidenceNeeded ??
        (topUseCase
          ? "It is the highest-priority opportunity and should be tied to Skill, workflow, Harness, governance, proof, and value evidence."
          : "The OS needs a business-owned opportunity before it can prove value, risk, and readiness.");
      const nextProof =
        transformationCommand.nextAction.evidenceNeeded ??
        (activeGovernanceReview
          ? `Resolve review evidence for ${activeGovernanceReview.title}.`
          : "Attach the next trace, review, value, or adoption proof to the Proof Ledger.");

      actions.push(
        firstOrder
          ? makeOrchestratorAction(
              "open_command_order",
              targetLabel,
              "Open the next persisted command order.",
              { orderId: firstOrder.id },
              "primary",
            )
          : topUseCase
            ? makeOrchestratorAction("open_top_use_case", "Open top opportunity", "Inspect and advance the highest-priority opportunity.", { useCaseId: topUseCase.id }, "primary")
            : makeOrchestratorAction("open_intake", "Create first use case", "Start structured intake.", undefined, "primary"),
        actionForView(targetView, "Open recommended surface"),
        actionForView("governance", "Open Risk Review"),
        actionForView("evidence", "Open Proof Ledger"),
        makeOrchestratorAction("generate_exec_brief", "Generate exec brief", "Create a leadership-ready brief once the evidence is current."),
      );

      return {
        content: [
          actionMemory.lastAction || actionMemory.lastRecommendation ? `${actionMemory.summary}.` : "",
          `Recommended move: ${targetLabel}.`,
          `Why: ${reason}`,
          `Proof quality: ${evidenceQuality.summary}`,
          "Action plan:",
          `1. Open ${targetLabel} and confirm the owner, workflow, risk, and expected business outcome.`,
          `2. Produce the next proof: ${nextProof}`,
          `3. Clear visible blockers: ${workflowValidation.issues.length} workflow issue(s), ${pendingToolRequest ? 1 : 0} pending tool approval(s), and ${activeGovernanceReview?.blockers.length ?? 0} active governance blocker(s).`,
          "4. Record the result in Proof Ledger, then generate the executive brief only after the evidence is attached.",
        ].filter(Boolean).join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "company_blueprint") {
      actions.push(
        actionForView("blueprint", "Open Company Blueprint"),
        actionForView(companyBlueprint.firstMove.targetView, "Open next blueprint move"),
        actionForView("orchestrator", "Keep working with Orchestrator"),
      );

      return {
        content: [
          `Company Blueprint: ${companyBlueprint.archetype} at ${companyBlueprint.score}/100.`,
          companyBlueprint.summary,
          `Next move: ${companyBlueprint.firstMove.title} - ${companyBlueprint.firstMove.detail}`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "report") {
      const action = makeOrchestratorAction("generate_exec_brief", "Generate exec brief", "Create a report from current workspace state.", undefined, "primary");
      autoActions.push(action);
      return {
        content: "I’m generating the executive brief from the live workspace state and opening Reports.",
        actions: [actionForView("reports", "Open Reports"), actionForView("evidence", "Open Proof Ledger")],
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "strategy") {
      actions.push(
        actionForView("strategy", "Open Strategy & Roadmap"),
        actionForView("factory", "Open Opportunity Funnel"),
        actionForView("reports", "Prepare executive brief"),
      );

      return {
        content: `The roadmap currently has ${useCases.length} opportunities, ${metrics.activePilots} active pilots, ${skills.length} reusable Skills, ${governanceReviews.length} governance records, and ${formatCurrency(metrics.annualValue)} tracked annualized value. The next strategic move is ${useCases.length ? "to unblock governance, industrialize repeatable Skills, and measure adoption-adjusted value." : "to capture the first function-level pain points and baseline value."}`,
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "process_design") {
      actions.push(
        actionForView("process", "Open Process Studio"),
        actionForView("workflow", "Open Workflow Studio"),
        actionForView("factory", "Open Use Case Detail"),
      );

      return {
        content: topUseCase
          ? `${topUseCase.title} is the highest-priority candidate for process redesign. The Process Studio can turn its current process, desired outcome, volume, risk, and reuse score into a future-state operating model before any automation is built.`
          : "No use case is available for process redesign yet. Start with a function pain point, then use the Process Studio to separate workflow redesign from pure automation.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "work_intelligence") {
      actions.push(
        actionForView("work", "Open Work Intelligence"),
        actionForView("factory", "Create opportunity from signal"),
        actionForView("process", "Open Process Studio"),
        actionForView("governance", "Review signal governance"),
      );

      return {
        content: workSignals.length
          ? `Work Intelligence has ${workSignals.length} governed, redacted signals across ${new Set(workSignals.map((signal) => signal.department)).size} departments. It should learn from approved work-system metadata, Harness traces, workflow delays, feedback, and context gaps, but it must not inspect private messages, store raw content, rank employees, or make employment decisions.`
          : "Work Intelligence is ready structurally, but no governed work signals are connected yet. Start with aggregated metadata from ticketing, workflow systems, learning systems, Context Fabric, and Harness traces, with PII redaction and no individual scoring.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "prompt_contract") {
      actions.push(
        actionForView("skills", "Review Skill prompts"),
        actionForView("evals", "Run prompt evals"),
        actionForView("harness", "Inspect Harness traces"),
        actionForView("evidence", "Check evidence coverage"),
      );

      return {
        content:
          "Prompt engineering in this OS should be treated as a governed contract: role scope, approved context boundaries, prompt-injection handling, tool/action limits, human approval rules, output shape, eval coverage, and evidence capture. The next best move is to inspect the selected Skill prompt, run evals, and verify the Harness trace shows the prompt contract.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "intelligence") {
      actions.push(
        actionForView("orchestrator", "Open AI Orchestrator"),
        actionForView("strategy", "Open Strategy"),
        actionForView("work", "Open Work Intelligence"),
        actionForView(transformationCommand.nextAction.targetView, transformationCommand.nextAction.title),
        makeOrchestratorAction("generate_exec_brief", "Generate decision memo", "Create an executive-ready recommendation.", undefined, "primary"),
      );

      return {
        content:
          `The smartest operating mode is evidence-first: combine portfolio data, governed work signals, Harness traces, eval outcomes, and adoption metrics to recommend next best actions. ${transformationCommand.operatorBrief} Assistant quality is ${assistantQuality.status} at ${assistantQuality.score}/100. Current lens is ${roleProfile.label}: ${roleProfile.guardrail}`,
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "feedback") {
      const missingSignals = workSignals.length === 0;
      const missingSkills = metrics.skills === 0;
      const workflowNeedsWork = !workflowValidation.valid || workflowValidation.issues.length > 0 || workflowValidation.configuredCount === 0;
      const evidenceNeedsWork = evidenceCount < 6;
      actions.push(
        topUseCase
          ? makeOrchestratorAction("open_top_use_case", "Open top opportunity", "Inspect the highest-priority use case.", { useCaseId: topUseCase.id }, "primary")
          : makeOrchestratorAction("open_intake", "Create first use case", "Start structured intake.", undefined, "primary"),
        actionForView("launch", "Open launch readiness"),
        actionForView("governance", "Open Risk Review"),
        actionForView("evidence", "Open Proof Ledger"),
        actionForView("roi", "Open Value & ROI"),
        makeOrchestratorAction("generate_exec_brief", "Generate feedback brief", "Package the critique and next moves for leadership."),
      );

      return {
        content: [
          "Here is the operating feedback I would give a company team using this workspace:",
          missingSignals
            ? "1. Capture governed work signals first. The assistant can reason better when repeated demand, process pain, owners, and context gaps are recorded."
            : `1. Work signal coverage exists with ${workSignals.length} signal record(s), so the next question is whether they are tied to scored use cases and proof.`,
          missingSkills
            ? "2. Convert a priority use case into a governed Skill. Until a Skill exists, Harness, eval, governance, and ROI evidence stay thin."
            : `2. There are ${metrics.skills} Skill(s); the quality bar is traceable runs, eval pass rate, tool policy, approved context, and governance status.`,
          workflowNeedsWork
            ? `3. Workflow needs builder attention: ${workflowValidation.issues.length} issue(s), ${workflowValidation.warnings.length} warning(s), ${workflowValidation.configuredCount} configured block(s).`
            : "3. Workflow structure is valid. The next test is whether Harness traces and governance evidence prove it behaves safely.",
          reviewBlockers.length
            ? `4. Governance has ${reviewBlockers.length} blocker/review item(s). Resolve them before claiming production readiness.`
            : "4. Governance is not currently blocking, but approvals should still be attached to each launch candidate.",
          evidenceNeedsWork
            ? `5. ${evidenceQuality.summary} Major-company buyers will expect traces, evals, controls, approvals, adoption, and ROI proof.`
            : `5. ${evidenceQuality.summary} Package it into a Proof Ledger packet and executive report.`,
          openActionItems.length ? `6. Action inbox has ${openActionItems.length} open item(s). Clear those before expanding the rollout.` : "6. Action inbox is clear enough to focus on the next proof-producing move.",
          `7. ${connectorPosture.summary} ${connectorPosture.nextAction}`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "connector_setup") {
      const connectorCatalog = productionReadiness?.connectors?.catalog;
      const connectors = connectorCatalog?.connectors ?? [];
      const nextConnector =
        connectors.find((connector) => connector.status === "partial") ??
        connectors.find((connector) => connector.status === "missing") ??
        connectors.find((connector) => !["ready", "broker-managed"].includes(connector.status)) ??
        connectors[0];
      const readyCount = connectorCatalog?.readyCount ?? connectors.filter((connector) => ["ready", "broker-managed"].includes(connector.status)).length;
      const requiredCount = connectorCatalog?.requiredCount ?? Math.max(connectors.length, 1);
      const missingSecretCount = connectors.reduce((sum, connector) => sum + connector.missingSecrets.length, 0);
      const proofGap = connectorPosture.proofGaps[0];

      actions.push(
        actionForView("connectors", "Open Connect Apps"),
        makeOrchestratorAction("open_ai_settings", "Open company setup", "Configure model providers, app connectors, tenant secrets, and policy gates.", undefined, "primary"),
        actionForView("broker", "Open Broker policies"),
        actionForView("context", "Open Knowledge Sources"),
        actionForView("evidence", "Inspect connector evidence"),
      );

      return {
        content: [
          `Connector posture: ${connectorPosture.summary || `${readyCount}/${requiredCount} connectors are ready or broker-managed.`}`,
          nextConnector
            ? `Next connector: ${nextConnector.label}. ${nextConnector.nextActivationAction ?? nextConnector.setupAction ?? connectorPosture.nextAction}`
            : connectorPosture.nextAction || "No connector catalog is loaded yet. Open Connect Apps and run readiness to generate the activation path.",
          missingSecretCount
            ? `${missingSecretCount} required secret value(s) still need tenant-safe storage before native connector execution.`
            : "No required connector secrets are missing in the current readiness snapshot.",
          `Launch proof: ${connectorPosture.launchReadyCount}/${connectorPosture.requiredCount} connectors have read-test, action-gate, and Evidence Ledger proof. ${proofGap ? `Top proof gap: ${proofGap}.` : "No connector proof gaps are currently recorded."}`,
          "The production path is identity, model default, approved knowledge source, one work-system connector, Broker policy, then Evidence Ledger proof.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "launch_status") {
      actions.push(
        actionForView("connectors", "Open connector launch path"),
        actionForView(primetimeLaunchGate.nextAction.targetView, "Open next launch gate"),
        actionForView("admin", "Open Settings readiness"),
        actionForView("evidence", "Inspect evidence packet"),
        makeOrchestratorAction("generate_exec_brief", "Generate launch brief", "Package launch posture for executives.", undefined, "primary"),
      );

      if (primetimeLaunchGate.nextAction.targetView === "workflow") {
        actions.push(makeOrchestratorAction("validate_workflow", "Validate workflow", "Run the current graph validation."));
      }
      if (primetimeLaunchGate.nextAction.targetView === "harness") {
        actions.push(makeOrchestratorAction("run_selected_skill", "Run selected Skill", "Create the traceable Harness evidence.", undefined, "primary"));
      }
      if (primetimeLaunchGate.nextAction.targetView === "evals") {
        actions.push(makeOrchestratorAction("run_selected_eval", "Run eval suite", "Generate launch-grade eval evidence."));
      }
      if (primetimeLaunchGate.nextAction.targetView === "governance") {
        actions.push(makeOrchestratorAction("submit_selected_governance", "Submit governance review", "Create or open the governance decision path."));
      }

      return {
        content: [
          `Primetime launch gate is ${primetimeLaunchGate.status} at ${primetimeLaunchGate.score}/100.`,
          primetimeLaunchGate.summary,
          `Next move: ${primetimeLaunchGate.nextAction.nextAction}`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "skill_operation" && /\b(convert|industrialize|turn|package|make|create)\b/.test(lower)) {
      if (topUseCase) {
        actions.push(
          makeOrchestratorAction(
            "convert_top_use_case_to_skill",
            topUseCase.linkedSkillId ? "Open linked Skill" : "Convert top opportunity to Skill",
            topUseCase.linkedSkillId
              ? "Open the existing governed Skill package."
              : "Create the Skill, prompt, model settings, tool policy, context references, and launch checklist from the top opportunity.",
            { useCaseId: topUseCase.id },
            "primary",
          ),
          makeOrchestratorAction("open_top_use_case", "Inspect source opportunity", "Open the source use case first.", { useCaseId: topUseCase.id }),
          actionForView("skills", "Open AI Skills"),
        );
      } else {
        actions.push(makeOrchestratorAction("open_intake", "Create first use case", "Start structured intake.", undefined, "primary"));
      }

      return {
        content: topUseCase
          ? `${topUseCase.title} is the best current conversion candidate at ${topUseCase.priorityScore}/100. I can create or open the governed Skill package, then you can run the Harness, evals, and governance path.`
          : "There is no opportunity to convert yet. Create or import a use case first, then I can industrialize it into a governed Skill package.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "use_case_intake" || hasUseCaseDraftIntent(text)) {
      const topic = topicLabelForUseCase(text);
      const topicIsEmail = topic === "incoming email response";
      if (isThinUseCaseDraftPrompt(text)) {
        actions.push(
          ...(topicIsEmail
            ? [
                makeOrchestratorAction(
                  "draft_use_case",
                  "Draft support-email starter",
                  "Use a realistic support email starter intake you can edit.",
                  { message: supportEmailUseCaseExample },
                  "primary",
                ),
              ]
            : []),
          makeOrchestratorAction("open_intake", "Open blank intake", "Open the Use Cases intake form while you answer.", undefined, "primary"),
          actionForView("work", "Open Work Signals"),
        );

        return {
          content: [
            `I can turn ${topic} into a use case, but I need a little more signal so the intake is useful instead of generic.`,
            "Intake form:",
            "1. Business process or team",
            "2. Repeated pain, delay, or request pattern",
            "3. Owner or decision maker",
            "4. Approximate monthly volume or time spent",
            "5. Systems or data involved, plus anything AI must not do",
            topicIsEmail ? "You can also use the support-email starter action and edit it." : "Reply in bullets and I’ll turn it into the intake draft.",
          ].join("\n"),
          actions,
          autoActions,
          evidence,
        };
      }

      const action = makeOrchestratorAction(
        "draft_use_case",
        "Draft use case",
        "Prefill the intake form from this instruction.",
        { message: text },
        "primary",
      );
      actions.push(action, makeOrchestratorAction("open_intake", "Open blank intake", "Start from an empty intake form."));
      return {
        content: `I can draft ${topic} into the Use Cases intake. I inferred ${inferDepartmentFromPrompt(text)} as the likely function and will keep volume, cycle time, and data sources reviewable until a real owner confirms them.`,
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "work_signal_capture" || hasWorkSignalCaptureIntent(text)) {
      if (isThinWorkSignalPrompt(text)) {
        actions.push(
          actionForView("work", "Open Work Signals"),
          actionForView("governance", "Review signal governance"),
        );

        return {
          content: [
            "I can capture the work signal, but I need enough detail to keep it useful and privacy-safe.",
            "Work signal form:",
            "1. Business process or team",
            "2. Repeated work pattern, delay, question, handoff, rework, or context gap",
            "3. Approximate volume or frequency",
            "4. Source system or observation method",
            "5. Privacy boundary: confirm this is aggregate/redacted and not individual employee scoring",
            "Reply in bullets and I’ll capture the signal.",
          ].join("\n"),
          actions,
          autoActions,
          evidence,
        };
      }

      actions.push(
        makeOrchestratorAction("capture_work_signal", "Capture work signal", "Add this as a redacted aggregate Work Intelligence signal.", { message: text }, "primary"),
        actionForView("work", "Open Work Signals"),
        actionForView("factory", "Open Use Cases"),
      );

      return {
        content:
          "I can capture that as a governed Work Intelligence signal. It will be stored as aggregate, redacted evidence with raw content and individual scoring disabled.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "workflow") {
      actions.push(
        actionForView("workflow", "Open Workflow Studio"),
        makeOrchestratorAction("validate_workflow", "Validate workflow", "Run structural and policy validation.", undefined, "primary"),
        makeOrchestratorAction("test_workflow", "Test workflow", "Queue a workflow job if validation passes."),
        makeOrchestratorAction("load_knowledge_workflow", "Load knowledge template", "Replace canvas with a retrieval plus model workflow."),
        makeOrchestratorAction("load_approval_workflow", "Load approval template", "Replace canvas with a human-gated workflow."),
      );
      if (workflowValidation.valid && nodes.length) {
        actions.push(makeOrchestratorAction("publish_workflow", "Publish workflow", "Publish the validated workflow.", undefined, "primary"));
      }
      if (/\bvalidate\b/.test(lower)) autoActions.push(makeOrchestratorAction("validate_workflow", "Validate workflow"));
      if (/\btest\b/.test(lower)) autoActions.push(makeOrchestratorAction("test_workflow", "Test workflow"));

      return {
        content: [
          workflowValidation.valid && nodes.length ? "The current execution blueprint is structurally valid." : "The current execution blueprint is not ready to publish yet.",
          `It has ${nodes.length} blocks, ${edges.length} connections, ${workflowValidation.issues.length} blocking issues, and ${workflowValidation.warnings.length} warnings.`,
          "Workflow Studio is where approved process design becomes a governed Harness-ready runtime graph; the advanced canvas is for builders who need to edit execution steps.",
          workflowValidation.issues[0] ? `Top issue: ${workflowValidation.issues[0].message}` : "No blocking validation issue is currently detected.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "skill_operation") {
      actions.push(
        actionForView("skills", "Open AI Skills"),
        ...(!selectedSkill && topUseCase
          ? [
              makeOrchestratorAction(
                "convert_top_use_case_to_skill",
                "Convert top opportunity to Skill",
                "Create the first governed Skill package from the priority backlog.",
                { useCaseId: topUseCase.id },
                "primary",
              ),
            ]
          : []),
        makeOrchestratorAction("run_selected_skill", selectedSkill ? `Run ${selectedSkill.name}` : "Run selected Skill", "Run the selected Skill through the Harness.", undefined, "primary"),
        makeOrchestratorAction("run_selected_eval", "Run eval suite", "Run launch-readiness evals for the selected Skill."),
        makeOrchestratorAction("submit_selected_governance", "Submit governance review", "Send selected Skill to governance."),
      );

      return {
        content: selectedSkill
          ? `${selectedSkill.name} is selected. It is ${statusLabels[selectedSkill.status]}, risk ${selectedSkill.riskLevel}, autonomy ${autonomyLabels[selectedSkill.autonomyTier]}, with ${selectedSkill.allowedTools.length} tools, ${selectedSkill.contextSources.length} context sources, and ${selectedSkill.evalPassRate}% eval score.`
          : "No Skill is selected or configured yet. Create one from an approved use case, then I can run Harness tests, evals, governance routing, and prompt changes around it.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "harness") {
      actions.push(
        actionForView("harness", "Open AI Harness"),
        selectedRun
          ? makeOrchestratorAction("open_selected_run_trace", "Open selected run trace", "Inspect the selected Harness run.", { runId: selectedRun.id }, "primary")
          : actionForView("harness", "Open run list"),
        makeOrchestratorAction("run_selected_skill", selectedSkill ? `Run ${selectedSkill.name}` : "Run selected Skill", "Create a governed Harness run.", undefined, "primary"),
        ...(pendingToolRequest
          ? [
              makeOrchestratorAction(
                "open_selected_run_trace",
                "Open approval trace",
                `Inspect ${pendingToolRequest.runId} before deciding ${pendingToolRequest.toolId}.`,
                { runId: pendingToolRequest.runId },
                "primary",
              ),
              makeOrchestratorAction(
                "approve_pending_tool_request",
                "Approve and open trace",
                `Approve ${pendingToolRequest.toolId} for ${pendingToolRequest.runId}.`,
                { requestId: pendingToolRequest.id },
              ),
              makeOrchestratorAction(
                "reject_pending_tool_request",
                "Reject and open trace",
                `Reject ${pendingToolRequest.toolId} for ${pendingToolRequest.runId}.`,
                { requestId: pendingToolRequest.id },
                "danger",
              ),
            ]
          : []),
        actionForView("broker", "Open Tool Permissions"),
        actionForView("evidence", "Open Proof Ledger"),
      );
      return {
        content: `The Harness currently has ${runs.length} runs and ${toolRequests.filter((request) => request.status === "pending").length} pending tool approvals. A production run should prove identity, role, Skill selection, context policy, prompt contract, model route, tool policy, human approvals, output validation, cost, latency, and audit evidence. ${selectedRun ? `Latest selected run is ${selectedRun.id} at ${statusLabels[selectedRun.status] ?? selectedRun.status}.` : "No run is selected yet."} ${pendingToolRequest ? `${pendingToolRequest.toolId} is waiting for a visible human decision.` : ""}`,
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "governance") {
      actions.push(
        actionForView("governance", "Open Risk Review"),
        actionForView("evidence", "Open Proof Ledger"),
        actionForView("evals", "Open Evaluations"),
        ...(activeGovernanceReview
          ? [
              makeOrchestratorAction(
                "approve_governance_review",
                "Approve active review",
                `Approve ${activeGovernanceReview.title} if evidence is sufficient.`,
                { reviewId: activeGovernanceReview.id },
                "primary",
              ),
              makeOrchestratorAction(
                "request_governance_changes",
                "Request changes",
                `Return ${activeGovernanceReview.title} for additional controls or evidence.`,
                { reviewId: activeGovernanceReview.id },
                "danger",
              ),
            ]
          : [makeOrchestratorAction("submit_selected_governance", "Submit selected Skill", "Create a governance review for the selected Skill.", undefined, "primary")]),
      );
      return {
        content: reviewBlockers.length
          ? `There are ${reviewBlockers.length} governance reviews or blockers needing attention. Top item: ${reviewBlockers[0].title} (${statusLabels[reviewBlockers[0].status] ?? reviewBlockers[0].status}).`
          : "No active governance blockers are recorded. The next production step is to connect real reviewers, policies, and evidence packets to each Skill before pilot expansion.",
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "evidence_review") {
      actions.push(actionForView("evidence", "Open Proof Ledger"), actionForView("harness", "Open AI Harness Trace"), actionForView("evals", "Open Evals"), actionForView("governance", "Open Risk Review"));
      return {
        content: [
          `The live evidence ledger has ${auditLogs.length} audit logs, ${runs.length} traceable runs, ${evalResults.length} eval evidence records, and ${governanceReviews.length} governance review records.`,
          evidenceQuality.summary,
          `Next proof move: ${evidenceQuality.nextAction}`,
          "Evidence is generated from real workspace actions, not prefilled demo rows.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "value_metrics") {
      actions.push(
        actionForView("roi", "Open Value & ROI"),
        actionForView("reports", "Open executive reports"),
        actionForView("evidence", "Inspect proof records"),
        actionForView("training", "Open adoption plan"),
        makeOrchestratorAction("generate_exec_brief", "Generate value brief", "Package value, adoption, risk, and evidence for leadership.", undefined, "primary"),
      );
      return {
        content: [
          `Value picture: ${formatCurrency(metrics.annualValue)} annualized value, ${metrics.hoursSaved.toLocaleString()} estimated hours saved, and ${metrics.adoptionRate}% adoption across governed Skills.`,
          `Operating base: ${metrics.totalUseCases} use cases, ${metrics.skills} Skills, ${metrics.activePilots} active pilots, and ${runs.length} Harness runs.`,
          `Proof base: ${evidenceCount} evidence records across audit logs, runs, evals, and governance reviews. For a major-company buyer, the next upgrade is to tie each value claim to a trace, control, adoption cohort, and executive report line.`,
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "settings") {
      actions.push(makeOrchestratorAction("open_ai_settings", "Open company setup", "Configure model routing, provider keys, app connectors, and tenant secrets.", undefined, "primary"), actionForView("admin", "Open Settings"));
      return {
        content: `The local runtime is always available. ${configuredProviders.length ? `${configuredProviders.length} external providers are configured on the server.` : "No external provider keys are configured on the server yet."} Production readiness is ${productionReadiness?.status ?? "not checked"}; Admin shows any auth, database, or connector blockers.`,
        actions,
        autoActions,
        evidence,
      };
    }

    if (interpretation.intent === "status_overview") {
      actions.push(
        topUseCase
          ? makeOrchestratorAction("open_top_use_case", "Open top opportunity", "Review the highest-priority use case.", { useCaseId: topUseCase.id }, "primary")
          : makeOrchestratorAction("open_intake", "Create first use case", "Start the intake flow.", undefined, "primary"),
        topUseCase && !topUseCase.linkedSkillId
          ? makeOrchestratorAction("convert_top_use_case_to_skill", "Convert top opportunity", "Create a governed Skill package from the top use case.", { useCaseId: topUseCase.id })
          : metrics.skills
            ? actionForView("skills", "Review Skills")
            : actionForView("factory", "Convert opportunities to Skills"),
        ...(pendingToolRequest
          ? [
              makeOrchestratorAction(
                "open_selected_run_trace",
                "Open approval trace",
                `Inspect ${pendingToolRequest.runId} before deciding ${pendingToolRequest.toolId}.`,
                { runId: pendingToolRequest.runId },
                "primary",
              ),
            ]
          : []),
        ...(activeGovernanceReview
          ? [
              makeOrchestratorAction(
                "approve_governance_review",
                "Move active review",
                `Approve ${activeGovernanceReview.title} if evidence is ready.`,
                { reviewId: activeGovernanceReview.id },
              ),
            ]
          : []),
        actionForView("evidence", "Inspect evidence"),
        makeOrchestratorAction("generate_exec_brief", "Generate exec brief", "Create a report from the current portfolio."),
      );

      return {
        content: [
          `Portfolio: ${metrics.totalUseCases} use cases, ${metrics.skills} Skills, ${metrics.activePilots} active pilots, ${runs.length} runs, ${metrics.riskItemsOpen} high-risk use cases.`,
          `Work Intelligence: ${workSignals.length} governed signals connected.`,
          `Proof: ${evidenceQuality.summary}`,
          `Connectors: ${connectorPosture.summary}`,
          topUseCase ? `Top priority: ${topUseCase.title} at ${topUseCase.priorityScore}/100.` : "No priority backlog exists yet.",
          reviewBlockers.length ? `Governance attention: ${reviewBlockers.length} review items or blockers.` : "No governance blocker is currently recorded.",
          nodes.length ? `Workflow canvas: ${nodes.length} blocks, ${edges.length} connections, ${workflowValidation.valid ? "valid" : "needs work"}.` : "Workflow canvas is empty.",
        ].join("\n"),
        actions,
        autoActions,
        evidence,
      };
    }

    actions.push(
      actionForView(requestedView ?? "command", requestedView ? "Open related view" : "Open Home"),
      makeOrchestratorAction("open_intake", "Create use case", "Start structured intake."),
      makeOrchestratorAction("validate_workflow", "Validate workflow", "Check the current graph."),
      makeOrchestratorAction("generate_exec_brief", "Generate exec brief", "Create an executive report."),
    );

    const fallbackViewLabel = requestedView ? navItems.find((item) => item.id === requestedView)?.label ?? requestedView : null;
    const fallbackTopic = topicLabelForUseCase(text);
    const fallbackTopicDetected = fallbackTopic && fallbackTopic !== "this workflow";
    const parsedLine = fallbackViewLabel
      ? `I parsed this as a request near “${fallbackViewLabel}”, but I’m not confident enough to act without a clearer instruction.`
      : fallbackTopicDetected
        ? `I parsed a possible topic — ${fallbackTopic} — but I’m not confident enough to act without a clearer instruction.`
        : "I couldn’t map this to a specific OS surface or workflow with confidence.";
    const suggestionLines = [
      fallbackViewLabel
        ? `1. Say “open ${fallbackViewLabel}” and I’ll route you there directly.`
        : "1. Say “open” plus a surface name (Use Cases, Workflow, Harness, Proof Ledger) and I’ll route you there.",
      fallbackTopicDetected
        ? `2. Say “draft a use case for ${fallbackTopic}” and I’ll prefill the intake.`
        : "2. Describe a workflow in one sentence and I’ll turn it into a use case draft.",
      "3. Ask “what should I do next?” for a ranked next-best-action, or “generate an exec brief” for a leadership report.",
    ];

    return {
      content: [
        parsedLine,
        "Here are concrete ways to point me:",
        ...suggestionLines,
      ].join("\n"),
      actions,
      autoActions,
      evidence,
    };
}
