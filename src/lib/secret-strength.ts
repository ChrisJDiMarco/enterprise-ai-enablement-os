/**
 * Shared detection of secrets that must never be accepted in production:
 * absent, a known placeholder/example value (the public .env.example ships
 * "change-me-…"), or too short to carry real entropy.
 *
 * Used by readiness checks (so preflight fails) and by the startup hook
 * (so the server refuses to boot) — one rule, no drift.
 */

export type SecretWeakness = "missing" | "placeholder" | "too_short";

export const MIN_SECRET_BYTES = 32;

// Substrings that mark a value as a non-secret placeholder. Lowercased compare.
const PLACEHOLDER_FRAGMENTS = [
  "change-me",
  "changeme",
  "change_me",
  "placeholder",
  "example",
  "your-secret",
  "your_secret",
  "replace-me",
  "replace_me",
  "secret-here",
  "local-dev",
  "dev-secret",
  "test-secret",
  "notsecure",
  "insecure",
];

/**
 * Returns the reason a secret is unsuitable for production, or null if it is
 * strong enough (present, not a placeholder, >= MIN_SECRET_BYTES of data).
 */
export function secretWeakness(value: string | undefined | null): SecretWeakness | null {
  if (value === undefined || value === null) return "missing";
  const trimmed = value.trim();
  if (!trimmed) return "missing";
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))) return "placeholder";
  if (Buffer.byteLength(trimmed, "utf8") < MIN_SECRET_BYTES) return "too_short";
  return null;
}

/** Human-readable, actionable message for a detected weakness. */
export function describeSecretWeakness(name: string, weakness: SecretWeakness): string {
  switch (weakness) {
    case "missing":
      return `${name} is required in production.`;
    case "placeholder":
      return `${name} is set to a placeholder/example value. Generate a unique random secret (e.g. \`openssl rand -base64 32\`).`;
    case "too_short":
      return `${name} must be at least ${MIN_SECRET_BYTES} bytes of high-entropy random data.`;
  }
}
