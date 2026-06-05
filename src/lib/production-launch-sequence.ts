import type { ProductionReadiness } from "@/lib/ui/types";

export type LaunchSequenceStatus = "ready" | "warning" | "blocker";

export type LaunchSequenceStep = {
  id: string;
  label: string;
  owner: string;
  status: LaunchSequenceStatus;
  summary: string;
  actionCount: number;
  env: string[];
  verify: string[];
};

type LaunchAction = NonNullable<ProductionReadiness["manualActions"]>[number];

const launchPhases = [
  {
    id: "identity",
    label: "Identity and access",
    owner: "Identity",
    actionIds: ["auth-required", "auth-secret", "sso"],
    readySummary: "Authentication, sessions, and enterprise SSO are ready for tenant users.",
  },
  {
    id: "data-security",
    label: "Data, secrets, and audit",
    owner: "Security / Data",
    actionIds: ["database", "secret-vault", "api-protection", "audit-integrity"],
    readySummary: "Durable persistence, tenant secrets, API protection, and audit integrity are ready.",
  },
  {
    id: "ai-runtime",
    label: "AI runtime and evals",
    owner: "AI",
    actionIds: ["providers", "eval-runner"],
    readySummary: "External model routing and evaluation artifact storage are ready.",
  },
  {
    id: "enterprise-systems",
    label: "Enterprise systems",
    owner: "Integrations",
    actionIds: ["connectors", "connector-catalog"],
    readySummary: "Connector broker and required enterprise system families are ready.",
  },
  {
    id: "automation",
    label: "Durable automation",
    owner: "Platform",
    actionIds: ["workflow-engine", "trace-store"],
    readySummary: "Workflow execution and Harness trace persistence are ready.",
  },
  {
    id: "operations",
    label: "Operations and recovery",
    owner: "Operations",
    actionIds: ["database-ops", "database-migrations"],
    readySummary: "Backups, restore proof, and schema migration gates are ready.",
  },
] as const;

function phaseStatus(actions: LaunchAction[]): LaunchSequenceStatus {
  if (actions.some((action) => action.severity === "blocker")) return "blocker";
  if (actions.some((action) => action.severity === "warning")) return "warning";
  return "ready";
}

function statusSummary(status: LaunchSequenceStatus, actions: LaunchAction[], readySummary: string) {
  if (status === "ready") return readySummary;
  const noun = actions.length === 1 ? "item" : "items";
  const lead = actions[0];
  return `${actions.length} ${noun} need work. Next: ${lead?.title ?? "resolve readiness gaps"}.`;
}

export function deriveProductionLaunchSequence(readiness: ProductionReadiness | null): LaunchSequenceStep[] {
  const actions = readiness?.manualActions ?? [];

  return launchPhases.map((phase) => {
    const phaseActionIds = new Set<string>(phase.actionIds);
    const phaseActions = actions.filter((action) => phaseActionIds.has(action.id));
    const status = phaseStatus(phaseActions);
    return {
      id: phase.id,
      label: phase.label,
      owner: phase.owner,
      status,
      summary: statusSummary(status, phaseActions, phase.readySummary),
      actionCount: phaseActions.length,
      env: Array.from(new Set(phaseActions.flatMap((action) => action.env))).sort(),
      verify: phaseActions.map((action) => action.verify),
    };
  });
}
