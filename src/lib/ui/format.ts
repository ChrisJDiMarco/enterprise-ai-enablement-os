import type { AuditLog } from "@/lib/enterprise-ai-data";
import { sanitizeAuditLog } from "../audit-sanitization.ts";

export function nowStamp() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

export function todayStamp() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

/**
 * Format an arbitrary date value consistently across the app. Falls back to the
 * raw value when unparseable (matches the guard previously duplicated per-view).
 */
export function formatDateTime(value: string | number | Date, opts?: { time?: boolean }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(opts?.time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

export function normalizeTimestamp(value: unknown) {
  return typeof value === "string" && value.toLowerCase().includes("just now") ? nowStamp() : value;
}

export function normalizeTemporalRecords<T>(records: T[], keys: (keyof T)[]) {
  return records.map((record) => {
    const next = { ...record };
    keys.forEach((key) => {
      const normalized = normalizeTimestamp(next[key]);
      if (normalized !== next[key]) {
        next[key] = normalized as T[keyof T];
      }
    });
    return next;
  });
}

export function normalizeAuditLog(log: AuditLog): AuditLog {
  const safeLog = sanitizeAuditLog(log);

  if (log.eventType === "skill_updated" && log.actor === "Admin" && log.message.toLowerCase().includes("provider settings")) {
    return { ...safeLog, eventType: "provider_settings_updated" };
  }

  if (log.eventType === "skill_updated" && log.actor === "Admin" && log.message.toLowerCase().includes("workspace imported")) {
    return { ...safeLog, eventType: "workspace_imported" };
  }

  if (log.eventType === "skill_updated" && (log.actor === "Workflow Builder" || log.actor === "Workflow Studio") && log.message.toLowerCase().includes("workflow published")) {
    return { ...safeLog, eventType: "workflow_published" };
  }

  if (log.eventType === "skill_updated" && (log.actor === "Workflow Builder" || log.actor === "Workflow Studio") && log.message.toLowerCase().includes("block added")) {
    return { ...safeLog, eventType: "workflow_block_added" };
  }

  return safeLog;
}

export const chartColors = ["#635bff", "#0284c7", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

export function donutGradient(data: { name: string; value: number }[]) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "#e2e8f0";

  let cursor = 0;
  const stops = data.map((item, index) => {
    const start = cursor;
    const end = cursor + (item.value / total) * 100;
    cursor = end;
    const color = chartColors[index % chartColors.length];
    return `${color} ${start}% ${end}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}
