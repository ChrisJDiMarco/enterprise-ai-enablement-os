import type { Run, Skill, UseCase } from "./enterprise-ai-data.ts";
import { buildRoiRows, type RoiAssumptions } from "./roi-model.ts";

/**
 * Where a Skill's value/adoption number actually comes from.
 * - live: measured value from completed live runs (model-graded execution).
 * - modeled: value projected from real completed live runs × the linked use
 *   case's transparent ROI assumptions (per-task value), not a measured dollar.
 * - self-assessed: an operator-entered baseline; nothing live backs it yet.
 * - seeded: illustrative demo data, not telemetry.
 */
export type TelemetryProvenance = "live" | "modeled" | "self-assessed" | "seeded";

export type SkillTelemetry = {
  runs: number;
  adoptionCount: number;
  valueDelivered: number;
  provenance: TelemetryProvenance;
};

/**
 * Real value telemetry for a Skill, derived from the actual Run ledger plus the
 * linked use case's ROI assumptions — instead of hand-typed numbers.
 *
 * - `runs` and `adoptionCount` are measured counts from the ledger (adopters =
 *   distinct run.triggeredBy).
 * - `valueDelivered` is MODELED: per-task value (time saved × loaded cost ×
 *   adoption capture, straight from roi-model — no parallel math) × completed
 *   LIVE runs. Simulated runs are real executions (they count toward runs and
 *   adopters) but deliver no claimed dollars.
 * - Illustrative (demo) workspaces keep their seeded numbers, honestly labeled.
 *   When nothing live backs the value, the operator's self-assessed baseline is
 *   kept rather than collapsing to a misleading $0.
 */
export function deriveSkillTelemetry(
  skill: Skill,
  allRuns: Run[],
  useCase?: UseCase,
  options?: { illustrative?: boolean; assumptions?: Partial<RoiAssumptions> },
): SkillTelemetry {
  if (options?.illustrative) {
    return {
      runs: skill.runs,
      adoptionCount: skill.adoptionCount,
      valueDelivered: skill.valueDelivered,
      provenance: "seeded",
    };
  }

  const mine = allRuns.filter((run) => run.skillId === skill.id);
  const runs = mine.length;
  const adopters = new Set(mine.map((run) => run.triggeredBy).filter(Boolean));
  const completedLive = mine.filter((run) => run.status === "completed" && run.executionMode === "live");

  const [roiRow] = useCase ? buildRoiRows([useCase], options?.assumptions) : [];
  const annualUnits = useCase ? useCase.monthlyVolume * 12 : 0;
  const perRunValue = roiRow && annualUnits > 0 ? roiRow.expected / annualUnits : 0;
  const measuredValue = Math.round(perRunValue * completedLive.length);

  if (runs === 0) {
    return {
      runs: 0,
      adoptionCount: skill.adoptionCount,
      valueDelivered: skill.valueDelivered,
      provenance: "self-assessed",
    };
  }

  const hasLiveValue = completedLive.length > 0 && measuredValue > 0;
  return {
    runs,
    adoptionCount: adopters.size,
    valueDelivered: hasLiveValue ? measuredValue : skill.valueDelivered,
    provenance: hasLiveValue ? "modeled" : "self-assessed",
  };
}

/** Returns a copy of the Skill with the derived telemetry numbers applied. */
export function applyTelemetry(skill: Skill, telemetry: SkillTelemetry): Skill {
  return {
    ...skill,
    runs: telemetry.runs,
    adoptionCount: telemetry.adoptionCount,
    valueDelivered: telemetry.valueDelivered,
  };
}
