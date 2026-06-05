import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOrchestratorAction,
  orchestratorActionForView,
  orchestratorViewFromPrompt,
} from "../src/lib/orchestrator-actions.ts";

test("orchestratorViewFromPrompt routes common operator language to OS surfaces", () => {
  assert.equal(orchestratorViewFromPrompt("show me the command center"), "command");
  assert.equal(orchestratorViewFromPrompt("open the MCP connector broker"), "broker");
  assert.equal(orchestratorViewFromPrompt("show the agent registry and AI estate"), "estate");
  assert.equal(orchestratorViewFromPrompt("help me finish Slack setup"), "connectors");
  assert.equal(orchestratorViewFromPrompt("where are the red team eval results?"), "evals");
  assert.equal(orchestratorViewFromPrompt("build a 90 day company implementation plan"), "blueprint");
  assert.equal(orchestratorViewFromPrompt("talk through something unrelated"), null);
});

test("orchestratorActionForView creates a visible navigation action", () => {
  const action = orchestratorActionForView("harness");

  assert.equal(action.type, "open_view");
  assert.equal(action.label, "Open AI Harness");
  assert.equal(action.description, "Navigate to this OS surface.");
  assert.deepEqual(action.payload, { view: "harness" });
});

test("buildOrchestratorAction keeps action tone and payload explicit", () => {
  const action = buildOrchestratorAction(
    "approve_pending_tool_request",
    "Approve request",
    "Visible human approval.",
    { requestId: "tr-1" },
    "primary",
  );

  assert.equal(action.type, "approve_pending_tool_request");
  assert.equal(action.label, "Approve request");
  assert.equal(action.tone, "primary");
  assert.deepEqual(action.payload, { requestId: "tr-1" });
  assert.match(action.id, /^oa-approve_pending_tool_request-/);
});
