import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeOrchestratorMessagesForStorage } from "../src/lib/orchestrator-message-storage.ts";
import type { OrchestratorMessage } from "../src/lib/ui/types.ts";

function message(overrides: Partial<OrchestratorMessage> = {}): OrchestratorMessage {
  return {
    id: "om-test",
    role: "user",
    content: "Please use api_key=sk-live-sensitive1234567890 and summarize this payroll transcript.",
    createdAt: "Jun 19, 2026, 12:00 PM",
    ...overrides,
  };
}

test("sanitizeOrchestratorMessagesForStorage redacts credentials and hidden action payloads", () => {
  const [stored] = sanitizeOrchestratorMessagesForStorage([
    message({
      role: "assistant",
      content: "I can help. Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
      actions: [
        {
          id: "oa-draft",
          type: "draft_use_case",
          label: "Draft intake",
          description: "Use api_key=sk-live-sensitive1234567890",
          payload: {
            message: "Raw employee complaint about payroll and benefits.",
            note: "Bearer abcdefghijklmnopqrstuvwxyz123456",
            nested: { prompt: "Classify private HR transcript." },
          },
        },
      ],
      evidence: [{ label: "token", value: "postgres://user:password@db.internal/app" }],
    }),
  ]);
  const serialized = JSON.stringify(stored);

  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.equal(serialized.includes("payroll and benefits"), false);
  assert.equal(serialized.includes("private HR transcript"), false);
  assert.equal(serialized.includes("password@db.internal"), false);
  assert.equal(stored.actions?.[0]?.payload?.message, "[redacted]");
  assert.equal((stored.actions?.[0]?.payload?.nested as { prompt?: unknown } | undefined)?.prompt, "[redacted]");
});

test("sanitizeOrchestratorMessagesForStorage honors disabled prompt storage for user turns", () => {
  const [stored] = sanitizeOrchestratorMessagesForStorage(
    [message({ content: "Draft a use case from this sensitive employee message." })],
    { storePrompts: false },
  );

  assert.equal(stored.content, "[redacted]");
});

test("sanitizeOrchestratorMessagesForStorage redacts assistant echoes when prompt storage is disabled", () => {
  const [stored] = sanitizeOrchestratorMessagesForStorage(
    [
      message({
        role: "assistant",
        content: "I will draft a payroll use case for Jane Doe in HR from that private message.",
        actions: [
          {
            id: "oa-open-roi",
            type: "open_view",
            label: "Open ROI view",
            description: "Review Jane Doe payroll details before launch.",
            payload: {
              view: "roi",
              useCaseId: "uc-1",
              note: "Safe metadata can remain.",
              prompt: "Private employee prompt.",
            },
          },
        ],
        evidence: [
          { label: "route", value: "assistant echoed Jane Doe payroll details" },
        ],
      }),
    ],
    { storePrompts: false },
  );
  const serialized = JSON.stringify(stored);

  assert.equal(stored.content, "[redacted]");
  assert.equal(stored.actions?.[0]?.label, "Open ROI view");
  assert.equal(stored.actions?.[0]?.description, "[redacted]");
  assert.equal(stored.actions?.[0]?.payload?.view, "roi");
  assert.equal((stored.actions?.[0]?.payload as { prompt?: unknown } | undefined)?.prompt, "[redacted]");
  assert.equal(stored.evidence?.[0]?.label, "route");
  assert.equal(stored.evidence?.[0]?.value, "[redacted]");
  assert.equal(serialized.includes("Jane Doe"), false);
  assert.equal(serialized.includes("payroll details"), false);
  assert.equal(serialized.includes("Private employee prompt"), false);
});

test("sanitizeOrchestratorMessagesForStorage honors disabled tool payload storage", () => {
  const [stored] = sanitizeOrchestratorMessagesForStorage(
    [
      message({
        role: "assistant",
        content: "I prepared safe actions.",
        actions: [
          {
            id: "oa-open",
            type: "open_view",
            label: "Open ROI view",
            payload: {
              view: "roi",
              targetId: "run-123",
              message: "Do not keep this private prompt.",
              rawContent: "SECRET_TOKEN_SHOULD_NOT_LEAK",
            },
          },
          {
            id: "oa-draft",
            type: "draft_use_case",
            label: "Draft use case",
            payload: {
              message: "Finance AP prompt with private details.",
              source: "assistant",
            },
          },
          {
            id: "oa-approve",
            type: "approve_pending_tool_request",
            label: "Approve request",
            payload: {
              requestId: "tr-123",
              authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
            },
          },
        ],
      }),
    ],
    { storeToolPayloads: false },
  );
  const serialized = JSON.stringify(stored);

  assert.deepEqual(stored.actions?.[0]?.payload, { view: "roi", targetId: "run-123" });
  assert.equal(stored.actions?.[1]?.payload, undefined);
  assert.deepEqual(stored.actions?.[2]?.payload, { requestId: "tr-123" });
  assert.equal(serialized.includes("private prompt"), false);
  assert.equal(serialized.includes("SECRET_TOKEN"), false);
  assert.equal(serialized.includes("Finance AP prompt"), false);
  assert.equal(serialized.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
});

test("sanitizeOrchestratorMessagesForStorage keeps useful non-sensitive assistant wording", () => {
  const [stored] = sanitizeOrchestratorMessagesForStorage([
    message({
      role: "assistant",
      content: "Open the ROI view and compare adoption, value, and proof coverage.",
    }),
  ]);

  assert.equal(stored.content, "Open the ROI view and compare adoption, value, and proof coverage.");
});
