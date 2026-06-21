import assert from "node:assert/strict";
import test from "node:test";

import { boundedQueryLimit, tenantProvisionInputSchema, workspaceInputSchema } from "../src/lib/api-validation.ts";

test("tenantProvisionInputSchema accepts only safe branding logo URLs", () => {
  const httpsLogo = tenantProvisionInputSchema.safeParse({
    organizationName: "Acme AI",
    logoUrl: " https://cdn.example.com/logo.png ",
  });
  const relativeLogo = tenantProvisionInputSchema.safeParse({
    organizationName: "Acme AI",
    logoUrl: "/assets/acme-logo.svg",
  });

  assert.equal(httpsLogo.success, true);
  assert.equal(httpsLogo.success ? httpsLogo.data.logoUrl : "", "https://cdn.example.com/logo.png");
  assert.equal(relativeLogo.success, true);
  assert.equal(relativeLogo.success ? relativeLogo.data.logoUrl : "", "/assets/acme-logo.svg");
});

test("tenantProvisionInputSchema rejects unsafe branding logo URLs", () => {
  for (const logoUrl of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "http://example.com/logo.png", "//example.com/logo.png"]) {
    const parsed = tenantProvisionInputSchema.safeParse({
      organizationName: "Acme AI",
      logoUrl,
    });

    assert.equal(parsed.success, false, `${logoUrl} should be rejected`);
  }
});

test("workspaceInputSchema applies the same branding URL contract to imports", () => {
  const parsed = workspaceInputSchema.safeParse({
    organization: {
      logoUrl: " /brand/acme.png ",
    },
  });
  const unsafe = workspaceInputSchema.safeParse({
    organization: {
      logoUrl: "data:image/svg+xml,<svg onload=alert(1)>",
    },
  });

  assert.equal(parsed.success, true);
  assert.equal(parsed.success ? parsed.data.organization?.logoUrl : "", "/brand/acme.png");
  assert.equal(unsafe.success, false);
});

test("boundedQueryLimit produces integer-safe API page limits", () => {
  const options = { defaultLimit: 100, maxLimit: 1000 };

  assert.equal(boundedQueryLimit(null, options), 100);
  assert.equal(boundedQueryLimit("", options), 100);
  assert.equal(boundedQueryLimit("not-a-number", options), 100);
  assert.equal(boundedQueryLimit("Infinity", options), 100);
  assert.equal(boundedQueryLimit("-10", options), 1);
  assert.equal(boundedQueryLimit("0", options), 1);
  assert.equal(boundedQueryLimit("10.9", options), 10);
  assert.equal(boundedQueryLimit("999999", options), 1000);
});
