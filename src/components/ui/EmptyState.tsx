import { Play, Sparkles } from "lucide-react";
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
  return (
    <div className="rounded-lg border border-dashed border-slate-200/70 bg-white/[0.48] p-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-white/86 text-[var(--primary)] ring-1 ring-slate-200/65">
        <Sparkles size={18} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{body}</p>
      <Button className="mt-5" onClick={onAction}>
        <Play size={16} />
        {action}
      </Button>
    </div>
  );
}
