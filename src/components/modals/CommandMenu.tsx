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
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui";
import { useDialogFocus } from "@/lib/ui/dialog-focus";
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
    "AI Harness": ["run tests", "run test", "harness", "trace", "test skill", "runtime", "tool approval"],
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
    "Adoption Plan": ["adoption", "training", "champions", "enablement", "users", "change management"],
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
  const {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  } = useDialogFocus<HTMLDivElement, HTMLInputElement>({
    restoreFocusSelector: '[data-testid="command-menu-opener"]',
  });
  const queryText = normalizeSearchText(query);
  const filtered = items
    .filter((item) => {
      return tokenMatch(commandSearchText(item), queryText);
    })
    .slice(0, queryText ? 12 : 8);
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
  const visibleGoalItemIds = new Set(visibleGoalTargets.map((goal) => goal.item.id));
  const visibleCommandResults = filtered.filter((item) => !visibleGoalItemIds.has(item.id));
  const groupedResults = visibleCommandResults.reduce<Record<string, CommandItem[]>>((groups, item) => {
    const group = groups[item.group] ?? [];
    group.push(item);
    return { ...groups, [item.group]: group };
  }, {});
  const menuInstanceId = useId().replaceAll(":", "");
  const visibleOptions = [
    ...visibleGoalTargets.map((goal) => ({ id: `goal-${goal.item.id}`, item: goal.item })),
    ...(commandResultsOpen ? visibleCommandResults.map((item) => ({ id: `command-${item.id}`, item })) : []),
  ];
  const [activeNavigation, setActiveNavigation] = useState({ index: 0, queryText: "" });
  const activeIndex =
    activeNavigation.queryText === queryText
      ? Math.min(activeNavigation.index, Math.max(visibleOptions.length - 1, 0))
      : 0;
  const activeOption = visibleOptions[activeIndex];
  const activeOptionId = activeOption ? `${menuInstanceId}-${activeOption.id}` : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  function commandTone(group: string) {
    if (group === "Skills") return "purple";
    if (group === "Use Cases") return "blue";
    if (group === "Runs") return "amber";
    if (group === "Command Orders") return "red";
    return "slate";
  }

  function closeMenu() {
    enableFocusRestore();
    setQuery("");
    onClose();
  }

  function runCommand(item: CommandItem) {
    disableFocusRestore();
    setQuery("");
    item.action();
  }

  function optionId(kind: "goal" | "command", itemId: string) {
    return `${menuInstanceId}-${kind}-${itemId}`;
  }

  function optionIndex(kind: "goal" | "command", itemId: string) {
    return visibleOptions.findIndex((option) => option.id === `${kind}-${itemId}`);
  }

  function activateOption(kind: "goal" | "command", itemId: string) {
    const nextIndex = optionIndex(kind, itemId);
    if (nextIndex >= 0) setActiveNavigation({ index: nextIndex, queryText });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDialogKeyDown(event)) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    if (!visibleOptions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveNavigation({ index: (activeIndex + 1) % visibleOptions.length, queryText });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveNavigation({ index: (activeIndex - 1 + visibleOptions.length) % visibleOptions.length, queryText });
      return;
    }

    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      runCommand(visibleOptions[activeIndex]!.item);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20 p-3 backdrop-blur-md sm:p-6" onClick={closeMenu}>
      <div
        ref={dialogRef}
        id="command-menu-dialog"
        aria-modal="true"
        aria-describedby={`${menuInstanceId}-description`}
        aria-labelledby={`${menuInstanceId}-title`}
        className="ea-surface mx-auto mt-5 max-h-[calc(100dvh-2.5rem)] max-w-3xl overflow-hidden rounded-lg sm:mt-14"
        data-testid="command-menu"
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-b border-[var(--border)]/64 bg-[var(--surface)]/54 px-4 py-4 backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)]/80 text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
              <Search size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div id={`${menuInstanceId}-title`} className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                What do you want to do?
              </div>
              <p id={`${menuInstanceId}-description`} className="sr-only">
                Search workspace views, commands, and next actions. Use arrow keys to move through results and Enter to choose.
              </p>
              <input
                ref={initialFocusRef}
                aria-label="Search workspace commands"
                aria-activedescendant={activeOptionId}
                aria-autocomplete="list"
                aria-controls={`${menuInstanceId}-options`}
                aria-expanded={visibleOptions.length > 0}
                className="mt-1 h-10 w-full border-0 bg-transparent text-base font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
                data-testid="command-menu-input"
                placeholder="Search workspace..."
                role="combobox"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              aria-label="Close command menu"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              onClick={closeMenu}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <HelpCircle size={13} />
              Try:
            </span>
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                className="inline-flex min-h-10 items-center rounded-full bg-[var(--surface)]/68 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)]/58 transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                onClick={() => setQuery(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100dvh-12.5rem)] overflow-y-auto bg-[var(--surface-muted)]/34 p-3 sm:max-h-[590px] sm:p-4">
          <div id={`${menuInstanceId}-options`}>
          {visibleGoalTargets.length ? (
            <div className="mb-4">
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                {queryText ? "Best intent matches" : "Common goals"}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleGoalTargets.map((goal) => {
                  const GoalIcon = goal.icon;
                  const goalOptionIndex = optionIndex("goal", goal.item.id);
                  const active = goalOptionIndex === activeIndex;

                  return (
                    <button
                      id={optionId("goal", goal.item.id)}
                      key={goal.item.id}
                      type="button"
                      className={`group flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-[var(--primary)]/35 bg-[var(--primary-soft)]/62 shadow-[inset_3px_0_0_var(--primary)]"
                          : "border-[var(--border)]/70 bg-[var(--surface)]/62 hover:border-[var(--primary)]/30 hover:bg-[var(--surface)]"
                      }`}
                      data-command-active={active ? "true" : undefined}
                      data-command-option="true"
                      onClick={() => runCommand(goal.item)}
                      onFocus={() => activateOption("goal", goal.item.id)}
                      onMouseEnter={() => activateOption("goal", goal.item.id)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)]/82 text-[var(--primary)] ring-1 ring-[var(--border)]/70">
                        <GoalIcon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--text)]">{goal.label}</span>
                          <ChevronRight
                            size={15}
                            className="mt-0.5 shrink-0 text-[var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                          />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{goal.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <details
            className="group rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/66 shadow-[var(--shadow-button)]"
            data-testid="command-results-drawer"
            open={commandResultsOpen}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                  {queryText ? "Matching commands" : "Browse all shortcuts"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                  {visibleCommandResults.length
                    ? `${visibleCommandResults.length} result${visibleCommandResults.length === 1 ? "" : "s"} available`
                    : visibleGoalTargets.length
                      ? "Best match is highlighted above"
                      : "No matching commands"}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
            </summary>

            <div className="hidden border-t border-[var(--border)]/82 p-2 group-open:block">
              {visibleCommandResults.length ? (
                <div className="space-y-3">
                  {Object.entries(groupedResults).map(([group, groupItems]) => (
                    <div key={group} className="overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/72">
                      <div className="border-b border-[var(--border)]/82 bg-[var(--surface)]/48 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                        {group}
                      </div>
                      <div className="divide-y divide-[var(--border)]/82">
                        {groupItems.map((item) => {
                          const resultOptionIndex = optionIndex("command", item.id);
                          const active = resultOptionIndex === activeIndex;

                          return (
                            <button
                              id={optionId("command", item.id)}
                              key={item.id}
                              type="button"
                              data-command-active={active ? "true" : undefined}
                              data-command-item="true"
                              data-command-option="true"
                              className={`grid w-full grid-cols-[82px_1fr_20px] items-center gap-2 px-3 py-3 text-left transition sm:grid-cols-[minmax(104px,124px)_1fr_24px] sm:gap-3 ${
                                active ? "bg-[var(--primary-soft)]/55 shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-[var(--surface)]/82"
                              }`}
                              onClick={() => runCommand(item)}
                              onFocus={() => activateOption("command", item.id)}
                              onMouseEnter={() => activateOption("command", item.id)}
                            >
                              <Badge tone={commandTone(item.group)}>
                                {item.group}
                              </Badge>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[var(--text)]">{item.label}</div>
                                <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.description}</div>
                              </div>
                              <ChevronRight size={16} className="text-[var(--text-soft)]" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !visibleGoalTargets.length ? (
                <div className="rounded-lg border border-dashed border-[var(--border)]/80 bg-[var(--surface)]/58 px-5 py-10 text-center">
                  <div className="text-sm font-semibold text-[var(--text)]">No matching command</div>
                  <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                    Try a simpler word like “risk,” “proof,” “skill,” or “report.” You can also open the AI Assistant and ask in a full sentence.
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {assistantGoal ? (
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition-colors hover:bg-[var(--primary-hover)]"
                        onClick={() => runCommand(assistantGoal.item)}
                      >
                        Ask AI Assistant
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/76 px-3.5 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
                      onClick={() => setQuery("")}
                    >
                      Show common goals
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border)]/80 bg-[var(--surface)]/58 px-5 py-7 text-center text-sm font-medium text-[var(--text-muted)]">
                  Press Enter to open the highlighted best match above, or try a broader search.
                </div>
              )}
            </div>
          </details>
          </div>
        </div>
      </div>
    </div>
  );
}
