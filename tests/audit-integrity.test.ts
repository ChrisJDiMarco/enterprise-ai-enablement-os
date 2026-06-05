import { test } from "node:test";
import assert from "node:assert/strict";
import { resealAuditLogs, sealAuditLog, verifyAuditChain } from "../src/lib/audit-integrity.ts";
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
