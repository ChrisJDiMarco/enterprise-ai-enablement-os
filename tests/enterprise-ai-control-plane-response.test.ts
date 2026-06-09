import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEnterpriseAiControlPlaneResponse,
  formatEnterpriseAiControlPlaneMarkdown,
} from "../src/lib/enterprise-ai-control-plane-response.ts";
import type { AuditLog, Run, Skill, ToolRequest, UseCase } from "../src/lib/enterprise-ai-data.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-api-1",
    title: "Finance Close Assistant",
    description: "Support close status checks.",
    department: "Finance",
    requestorId: "user-1",
    ownerId: "owner-1",
    businessProblem: "Close owners wait on repeated status checks.",
    currentProcess: "Manual spreadsheet follow-up.",
    desiredOutcome: "Grounded close summaries and follow-up drafts.",
    monthlyVolume: 600,
    avgHandlingTimeMinutes: 12,
    estimatedUsers: 80,
    capabilityType: "workflow_assistant",
    status: "approved_for_pilot",
    riskLevel: "medium",
    valueScore: 5,
    feasibilityScore: 4,
    riskScore: 2.5,
    reuseScore: 4,
    urgencyScore: 5,
    dataReadinessScore: 4,
    priorityScore: 88,
    expectedBenefits: ["cycle time"],
    dataSources: ["Close calendar"],
    risks: ["incorrect status"],
    linkedSkillId: "skill-api-1",
    updatedAt: "2026-06-06",
    createdAt: "2026-06-06",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-api-1",
    useCaseId: "uc-api-1",
    name: "Finance Close Assistant",
    slug: "finance-close-assistant",
    description: "Summarizes close status with governed evidence.",
    department: "Finance",
    ownerId: "owner-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "openai",
    model: "gpt-5-mini",
    temperature: 0.2,
    maxTokens: 2000,
    fallbackModel: "local",
    costLimit: 1,
    systemPrompt: "Summarize only from approved close evidence.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: ["email.send_external"],
    contextSources: ["Close calendar"],
    evalPassRate: 95,
    adoptionCount: 32,
    valueDelivered: 82000,
    runs: 18,
    updatedAt: "2026-06-06",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-api-1",
    skillId: "skill-api-1",
    useCaseId: "uc-api-1",
    triggeredBy: "owner-1",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Completed",
    costUsd: 0.03,
    latencyMs: 1300,
    startedAt: "2026-06-06T12:00:00.000Z",
    output: "Close summary drafted.",
    trace: [
      { label: "Request", status: "completed", detail: "Received", latencyMs: 10 },
      { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 10 },
      { label: "Context", status: "completed", detail: "Retrieved", latencyMs: 80 },
      { label: "Policy", status: "completed", detail: "Allowed", latencyMs: 20 },
    ],
    ...overrides,
  };
}

function toolRequest(overrides: Partial<ToolRequest> = {}): ToolRequest {
  return {
    id: "tool-api-1",
    skillId: "skill-api-1",
    runId: "run-api-1",
    user: "owner-1",
    toolId: "sharepoint.read_policy",
    reason: "Read close policy.",
    riskLevel: "low",
    status: "approved",
    requestedAt: "2026-06-06",
    ...overrides,
  };
}

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-api-1",
    eventType: "skill_run_completed",
    message: "Finance Close Assistant completed with policy evidence.",
    actor: "AI Harness",
    riskLevel: "low",
    createdAt: "2026-06-06",
    ...overrides,
  };
}

