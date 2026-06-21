import test from "node:test";
import assert from "node:assert/strict";

import type { Skill, UseCase } from "../src/lib/enterprise-ai-data.ts";
import { defaultAISettings } from "../src/lib/model-router.ts";
import { parseWorkspaceImport, resolveWorkspaceClientState } from "../src/lib/workspace-client.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-real",
    title: "Customer Support Knowledge Triage",
    description: "Routes support knowledge gaps into governed AI opportunities.",
    department: "Operations",
    requestorId: "user-1",
    ownerId: "user-1",
    businessProblem: "Manual routing slows down support knowledge improvements.",
    currentProcess: "Teams review support gaps manually.",
    desiredOutcome: "Prioritize knowledge gaps with governed AI assistance.",
    monthlyVolume: 100,
    avgHandlingTimeMinutes: 10,
    estimatedUsers: 25,
    capabilityType: "knowledge_assistant",
    status: "scored",
    riskLevel: "low",
    valueScore: 3,
    feasibilityScore: 4,
    riskScore: 1,
    reuseScore: 4,
    urgencyScore: 3,
    dataReadinessScore: 3,
    priorityScore: 68,
    expectedBenefits: ["hours_saved"],
    dataSources: ["Approved support KB"],
    risks: ["Source freshness"],
    createdAt: "May 30, 2026",
    updatedAt: "May 30, 2026",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-real",
    useCaseId: "uc-real",
    name: "Support Knowledge Triage Skill",
    slug: "support-knowledge-triage",
    description: "Prioritizes support knowledge gaps.",
    department: "Operations",
    ownerId: "user-1",
    status: "draft",
    version: "0.1.0",
    riskLevel: "low",
    autonomyTier: "tier_1_read_only",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 1200,
    fallbackModel: "local-enterprise-reasoner",
    costLimit: 0.1,
    systemPrompt: "Use approved sources only.",
    allowedTools: [],
    blockedTools: [],
    contextSources: [],
    evalPassRate: 0,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: "May 30, 2026",
    ...overrides,
  };
}

test("parseWorkspaceImport rejects invalid JSON and incomplete payloads", () => {
  const params = { currentOrganizationId: "acme", currentAISettings: defaultAISettings };

  assert.deepEqual(parseWorkspaceImport("{not-json", params), {
    ok: false,
    message: "Import failed: invalid JSON",
  });
  assert.deepEqual(parseWorkspaceImport(JSON.stringify({ useCases: [] }), params), {
    ok: false,
    message: "Import failed: missing use cases or Skills",
  });
});

test("parseWorkspaceImport scrubs demo tenant content from production imports", () => {
  const result = parseWorkspaceImport(
    JSON.stringify({
      workspaceMode: "production",
      organizationId: "northwind-demo",
      organization: { name: "Northwind Group", workspaceLabel: "AI Enablement OS" },
      useCases: [
        useCase({ id: "uc-demo-phrase", title: "Northwind Group HR Policy Copilot" }),
        useCase({ id: "uc-real", title: "Customer Support Knowledge Triage" }),
      ],
      skills: [
        skill({ id: "skill-demo-phrase", name: "HR Policy Copilot" }),
        skill({ id: "skill-real", name: "Support Knowledge Triage Skill" }),
      ],
      report: "# Northwind Group demo report",
    }),
    { currentOrganizationId: "acme", currentAISettings: defaultAISettings },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.imported.organization.id, "acme");
  assert.equal(result.imported.organization.name, "Enterprise AI");
  assert.deepEqual(result.imported.useCases.map((item) => item.id), ["uc-real"]);
  assert.deepEqual(result.imported.skills.map((item) => item.id), ["skill-real"]);
  assert.equal(result.imported.report, "");
  assert.equal(result.imported.selectedUseCaseId, "uc-real");
  assert.equal(result.imported.selectedSkillId, "skill-real");
});

test("parseWorkspaceImport redacts current and imported provider secrets", () => {
  const currentAISettings = {
    ...defaultAISettings,
    openaiKey: "existing-openai-key",
    googleKey: "existing-google-key",
  };
  const result = parseWorkspaceImport(
    JSON.stringify({
      workspaceMode: "production",
      useCases: [useCase()],
      skills: [skill()],
      aiSettings: {
        ...defaultAISettings,
        openaiKey: "[redacted]",
        googleKey: "",
        kimiKey: "new-kimi-key",
        defaultProvider: "kimi",
      },
    }),
    { currentOrganizationId: "acme", currentAISettings },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.imported.aiSettings.openaiKey, "");
  assert.equal(result.imported.aiSettings.googleKey, "");
  assert.equal(result.imported.aiSettings.kimiKey, "");
  assert.equal(result.imported.aiSettings.defaultProvider, "kimi");
  assert.equal(JSON.stringify(result.imported.aiSettings).includes("existing-openai-key"), false);
  assert.equal(JSON.stringify(result.imported.aiSettings).includes("new-kimi-key"), false);
});

test("resolveWorkspaceClientState redacts stale local and workspace provider secrets", () => {
  const resolved = resolveWorkspaceClientState(
    {
      workspaceMode: "production",
      useCases: [],
      skills: [],
      aiSettings: {
        openaiKey: "workspace-openai-key",
        anthropicKey: "workspace-anthropic-key",
        azureEndpoint: "https://sensitive-resource.openai.azure.com",
        azureKey: "workspace-azure-key",
        defaultProvider: "anthropic",
      },
    },
    {
      ...defaultAISettings,
      googleKey: "legacy-google-key",
      openrouterKey: "legacy-openrouter-key",
    },
    "production",
  );
  const serialized = JSON.stringify(resolved.aiSettings);

  assert.equal(resolved.aiSettings.openaiKey, "");
  assert.equal(resolved.aiSettings.anthropicKey, "");
  assert.equal(resolved.aiSettings.azureEndpoint, "");
  assert.equal(resolved.aiSettings.googleKey, "");
  assert.equal(resolved.aiSettings.openrouterKey, "");
  assert.equal(resolved.aiSettings.defaultProvider, "anthropic");
  assert.equal(serialized.includes("workspace-openai-key"), false);
  assert.equal(serialized.includes("legacy-openrouter-key"), false);
  assert.equal(serialized.includes("sensitive-resource"), false);
});

