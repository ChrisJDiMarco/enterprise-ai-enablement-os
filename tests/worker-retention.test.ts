import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pruneConnectorEvents,
  pruneEvalArtifacts,
  pruneRunTraces,
  pruneTerminalWorkflowJobs,
  retentionDaysFromEnv,
} from "../src/lib/worker-runtime.ts";

type Call = { text: string; params: unknown[] };
function recordingPool(rowCount = 3) {
  const calls: Call[] = [];
  const pool = {
    query: async (text: string, params: unknown[]) => {
      calls.push({ text, params });
      return { rowCount };
    },
  } as unknown as Parameters<typeof pruneRunTraces>[0];
  return { pool, calls };
}

test("retentionDaysFromEnv parses positive values and falls back otherwise", () => {
  assert.equal(retentionDaysFromEnv({}, "K", 90), 90);
  assert.equal(retentionDaysFromEnv({ K: "" }, "K", 90), 90);
  assert.equal(retentionDaysFromEnv({ K: "30" }, "K", 90), 30);
  assert.equal(retentionDaysFromEnv({ K: "0" }, "K", 90), 0);
  assert.equal(retentionDaysFromEnv({ K: "-5" }, "K", 90), 90);
  assert.equal(retentionDaysFromEnv({ K: "abc" }, "K", 90), 90);
});

test("prunes are a no-op when retention is 0 (keep forever)", async () => {
  const { pool, calls } = recordingPool();
  assert.equal(await pruneRunTraces(pool, 0), 0);
  assert.equal(await pruneEvalArtifacts(pool, 0), 0);
  assert.equal(await pruneConnectorEvents(pool, 0), 0);
  assert.equal(await pruneTerminalWorkflowJobs(pool, 0), 0);
  assert.equal(calls.length, 0);
});

test("run-trace prune deletes by age and returns the row count", async () => {
  const { pool, calls } = recordingPool(7);
  assert.equal(await pruneRunTraces(pool, 90), 7);
  assert.match(calls[0]!.text, /delete from run_traces/);
  assert.deepEqual(calls[0]!.params, [90]);
});

test("workflow-job prune only targets terminal states", async () => {
  const { pool, calls } = recordingPool(2);
  assert.equal(await pruneTerminalWorkflowJobs(pool, 30), 2);
  assert.match(calls[0]!.text, /status in \('completed', 'failed', 'blocked'\)/);
  assert.match(calls[0]!.text, /updated_at < now\(\)/);
  assert.deepEqual(calls[0]!.params, [30]);
});
