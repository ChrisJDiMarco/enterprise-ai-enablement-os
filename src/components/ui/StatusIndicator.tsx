import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, FlaskConical, Minus } from "lucide-react";

import { Badge, statusTone, type BadgeTone } from "./Badge";
import { statusLabels } from "@/lib/ui/constants";

/**
 * Canonical status display. Pairs the status colour with an icon AND a label so
 * meaning is never carried by colour alone (WCAG 1.4.1). Reads the shared
 * statusTone()/statusLabels maps so the same status looks identical everywhere.
 */

const TONE_ICON: Record<BadgeTone, LucideIcon> = {
  slate: Minus,
  green: CheckCircle2,
  amber: Clock,
  red: AlertTriangle,
  blue: FlaskConical,
  purple: CircleDashed,
};

const TONE_DOT: Record<BadgeTone, string> = {
  slate: "bg-[var(--text-soft)]",
  green: "bg-[var(--success)]",
  amber: "bg-[var(--warning)]",
  red: "bg-[var(--danger)]",
  blue: "bg-[var(--info)]",
  purple: "bg-[var(--primary)]",
};

export type StatusMeta = { tone: BadgeTone; icon: LucideIcon; label: string };

function humanizeStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusMeta(status: string, label?: string): StatusMeta {
  const tone = statusTone(status);
  return { tone, icon: TONE_ICON[tone], label: label ?? statusLabels[status] ?? humanizeStatus(status) };
}

export function StatusIndicator({
  status,
  label,
  tone,
  icon,
  variant = "badge",
  showLabel = true,
  className = "",
}: {
  status: string;
  /** Override the human label (defaults to statusLabels[status]). */
  label?: string;
  /** Override the resolved tone. */
  tone?: BadgeTone;
  /** Override the resolved icon. */
  icon?: LucideIcon;
  variant?: "badge" | "dot";
  /** When false the label is screen-reader only (icon/dot carries it visually). */
  showLabel?: boolean;
  className?: string;
}) {
  const meta = statusMeta(status, label);
  const resolvedTone = tone ?? meta.tone;
  const Icon = icon ?? meta.icon;
  const text = label ?? meta.label;

  if (variant === "dot") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`inline-block size-2 shrink-0 rounded-full ${TONE_DOT[resolvedTone]}`} aria-hidden="true" />
        {showLabel ? (
          <span className="text-xs font-semibold text-[var(--text-muted)]">{text}</span>
        ) : (
          <span className="ea-sr-only">{text}</span>
        )}
      </span>
    );
  }

  return (
    <Badge tone={resolvedTone} icon={Icon} title={text} className={className}>
      {showLabel ? text : <span className="ea-sr-only">{text}</span>}
    </Badge>
  );
}
