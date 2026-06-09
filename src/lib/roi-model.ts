import type { UseCase } from "@/lib/enterprise-ai-data";

export type RoiAssumptions = {
  /** Fully loaded hourly cost of the people doing the work today (USD). */
  loadedHourlyCostUsd: number;
  /** Share of theoretical time savings the org actually captures (0..1). */
  adoptionCaptureRate: number;
  /** Multiplier applied to expected value for the conservative scenario. */
  conservativeMultiplier: number;
  /** Multiplier applied to expected value for the optimistic scenario. */
  optimisticMultiplier: number;
};

/**
 * Platform DEFAULTS, not facts about any tenant. Every number derived from
 * these is an estimate and must be labeled as such in the UI, with the
 * assumption set visible so a finance owner can challenge and override it.
 */
export const ROI_MODEL_ASSUMPTIONS: RoiAssumptions = {
  loadedHourlyCostUsd: 68,
  adoptionCaptureRate: 0.62,
  conservativeMultiplier: 0.55,
  optimisticMultiplier: 1.45,
};

export const ROI_ASSUMPTION_NOTES: Record<keyof RoiAssumptions, string> = {
  loadedHourlyCostUsd: "Default fully-loaded hourly labor cost. Replace with your finance team's blended rate.",
  adoptionCaptureRate: "Default share of theoretical savings actually captured after adoption friction. Replace with measured adoption.",
  conservativeMultiplier: "Downside scenario haircut applied to expected value.",
  optimisticMultiplier: "Upside scenario multiplier applied to expected value.",
};

function clampAssumptions(overrides?: Partial<RoiAssumptions>): RoiAssumptions {
  const merged = { ...ROI_MODEL_ASSUMPTIONS, ...overrides };
  return {
    loadedHourlyCostUsd: Math.min(1000, Math.max(1, merged.loadedHourlyCostUsd)),
    adoptionCaptureRate: Math.min(1, Math.max(0.01, merged.adoptionCaptureRate)),
    conservativeMultiplier: Math.min(1, Math.max(0.05, merged.conservativeMultiplier)),
    optimisticMultiplier: Math.min(5, Math.max(1, merged.optimisticMultiplier)),
  };
}

export type RoiRow = {
  name: string;
  conservative: number;
  expected: number;
  optimistic: number;
  hours: number;
  adoption: number;
  confidence: "high" | "medium" | "low";
};

export type RoiPortfolio = {
  rows: RoiRow[];
  conservative: number;
  expected: number;
  optimistic: number;
  /** The assumption set the numbers were computed with, for provenance display. */
  assumptions: RoiAssumptions;
  /** True when the platform defaults were used rather than tenant-specific values. */
  usingDefaults: boolean;
};

export function useCaseConfidence(useCase: Pick<UseCase, "dataReadinessScore">): RoiRow["confidence"] {
  if (useCase.dataReadinessScore >= 4) return "high";
  if (useCase.dataReadinessScore >= 3) return "medium";
  return "low";
}

export function buildRoiRows(useCases: UseCase[], overrides?: Partial<RoiAssumptions>): RoiRow[] {
  const assumptions = clampAssumptions(overrides);
  return useCases
    .filter((item) => item.monthlyVolume > 0 && item.avgHandlingTimeMinutes > 0)
    .map((item) => {
      const hours = (item.monthlyVolume * item.avgHandlingTimeMinutes) / 60;
      const expected = hours * assumptions.loadedHourlyCostUsd * 12 * assumptions.adoptionCaptureRate;

      return {
        name: item.title,
        conservative: expected * assumptions.conservativeMultiplier,
        expected,
        optimistic: expected * assumptions.optimisticMultiplier,
        hours,
        adoption: Math.round(assumptions.adoptionCaptureRate * 100),
        confidence: useCaseConfidence(item),
      };
    });
}

export function buildRoiPortfolio(useCases: UseCase[], overrides?: Partial<RoiAssumptions>): RoiPortfolio {
  const rows = buildRoiRows(useCases, overrides);

  return {
    rows,
    conservative: rows.reduce((sum, row) => sum + row.conservative, 0),
    expected: rows.reduce((sum, row) => sum + row.expected, 0),
    optimistic: rows.reduce((sum, row) => sum + row.optimistic, 0),
    assumptions: clampAssumptions(overrides),
    usingDefaults: !overrides || Object.keys(overrides).length === 0,
  };
}
