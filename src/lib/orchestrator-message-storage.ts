import { sanitizeAuditText } from "./audit-sanitization.ts";
import type { OrchestratorAction, OrchestratorMessage } from "./ui/types.ts";

type OrchestratorStorageOptions = {
  storePrompts?: boolean;
  storeToolPayloads?: boolean;
};

const redacted = "[redacted]";
const sensitivePayloadKeyPattern =
  /(?:message|prompt|payload|raw|body|content|transcript|authorization|token|secret|password|credential|api[_-]?key|private[_-]?key)/i;
const safePayloadKeysByAction: Partial<Record<OrchestratorAction["type"], string[]>> = {
  open_view: ["view", "targetId"],
  open_top_use_case: ["useCaseId"],
  convert_top_use_case_to_skill: ["useCaseId"],
  approve_pending_tool_request: ["requestId"],
  reject_pending_tool_request: ["requestId"],
  open_selected_run_trace: ["runId"],
  approve_governance_review: ["reviewId"],
  request_governance_changes: ["reviewId"],
  open_command_order: ["orderId"],
  complete_command_order: ["orderId"],
};

function sanitizeStoredValue(value: unknown, key = "", depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return sensitivePayloadKeyPattern.test(key) ? redacted : sanitizeAuditText(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 5) return redacted;
  if (Array.isArray(value)) return value.map((item) => sanitizeStoredValue(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeStoredValue(entryValue, entryKey, depth + 1),
      ]),
    );
  }
  return redacted;
}

function sanitizeMinimalActionPayload(action: OrchestratorAction) {
  if (!action.payload) return undefined;
  const allowedKeys = safePayloadKeysByAction[action.type] ?? [];
  const minimal: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    const value = action.payload[key];
    if (typeof value === "string") {
      const sanitized = sanitizeAuditText(value).replace(/\s+/g, " ").trim().slice(0, 180);
      if (sanitized && sanitized !== redacted) minimal[key] = sanitized;
    }
  }

  return Object.keys(minimal).length ? minimal : undefined;
}

function sanitizeStoredAction(
  action: OrchestratorAction,
  options: OrchestratorStorageOptions = {},
): OrchestratorAction {
  return {
    ...action,
    label: sanitizeAuditText(action.label),
    description: action.description
      ? options.storePrompts === false
        ? redacted
        : sanitizeAuditText(action.description)
      : action.description,
    payload: action.payload
      ? options.storeToolPayloads === false
        ? sanitizeMinimalActionPayload(action)
        : (sanitizeStoredValue(action.payload) as Record<string, unknown>)
      : action.payload,
  };
}

export function sanitizeOrchestratorMessagesForStorage(
  messages: OrchestratorMessage[],
  options: OrchestratorStorageOptions = {},
): OrchestratorMessage[] {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const promptStorageDisabled = options.storePrompts === false;
  return safeMessages.map((message) => ({
    ...message,
    content: promptStorageDisabled ? redacted : sanitizeAuditText(message.content),
    actions: message.actions?.map((action) => sanitizeStoredAction(action, options)),
    evidence: message.evidence?.map((item) => ({
      label: sanitizeAuditText(item.label),
      value: promptStorageDisabled ? redacted : sanitizeAuditText(item.value),
    })),
  }));
}
