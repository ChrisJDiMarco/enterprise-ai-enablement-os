import type { EvalResult, Run, Skill, WorkSignal } from "@/lib/enterprise-ai-data";

export type ContinuousEvalStatus = "healthy" | "watch" | "drift" | "overdue";

export type ContinuousEvalMonitor = {
  skillId: string;
  skillName: string;
  status: ContinuousEvalStatus;
  score: number;
  driftScore: number;
  lastRun: string;
  cadence: string;
  evidence: string;
  nextAction: string;
};

export type ContinuousEvalProgram = {
  score: number;
  status: ContinuousEvalStatus;
  summary: string;
  monitors: ContinuousEvalMonitor[];
  driftAlerts: number;
  overdueSuites: number;
  healthySuites: number;
};

export type ContinuousEvalInput = {
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  workSignals: WorkSignal[];
};

const cadence = "Every Skill version before promotion, then weekly while in pilot or production";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function latestEvalForSkill(skillId: string, evalResults: EvalResult[]) {
  return evalResults
    .filter((result) => result.skillId === skillId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function statusFromSignals(params: {
  latestEval?: EvalResult;
  evalScore: number;
  driftScore: number;
  criticalFailures: number;
}): ContinuousEvalStatus {
  if (!params.latestEval) return "overdue";
  if (params.criticalFailures > 0 || params.driftScore >= 70) return "drift";
  if (params.evalScore < 90 || params.driftScore >= 35) return "watch";
  return "healthy";
}

function nextActionForStatus(status: ContinuousEvalStatus) {
  if (status === "overdue") return "Run the full launch suite before pilot or production promotion.";
  if (status === "drift") return "Freeze scale-up, run regression and red-team suites, and inspect recent traces, feedback, and context gaps.";
  if (status === "watch") return "Schedule targeted evals for the failing category and review prompt/context changes before broader rollout.";
  return "Keep weekly regression, grounding, prompt-injection, tool-safety, latency, and cost checks active.";
}

function scoreForStatus(status: ContinuousEvalStatus, evalScore: number, driftScore: number) {
  if (status === "overdue") return 35;
  return clamp(evalScore - driftScore * 0.35);
}

export function deriveContinuousEvalProgram(input: ContinuousEvalInput): ContinuousEvalProgram {
  const skills = input.skills ?? [];
  const evalResults = input.evalResults ?? [];
  const runs = input.runs ?? [];
  const workSignals = input.workSignals ?? [];

  const monitors = skills
    .map((skill) => {
      const latestEval = latestEvalForSkill(skill.id, evalResults);
      const relatedRuns = runs.filter((run) => run.skillId === skill.id);
      const relatedSignals = workSignals.filter((signal) => signal.metadata.relatedSkillId === skill.id);
      const failedRuns = relatedRuns.filter((run) => ["blocked", "failed"].includes(run.status)).length;
      const negativeFeedback = relatedSignals.filter((signal) => signal.metadata.sentiment === "negative").length;
      const contextGaps = relatedSignals.filter((signal) => signal.eventType === "context_gap").length;
      const approvalWaits = relatedSignals.filter((signal) => signal.eventType === "approval_waiting").length;
      const criticalFailures = latestEval?.criticalFailures ?? 0;
      const evalScore = latestEval?.score ?? skill.evalPassRate;
      const driftScore = clamp(
        failedRuns * 18 +
          negativeFeedback * 16 +
          contextGaps * 20 +
          approvalWaits * 8 +
          Math.max(0, 90 - evalScore) * 1.4 +
          criticalFailures * 30,
      );
      const status = statusFromSignals({ latestEval, evalScore, driftScore, criticalFailures });
      const score = scoreForStatus(status, evalScore || 0, driftScore);
      const signalParts = [
        `${relatedRuns.length} run${relatedRuns.length === 1 ? "" : "s"}`,
        `${relatedSignals.length} work signal${relatedSignals.length === 1 ? "" : "s"}`,
        `${failedRuns} failed or blocked`,
        `${contextGaps} context gap${contextGaps === 1 ? "" : "s"}`,
      ];

      return {
        skillId: skill.id,
        skillName: skill.name,
        status,
        score,
        driftScore,
        lastRun: latestEval?.createdAt ?? "Not run",
        cadence,
        evidence: signalParts.join(" · "),
        nextAction: nextActionForStatus(status),
      };
    })
    .sort((a, b) => {
      const rank: Record<ContinuousEvalStatus, number> = { drift: 0, overdue: 1, watch: 2, healthy: 3 };
      return rank[a.status] - rank[b.status] || a.score - b.score;
    });

  const driftAlerts = monitors.filter((monitor) => monitor.status === "drift").length;
  const overdueSuites = monitors.filter((monitor) => monitor.status === "overdue").length;
  const healthySuites = monitors.filter((monitor) => monitor.status === "healthy").length;
  const score = monitors.length
    ? clamp(monitors.reduce((sum, monitor) => sum + monitor.score, 0) / monitors.length)
    : 0;
  const status: ContinuousEvalStatus =
    driftAlerts > 0 ? "drift" : overdueSuites > 0 ? "overdue" : score >= 88 ? "healthy" : "watch";

  return {
    score,
    status,
    monitors,
    driftAlerts,
    overdueSuites,
    healthySuites,
    summary: monitors.length
      ? `${healthySuites}/${monitors.length} Skills are continuously healthy; ${driftAlerts} drift alert${driftAlerts === 1 ? "" : "s"} and ${overdueSuites} overdue suite${overdueSuites === 1 ? "" : "s"} need action.`
      : "No Skills exist yet. Continuous evals will activate when the first Skill package is created.",
  };
}
