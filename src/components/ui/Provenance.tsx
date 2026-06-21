import { Activity, Database, FlaskConical, Radio, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Provenance is the product's honesty primitive: every number/claim that isn't a
 * direct live measurement should carry one of these so users always know what
 * they're looking at. For a governance product, "where did this figure come from"
 * is a first-class question — so it gets a first-class, consistent control.
 *
 * - live: measured from a real provider/system call
 * - simulated: produced by the deterministic local runtime (no model/external call)
 * - modeled: a calculation/projection from assumptions (e.g. ROI), not measured
 * - self-assessed: a maturity/coverage rating the org gave itself, not benchmarked
 * - imported: sourced from a connected system of record
 */
export type ProvenanceKind = "live" | "simulated" | "modeled" | "self-assessed" | "imported";

type ProvenanceConfig = {
  label: string;
  icon: LucideIcon;
  /** [borderClass, bgClass, textClass] using theme tokens. */
  classes: [string, string, string];
  title: string;
};

const PROVENANCE: Record<ProvenanceKind, ProvenanceConfig> = {
  live: {
    label: "Live",
    icon: Radio,
    classes: [
      "border-[color-mix(in_srgb,var(--success)_28%,var(--border))]",
      "bg-[var(--success-soft)]",
      "text-[var(--success)]",
    ],
    title: "Measured from a live provider or connected system.",
  },
  simulated: {
    label: "Simulated",
    icon: FlaskConical,
    classes: [
      "border-dashed border-[color-mix(in_srgb,var(--warning)_32%,var(--border))]",
      "bg-[var(--warning-soft)]",
      "text-[var(--warning)]",
    ],
    title: "Produced by the deterministic local runtime — no model or external call.",
  },
  modeled: {
    label: "Modeled",
    icon: SlidersHorizontal,
    classes: [
      "border-[color-mix(in_srgb,var(--info)_28%,var(--border))]",
      "bg-[var(--info-soft)]",
      "text-[var(--info)]",
    ],
    title: "A projection calculated from assumptions — not a measured outcome.",
  },
  "self-assessed": {
    label: "Self-assessed",
    icon: Activity,
    classes: [
      "border-[var(--border)]",
      "bg-[var(--surface-muted)]",
      "text-[var(--text-muted)]",
    ],
    title: "A rating the organization assigned itself — not externally benchmarked.",
  },
  imported: {
    label: "Imported",
    icon: Database,
    classes: [
      "border-[color-mix(in_srgb,var(--primary)_28%,var(--border))]",
      "bg-[var(--primary-soft)]",
      "text-[var(--primary)]",
    ],
    title: "Sourced from a connected system of record.",
  },
};

export function Provenance({
  kind,
  label,
  title,
  className = "",
}: {
  kind: ProvenanceKind;
  /** Override the default label (e.g. "Modeled estimate"). */
  label?: string;
  /** Override the default tooltip. */
  title?: string;
  className?: string;
}) {
  const config = PROVENANCE[kind];
  const Icon = config.icon;
  const [border, bg, text] = config.classes;
  return (
    <span
      data-testid={`provenance-${kind}`}
      data-provenance={kind}
      title={title ?? config.title}
      className={`inline-flex items-center gap-1 rounded-full border ${border} ${bg} ${text} px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      <Icon size={11} aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
}
