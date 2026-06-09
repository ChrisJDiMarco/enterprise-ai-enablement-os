import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

test("work signal ingestion route resolves relationships before saving tenant state", () => {
  const route = path.join(process.cwd(), "src/app/api/work-signals/route.ts");
  const source = readFileSync(route, "utf8");
  const resolverIndex = source.indexOf("resolveWorkSignalReferences({ workspace, signals: normalizedSignals })");
  const saveIndex = source.indexOf("repository.saveWorkspace({");

  assert.notEqual(resolverIndex, -1, "work signal ingestion must validate relationships against workspace state");
  assert.notEqual(saveIndex, -1, "work signal ingestion must persist accepted signals");
  assert.equal(resolverIndex < saveIndex, true, "relationship resolution must happen before saving work signals");
  assert.doesNotMatch(source, /workSignals:\s*normalizedSignals/, "route must not save raw normalized signals directly");
});
