export type ExperienceMode = "guided" | "unguided";

export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "guided";

export function normalizeExperienceMode(value: unknown): ExperienceMode {
  return value === "unguided" ? "unguided" : DEFAULT_EXPERIENCE_MODE;
}
