import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contextSourceStaleAfterDaysFromEnv,
  deriveContextReadinessSummary,
  getContextIndexStats,
  retrieveContextWithIndex,
  upsertContextIndexDocuments,
} from "../src/lib/context-index.ts";
import type { ContextSource, Skill } from "../src/lib/enterprise-ai-data.ts";

const skill: Skill = {
  id: "skill-context-test",
  name: "Context Test Skill",
  slug: "context-test-skill",
  description: "Retrieves approved source content.",
  department: "HR",
  ownerId: "user-1",
  status: "draft",
  version: "1.0.0",
  riskLevel: "low",
  autonomyTier: "tier_1_read_only",
  modelProvider: "local",
  model: "local-enterprise-reasoner",
  temperature: 0.2,
  maxTokens: 1000,
  fallbackModel: "local",
  costLimit: 0.1,
  systemPrompt: "Answer using approved sources only.",
  allowedTools: [],
  blockedTools: [],
  contextSources: ["source-hr-policy"],
  evalPassRate: 0,
  adoptionCount: 0,
  valueDelivered: 0,
  runs: 0,
  updatedAt: "2026-05-29",
};

const source: ContextSource = {
  id: "source-hr-policy",
  name: "HR Policy Manual",
  type: "sharepoint",
  classification: "internal",
  ownerDepartment: "HR",
  enabled: true,
  lastIndexedAt: "2026-05-29",
  documentCount: 1,
  skillsUsing: 1,
  health: "healthy",
};

test("context index stores documents and retrieval merges indexed snippets with policy filtering", async () => {
  const organizationId = `org-context-${Date.now()}`;
  await upsertContextIndexDocuments(organizationId, [
    {
      id: "doc-pto",
      sourceId: source.id,
      sourceName: source.name,
      title: "Paid Time Off",
      content: "Employees with three years of service accrue fifteen PTO days and may carry over five unused days.",
      classification: "internal",
      ownerDepartment: "HR",
    },
  ]);

  const stats = await getContextIndexStats(organizationId);
  const retrieval = await retrieveContextWithIndex({
    organizationId,
    skill,
    sources: [source],
    query: "three years PTO carry over",
  });

  assert.equal(stats.totalDocuments, 1);
  assert.equal(retrieval.indexedResults.length, 1);
  assert.match(retrieval.results[0]?.snippet ?? "", /Paid Time Off/);
});

test("deriveContextReadinessSummary combines index stats with source health", () => {
  const summary = deriveContextReadinessSummary({
    now: "2026-06-02T00:00:00.000Z",
    staleAfterDays: 14,
    stats: {
      totalDocuments: 2,
      sources: [
        {
          sourceId: "source-hr-policy",
          sourceName: "HR Policy Manual",
          documents: 2,
          classification: "internal",
          lastUpdatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    },
    sources: [
      source,
      {
        ...source,
        id: "source-legal",
        name: "Legal Repository",
        classification: "restricted",
        ownerDepartment: "Legal",
        lastIndexedAt: "2026-05-01T00:00:00.000Z",
        health: "stale",
      },
    ],
  });

  assert.deepEqual(summary, {
    totalDocuments: 2,
    indexedSources: 1,
    catalogSources: 2,
    enabledSources: 2,
    healthySources: 1,
    attentionSources: 0,
    staleSources: 1,
    sensitiveSources: 1,
    unindexedEnabledSources: 1,
    staleAfterDays: 14,
    latestIndexedAt: "2026-06-01T00:00:00.000Z",
    oldestIndexedAt: "2026-06-01T00:00:00.000Z",
  });
});

test("contextSourceStaleAfterDaysFromEnv parses positive integer thresholds", () => {
  assert.equal(contextSourceStaleAfterDaysFromEnv({ CONTEXT_SOURCE_STALE_AFTER_DAYS: "10" }), 10);
  assert.equal(contextSourceStaleAfterDaysFromEnv({ CONTEXT_SOURCE_STALE_AFTER_DAYS: "0" }), 30);
  assert.equal(contextSourceStaleAfterDaysFromEnv({ CONTEXT_SOURCE_STALE_AFTER_DAYS: "later" }), 30);
});
