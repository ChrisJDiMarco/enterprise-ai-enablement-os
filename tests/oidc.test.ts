import assert from "node:assert/strict";
import test from "node:test";

import {
  createOidcCodeVerifier,
  exchangeOidcAuthorizationCode,
  getOidcDiscovery,
  normalizeOidcIssuer,
  normalizeOidcRedirectUri,
  oidcPkceChallenge,
  oidcFetchTimeoutMsFromEnv,
} from "../src/lib/oidc.ts";

async function withMockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("normalizeOidcIssuer trims safe issuer URLs and rejects unsafe parts", () => {
  assert.equal(normalizeOidcIssuer(" https://idp.example.com/tenant/ "), "https://idp.example.com/tenant");
  assert.equal(normalizeOidcIssuer("http://localhost:8080/realms/acme/"), "http://localhost:8080/realms/acme");

  assert.throws(() => normalizeOidcIssuer("idp.example.com"), /absolute URL/);
  assert.throws(() => normalizeOidcIssuer("javascript:alert(1)"), /http or https/);
  assert.throws(() => normalizeOidcIssuer("https://user:pass@idp.example.com"), /credentials/);
  assert.throws(() => normalizeOidcIssuer("https://idp.example.com?tenant=acme"), /query values/);
  assert.throws(() => normalizeOidcIssuer("http://idp.example.com", { allowInsecureHttp: false }), /https outside/);
});

test("normalizeOidcRedirectUri allows exact HTTPS callback URLs and rejects unsafe ones", () => {
  assert.equal(
    normalizeOidcRedirectUri("https://app.example.com/api/auth/oidc/callback?tenant=acme"),
    "https://app.example.com/api/auth/oidc/callback?tenant=acme",
  );
  assert.equal(
    normalizeOidcRedirectUri("http://localhost:3007/api/auth/oidc/callback"),
    "http://localhost:3007/api/auth/oidc/callback",
  );

  assert.throws(() => normalizeOidcRedirectUri("app.example.com/callback"), /absolute URL/);
  assert.throws(() => normalizeOidcRedirectUri("https://user:pass@app.example.com/callback"), /credentials/);
  assert.throws(() => normalizeOidcRedirectUri("https://app.example.com/callback#token"), /fragment/);
  assert.throws(() => normalizeOidcRedirectUri("http://app.example.com/callback", { allowInsecureHttp: false }), /https outside/);
});

