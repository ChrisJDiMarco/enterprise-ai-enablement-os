import test from "node:test";
import assert from "node:assert/strict";

import { defaultAISettings } from "../src/lib/model-router.ts";
import { buildWorkspaceExportPayload } from "../src/lib/workspace-export.ts";

test("buildWorkspaceExportPayload redacts provider secrets and Azure endpoints", () => {
  const payload = buildWorkspaceExportPayload(
    {
      schema: "enterprise-ai-enablement-os.workspace.v1",
      organizationId: "acme",
      aiSettings: {
        ...defaultAISettings,
        openaiKey: "sk-live-sensitive",
        openaiBaseUrl: "https://tenant-gateway.example.com/openai",
        anthropicKey: "anthropic-sensitive",
        anthropicBaseUrl: "https://tenant-gateway.example.com/anthropic",
        azureEndpoint: "https://tenant-sensitive.openai.azure.com",
        azureKey: "azure-sensitive",
        openrouterKey: "openrouter-sensitive",
        openrouterBaseUrl: "https://tenant-gateway.example.com/openrouter",
        defaultProvider: "azure_openai",
        defaultModel: "azure_openai/gpt-5.5",
        monthlyBudgetUsd: 4200,
      },
    },
    "2026-06-19T12:00:00.000Z",
  );
  const serialized = JSON.stringify(payload);

  assert.equal(payload.exportedAt, "2026-06-19T12:00:00.000Z");
  assert.equal(payload.aiSettings.openaiKey, "");
  assert.equal(payload.aiSettings.anthropicKey, "");
  assert.equal(payload.aiSettings.azureEndpoint, "");
  assert.equal(payload.aiSettings.azureKey, "");
  assert.equal(payload.aiSettings.openrouterKey, "");
  assert.equal(payload.aiSettings.openaiBaseUrl, defaultAISettings.openaiBaseUrl);
  assert.equal(payload.aiSettings.anthropicBaseUrl, defaultAISettings.anthropicBaseUrl);
  assert.equal(payload.aiSettings.openrouterBaseUrl, defaultAISettings.openrouterBaseUrl);
  assert.equal(payload.aiSettings.defaultProvider, "azure_openai");
  assert.equal(payload.aiSettings.defaultModel, "azure_openai/gpt-5.5");
  assert.equal(payload.aiSettings.monthlyBudgetUsd, 4200);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("tenant-sensitive"), false);
  assert.equal(serialized.includes("tenant-gateway"), false);
  assert.equal(serialized.includes("openrouter-sensitive"), false);
});

test("buildWorkspaceExportPayload preserves control-plane records from the canonical snapshot", () => {
  const payload = buildWorkspaceExportPayload(
    {
      aiSettings: defaultAISettings,
      runtimeAdapters: [{ id: "adapter-langfuse" }],
      runtimeImportJobs: [{ id: "runtime-import-langfuse" }],
      normalizedRuntimeAssets: [{ id: "asset-trace" }],
      installedLaunchPacks: [{ id: "installed-pack" }],
      reportSchedules: [{ id: "schedule-digest" }],
      runtimeImportAudits: [{ id: "runtime-audit" }],
    },
    "2026-06-19T12:00:00.000Z",
  );

  assert.deepEqual(payload.runtimeAdapters, [{ id: "adapter-langfuse" }]);
  assert.deepEqual(payload.runtimeImportJobs, [{ id: "runtime-import-langfuse" }]);
  assert.deepEqual(payload.normalizedRuntimeAssets, [{ id: "asset-trace" }]);
  assert.deepEqual(payload.installedLaunchPacks, [{ id: "installed-pack" }]);
  assert.deepEqual(payload.reportSchedules, [{ id: "schedule-digest" }]);
  assert.deepEqual(payload.runtimeImportAudits, [{ id: "runtime-audit" }]);
});

test("buildWorkspaceExportPayload redacts nested secrets and raw connector material outside aiSettings", () => {
  const payload = buildWorkspaceExportPayload(
    {
      aiSettings: defaultAISettings,
      skills: [
        {
          id: "skill-safe",
          name: "Safe Skill",
          systemPrompt: "Use approved policy context only.",
        },
      ],
      runtimeAdapters: [
        {
          id: "adapter-langsmith",
          manifestId: "langsmith",
          status: "tested",
          apiKey: "sk-live-sensitive1234567890",
          authorizationHeader: "Bearer secretbearertoken1234567890",
        },
      ],
      runtimeImportJobs: [
        {
          id: "runtime-import-langsmith",
          message: "Imported source from https://hooks.slack.com/services/T00000000/B00000000/secretsecretsecret",
          payload: {
            useCaseId: "uc-safe",
            sourceUrl: "postgres://user:pass@example.com:5432/app",
            nested: {
              accessToken: "ghp_sensitive1234567890abcdef",
            },
          },
          rawPayload: {
            prompt: "summarize payroll-plan.txt",
          },
        },
      ],
      workflow: {
        status: "Saved",
        nodes: [
          {
            id: "node-1",
            data: {
              label: "Draft brief",
              systemPrompt: "Use approved context only. api_key=sk-live-sensitive1234567890",
            },
          },
        ],
        edges: [],
      },
    },
    "2026-06-19T12:00:00.000Z",
  );

  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("secretbearertoken"), false);
  assert.equal(serialized.includes("hooks.slack.com/services"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("ghp_sensitive"), false);
  assert.equal(serialized.includes("summarize payroll-plan"), false);
  assert.match(serialized, /\[redacted\]/);
  assert.equal(payload.skills[0]?.systemPrompt, "Use approved policy context only.");
  assert.equal(payload.runtimeImportJobs[0]?.payload.useCaseId, "uc-safe");
  assert.equal(payload.runtimeImportJobs[0]?.payload.sourceUrl, "[redacted]");
  assert.equal(payload.workflow.nodes[0]?.data.label, "Draft brief");
  assert.match(String(payload.workflow.nodes[0]?.data.systemPrompt), /api_key=\[redacted\]/);
});
