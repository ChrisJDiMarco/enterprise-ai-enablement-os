import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuditLog, resealAuditLogs, sealAuditLog, verifyAuditChain } from "../src/lib/audit-integrity.ts";
import type { AuditLog } from "../src/lib/enterprise-ai-data.ts";

function log(id: string, message: string): AuditLog {
  return {
    id,
    eventType: "test_event",
    message,
    actor: "Integrity Test",
    riskLevel: "low",
    createdAt: `2026-05-29T00:00:0${id.at(-1) ?? "0"}.000Z`,
  };
}

test("audit integrity seals create a verifiable hash chain", () => {
  const first = sealAuditLog({ organizationId: "org-audit", log: log("audit-1", "First event."), existingLogs: [] });
  const second = sealAuditLog({ organizationId: "org-audit", log: log("audit-2", "Second event."), existingLogs: [first] });

  const verification = verifyAuditChain("org-audit", [second, first]);

  assert.equal(first.integrity?.sequence, 1);
  assert.equal(second.integrity?.sequence, 2);
  assert.equal(second.integrity?.previousHash, first.integrity?.hash);
  assert.equal(verification.verified, true);
  assert.equal(verification.sealed, 2);
  assert.equal(verification.legacy, 0);
});

test("audit integrity verification detects tampering and legacy gaps", () => {
  const first = sealAuditLog({ organizationId: "org-audit", log: log("audit-1", "Original event."), existingLogs: [] });
  const tampered = { ...first, message: "Changed event." };
  const legacy = log("audit-legacy", "Legacy event.");

  const verification = verifyAuditChain("org-audit", [tampered, legacy]);

  assert.equal(verification.verified, false);
  assert.equal(verification.legacy, 1);
  assert.equal(verification.gaps.some((gap) => gap.includes("canonical payload hash mismatch")), true);
  assert.equal(verification.gaps.some((gap) => gap.includes("legacy audit log")), true);
});

test("audit integrity can reseal legacy records as an upgrade chain", () => {
  const legacyLogs = [
    log("audit-2", "Second legacy event."),
    log("audit-1", "First legacy event."),
  ];

  const resealed = resealAuditLogs({
    organizationId: "org-audit",
    logs: legacyLogs,
    sealedAt: "2026-05-29T12:00:00.000Z",
  });

  assert.equal(resealed.integrity.verified, true);
  assert.equal(resealed.integrity.legacy, 0);
  assert.equal(resealed.logs[0].id, "audit-1");
  assert.equal(resealed.logs[0].integrity?.sequence, 1);
  assert.equal(resealed.logs[1].integrity?.sequence, 2);
  assert.equal(resealed.logs[1].integrity?.previousHash, resealed.logs[0].integrity?.hash);
});

test("sanitizeAuditLog redacts credentials and raw prompt fields while preserving useful audit wording", () => {
  const sanitized = sanitizeAuditLog({
    ...log("audit-secret", "Tenant secret vault configured. api_key=sk-live-sensitive1234567890 system prompt: include payroll-plan.txt and raw payload={secret:true}."),
    actor: "Bearer abcdefghijklmnopqrstuvwxyz123456",
  });
  const serialized = JSON.stringify(sanitized);

  assert.match(sanitized.message, /Tenant secret vault configured/);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("payroll-plan.txt"), false);
  assert.equal(serialized.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.match(sanitized.message, /api_key=\[redacted\]/);
  assert.match(sanitized.message, /system prompt=\[redacted\]/);
  assert.equal(sanitized.actor, "[redacted]");
});

test("sealAuditLog seals the sanitized audit payload", () => {
  const sealed = sealAuditLog({
    organizationId: "org-audit",
    log: log("audit-secret", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 and prompt: confidential user request."),
    existingLogs: [],
    sealedAt: "2026-05-29T12:00:00.000Z",
  });
  const verification = verifyAuditChain("org-audit", [sealed]);
  const serialized = JSON.stringify(sealed);

  assert.equal(verification.verified, true);
  assert.equal(serialized.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.equal(serialized.includes("confidential user request"), false);
  assert.match(sealed.message, /Authorization=\[redacted\]/);
});
