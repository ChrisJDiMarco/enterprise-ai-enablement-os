import assert from "node:assert/strict";
import test from "node:test";

import {
  activeCommandOrders,
  mergeCommandOrders,
  normalizeCommandOrders,
  setCommandOrderStatus,
  type CommandOrderRecord,
} from "../src/lib/command-orders.ts";
import type { TransformationCommandSystem } from "../src/lib/transformation-command-system.ts";

const baseCommandSystem: Pick<TransformationCommandSystem, "orders"> = {
  orders: [
    {
      id: "command-industrialize",
      title: "Turn the best use case into a governed Skill",
      why: "The Skill is the reusable asset.",
      evidenceNeeded: "Owner, prompt, context, tools, evals, and launch checklist.",
      targetView: "skills",
      urgency: "now",
      confidence: 94,
    },
    {
      id: "command-execute",
      title: "Run the Harness and capture trace evidence",
      why: "Trust needs inspectable runtime proof.",
      evidenceNeeded: "Traceable run, policy decision, cost, latency, and validation events.",
      targetView: "harness",
      urgency: "next",
      confidence: 88,
    },
  ],
};

test("mergeCommandOrders creates persistent orders from the transformation command system", () => {
  const orders = mergeCommandOrders([], baseCommandSystem, new Date("2026-05-29T12:00:00.000Z"));

  assert.equal(orders.length, 2);
  assert.equal(orders[0].id, "command-industrialize");
  assert.equal(orders[0].priority, "critical");
  assert.equal(orders[0].dueDate, "2026-05-30");
  assert.equal(orders[0].status, "open");
  assert.equal(orders[0].source, "command_system");
});

test("mergeCommandOrders preserves lifecycle state for existing command orders", () => {
  const initial = mergeCommandOrders([], baseCommandSystem, new Date("2026-05-29T12:00:00.000Z"));
  const inProgress = setCommandOrderStatus(initial, "command-industrialize", "in_progress", new Date("2026-05-29T13:00:00.000Z"));
  const merged = mergeCommandOrders(inProgress, baseCommandSystem, new Date("2026-05-29T14:00:00.000Z"));

  const industrialize = merged.find((order) => order.id === "command-industrialize");
  assert.equal(industrialize?.status, "in_progress");
  assert.equal(industrialize?.createdAt, "2026-05-29T12:00:00.000Z");
});

test("normalizeCommandOrders drops invalid rows and de-duplicates by id", () => {
  const normalized = normalizeCommandOrders([
    { id: "bad", title: "Missing view" },
    {
      id: "one",
      title: "Open evidence",
      targetView: "evidence",
      status: "not-a-status",
      priority: "weird",
      source: "external",
      dueDate: "not-date",
      createdAt: "2026-05-29T12:00:00.000Z",
      updatedAt: "2026-05-29T12:00:00.000Z",
    },
    {
      id: "one",
      title: "Open evidence updated",
      targetView: "evidence",
      status: "blocked",
      priority: "high",
      source: "manual",
      dueDate: "2026-06-01",
      createdAt: "2026-05-29T12:30:00.000Z",
      updatedAt: "2026-05-29T12:30:00.000Z",
    },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].title, "Open evidence updated");
  assert.equal(normalized[0].status, "blocked");
  assert.equal(normalized[0].priority, "high");
});

test("activeCommandOrders filters completed and dismissed work", () => {
  const orders: CommandOrderRecord[] = mergeCommandOrders([], baseCommandSystem, new Date("2026-05-29T12:00:00.000Z"));
  const completed = setCommandOrderStatus(orders, "command-industrialize", "completed", new Date("2026-05-29T15:00:00.000Z"));

  assert.deepEqual(
    activeCommandOrders(completed).map((order) => order.id),
    ["command-execute"],
  );
});
