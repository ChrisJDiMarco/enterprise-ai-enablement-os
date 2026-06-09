import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const generationRoutes = [
  "src/app/api/reports/generate/route.ts",
  "src/app/api/use-cases/pilot-brief/route.ts",
];

test("generation routes do not merge client-supplied workspace state into evidence artifacts", () => {
  for (const route of generationRoutes) {
    const source = readFileSync(path.join(process.cwd(), route), "utf8");

    assert.equal(source.includes("parsed.data.workspace"), false, `${route} must ignore request workspace payloads`);
    assert.equal(source.includes("normalizeWorkspace("), false, `${route} must not normalize a client/server workspace merge`);
  }
});

test("orchestrator chat route derives trusted server context and returns private responses", () => {
  const route = "src/app/api/orchestrator/chat/route.ts";
  const source = readFileSync(path.join(process.cwd(), route), "utf8");

  assert.equal(source.includes("workspace: input.workspace"), false, `${route} must not plan from client-supplied workspace JSON`);
  assert.match(source, /deriveTrustedOrchestratorWorkspaceContext/, `${route} must rebuild assistant context from trusted workspace state`);
  assert.match(source, /privateResponseHeaders\(\)/, `${route} must mark tenant chat responses private and no-store`);
  assert.match(source, /buildEmergencyOrchestratorPlan/, `${route} must keep a safe planner fallback`);
});
