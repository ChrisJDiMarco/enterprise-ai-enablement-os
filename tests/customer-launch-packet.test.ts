import test from "node:test";
import assert from "node:assert/strict";

import { buildCustomerLaunchPacket } from "../src/lib/customer-launch-packet.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import { buildEvidencePacket } from "../src/lib/evidence-packet.ts";
import type { ProductionReadiness } from "../src/lib/ui/types.ts";

const readiness: ProductionReadiness = {
  status: "degraded",
  customerLaunchContract: {
    status: "needs-work",
    score: 72,
    readyCount: 6,
    needsWorkCount: 4,
    blockedCount: 0,
    domains: [],
    nextActions: [],
  },
  manualActions: [
    {
      id: "sso",
      title: "Connect enterprise SSO",
      severity: "warning",
      owner: "Identity",
      action: "Create an OIDC app and configure issuer, client id, client secret, and redirect URI.",
      why: "Enterprise users should authenticate through centralized identity.",
      env: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"],
      verify: "Complete an OIDC callback in the hosted environment.",
    },
  ],
};

test("buildCustomerLaunchPacket creates a board-ready packet with next action and evidence", () => {
  const workspace = buildDemoWorkspace("launch-packet-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({ workspace, readiness, evidencePacket });

  assert.equal(packet.schema, "enterprise-ai-enablement-os.customer-launch-packet.v1");
  assert.equal(packet.organizationId, "launch-packet-org");
  assert.equal(packet.launchStatus, "needs-work");
  assert.equal(packet.launchScore, 72);
  assert.equal(packet.recommendedNextMove.title, "Connect enterprise SSO");
  assert.equal(packet.operatingSnapshot.useCases, workspace.useCases.length);
  assert.equal(packet.operatingSnapshot.evidenceItems, evidencePacket.summary.totalItems);
  assert.equal(packet.launchSequence.some((step) => step.label === "Identity and access"), true);
  assert.equal(packet.primetimeGate.items.some((item) => item.id === "production-runtime"), true);
  assert.equal(typeof packet.primetimeGate.score, "number");
  assert.equal(packet.enterpriseControlPlane.schema, "enterprise-ai-enablement-os.enterprise-control-plane.v1");
  assert.equal(typeof packet.enterpriseControlPlane.score, "number");
  assert.ok(packet.enterpriseControlPlane.readinessInputs.providers.items.some((provider) => provider.id === "local"));
  assert.ok(packet.acceptanceCriteria.some((criterion) => criterion.id === "enterprise-control-plane"));
  assert.ok(packet.acceptanceCriteria.some((criterion) => criterion.requiredFor === "production"));
  assert.equal(packet.evidence.topItems.length <= 25, true);
  assert.match(packet.executiveSummary, /launch contract score is 72\/100/i);
  assert.match(packet.executiveSummary, /primetime launch gate/i);
  assert.match(packet.markdown, /Customer Launch Packet/);
  assert.match(packet.markdown, /Primetime Launch Gate/);
  assert.match(packet.markdown, /Enterprise AI Control Plane/);
  assert.match(packet.markdown, /Evidence Acceptance Criteria/);
  assert.match(packet.markdown, /Eval evidence records/);
  assert.doesNotMatch(packet.markdown, /Eval artifacts:/);
  assert.match(packet.markdown, /Connect enterprise SSO/);
});

test("buildCustomerLaunchPacket recommends pilot launch when no manual actions remain", () => {
  const workspace = buildDemoWorkspace("ready-launch-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({
    workspace,
    evidencePacket,
    readiness: {
      status: "ready",
      customerLaunchContract: {
        status: "ready",
        score: 100,
        readyCount: 10,
        needsWorkCount: 0,
        blockedCount: 0,
        domains: [],
        nextActions: [],
      },
      manualActions: [],
    },
  });

  assert.equal(packet.launchStatus, "ready");
  assert.equal(packet.recommendedNextMove.title, "Launch controlled pilot");
  assert.ok(packet.acceptanceCriteria.every((criterion) => ["met", "partial", "missing"].includes(criterion.status)));
  assert.match(packet.markdown, /All launch actions are complete/);
});

