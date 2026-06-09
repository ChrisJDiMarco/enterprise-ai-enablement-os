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
    <div className="rounded-lg border border-dashed border-slate-300/72 bg-[var(--surface-inset)] p-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-white/88 text-[var(--primary)] shadow-[var(--shadow-button)] ring-1 ring-slate-200/72">
        <Sparkles size={18} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{body}</p>
      <Button className="mt-5" data-empty-state-action-kind={actionVisual.kind} onClick={onAction}>
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
