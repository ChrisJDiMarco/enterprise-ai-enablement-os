import { test } from "node:test";
import assert from "node:assert/strict";
import { getProviderReadiness } from "../src/lib/provider-registry.ts";

test("getProviderReadiness: counts tenant vault secrets as configured providers", () => {
  const providers = getProviderReadiness({}, [
    " kimi_api_key ",
    "glm_api_key",
    "DEEPSEEK_API_KEY",
    "GOOGLE_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
  ]);
  const byId = new Map(providers.map((provider) => [provider.id, provider]));

  assert.equal(byId.get("kimi")?.configured, true);
  assert.equal(byId.get("glm")?.configured, true);
  assert.equal(byId.get("deepseek")?.configured, true);
  assert.equal(byId.get("google")?.configured, true);
  assert.equal(byId.get("azure_openai")?.configured, true);
});

test("getProviderReadiness: redacts sensitive endpoint display values", () => {
  const providers = getProviderReadiness({
    OPENAI_API_KEY: "sk-test",
    OPENAI_BASE_URL: "https://user:password@proxy.example.com/openai#debug",
    AZURE_OPENAI_API_KEY: "azure-key",
    AZURE_OPENAI_ENDPOINT: "https://tenant.openai.azure.com/openai/deployments?api-key=secret-token",
  });
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  const serialized = JSON.stringify(providers);

  assert.equal(byId.get("openai")?.baseUrl, "https://api.openai.com/v1");
  assert.equal(byId.get("azure_openai")?.configured, false);
  assert.deepEqual(byId.get("azure_openai")?.missing, ["AZURE_OPENAI_ENDPOINT"]);
  assert.equal(serialized.includes("user:password"), false);
  assert.equal(serialized.includes("secret-token"), false);
});

test("getProviderReadiness: malformed runtime env endpoints do not count as configured", () => {
  const providers = getProviderReadiness({
    AZURE_OPENAI_API_KEY: "azure-key",
    AZURE_OPENAI_ENDPOINT: "http://tenant.openai.azure.com",
    KIMI_API_KEY: "kimi-key",
    KIMI_BASE_URL: "not-a-url",
  });
  const byId = new Map(providers.map((provider) => [provider.id, provider]));

  assert.equal(byId.get("azure_openai")?.configured, false);
  assert.deepEqual(byId.get("azure_openai")?.missing, ["AZURE_OPENAI_ENDPOINT"]);
  assert.equal(byId.get("kimi")?.configured, true);
  assert.equal(byId.get("kimi")?.baseUrl, "https://api.moonshot.ai/v1");
});

test("getProviderReadiness: azure remains incomplete if the vault only has a key", () => {
  const providers = getProviderReadiness({}, ["AZURE_OPENAI_API_KEY"]);
  const azure = providers.find((provider) => provider.id === "azure_openai");

  assert.equal(azure?.configured, false);
  assert.deepEqual(azure?.missing, ["AZURE_OPENAI_ENDPOINT"]);
});
