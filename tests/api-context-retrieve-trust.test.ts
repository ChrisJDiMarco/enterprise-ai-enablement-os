import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { contextRetrieveInputSchema } from "../src/lib/api-validation.ts";

test("context retrieval validation accepts skillId-only runtime requests", () => {
  const parsed = contextRetrieveInputSchema.safeParse({
    skillId: "skill-context-runtime",
    query: "Which policy sources answer PTO questions?",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.skillId, "skill-context-runtime");
  assert.deepEqual(parsed.data.sources, []);
});

test("context retrieval validation rejects requests without a runtime Skill reference", () => {
  const parsed = contextRetrieveInputSchema.safeParse({
    query: "Which sources are allowed?",
  });

  assert.equal(parsed.success, false);
});

test("context retrieval route resolves persisted Skill before reading context", () => {
  const route = path.join(process.cwd(), "src/app/api/context/retrieve/route.ts");
  const source = readFileSync(route, "utf8");
  const requestedSkillIndex = source.indexOf("const requestedSkillId = input.skillId ?? input.skill?.id");
  const resolverIndex = source.indexOf("resolveWorkspaceSkillForRuntime(workspace, requestedSkillId)");
  const retrievalIndex = source.indexOf("retrieveContextWithIndex({");

  assert.notEqual(requestedSkillIndex, -1, "context retrieval should compute a persisted Skill id from the request");
  assert.notEqual(resolverIndex, -1, "context retrieval should resolve the Skill from tenant workspace state");
  assert.notEqual(retrievalIndex, -1, "context retrieval should still execute retrieval");
  assert.equal(resolverIndex < retrievalIndex, true, "Skill resolution must happen before retrieval");
  assert.doesNotMatch(source, /resolveWorkspaceSkillForRuntime\(workspace,\s*input\.skill\.id\)/, "route must not require a full client Skill object");
});
