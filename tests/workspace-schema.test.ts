import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultOrganizationSettings,
  normalizeOrganizationSettings,
  normalizeWorkspace,
  normalizeWorkspaceMode,
  emptyWorkspace,
} from "../src/lib/workspace-schema.ts";

test("defaultOrganizationSettings: applies the requested id and brand default", () => {
  const org = defaultOrganizationSettings("acme");
  assert.equal(org.id, "acme");
  assert.equal(org.primaryColor, "#635bff");
  assert.ok(org.name.length > 0);
});

test("normalizeOrganizationSettings: forces the id and a valid hex", () => {
  const org = normalizeOrganizationSettings({ primaryColor: "purple" }, "tenant-7");
  assert.equal(org.id, "tenant-7");
  assert.equal(org.primaryColor, "#635bff");
});

test("normalizeOrganizationSettings: keeps a valid hex color", () => {
  const org = normalizeOrganizationSettings({ primaryColor: "#3b5bdb" }, "t");
  assert.equal(org.primaryColor, "#3b5bdb");
});

test("normalizeOrganizationSettings: derives a slug from the name when missing", () => {
  const org = normalizeOrganizationSettings({ name: "Northwind Group!" }, "t");
  assert.equal(org.slug, "northwind-group");
});

test("normalizeOrganizationSettings: trims and caps an overlong name", () => {
  const long = "x".repeat(200);
  const org = normalizeOrganizationSettings({ name: `  ${long}  ` }, "t");
  assert.equal(org.name.length, 120);
});

test("normalizeOrganizationSettings: drops a blank logo, keeps a real one", () => {
  assert.equal(normalizeOrganizationSettings({ logoUrl: "   " }, "t").logoUrl, undefined);
  assert.equal(
    normalizeOrganizationSettings({ logoUrl: "https://cdn.example.com/logo.png" }, "t").logoUrl,
    "https://cdn.example.com/logo.png",
  );
});

test("emptyWorkspace: produces a versioned, empty workspace", () => {
  const ws = emptyWorkspace("acme");
  assert.equal(ws.schema, "enterprise-ai-enablement-os.workspace.v1");
  assert.equal(ws.organizationId, "acme");
  assert.equal(ws.workspaceMode, "production");
  assert.deepEqual(ws.useCases, []);
  assert.deepEqual(ws.skills, []);
  assert.deepEqual(ws.runs, []);
  assert.deepEqual(ws.commandOrders, []);
  assert.equal(ws.workflow.status, "Saved");
  assert.equal(ws.report, "");
});

test("normalizeWorkspaceMode: only demo opts into demo sandbox", () => {
  assert.equal(normalizeWorkspaceMode("demo"), "demo");
  assert.equal(normalizeWorkspaceMode("production"), "production");
  assert.equal(normalizeWorkspaceMode("anything-else"), "production");
});

test("normalizeWorkspace: preserves explicit demo mode and defaults to production", () => {
  assert.equal(normalizeWorkspace({ workspaceMode: "demo" }, "acme").workspaceMode, "demo");
  assert.equal(normalizeWorkspace({}, "acme").workspaceMode, "production");
});

test("normalizeWorkspace: preserves valid command orders and drops invalid rows", () => {
  const ws = normalizeWorkspace(
    {
      commandOrders: [
        { id: "invalid", title: "No view" },
        {
          id: "command-one",
          title: "Open evidence ledger",
          why: "The proof chain needs an owner.",
          evidenceNeeded: "Ledger item with exportable evidence.",
          targetView: "evidence",
          status: "open",
          priority: "high",
          source: "command_system",
          owner: "AI Enablement Director",
          dueDate: "2026-06-02",
          confidence: 89,
          createdAt: "2026-05-29T12:00:00.000Z",
          updatedAt: "2026-05-29T12:00:00.000Z",
        },
      ] as ReturnType<typeof emptyWorkspace>["commandOrders"],
    },
    "acme",
  );

  assert.equal(ws.commandOrders.length, 1);
  assert.equal(ws.commandOrders[0].id, "command-one");
});
