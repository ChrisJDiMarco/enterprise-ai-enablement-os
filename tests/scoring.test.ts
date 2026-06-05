import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePriorityScore,
  riskToScore,
  formatCurrency,
  getUserName,
  setPlatformCatalogs,
  clearPlatformCatalogs,
} from "../src/lib/enterprise-ai-data.ts";

afterEach(() => clearPlatformCatalogs());

const baseScore = {
  valueScore: 3,
  feasibilityScore: 3,
  reuseScore: 3,
  urgencyScore: 3,
  dataReadinessScore: 3,
  riskScore: 3,
};

test("calculatePriorityScore: stays within 0..100", () => {
  const max = calculatePriorityScore({
    valueScore: 5,
    feasibilityScore: 5,
    reuseScore: 5,
    urgencyScore: 5,
    dataReadinessScore: 5,
    riskScore: 1,
  });
  const min = calculatePriorityScore({
    valueScore: 0,
    feasibilityScore: 0,
    reuseScore: 0,
    urgencyScore: 0,
    dataReadinessScore: 0,
    riskScore: 5,
  });
  assert.ok(max >= 0 && max <= 100, `max ${max}`);
  assert.ok(min >= 0 && min <= 100, `min ${min}`);
  assert.ok(max > min);
});

test("calculatePriorityScore: rises with value", () => {
  const low = calculatePriorityScore({ ...baseScore, valueScore: 1 });
  const high = calculatePriorityScore({ ...baseScore, valueScore: 5 });
  assert.ok(high > low);
});

test("calculatePriorityScore: falls as risk rises", () => {
  const lowRisk = calculatePriorityScore({ ...baseScore, riskScore: 1 });
  const highRisk = calculatePriorityScore({ ...baseScore, riskScore: 5 });
  assert.ok(highRisk < lowRisk);
});

test("riskToScore: maps each level to its weight", () => {
  assert.equal(riskToScore("low"), 1);
  assert.equal(riskToScore("medium"), 2.5);
  assert.equal(riskToScore("high"), 4);
  assert.equal(riskToScore("restricted"), 5);
});

test("formatCurrency: formats whole-dollar USD", () => {
  assert.equal(formatCurrency(1000), "$1,000");
  assert.equal(formatCurrency(0), "$0");
  assert.equal(formatCurrency(1250000), "$1,250,000");
});

test("getUserName: resolves the synthetic current user", () => {
  assert.equal(getUserName("current-user"), "Workspace Admin");
});

test("getUserName: prefers the configured session user over the synthetic fallback", () => {
  setPlatformCatalogs({
    users: [
      {
        id: "current-user",
        name: "Priya Shah",
        email: "priya@example.com",
        title: "Security Reviewer",
        department: "Security",
        role: "security_reviewer",
      },
    ],
  });
  assert.equal(getUserName("current-user"), "Priya Shah");
});

test("getUserName: flags an unknown id and an unassigned owner", () => {
  assert.equal(getUserName("nope"), "User not configured");
  assert.equal(getUserName(undefined), "Unassigned");
});

test("getUserName: resolves a configured catalog user", () => {
  setPlatformCatalogs({
    users: [
      { id: "u-9", name: "Amara Okafor", email: "a@x.co", title: "Lead", department: "HR", role: "owner" },
    ],
  });
  assert.equal(getUserName("u-9"), "Amara Okafor");
});

test("clearPlatformCatalogs: empties the user catalog", () => {
  setPlatformCatalogs({ users: [{ id: "u-1", name: "X", email: "x@x.co", title: "", department: "HR", role: "" }] });
  clearPlatformCatalogs();
  assert.equal(getUserName("u-1"), "User not configured");
});
