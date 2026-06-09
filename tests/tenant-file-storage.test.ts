import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { safeTenantFileStem, tenantScopedJsonPath } from "../src/lib/tenant-file-storage.ts";

test("safeTenantFileStem preserves ordinary tenant ids for backwards-compatible local files", () => {
  assert.equal(safeTenantFileStem("default"), "default");
  assert.equal(safeTenantFileStem("smoke-org-123"), "smoke-org-123");
  assert.equal(safeTenantFileStem("tenant_ABC123"), "tenant_ABC123");
  assert.equal(safeTenantFileStem("  tenant-safe  "), "tenant-safe");
});

test("safeTenantFileStem hashes unsafe tenant ids into traversal-free names", () => {
  const first = safeTenantFileStem("../../outside");
  const second = safeTenantFileStem("../../outside");
  const withSlash = safeTenantFileStem("customer/acme");
  const withDot = safeTenantFileStem("customer.example.com");

  assert.equal(first, second);
  assert.match(first, /^tenant-[a-f0-9]{32}$/);
  assert.match(withSlash, /^tenant-[a-f0-9]{32}$/);
  assert.match(withDot, /^tenant-[a-f0-9]{32}$/);
  assert.equal(first.includes("/"), false);
  assert.equal(first.includes(".."), false);
});

test("tenantScopedJsonPath always stays inside the requested base directory", () => {
  const baseDir = path.join("/tmp", "eaieos-tenant-store");
  const filePath = tenantScopedJsonPath(baseDir, "../../../etc/passwd");
  const relative = path.relative(baseDir, filePath);

  assert.equal(path.dirname(filePath), baseDir);
  assert.equal(relative.startsWith(".."), false);
  assert.equal(path.isAbsolute(relative), false);
  assert.match(path.basename(filePath), /^tenant-[a-f0-9]{32}\.json$/);
});
