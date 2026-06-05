import { test } from "node:test";
import assert from "node:assert/strict";
import { getProviderReadiness } from "../src/lib/provider-registry.ts";

test("getProviderReadiness: counts tenant vault secrets as configured providers", () => {
  const providers = getProviderReadiness({}, [
    "KIMI_API_KEY",
    "GLM_API_KEY",
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

test("getProviderReadiness: azure remains incomplete if the vault only has a key", () => {
  const providers = getProviderReadiness({}, ["AZURE_OPENAI_API_KEY"]);
  const azure = providers.find((provider) => provider.id === "azure_openai");

  assert.equal(azure?.configured, false);
  assert.deepEqual(azure?.missing, ["AZURE_OPENAI_ENDPOINT"]);
});
