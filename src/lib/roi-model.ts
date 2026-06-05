import type { UseCase } from "@/lib/enterprise-ai-data";

export const ROI_MODEL_ASSUMPTIONS = {
  loadedHourlyCostUsd: 68,
  adoptionCaptureRate: 0.62,
  conservativeMultiplier: 0.55,
  optimisticMultiplier: 1.45,
} as const;

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
};

export function useCaseConfidence(useCase: Pick<UseCase, "dataReadinessScore">): RoiRow["confidence"] {
  if (useCase.dataReadinessScore >= 4) return "high";
  if (useCase.dataReadinessScore >= 3) return "medium";
  return "low";
}

export function buildRoiRows(useCases: UseCase[]): RoiRow[] {
  return useCases
    .filter((item) => item.monthlyVolume > 0 && item.avgHandlingTimeMinutes > 0)
    .map((item) => {
      const hours = (item.monthlyVolume * item.avgHandlingTimeMinutes) / 60;
      const expected =
        hours *
        ROI_MODEL_ASSUMPTIONS.loadedHourlyCostUsd *
        12 *
        ROI_MODEL_ASSUMPTIONS.adoptionCaptureRate;

      return {
        name: item.title,
        conservative: expected * ROI_MODEL_ASSUMPTIONS.conservativeMultiplier,
        expected,
        optimistic: expected * ROI_MODEL_ASSUMPTIONS.optimisticMultiplier,
        hours,
        adoption: Math.round(ROI_MODEL_ASSUMPTIONS.adoptionCaptureRate * 100),
        confidence: useCaseConfidence(item),
      };
    });
}

export function buildRoiPortfolio(useCases: UseCase[]): RoiPortfolio {
  const rows = buildRoiRows(useCases);

  return {
    rows,
    conservative: rows.reduce((sum, row) => sum + row.conservative, 0),
    expected: rows.reduce((sum, row) => sum + row.expected, 0),
    optimistic: rows.reduce((sum, row) => sum + row.optimistic, 0),
  };
}
