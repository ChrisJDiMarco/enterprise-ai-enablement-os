import { createRemoteJWKSet, jwtVerify } from "jose";

export type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer?: string;
};

const discoveryCache = new Map<string, Promise<OidcDiscovery>>();

export async function getOidcDiscovery(issuer: string) {
  const normalizedIssuer = issuer.replace(/\/$/, "");
  const cached = discoveryCache.get(normalizedIssuer);
  if (cached) return cached;

  const promise = fetch(`${normalizedIssuer}/.well-known/openid-configuration`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`OIDC discovery failed with ${response.status}.`);
      }
      const payload = (await response.json()) as Partial<OidcDiscovery>;
      if (!payload.authorization_endpoint || !payload.token_endpoint || !payload.jwks_uri) {
        throw new Error("OIDC discovery document is missing required endpoints.");
      }
      return payload as OidcDiscovery;
    });

  discoveryCache.set(normalizedIssuer, promise);
  return promise;
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
    issuer: discovery.issuer || params.issuer.replace(/\/$/, ""),
    audience: params.clientId,
  });

  if (params.nonce && verified.payload.nonce !== params.nonce) {
    throw new Error("OIDC nonce mismatch.");
  }

  return verified.payload;
}
