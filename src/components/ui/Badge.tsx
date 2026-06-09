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
    slate: "bg-slate-100/74 text-slate-700 ring-slate-200/76",
    green: "bg-green-50/78 text-green-700 ring-green-100",
    amber: "bg-amber-50/78 text-amber-700 ring-amber-100",
    red: "bg-red-50/78 text-red-700 ring-red-100",
    blue: "bg-sky-50/78 text-sky-700 ring-sky-100",
    purple: "bg-indigo-50/78 text-indigo-700 ring-indigo-100",
  };

  return (
    <span className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-inset ${tones[tone]}`}>
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
