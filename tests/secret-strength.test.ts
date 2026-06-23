import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSecretWeakness, secretWeakness } from "../src/lib/secret-strength.ts";

const STRONG = "Zx9Z7tq2Vn4pWm8sLk6Rj3Hd1Gf5Yb0Qa2Ue7Ic"; // 40 chars, no placeholder fragment

test("secretWeakness flags absent values as missing", () => {
  assert.equal(secretWeakness(undefined), "missing");
  assert.equal(secretWeakness(null), "missing");
  assert.equal(secretWeakness(""), "missing");
  assert.equal(secretWeakness("   "), "missing");
});

test("secretWeakness flags the public .env.example placeholder", () => {
  assert.equal(secretWeakness("change-me-with-a-32-byte-random-secret"), "placeholder");
  assert.equal(secretWeakness("your-secret-value-goes-here-please-set"), "placeholder");
  assert.equal(secretWeakness("local-dev-auth-secret-change-me"), "placeholder");
});

test("secretWeakness flags strong-looking but too-short values", () => {
  assert.equal(secretWeakness("Zx9Z7tq2Vn4pWm8s"), "too_short"); // 16 bytes < 32
});

test("secretWeakness accepts a real high-entropy secret", () => {
  assert.equal(secretWeakness(STRONG), null);
});

test("describeSecretWeakness gives actionable, named guidance", () => {
  assert.match(describeSecretWeakness("AUTH_SECRET", "missing"), /AUTH_SECRET is required/);
  assert.match(describeSecretWeakness("AUTH_SECRET", "placeholder"), /placeholder|openssl/);
  assert.match(describeSecretWeakness("TENANT_SECRET_KEY", "too_short"), /at least 32 bytes/);
});
