import test from "node:test";
import assert from "node:assert/strict";

import { draftWorkSignalFromPrompt } from "../src/lib/work-signal-drafting.ts";

test("draftWorkSignalFromPrompt stores aggregate metadata instead of raw prompt content", () => {
  const signal = draftWorkSignalFromPrompt(
    [
      "Capture a work signal for HR benefits queue:",
      "Jane Employee jane.employee@example.com called 212-555-0101 and said payroll missed dependent coverage.",
      "api_key=sk-live-sensitive1234567890",
      "There are 240 requests per month, 4 hours waiting, and 30 minutes each.",
    ].join(" "),
    "2026-06-19T12:00:00.000Z",
  );
  const serialized = JSON.stringify(signal);

  assert.equal(signal.privacy.contentRedacted, true);
  assert.equal(signal.privacy.rawContentStored, false);
  assert.match(signal.summary, /aggregate/i);
  assert.match(signal.summary, /Raw message content is not stored/);
  assert.equal(signal.metadata.volume, 240);
  assert.equal(signal.metadata.delayHours, 4);
  assert.equal(signal.metadata.cycleTimeHours, 0.5);
  assert.equal(serialized.includes("Jane Employee"), false);
  assert.equal(serialized.includes("jane.employee@example.com"), false);
  assert.equal(serialized.includes("212-555-0101"), false);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("missed dependent coverage"), false);
});

test("draftWorkSignalFromPrompt keeps useful process and source classification", () => {
  const signal = draftWorkSignalFromPrompt(
    "Capture a work signal for Jira support tickets with repeated approval delays, 80 tickets per month.",
    "2026-06-19T12:00:00.000Z",
  );

  assert.equal(signal.source, "jira");
  assert.equal(signal.eventType, "approval_waiting");
  assert.equal(signal.metadata.volume, 80);
  assert.match(signal.summary, /approval waiting/i);
});
