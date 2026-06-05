import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildDomainProjection,
  domainProjectionCounts,
  domainSchemaSql,
} from "../src/lib/domain-repository.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

test("domain projection mirrors the operational workspace collections", () => {
  const workspace = buildDemoWorkspace("northwind-test");
  const projection = buildDomainProjection(workspace);
  const counts = domainProjectionCounts(projection);

  assert.equal(projection.organizationId, workspace.organizationId);
  assert.equal(counts.users, workspace.users.length);
  assert.equal(counts.tools, workspace.tools.length);
  assert.equal(counts.contextSources, workspace.contextSources.length);
  assert.equal(counts.useCases, workspace.useCases.length);
  assert.equal(counts.skills, workspace.skills.length);
  assert.equal(counts.runs, workspace.runs.length);
  assert.equal(counts.governanceReviews, workspace.governanceReviews.length);
  assert.equal(counts.evalResults, workspace.evalResults.length);
  assert.equal(counts.workSignals, workspace.workSignals.length);
  assert.ok(counts.evidenceItems >= workspace.auditLogs.length + workspace.runs.length + workspace.evalResults.length);
});

test("domain projection creates board-ready evidence from every proof source", () => {
  const projection = buildDomainProjection(buildDemoWorkspace("evidence-test"));
  const sourceTypes = new Set(projection.evidenceItems.map((item) => item.sourceType));
  const frameworks = new Set(projection.evidenceItems.map((item) => item.framework));

  assert.ok(sourceTypes.has("audit_log"));
  assert.ok(sourceTypes.has("harness_run"));
  assert.ok(sourceTypes.has("eval_result"));
  assert.ok(sourceTypes.has("governance_review"));
  assert.ok(sourceTypes.has("roi_assumption"));
  assert.ok(sourceTypes.has("work_signal"));
  assert.ok(frameworks.has("NIST AI RMF"));
  assert.ok(frameworks.has("ISO/IEC 42001"));
  assert.ok(frameworks.has("OWASP LLM/MCP"));

  const ids = new Set(projection.evidenceItems.map((item) => item.id));
  assert.equal(ids.size, projection.evidenceItems.length);
});

test("empty production workspace does not invent operational data", () => {
  const projection = buildDomainProjection(emptyWorkspace("production-empty"));
  const counts = domainProjectionCounts(projection);

  assert.equal(counts.users, 0);
  assert.equal(counts.tools, 0);
  assert.equal(counts.contextSources, 0);
  assert.equal(counts.useCases, 0);
  assert.equal(counts.skills, 0);
  assert.equal(counts.runs, 0);
  assert.equal(counts.evidenceItems, 0);
});

test("domain schema declares tenant-isolated query tables", () => {
  assert.match(domainSchemaSql, /create table if not exists use_cases/i);
  assert.match(domainSchemaSql, /create table if not exists evidence_items/i);
  assert.match(domainSchemaSql, /enable row level security/i);
  assert.match(domainSchemaSql, /current_setting\(''?app\.organization_id/i);
});
