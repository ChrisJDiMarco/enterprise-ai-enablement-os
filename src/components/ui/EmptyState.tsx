import { Boxes, Library, Network, Play, Settings, Sparkles, TestTube2, Workflow } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  const actionVisual = getActionVisual(action);
  const ActionIcon = actionVisual.icon;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed border-[var(--border-strong)]/64 bg-[var(--surface-inset)]/76 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.64)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3 text-left">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)]/82 text-[var(--primary)] ring-1 ring-[var(--border)]/68">
        <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]" data-guided-copy="true">{body}</p>
        </div>
      </div>
      <Button className="sm:self-center" data-empty-state-action-kind={actionVisual.kind} onClick={onAction}>
        <ActionIcon size={16} aria-hidden="true" />
        {action}
      </Button>
    </div>
  );
}

function getActionVisual(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("skill") && !normalized.includes("run") && !normalized.includes("test")) {
    return { icon: Library, kind: "library" };
  }

  if (normalized.includes("use case") || normalized.includes("opportunit")) {
    return { icon: Boxes, kind: "use-cases" };
  }

  if (normalized.includes("connect") || normalized.includes("tool") || normalized.includes("policy")) {
    return { icon: Network, kind: "network" };
  }

  if (normalized.includes("setting") || normalized.includes("requirement")) {
    return { icon: Settings, kind: "settings" };
  }

  if (normalized.includes("workflow") || normalized.includes("approval flow")) {
    return { icon: Workflow, kind: "workflow" };
  }

  if (normalized.includes("eval") || normalized.includes("suite")) {
    return { icon: TestTube2, kind: "evals" };
  }

  if (normalized.includes("run") || normalized.includes("test") || normalized.includes("simulation")) {
    return { icon: Play, kind: "run" };
  }

  return { icon: Sparkles, kind: "create" };
}
