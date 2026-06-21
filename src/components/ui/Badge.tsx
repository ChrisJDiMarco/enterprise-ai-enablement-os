import type React from "react";
import type { RiskLevel } from "@/lib/enterprise-ai-data";

export type BadgeTone = "slate" | "green" | "amber" | "red" | "blue" | "purple";

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  const tones = {
    slate: "bg-[var(--surface-subtle)]/74 text-[var(--text-muted)] ring-[var(--border)]/76",
    green: "bg-[var(--success-soft)] text-[var(--success)] ring-[color-mix(in_srgb,var(--success)_24%,var(--border))]",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)] ring-[color-mix(in_srgb,var(--warning)_26%,var(--border))]",
    red: "bg-[var(--danger-soft)] text-[var(--danger)] ring-[color-mix(in_srgb,var(--danger)_24%,var(--border))]",
    blue: "bg-[var(--info-soft)] text-[var(--info)] ring-[color-mix(in_srgb,var(--info)_24%,var(--border))]",
    purple: "bg-[var(--primary-soft)] text-[var(--primary)] ring-[color-mix(in_srgb,var(--primary)_22%,var(--border))]",
  };

  return (
    <span className={`inline-flex max-w-full min-w-0 items-center truncate rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function riskTone(risk: RiskLevel): "green" | "amber" | "red" | "purple" {
  if (risk === "low") return "green";
  if (risk === "medium") return "amber";
  if (risk === "high") return "red";
  return "purple";
}

export function statusTone(status: string): BadgeTone {
  if (["production", "scaled", "approved", "completed"].includes(status)) return "green";
  if (["in_review", "governance_review", "waiting_for_approval", "pending", "approved_with_conditions", "queued", "running"].includes(status)) return "amber";
  if (["high", "blocked", "failed", "rejected", "changes_requested"].includes(status)) return "red";
  if (["pilot", "in_pilot", "measuring", "approved_for_pilot"].includes(status)) return "blue";
  if (["draft", "discovery", "triage"].includes(status)) return "purple";
  return "slate";
}
