import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultOrganizationSettings,
  normalizeOrganizationSettings,
  normalizeWorkspace,
  normalizeWorkspaceMode,
  emptyWorkspace,
} from "../src/lib/workspace-schema.ts";
import type { WorkSignal } from "../src/lib/enterprise-ai-data.ts";

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
  assert.equal(normalizeOrganizationSettings({ logoUrl: "/brand/logo.svg" }, "t").logoUrl, "/brand/logo.svg");
});

test("normalizeOrganizationSettings: rejects unsafe logo references", () => {
  assert.equal(normalizeOrganizationSettings({ logoUrl: "javascript:alert(1)" }, "t").logoUrl, undefined);
  assert.equal(normalizeOrganizationSettings({ logoUrl: "data:image/svg+xml,<svg/>" }, "t").logoUrl, undefined);
  assert.equal(normalizeOrganizationSettings({ logoUrl: "http://example.com/logo.png" }, "t").logoUrl, undefined);
  assert.equal(normalizeOrganizationSettings({ logoUrl: "//example.com/logo.png" }, "t").logoUrl, undefined);
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

test("normalizeWorkspace: treats the provided organization id as authoritative", () => {
  const ws = normalizeWorkspace(
    {
      organizationId: "attacker-tenant",
      organization: {
        id: "attacker-tenant",
        name: "Imported Tenant",
        slug: "imported-tenant",
        workspaceLabel: "Imported OS",
        primaryColor: "#000000",
        updatedAt: "2026-06-19T00:00:00.000Z",
      },
    },
    "trusted-tenant",
  );

  assert.equal(ws.organizationId, "trusted-tenant");
  assert.equal(ws.organization.id, "trusted-tenant");
});

test("normalizeWorkspace: redacts provider secrets from imported AI settings", () => {
  const ws = normalizeWorkspace(
    {
      aiSettings: {
        openaiKey: "sk-live-sensitive1234567890",
        anthropicKey: "anthropic-secret",
        googleKey: "google-secret",
        azureEndpoint: "https://sensitive-resource.openai.azure.com",
        azureKey: "azure-secret",
        kimiKey: "kimi-secret",
        glmKey: "glm-secret",
        deepseekKey: "deepseek-secret",
        openrouterKey: "openrouter-secret",
        defaultProvider: "anthropic",
        defaultModel: "anthropic/claude-governance",
        monthlyBudgetUsd: 2400,
      },
    },
    "acme",
  );
  const serialized = JSON.stringify(ws);

  assert.equal(ws.aiSettings?.openaiKey, "");
  assert.equal(ws.aiSettings?.anthropicKey, "");
  assert.equal(ws.aiSettings?.azureEndpoint, "");
  assert.equal(ws.aiSettings?.defaultProvider, "anthropic");
  assert.equal(ws.aiSettings?.defaultModel, "anthropic/claude-governance");
  assert.equal(ws.aiSettings?.monthlyBudgetUsd, 2400);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("sensitive-resource"), false);
  assert.equal(serialized.includes("openrouter-secret"), false);
});

test("normalizeWorkspace: canonicalizes and redacts imported work signals", () => {
  const importedSignal = {
    id: "ws-imported",
    source: "email",
    eventType: "question_asked",
    department: "HR",
    process: "Benefits inbox for jane.employee@example.com",
    summary:
      "Raw prompt copied from email: Jane Employee called 212-555-0101 and pasted api_key=sk-live-sensitive1234567890.",
    metadata: {
      volume: 10,
      confidence: 0.85,
      relatedContextSource: "Benefits Guide jane.employee@example.com",
      system: "transcript=Jane Employee asked about dependent coverage",
      unsafeExtra: "rawContent=full employee message",
    },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 90,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2026-06-19T00:00:00.000Z",
    rawPrompt: "Jane Employee asked about dependent coverage.",
  } as WorkSignal & { rawPrompt: string; metadata: WorkSignal["metadata"] & { unsafeExtra: string } };

  const ws = normalizeWorkspace({ workSignals: [importedSignal] }, "acme");
  const signal = ws.workSignals[0] as WorkSignal & { rawPrompt?: string };
  const serialized = JSON.stringify(ws.workSignals);

  assert.equal(ws.workSignals.length, 1);
  assert.equal("rawPrompt" in signal, false);
  assert.equal("unsafeExtra" in signal.metadata, false);
  assert.equal(serialized.includes("jane.employee@example.com"), false);
  assert.equal(serialized.includes("212-555-0101"), false);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("full employee message"), false);
  assert.match(signal.summary, /\[redacted\]/);
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
