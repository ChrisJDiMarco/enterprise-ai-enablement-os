import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

test("context index route resolves document sources before upserting indexed content", () => {
  const route = path.join(process.cwd(), "src/app/api/context/index/route.ts");
  const source = readFileSync(route, "utf8");
  const resolverIndex = source.indexOf("resolveContextIndexDocumentSources({");
  const upsertIndex = source.indexOf("upsertContextIndexDocuments(");

  assert.notEqual(resolverIndex, -1, "context index route must resolve document sources against workspace catalog");
  assert.notEqual(upsertIndex, -1, "context index route must still upsert accepted documents");
  assert.equal(resolverIndex < upsertIndex, true, "source resolution must happen before context documents are indexed");
  assert.match(source, /upsertContextIndexDocuments\([\s\S]*sourceResolution\.documents/, "route must index canonicalized documents");
  assert.doesNotMatch(source, /upsertContextIndexDocuments\([^,]+,\s*parsed\.data\.documents/, "route must not index caller source records directly");
});
