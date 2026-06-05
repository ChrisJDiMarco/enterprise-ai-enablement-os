export type HeaderReader = {
  get(name: string): string | null;
};

export type ApiProtectionEnv = Record<string, string | undefined>;

export type ApiRouteLimit = {
  windowMs: number;
  maxRequests: number;
};

export type OriginDecision = {
  allowed: boolean;
  reason: "allowed" | "missing_origin" | "origin_not_trusted";
};

const defaultWindowMs = 60_000;
const defaultMaxRequests = 180;

const sensitiveMutationRoutes = [
  "/api/auth/login",
  "/api/tenants",
  "/api/users",
  "/api/provisioning/users",
  "/api/provider-secrets",
];

const aiExecutionRoutes = [
  "/api/orchestrator/chat",
  "/api/harness/run",
  "/api/evals/run",
  "/api/connectors/execute",
  "/api/context/retrieve",
  "/api/context/index",
];

const writeHeavyRoutes = [
  "/api/workspace",
  "/api/work-signals",
  "/api/workflows/jobs",
  "/api/audit",
];

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function routeMatches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function trustedOrigins(requestOrigin: string, env: ApiProtectionEnv = process.env) {
  const configured = (env.API_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([requestOrigin, ...configured]);
}

export function evaluateOrigin(params: {
  origin: string | null;
  requestOrigin: string;
  method: string;
  env?: ApiProtectionEnv;
}): OriginDecision {
  const method = params.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return { allowed: true, reason: "allowed" };

  if (!params.origin) {
    return params.env?.NODE_ENV === "production"
      ? { allowed: false, reason: "missing_origin" }
      : { allowed: true, reason: "allowed" };
  }

  return trustedOrigins(params.requestOrigin, params.env).has(params.origin)
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "origin_not_trusted" };
}

export function routeLimit(pathname: string, method: string, env: ApiProtectionEnv = process.env): ApiRouteLimit {
  const windowMs = numberFromEnv(env.API_RATE_LIMIT_WINDOW_MS, defaultWindowMs);
  const globalMax = numberFromEnv(env.API_RATE_LIMIT_MAX, defaultMaxRequests);
  const upperMethod = method.toUpperCase();

  if (routeMatches(pathname, sensitiveMutationRoutes)) {
    return {
      windowMs: numberFromEnv(env.API_SENSITIVE_RATE_LIMIT_WINDOW_MS, 15 * 60_000),
      maxRequests: numberFromEnv(env.API_SENSITIVE_RATE_LIMIT_MAX, 20),
    };
  }

  if (routeMatches(pathname, aiExecutionRoutes)) {
    return {
      windowMs,
      maxRequests: numberFromEnv(env.API_AI_RATE_LIMIT_MAX, Math.min(globalMax, 90)),
    };
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod) && routeMatches(pathname, writeHeavyRoutes)) {
    return {
      windowMs,
      maxRequests: numberFromEnv(env.API_WRITE_RATE_LIMIT_MAX, Math.min(globalMax, 80)),
    };
  }

  return { windowMs, maxRequests: globalMax };
}

export function clientKey(headers: HeaderReader, pathname: string, env: ApiProtectionEnv = process.env) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || headers.get("x-real-ip") || "unknown";
  const tenantHint = headers.get("x-eaieos-tenant") || "public";
  const salt = env.API_RATE_LIMIT_KEY_SALT ? `:${env.API_RATE_LIMIT_KEY_SALT}` : "";
  return `${ip}:${tenantHint}:${pathname}${salt}`;
}
