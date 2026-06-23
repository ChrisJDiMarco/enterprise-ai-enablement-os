import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveCompanyBlueprint, formatCompanyBlueprintBrief } from "../src/lib/company-blueprint.ts";
import { deriveEnterpriseMaturity } from "../src/lib/enterprise-maturity.ts";
import { deriveIntegrationBlueprint } from "../src/lib/integration-blueprint.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import { deriveAdoptionRate } from "../src/lib/adoption-model.ts";
import { emptyWorkspace, type EnterpriseWorkspace } from "../src/lib/workspace-schema.ts";

function metricsFor(workspace: EnterpriseWorkspace) {
  const activePilots = workspace.useCases.filter((item) =>
    ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status),
  ).length;
  const annualValue = workspace.skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);

  return {
    totalUseCases: workspace.useCases.length,
    activePilots,
    skills: workspace.skills.length,
    adoptionRate: deriveAdoptionRate(workspace.skills, workspace.useCases),
    hoursSaved: Math.round(annualValue / 68),
    riskItemsOpen: workspace.useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).length,
    annualValue,
  };
}

function blueprintFor(workspace: EnterpriseWorkspace) {
  const metrics = metricsFor(workspace);
  const workflowValidation = {
    nodeCount: workspace.workflow.nodes.length,
    status: workspace.workflow.status,
    valid: workspace.workflow.nodes.length > 0,
    issues: 0,
    warnings: 0,
  };
  const enterpriseMaturity = deriveEnterpriseMaturity({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    auditLogs: workspace.auditLogs,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    workSignals: workspace.workSignals,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    report: workspace.report,
    metrics,
    workflow: workflowValidation,
  });
  const integrationBlueprint = deriveIntegrationBlueprint({
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
  });

  return deriveCompanyBlueprint({
    organization: workspace.organization,
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    workSignals: workspace.workSignals,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    metrics,
    workflow: {
      nodeCount: workspace.workflow.nodes.length,
      status: workspace.workflow.status,
      valid: workspace.workflow.nodes.length > 0,
    },
    enterpriseMaturity,
    integrationBlueprint,
  });
}

test("deriveCompanyBlueprint: keeps an empty production workspace honest", () => {
  const blueprint = blueprintFor(emptyWorkspace());

  assert.equal(blueprint.stage, "unconfigured");
  assert.equal(blueprint.firstMove.id, "guided-setup");
  assert.equal(blueprint.firstMove.targetView, "admin");
  assert.equal(blueprint.functionRollout.length, 8);
  assert.equal(blueprint.recommendedMode.id, "fast-pilot");
  assert.equal(blueprint.launchDecisions.length, 4);
  assert.ok(blueprint.connections.every((connection) => connection.readiness === "missing"));
});

test("deriveCompanyBlueprint: turns a populated tenant into an implementation map", () => {
  const blueprint = blueprintFor(buildDemoWorkspace());

  assert.ok(blueprint.score >= 60);
  assert.notEqual(blueprint.stage, "unconfigured");
  assert.ok(blueprint.connections.some((connection) => connection.id === "knowledge" && connection.readiness !== "missing"));
  assert.ok(blueprint.operatingModel.some((role) => role.id === "governance-council" && role.targetView === "governance"));
  assert.equal(blueprint.functionRollout.find((item) => item.department === "HR")?.status, "scale");
  assert.ok(blueprint.phases.flatMap((phase) => phase.steps).some((step) => step.targetView === "harness"));

  const brief = formatCompanyBlueprintBrief(blueprint);
  assert.match(brief, /AI Enablement Blueprint/);
  assert.match(brief, /Executive Decisions Needed/);
  assert.match(brief, /90-Day Path/);
});
