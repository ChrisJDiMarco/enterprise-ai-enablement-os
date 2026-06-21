import test from "node:test";
import assert from "node:assert/strict";

import type { AuditLog } from "../src/lib/enterprise-ai-data.ts";
import { normalizeAuditLog } from "../src/lib/ui/format.ts";

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-ui",
    eventType: "workspace_imported",
    message: "Workspace imported.",
    actor: "Admin",
    riskLevel: "low",
    createdAt: "2026-06-19T12:00:00.000Z",
    ...overrides,
  };
}

test("normalizeAuditLog sanitizes local and imported audit text", () => {
  const normalized = normalizeAuditLog(auditLog({
    message:
      "Workspace imported. api_key=sk-live-sensitive1234567890 prompt: summarize payroll-plan.txt payload={secret:true}.",
    actor: "Bearer abcdefghijklmnopqrstuvwxyz123456",
  }));
  const serialized = JSON.stringify(normalized);

  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("payroll-plan.txt"), false);
  assert.equal(serialized.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.match(normalized.message, /api_key=\[redacted\]/);
  assert.match(normalized.message, /prompt=\[redacted\]/);
  assert.equal(normalized.actor, "[redacted]");
});

test("normalizeAuditLog preserves legacy event remapping while sanitizing", () => {
  const normalized = normalizeAuditLog(auditLog({
    eventType: "skill_updated",
    message: "Workspace imported with password=tenant-secret-value.",
    actor: "Admin",
  }));

  assert.equal(normalized.eventType, "workspace_imported");
  assert.equal(normalized.message.includes("tenant-secret-value"), false);
  assert.match(normalized.message, /password=\[redacted\]/);
});
