import type { Skill, UseCase } from "./enterprise-ai-data.ts";

/**
 * Single source of truth for portfolio adoption math.
 *
 * Adoption rate is computed one honest way everywhere: measured active adopters
 * divided by the operator-estimated audience of capabilities that have actually
 * reached pilot or beyond (you cannot adopt a capability that has not launched).
 *
 * No magic per-skill denominators and no arbitrary cap — both of which previously
 * differed across the app and produced inconsistent, inflated numbers.
 */

// Use-case statuses where a capability is live enough for people to adopt it.
const REACHED_PILOT_STATUSES: readonly string[] = ["approved_for_pilot", "in_pilot", "measuring", "scaled"];

/** Measured adopters across the Skill portfolio. */
export function adoptionActiveUsers(skills: ReadonlyArray<Pick<Skill, "adoptionCount">>): number {
  return skills.reduce((sum, skill) => sum + Math.max(0, skill.adoptionCount || 0), 0);
}

/** Operator-estimated audience of the use cases that have actually launched. */
export function adoptionReachableUsers(
  useCases: ReadonlyArray<Pick<UseCase, "status" | "estimatedUsers">>,
): number {
  return useCases
    .filter((useCase) => REACHED_PILOT_STATUSES.includes(useCase.status))
    .reduce((sum, useCase) => sum + Math.max(0, useCase.estimatedUsers || 0), 0);
}

/**
 * Adoption rate as a 0–100 percentage: active adopters / estimated launched
 * audience. Returns 0 when nothing has launched (no denominator to divide by).
 */
export function deriveAdoptionRate(
  skills: ReadonlyArray<Pick<Skill, "adoptionCount">>,
  useCases: ReadonlyArray<Pick<UseCase, "status" | "estimatedUsers">>,
): number {
  const reachable = adoptionReachableUsers(useCases);
  if (reachable <= 0) return 0;
  const active = adoptionActiveUsers(skills);
  return Math.min(100, Math.max(0, Math.round((active / reachable) * 100)));
}
