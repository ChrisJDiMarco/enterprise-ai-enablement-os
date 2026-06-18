import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import { deriveEnterpriseAiOperatingSystem } from "../src/lib/enterprise-ai-operating-system.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

test("enterprise AI operating system keeps an empty workspace honest", () => {
  const workspace = emptyWorkspace("test-org");
  const os = deriveEnterpriseAiOperatingSystem({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    evalResults: workspace.evalResults,
    governanceReviews: workspace.governanceReviews,
    auditLogs: workspace.auditLogs,
    toolRequests: workspace.toolRequests,
    workSignals: workspace.workSignals,
    report: workspace.report,
  });

  assert.equal(os.posture, "gap");
  assert.equal(os.metrics.aiAssets, 0);
  assert.equal(os.recommendations[0]?.id, "first-use-case");
  assert.equal(os.lifecycle.length >= 6, true);
});

test("enterprise AI operating system turns a populated workspace into a multi-lane control view", () => {
  const workspace = buildDemoWorkspace("demo");
  const os = deriveEnterpriseAiOperatingSystem({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    evalResults: workspace.evalResults,
    governanceReviews: workspace.governanceReviews,
    auditLogs: workspace.auditLogs,
    toolRequests: workspace.toolRequests,
    workSignals: workspace.workSignals,
    contextSources: workspace.contextSources,
    report: workspace.report,
  });

  assert.equal(os.metrics.aiAssets > 0, true);
  assert.equal(os.capabilities.some((capability) => capability.id === "protocol-ready"), true);
  assert.equal(os.protocols.some((protocol) => protocol.id === "mcp"), true);
  assert.equal(os.workflowLanes.some((lane) => lane.id === "scale"), true);
  assert.equal(os.stakeholderTracks.some((track) => track.audience === "Executive sponsor"), true);
  assert.equal(os.score > 30, true);
});
