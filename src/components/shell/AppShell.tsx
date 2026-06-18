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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import type { OrganizationSettings } from "@/lib/workspace-schema";
import type { ProductionReadiness, View } from "@/lib/ui/types";
import { navHubs, navItems } from "@/lib/ui/constants";
import { getCurrentPageGuide, type CurrentPageGuide } from "@/lib/ui/page-guides";
import { Badge, IconButton } from "@/components/ui";
import { initials } from "@/components/factory/shared";

type AppShellProps = {
  organization: OrganizationSettings;
  activeView: View;
  activeSurfaceLabel?: string;
  selectedSkillName?: string | null;
  onboardingComplete: boolean;
  expandedHubs: Record<string, boolean>;
  activeHubId: string;
  commandQuery: string;
  commandOpen: boolean;
  actionInboxOpenCount: number;
  notificationsOpen: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  profileOpen: boolean;
  profileDisplayName: string;
  profileModeLabel: string;
  productionReadiness: ProductionReadiness | null;
  workspaceSaveStatus: "ready" | "saving" | "saved" | "local_fallback" | "rate_limited" | "restricted";
  workspaceSavedAt?: string;
  assistantBusy: boolean;
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
  onCloseProfile: () => void;
  onGlobalAssistantSubmit: (prompt: string) => void | Promise<void>;
};

