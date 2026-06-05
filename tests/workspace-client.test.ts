import test from "node:test";
import assert from "node:assert/strict";

import type { Skill, UseCase } from "../src/lib/enterprise-ai-data.ts";
import { defaultAISettings } from "../src/lib/model-router.ts";
import { parseWorkspaceImport } from "../src/lib/workspace-client.ts";

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

test("parseWorkspaceImport preserves redacted current provider keys while accepting new secrets", () => {
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
  assert.equal(result.imported.aiSettings.openaiKey, "existing-openai-key");
  assert.equal(result.imported.aiSettings.googleKey, "");
  assert.equal(result.imported.aiSettings.kimiKey, "new-kimi-key");
  assert.equal(result.imported.aiSettings.defaultProvider, "kimi");
});
