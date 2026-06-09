import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { workflowJobCreateInputSchema } from "../src/lib/api-validation.ts";

test("workflow job route resolves Skill ids from the persisted tenant workspace before enqueueing", () => {
  const route = path.join(process.cwd(), "src/app/api/workflows/jobs/route.ts");
  const source = readFileSync(route, "utf8");
  const resolverIndex = source.indexOf("resolveWorkspaceSkillForRuntime(workspace, input.skillId)");
  const enqueueIndex = source.indexOf("enqueueWorkflowJob({");

  assert.notEqual(resolverIndex, -1, "workflow jobs must validate Skill ids against server-held workspace state");
  assert.notEqual(enqueueIndex, -1, "workflow jobs must still enqueue through the job ledger");
  assert.equal(resolverIndex < enqueueIndex, true, "Skill resolution must happen before a job reaches the ledger");
  assert.match(source, /skillId,/, "workflow jobs must record the canonical resolved Skill id");
  assert.doesNotMatch(source, /skillId:\s*input\.skillId/, "workflow jobs must not record client-supplied Skill ids directly");
});

test("workflow job creation rejects unexpected top-level fields while preserving structured input payloads", () => {
  const accepted = workflowJobCreateInputSchema.safeParse({
    workflowId: "wf-customer-launch",
    skillId: "skill-launch",
    input: {
      approvalId: "approval-1",
      nested: { step: "collect-evidence", claims: ["roi", "risk"] },
    },
  });
  assert.equal(accepted.success, true);

  const rejected = workflowJobCreateInputSchema.safeParse({
    workflowId: "wf-customer-launch",
    skillId: "skill-launch",
    input: {},
    forgedPolicy: { trusted: true },
  });
  assert.equal(rejected.success, false);
});