export function AppShell({
  organization,
  activeView,
  activeSurfaceLabel,
  selectedSkillName,
  onboardingComplete,
  expandedHubs,
  activeHubId,
  commandQuery,
  commandOpen,
  actionInboxOpenCount,
  notificationsOpen,
  helpOpen,
  settingsOpen,
  profileOpen,
  profileDisplayName,
  profileModeLabel,
  productionReadiness,
  workspaceSaveStatus,
  workspaceSavedAt,
  assistantBusy,
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
  onCloseProfile,
  onGlobalAssistantSubmit,
}: AppShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const previousActiveViewRef = useRef<View>(activeView);
  const focusContentOnViewChangeRef = useRef(false);
  const [allSectionsOpen, setAllSectionsOpen] = useState(true);
  const [ambientPrompt, setAmbientPrompt] = useState("");
  const [ambientExpanded, setAmbientExpanded] = useState(false);
  const activeLabel =
    activeSurfaceLabel ??
    (activeView === "session"
      ? selectedSkillName ?? "Skill Session"
      : navItems.find((item) => item.id === activeView)?.label);
  const activeHelper =
    activeView === "session"
      ? "Run a governed Skill with follow-up"
      : navItems.find((item) => item.id === activeView)?.helper;
  const activeNavView: View = activeView === "session" ? "skills" : activeView;
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
  const mobileNavLabels: Partial<Record<View, string>> = {
    command: "Home",
    orchestrator: "Ask",
    factory: "Cases",
    skills: "Build",
    evidence: "Impact",
  };
  const mobileActiveView: View =
    activeView === "estate"
      ? "command"
      : mobileNavTargets.includes(activeView)
        ? activeView
        : activeIntent.target;
  const launchStatus = productionReadiness?.status ?? "degraded";
  const launchBlockerCount = productionReadiness?.blockers?.length ?? 0;
  const launchWarningCount = productionReadiness?.warnings?.length ?? 0;
  const launchStatusLabel =
    launchStatus === "ready"
      ? "launch ready"
      : launchStatus === "blocked"
        ? `${launchBlockerCount} launch blockers`
        : `${launchWarningCount} launch warnings`;
  const launchStatusDisplayLabel =
    launchStatus === "ready"
      ? "Ready"
      : launchStatus === "blocked"
        ? `${launchBlockerCount} blockers`
        : `${launchWarningCount} warnings`;
  const launchStatusChipClassName: Record<NonNullable<ProductionReadiness["status"]>, string> = {
    ready: "border-green-200/80 bg-green-50/82 text-green-700",
    degraded: "border-amber-200/80 bg-amber-50/82 text-amber-800",
    blocked: "border-red-200/80 bg-red-50/82 text-red-700",
  };
  const launchStatusDotClassName: Record<NonNullable<ProductionReadiness["status"]>, string> = {
    ready: "bg-green-500",
    degraded: "bg-amber-500",
    blocked: "bg-red-500",
  };
  const workspaceSaveCopy: Record<AppShellProps["workspaceSaveStatus"], {
    label: string;
    detail: string;
    dotClassName: string;
    className: string;
  }> = {
    ready: {
      label: "Ready",
      detail: "Workspace persistence is available",
      dotClassName: "bg-slate-400",
      className: "border-slate-200/80 bg-white/72 text-slate-600",
    },
    saving: {
      label: "Saving",
      detail: "Writing workspace snapshot",
      dotClassName: "bg-blue-500 animate-pulse",
      className: "border-blue-200/80 bg-blue-50/70 text-blue-700",
    },
    saved: {
      label: workspaceSavedAt ? `Saved ${workspaceSavedAt}` : "Saved",
      detail: "Server snapshot is current",
      dotClassName: "bg-green-500",
      className: "border-green-200/80 bg-green-50/72 text-green-700",
    },
    local_fallback: {
      label: "Local fallback",
      detail: "Server sync failed; browser copy is safe",
      dotClassName: "bg-amber-500",
      className: "border-amber-200/80 bg-amber-50/72 text-amber-800",
    },
    rate_limited: {
      label: "Sync delayed",
      detail: "Server asked the workspace to retry later",
      dotClassName: "bg-amber-500",
      className: "border-amber-200/80 bg-amber-50/72 text-amber-800",
    },
    restricted: {
      label: "Sync disabled",
      detail: "Current role cannot write workspace snapshots",
      dotClassName: "bg-slate-400",
      className: "border-slate-200/80 bg-white/72 text-slate-600",
    },
  };
  const workspaceSaveState = workspaceSaveCopy[workspaceSaveStatus];
  const stageTone: Record<CurrentPageGuide["stage"], "blue" | "purple" | "green" | "amber" | "slate"> = {
    Start: "blue",
    Find: "purple",
    Build: "blue",
    Prove: "green",
    Scale: "amber",
    Setup: "slate",
  };

  useEffect(() => {
    const content = contentRef.current;
    content?.scrollTo({ top: 0 });

    if (previousActiveViewRef.current !== activeView && focusContentOnViewChangeRef.current) {
      window.requestAnimationFrame(() => {
        content?.focus({ preventScroll: true });
      });
    }
    focusContentOnViewChangeRef.current = false;
    previousActiveViewRef.current = activeView;
  }, [activeView]);

  useLayoutEffect(() => {
    const navScroller = navScrollRef.current;
    if (!navScroller || !allSectionsOpen) return;

    const activeItem = navScroller.querySelector<HTMLElement>(`[data-nav-view="${activeNavView}"]`);
    if (!activeItem) return;

    const inset = 10;
    const scrollerRect = navScroller.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const itemTop = itemRect.top - scrollerRect.top + navScroller.scrollTop;
    const itemBottom = itemRect.bottom - scrollerRect.top + navScroller.scrollTop;
    const visibleTop = navScroller.scrollTop + inset;
    const visibleBottom = navScroller.scrollTop + navScroller.clientHeight - inset;

    if (itemTop < visibleTop) {
      navScroller.scrollTop = Math.max(0, itemTop - inset);
    } else if (itemBottom > visibleBottom) {
      navScroller.scrollTop = Math.max(0, itemBottom - navScroller.clientHeight + inset);
    }
  }, [activeHubId, activeNavView, allSectionsOpen, expandedHubs]);

  useEffect(() => {
    if (!profileOpen) return;

    window.requestAnimationFrame(() => {
      profileMenuRef.current
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus({ preventScroll: true });
    });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (profileButtonRef.current?.contains(target) || profileMenuRef.current?.contains(target)) return;

      onCloseProfile();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      onCloseProfile();
      window.requestAnimationFrame(() => {
        profileButtonRef.current?.focus({ preventScroll: true });
      });
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCloseProfile, profileOpen]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const hideNextDevtoolsBadge = () => {
      const indicator = document
        .querySelector("nextjs-portal")
        ?.shadowRoot?.querySelector<HTMLElement>("#devtools-indicator");
      if (!indicator) return;

      indicator.style.display = "none";
    };

    hideNextDevtoolsBadge();
    const observer = new MutationObserver(hideNextDevtoolsBadge);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  function profileMenuItems() {
    return Array.from(profileMenuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])') ?? []);
  }

  function focusProfileMenuItem(index: number) {
    const items = profileMenuItems();
    if (!items.length) return;

    const boundedIndex = (index + items.length) % items.length;
    items[boundedIndex]?.focus({ preventScroll: true });
  }

  function handleProfileMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = profileMenuItems();
    if (!items.length) return;

    const currentIndex = Math.max(
      0,
      items.findIndex((item) => item === document.activeElement),
    );

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseProfile();
      window.requestAnimationFrame(() => {
        profileButtonRef.current?.focus({ preventScroll: true });
      });
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProfileMenuItem(currentIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusProfileMenuItem(currentIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusProfileMenuItem(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusProfileMenuItem(items.length - 1);
      return;
    }
  }

  async function submitAmbientAssistant(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const prompt = ambientPrompt.trim();

    if (!prompt || assistantBusy) {
      onOpenView("orchestrator");
      return;
    }

    setAmbientPrompt("");
    setAmbientExpanded(false);
    onOpenView("orchestrator");
    await onGlobalAssistantSubmit(prompt);
  }

  return (
    <div
      className="h-screen overflow-hidden bg-[var(--background)] text-slate-950"
      data-testid="app-shell"
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          focusContentOnViewChangeRef.current = true;
        }
      }}
      onPointerDownCapture={() => {
        focusContentOnViewChangeRef.current = true;
      }}
    >
      <a
        href="#workspace-main-content"
        className="ea-skip-link"
        onClick={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
          contentRef.current?.scrollTo({ top: 0 });
        }}
      >
        Skip to workspace content
      </a>
      <div className="flex h-screen min-h-0">
        <aside className="ea-app-rail fixed inset-y-0 left-0 z-20 hidden w-[268px] flex-col border-r border-slate-200/70 md:flex">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200/70 px-4">
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

          <nav
            aria-label="Primary workspace navigation"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-0 pt-3.5"
          >
            <button
              type="button"
              aria-label={onboardingComplete ? "Open launch handoff" : "Open guided setup"}
              className="ea-surface flex w-full shrink-0 items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:border-[var(--primary)]/24 hover:bg-white"
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

            <div className="ea-surface flex min-h-0 flex-1 flex-col rounded-lg p-2" data-testid="nav-intent-shortcuts">
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-md bg-slate-50/82 px-2.5 py-2.5 text-left text-slate-950 transition-colors hover:bg-white"
                onClick={() => onOpenView(activeIntent.target)}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-[var(--primary)] ring-1 ring-slate-200/80">
                  <ActiveIntentIcon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
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
                          ? "bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/12"
                          : "text-slate-500 hover:bg-white hover:text-slate-950"
                      }`}
                      onClick={() => onOpenView(intent.target)}
                    >
                      <IntentIcon size={16} />
                    </button>
                  );
                })}
              </div>

              <div
                className="mt-2 flex min-h-0 flex-1 flex-col border-t border-slate-200/80 pt-2"
                data-open={allSectionsOpen}
                data-testid="nav-all-sections"
              >
                <button
                  type="button"
                  aria-controls="primary-nav-scroll"
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
                  <div
                    id="primary-nav-scroll"
                    ref={navScrollRef}
                    className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
                    data-testid="primary-nav-scroll"
                  >
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
                                ? "bg-slate-50 text-slate-950 ring-1 ring-slate-200/80"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
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
                                const isActive = activeNavView === item.id;
                                return (
                                  <button
                                    type="button"
                                    key={item.id}
                                    aria-current={isActive ? "page" : undefined}
                                    data-nav-view={item.id}
                                    className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition ${
                                      isActive
                                        ? "bg-[var(--primary-soft)]/72 text-[var(--primary)] ring-1 ring-[var(--primary)]/12 shadow-[inset_2px_0_0_var(--primary)]"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                    }`}
                                    onClick={() => onOpenView(item.id)}
                                  >
                                    <Icon size={17} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="block truncate" data-nav-label>{item.label}</span>
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

          <div className="border-t border-slate-200/80 p-3">
            <button
              type="button"
              aria-label="Workspace Admin"
              className="ea-surface flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left transition-colors hover:border-[var(--primary)]/20 hover:bg-white"
              onClick={() => onOpenView("admin")}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100/90 text-slate-600">
                {profileDisplayName ? (
                  <span className="text-xs font-bold text-slate-700">{initials(profileDisplayName)}</span>
                ) : (
                  <UserRound size={18} />
              )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="whitespace-nowrap text-[13px] font-semibold leading-5" data-testid="workspace-admin-label">Workspace Admin</div>
                <div className="truncate text-xs text-slate-500">{organization.name}</div>
              </div>
              <ChevronDown size={15} className="shrink-0 text-slate-400" />
            </button>
          </div>
        </aside>

        <main
          aria-label="Enterprise AI workspace"
          className="ea-main-frame flex h-screen min-w-0 flex-1 flex-col overflow-hidden md:ml-[268px]"
        >
          <div
            aria-atomic="true"
            aria-live="polite"
            className="ea-sr-only"
            data-testid="workspace-page-announcement"
          >
            {activeLabel ?? "Workspace"} loaded{activeHelper ? `. ${activeHelper}` : ""}
          </div>
          <header className="z-10 flex min-h-[76px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/72 bg-white/90 px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.025)] backdrop-blur-xl md:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {activeView !== "command" ? (
                <button
                  type="button"
                  aria-label="Back to Home"
                  title="Back to Home"
                  className="flex size-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 transition hover:border-[var(--primary)]/24 hover:bg-[var(--primary-soft)]/45 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={onBackHome}
                >
                  <ArrowLeft size={16} />
                </button>
              ) : null}
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{organization.name}</div>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="min-w-0 truncate text-[17px] font-semibold leading-6 tracking-tight text-slate-950">{activeLabel}</div>
                  <button
                    type="button"
                    aria-label={`Open Launch Plan: ${launchStatusLabel}`}
                    title={`Open Launch Plan: ${launchStatusLabel}`}
                    className={`hidden h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold leading-none shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition hover:border-[var(--primary)]/28 hover:bg-white hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] sm:inline-flex ${launchStatusChipClassName[launchStatus]}`}
                    onClick={() => onOpenView("launch")}
                  >
                    <span className={`size-1.5 rounded-full ${launchStatusDotClassName[launchStatus]}`} aria-hidden="true" />
                    <span>{launchStatusDisplayLabel}</span>
                  </button>
                </div>
                {activeHelper ? <div className="mt-0.5 hidden max-w-[420px] truncate text-xs leading-5 text-slate-500 sm:block">{activeHelper}</div> : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                role="status"
                aria-atomic="true"
                aria-live="polite"
                aria-label={`${workspaceSaveState.label}. ${workspaceSaveState.detail}`}
                className={`hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[var(--shadow-button)] xl:flex ${workspaceSaveState.className}`}
                data-testid="workspace-save-status"
                title={workspaceSaveState.detail}
              >
                <span className={`size-1.5 shrink-0 rounded-full ${workspaceSaveState.dotClassName}`} aria-hidden="true" />
                <span className="max-w-[132px] truncate">{workspaceSaveState.label}</span>
              </div>
              <div className="relative hidden xl:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  aria-label="Search the workspace"
                  aria-controls={commandOpen ? "command-menu-dialog" : undefined}
                  aria-haspopup="dialog"
                  className="h-9 w-[390px] rounded-lg border border-slate-200/80 bg-white pl-9 pr-14 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary-soft)]"
                  data-dialog-open={commandOpen ? "true" : "false"}
                  data-testid="workspace-search-input"
                  placeholder="Search anything..."
                  value={commandQuery}
                  onChange={(event) => {
                    onCommandQueryChange(event.target.value);
                    onCommandOpen();
                  }}
                  onClick={onCommandOpen}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "ArrowDown") {
                      event.preventDefault();
                      onCommandOpen();
                    }
                  }}
                />
                <button
                  aria-label="Open command menu"
                  aria-controls={commandOpen ? "command-menu-dialog" : undefined}
                  aria-expanded={commandOpen}
                  aria-haspopup="dialog"
                  className="absolute bottom-0 right-0 top-0 flex min-w-12 items-center justify-center rounded-r-lg border-l border-slate-100 px-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  data-testid="command-menu-opener"
                  onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    onCommandQueryChange("");
                    onCommandOpen();
                  }}
                  type="button"
                >
                  ⌘K
                </button>
              </div>
              <div className="relative">
                <span className="xl:hidden">
                  <IconButton
                    label="Search"
                    aria-controls={commandOpen ? "command-menu-dialog" : undefined}
                    aria-expanded={commandOpen}
                    aria-haspopup="dialog"
                    onClick={onCommandOpen}
                  >
                    <Search size={16} />
                  </IconButton>
                </span>
              </div>
              <div className="relative">
                <IconButton
                  label="Notifications"
                  aria-controls={notificationsOpen ? "action-inbox-dialog" : undefined}
                  aria-expanded={notificationsOpen}
                  aria-haspopup="dialog"
                  onClick={onOpenNotifications}
                >
                  <Bell size={16} />
                </IconButton>
                {actionInboxOpenCount ? (
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-white">
                    {actionInboxOpenCount > 9 ? "9+" : actionInboxOpenCount}
                  </span>
                ) : null}
              </div>
              <IconButton
                label="Help"
                aria-controls={helpOpen ? "help-walkthrough-dialog" : undefined}
                aria-expanded={helpOpen}
                aria-haspopup="dialog"
                onClick={onOpenHelp}
              >
                <HelpCircle size={16} />
              </IconButton>
              <IconButton
                label="AI settings"
                aria-controls={settingsOpen ? "company-setup-dialog" : undefined}
                aria-expanded={settingsOpen}
                aria-haspopup="dialog"
                onClick={onOpenSettings}
              >
                <Settings size={16} />
              </IconButton>
              <div className="relative">
                <button
                  ref={profileButtonRef}
                  type="button"
                  aria-controls={profileOpen ? "workspace-profile-menu" : undefined}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-label="Workspace profile"
                  title="Workspace profile"
                  className="relative flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--primary-contrast)] ring-1 ring-black/5 transition hover:ring-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={onToggleProfile}
                >
                  {initials(profileDisplayName)}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-green-500" />
                </button>

                {profileOpen ? (
                  <div
                    ref={profileMenuRef}
                    id="workspace-profile-menu"
                    role="menu"
                    aria-label="Workspace profile menu"
                    className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-slate-200/80 bg-white/95 text-left shadow-[var(--shadow-elevated)] backdrop-blur-xl"
                    data-testid="workspace-profile-menu"
                    onKeyDown={handleProfileMenuKeyDown}
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
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50/80"
                        onClick={() => onOpenView("admin")}
                      >
                        <span>Workspace admin</span>
                        <ChevronRight size={15} className="text-slate-400" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50/80"
                        onClick={onOpenLaunchFlow}
                      >
                        <span>{onboardingComplete ? "Launch handoff" : "Guided setup"}</span>
                        <ChevronRight size={15} className="text-slate-400" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
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
              className="shrink-0 border-b border-slate-200/72 bg-white/76 px-4 py-2.5 backdrop-blur-xl md:px-7"
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
                    className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-[var(--primary)]/24 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] sm:w-auto"
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

          <div
            ref={contentRef}
            id="workspace-main-content"
            role="region"
            aria-label={`${activeLabel ?? "Workspace"} content`}
            tabIndex={-1}
            className={`min-h-0 flex-1 overflow-y-auto focus:outline-none ${
              activeView === "orchestrator"
                ? "p-0"
                : "px-4 pb-8 pt-4 md:px-6 md:py-6 lg:px-9"
            }`}
            data-testid="app-content-scroll"
          >
            <div
              key={activeView}
              className={`ea-page-shell ea-page-enter mx-auto w-full max-w-[1640px] ${
                activeView === "orchestrator" || activeView === "session"
                  ? "ea-page-shell--console h-full min-h-0"
                  : "ea-page-shell--standard"
              }`}
            >
              {children}
            </div>
          </div>

          {activeView !== "orchestrator" ? (
            <form
              aria-label="Ask Enterprise AI Assistant from anywhere"
              className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 w-[min(640px,calc(100vw-1.5rem))] -translate-x-1/2 md:bottom-5 md:left-[calc(268px+(100vw-268px)/2)] md:w-[min(720px,calc(100vw-340px))]"
              data-testid="global-assistant-pill"
              onSubmit={submitAmbientAssistant}
            >
              <div
                className={`overflow-hidden rounded-full border border-slate-200/80 bg-white/92 shadow-[0_18px_55px_rgba(15,23,42,0.16)] ring-1 ring-white/70 backdrop-blur-xl transition ${
                  ambientExpanded ? "rounded-2xl" : ""
                }`}
              >
                <div className="flex min-h-12 items-center gap-2 px-2">
                  <button
                    type="button"
                    aria-label="Open AI Assistant"
                    title="Open AI Assistant"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] transition hover:bg-[var(--primary)] hover:text-[var(--primary-contrast)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={() => onOpenView("orchestrator")}
                  >
                    <Bot size={18} />
                  </button>
                  <label htmlFor="global-assistant-input" className="sr-only">
                    Ask Enterprise AI Assistant
                  </label>
                  <input
                    id="global-assistant-input"
                    className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder="Ask Enablement OS anything or run work..."
                    value={ambientPrompt}
                    disabled={assistantBusy}
                    onFocus={() => setAmbientExpanded(true)}
                    onChange={(event) => setAmbientPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setAmbientExpanded(false);
                        event.currentTarget.blur();
                        return;
                      }

                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitAmbientAssistant();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={assistantBusy}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-contrast)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={ambientPrompt.trim() ? "Send to AI Assistant" : "Open AI Assistant"}
                    title={ambientPrompt.trim() ? "Send to AI Assistant" : "Open AI Assistant"}
                  >
                    <Sparkles size={17} />
                  </button>
                </div>

                {ambientExpanded ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-3 pb-3 pt-2">
                    {[
                      "What needs attention?",
                      "Show highest ROI gap",
                      "Create proof packet",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                        disabled={assistantBusy}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setAmbientPrompt("");
                          setAmbientExpanded(false);
                          onOpenView("orchestrator");
                          void onGlobalAssistantSubmit(prompt);
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </form>
          ) : null}

          <nav
            aria-label="Primary mobile navigation"
            className="mx-3 mb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] grid shrink-0 grid-cols-5 gap-1 rounded-2xl border border-slate-200/70 bg-white/92 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl md:hidden"
          >
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = mobileActiveView === item.id;
              const shortLabel = mobileNavLabels[item.id] ?? item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  data-mobile-nav-view={item.id}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
                    isActive ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  onClick={() => onOpenView(item.id)}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="max-w-full whitespace-nowrap">{shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </main>
      </div>
    </div>
  );
}
