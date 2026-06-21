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

export type PayloadSizeDecision = {
  allowed: boolean;
  reason:
    | "allowed"
    | "payload_too_large"
    | "invalid_content_length"
    | "missing_content_length"
    | "streaming_body_not_allowed";
  contentLength: number;
  maxBodyBytes: number;
};

const defaultWindowMs = 60_000;
const defaultMaxRequests = 180;
const defaultWorkspaceSnapshotMaxRequests = 240;
const defaultMaxBodyBytes = 5_000_000;

const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];

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

export function isMutationMethod(method: string) {
  return mutationMethods.includes(method.toUpperCase());
}

function loopbackDevelopmentOrigins(requestOrigin: string, env: ApiProtectionEnv) {
  if (env.NODE_ENV === "production") return [];

  try {
    const parsed = new URL(requestOrigin);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (!isLoopback) return [];

    const suffix = parsed.port ? `:${parsed.port}` : "";
    return [
      `${parsed.protocol}//localhost${suffix}`,
      `${parsed.protocol}//127.0.0.1${suffix}`,
      `${parsed.protocol}//[::1]${suffix}`,
    ];
  } catch {
    return [];
  }
}

export function trustedOrigins(requestOrigin: string, env: ApiProtectionEnv = process.env) {
  const configured = (env.API_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([requestOrigin, ...loopbackDevelopmentOrigins(requestOrigin, env), ...configured]);
}

export function evaluateOrigin(params: {
  origin: string | null;
  requestOrigin: string;
  method: string;
  env?: ApiProtectionEnv;
}): OriginDecision {
  const method = params.method.toUpperCase();
  if (!isMutationMethod(method)) return { allowed: true, reason: "allowed" };

  if (!params.origin) {
    return params.env?.NODE_ENV === "production"
      ? { allowed: false, reason: "missing_origin" }
      : { allowed: true, reason: "allowed" };
  }

  return trustedOrigins(params.requestOrigin, params.env).has(params.origin)
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "origin_not_trusted" };
}

export function shouldBypassMutationOriginGuard(params: {
  pathname: string;
  authorizationHeader: string | null;
}) {
  return (
    params.pathname.startsWith("/api/provisioning/") &&
    Boolean(params.authorizationHeader?.toLowerCase().startsWith("bearer "))
  );
}

export function maxBodyBytesFromEnv(env: ApiProtectionEnv = process.env) {
  return numberFromEnv(env.API_MAX_BODY_BYTES, defaultMaxBodyBytes);
}

export function evaluatePayloadSize(params: {
  contentLength: string | null;
  transferEncoding?: string | null;
  method: string;
  env?: ApiProtectionEnv;
}): PayloadSizeDecision {
  const maxBodyBytes = maxBodyBytesFromEnv(params.env);
  if (!isMutationMethod(params.method)) {
    return { allowed: true, reason: "allowed", contentLength: 0, maxBodyBytes };
  }

  const rawContentLength = params.contentLength?.trim();
  if (params.transferEncoding?.trim()) {
    return { allowed: false, reason: "streaming_body_not_allowed", contentLength: 0, maxBodyBytes };
  }

  if (!rawContentLength && params.env?.NODE_ENV === "production") {
    return { allowed: false, reason: "missing_content_length", contentLength: 0, maxBodyBytes };
  }

  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return { allowed: false, reason: "invalid_content_length", contentLength: 0, maxBodyBytes };
  }

  if (contentLength > maxBodyBytes) {
    return { allowed: false, reason: "payload_too_large", contentLength, maxBodyBytes };
  }

  return { allowed: true, reason: "allowed", contentLength, maxBodyBytes };
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

  if (upperMethod === "PUT" && pathname === "/api/workspace") {
    return {
      windowMs,
      maxRequests: numberFromEnv(env.API_WORKSPACE_RATE_LIMIT_MAX, Math.max(globalMax, defaultWorkspaceSnapshotMaxRequests)),
    };
  }

  if (isMutationMethod(upperMethod) && routeMatches(pathname, writeHeavyRoutes)) {
    return {
      windowMs,
      maxRequests: numberFromEnv(env.API_WRITE_RATE_LIMIT_MAX, Math.min(globalMax, 80)),
    };
  }

  return { windowMs, maxRequests: globalMax };
}

function boundedHeaderPart(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().replace(/[^A-Za-z0-9:._-]/g, "_").slice(0, 120);
  return normalized || fallback;
}

export function normalizeRequestId(value: string | null | undefined) {
  return value?.trim().replace(/[^A-Za-z0-9:._-]/g, "_").slice(0, 120) || "";
}

function rateLimitTenantPartition(headers: HeaderReader, pathname: string) {
  if (!pathname.startsWith("/api/provisioning/")) return "public";
  return boundedHeaderPart(headers.get("x-eaieos-tenant"), "machine-provisioning");
}

export function clientKey(headers: HeaderReader, pathname: string, env: ApiProtectionEnv = process.env) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0];
  const ip = boundedHeaderPart(forwardedFor || headers.get("x-real-ip"), "unknown");
  const tenantPartition = rateLimitTenantPartition(headers, pathname);
  const salt = env.API_RATE_LIMIT_KEY_SALT ? `:${env.API_RATE_LIMIT_KEY_SALT}` : "";
  return `${ip}:${tenantPartition}:${pathname}${salt}`;
}
