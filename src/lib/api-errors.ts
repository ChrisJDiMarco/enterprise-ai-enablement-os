export type PublicExternalServiceStatus = {
  ok: boolean;
  status: number | "unavailable";
  responseReceived: boolean;
  error?: string;
};

const unsafeDiagnosticPatterns = [
  /\b[A-Z0-9_]{8,}\b/,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\//i,
  /\b(?:token|password|credential|authorization|bearer)\b/i,
  /\b(?:stack|trace|enoent|econnrefused|etimedout|network offline)\b/i,
  /\b(?:\/Users\/|\/var\/|\/tmp\/|[A-Z]:\\)/i,
];

export function containsUnsafeDiagnostic(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return unsafeDiagnosticPatterns.some((pattern) => pattern.test(text));
}

export function caughtErrorDetail(_error: unknown, publicDetail: string) {
  return publicDetail;
}

export function externalServiceError(serviceLabel: string) {
  return `${serviceLabel} is unavailable or returned an error. No external action was completed.`;
}

export function publicExternalServiceStatus({
  serviceLabel,
  response,
  responseBody,
}: {
  serviceLabel: string;
  response: Pick<Response, "ok" | "status">;
  responseBody?: unknown;
}): PublicExternalServiceStatus {
  return {
    ok: response.ok,
    status: response.status,
    responseReceived:
      responseBody !== null &&
      responseBody !== undefined &&
      (!(typeof responseBody === "object") || Object.keys(responseBody).length > 0),
    ...(response.ok ? {} : { error: externalServiceError(serviceLabel) }),
  };
}

export function publicExternalServiceUnavailable(serviceLabel: string): PublicExternalServiceStatus {
  return {
    ok: false,
    status: "unavailable",
    responseReceived: false,
    error: externalServiceError(serviceLabel),
  };
}
