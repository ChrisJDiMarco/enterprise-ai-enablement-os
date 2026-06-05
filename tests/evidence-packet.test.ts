import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvidencePacket } from "../src/lib/evidence-packet.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";

test("evidence packet compiles workspace proof into JSON and markdown", () => {
  const workspace = buildDemoWorkspace("packet-org");
  const packet = buildEvidencePacket({ workspace });

  assert.equal(packet.schema, "enterprise-ai-enablement-os.evidence-packet.v2");
  assert.equal(packet.organizationId, "packet-org");
  assert.equal(packet.summary.useCases > 0, true);
  assert.equal(typeof packet.summary.securityFindings, "number");
  assert.equal(packet.items.some((item) => item.type === "skill"), true);
  assert.equal(packet.items.some((item) => item.type === "security"), true);
  assert.match(packet.markdown, /Evidence Packet/);
  assert.match(packet.markdown, /Agent security findings/);
});
