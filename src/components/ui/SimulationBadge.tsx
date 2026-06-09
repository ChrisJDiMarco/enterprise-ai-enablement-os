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
        className={`inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800 ${className}`}
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
        className={`inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-green-700 ${className}`}
      >
        <Radio size={11} aria-hidden="true" />
        Live
      </span>
    );
  }

  return null;
}
