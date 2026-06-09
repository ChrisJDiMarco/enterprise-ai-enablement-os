import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeResponseHeaders, privateResponseHeaders, safeAttachmentFilenameStem } from "../src/lib/api-response.ts";

test("privateResponseHeaders applies no-store and noindex defaults", () => {
  const headers = privateResponseHeaders({ "Content-Type": "application/json; charset=utf-8" });

  assert.equal(headers.get("cache-control"), "no-store");
  assert.match(headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
});

test("safeAttachmentFilenameStem normalizes tenant-provided names for downloads", () => {
  assert.equal(safeAttachmentFilenameStem(" Acme, Inc. / AI Enablement ", "fallback"), "acme-inc-ai-enablement");
  assert.equal(safeAttachmentFilenameStem("../../../", "fallback"), "fallback");
  assert.equal(safeAttachmentFilenameStem("A".repeat(90), "fallback"), "a".repeat(80));
});

test("mergeResponseHeaders applies later route-specific overrides", () => {
  const headers = mergeResponseHeaders(
    { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    { "Content-Type": "text/markdown; charset=utf-8" },
    { "Cache-Control": "no-store, max-age=0" },
  );

  assert.equal(headers.get("cache-control"), "no-store, max-age=0");
  assert.match(headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(headers.get("content-type"), "text/markdown; charset=utf-8");
});