test("OIDC PKCE helper generates RFC-compatible verifier and S256 challenge", () => {
  const codeVerifier = createOidcCodeVerifier();
  assert.match(codeVerifier, /^[A-Za-z0-9_-]{43,128}$/);

  assert.equal(
    oidcPkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  assert.throws(() => oidcPkceChallenge("short"), /invalid/);
});

test("oidcFetchTimeoutMsFromEnv clamps provider HTTP timeout configuration", () => {
  assert.equal(oidcFetchTimeoutMsFromEnv({}), 10_000);
  assert.equal(oidcFetchTimeoutMsFromEnv({ OIDC_HTTP_TIMEOUT_MS: "250" }), 1_000);
  assert.equal(oidcFetchTimeoutMsFromEnv({ OIDC_HTTP_TIMEOUT_MS: "15000" }), 15_000);
  assert.equal(oidcFetchTimeoutMsFromEnv({ OIDC_HTTP_TIMEOUT_MS: "60000" }), 30_000);
  assert.equal(oidcFetchTimeoutMsFromEnv({ OIDC_HTTP_TIMEOUT_MS: "not-a-number" }), 10_000);
});

test("getOidcDiscovery validates issuer binding and absolute endpoints", async () => {
  await withMockFetch(
    async (input, init) => {
      assert.equal(String(input), "https://idp-success.example.com/tenant/.well-known/openid-configuration");
      assert.ok(init?.signal, "OIDC discovery should be bounded by an AbortSignal");
      return new Response(
        JSON.stringify({
          issuer: "https://idp-success.example.com/tenant/",
          authorization_endpoint: "https://idp-success.example.com/tenant/authorize",
          token_endpoint: "https://idp-success.example.com/tenant/token",
          jwks_uri: "https://idp-success.example.com/tenant/jwks",
        }),
        { status: 200 },
      );
    },
    async () => {
      const discovery = await getOidcDiscovery("https://idp-success.example.com/tenant/");
      assert.equal(discovery.issuer, "https://idp-success.example.com/tenant");
      assert.equal(discovery.authorization_endpoint, "https://idp-success.example.com/tenant/authorize");
      assert.equal(discovery.token_endpoint, "https://idp-success.example.com/tenant/token");
      assert.equal(discovery.jwks_uri, "https://idp-success.example.com/tenant/jwks");
    },
  );
});

test("exchangeOidcAuthorizationCode posts PKCE token exchange with a bounded request", async () => {
  await withMockFetch(
    async (input, init) => {
      assert.equal(String(input), "https://idp-token.example.com/token");
      assert.equal(init?.method, "POST");
      assert.ok(init?.signal, "OIDC token exchange should be bounded by an AbortSignal");
      assert.deepEqual(init?.headers, { "Content-Type": "application/x-www-form-urlencoded" });
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("client_id"), "client-1");
      assert.equal(body.get("client_secret"), "client-secret");
      assert.equal(body.get("redirect_uri"), "https://app.example.com/api/auth/oidc/callback");
      assert.equal(body.get("code"), "auth-code");
      assert.equal(body.get("code_verifier"), "code-verifier");

      return new Response(JSON.stringify({ id_token: "signed-id-token" }), { status: 200 });
    },
    async () => {
      const payload = await exchangeOidcAuthorizationCode({
        tokenEndpoint: "https://idp-token.example.com/token",
        clientId: "client-1",
        clientSecret: "client-secret",
        redirectUri: "https://app.example.com/api/auth/oidc/callback",
        code: "auth-code",
        codeVerifier: "code-verifier",
        env: { OIDC_HTTP_TIMEOUT_MS: "1500" },
      });

      assert.equal(payload.id_token, "signed-id-token");
    },
  );
});

test("exchangeOidcAuthorizationCode rejects invalid token responses", async () => {
  await withMockFetch(
    async () => new Response("not-json", { status: 200 }),
    async () => {
      await assert.rejects(
        () =>
          exchangeOidcAuthorizationCode({
            tokenEndpoint: "https://idp-invalid-token.example.com/token",
            clientId: "client-1",
            clientSecret: "client-secret",
            redirectUri: "https://app.example.com/api/auth/oidc/callback",
            code: "auth-code",
            codeVerifier: "code-verifier",
          }),
        /invalid JSON/,
      );
    },
  );
});

test("getOidcDiscovery rejects a discovery document from a different issuer", async () => {
  await withMockFetch(
    async () =>
      new Response(
        JSON.stringify({
          issuer: "https://unexpected-idp.example.com",
          authorization_endpoint: "https://idp-mismatch.example.com/authorize",
          token_endpoint: "https://idp-mismatch.example.com/token",
          jwks_uri: "https://idp-mismatch.example.com/jwks",
        }),
        { status: 200 },
      ),
    async () => {
      await assert.rejects(
        () => getOidcDiscovery("https://idp-mismatch.example.com"),
        /issuer mismatch/,
      );
    },
  );
});

test("getOidcDiscovery does not cache transient discovery failures", async () => {
  let attempts = 0;
  await withMockFetch(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("temporary outage", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          issuer: "https://idp-retry.example.com",
          authorization_endpoint: "https://idp-retry.example.com/authorize",
          token_endpoint: "https://idp-retry.example.com/token",
          jwks_uri: "https://idp-retry.example.com/jwks",
        }),
        { status: 200 },
      );
    },
    async () => {
      await assert.rejects(() => getOidcDiscovery("https://idp-retry.example.com"), /503/);

      const discovery = await getOidcDiscovery("https://idp-retry.example.com");
      assert.equal(discovery.issuer, "https://idp-retry.example.com");
      assert.equal(attempts, 2);
    },
  );
});
