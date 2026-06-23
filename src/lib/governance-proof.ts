import type { EvalResult, GovernanceReview, Run, Skill } from "./enterprise-ai-data.ts";

/**
 * The actual evidence a reviewer should see at the approval moment: the linked
 * Skill's runs, eval scores, tool surface, and grounding sources — not just a
 * risk label. Derived from the real ledgers so governance decisions are made on
 * proof, not vibes.
 */
export type GovernanceProof = {
  skillFound: boolean;
  skillName?: string;
  skillStatus?: string;
  riskLevel: string;
  autonomyTier?: string;
  totalRuns: number;
  completedRuns: number;
  blockedRuns: number;
  latestRunAt?: string;
  latestRunStatus?: string;
  evalCount: number;
  simulatedEvalCount: number;
  latestEvalScore?: number;
  latestEvalPassed?: boolean;
  evalPassRate?: number;
  toolCount: number;
  contextCount: number;
};

export function deriveGovernanceProof(params: {
  review: GovernanceReview;
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
}): GovernanceProof {
  const { review, skills, runs, evalResults } = params;
  const skill = review.itemType === "skill" ? skills.find((item) => item.id === review.itemId) : undefined;
  const skillRuns = skill ? runs.filter((run) => run.skillId === skill.id) : [];
  const skillEvals = skill ? evalResults.filter((result) => result.skillId === skill.id) : [];
  const latestRun = [...skillRuns].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  const latestEval = [...skillEvals].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  return {
    skillFound: Boolean(skill),
    skillName: skill?.name,
    skillStatus: skill?.status,
    riskLevel: review.riskLevel,
    autonomyTier: skill?.autonomyTier,
    totalRuns: skillRuns.length,
    completedRuns: skillRuns.filter((run) => run.status === "completed").length,
    blockedRuns: skillRuns.filter((run) => run.status === "blocked").length,
    latestRunAt: latestRun?.startedAt,
    latestRunStatus: latestRun?.status,
    evalCount: skillEvals.length,
    simulatedEvalCount: skillEvals.filter((result) => result.executionMode === "simulated").length,
    latestEvalScore: latestEval?.score,
    latestEvalPassed: latestEval?.passed,
    evalPassRate: skill?.evalPassRate,
    toolCount: skill?.allowedTools.length ?? 0,
    contextCount: skill?.contextSources.length ?? 0,
  };
}
