import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretWorkflow, orderWorkflowNodes, type WorkflowExecNode } from "../src/lib/workflow-interpreter.ts";

function node(id: string, blockType: string, extra: Record<string, unknown> = {}) {
  return { id, position: { x: 0, y: 0 }, data: { blockType, title: id, ...extra } };
}

function edge(source: string, target: string) {
  return { id: `e-${source}-${target}`, source, target };
}

test("interpretWorkflow runs steps in edge order and completes", async () => {
  const executed: string[] = [];
  const result = await interpretWorkflow({
    nodes: [node("start", "manual_trigger"), node("analyze", "llm_analysis", { systemPrompt: "x" }), node("done", "end")],
    edges: [edge("start", "analyze"), edge("analyze", "done")],
    executeStep: async (n) => {
      executed.push(n.id);
      return { output: `ran ${n.id}`, detail: "ok" };
    },
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(executed, ["analyze"]);
  assert.equal(result.output.analyze, "ran analyze");
  assert.deepEqual(result.steps.map((s) => s.status), ["completed", "completed", "completed"]);
});

test("interpretWorkflow stops at a human-approval gate", async () => {
  const executed: string[] = [];
  const result = await interpretWorkflow({
    nodes: [
      node("start", "manual_trigger"),
      node("analyze", "llm_analysis"),
      node("gate", "human_approval"),
      node("act", "tool_call", { toolId: "slack.send" }),
    ],
    edges: [edge("start", "analyze"), edge("analyze", "gate"), edge("gate", "act")],
    executeStep: async (n) => {
      executed.push(n.id);
      return { detail: "ok" };
    },
  });
  assert.equal(result.status, "waiting_for_approval");
  assert.equal(result.pendingNodeId, "gate");
  assert.deepEqual(executed, ["analyze"], "steps after the gate must not run");
});

test("interpretWorkflow fails the run when a step fails", async () => {
  const result = await interpretWorkflow({
    nodes: [node("start", "manual_trigger"), node("analyze", "llm_analysis"), node("done", "end")],
    edges: [edge("start", "analyze"), edge("analyze", "done")],
    executeStep: async () => ({ status: "failed", detail: "model error" }),
  });
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /model error/);
});

test("interpretWorkflow records steps when no executor is provided", async () => {
  const result = await interpretWorkflow({
    nodes: [node("start", "manual_trigger"), node("analyze", "llm_analysis"), node("done", "end")],
    edges: [edge("start", "analyze"), edge("analyze", "done")],
  });
  assert.equal(result.status, "completed");
  assert.equal(result.steps.find((s) => s.nodeId === "analyze")?.status, "skipped");
});

test("interpretWorkflow fails cleanly with no nodes", async () => {
  const result = await interpretWorkflow({ nodes: [], edges: [] });
  assert.equal(result.status, "failed");
});

test("orderWorkflowNodes falls back to array order without edges", () => {
  const nodes: WorkflowExecNode[] = [
    { id: "a", blockType: "manual_trigger", title: "a", requiresApproval: false },
    { id: "b", blockType: "llm_analysis", title: "b", requiresApproval: false },
  ];
  assert.deepEqual(orderWorkflowNodes(nodes, []).map((n) => n.id), ["a", "b"]);
});
