import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkspaceDocumentTitle } from "../src/lib/ui/page-title.ts";

test("buildWorkspaceDocumentTitle includes surface, workspace, and app context", () => {
  assert.equal(
    buildWorkspaceDocumentTitle({
      surface: "AI Harness",
      organizationName: "Enterprise AI",
    }),
    "AI Harness · Enterprise AI · Enterprise AI Enablement OS",
  );
});

test("buildWorkspaceDocumentTitle normalizes whitespace and omits empty title parts", () => {
  assert.equal(
    buildWorkspaceDocumentTitle({
      surface: "  Proof   Ledger  ",
      organizationName: " ",
    }),
    "Proof Ledger · Enterprise AI Enablement OS",
  );
});

test("buildWorkspaceDocumentTitle deduplicates repeated title parts", () => {
  assert.equal(
    buildWorkspaceDocumentTitle({
      surface: "Enterprise AI Enablement OS",
      organizationName: "enterprise ai enablement os",
    }),
    "Enterprise AI Enablement OS",
  );
});

test("buildWorkspaceDocumentTitle truncates noisy workspace labels", () => {
  const title = buildWorkspaceDocumentTitle({
    surface: "Reports",
    organizationName: "A".repeat(120),
    appName: "Enablement OS",
  });

  assert.equal(title, `Reports · ${"A".repeat(79)}... · Enablement OS`);
});
