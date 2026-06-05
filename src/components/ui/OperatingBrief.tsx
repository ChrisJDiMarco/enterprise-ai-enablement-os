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
  className?: string;
}) {
  const clampedProgress = progress ? Math.min(Math.max(progress.value, 0), 100) : null;
  const PrimaryIcon = primaryAction?.icon;
  const SecondaryIcon = secondaryAction?.icon;

  return (
    <section
      className={`overflow-hidden rounded-lg border border-slate-200/58 bg-white/[0.78] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl ${className}`}
    >
      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {status ? <Badge tone={status.tone ?? "blue"}>{status.label}</Badge> : null}
                {eyebrow ? (
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {eyebrow}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-[30px]">
                {title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
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
            <div className="mt-6 grid gap-px overflow-hidden rounded-lg bg-slate-200/64 ring-1 ring-slate-200/64 sm:grid-cols-2 xl:grid-cols-4">
              {signals.map((signal) => {
                const content = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        {signal.label}
                      </div>
                      {signal.badge ? <Badge tone={signal.tone ?? "slate"}>{signal.badge}</Badge> : null}
                    </div>
                    <div className="mt-3 line-clamp-2 text-base font-semibold leading-6 tracking-tight text-slate-950">
                      {signal.value}
                    </div>
                    {signal.helper ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{signal.helper}</p>
                    ) : null}
                  </>
                );
                const classes =
                  "min-h-[104px] bg-white/72 p-4 text-left transition";

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

        <aside className="border-t border-slate-200/58 bg-slate-50/58 p-5 xl:border-l xl:border-t-0 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">{checklistTitle}</h3>
              {checklistHelper ? <p className="mt-1 text-xs leading-5 text-slate-500">{checklistHelper}</p> : null}
            </div>
            {progress ? (
              <div className="text-right">
                <div className="text-2xl font-semibold tracking-tight text-slate-950">{clampedProgress}%</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {progress.label}
                </div>
              </div>
            ) : null}
          </div>
          {progress ? (
            <div className="mt-4 h-2 rounded-full bg-slate-200/70">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          ) : null}

          {checklist.length ? (
            <div className="mt-5 max-h-[318px] space-y-2 overflow-y-auto pr-1">
              {checklist.map((item) => {
                const row = (
                  <>
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                        item.complete ? "bg-green-50 text-green-700" : "bg-white text-slate-400 ring-1 ring-slate-200"
                      }`}
                    >
                      {item.complete ? <Check size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="block text-sm font-semibold leading-5 text-slate-900">{item.label}</span>
                        {item.statusLabel ? (
                          <Badge tone={item.tone ?? (item.complete ? "green" : "amber")}>{item.statusLabel}</Badge>
                        ) : null}
                      </span>
                      {item.helper ? (
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{item.helper}</span>
                      ) : null}
                      {item.onClick ? (
                        <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">
                          {item.actionLabel ?? "Open"}
                          {item.destinationLabel ? <span className="text-slate-400">· {item.destinationLabel}</span> : null}
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
                    className={`flex w-full items-start gap-3 rounded-lg bg-white/76 px-3 py-3 text-left shadow-[0_1px_0_rgba(15,23,42,0.02)] ring-1 transition hover:bg-white hover:ring-[var(--primary)]/28 ${
                      item.active ? "ring-2 ring-[var(--primary)]/38 bg-[var(--primary-soft)]/42" : "ring-slate-200/54"
                    }`}
                  >
                    {row}
                  </button>
                ) : (
                  <div
                    key={item.label}
                    className="flex w-full items-start gap-3 rounded-lg bg-white/76 px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)] ring-1 ring-slate-200/54"
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
