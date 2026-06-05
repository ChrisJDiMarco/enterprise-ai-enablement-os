"use client";

import {
  ArrowLeft,
  Bell,
  Bot,
  Boxes,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  HelpCircle,
  Library,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import type { OrganizationSettings } from "@/lib/workspace-schema";
import type { ProductionReadiness, View } from "@/lib/ui/types";
import { navHubs, navItems } from "@/lib/ui/constants";
import { getCurrentPageGuide, type CurrentPageGuide } from "@/lib/ui/page-guides";
import { Badge, IconButton } from "@/components/ui";
import { initials } from "@/components/factory/shared";

type AppShellProps = {
  organization: OrganizationSettings;
  activeView: View;
  selectedSkillName?: string | null;
  onboardingComplete: boolean;
  expandedHubs: Record<string, boolean>;
  activeHubId: string;
  commandQuery: string;
  actionInboxOpenCount: number;
  profileOpen: boolean;
  profileDisplayName: string;
  profileModeLabel: string;
  productionReadiness: ProductionReadiness | null;
  children: ReactNode;
  onOpenView: (view: View) => void;
  onToggleHub: (hubId: string) => void;
  onOpenLaunchFlow: () => void;
  onBackHome: () => void;
  onCommandQueryChange: (query: string) => void;
  onCommandOpen: () => void;
  onOpenNotifications: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onToggleProfile: () => void;
};

export function AppShell({
  organization,
  activeView,
  selectedSkillName,
  onboardingComplete,
  expandedHubs,
  activeHubId,
  commandQuery,
  actionInboxOpenCount,
  profileOpen,
  profileDisplayName,
  profileModeLabel,
  productionReadiness,
  children,
  onOpenView,
  onToggleHub,
  onOpenLaunchFlow,
  onBackHome,
  onCommandQueryChange,
  onCommandOpen,
  onOpenNotifications,
  onOpenHelp,
  onOpenSettings,
  onToggleProfile,
}: AppShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [allSectionsOpen, setAllSectionsOpen] = useState(true);
  const activeLabel =
    activeView === "session"
      ? selectedSkillName ?? "Skill Session"
      : navItems.find((item) => item.id === activeView)?.label;
  const activeHelper =
    activeView === "session"
      ? "Run a governed Skill with follow-up"
      : navItems.find((item) => item.id === activeView)?.helper;
  const activeGuide = getCurrentPageGuide(activeView);
  const intentShortcuts: {
    label: string;
    helper: string;
    target: View;
    icon: ComponentType<{ size?: number; className?: string }>;
    views: View[];
  }[] = [
    {
      label: "Ask what to do",
      helper: "Assistant checks the workspace",
      target: "orchestrator",
      icon: Bot,
      views: ["orchestrator", "command", "estate"],
    },
    {
      label: "Find AI work",
      helper: "Turn pain into a use case",
      target: "factory",
      icon: Boxes,
      views: ["blueprint", "strategy", "work", "factory", "process"],
    },
    {
      label: "Build a Skill",
      helper: "Package, test, and govern it",
      target: "skills",
      icon: Library,
      views: ["skills", "workflow", "harness", "connectors", "broker", "context", "evals", "session"],
    },
    {
      label: "Prove it worked",
      helper: "Evidence, value, launch proof",
      target: "evidence",
      icon: FileCheck2,
      views: ["governance", "launch", "evidence", "roi", "reports", "training", "admin"],
    },
  ];
  const activeIntent = intentShortcuts.find((intent) => intent.views.includes(activeView)) ?? intentShortcuts[0]!;
  const ActiveIntentIcon = activeIntent.icon;
  const mobileNavTargets: View[] = ["command", "orchestrator", "factory", "skills", "evidence"];
  const mobileNavItems = mobileNavTargets
    .map((target) => navItems.find((item) => item.id === target))
    .filter((item): item is (typeof navItems)[number] => item !== undefined);
  const launchStatus = productionReadiness?.status ?? "degraded";
  const launchStatusTone: Record<NonNullable<ProductionReadiness["status"]>, "green" | "amber" | "red"> = {
    ready: "green",
    degraded: "amber",
    blocked: "red",
  };
  const launchStatusLabel =
    launchStatus === "ready"
      ? "launch ready"
      : launchStatus === "blocked"
        ? `${productionReadiness?.blockers?.length ?? 0} launch blockers`
        : `${productionReadiness?.warnings?.length ?? 0} launch warnings`;
  const stageTone: Record<CurrentPageGuide["stage"], "blue" | "purple" | "green" | "amber" | "slate"> = {
    Start: "blue",
    Find: "purple",
    Build: "blue",
    Prove: "green",
    Scale: "amber",
    Setup: "slate",
  };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeView]);

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-slate-950">
      <div className="flex h-screen min-h-0">
        <aside className="ea-app-rail fixed inset-y-0 left-0 z-20 hidden w-[264px] flex-col border-r border-slate-200/46 backdrop-blur-xl md:flex">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200/44 px-5">
            {organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organization.logoUrl}
                alt={`${organization.name || "Tenant"} logo`}
                className="size-9 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div
                className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-[var(--primary-contrast)] shadow-sm ring-1 ring-black/5"
                style={{ backgroundColor: "var(--primary)" }}
              >
                {(organization.name || "Enterprise").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">{organization.name}</div>
              <div className="truncate text-xs text-slate-500">{organization.workspaceLabel}</div>
            </div>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-0 pt-3.5">
            <button
              type="button"
              aria-label={onboardingComplete ? "Open launch handoff" : "Open guided setup"}
              className="flex w-full shrink-0 items-center justify-between rounded-lg bg-white/62 px-3 py-2.5 text-left ring-1 ring-slate-200/50 transition hover:-translate-y-px hover:bg-[var(--primary-soft)]/62 hover:ring-[var(--primary)]/14"
              data-testid="guided-setup-nav"
              onClick={onOpenLaunchFlow}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm">
                  <Sparkles size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">
                    {onboardingComplete ? "Next launch steps" : "Start here"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {onboardingComplete ? "Open the rollout plan" : "Set up the first AI path"}
                  </span>
                </span>
              </span>
              <Badge tone={onboardingComplete ? "green" : "blue"}>{onboardingComplete ? "open" : "start"}</Badge>
            </button>

            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200/58 bg-white/56 p-2" data-testid="nav-intent-shortcuts">
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-md bg-[var(--primary-soft)] px-2.5 py-2.5 text-left text-[var(--primary)] transition hover:bg-[var(--primary-soft)]/78"
                onClick={() => onOpenView(activeIntent.target)}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/10">
                  <ActiveIntentIcon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--primary)]/68">
                    Current focus
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">{activeIntent.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{activeLabel ?? activeIntent.helper}</span>
                </span>
              </button>

              <div className="mt-2 grid grid-cols-4 gap-1">
                {intentShortcuts.map((intent) => {
                  const IntentIcon = intent.icon;
                  const active = intent.views.includes(activeView);
                  return (
                    <button
                      key={intent.label}
                      type="button"
                      aria-label={intent.label}
                      title={intent.label}
                      className={`flex h-9 items-center justify-center rounded-md transition ${
                        active
                          ? "bg-white text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/12"
                          : "text-slate-500 hover:bg-white hover:text-slate-950"
                      }`}
                      onClick={() => onOpenView(intent.target)}
                    >
                      <IntentIcon size={16} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-slate-200/58 pt-2" data-testid="nav-all-sections">
                <button
                  type="button"
                  aria-expanded={allSectionsOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-slate-500 transition hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => setAllSectionsOpen((current) => !current)}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-600">All sections</span>
                    <span className="block truncate text-[11px] font-medium text-slate-400">
                      {activeIntent.label} · {activeLabel ?? "Current section"}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className={`shrink-0 text-slate-400 transition ${allSectionsOpen ? "rotate-90" : ""}`}
                  />
                </button>
                {allSectionsOpen ? (
                  <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {navHubs.map((hub) => {
                      const isExpanded = expandedHubs[hub.id] || activeHubId === hub.id;
                      const hubHasActiveItem = activeHubId === hub.id;
                      return (
                        <div key={hub.id} className="rounded-md">
                          <button
                            type="button"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${hub.label}`}
                            aria-expanded={isExpanded}
                            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition ${
                              hubHasActiveItem
                                ? "bg-white/72 text-slate-950 shadow-[0_1px_0_rgba(15,23,42,0.02)] ring-1 ring-slate-200/46"
                                : "text-slate-500 hover:bg-white/54 hover:text-slate-950"
                            }`}
                            data-testid={`nav-hub-${hub.id}`}
                            onClick={() => onToggleHub(hub.id)}
                          >
                            <span className="min-w-0">
                              <span className="block text-[11px] font-bold uppercase tracking-[0.14em]">{hub.label}</span>
                              <span className="block truncate text-[11px] font-medium text-slate-400">{hub.helper}</span>
                            </span>
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                          {isExpanded ? (
                            <div className="mt-1 space-y-0.5 pl-2">
                              {hub.items.map((itemId) => {
                                const item = navItems.find((candidate) => candidate.id === itemId);
                                if (!item) return null;
                                const Icon = item.icon;
                                const isActive = activeView === item.id;
                                return (
                                  <button
                                    type="button"
                                    key={item.id}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition ${
                                      isActive
                                        ? "bg-[var(--primary-soft)]/72 text-[var(--primary)] ring-1 ring-[var(--primary)]/12 shadow-[inset_3px_0_0_var(--primary)]"
                                        : "text-slate-600 hover:bg-white/66 hover:text-slate-950"
                                    }`}
                                    onClick={() => onOpenView(item.id)}
                                  >
                                    <Icon size={17} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="block truncate">{item.label}</span>
                                      <span className={`mt-0.5 block truncate text-[11px] font-medium ${isActive ? "text-[var(--primary)]/75" : "text-slate-400"}`}>
                                        {item.helper}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </nav>

          <div className="border-t border-slate-200/48 p-3">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg bg-white/64 p-3 text-left ring-1 ring-slate-200/50 transition hover:bg-white"
              onClick={() => onOpenView("admin")}
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-slate-100/90 text-slate-600">
                {profileDisplayName ? (
                  <span className="text-xs font-bold text-slate-700">{initials(profileDisplayName)}</span>
                ) : (
                  <UserRound size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{profileDisplayName}</div>
                <div className="truncate text-xs text-slate-500">{organization.name}</div>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
          </div>
        </aside>

        <main className="ea-main-frame flex h-screen min-w-0 flex-1 flex-col overflow-hidden md:ml-[264px]">
          <header className="z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/42 bg-white/78 px-3 backdrop-blur-xl md:px-7">
            <div className="flex items-center gap-3">
              {activeView !== "command" ? (
                <button
                  type="button"
                  aria-label="Back to Home"
                  title="Back to Home"
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-200/68 bg-white/68 text-slate-600 transition hover:-translate-y-px hover:bg-white"
                  onClick={onBackHome}
                >
                  <ArrowLeft size={16} />
                </button>
              ) : null}
              <div>
                <div className="text-xs text-slate-500">{organization.name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold tracking-tight">{activeLabel}</div>
                  <button
                    type="button"
                    className="hidden rounded-full border border-slate-200 bg-white/78 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] lg:inline-flex"
                    onClick={() => onOpenView("launch")}
                  >
                    <Badge tone={launchStatusTone[launchStatus]}>{launchStatusLabel}</Badge>
                  </button>
                </div>
                {activeHelper ? <div className="hidden max-w-[360px] truncate text-xs text-slate-500 sm:block">{activeHelper}</div> : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <button
                  aria-label="Search the workspace"
                  className="flex h-9 w-[390px] items-center rounded-full border border-slate-200/62 bg-white/72 pl-9 pr-3 text-left text-sm text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.016)] outline-none transition hover:bg-white focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => {
                    onCommandQueryChange("");
                    onCommandOpen();
                  }}
                  type="button"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {commandQuery.trim() || "Search or type a goal..."}
                  </span>
                  <span className="ml-3 shrink-0 text-xs font-semibold text-slate-400">⌘K</span>
                </button>
              </div>
              <div className="relative">
                <span className="md:hidden">
                  <IconButton label="Search" onClick={onCommandOpen}>
                    <Search size={16} />
                  </IconButton>
                </span>
              </div>
              <div className="relative">
                <IconButton label="Notifications" onClick={onOpenNotifications}>
                  <Bell size={16} />
                </IconButton>
                {actionInboxOpenCount ? (
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-white">
                    {actionInboxOpenCount > 9 ? "9+" : actionInboxOpenCount}
                  </span>
                ) : null}
              </div>
              <IconButton label="Help" onClick={onOpenHelp}>
                <HelpCircle size={16} />
              </IconButton>
              <IconButton label="Company setup" onClick={onOpenSettings}>
                <Settings size={16} />
              </IconButton>
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={profileOpen}
                  aria-label="Workspace profile"
                  title="Workspace profile"
                className="relative flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--primary-contrast)] shadow-sm ring-1 ring-black/5 transition hover:-translate-y-px hover:ring-[var(--primary)]"
                  onClick={onToggleProfile}
                >
                  {initials(profileDisplayName)}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-green-500" />
                </button>

                {profileOpen ? (
                  <div
                    className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-slate-200/80 bg-white/95 text-left shadow-[var(--shadow-elevated)] backdrop-blur-xl"
                    data-testid="workspace-profile-menu"
                  >
                    <div className="border-b border-slate-100/80 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)]">
                          {initials(profileDisplayName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">{profileDisplayName}</div>
                          <div className="truncate text-xs text-slate-500">{profileModeLabel}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 ring-1 ring-slate-200/60">
                        <span className="text-xs font-semibold text-slate-500">Workspace</span>
                        <span className="max-w-[170px] truncate text-xs font-semibold text-slate-900">{organization.name}</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50/80"
                        onClick={() => onOpenView("admin")}
                      >
                        <span>Workspace admin</span>
                        <ChevronRight size={15} className="text-slate-400" />
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50/80"
                        onClick={onOpenLaunchFlow}
                      >
                        <span>{onboardingComplete ? "Launch handoff" : "Guided setup"}</span>
                        <ChevronRight size={15} className="text-slate-400" />
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50/80"
                        onClick={onOpenSettings}
                      >
                        <span>Company setup</span>
                        <ChevronRight size={15} className="text-slate-400" />
                      </button>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500">
                      This menu controls the current workspace shell. Tenant branding, mode, imports, exports, and readiness gates live in Admin.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {activeView !== "command" ? (
            <section
              aria-label="Current section guide"
              className="shrink-0 border-b border-slate-200/42 bg-white/62 px-4 py-2.5 backdrop-blur-xl md:px-7"
              data-testid="section-wayfinder"
            >
              <div className="mx-auto flex max-w-[1640px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Badge tone={stageTone[activeGuide.stage]}>{activeGuide.stage}</Badge>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{activeLabel ?? "Current section"}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 sm:line-clamp-1">
                      {activeHelper ?? activeGuide.plainUse}
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
                  <div className="hidden min-w-0 max-w-[420px] truncate text-xs font-medium text-slate-500 xl:block">
                    Watch: {activeGuide.watchFor}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/82 px-3 text-xs font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.016)] transition hover:-translate-y-px hover:border-[var(--primary)]/24 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] sm:w-auto"
                    data-testid="section-wayfinder-next"
                    onClick={() => onOpenView(activeGuide.nextView)}
                  >
                    <span className="truncate">Next: {activeGuide.nextLabel}</span>
                    <ChevronRight size={14} className="shrink-0" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-6 md:py-6 lg:px-9" data-testid="app-content-scroll">
            <div key={activeView} className="ea-page-shell ea-page-enter mx-auto w-full max-w-[1640px]">{children}</div>
          </div>
        </main>
      </div>

      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 gap-1 rounded-2xl border border-slate-200/70 bg-white/92 p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.18)] backdrop-blur-xl md:hidden"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-semibold transition ${
                isActive ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
              }`}
              onClick={() => onOpenView(item.id)}
            >
              <Icon size={16} />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
