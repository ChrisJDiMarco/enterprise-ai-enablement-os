import { Bot, Boxes, BrainCircuit, CircleDollarSign, Database, FileText, ShieldCheck } from "lucide-react";
import { Panel, statusTone } from "@/components/ui";
import { statusLabels } from "@/lib/ui/constants";
import { getUserName, type Department, type UseCase, type UseCaseStatus } from "@/lib/enterprise-ai-data";

export function FactoryMetricCard({
  title,
  value,
  helper,
  trend,
}: {
  title: string;
  value: string;
  helper: string;
  trend?: string;
}) {
  return (
    <Panel className="p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{title}</div>
      <div className="mt-4 flex min-w-0 items-end gap-2">
        <div className="min-w-0 truncate text-3xl font-semibold tracking-tight text-[var(--text)]">{value}</div>
        {trend ? <div className="shrink-0 pb-1 text-xs font-semibold text-[var(--success)]">{trend}</div> : null}
      </div>
      <div className="mt-3 text-sm leading-5 text-[var(--text-muted)]">{helper}</div>
    </Panel>
  );
}

export function StakeholderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)]/72 px-3 py-2 text-sm ring-1 ring-[var(--border)]/58">
      <span className="min-w-0 truncate font-medium text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

export function TimelineLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border)]/58 pb-3 last:border-b-0 last:pb-0">
      <span className="min-w-0 truncate font-medium text-[var(--text)]">{label}</span>
      <span className="min-w-0 truncate text-right text-xs text-[var(--text-muted)]">{value}</span>
    </div>
  );
}

export function OwnerAvatar({ ownerId }: { ownerId?: string }) {
  const name = getUserName(ownerId);
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)] ring-2 ring-[var(--surface)]">
        {initials(name)}
      </span>
    </div>
  );
}

export function PriorityRing({ value }: { value: number }) {
  return (
    <span
      className="relative flex size-8 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(var(--success) ${value * 3.6}deg, var(--border) 0deg)` }}
      aria-label={`Priority score ${value}`}
    >
      <span className="size-6 rounded-full bg-[var(--surface)]" />
    </span>
  );
}

export function FactoryUseCaseGlyph({ useCase, size }: { useCase: UseCase; size: number }) {
  if (useCase.department === "HR") return <Bot size={size} />;
  if (useCase.department === "Finance") return <CircleDollarSign size={size} />;
  if (useCase.department === "Legal") return <FileText size={size} />;
  if (useCase.department === "Procurement") return <Boxes size={size} />;
  if (useCase.department === "IT") return <Database size={size} />;
  if (useCase.department === "Security" || useCase.department === "Compliance") return <ShieldCheck size={size} />;
  return <BrainCircuit size={size} />;
}

export function factoryPriorityScore(useCase: UseCase) {
  return useCase.priorityScore;
}

export function factoryStatusLabel(status: UseCaseStatus) {
  if (["approved_for_pilot", "governance_review"].includes(status)) return "Ready for Pilot";
  if (["in_pilot", "measuring"].includes(status)) return "In Review";
  if (status === "draft") return "Idea";
  return statusLabels[status] ?? status;
}

export function factoryStatusTone(status: UseCaseStatus): "green" | "amber" | "red" | "blue" | "purple" | "slate" {
  if (["approved_for_pilot", "governance_review"].includes(status)) return "green";
  if (["in_pilot"].includes(status)) return "amber";
  return statusTone(status);
}

export function factoryDepartmentLabel(department: Department) {
  if (department === "IT") return "IT";
  if (department === "HR") return "HR";
  if (department === "Marketing") return "Comms";
  return department;
}

export function factorySubtitle(useCase: UseCase) {
  const subtitles: Record<Department, string> = {
    HR: "Internal Support",
    Finance: "Finance Operations",
    Legal: "Legal",
    Procurement: "Procurement",
    IT: "IT Service Management",
    Marketing: "Communications",
    Operations: "Operations",
    Security: "GRC",
    Compliance: "GRC",
    Data: "Data",
    Other: "Enterprise",
  };
  return subtitles[useCase.department];
}

export function factoryIconTone(department: Department) {
  if (department === "HR") return "bg-indigo-600 text-white";
  if (department === "Finance") return "bg-blue-600 text-white";
  if (department === "Legal") return "bg-violet-600 text-white";
  if (department === "Procurement") return "bg-rose-500 text-white";
  if (department === "IT") return "bg-sky-500 text-white";
  if (department === "Security" || department === "Compliance") return "bg-purple-600 text-white";
  return "bg-teal-500 text-white";
}

export function opportunityAnnualValue(useCase: UseCase) {
  const monthlyHours = (useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60;
  return Math.round(monthlyHours * 68 * 12);
}

export function opportunityFteImpact(useCase: UseCase) {
  const annualHours = ((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60) * 12;
  return annualHours / 5200;
}

export function opportunityImpactBullets(useCase: UseCase) {
  return [
    `${Math.max(18, Math.round(useCase.avgHandlingTimeMinutes * 0.8))}% cycle-time reduction for target workflow`,
    `${useCase.estimatedUsers.toLocaleString()} users or stakeholders affected`,
    `Reusable pattern for ${factoryDepartmentLabel(useCase.department)} and adjacent functions`,
  ];
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AI";
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
