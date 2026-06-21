import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer?: string;
};

export type OidcTokenResponse = {
  id_token?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type RuntimeEnv = Record<string, string | undefined>;

const discoveryCache = new Map<string, Promise<OidcDiscovery>>();
const defaultOidcFetchTimeoutMs = 10_000;
const minOidcFetchTimeoutMs = 1_000;
const maxOidcFetchTimeoutMs = 30_000;

function isLocalOidcHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function insecureHttpAllowed(url: URL, allowInsecureHttp?: boolean, env: RuntimeEnv = process.env) {
  if (allowInsecureHttp !== undefined) return allowInsecureHttp;
  if (env.NODE_ENV !== "production") return true;
  return isLocalOidcHost(url.hostname);
}

type OidcUrlOptions = {
  allowInsecureHttp?: boolean;
  env?: RuntimeEnv;
};

function assertSafeOidcUrl(url: URL, label: string, options: OidcUrlOptions = {}) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http or https.`);
  }
  if (url.protocol === "http:" && !insecureHttpAllowed(url, options.allowInsecureHttp, options.env)) {
    throw new Error(`${label} must use https outside local development.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not include credentials.`);
  }
  if (url.hash) {
    throw new Error(`${label} must not include fragment values.`);
  }
}

export function oidcFetchTimeoutMsFromEnv(env: RuntimeEnv = process.env) {
  const parsed = Number(env.OIDC_HTTP_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultOidcFetchTimeoutMs;
  return Math.min(maxOidcFetchTimeoutMs, Math.max(minOidcFetchTimeoutMs, Math.round(parsed)));
}

export function normalizeOidcIssuer(issuer: string, options: OidcUrlOptions = {}) {
  const trimmed = issuer.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("OIDC issuer must be an absolute URL.");
  }

  assertSafeOidcUrl(url, "OIDC issuer", options);
  if (url.search) {
    throw new Error("OIDC issuer must not include query values.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function normalizeOidcRedirectUri(value: string, options: OidcUrlOptions = {}) {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("OIDC redirect URI must be an absolute URL.");
  }

  assertSafeOidcUrl(url, "OIDC redirect URI", options);
  return url.toString();
}

export function createOidcCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function oidcPkceChallenge(codeVerifier: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier)) {
    throw new Error("OIDC PKCE code verifier is invalid.");
  }
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function requiredOidcEndpoint(value: unknown, field: keyof OidcDiscovery, options: OidcUrlOptions = {}) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OIDC discovery document is missing ${field}.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`OIDC discovery ${field} must be an absolute URL.`);
  }

  assertSafeOidcUrl(url, `OIDC discovery ${field}`, options);

  return url.toString();
}

export async function getOidcDiscovery(issuer: string) {
  const normalizedIssuer = normalizeOidcIssuer(issuer);
  const cached = discoveryCache.get(normalizedIssuer);
  if (cached) return cached;

  const promise = fetchWithTimeout(
    `${normalizedIssuer}/.well-known/openid-configuration`,
    { cache: "no-store" },
    oidcFetchTimeoutMsFromEnv(),
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`OIDC discovery failed with ${response.status}.`);
      }
      const payload = (await response.json()) as Partial<OidcDiscovery>;
      if (payload.issuer && normalizeOidcIssuer(payload.issuer) !== normalizedIssuer) {
        throw new Error("OIDC discovery issuer mismatch.");
      }
      return {
        issuer: payload.issuer ? normalizeOidcIssuer(payload.issuer) : normalizedIssuer,
        authorization_endpoint: requiredOidcEndpoint(payload.authorization_endpoint, "authorization_endpoint"),
        token_endpoint: requiredOidcEndpoint(payload.token_endpoint, "token_endpoint"),
        jwks_uri: requiredOidcEndpoint(payload.jwks_uri, "jwks_uri"),
      };
    })
    .catch((error) => {
      discoveryCache.delete(normalizedIssuer);
      throw error;
    });

  discoveryCache.set(normalizedIssuer, promise);
  return promise;
}

export async function exchangeOidcAuthorizationCode(params: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  env?: RuntimeEnv;
}): Promise<OidcTokenResponse> {
  const response = await fetchWithTimeout(
    params.tokenEndpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
        code: params.code,
        code_verifier: params.codeVerifier,
      }),
    },
    oidcFetchTimeoutMsFromEnv(params.env),
  );

  if (!response.ok) {
    throw new Error(`OIDC token exchange failed with ${response.status}.`);
  }

  const payload = await response.json().catch(() => {
    throw new Error("OIDC token exchange returned invalid JSON.");
  });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("OIDC token exchange returned an invalid payload.");
  }

  return payload as OidcTokenResponse;
}

export async function verifyOidcIdToken(params: {
  idToken: string;
  issuer: string;
  clientId: string;
  nonce?: string;
}) {
  const discovery = await getOidcDiscovery(params.issuer);
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
  const verified = await jwtVerify(params.idToken, jwks, {
    issuer: discovery.issuer || normalizeOidcIssuer(params.issuer),
    audience: params.clientId,
  });

  if (params.nonce && verified.payload.nonce !== params.nonce) {
    throw new Error("OIDC nonce mismatch.");
  }

  return verified.payload;
}

async function fetchWithTimeout(input: string | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
