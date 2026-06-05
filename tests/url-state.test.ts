import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkspaceUrlState,
  parseWorkspaceUrlState,
  serializeWorkspaceUrlState,
} from "../src/lib/ui/url-state.ts";

test("parseWorkspaceUrlState accepts known OS surfaces and subpage state", () => {
  const state = parseWorkspaceUrlState(
    "?view=skills&skillMode=detail&skillTab=context&skillId=skill-hr-policy-v1&ignored=yes",
  );

  assert.deepEqual(state, {
    view: "skills",
    skillMode: "detail",
    skillTab: "context",
    skillId: "skill-hr-policy-v1",
    factoryTab: undefined,
    harnessMode: undefined,
    runId: undefined,
    useCaseId: undefined,
    workflowMode: undefined,
  });
});

test("parseWorkspaceUrlState accepts AI estate and connector setup surfaces", () => {
  assert.equal(parseWorkspaceUrlState("?view=estate").view, "estate");
  assert.equal(parseWorkspaceUrlState("?view=connectors").view, "connectors");
  assert.equal(parseWorkspaceUrlState("?view=launch").view, "launch");
});

test("parseWorkspaceUrlState drops unknown views, tabs, and unsafe record ids", () => {
  const state = parseWorkspaceUrlState(
    "?view=unknown&factoryTab=oops&runId=<script>&skillTab=../../secrets&workflowMode=editor",
  );

  assert.equal(state.view, undefined);
  assert.equal(state.factoryTab, undefined);
  assert.equal(state.runId, undefined);
  assert.equal(state.skillTab, undefined);
  assert.equal(state.workflowMode, "editor");
});

test("buildWorkspaceUrlState keeps links focused on the active surface", () => {
  assert.deepEqual(
    buildWorkspaceUrlState({
      view: "harness",
      factoryTab: "detail",
      skillMode: "detail",
      skillTab: "context",
      harnessMode: "detail",
      workflowMode: "editor",
      selectedUseCaseId: "uc-1",
      selectedSkillId: "skill-1",
      selectedRunId: "run-1001",
    }),
    {
      view: "harness",
      harnessMode: "detail",
      runId: "run-1001",
    },
  );
});

test("serializeWorkspaceUrlState preserves unrelated query params", () => {
  const nextSearch = serializeWorkspaceUrlState(
    {
      view: "factory",
      factoryTab: "backlog",
      useCaseId: "uc-100",
    },
    "?smoke=1&view=command&runId=old",
  );

  assert.equal(nextSearch, "?smoke=1&view=factory&factoryTab=backlog&useCaseId=uc-100");
});
