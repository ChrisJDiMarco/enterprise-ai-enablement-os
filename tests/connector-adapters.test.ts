import test from "node:test";
import assert from "node:assert/strict";

import { executeNativeConnector } from "../src/lib/connector-adapters.ts";
import type { ConnectorExecutionRequest } from "../src/lib/connector-broker.ts";

function request(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    organizationId: "org-native-adapter-test",
    skill: {} as ConnectorExecutionRequest["skill"],
    toolId: "jira.issue_read",
    payload: {},
    approved: true,
    ...overrides,
  };
}

test("native Jira read execution uses a bounded fetch signal", async () => {
  const originalFetch = globalThis.fetch;
  let capturedSignal: AbortSignal | null = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedSignal = init?.signal as AbortSignal | null;
    return new Response(JSON.stringify({ key: "EAIEOS-1" }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeNativeConnector({
      request: request({
        toolId: "jira.issue_read",
        payload: { issueKey: "EAIEOS-1" },
      }),
      secrets: {
        JIRA_BASE_URL: "https://jira.example.com",
        JIRA_EMAIL: "ai-admin@example.com",
        JIRA_API_TOKEN: "jira-token",
      },
    });

    assert.equal(result.status, "executed");
    assert.equal(result.connectorId, "jira");
    assert.ok(capturedSignal, "Jira read fetch must be bounded by an AbortSignal");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("native Microsoft Graph token and graph calls use bounded fetch signals", async () => {
  const originalFetch = globalThis.fetch;
  const capturedSignals: AbortSignal[] = [];
  const capturedUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrls.push(String(input));
    if (init?.signal) capturedSignals.push(init.signal as AbortSignal);
    if (String(input).includes("login.microsoftonline.com")) {
      return new Response(JSON.stringify({ access_token: "graph-token" }), { status: 200 });
    }
    return new Response(JSON.stringify({ value: [] }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeNativeConnector({
      request: request({
        toolId: "microsoft.graph_read",
        payload: { endpoint: "/users?$top=1" },
      }),
      secrets: {
        MS_GRAPH_TENANT_ID: "tenant-1",
        MS_GRAPH_CLIENT_ID: "client-1",
        MS_GRAPH_CLIENT_SECRET: "client-secret",
      },
    });

    assert.equal(result.status, "executed");
    assert.equal(result.connectorId, "microsoft_365");
    assert.equal(capturedUrls.some((url) => url.includes("login.microsoftonline.com")), true);
    assert.equal(capturedUrls.some((url) => url.includes("graph.microsoft.com/v1.0/users")), true);
    assert.equal(capturedSignals.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
