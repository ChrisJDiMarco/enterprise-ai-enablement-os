"use client";

import {
  Bot,
  Boxes,
  BrainCircuit,
  ChevronRight,
  FileCheck2,
  HelpCircle,
  Home as HomeIcon,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui";
import type { CommandItem } from "@/lib/ui/types";

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenMatch(searchText: string, queryText: string) {
  if (!queryText) return true;
  if (searchText.includes(queryText)) return true;

  const tokens = queryText.split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => searchText.includes(token));
}

function commandAliases(item: CommandItem) {
  const aliasesByLabel: Record<string, string[]> = {
    Home: ["start here", "what next", "next step", "today", "priority", "where do i start", "status overview"],
    "AI Assistant": ["ask", "chat", "help me", "what should i do", "route me", "explain"],
    "AI Inventory": ["inventory", "all ai", "owners", "shadow ai", "catalog"],
    "Company Plan": ["blueprint", "operating model", "rollout model", "readiness"],
    "AI Roadmap": ["strategy", "priorities", "sequence", "plan"],
    "Process Redesign": ["process", "handoff", "workflow before ai", "redesign work"],
    "Work Signals": ["signals", "pain", "where ai can help", "work intelligence"],
    "Use Cases": ["opportunity", "intake", "idea", "find ai work", "business problem"],
    "Run Tests": ["harness", "trace", "test skill", "runtime", "tool approval"],
    "AI Skills": ["skill", "agent", "copilot", "prompt", "build ai"],
    "Workflow Builder": ["workflow", "canvas", "execution", "automation", "graph"],
    "Connect Apps": ["connector", "connect data", "apps", "integration", "models", "tools"],
    "Tool Permissions": ["broker", "permissions", "approve tool", "tool access", "mcp"],
    "Knowledge Sources": ["context", "retrieval", "documents", "knowledge", "sources"],
    "Quality Evals": ["eval", "quality", "safety check", "red team", "reliability"],
    "Risk Review": ["governance", "risk", "approve", "approval", "approve launch", "launch approval", "legal", "security", "privacy"],
    "Launch Plan": ["launch", "rollout", "go live", "production", "checklist", "approve launch", "launch approval"],
    "Proof Ledger": ["evidence", "proof", "audit", "controls", "ledger"],
    "Value & ROI": ["roi", "value", "impact", "hours saved", "money", "cost"],
    Adoption: ["training", "champions", "enablement", "users", "change management"],
    Reports: ["brief", "executive", "exec brief", "update", "board", "summary"],
    Settings: ["admin", "workspace", "provider", "api key", "model settings", "tenant"],
  };

  return aliasesByLabel[item.label] ?? [];
}

function commandSearchText(item: CommandItem) {
  return normalizeSearchText([item.label, item.description, item.group, ...commandAliases(item)].join(" "));
}

