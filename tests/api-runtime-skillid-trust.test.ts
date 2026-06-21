import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  connectorExecutionInputSchema,
  evalRunInputSchema,
  harnessRunInputSchema,
} from "../src/lib/api-validation.ts";

test("runtime validation accepts skillId-only Harness, connector, and eval requests", () => {
  assert.equal(harnessRunInputSchema.safeParse({ skillId: "skill-runtime", message: "Run the Skill" }).success, true);
  assert.equal(
    connectorExecutionInputSchema.safeParse({
      skillId: "skill-runtime",
      toolId: "tool-read",
      payload: { recordId: "case-1" },
    }).success,
    true,
  );
  assert.equal(evalRunInputSchema.safeParse({ skillId: "skill-runtime", threshold: 80 }).success, true);
});

test("runtime validation rejects calls without a Skill reference", () => {
  assert.equal(harnessRunInputSchema.safeParse({ message: "Run the Skill" }).success, false);
  assert.equal(connectorExecutionInputSchema.safeParse({ toolId: "tool-read", payload: {} }).success, false);
  assert.equal(evalRunInputSchema.safeParse({ threshold: 80 }).success, false);
});

test("runtime routes resolve persisted Skill ids before execution", () => {
  const routes = [
    {
      file: "src/app/api/harness/run/route.ts",
      resolver: "resolveWorkspaceSkillForRuntime(workspace, requestedSkillId)",
      execution: "runServerHarnessSkill({",
      stalePatterns: [/resolveWorkspaceSkillForRuntime\(workspace,\s*body\.skill\.id\)/],
    },
    {
      file: "src/app/api/connectors/execute/route.ts",
      resolver: "resolveWorkspaceSkillForRuntime(workspace, requestedSkillId)",
      execution: "executeConnectorRequest({",
      stalePatterns: [/resolveWorkspaceSkillForRuntime\(workspace,\s*input\.skill\.id\)/],
    },
    {
      file: "src/app/api/evals/run/route.ts",
      resolver: "resolveWorkspaceSkillForRuntime(workspace, requestedSkillId)",
      execution: "runModelEvalSuite({",
      stalePatterns: [/resolveWorkspaceSkillForRuntime\(workspace,\s*parsed\.data\.skill\.id\)/],
    },
  ];

  for (const route of routes) {
    const source = readFileSync(path.join(process.cwd(), route.file), "utf8");
    const resolverIndex = source.indexOf(route.resolver);
    const executionIndex = source.indexOf(route.execution);

    assert.notEqual(resolverIndex, -1, `${route.file} should resolve the runtime Skill from tenant workspace state`);
    assert.notEqual(executionIndex, -1, `${route.file} should still execute its runtime operation`);
    assert.equal(resolverIndex < executionIndex, true, `${route.file} must resolve the Skill before execution`);
    for (const pattern of route.stalePatterns) {
      assert.doesNotMatch(source, pattern, `${route.file} must not require a full client Skill object`);
    }
  }
});

test("Harness route persists server run evidence before returning a runtime result", () => {
  const route = path.join(process.cwd(), "src/app/api/harness/run/route.ts");
  const source = readFileSync(route, "utf8");
  // Persistence now uses the atomic mutateWorkspace primitive (read-modify-write
  // under a per-tenant lock) instead of getWorkspace + saveWorkspace. The merge
  // happens INSIDE the mutator (against the freshest locked state), so the
  // ordering intent is preserved structurally: the run is merged within the
  // atomic persist, and the persist completes before responding.
  const mutateIndex = source.indexOf("repository.mutateWorkspace");
  const mergeIndex = source.indexOf("mergeServerHarnessResultIntoWorkspace({", mutateIndex);
  const traceIndex = source.indexOf("recordHarnessTrace(");
  const responseIndex = source.indexOf("return NextResponse.json({", mutateIndex);

  assert.notEqual(mutateIndex, -1, "Harness route should persist workspace run evidence atomically via mutateWorkspace");
  assert.notEqual(mergeIndex, -1, "Harness route should merge the server run into workspace state inside the atomic mutation");
  assert.notEqual(traceIndex, -1, "Harness route should still record durable trace evidence");
  assert.notEqual(responseIndex, -1, "Harness route should still return a runtime result");
  assert.equal(mutateIndex < mergeIndex, true, "Harness route should merge the run within the atomic workspace mutation");
  assert.equal(mergeIndex < responseIndex, true, "Harness route should merge + persist workspace evidence before responding");
});