test("buildEnterpriseAiControlPlaneResponse returns a tenant-scoped enterprise control plane", () => {
  const workspace = emptyWorkspace("control-plane-api-test");
  workspace.organization.name = "Control Plane API Test";
  workspace.useCases = [useCase()];
  workspace.skills = [skill()];
  workspace.runs = [run()];
  workspace.toolRequests = [toolRequest()];
  workspace.auditLogs = [auditLog()];

  const response = buildEnterpriseAiControlPlaneResponse({
    workspace,
    auditLogs: [auditLog({ id: "audit-api-2", eventType: "shadow_ai_detected", message: "Shadow AI signal recorded." })],
    configuredSecretNames: ["OPENAI_API_KEY", "SLACK_BOT_TOKEN"],
    generatedAt: "2026-06-06T12:30:00.000Z",
    env: {
      SLACK_SIGNING_SECRET: "server-only-signing-secret",
      MCP_BROKER_URL: "https://broker.example.com",
    },
  });

  assert.equal(response.schema, "enterprise-ai-enablement-os.enterprise-control-plane.v1");
  assert.equal(response.organizationId, workspace.organizationId);
  assert.equal(response.organization.name, "Control Plane API Test");
  assert.equal(response.generatedAt, "2026-06-06T12:30:00.000Z");
  assert.ok(response.controlPlane.metrics.governedAssets >= 2);
  assert.ok(response.controlPlane.capabilities.some((capability) => capability.id === "shadow-ai"));
  assert.equal(response.readinessInputs.providers.items.find((provider) => provider.id === "openai")?.configured, true);
  assert.equal(response.readinessInputs.connectors.brokerMode, "mcp-broker");
  assert.ok(response.catalogs.compliancePacks.some((pack) => pack.name === "ISO/IEC 42001"));
});

test("buildEnterpriseAiControlPlaneResponse exposes readiness metadata without secret values", () => {
  const workspace = emptyWorkspace("secret-redaction-test");
  const response = buildEnterpriseAiControlPlaneResponse({
    workspace,
    configuredSecretNames: ["ANTHROPIC_API_KEY", "SERVICENOW_CLIENT_SECRET"],
    env: {
      ANTHROPIC_API_KEY: "should-never-appear",
      SERVICENOW_CLIENT_SECRET: "also-should-never-appear",
      SERVICENOW_INSTANCE_URL: "https://instance.service-now.example",
      SERVICENOW_CLIENT_ID: "client-id-secret-value",
    },
  });
  const serialized = JSON.stringify(response);

  assert.equal(serialized.includes("should-never-appear"), false);
  assert.equal(serialized.includes("also-should-never-appear"), false);
  assert.equal(serialized.includes("client-id-secret-value"), false);
  assert.ok(response.readinessInputs.providers.items.some((provider) => provider.id === "anthropic"));
  assert.ok(response.privacyBoundary.includes("Raw employee messages are not required"));
});

test("formatEnterpriseAiControlPlaneMarkdown produces a report-ready redacted artifact", () => {
  const workspace = emptyWorkspace("markdown-control-plane-test");
  workspace.organization.name = "Markdown Control Plane Test";
  workspace.organization.workspaceLabel = "Enablement OS";
  workspace.workspaceMode = "production";
  workspace.useCases = [useCase()];
  workspace.skills = [skill()];
  workspace.runs = [run()];
  workspace.toolRequests = [toolRequest()];
  workspace.auditLogs = [auditLog()];

  const response = buildEnterpriseAiControlPlaneResponse({
    workspace,
    configuredSecretNames: ["OPENAI_API_KEY"],
    generatedAt: "2026-06-06T15:00:00.000Z",
    env: {
      OPENAI_API_KEY: "markdown-secret-value",
      SLACK_SIGNING_SECRET: "server-only-signing-secret",
    },
  });
  const markdown = formatEnterpriseAiControlPlaneMarkdown(response);

  assert.match(markdown, /^# Markdown Control Plane Test Enterprise AI Control Plane/m);
  assert.match(markdown, /## Capability Ledger/);
  assert.match(markdown, /AI system of record/);
  assert.match(markdown, /## Readiness Inputs/);
  assert.match(markdown, /## Governance Catalogs/);
  assert.match(markdown, /## Privacy Boundary/);
  assert.match(markdown, /Raw employee messages are not required/);
  assert.equal(markdown.includes("markdown-secret-value"), false);
  assert.equal(markdown.includes("server-only-signing-secret"), false);
});