export function CommandMenu({
  query,
  setQuery,
  items,
  onClose,
}: {
  query: string;
  setQuery: (value: string) => void;
  items: CommandItem[];
  onClose: () => void;
}) {
  const queryText = normalizeSearchText(query);
  const filtered = items
    .filter((item) => {
      return tokenMatch(commandSearchText(item), queryText);
    })
    .slice(0, queryText ? 12 : 8);
  const groupedResults = filtered.reduce<Record<string, CommandItem[]>>((groups, item) => {
    const group = groups[item.group] ?? [];
    group.push(item);
    return { ...groups, [item.group]: group };
  }, {});
  const goalTargets = [
    {
      label: "Know what to do next",
      helper: "Open Home for the current next action.",
      target: "Home",
      icon: HomeIcon,
      aliases: ["what next", "next step", "today", "priority", "where do i start", "status"],
    },
    {
      label: "Ask for help",
      helper: "Let the AI Assistant inspect and route work.",
      target: "AI Assistant",
      icon: Bot,
      aliases: ["ask", "chat", "help", "explain", "what should i do"],
    },
    {
      label: "Find AI opportunities",
      helper: "Score and shape the first use case.",
      target: "Use Cases",
      icon: Boxes,
      aliases: ["use case", "opportunity", "idea", "find work", "pain", "intake"],
    },
    {
      label: "Build a Skill",
      helper: "Create a governed AI capability.",
      target: "AI Skills",
      icon: BrainCircuit,
      aliases: ["skill", "agent", "copilot", "prompt", "build ai"],
    },
    {
      label: "Review risk",
      helper: "Approve, condition, or request changes.",
      target: "Risk Review",
      icon: ShieldCheck,
      aliases: ["risk", "approve", "approval", "approve launch", "launch approval", "legal", "security", "privacy", "governance"],
    },
    {
      label: "Find proof",
      helper: "Open the audit-ready evidence chain.",
      target: "Proof Ledger",
      icon: FileCheck2,
      aliases: ["proof", "evidence", "audit", "controls", "ledger"],
    },
  ]
    .map((goal) => {
      const item = items.find((candidate) => candidate.label === goal.target);
      return item ? { ...goal, item } : null;
    })
    .filter((goal): goal is {
      label: string;
      helper: string;
      target: string;
      icon: typeof HomeIcon;
      aliases: string[];
      item: CommandItem;
    } => Boolean(goal));
  const matchingGoalTargets = goalTargets.filter((goal) =>
    tokenMatch(normalizeSearchText([goal.label, goal.helper, goal.target, ...goal.aliases].join(" ")), queryText),
  );
  const visibleGoalTargets = (queryText ? matchingGoalTargets : goalTargets).slice(0, queryText ? 4 : 6);
  const assistantGoal = goalTargets.find((goal) => goal.target === "AI Assistant");
  const exampleQueries = ["what next", "approve launch", "connect data", "proof", "build agent", "exec brief"];
  const commandResultsOpen = Boolean(queryText) || !visibleGoalTargets.length;

  function commandTone(group: string) {
    if (group === "Skills") return "purple";
    if (group === "Use Cases") return "blue";
    if (group === "Runs") return "amber";
    if (group === "Command Orders") return "red";
    return "slate";
  }

  function closeMenu() {
    setQuery("");
    onClose();
  }

  function runCommand(item: CommandItem) {
    setQuery("");
    item.action();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/24 p-3 backdrop-blur-sm sm:p-6" onClick={closeMenu}>
      <div
        aria-modal="true"
        className="mx-auto mt-5 max-h-[calc(100vh-2.5rem)] max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.24)] sm:mt-14"
        data-testid="command-menu"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Search size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">What do you want to do?</div>
              <input
                autoFocus
                className="mt-1 h-8 w-full border-0 bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                placeholder="Type a goal, page, use case, Skill, run, or proof..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              aria-label="Close command menu"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
              onClick={closeMenu}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <HelpCircle size={13} />
              Try:
            </span>
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                onClick={() => setQuery(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100vh-12.5rem)] overflow-y-auto p-3 sm:max-h-[590px] sm:p-4">
          {visibleGoalTargets.length ? (
            <div className="mb-4">
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {queryText ? "Best intent matches" : "Common goals"}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleGoalTargets.map((goal) => {
                  const GoalIcon = goal.icon;

                  return (
                    <button
                      key={goal.label}
                      type="button"
                      className="group flex items-start gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/45"
                      onClick={() => runCommand(goal.item)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] ring-1 ring-slate-200">
                        <GoalIcon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-950">{goal.label}</span>
                          <ChevronRight
                            size={15}
                            className="mt-0.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                          />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{goal.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <details
            className="group rounded-lg border border-slate-200/70 bg-white"
            data-testid="command-results-drawer"
            open={commandResultsOpen}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {queryText ? "Matching commands" : "Browse all shortcuts"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {filtered.length ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} available` : "No matching commands"}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400 transition group-open:rotate-90" />
            </summary>

            <div className="hidden border-t border-slate-100 p-2 group-open:block">
              {filtered.length ? (
                <div className="space-y-3">
                  {Object.entries(groupedResults).map(([group, groupItems]) => (
                    <div key={group} className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                      <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {group}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {groupItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            data-command-item="true"
                            className="grid w-full grid-cols-[82px_1fr_20px] items-center gap-2 px-3 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(104px,124px)_1fr_24px] sm:gap-3"
                            onClick={() => runCommand(item)}
                          >
                            <Badge tone={commandTone(item.group)}>
                              {item.group}
                            </Badge>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-950">{item.label}</div>
                              <div className="mt-1 truncate text-xs text-slate-500">{item.description}</div>
                            </div>
                            <ChevronRight size={16} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                  <div className="text-sm font-semibold text-slate-950">No matching command</div>
                  <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Try a simpler word like “risk,” “proof,” “skill,” or “report.” You can also open the AI Assistant and ask in a full sentence.
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {assistantGoal ? (
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition hover:bg-[var(--primary-hover)]"
                        onClick={() => runCommand(assistantGoal.item)}
                      >
                        Ask AI Assistant
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setQuery("")}
                    >
                      Show common goals
                    </button>
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