test("buildCustomerLaunchPacket does not recommend pilot launch when readiness evidence is missing", () => {
  const workspace = buildDemoWorkspace("unknown-readiness-launch-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({ workspace, evidencePacket, readiness: null });

  assert.equal(packet.launchStatus, "needs-work");
  assert.equal(packet.recommendedNextMove.title, "Run launch readiness check");
  assert.match(packet.recommendedNextMove.verify, /readiness evidence is loaded/i);
  assert.match(packet.executiveSummary, /not ready for launch review until tenant readiness evidence is loaded/i);
  assert.doesNotMatch(packet.executiveSummary, /No launch blockers remain/);
  assert.doesNotMatch(packet.executiveSummary, /ready for private evaluation/i);
  assert.equal(packet.acceptanceCriteria.find((criterion) => criterion.id === "production-runtime")?.status, "missing");
});

test("buildCustomerLaunchPacket asks for contract regeneration when readiness lacks launch domains", () => {
  const workspace = buildDemoWorkspace("missing-contract-launch-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({
    workspace,
    evidencePacket,
    readiness: {
      status: "degraded",
      manualActions: [],
    },
  });

  assert.equal(packet.launchStatus, "needs-work");
  assert.equal(packet.recommendedNextMove.title, "Generate customer launch contract");
  assert.match(packet.executiveSummary, /not ready for customer launch review until the customer launch contract is generated/i);
  assert.doesNotMatch(packet.executiveSummary, /ready for private evaluation/i);
});

test("buildCustomerLaunchPacket keeps blocked runtime honest when launch contract is missing", () => {
  const workspace = buildDemoWorkspace("blocked-missing-contract-launch-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({
    workspace,
    evidencePacket,
    readiness: {
      status: "blocked",
      manualActions: [],
    },
  });

  assert.equal(packet.launchStatus, "blocked");
  assert.equal(packet.recommendedNextMove.title, "Generate customer launch contract");
  assert.match(packet.executiveSummary, /blocked for customer launch until production controls are completed and the customer launch contract is regenerated/i);
  assert.doesNotMatch(packet.executiveSummary, /ready for private evaluation/i);
});

test("buildCustomerLaunchPacket falls back to customer launch contract next actions", () => {
  const workspace = buildDemoWorkspace("contract-next-action-launch-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({
    workspace,
    evidencePacket,
    readiness: {
      status: "degraded",
      customerLaunchContract: {
        status: "needs-work",
        score: 82,
        readyCount: 9,
        needsWorkCount: 1,
        blockedCount: 0,
        domains: [],
        nextActions: [
          {
            id: "observability",
            label: "Observability",
            owner: "Operations",
            status: "needs-work",
            score: 64,
            summary: "Production telemetry needs endpoint routing.",
            evidence: ["observability endpoint missing"],
            nextAction: "Route runtime events into the production telemetry sink.",
            env: ["OBSERVABILITY_WEBHOOK_URL"],
          },
        ],
      },
      manualActions: [],
    },
  });

  assert.equal(packet.recommendedNextMove.title, "Complete Observability");
  assert.equal(packet.recommendedNextMove.owner, "Operations");
  assert.match(packet.recommendedNextMove.action, /telemetry sink/);
});

test("buildCustomerLaunchPacket accepts durable Harness trace evidence for trace criteria", () => {
  const workspace = buildDemoWorkspace("trace-store-launch-org");
  workspace.runs = [];
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({
    workspace,
    evidencePacket,
    readiness: {
      ...readiness,
      harnessTraceSummary: {
        total: 1,
        completed: 1,
        waitingForApproval: 0,
        blocked: 0,
        failed: 0,
        promptQualityAverage: 93,
        promptQualityUnsafe: 0,
        policyBlocked: 0,
        approvalGated: 0,
      },
    },
  });
  const traceCriterion = packet.acceptanceCriteria.find((criterion) => criterion.id === "traces");

  assert.equal(traceCriterion?.status, "met");
  assert.match(traceCriterion?.evidence ?? "", /1\/1 durable Harness trace/);
});

test("buildCustomerLaunchPacket redacts configured tenant secret evidence", () => {
  const workspace = buildDemoWorkspace("redacted-launch-org");
  const evidencePacket = buildEvidencePacket({ workspace });
  const packet = buildCustomerLaunchPacket({
    workspace,
    evidencePacket,
    readiness,
    configuredSecretNames: ["OPENAI_API_KEY", "SLACK_BOT_TOKEN"],
  });
  const serialized = JSON.stringify(packet);

  assert.equal(serialized.includes("secret-value"), false);
  assert.ok(packet.enterpriseControlPlane.readinessInputs.providers.items.some((provider) => provider.id === "openai"));
  assert.ok(packet.enterpriseControlPlane.readinessInputs.connectors.items.some((connector) => connector.id === "slack"));
});
