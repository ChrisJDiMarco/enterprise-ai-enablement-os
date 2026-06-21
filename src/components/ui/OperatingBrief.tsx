import type React from "react";
import { Check, ChevronRight } from "lucide-react";

import { Badge, type BadgeTone } from "./Badge";
import { Button } from "./Button";

type BriefAction = {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

type BriefSignal = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: BadgeTone;
  badge?: string;
  onClick?: () => void;
};

type BriefChecklistItem = {
  label: string;
  helper?: string;
  complete?: boolean;
  active?: boolean;
  tone?: BadgeTone;
  statusLabel?: string;
  actionLabel?: string;
  destinationLabel?: string;
  onClick?: () => void;
};

export function OperatingBrief({
  eyebrow,
  title,
  body,
  status,
  progress,
  primaryAction,
  secondaryAction,
  signals = [],
  checklistTitle = "Launch path",
  checklistHelper,
  checklist = [],
  compact = false,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  body: string;
  status?: { label: string; tone?: BadgeTone };
  progress?: { value: number; label: string };
  primaryAction?: BriefAction;
  secondaryAction?: BriefAction;
  signals?: BriefSignal[];
  checklistTitle?: string;
  checklistHelper?: string;
  checklist?: BriefChecklistItem[];
  compact?: boolean;
  className?: string;
}) {
  const clampedProgress = progress ? Math.min(Math.max(progress.value, 0), 100) : null;
  const PrimaryIcon = primaryAction?.icon;
  const SecondaryIcon = secondaryAction?.icon;
  const gridClassName = compact ? "grid lg:grid-cols-[minmax(0,1fr)_270px]" : "grid lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]";
  const mainPaddingClassName = compact ? "p-2.5 sm:p-3" : "p-4 sm:p-5";
  const asidePaddingClassName = compact ? "p-2.5 sm:p-3" : "p-4 sm:p-5";
  const signalClassName = compact ? "min-h-[58px] bg-[var(--surface)]/70 p-2 text-left transition" : "min-h-[92px] bg-[var(--surface)]/70 p-3.5 text-left transition";
  const checklistClassName = compact ? "mt-2 max-h-[96px] space-y-1 overflow-y-auto pr-1" : "mt-4 max-h-[292px] space-y-2 overflow-y-auto pr-1";
  const checklistRowClassName = compact ? "px-2 py-1.5" : "px-3 py-3";

  return (
    <section
      className={`ea-operating-brief overflow-hidden rounded-lg border border-[var(--border)]/58 bg-[var(--surface)]/[0.78] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl ${className}`}
    >
      <div className={gridClassName}>
        <div className={`flex min-w-0 flex-col ${mainPaddingClassName}`}>
          <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"} lg:flex-row lg:items-start lg:justify-between`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {status ? <Badge tone={status.tone ?? "blue"}>{status.label}</Badge> : null}
                {eyebrow ? (
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    {eyebrow}
                  </span>
                ) : null}
              </div>
              <h2 className={`${compact ? "mt-2 text-lg sm:text-xl" : "mt-3 text-[23px] sm:text-[28px]"} max-w-4xl font-semibold tracking-[-0.025em] text-[var(--text)]`}>
                {title}
              </h2>
              <p
                className={`${compact ? "mt-1 line-clamp-1 text-xs leading-5" : "mt-2 text-sm leading-6 sm:text-[14px]"} max-w-3xl text-[var(--text-muted)]`}
                data-guided-copy="true"
              >
                {body}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {secondaryAction ? (
                <Button variant="secondary" onClick={secondaryAction.onClick}>
                  {SecondaryIcon ? <SecondaryIcon size={16} /> : null}
                  {secondaryAction.label}
                </Button>
              ) : null}
              {primaryAction ? (
                <Button onClick={primaryAction.onClick}>
                  {PrimaryIcon ? <PrimaryIcon size={16} /> : null}
                  {primaryAction.label}
                </Button>
              ) : null}
            </div>
          </div>

          {signals.length ? (
            <div className={`${compact ? "mt-3" : "mt-5"} grid gap-px overflow-hidden rounded-lg bg-[var(--border)]/54 ring-1 ring-[var(--border)]/54 sm:grid-cols-2 2xl:grid-cols-4`}>
              {signals.map((signal) => {
                const content = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-soft)]">
                        {signal.label}
                      </div>
                      {signal.badge ? <Badge tone={signal.tone ?? "slate"}>{signal.badge}</Badge> : null}
                    </div>
                    <div className={`${compact ? "mt-1 line-clamp-1 text-sm leading-5" : "mt-3 line-clamp-2 text-base leading-6"} font-semibold tracking-tight text-[var(--text)]`}>
                      {signal.value}
                    </div>
                    {signal.helper ? (
                      <p className={`mt-1 ${compact ? "line-clamp-1" : "line-clamp-2"} text-xs leading-5 text-[var(--text-muted)]`} data-guided-copy="true">
                        {signal.helper}
                      </p>
                    ) : null}
                  </>
                );
                const classes = signalClassName;

                return signal.onClick ? (
                  <button
                    key={signal.label}
                    type="button"
                    onClick={signal.onClick}
                    className={`${classes} hover:bg-[var(--primary-soft)]/52`}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={signal.label} className={classes}>
                    {content}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <aside className={`border-t border-[var(--border)]/58 bg-[var(--surface-muted)]/46 ${asidePaddingClassName} lg:border-l lg:border-t-0`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">{checklistTitle}</h3>
              {checklistHelper && !compact ? (
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                  {checklistHelper}
                </p>
              ) : null}
            </div>
            {progress ? (
              <div className="text-right">
                <div className={`${compact ? "text-xl" : "text-2xl"} font-semibold tracking-tight text-[var(--text)]`}>{clampedProgress}%</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                  {progress.label}
                </div>
              </div>
            ) : null}
          </div>
          {progress ? (
            <div className={`${compact ? "mt-3 h-1.5" : "mt-4 h-2"} rounded-full bg-[var(--border)]/70`}>
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          ) : null}

          {checklist.length ? (
            <div className={checklistClassName}>
              {checklist.map((item) => {
                const row = (
                  <>
                    <span
                      className={`flex ${compact ? "size-6" : "size-7"} shrink-0 items-center justify-center rounded-full ${
                        item.complete ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_24%,var(--border))]" : "bg-[var(--surface)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"
                      }`}
                    >
                      {item.complete ? <Check size={compact ? 12 : 14} /> : <ChevronRight size={compact ? 12 : 14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={`${compact ? "text-xs" : "text-sm"} block font-semibold leading-5 text-[var(--text)]`}>{item.label}</span>
                        {item.statusLabel ? (
                          <Badge tone={item.tone ?? (item.complete ? "green" : "amber")}>{item.statusLabel}</Badge>
                        ) : null}
                      </span>
                      {item.helper && !compact ? (
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                          {item.helper}
                        </span>
                      ) : null}
                      {item.onClick ? (
                        <span className={`${compact ? "mt-0.5" : "mt-2"} flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]`}>
                          {item.actionLabel ?? "Open"}
                          {item.destinationLabel ? <span className="text-[var(--text-soft)]">· {item.destinationLabel}</span> : null}
                          <ChevronRight size={12} />
                        </span>
                      ) : null}
                    </span>
                  </>
                );

                return item.onClick ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    aria-label={`${item.actionLabel ?? "Open"} ${item.label}${item.destinationLabel ? ` in ${item.destinationLabel}` : ""}`}
                      className={`flex w-full items-start gap-3 rounded-lg bg-[var(--surface)]/76 ${checklistRowClassName} text-left shadow-[0_1px_0_rgba(15,23,42,0.02)] ring-1 transition hover:bg-[var(--surface)] hover:ring-[var(--primary)]/28 ${
                      item.active ? "ring-2 ring-[var(--primary)]/38 bg-[var(--primary-soft)]/42" : "ring-[var(--border)]/54"
                    }`}
                  >
                    {row}
                  </button>
                ) : (
                  <div
                    key={item.label}
                    className={`flex w-full items-start gap-3 rounded-lg bg-[var(--surface)]/76 ${checklistRowClassName} shadow-[0_1px_0_rgba(15,23,42,0.02)] ring-1 ring-[var(--border)]/54`}
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
