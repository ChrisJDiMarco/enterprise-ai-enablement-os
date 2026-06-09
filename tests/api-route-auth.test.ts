import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const apiRoot = path.join(process.cwd(), "src", "app", "api");

const publicRoutes = new Map([
  ["auth/login/route.ts", "local or emergency login bootstrap"],
  ["auth/logout/route.ts", "idempotent session cookie clearing"],
  ["auth/oidc/start/route.ts", "OIDC authorization redirect bootstrap"],
  ["auth/oidc/callback/route.ts", "OIDC provider callback"],
  ["collateral/[asset]/route.ts", "public marketing collateral download"],
  ["health/route.ts", "public service liveness"],
  ["tenants/route.ts", "public self-serve provisioning status and disabled-safe onboarding"],
]);

const sessionAwarePublicRoutes = new Map([
  ["auth/session/route.ts", "sign-in gate session status"],
  ["readiness/route.ts", "public readiness summary before sign-in"],
  ["ready/route.ts", "public serving readiness summary before sign-in"],
]);

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) return routeFiles(absolute);
    return entry === "route.ts" ? [absolute] : [];
  });
}

function routeId(filePath: string) {
  return path.relative(apiRoot, filePath).split(path.sep).join("/");
}

test("API routes declare an explicit auth boundary", () => {
  const routes = routeFiles(apiRoot);
  const routeIds = new Set(routes.map(routeId));

  for (const publicRoute of [...publicRoutes.keys(), ...sessionAwarePublicRoutes.keys()]) {
    assert.equal(routeIds.has(publicRoute), true, `Auth boundary allowlist references missing route ${publicRoute}`);
  }

  for (const filePath of routes) {
    const id = routeId(filePath);
    const source = readFileSync(filePath, "utf8");

    if (publicRoutes.has(id)) {
      assert.doesNotMatch(source, /requireRole\(/, `${id} is public by design and should not mix route-level RBAC`);
      continue;
    }

    if (sessionAwarePublicRoutes.has(id)) {
      assert.match(source, /getRequestSession\(/, `${id} must inspect the session before returning auth-aware public status`);
      assert.match(source, /public|buildPublic/, `${id} must use an explicitly public-safe response path`);
      continue;
    }

    assert.match(source, /requireRole\(/, `${id} must require an authenticated role or be added to the explicit public route list`);
  }
});
