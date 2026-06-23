import { test } from "node:test";
import assert from "node:assert/strict";
import { __resetAlertDebounceForTests, fireAlertOnce } from "../src/lib/alerts.ts";

const base = { organizationId: "platform", severity: "critical" as const, title: "t" };

test("fireAlertOnce fires the first time and suppresses repeats within the window", async () => {
  __resetAlertDebounceForTests();
  assert.equal(await fireAlertOnce({ ...base, key: "k1", debounceMs: 60_000 }), true);
  assert.equal(await fireAlertOnce({ ...base, key: "k1", debounceMs: 60_000 }), false);
  assert.equal(await fireAlertOnce({ ...base, key: "k1", debounceMs: 60_000 }), false);
});

test("fireAlertOnce debounces each key independently", async () => {
  __resetAlertDebounceForTests();
  assert.equal(await fireAlertOnce({ ...base, key: "a", debounceMs: 60_000 }), true);
  assert.equal(await fireAlertOnce({ ...base, key: "b", debounceMs: 60_000 }), true);
  assert.equal(await fireAlertOnce({ ...base, key: "a", debounceMs: 60_000 }), false);
});

test("fireAlertOnce fires again after the window elapses", async () => {
  __resetAlertDebounceForTests();
  assert.equal(await fireAlertOnce({ ...base, key: "w", debounceMs: 5 }), true);
  assert.equal(await fireAlertOnce({ ...base, key: "w", debounceMs: 5 }), false);
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(await fireAlertOnce({ ...base, key: "w", debounceMs: 5 }), true);
});

test("__resetAlertDebounceForTests clears the debounce state", async () => {
  __resetAlertDebounceForTests();
  assert.equal(await fireAlertOnce({ ...base, key: "r", debounceMs: 60_000 }), true);
  assert.equal(await fireAlertOnce({ ...base, key: "r", debounceMs: 60_000 }), false);
  __resetAlertDebounceForTests();
  assert.equal(await fireAlertOnce({ ...base, key: "r", debounceMs: 60_000 }), true);
});
