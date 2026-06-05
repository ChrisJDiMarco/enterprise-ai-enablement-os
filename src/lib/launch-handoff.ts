import type { EvalResult, GovernanceReview, Run, Skill, UseCase } from "@/lib/enterprise-ai-data";
import type { View } from "@/lib/ui/types";

export type LaunchHandoffStatus = "done" | "ready" | "blocked";

export type LaunchHandoffStep = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  targetView: View;
  targetId?: string;
  status: LaunchHandoffStatus;
  evidence: string;
  minutes: number;
};

export type LaunchHandoff = {
  generated: boolean;
  score: number;
  title: string;
  summary: string;
  nextStep: LaunchHandoffStep;
  steps: LaunchHandoffStep[];
};

export type LaunchHandoffInput = {
  organizationName: string;
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  report: string;
  workflow: {
    nodeCount: number;
    status: "Saved" | "Testing" | "Published";
    valid: boolean;
    issues: number;
  };
};

function isGeneratedWorkspace(input: LaunchHandoffInput) {
  return input.organizationName.trim().length > 0 && (input.useCases.length > 0 || input.skills.length > 0 || input.report.length > 0);
}

function step(params: LaunchHandoffStep): LaunchHandoffStep {
  return params;
}

export function deriveLaunchHandoff(input: LaunchHandoffInput): LaunchHandoff {
  const generated = isGeneratedWorkspace(input);
  const topUseCase = [...input.useCases].sort((a, b) => b.priorityScore - a.priorityScore)[0] ?? null;
  const linkedSkill = topUseCase?.linkedSkillId
    ? input.skills.find((skill) => skill.id === topUseCase.linkedSkillId)
    : null;
  const activeSkill = linkedSkill ?? input.skills[0] ?? null;
  const activeSkillReviews = activeSkill
    ? input.governanceReviews.filter((review) => review.itemId === activeSkill.id)
    : [];
  const activeSkillEvals = activeSkill
    ? input.evalResults.filter((result) => result.skillId === activeSkill.id)
    : [];
  const activeSkillRuns = activeSkill ? input.runs.filter((run) => run.skillId === activeSkill.id) : [];
  const launchGradeEval = activeSkillEvals.some((result) => result.passed && result.score >= 90 && result.criticalFailures === 0);
  const skillPackageReady = Boolean(
    activeSkill &&
      ["approved", "pilot", "production"].includes(activeSkill.status) &&
      activeSkill.systemPrompt.length > 40 &&
      activeSkill.contextSources.length > 0 &&
      activeSkill.allowedTools.length > 0,
  );
  const blockingReview = activeSkillReviews.find((review) =>
    ["in_review", "changes_requested"].includes(review.status) || review.blockers.length > 0,
  );
  const approvedReview = activeSkillReviews.some((review) => ["approved", "approved_with_conditions"].includes(review.status));
  const traceableRun = activeSkillRuns.find((run) => run.trace.length >= 6 && ["completed", "waiting_for_approval"].includes(run.status));

  const steps: LaunchHandoffStep[] = [
    step({
      id: "inspect-portfolio",
      title: "Inspect the generated portfolio",
      body: topUseCase
        ? `Start with ${topUseCase.title}, currently priority ${topUseCase.priorityScore}/100. Confirm the business pain, data sources, risk, and owner before expanding scope.`
        : "Review the generated opportunity funnel and confirm the first corporate function to launch.",
      actionLabel: topUseCase ? "Open opportunity" : "Open factory",
      targetView: "factory",
      targetId: topUseCase?.id,
      status: topUseCase ? "done" : "blocked",
      evidence: topUseCase ? `${input.useCases.length} scored opportunities` : "No scored opportunities yet",
      minutes: 5,
    }),
    step({
      id: "review-skill-package",
      title: "Review the first governed Skill package",
      body: activeSkill
        ? `Open ${activeSkill.name}, verify its prompt contract, model routing, context bindings, tools, approval rules, eval score, and launch readiness.`
        : "Convert the top opportunity into a Skill before running evals, workflow tests, or the Harness.",
      actionLabel: activeSkill ? "Open Skill" : "Create Skill",
      targetView: activeSkill ? "skills" : "factory",
      targetId: activeSkill?.id ?? topUseCase?.id,
      status: !activeSkill ? "blocked" : skillPackageReady ? "done" : "ready",
      evidence: activeSkill ? `${activeSkill.version} · ${activeSkill.autonomyTier.replaceAll("_", " ")}` : "No Skill generated",
      minutes: 8,
    }),
    step({
      id: "run-launch-eval",
      title: "Run the launch readiness eval",
      body: launchGradeEval
        ? "The selected Skill has launch-grade eval evidence. Keep this result with the governance packet."
        : "Run grounding, permission, prompt-injection, tool-safety, quality, cost, and latency checks before governance approval.",
      actionLabel: launchGradeEval ? "View evals" : "Run eval",
      targetView: "evals",
      targetId: activeSkill?.id,
      status: !activeSkill ? "blocked" : launchGradeEval ? "done" : "ready",
      evidence: activeSkillEvals.length
        ? `${activeSkillEvals[0].score}/100 latest eval · ${activeSkillEvals[0].criticalFailures} critical failures`
        : "No eval result yet",
      minutes: 10,
    }),
    step({
      id: "resolve-governance",
      title: "Resolve the governance review",
      body: blockingReview
        ? `${blockingReview.title} needs movement: ${blockingReview.blockers[0] ?? "reviewer decision required"}.`
        : approvedReview
          ? "Governance has approved or conditionally approved the selected Skill. Confirm pilot conditions are tracked."
          : "Submit the Skill to security, legal, privacy, and business review with evidence attached.",
      actionLabel: blockingReview || approvedReview ? "Open review" : "Submit review",
      targetView: "governance",
      targetId: activeSkill?.id,
      status: !activeSkill ? "blocked" : approvedReview ? "done" : "ready",
      evidence: activeSkillReviews.length ? `${activeSkillReviews.length} review record(s)` : "No review submitted",
      minutes: 10,
    }),
    step({
      id: "validate-workflow",
      title: "Validate the workflow blueprint",
      body: input.workflow.nodeCount
        ? "Inspect the generated workflow, fix validation issues, and confirm approval gates sit before write actions."
        : "Load a governed workflow template so the Skill has a visible execution path.",
      actionLabel: input.workflow.nodeCount ? "Open workflow" : "Load workflow",
      targetView: "workflow",
      status: input.workflow.nodeCount && input.workflow.valid ? "done" : input.workflow.nodeCount ? "ready" : "blocked",
      evidence: input.workflow.nodeCount
        ? `${input.workflow.nodeCount} blocks · ${input.workflow.issues} blocking issue(s)`
        : "No workflow blueprint",
      minutes: 8,
    }),
    step({
      id: "run-harness-trace",
      title: "Run the Skill through the AI Harness",
      body: traceableRun
        ? "A traceable run exists. Inspect identity, context, policy, model, tool, approval, validation, and audit steps."
        : "Create a Harness run so governance and executives can inspect exactly how the Skill behaves.",
      actionLabel: traceableRun ? "Inspect trace" : "Run Harness",
      targetView: traceableRun ? "harness" : "skills",
      targetId: traceableRun?.id ?? activeSkill?.id,
      status: !activeSkill ? "blocked" : traceableRun ? "done" : "ready",
      evidence: traceableRun ? `${traceableRun.trace.length} trace steps` : "No traceable run yet",
      minutes: 8,
    }),
    step({
      id: "brief-executives",
      title: "Generate the executive launch brief",
      body: input.report
        ? "A launch report exists. Use it to align executives on value, risk, decisions needed, and the next pilot milestone."
        : "Create an executive brief that packages portfolio state, blockers, ROI assumptions, and decisions needed.",
      actionLabel: input.report ? "Open report" : "Draft brief",
      targetView: "reports",
      status: !generated ? "blocked" : input.report ? "done" : "ready",
      evidence: input.report ? "Launch report drafted" : "No report drafted",
      minutes: 5,
    }),
  ];

  const score = Math.round((steps.filter((item) => item.status === "done").length / steps.length) * 100);
  const nextStep = generated
    ? steps.find((item) => item.status === "ready") ?? steps.find((item) => item.status === "blocked") ?? steps[0]
    : steps[0];

  return {
    generated,
    score,
    title: generated ? `${input.organizationName} launch handoff` : "Workspace launch handoff",
    summary: generated
      ? `The workspace is generated. Follow this handoff to move from setup into a governed pilot without wondering where to click next.`
      : "Generate a workspace or add the first opportunity to create a launch handoff.",
    nextStep,
    steps,
  };
}
