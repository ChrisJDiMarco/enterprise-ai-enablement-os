import { useState } from "react";
import { X } from "lucide-react";
import { Button, Field } from "@/components/ui";

export function ImportWorkspaceModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (raw: string) => void;
}) {
  const [raw, setRaw] = useState("");

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold">Import Workspace</div>
            <div className="mt-1 text-sm text-slate-500">
              Restore an exported OS workspace. Redacted provider keys are preserved from current settings.
            </div>
          </div>
          <button
            aria-label="Close import workspace"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <Field label="Workspace JSON File">
            <input
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
              className="input min-h-[260px] font-mono text-xs leading-5"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder='{"schema":"enterprise-ai-enablement-os.workspace.v1", ...}'
            />
          </Field>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Import replaces the tenant workspace: use cases, Skills, runs, reviews, evals, workflow canvas, report, and safe provider settings.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onImport(raw)}>Import Workspace</Button>
        </div>
      </div>
    </div>
  );
}
