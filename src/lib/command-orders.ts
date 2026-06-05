import type { TransformationCommandOrder, TransformationCommandSystem } from "@/lib/transformation-command-system";
import type { View } from "@/lib/ui/types";

export type CommandOrderStatus = "open" | "in_progress" | "completed" | "blocked" | "dismissed";
export type CommandOrderPriority = "critical" | "high" | "medium" | "low";
export type CommandOrderSource = "command_system" | "orchestrator" | "manual";

export type CommandOrderRecord = {
  id: string;
  title: string;
  why: string;
  evidenceNeeded: string;
  targetView: View;
  status: CommandOrderStatus;
  priority: CommandOrderPriority;
  owner: string;
  dueDate: string;
  linkedEntityType?: "workspace" | "use_case" | "skill" | "run" | "governance_review" | "eval" | "workflow" | "report";
  linkedEntityId?: string;
  source: CommandOrderSource;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

const validViews = new Set<View>([
  "command",
  "estate",
  "blueprint",
  "strategy",
  "process",
  "work",
  "factory",
  "harness",
  "skills",
  "workflow",
  "connectors",
  "broker",
  "context",
  "evals",
  "governance",
  "launch",
  "roi",
  "training",
  "reports",
  "admin",
  "evidence",
  "orchestrator",
  "session",
]);

const validStatuses = new Set<CommandOrderStatus>(["open", "in_progress", "completed", "blocked", "dismissed"]);
const validPriorities = new Set<CommandOrderPriority>(["critical", "high", "medium", "low"]);
const validSources = new Set<CommandOrderSource>(["command_system", "orchestrator", "manual"]);

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cleanText(value: string, max = 240) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function isoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function priorityForOrder(order: Pick<TransformationCommandOrder, "urgency" | "confidence">): CommandOrderPriority {
  if (order.urgency === "now" && order.confidence >= 92) return "critical";
  if (order.urgency === "now") return "high";
  if (order.urgency === "next") return "medium";
  return "low";
}

function dueDateForOrder(order: Pick<TransformationCommandOrder, "urgency">, now: Date) {
  if (order.urgency === "now") return isoDateOnly(addDays(now, 1));
  if (order.urgency === "next") return isoDateOnly(addDays(now, 5));
  return isoDateOnly(addDays(now, 14));
}

function recordFromTransformationOrder(
  order: TransformationCommandOrder,
  existing: CommandOrderRecord | undefined,
  now: Date,
): CommandOrderRecord {
  const nowIso = now.toISOString();
  const currentStatus = existing?.status ?? "open";
  const completedAt =
    currentStatus === "completed" ? existing?.completedAt ?? nowIso : currentStatus === "dismissed" ? existing?.completedAt : undefined;

  const next: CommandOrderRecord = {
    id: order.id,
    title: cleanText(order.title, 120),
    why: cleanText(order.why, 360),
    evidenceNeeded: cleanText(order.evidenceNeeded, 360),
    targetView: order.targetView,
    status: currentStatus,
    priority: priorityForOrder(order),
    owner: existing?.owner || "AI Enablement Director",
    dueDate: existing?.dueDate || dueDateForOrder(order, now),
    linkedEntityType: existing?.linkedEntityType ?? "workspace",
    linkedEntityId: existing?.linkedEntityId,
    source: existing?.source ?? "command_system",
    confidence: Math.max(0, Math.min(100, Math.round(order.confidence))),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: existing ? existing.updatedAt : nowIso,
    completedAt,
  };

  if (
    existing &&
    (existing.title !== next.title ||
      existing.why !== next.why ||
      existing.evidenceNeeded !== next.evidenceNeeded ||
      existing.targetView !== next.targetView ||
      existing.priority !== next.priority ||
      existing.confidence !== next.confidence)
  ) {
    next.updatedAt = nowIso;
  }

  return next;
}

function normalizeRecord(input: unknown): CommandOrderRecord | null {
  const record = getRecord(input);
  const id = cleanText(getString(record, "id"), 100);
  const title = cleanText(getString(record, "title"), 120);
  const why = cleanText(getString(record, "why"), 360);
  const evidenceNeeded = cleanText(getString(record, "evidenceNeeded"), 360);
  const targetView = getString(record, "targetView") as View;
  const status = getString(record, "status") as CommandOrderStatus;
  const priority = getString(record, "priority") as CommandOrderPriority;
  const source = getString(record, "source") as CommandOrderSource;
  const createdAt = getString(record, "createdAt");
  const updatedAt = getString(record, "updatedAt");

  if (!id || !title || !validViews.has(targetView)) return null;

  return {
    id,
    title,
    why,
    evidenceNeeded,
    targetView,
    status: validStatuses.has(status) ? status : "open",
    priority: validPriorities.has(priority) ? priority : "medium",
    owner: cleanText(getString(record, "owner"), 120) || "AI Enablement Director",
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(getString(record, "dueDate"))
      ? getString(record, "dueDate")
      : isoDateOnly(new Date()),
    linkedEntityType: getString(record, "linkedEntityType") as CommandOrderRecord["linkedEntityType"],
    linkedEntityId: cleanText(getString(record, "linkedEntityId"), 120) || undefined,
    source: validSources.has(source) ? source : "manual",
    confidence: Math.max(0, Math.min(100, Math.round(getNumber(record, "confidence") || 70))),
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || createdAt || new Date().toISOString(),
    completedAt: getString(record, "completedAt") || undefined,
  };
}

export function normalizeCommandOrders(input: unknown): CommandOrderRecord[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, CommandOrderRecord>();

  input.forEach((item) => {
    const normalized = normalizeRecord(item);
    if (normalized) byId.set(normalized.id, normalized);
  });

  return [...byId.values()].sort((a, b) => {
    const statusScore = (value: CommandOrderStatus) =>
      value === "in_progress" ? 0 : value === "open" ? 1 : value === "blocked" ? 2 : 3;
    const priorityScore = (value: CommandOrderPriority) =>
      value === "critical" ? 0 : value === "high" ? 1 : value === "medium" ? 2 : 3;
    return (
      statusScore(a.status) - statusScore(b.status) ||
      priorityScore(a.priority) - priorityScore(b.priority) ||
      Date.parse(a.dueDate) - Date.parse(b.dueDate) ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
  });
}

export function mergeCommandOrders(
  existing: CommandOrderRecord[],
  commandSystem: Pick<TransformationCommandSystem, "orders">,
  now = new Date(),
): CommandOrderRecord[] {
  const normalizedExisting = normalizeCommandOrders(existing);
  const existingById = new Map(normalizedExisting.map((record) => [record.id, record]));
  const suggested = commandSystem.orders
    .slice(0, 8)
    .map((order) => recordFromTransformationOrder(order, existingById.get(order.id), now));
  const suggestedIds = new Set(suggested.map((record) => record.id));
  const carryForward = normalizedExisting.filter(
    (record) => !suggestedIds.has(record.id) && (record.source !== "command_system" || record.status === "completed" || record.status === "dismissed"),
  );
  const next = normalizeCommandOrders([...suggested, ...carryForward]).slice(0, 30);

  if (JSON.stringify(next) === JSON.stringify(normalizedExisting)) {
    return existing;
  }

  return next;
}

export function activeCommandOrders(orders: CommandOrderRecord[]) {
  return normalizeCommandOrders(orders).filter((order) => order.status !== "completed" && order.status !== "dismissed");
}

export function setCommandOrderStatus(
  orders: CommandOrderRecord[],
  orderId: string,
  status: CommandOrderStatus,
  now = new Date(),
): CommandOrderRecord[] {
  const nowIso = now.toISOString();
  return normalizeCommandOrders(orders).map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          updatedAt: nowIso,
          completedAt: status === "completed" || status === "dismissed" ? nowIso : undefined,
        }
      : order,
  );
}
