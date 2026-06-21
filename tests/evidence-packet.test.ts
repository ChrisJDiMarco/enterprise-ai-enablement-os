import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvidencePacket } from "../src/lib/evidence-packet.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import type { EvaluationArtifact } from "../src/lib/evaluation-runner.ts";

test("evidence packet compiles workspace proof into JSON and markdown", () => {
  const workspace = buildDemoWorkspace("packet-org");
  const packet = buildEvidencePacket({ workspace });

  assert.equal(packet.schema, "enterprise-ai-enablement-os.evidence-packet.v2");
  assert.equal(packet.organizationId, "packet-org");
  assert.equal(packet.summary.useCases > 0, true);
  assert.equal(typeof packet.summary.securityFindings, "number");
  assert.equal(Object.values(packet.controls).every((coverage) => coverage >= 0 && coverage <= 100), true);
  assert.equal(packet.items.some((item) => item.type === "skill"), true);
  assert.equal(packet.items.some((item) => item.type === "security"), true);
  assert.match(packet.markdown, /Evidence Packet/);
  assert.match(packet.markdown, /Agent security findings/);
  assert.match(packet.markdown, /Eval evidence records/);
  assert.doesNotMatch(packet.markdown, /Eval artifacts:/);
});

test("evidence packet emits workspace eval results as evidence items", () => {
  const workspace = buildDemoWorkspace("workspace-eval-packet-org");
  const packet = buildEvidencePacket({ workspace });
  const evalItems = packet.items.filter((item) => item.type === "eval");

  assert.equal(evalItems.length, workspace.evalResults.length);
  assert.equal(packet.summary.evalArtifacts, workspace.evalResults.length);
  assert.ok(evalItems.some((item) => item.id === "eval-ev-3" && item.riskLevel === "high"));
  assert.match(packet.markdown, /Contract Review Grounding/);
});

test("evidence packet does not duplicate eval results already represented by durable artifacts", () => {
  const workspace = buildDemoWorkspace("durable-eval-packet-org");
  const result = workspace.evalResults[0]!;
  const artifact: EvaluationArtifact = {
    id: `eval-artifact-${result.id}`,
    organizationId: workspace.organizationId,
    skillId: result.skillId,
    suiteId: "launch-readiness",
    suiteName: result.suiteName,
    score: result.score,
    passed: result.passed,
    threshold: 90,
    executionMode: "static-analysis",
    result: {
      ...result,
      suiteId: "launch-readiness",
      threshold: 90,
      executionMode: "static-analysis",
      resultsByTest: [],
    },
    summary: "Durable eval artifact recorded.",
    createdAt: result.createdAt,
  };
  const packet = buildEvidencePacket({ workspace, evalArtifacts: [artifact] });

  assert.equal(packet.items.filter((item) => item.type === "eval").length, workspace.evalResults.length);
  assert.equal(packet.items.filter((item) => item.id === artifact.id).length, 1);
  assert.equal(packet.items.some((item) => item.id === `eval-${result.id}`), false);
});
