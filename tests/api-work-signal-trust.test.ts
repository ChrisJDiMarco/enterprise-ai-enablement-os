import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

test("work signal ingestion route resolves relationships before persisting tenant state", () => {
  const route = path.join(process.cwd(), "src/app/api/work-signals/route.ts");
  const source = readFileSync(route, "utf8");
  const resolverIndex = source.indexOf("resolveWorkSignalReferences({ workspace, signals: normalizedSignals })");
  const persistIndex = source.indexOf("commit: true");

  assert.notEqual(resolverIndex, -1, "work signal ingestion must validate relationships against workspace state");
  assert.notEqual(persistIndex, -1, "work signal ingestion must persist accepted signals");
  assert.equal(resolverIndex < persistIndex, true, "relationship resolution must happen before persisting work signals");
  assert.doesNotMatch(source, /workSignals:\s*normalizedSignals/, "route must not save raw normalized signals directly");
  // Persistence must flow through the atomic, lock-protected mutation primitive (no lost updates).
  assert.match(source, /repository\.mutateWorkspace/, "work signal ingestion must use the atomic workspace mutation primitive");
});

test("work signal list route uses bounded integer pagination metadata", () => {
  const route = path.join(process.cwd(), "src/app/api/work-signals/route.ts");
  const source = readFileSync(route, "utf8");

  assert.match(source, /boundedQueryLimit/, "work signal list limits must use the shared bounded query parser");
  assert.match(source, /hasMore/, "work signal list responses should disclose whether additional signals exist");
});
