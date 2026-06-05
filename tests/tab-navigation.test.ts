import test from "node:test";
import assert from "node:assert/strict";

import { nextTabId } from "../src/lib/ui/tab-navigation.ts";

const tabs: [string, string][] = [
  ["overview", "Overview"],
  ["context", "Context"],
  ["runs", "Runs"],
];

test("nextTabId supports arrow-key tab navigation with wraparound", () => {
  assert.equal(nextTabId(tabs, "overview", "ArrowRight"), "context");
  assert.equal(nextTabId(tabs, "runs", "ArrowRight"), "overview");
  assert.equal(nextTabId(tabs, "overview", "ArrowLeft"), "runs");
  assert.equal(nextTabId(tabs, "context", "ArrowUp"), "overview");
  assert.equal(nextTabId(tabs, "context", "ArrowDown"), "runs");
});

test("nextTabId supports Home and End keys", () => {
  assert.equal(nextTabId(tabs, "context", "Home"), "overview");
  assert.equal(nextTabId(tabs, "context", "End"), "runs");
});

test("nextTabId ignores unrelated keys and handles empty sets", () => {
  assert.equal(nextTabId(tabs, "overview", "Enter"), null);
  assert.equal(nextTabId([], "overview", "ArrowRight"), null);
});
