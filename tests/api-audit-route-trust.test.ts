import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

test("audit list route bounds query limits and discloses verification windows", () => {
  const route = path.join(process.cwd(), "src/app/api/audit/route.ts");
  const source = readFileSync(route, "utf8");

  assert.match(source, /boundedQueryLimit/, "audit list limits must use the shared bounded query parser");
  assert.match(source, /auditVerificationWindowLimit/, "audit verification must use an explicit bounded window");
  assert.match(source, /verificationMayBeTruncated/, "audit verification responses must disclose bounded-window uncertainty");
});
