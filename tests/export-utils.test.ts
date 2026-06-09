import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyTextOrDownload,
  filenameFromContentDisposition,
  safeExportFilename,
  timestampedExportFilename,
} from "../src/lib/ui/export-utils.ts";

test("safeExportFilename: creates filesystem-safe slugs", () => {
  assert.equal(safeExportFilename("Northwind Group — Workspace Export.json"), "northwind-group-workspace-export-json");
  assert.equal(safeExportFilename("   "), "enterprise-ai-export");
  assert.equal(safeExportFilename("../../secrets"), "secrets");
});

test("timestampedExportFilename: adds a stable ISO timestamp and extension", () => {
  const filename = timestampedExportFilename(
    "Evidence Packet",
    ".json",
    new Date("2026-05-29T14:30:45.123Z"),
  );

  assert.equal(filename, "evidence-packet-2026-05-29T14-30-45-123Z.json");
});

test("filenameFromContentDisposition: prefers safe server download filenames", () => {
  assert.equal(
    filenameFromContentDisposition('attachment; filename="Acme Enterprise AI Control Plane.md"', "fallback.md"),
    "acme-enterprise-ai-control-plane.md",
  );
  assert.equal(
    filenameFromContentDisposition("attachment; filename*=UTF-8''Northwind%20Launch%20Packet.md", "fallback.md"),
    "northwind-launch-packet.md",
  );
  assert.equal(
    filenameFromContentDisposition('attachment; filename="../../secret.txt"', "fallback.md"),
    "secret.txt",
  );
  assert.equal(
    filenameFromContentDisposition("attachment; filename*=UTF-8''%E0%A4%A", "fallback.md"),
    "fallback.md",
  );
  assert.equal(filenameFromContentDisposition(null, "fallback.md"), "fallback.md");
});

test("copyTextOrDownload: returns empty status before touching browser APIs", async () => {
  const result = await copyTextOrDownload({
    contents: "   ",
    copiedMessage: "copied",
    fallbackFilename: "empty.txt",
    emptyMessage: "empty export",
  });

  assert.deepEqual(result, { status: "empty", message: "empty export" });
});
