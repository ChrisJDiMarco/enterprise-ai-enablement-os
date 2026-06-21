import { FlaskConical, Radio } from "lucide-react";
import type { RunExecutionMode } from "@/lib/enterprise-ai-data";

/**
 * Honesty marker for anything produced without a live model/provider call.
 * Product rule: simulated output must be visually unmistakable wherever it
 * appears — run ledgers, traces, evidence, chat. Absence of an executionMode
 * on older records renders nothing (unknown, not asserted live).
 */
export function SimulationBadge({
  mode,
  reason,
  showLive = false,
  className = "",
}: {
  mode?: RunExecutionMode;
  reason?: string;
  /** When true, "live" runs get a quiet confirmation badge instead of nothing. */
  showLive?: boolean;
  className?: string;
}) {
  if (mode === "simulated") {
    return (
      <span
        title={reason ?? "Produced by the deterministic local runtime — no model was called."}
        data-testid="simulation-badge"
        className={`inline-flex items-center gap-1 rounded-full border border-dashed border-[color-mix(in_srgb,var(--warning)_32%,var(--border))] bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--warning)] ${className}`}
      >
        <FlaskConical size={11} aria-hidden="true" />
        Simulated
      </span>
    );
  }

  if (mode === "live" && showLive) {
    return (
      <span
        title="Produced by a live model provider call."
        data-testid="live-badge"
        className={`inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--success)] ${className}`}
      >
        <Radio size={11} aria-hidden="true" />
        Live
      </span>
    );
  }

  return null;
}
