import type { OrchestratorAction, OrchestratorActionType, View } from "@/lib/ui/types";

export function buildOrchestratorAction(
  type: OrchestratorActionType,
  label: string,
  description?: string,
  payload?: Record<string, unknown>,
  tone: OrchestratorAction["tone"] = "secondary",
): OrchestratorAction {
  return {
    id: `oa-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label,
    description,
    payload,
    tone,
  };
}

const viewPromptTerms: { view: View; terms: string[] }[] = [
  { view: "command", terms: ["command center", "command order", "command orders", "dashboard", "home", "overview"] },
  { view: "orchestrator", terms: ["orchestrator", "assistant", "chat"] },
  { view: "estate", terms: ["ai estate", "agent registry", "ai registry", "inventory", "shadow ai", "copilot inventory", "agent sprawl"] },
  { view: "blueprint", terms: ["company blueprint", "blueprint", "operating model", "rollout map", "implementation plan", "any company", "90 day"] },
  { view: "strategy", terms: ["strategy", "roadmap", "quarter", "objective", "operating plan"] },
  { view: "process", terms: ["process", "redesign", "current state", "future state", "swimlane"] },
  { view: "work", terms: ["work intelligence", "work signals", "work view", "work surface", "signal", "signals", "opportunity radar", "process mining", "task mining", "behavior"] },
  { view: "factory", terms: ["use case", "opportunity", "intake", "backlog", "factory"] },
  { view: "harness", terms: ["harness", "trace", "run", "runtime"] },
  { view: "skills", terms: ["skills", "skill library", "prompt"] },
  { view: "workflow", terms: ["workflow studio", "execution blueprint", "workflow", "graph", "canvas", "builder"] },
  { view: "connectors", terms: ["connector setup", "connect stack", "connectors setup", "slack setup", "teams setup", "sharepoint setup", "workday setup"] },
  { view: "broker", terms: ["mcp", "broker", "connector", "tool"] },
  { view: "context", terms: ["context", "retrieval", "source", "knowledge"] },
  { view: "evals", terms: ["eval", "evaluation", "red team", "test suite"] },
  { view: "governance", terms: ["governance", "review", "approval", "risk"] },
  { view: "evidence", terms: ["evidence", "audit", "ledger", "control"] },
  { view: "roi", terms: ["roi", "metric", "value", "adoption"] },
  { view: "training", terms: ["training", "adoption", "champion"] },
  { view: "reports", terms: ["report", "brief", "executive"] },
  { view: "launch", terms: ["launch center", "launch", "go live", "go-live", "private beta", "customer launch", "production ready", "readiness"] },
  { view: "admin", terms: ["admin", "settings", "api key", "provider", "sso"] },
];

const viewLabels: Record<View, string> = {
  command: "Home",
  orchestrator: "AI Assistant",
  estate: "AI Inventory",
  blueprint: "Company Plan",
  strategy: "AI Roadmap",
  process: "Process Redesign",
  work: "Work Signals",
  factory: "Use Cases",
  harness: "AI Harness",
  skills: "AI Skills",
  workflow: "Workflow Builder",
  connectors: "Connect Apps",
  broker: "Tool Permissions",
  context: "Knowledge Sources",
  evals: "Quality Evals",
  governance: "Risk Review",
  launch: "Launch Plan",
  evidence: "Proof Ledger",
  roi: "Value & ROI",
  training: "Adoption Plan",
  reports: "Reports",
  admin: "Settings",
  session: "Skill Session",
};

export function orchestratorViewFromPrompt(message: string): View | null {
  const text = message.toLowerCase();

  return viewPromptTerms.find((entry) => entry.terms.some((term) => text.includes(term)))?.view ?? null;
}

export function orchestratorActionForView(view: View, label?: string): OrchestratorAction {
  return buildOrchestratorAction("open_view", label ?? `Open ${viewLabels[view] ?? view}`, "Navigate to this OS surface.", {
    view,
  });
}
