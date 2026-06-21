import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { getWorkspaceRepository } from "../src/lib/database.ts";
import { tenantScopedJsonPath } from "../src/lib/tenant-file-storage.ts";
import type { Tool } from "../src/lib/enterprise-ai-data.ts";

function dataPath(kind: "workspaces" | "audit", organizationId: string) {
  return tenantScopedJsonPath(path.join(process.cwd(), ".data", kind), organizationId);
}

async function cleanup(organizationId: string) {
  await rm(dataPath("workspaces", organizationId), { force: true });
  await rm(dataPath("audit", organizationId), { force: true });
}

test("mutateWorkspace serializes concurrent edits without losing updates (file mode)", async () => {
  delete process.env.DATABASE_URL;
  const organizationId = `concurrency-test-${process.pid}`;
  const repository = getWorkspaceRepository();
  assert.equal(repository.mode, "file", "test must exercise the in-process file repository");

  await cleanup(organizationId);

  const edits = 25;
  // Fire every edit concurrently. With a naive getWorkspace + saveWorkspace each
  // would read the same empty base and the last write would win (lost update).
  await Promise.all(
    Array.from({ length: edits }, (_, index) =>
      repository.mutateWorkspace(organizationId, (workspace) => ({
        commit: true as const,
        workspace: {
          ...workspace,
          organizationId,
          tools: [...workspace.tools, { id: `tool-${index}` } as Tool],
        },
        result: index,
      })),
    ),
  );

  const finalWorkspace = await repository.getWorkspace(organizationId);
  const toolIds = new Set(finalWorkspace.tools.map((tool) => tool.id));
  assert.equal(finalWorkspace.tools.length, edits, "every concurrent edit must survive");
  for (let index = 0; index < edits; index += 1) {
    assert.ok(toolIds.has(`tool-${index}`), `lost update: tool-${index} is missing`);
  }

  await cleanup(organizationId);
});

test("mutateWorkspace with commit:false leaves storage untouched", async () => {
  delete process.env.DATABASE_URL;
  const organizationId = `concurrency-noop-${process.pid}`;
  const repository = getWorkspaceRepository();
  await cleanup(organizationId);

  const outcome = await repository.mutateWorkspace(organizationId, () => ({
    commit: false as const,
    result: "rejected",
  }));

  assert.equal(outcome.committed, false);
  assert.equal(outcome.result, "rejected");
  assert.equal(outcome.workspace.tools.length, 0);

  await cleanup(organizationId);
});
