import { test } from "node:test";
import assert from "node:assert/strict";

import { providerSecretsDeleteInputSchema, providerSecretsInputSchema } from "../src/lib/api-validation.ts";

test("provider secret validation accepts cataloged provider, connector, and control-plane names", () => {
  const parsed = providerSecretsInputSchema.safeParse({
    scope: "tenant",
    secrets: {
      OPENAI_API_KEY: "sk-test",
      SLACK_SIGNING_SECRET: "signing-secret",
      OIDC_CLIENT_SECRET: "oidc-secret",
      MCP_BROKER_URL: "https://broker.example.com",
      MCP_BROKER_TOKEN: "broker-token",
      JIRA_EMAIL: "ai-admin@example.com",
      ZENDESK_SUBDOMAIN: "acme-support",
      LOG_DRAIN_URL: "http://localhost:4318/v1/logs",
    },
  });

  assert.equal(parsed.success, true);
});

test("provider secret validation rejects malformed connection values", () => {
  const parsed = providerSecretsInputSchema.safeParse({
    scope: "tenant",
    secrets: {
      MCP_BROKER_URL: "not-a-url",
      CONNECTOR_BROKER_URL: "http://broker.example.com",
      LOG_DRAIN_URL: "https://user:pass@logs.example.com/ingest",
      JIRA_EMAIL: "not-email",
      ZENDESK_SUBDOMAIN: "bad subdomain",
    },
  });

  assert.equal(parsed.success, false);
  const messages = parsed.error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n") ?? "";
  assert.match(messages, /MCP_BROKER_URL must be a valid HTTP\(S\) URL/);
  assert.match(messages, /CONNECTOR_BROKER_URL must use HTTPS/);
  assert.match(messages, /LOG_DRAIN_URL must not embed credentials/);
  assert.match(messages, /JIRA_EMAIL must be a valid email address/);
  assert.match(messages, /ZENDESK_SUBDOMAIN must be a DNS-safe subdomain/);
});

test("provider secret validation rejects credential-like URL query parameters", () => {
  const parsed = providerSecretsInputSchema.safeParse({
    secrets: {
      OPENAI_BASE_URL: "https://api.example.com/v1?api_key=sk-live-sensitive1234567890",
    },
  });

  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues.map((issue) => issue.message).join("\n") ?? "", /query parameters/);
});

test("provider secret validation rejects unknown tenant vault names", () => {
  const parsed = providerSecretsInputSchema.safeParse({
    scope: "tenant",
    secrets: {
      OPENAI_API_KEY: "sk-test",
      RANDOM_VENDOR_SECRET: "not-cataloged",
    },
  });

  assert.equal(parsed.success, false);
  assert.equal(parsed.error?.issues.some((issue) => issue.path.join(".") === "secrets.RANDOM_VENDOR_SECRET"), true);
  assert.match(parsed.error?.issues.map((issue) => issue.message).join("\n") ?? "", /not a supported tenant vault secret name/);
});

test("provider secret deletion validation allows unsupported legacy names for cleanup", () => {
  const parsed = providerSecretsDeleteInputSchema.safeParse({
    scope: "tenant",
    names: ["OPENAI_API_KEY", "OLD_VENDOR_SECRET"],
  });

  assert.equal(parsed.success, true);
});

test("provider secret deletion validation rejects duplicate names", () => {
  const parsed = providerSecretsDeleteInputSchema.safeParse({
    names: ["OPENAI_API_KEY", "OPENAI_API_KEY"],
  });

  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues.map((issue) => issue.message).join("\n") ?? "", /unique/);
});
