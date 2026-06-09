import { timingSafeEqual } from "node:crypto";
import {
  productionLocalLoginRequiresToken,
  productionLocalLoginToken,
  type RuntimeEnv,
} from "./auth-readiness.ts";

export type LocalLoginTokenBody = {
  localLoginToken?: unknown;
  emergencyLocalLoginToken?: unknown;
  emergencyAccessToken?: unknown;
};

export type ProductionLocalLoginGuard =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 503;
      code: "LOCAL_LOGIN_TOKEN_REQUIRED" | "LOCAL_LOGIN_TOKEN_MISCONFIGURED";
      error: string;
    };

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function bearerToken(value: string | null) {
  const trimmed = value?.trim() || "";
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed.slice("bearer ".length).trim() : "";
}

export function localLoginRequestToken({
  headers,
  body,
}: {
  headers: Pick<Headers, "get">;
  body?: LocalLoginTokenBody;
}) {
  return (
    stringValue(headers.get("x-eaieos-local-login-token")) ||
    stringValue(headers.get("x-local-login-token")) ||
    bearerToken(headers.get("authorization")) ||
    stringValue(body?.localLoginToken) ||
    stringValue(body?.emergencyLocalLoginToken) ||
    stringValue(body?.emergencyAccessToken)
  );
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function productionLocalLoginTokenMatches({
  providedToken,
  env = process.env,
}: {
  providedToken?: string;
  env?: RuntimeEnv;
}) {
  const expected = productionLocalLoginToken(env)?.trim();
  const provided = providedToken?.trim();
  return Boolean(expected && provided && timingSafeStringEqual(provided, expected));
}

export function productionLocalLoginGuard({
  providedToken,
  env = process.env,
}: {
  providedToken?: string;
  env?: RuntimeEnv;
} = {}): ProductionLocalLoginGuard {
  if (!productionLocalLoginRequiresToken(env)) return { ok: true };
  if (!productionLocalLoginToken(env)?.trim()) {
    return {
      ok: false,
      status: 503,
      code: "LOCAL_LOGIN_TOKEN_MISCONFIGURED",
      error: "Emergency local login is enabled but its token is not configured.",
    };
  }
  if (!productionLocalLoginTokenMatches({ providedToken, env })) {
    return {
      ok: false,
      status: 401,
      code: "LOCAL_LOGIN_TOKEN_REQUIRED",
      error: "Emergency local login token is required.",
    };
  }
  return { ok: true };
}