test("parseWorkspaceImport restores runtime control-plane records", () => {
  const result = parseWorkspaceImport(
    JSON.stringify({
      workspaceMode: "production",
      useCases: [useCase()],
      skills: [skill()],
      runtimeAdapters: [
        {
          id: "adapter-langfuse",
          manifestId: "langfuse",
          name: "Langfuse",
          status: "active",
          coverage: 86,
          configuredFields: ["LANGFUSE_BASE_URL", "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"],
          proofIds: ["proof-adapter"],
          createdAt: "2026-06-18T10:00:00.000Z",
          updatedAt: "2026-06-18T10:05:00.000Z",
        },
      ],
      runtimeImportJobs: [
        {
          id: "runtime-import-langfuse",
          adapterId: "adapter-langfuse",
          manifestId: "langfuse",
          status: "committed",
          step: "commit",
          discovered: { assets: 1, traces: 24, evals: 6, toolCalls: 0, prompts: 9, costs: 12, owners: 3, proofIds: 4 },
          previewAssetIds: ["asset-trace"],
          committedAssetIds: ["asset-trace"],
          message: "Imported Langfuse runtime assets.",
          proofIds: ["proof-import"],
          createdAt: "2026-06-18T10:00:00.000Z",
          updatedAt: "2026-06-18T10:05:00.000Z",
        },
      ],
      normalizedRuntimeAssets: [
        {
          id: "asset-trace",
          adapterId: "adapter-langfuse",
          manifestId: "langfuse",
          sourceType: "trace",
          sourceId: "trace-1",
          name: "Benefits trace",
          owner: "AI Platform",
          status: "mapped",
          riskLevel: "medium",
          metrics: { traces: 24, evals: 6, toolCalls: 0, prompts: 9, monthlyCostUsd: 120 },
          mappedFields: ["trace.id", "score.value"],
          missingMappings: [],
          evidenceGaps: [],
          proofIds: ["proof-trace"],
          importedAt: "2026-06-18T10:05:00.000Z",
        },
      ],
      installedLaunchPacks: [
        {
          id: "installed-pack-first_90_days_ai_office",
          templateId: "first_90_days_ai_office",
          title: "First 90 Days AI Enablement Office",
          status: "installed",
          createdObjects: {
            useCases: ["uc-real"],
            controls: ["control-intake"],
            reportScheduleIds: ["schedule-digest"],
            evalSuites: ["eval-suite"],
            checklistItems: ["Launch weekly governance review"],
          },
          proofIds: ["proof-pack"],
          installedAt: "2026-06-18T10:10:00.000Z",
        },
      ],
      reportSchedules: [
        {
          id: "schedule-digest",
          title: "Daily operator digest",
          cadence: "daily",
          audience: "AI enablement office",
          templateId: "daily_ai_enablement_digest",
          deliveryTargets: [{ type: "in_app", target: "In-app inbox", status: "ready" }],
          status: "active",
          nextRunAt: "2026-06-19T09:00:00.000Z",
          proofIds: ["proof-schedule"],
          createdAt: "2026-06-18T10:10:00.000Z",
          updatedAt: "2026-06-18T10:10:00.000Z",
        },
      ],
      runtimeImportAudits: [
        {
          id: "runtime-audit-import",
          action: "runtime_import_committed",
          targetId: "runtime-import-langfuse",
          message: "Runtime import committed.",
          actor: "Enablement OS",
          riskLevel: "medium",
          proofId: "proof-import",
          createdAt: "2026-06-18T10:05:00.000Z",
        },
      ],
    }),
    { currentOrganizationId: "acme", currentAISettings: defaultAISettings },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.imported.runtimeAdapters[0]?.id, "adapter-langfuse");
  assert.equal(result.imported.runtimeImportJobs[0]?.status, "committed");
  assert.equal(result.imported.normalizedRuntimeAssets[0]?.sourceId, "trace-1");
  assert.equal(result.imported.installedLaunchPacks[0]?.templateId, "first_90_days_ai_office");
  assert.equal(result.imported.reportSchedules[0]?.id, "schedule-digest");
  assert.equal(result.imported.runtimeImportAudits[0]?.proofId, "proof-import");
});

test("parseWorkspaceImport does not inject default runtime or audit records into minimal packets", () => {
  const result = parseWorkspaceImport(
    JSON.stringify({
      schema: "enterprise-ai-enablement-os.workspace.v1",
      workspaceMode: "production",
      organizationId: "customer-tenant",
      organization: { name: "Customer Tenant", workspaceLabel: "AI OS" },
      useCases: [useCase()],
      skills: [skill()],
    }),
    { currentOrganizationId: "acme", currentAISettings: defaultAISettings },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.imported.organization.id, "acme");
  assert.deepEqual(result.imported.runs, []);
  assert.deepEqual(result.imported.auditLogs, []);
  assert.deepEqual(result.imported.toolRequests, []);
  assert.deepEqual(result.imported.governanceReviews, []);
  assert.deepEqual(result.imported.evalResults, []);
});
