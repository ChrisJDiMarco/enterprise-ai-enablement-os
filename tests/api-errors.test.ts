import assert from "node:assert/strict";
import test from "node:test";

import {
  caughtErrorDetail,
  containsUnsafeDiagnostic,
  externalServiceError,
  publicExternalServiceStatus,
  publicExternalServiceUnavailable,
} from "../src/lib/api-errors.ts";

test("caughtErrorDetail never returns raw exception text", () => {
  const detail = caughtErrorDetail(
    new Error("TENANT_SECRET_KEY missing at /Users/example/app/.env"),
    "Tenant secret vault could not complete the operation.",
  );

  assert.equal(detail, "Tenant secret vault could not complete the operation.");
  assert.equal(containsUnsafeDiagnostic(detail), false);
});

test("publicExternalServiceStatus omits arbitrary response bodies", () => {
  const status = publicExternalServiceStatus({
    serviceLabel: "External connector broker",
    response: { ok: false, status: 502 },
    responseBody: {
      error: "postgres://user:password@db.internal failed",
      token: "secret-token",
    },
  });

  assert.equal(status.ok, false);
  assert.equal(status.status, 502);
  assert.equal(status.responseReceived, true);
  assert.equal(status.error, externalServiceError("External connector broker"));
  assert.equal(JSON.stringify(status).includes("postgres://"), false);
  assert.equal(JSON.stringify(status).includes("secret-token"), false);
});

test("publicExternalServiceUnavailable returns a generic failure shape", () => {
  const status = publicExternalServiceUnavailable("Privacy request workflow");

  assert.deepEqual(status, {
    ok: false,
    status: "unavailable",
    responseReceived: false,
    error: "Privacy request workflow is unavailable or returned an error. No external action was completed.",
  });
});
