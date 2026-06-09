import { test } from "node:test";
import assert from "node:assert/strict";

import { executeConnectorRequest } from "../src/lib/connector-broker.ts";
import type { ContextSource, Skill, Tool } from "../src/lib/enterprise-ai-data.ts";
import {
  resolveWorkspaceContextSourcesForRuntime,
  resolveWorkspaceSkillForRuntime,
  resolveWorkspaceToolForRuntime,
} from "../src/lib/workspace-runtime-policy.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-runtime-policy",
    name: "Runtime Policy Skill",
    slug: "runtime-policy-skill",
    description: "Tests server-side runtime policy resolution.",
    department: "Operations",
    ownerId: "user-1",
    status: "production",
    version: "1.0.0",
    riskLevel: "low",
    autonomyTier: "tier_3_execute_bounded_action",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 1000,
    fallbackModel: "local",
    costLimit: 0.1,
    systemPrompt: "Use server-held tool policy only.",
    allowedTools: [],
    blockedTools: [],
    contextSources: [],
    evalPassRate: 92,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: "2026-06-01",
    ...overrides,
  };
}

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "tool-runtime-read",
    displayName: "Runtime Read Tool",
    description: "A runtime connector tool.",
    category: "custom",
    actionType: "read",
    riskLevel: "low",
    requiresApprovalByDefault: false,
    enabled: true,
    usage: 0,
    lastUsed: "2026-06-01",
    ...overrides,
  };
}

function makeSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: "source-runtime-policy",
    name: "Runtime Policy Source",
    type: "sharepoint",
    classification: "internal",
    ownerDepartment: "Operations",
    enabled: true,
    lastIndexedAt: "2026-06-01",
    documentCount: 1,
    skillsUsing: 1,
    health: "healthy",
    ...overrides,
  };
}

test("runtime policy resolution uses persisted tenant Skill and Tool records", () => {
  const workspace = emptyWorkspace("org-runtime-policy");
  const skill = makeSkill({ allowedTools: ["tool-runtime-read"] });
  const tool = makeTool();
  workspace.skills = [skill];
  workspace.tools = [tool];

  const skillResolution = resolveWorkspaceSkillForRuntime(workspace, skill.id);
  const toolResolution = resolveWorkspaceToolForRuntime(workspace, tool.id);

  assert.equal(skillResolution.ok, true);
  assert.equal(toolResolution.ok, true);
  if (!skillResolution.ok || !toolResolution.ok) return;
  assert.equal(skillResolution.skill, skill);
  assert.equal(toolResolution.tool, tool);
});

test("runtime policy resolution rejects stale or caller-forged ids", () => {
  const workspace = emptyWorkspace("org-runtime-policy");
  workspace.skills = [makeSkill()];
  workspace.tools = [makeTool()];

  const missingSkill = resolveWorkspaceSkillForRuntime(workspace, "skill-forged");
  const missingTool = resolveWorkspaceToolForRuntime(workspace, "tool-forged");

  assert.equal(missingSkill.ok, false);
  assert.equal(missingTool.ok, false);
  if (missingSkill.ok || missingTool.ok) return;
  assert.equal(missingSkill.code, "skill_not_registered");
  assert.equal(missingTool.code, "tool_not_registered");
  assert.equal(missingSkill.status, 404);
  assert.equal(missingTool.status, 404);
});

test("server-resolved connector execution cannot be widened by a forged client Skill", async () => {
  const workspace = emptyWorkspace("org-runtime-policy");
  const tool = makeTool({ id: "tool-sensitive-write", actionType: "update", riskLevel: "high" });
  const persistedSkill = makeSkill({
    id: "skill-runtime-policy",
    allowedTools: [],
    riskLevel: "low",
    autonomyTier: "tier_3_execute_bounded_action",
  });
  const forgedClientSkill = makeSkill({
    id: persistedSkill.id,
    allowedTools: [tool.id],
    riskLevel: "low",
    autonomyTier: "tier_3_execute_bounded_action",
  });
  workspace.skills = [persistedSkill];
  workspace.tools = [tool];

  const skillResolution = resolveWorkspaceSkillForRuntime(workspace, forgedClientSkill.id);
  const toolResolution = resolveWorkspaceToolForRuntime(workspace, tool.id);
  assert.equal(skillResolution.ok, true);
  assert.equal(toolResolution.ok, true);
  if (!skillResolution.ok || !toolResolution.ok) return;

  const result = await executeConnectorRequest({
    request: {
      organizationId: workspace.organizationId,
      skill: skillResolution.skill,
      toolId: toolResolution.tool.id,
      payload: { recordId: "case-1" },
      approved: true,
    },
    tools: workspace.tools,
  });

  assert.equal(result.status, "blocked");
  assert.match(result.decision.reason, /does not allow/i);
});

test("runtime context source resolution ignores forged client source catalogs", () => {
  const workspace = emptyWorkspace("org-runtime-policy");
  const allowedSource = makeSource({ id: "source-approved", name: "Approved Source" });
  const disabledSource = makeSource({ id: "source-disabled", name: "Disabled Source", enabled: false });
  const skill = makeSkill({
    contextSources: [allowedSource.id, disabledSource.id, "source-forged"],
  });
  workspace.skills = [skill];
  workspace.contextSources = [allowedSource, disabledSource];

  const resolution = resolveWorkspaceContextSourcesForRuntime(workspace, skill);

  assert.deepEqual(resolution.sources.map((source) => source.id), [allowedSource.id]);
  assert.deepEqual(resolution.missingSourceIds.sort(), [disabledSource.id, "source-forged"].sort());
});
