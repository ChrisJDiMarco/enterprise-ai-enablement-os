import { test } from "node:test";
import assert from "node:assert/strict";

import { inferColumnAlign, isNumericText } from "../src/components/ui/data-table-align.ts";

test("isNumericText recognizes numbers, currency, and percent — not unit-bearing or text", () => {
  for (const v of ["1,842", "42", "$0.018", "96%", "-12", "+3.5", "£100"]) {
    assert.equal(isNumericText(v), true, `${v} should be numeric`);
  }
  for (const v of ["126 hrs/mo", "2400ms", "Passed", "Q4", "tier_2", ""]) {
    assert.equal(isNumericText(v), false, `${v} should NOT be numeric`);
  }
  // Non-string (JSX) cells are never numeric.
  assert.equal(isNumericText(42 as unknown as string), false);
  assert.equal(isNumericText(null), false);
});

test("inferColumnAlign right-aligns mostly-numeric columns and left-aligns the rest", () => {
  const rows = [
    ["Slack post", "$0.018", "Passed", "120 ms"],
    ["Jira create", "$1.20", "Blocked", "2400 ms"],
    ["Teams send", "$0.40", "Passed", "640 ms"],
  ];
  assert.equal(inferColumnAlign(rows, 0), "left", "name column stays left");
  assert.equal(inferColumnAlign(rows, 1), "right", "currency column right-aligns");
  assert.equal(inferColumnAlign(rows, 2), "left", "status text stays left");
  assert.equal(inferColumnAlign(rows, 3), "left", "unit-bearing latency stays left");
});

test("inferColumnAlign ignores empty/JSX cells when deciding", () => {
  const rows = [
    ["A", "10"],
    ["B", ""],
    ["C", "20"],
  ];
  // 2 of 2 non-empty string cells are numeric -> right.
  assert.equal(inferColumnAlign(rows, 1), "right");
  // No string cells at all -> default left.
  assert.equal(inferColumnAlign([], 0), "left");
});
