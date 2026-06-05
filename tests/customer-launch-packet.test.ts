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
      env: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"],
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
  assert.equal(packet.evidence.topItems.length <= 25, true);
  assert.match(packet.executiveSummary, /launch contract score is 72\/100/i);
  assert.match(packet.markdown, /Customer Launch Packet/);
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
  assert.match(packet.markdown, /All launch actions are complete/);
});
