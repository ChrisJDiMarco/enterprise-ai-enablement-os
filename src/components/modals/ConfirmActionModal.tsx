"use client";

import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui";
import { useDialogFocus } from "@/lib/ui/dialog-focus";

export type ConfirmActionRequest = {
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  testId?: string;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmActionModal({
  action,
  onClose,
}: {
  action: ConfirmActionRequest;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  } = useDialogFocus<HTMLDivElement, HTMLButtonElement>();
  const isDanger = action.tone !== "primary";

  function closeConfirmation() {
    if (confirming) return;
    enableFocusRestore();
    onClose();
  }

  async function confirmAction() {
    if (confirming) return;

    disableFocusRestore();
    setConfirming(true);
    try {
      await action.onConfirm();
      setConfirming(false);
      onClose();
    } catch (error) {
      setConfirming(false);
      throw error;
    }
  }

  function handleConfirmationKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDialogKeyDown(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/24 p-4 backdrop-blur-md" onMouseDown={closeConfirmation}>
      <div
        ref={dialogRef}
        aria-labelledby="confirm-action-title"
        aria-describedby={action.detail ? "confirm-action-description confirm-action-detail" : "confirm-action-description"}
        aria-modal="true"
        className="ea-surface w-[min(94vw,520px)] overflow-hidden rounded-lg"
        data-testid={action.testId ?? "confirm-action-modal"}
        onKeyDown={handleConfirmationKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)]/64 bg-[var(--surface)]/64 px-5 py-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${
                isDanger
                  ? "bg-[var(--danger-soft)] text-[var(--danger)] ring-[color-mix(in_srgb,var(--danger)_30%,var(--border))]"
                  : "bg-[var(--primary-soft)] text-[var(--primary)] ring-[var(--primary)]/12"
              }`}
            >
              {isDanger ? <ShieldAlert size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h2 id="confirm-action-title" className="text-lg font-semibold tracking-[-0.01em] text-[var(--text)]">
                {action.title}
              </h2>
              <p id="confirm-action-description" className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                {action.description}
              </p>
            </div>
          </div>
          <button
            aria-label="Close confirmation"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
            disabled={confirming}
            onClick={closeConfirmation}
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {action.detail ? (
          <div className="border-b border-[var(--border)]/64 bg-[var(--surface-muted)]/50 px-5 py-4">
            <div id="confirm-action-detail" className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/72 p-3 text-sm leading-6 text-[var(--text-muted)]">
              {action.detail}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 bg-[var(--surface)]/88 px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={confirming} onClick={closeConfirmation}>
            {action.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            ref={initialFocusRef}
            variant={isDanger ? "danger" : "primary"}
            loading={confirming}
            onClick={() => void confirmAction()}
          >
            {confirming ? "Working..." : action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
