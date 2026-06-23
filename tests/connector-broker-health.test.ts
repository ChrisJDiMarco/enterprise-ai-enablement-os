import { test } from "node:test";
import assert from "node:assert/strict";
import { probeConnectorBrokerHealth } from "../src/lib/connector-broker-health.ts";

const now = new Date("2026-06-15T12:00:00.000Z");

test("probeConnectorBrokerHealth reports policy-only when no broker URL is configured", async () => {
  const health = await probeConnectorBrokerHealth({}, now);
  assert.equal(health.mode, "policy-only");
  assert.equal(health.urlConfigured, false);
  assert.equal(health.reachable, null);
});

test("probeConnectorBrokerHealth refuses an unsafe broker URL without probing it", async () => {
  const health = await probeConnectorBrokerHealth({ CONNECTOR_BROKER_URL: "http://localhost:9999/exec" }, now);
  assert.equal(health.mode, "connector-broker");
  assert.equal(health.urlConfigured, true);
  assert.equal(health.reachable, false);
  assert.match(health.detail, /safety check|SSRF/i);
});

test("probeConnectorBrokerHealth prefers the MCP broker URL for mode", async () => {
  const health = await probeConnectorBrokerHealth(
    { MCP_BROKER_URL: "http://localhost:8000", CONNECTOR_BROKER_URL: "http://localhost:9000" },
    now,
  );
  assert.equal(health.mode, "mcp-broker");
  assert.equal(health.urlConfigured, true);
});
