import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, FileJson, X } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { useDialogFocus } from "@/lib/ui/dialog-focus";

export function ImportWorkspaceModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (raw: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  } = useDialogFocus<HTMLDivElement, HTMLButtonElement>();

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function closeImport() {
    enableFocusRestore();
    onClose();
  }

  function importWorkspace() {
    if (!raw.trim()) return;

    disableFocusRestore();
    onImport(raw);
  }

  function handleImportKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDialogKeyDown(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeImport();
    }
  }

  const canImport = raw.trim().length > 0;
  const importDisabledReason = canImport
    ? ""
    : "Choose a workspace JSON file or paste exported JSON to enable import.";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20 p-3 backdrop-blur-md sm:p-6" onClick={closeImport}>
      <div
        ref={dialogRef}
        aria-labelledby="import-workspace-title"
        aria-describedby="import-workspace-description import-workspace-warning"
        aria-modal="true"
        className="ea-surface mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-3xl flex-col overflow-hidden rounded-lg sm:mt-8 sm:max-h-[calc(100dvh-4rem)]"
        data-testid="import-workspace-modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleImportKeyDown}
        role="dialog"
        tabIndex={-1}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[var(--border)]/64 bg-[var(--surface)]/56 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)]/76 text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
              <FileJson size={18} />
            </span>
            <div className="min-w-0">
              <div id="import-workspace-title" className="text-lg font-semibold text-[var(--text)]">Import Workspace</div>
              <div id="import-workspace-description" className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              Restore an exported OS workspace. Redacted provider keys are preserved from current settings.
              </div>
            </div>
          </div>
          <button
            ref={initialFocusRef}
            aria-label="Close import workspace"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
            onClick={closeImport}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--surface-muted)]/30 p-5 sm:p-6">
          <Field label="Workspace JSON File">
            <input
              aria-label="Workspace JSON file"
              className="input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
              }}
            />
          </Field>
          <Field label="Or paste exported JSON">
            <textarea
              aria-label="Paste exported workspace JSON"
              className="input min-h-[180px] font-mono text-xs leading-5 sm:min-h-[260px]"
              data-testid="import-workspace-json"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder='{"schema":"enterprise-ai-enablement-os.workspace.v1", ...}'
            />
          </Field>
          <div
            id="import-workspace-warning"
            className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--warning)]"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              Import replaces the tenant workspace: use cases, Skills, runs, reviews, evals, workflow canvas, report, and safe provider settings.
            </span>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)]/64 bg-[var(--surface)]/88 px-5 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-xs leading-5 text-[var(--text-muted)]">
              {importDisabledReason ? <span id="import-workspace-disabled-reason">{importDisabledReason}</span> : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeImport}>Cancel</Button>
              <Button
                data-testid="import-workspace-submit"
                disabled={!canImport}
                aria-describedby={importDisabledReason ? "import-workspace-disabled-reason" : undefined}
                title={importDisabledReason || undefined}
                onClick={importWorkspace}
              >
                Import Workspace
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
