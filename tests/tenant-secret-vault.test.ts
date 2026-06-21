import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deleteTenantSecrets,
  listTenantSecrets,
  normalizeTenantSecretName,
  readTenantSecretValues,
  upsertTenantSecrets,
} from "../src/lib/tenant-secret-vault.ts";

test("normalizeTenantSecretName canonicalizes supported vault names and rejects unsafe names", () => {
  assert.equal(normalizeTenantSecretName(" openai_api_key "), "OPENAI_API_KEY");
  assert.equal(normalizeTenantSecretName("OPENAI_API_KEY=sk-live-sensitive1234567890"), "");
  assert.equal(normalizeTenantSecretName("person@example.com"), "");
  assert.equal(normalizeTenantSecretName("../SECRET"), "");
});

test("upsertTenantSecrets canonicalizes names and ignores invalid direct-call secrets", async () => {
  const organizationId = `org-vault-normalize-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await upsertTenantSecrets(organizationId, {
    " openai_api_key ": " sk-live ",
    MCP_BROKER_URL: "not-a-url",
    CONNECTOR_BROKER_URL: "http://broker.example.com",
    JIRA_EMAIL: "not-email",
    "OPENAI_API_KEY=sk-live-sensitive1234567890": "should-not-store",
    "person@example.com": "should-not-store",
    OVERSIZED_SECRET: "x".repeat(20_001),
  });

  const listed = await listTenantSecrets(organizationId);
  const values = await readTenantSecretValues(organizationId, [
    "openai_api_key",
    "person@example.com",
    "OVERSIZED_SECRET",
    "MCP_BROKER_URL",
    "CONNECTOR_BROKER_URL",
    "JIRA_EMAIL",
  ]);
  const serializedList = JSON.stringify(listed);

  assert.deepEqual(listed.map((secret) => secret.name), ["OPENAI_API_KEY"]);
  assert.deepEqual(values, { OPENAI_API_KEY: "sk-live" });
  assert.equal(serializedList.includes("sk-live-sensitive"), false);
  assert.equal(serializedList.includes("person@example.com"), false);

  await deleteTenantSecrets(organizationId, ["openai_api_key"]);
});

test("deleteTenantSecrets removes selected tenant secrets without exposing or deleting others", async () => {
  const organizationId = `org-vault-delete-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await upsertTenantSecrets(organizationId, {
    OPENAI_API_KEY: "sk-live",
    OLD_VENDOR_SECRET: "legacy-secret",
  });

  const before = await listTenantSecrets(organizationId);
  assert.equal(before.some((secret) => secret.name === "OPENAI_API_KEY"), true);
  assert.equal(before.some((secret) => secret.name === "OLD_VENDOR_SECRET"), true);

  const after = await deleteTenantSecrets(organizationId, ["OLD_VENDOR_SECRET"]);
  const values = await readTenantSecretValues(organizationId, ["OPENAI_API_KEY", "OLD_VENDOR_SECRET"]);

  assert.equal(after.some((secret) => secret.name === "OPENAI_API_KEY"), true);
  assert.equal(after.some((secret) => secret.name === "OLD_VENDOR_SECRET"), false);
  assert.deepEqual(values, { OPENAI_API_KEY: "sk-live" });

  await deleteTenantSecrets(organizationId, ["openai_api_key"]);
});
