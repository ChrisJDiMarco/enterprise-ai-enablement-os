import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";

test("buildDemoWorkspace: includes a governed workflow blueprint", () => {
  const workspace = buildDemoWorkspace("northwind");

  assert.equal(workspace.workspaceMode, "demo");
  assert.equal(workspace.workflow.status, "Published");
  assert.ok(workspace.workflow.nodes.length >= 6);
  assert.ok(workspace.workflow.edges.length >= workspace.workflow.nodes.length - 1);
  assert.ok(
    workspace.workflow.nodes.some((node) => {
      const record = node as { data?: { blockType?: string } };
      return record.data?.blockType === "human_approval";
    }),
  );
  assert.ok(
    workspace.workflow.nodes.some((node) => {
      const record = node as { data?: { blockType?: string; systemPrompt?: string } };
      return record.data?.blockType === "llm_analysis" && Boolean(record.data.systemPrompt);
    }),
  );
});
