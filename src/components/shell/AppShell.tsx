"use client";

import {
  Activity,
  ArrowLeft,
  Bell,
  Bot,
  Boxes,
  ChevronDown,
  ChevronRight,
  Command,
  FileCheck2,
  Gauge,
  HelpCircle,
  Library,
  Moon,
  Route,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import type { OrganizationSettings, WorkspaceMode } from "@/lib/workspace-schema";
import type { ExperienceMode } from "@/lib/ui/experience-mode";
import type { InterfaceMode } from "@/lib/ui/interface-mode";
import type { ProductionReadiness, View } from "@/lib/ui/types";
import { readStoredValue, writeStoredValue } from "@/lib/ui/storage";
import { navHubs, navItems } from "@/lib/ui/constants";
import { getCurrentPageGuide, type CurrentPageGuide } from "@/lib/ui/page-guides";
import { Badge, IconButton } from "@/components/ui";
import { initials } from "@/components/factory/shared";
import { useTheme } from "@/lib/ui/use-theme";

type AppShellProps = {
  organization: OrganizationSettings;
  activeView: View;
  activeSurfaceLabel?: string;
  selectedUseCaseTitle?: string | null;
  selectedSkillName?: string | null;
  selectedRunId?: string | null;
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
  workspaceMode: WorkspaceMode;
  productionReadiness: ProductionReadiness | null;
  workspaceSaveStatus: "ready" | "saving" | "saved" | "local_fallback" | "rate_limited" | "restricted";
  workspaceSavedAt?: string;
  assistantBusy: boolean;
  experienceMode: ExperienceMode;
  interfaceMode: InterfaceMode;
  children: ReactNode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  onOpenView: (view: View) => void;
  onToggleHub: (hubId: string) => void;
  onOpenLaunchFlow: () => void;
  onBackHome: () => void;
  onCommandQueryChange: (query: string) => void;
  onCommandOpen: () => void;
  onOpenNotifications: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onExperienceModeChange: (mode: ExperienceMode) => void;
  onInterfaceModeChange: (mode: InterfaceMode) => void;
  onToggleProfile: () => void;
  onCloseProfile: () => void;
  onGlobalAssistantSubmit: (prompt: string) => void | Promise<void>;
};

type AtlasTone = "violet" | "teal" | "blue" | "green" | "amber";

export function AppShell({
  organization,
  activeView,
  activeSurfaceLabel,
  selectedUseCaseTitle,
  selectedSkillName,
  selectedRunId,
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
  workspaceMode,
  productionReadiness,
  workspaceSaveStatus,
  workspaceSavedAt,
  assistantBusy,
  experienceMode,
  interfaceMode,
  children,
  onWorkspaceModeChange,
  onOpenView,
  onToggleHub,
  onOpenLaunchFlow,
  onBackHome,
  onCommandQueryChange,
  onCommandOpen,
  onOpenNotifications,
  onOpenHelp,
  onOpenSettings,
  onExperienceModeChange,
  onInterfaceModeChange,
  onToggleProfile,
  onCloseProfile,
  onGlobalAssistantSubmit,
}: AppShellProps) {
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const ambientInputRef = useRef<HTMLInputElement>(null);
  const previousActiveViewRef = useRef<View>(activeView);
  const focusContentOnViewChangeRef = useRef(false);
  const [allSectionsOpen, setAllSectionsOpen] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [ambientPrompt, setAmbientPrompt] = useState("");
  const [ambientExpanded, setAmbientExpanded] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(() => readStoredValue("eaieos:atlas-workbench-open", false));
  const toggleWorkbench = () => {
    setWorkbenchOpen((open) => {
      const next = !open;
      writeStoredValue("eaieos:atlas-workbench-open", next);
      return next;
    });
  };
  const guidedExperience = experienceMode === "guided";
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
    shortLabel: string;
    helper: string;
    target: View;
    icon: ComponentType<{ size?: number; className?: string }>;
    views: View[];
  }[] = [
    {
      label: "Ask what to do",
      shortLabel: "Ask AI",
      helper: "Assistant checks the workspace",
      target: "orchestrator",
      icon: Bot,
      views: ["orchestrator", "command", "estate"],
    },
    {
      label: "Find AI work",
      shortLabel: "Find work",
      helper: "Turn pain into a use case",
      target: "factory",
      icon: Boxes,
      views: ["blueprint", "strategy", "work", "factory", "process"],
    },
    {
      label: "Build a Skill",
      shortLabel: "Build",
      helper: "Package, test, and govern it",
      target: "skills",
      icon: Library,
      views: ["skills", "workflow", "harness", "connectors", "broker", "context", "evals", "session"],
    },
    {
      label: "Prove it worked",
      shortLabel: "Prove",
      helper: "Evidence, value, launch proof",
      target: "evidence",
      icon: FileCheck2,
      views: ["governance", "launch", "evidence", "roi", "reports", "training", "admin"],
    },
  ];
  const activeIntent = intentShortcuts.find((intent) => intent.views.includes(activeView)) ?? intentShortcuts[0]!;
  const ActiveIntentIcon = activeIntent.icon;
  const mobileNavTargets: View[] = ["work", "orchestrator", "governance", "evidence", "roi"];
  const mobileNavItems = mobileNavTargets
    .map((target) => navItems.find((item) => item.id === target))
    .filter((item): item is (typeof navItems)[number] => item !== undefined);
  const mobileNavLabels: Partial<Record<View, string>> = {
    work: "Capture",
    orchestrator: "Ask",
    governance: "Approve",
    evidence: "Impact",
    roi: "Value",
  };
  const mobileActiveView: View =
    ["command", "estate", "blueprint", "strategy", "work", "factory", "process"].includes(activeView)
      ? "work"
      : activeView === "governance" || activeView === "launch"
      ? "governance"
      : activeView === "evidence" || activeView === "reports"
        ? "evidence"
        : activeView === "roi" || activeView === "training" || activeView === "admin"
          ? "roi"
          : activeView === "orchestrator"
            ? "orchestrator"
            : "command";
	  const atlasNavGroups: {
	    id: string;
	    label: string;
	    helper: string;
	    tone: AtlasTone;
	    target: View;
	    icon: ComponentType<{ size?: number; className?: string }>;
	    views: View[];
	  }[] = [
    {
	      id: "home",
	      label: "Home",
	      helper: "Mission, assistant, inventory",
	      tone: "violet",
	      target: "command",
	      icon: Command,
	      views: ["command", "orchestrator", "estate"],
	    },
    {
	      id: "find",
	      label: "Find",
	      helper: "Plan, signals, use cases",
	      tone: "teal",
	      target: "work",
	      icon: Boxes,
	      views: ["blueprint", "strategy", "work", "factory", "process"],
	    },
    {
	      id: "build",
	      label: "Build",
	      helper: "Skills, workflows, apps, evals",
	      tone: "blue",
	      target: "skills",
	      icon: Library,
	      views: ["skills", "workflow", "harness", "connectors", "broker", "context", "evals", "session"],
	    },
    {
	      id: "prove",
	      label: "Prove",
	      helper: "Review, launch, evidence, value",
	      tone: "green",
	      target: "evidence",
	      icon: FileCheck2,
	      views: ["governance", "launch", "evidence", "roi", "reports"],
	    },
    {
	      id: "admin",
	      label: "Admin",
	      helper: "Adoption and workspace ops",
	      tone: "amber",
	      target: "admin",
	      icon: Settings,
	      views: ["training", "admin"],
	    },
	  ];
  const activeAtlasGroup = atlasNavGroups.find((group) => group.views.includes(activeView)) ?? atlasNavGroups[0]!;
  const activeAtlasGroupIndex = Math.max(0, atlasNavGroups.findIndex((group) => group.id === activeAtlasGroup.id));
  const ActiveAtlasGroupIcon = activeAtlasGroup.icon;
  const atlasGroupItems = activeAtlasGroup.views
    .map((view) => navItems.find((item) => item.id === (view === "session" ? "skills" : view)))
    .filter((item, index, items): item is (typeof navItems)[number] =>
      Boolean(item) && items.findIndex((candidate) => candidate?.id === item?.id) === index,
    );
  const nextGuideItem = navItems.find((item) => item.id === activeGuide.nextView);
  const atlasNextLabel = nextGuideItem?.label ?? activeGuide.nextLabel;
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
        ? `${launchBlockerCount} block`
        : `${launchWarningCount} rev`;
  const launchStatusChipClassName: Record<NonNullable<ProductionReadiness["status"]>, string> = {
    ready: "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    degraded: "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    blocked: "border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
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
      dotClassName: "bg-[var(--border-strong)]",
      className: "border-[var(--border)]/80 bg-[var(--surface)]/72 text-[var(--text-muted)]",
    },
    saving: {
      label: "Saving",
      detail: "Writing workspace snapshot",
      dotClassName: "bg-blue-500 animate-pulse",
      className: "border-[color-mix(in_srgb,var(--info)_24%,var(--border))] bg-[var(--info-soft)] text-[var(--info)]",
    },
    saved: {
      label: workspaceSavedAt ? `Saved ${workspaceSavedAt}` : "Saved",
      detail: "Server snapshot is current",
      dotClassName: "bg-green-500",
      className: "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    },
    local_fallback: {
      label: "Local fallback",
      detail: "Server sync failed; browser copy is safe",
      dotClassName: "bg-amber-500",
      className: "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    },
    rate_limited: {
      label: "Sync delayed",
      detail: "Server asked the workspace to retry later",
      dotClassName: "bg-amber-500",
      className: "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    },
    restricted: {
      label: "Sync disabled",
      detail: "Current role cannot write workspace snapshots",
      dotClassName: "bg-[var(--border-strong)]",
      className: "border-[var(--border)]/80 bg-[var(--surface)]/72 text-[var(--text-muted)]",
    },
  };
	  const workspaceSaveState = workspaceSaveCopy[workspaceSaveStatus];
	  const atlasToneStyles: Record<AtlasTone, CSSProperties> = {
	    violet: {
	      "--atlas-accent": "#5b5cf6",
	      "--atlas-accent-rgb": "91, 92, 246",
	      "--atlas-accent-2": "#0f8a9d",
	    } as CSSProperties,
	    teal: {
	      "--atlas-accent": "#0f8a9d",
	      "--atlas-accent-rgb": "15, 138, 157",
	      "--atlas-accent-2": "#2563eb",
	    } as CSSProperties,
	    blue: {
	      "--atlas-accent": "#2563eb",
	      "--atlas-accent-rgb": "37, 99, 235",
	      "--atlas-accent-2": "#7c3aed",
	    } as CSSProperties,
	    green: {
	      "--atlas-accent": "#16a66a",
	      "--atlas-accent-rgb": "22, 166, 106",
	      "--atlas-accent-2": "#0f8a9d",
	    } as CSSProperties,
	    amber: {
	      "--atlas-accent": "#d97706",
	      "--atlas-accent-rgb": "217, 119, 6",
	      "--atlas-accent-2": "#16a66a",
	    } as CSSProperties,
	  };
	  const atlasAccentStyle = atlasToneStyles[activeAtlasGroup.tone];
  const stageTone: Record<CurrentPageGuide["stage"], "blue" | "purple" | "green" | "amber" | "slate"> = {
    Start: "blue",
    Find: "purple",
    Build: "blue",
    Prove: "green",
    Scale: "amber",
    Setup: "slate",
  };
  const nextAtlasGroup = atlasNavGroups[(activeAtlasGroupIndex + 1) % atlasNavGroups.length]!;
  const atlasLoopStatus = (
    <button
      type="button"
      aria-label={`Operating loop stage ${activeAtlasGroupIndex + 1} of ${atlasNavGroups.length}: ${activeGuide.stage}. Advance to the next stage, ${nextAtlasGroup.label}.`}
      title={`Operating loop ${activeAtlasGroupIndex + 1}/${atlasNavGroups.length} — click to advance to ${nextAtlasGroup.label}`}
      className="ea-atlas-mission-map hidden h-10 min-w-[150px] items-center gap-2 rounded-full border border-[var(--border)]/72 px-2.5 py-1 text-left shadow-[var(--shadow-button)] transition hover:border-[var(--atlas-accent)]/35 hover:bg-[var(--surface)] lg:flex"
      data-testid="atlas-loop-status"
      onClick={() => onOpenView(nextAtlasGroup.target)}
    >
      <span className="ea-atlas-loop-icon flex size-7 shrink-0 items-center justify-center rounded-full ring-1">
        <ActiveAtlasGroupIcon size={14} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Loop</span>
        <span className="block truncate text-xs font-bold text-[var(--text)]">{activeGuide.stage}</span>
      </span>
      <span
        className="ml-auto shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-black text-[var(--text-soft)]"
        aria-hidden="true"
      >
        {activeAtlasGroupIndex + 1}/{atlasNavGroups.length}
      </span>
    </button>
  );
  const workspaceBoundaryLabel = workspaceMode === "production" ? "Live tenant" : "Demo sandbox";
  const workspaceBoundaryDot = workspaceMode === "production" ? "bg-green-500" : "bg-blue-500";
  const missionTitle =
    activeView === "command"
      ? selectedUseCaseTitle ?? "First AI opportunity"
      : activeView === "orchestrator"
        ? "AI operator"
        : activeView === "estate"
          ? "AI inventory controls"
          : ["blueprint", "strategy", "work", "factory", "process"].includes(activeView)
            ? selectedUseCaseTitle ?? "First AI opportunity"
            : activeView === "skills" || activeView === "session" || activeView === "evals"
              ? selectedSkillName ?? "First governed Skill"
              : activeView === "workflow"
                ? selectedSkillName ? `${selectedSkillName} workflow` : "Workflow blueprint"
                : activeView === "harness"
                  ? selectedRunId ? `Run ${selectedRunId}` : selectedSkillName ? `${selectedSkillName} test run` : "First test run"
                  : activeView === "connectors" || activeView === "broker" || activeView === "context"
                    ? "Runtime controls"
                    : activeView === "governance"
                      ? "Review queue"
                      : activeView === "launch"
                        ? "Launch readiness"
                        : activeView === "evidence"
                          ? "Proof packet"
                          : activeView === "roi"
                            ? "Value proof"
                            : activeView === "training"
                              ? "Adoption plan"
                              : activeView === "admin"
                                ? "Workspace controls"
                                : activeLabel ?? organization.name;
  const missionRoleMode =
    activeAtlasGroup.id === "find"
      ? "Executive"
      : activeAtlasGroup.id === "build"
        ? "Builder"
        : activeAtlasGroup.id === "prove"
          ? "Reviewer"
          : "Operator";
  const missionOwner =
    activeAtlasGroup.id === "admin"
      ? "Ops owner"
      : activeAtlasGroup.id === "prove"
        ? "Reviewer"
        : activeAtlasGroup.id === "build"
          ? "Builder"
          : "Program owner";
  const reviewQueueLabel =
    actionInboxOpenCount > 0
      ? `${actionInboxOpenCount} action${actionInboxOpenCount === 1 ? "" : "s"}`
      : launchStatus === "ready"
        ? "Clear"
        : launchStatus === "blocked"
          ? `${launchBlockerCount} blockers`
          : `${launchWarningCount} gaps`;
  const reviewQueueView: View = launchStatus === "ready" ? "evidence" : "launch";
  function openReviewQueue() {
    if (actionInboxOpenCount > 0) {
      onOpenNotifications();
      return;
    }
    onOpenView(reviewQueueView);
  }
  const missionRiskLabel =
    launchStatus === "ready"
      ? "Controlled"
      : launchStatus === "blocked"
        ? "Blocked"
        : "Needs proof";
  const missionValueLabel = activeAtlasGroup.id === "prove" ? "Evidence first" : activeAtlasGroup.id === "find" ? "Baseline needed" : "Value tracked";
  const missionPrompt = `Inspect the current enablement thread for ${missionTitle}. Show the next blocker, evidence available, safe actions you can take, and what needs human approval.`;
  const assistantSuggestions = [
    {
      label: "Inspect mission",
      prompt: missionPrompt,
    },
    {
      label: "Draft next artifact",
      prompt: `Draft the next artifact for ${missionTitle}, then name the owner, evidence needed, and approval boundary.`,
    },
    {
      label: "Safe actions",
      prompt: `List the actions you can safely take for ${missionTitle}, the actions that need approval, and the proof each action would create.`,
    },
  ];
  const assistantPlaceholder = `Ask the operator to inspect, draft, execute safely, or explain approvals...`;
  const assistantContextLabel = `${activeAtlasGroup.label} · ${missionTitle}`;

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
    if (!settingsMenuOpen) return;

    window.requestAnimationFrame(() => {
      settingsMenuRef.current
        ?.querySelector<HTMLButtonElement>('button[role="menuitemradio"], button[role="menuitem"]')
        ?.focus({ preventScroll: true });
    });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (settingsButtonRef.current?.contains(target) || settingsMenuRef.current?.contains(target)) return;

      setSettingsMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setSettingsMenuOpen(false);
      window.requestAnimationFrame(() => {
        settingsButtonRef.current?.focus({ preventScroll: true });
      });
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsMenuOpen]);

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

  useEffect(() => {
    function handleGlobalShellShortcut(event: KeyboardEvent) {
      const target = event.target;
      const targetElement = target instanceof HTMLElement ? target : null;
      const isEditable =
        targetElement?.tagName === "INPUT" ||
        targetElement?.tagName === "TEXTAREA" ||
        targetElement?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onCommandOpen();
        return;
      }

      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isEditable) return;

      event.preventDefault();
      if (activeView === "orchestrator") {
        onCommandOpen();
        return;
      }

      setAmbientPrompt("");
      setAmbientExpanded(true);
      window.requestAnimationFrame(() => {
        const assistantInput = ambientInputRef.current;
        if (!assistantInput) return;

        assistantInput.focus({ preventScroll: true });
        assistantInput.value = "";
        setAmbientPrompt("");
      });
    }

    window.addEventListener("keydown", handleGlobalShellShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShellShortcut);
  }, [activeView, onCommandOpen]);

  function settingsMenuItems() {
    return Array.from(
      settingsMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitemradio"]:not([disabled]), button[role="menuitem"]:not([disabled])',
      ) ?? [],
    );
  }

  function focusSettingsMenuItem(index: number) {
    const items = settingsMenuItems();
    if (!items.length) return;

    const boundedIndex = (index + items.length) % items.length;
    items[boundedIndex]?.focus({ preventScroll: true });
  }

  function handleSettingsMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = settingsMenuItems();
    if (!items.length) return;

    const currentIndex = Math.max(
      0,
      items.findIndex((item) => item === document.activeElement),
    );

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSettingsMenuOpen(false);
      window.requestAnimationFrame(() => {
        settingsButtonRef.current?.focus({ preventScroll: true });
      });
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusSettingsMenuItem(currentIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusSettingsMenuItem(currentIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusSettingsMenuItem(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusSettingsMenuItem(items.length - 1);
      return;
    }
  }

  function setExperienceModeFromMenu(mode: ExperienceMode) {
    onExperienceModeChange(mode);
    setSettingsMenuOpen(false);
    window.requestAnimationFrame(() => {
      settingsButtonRef.current?.focus({ preventScroll: true });
    });
  }

  function setInterfaceModeFromMenu(mode: InterfaceMode) {
    onInterfaceModeChange(mode);
    setSettingsMenuOpen(false);
    window.requestAnimationFrame(() => {
      settingsButtonRef.current?.focus({ preventScroll: true });
    });
  }

  function openSettingsFromMenu() {
    setSettingsMenuOpen(false);
    onOpenSettings();
  }

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

	  if (interfaceMode === "atlas") {
	    return (
	      <div
	        className="ea-atlas-shell ea-app-viewport overflow-hidden text-[var(--text)]"
	        data-experience-mode={experienceMode}
	        data-interface-mode={interfaceMode}
	        data-atlas-loop={activeAtlasGroup.id}
	        data-testid="app-shell"
	        style={atlasAccentStyle}
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

        <aside className="ea-atlas-rail fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-[var(--border)]/70 md:flex">
          <div className="flex h-16 shrink-0 items-center gap-3 px-3">
            <button
              type="button"
              aria-label="Open command center"
              className="ea-atlas-logo flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white shadow-[0_18px_40px_rgba(66,72,217,0.22)]"
              onClick={() => onOpenView("command")}
            >
              {(organization.name || "Enterprise").charAt(0).toUpperCase()}
            </button>
            <div className="ea-atlas-reveal min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--text)]">{organization.name}</div>
              <div className="truncate text-xs font-medium text-[var(--text-soft)]">{organization.workspaceLabel}</div>
            </div>
          </div>

          <nav aria-label="Atlas workspace navigation" className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
            {atlasNavGroups.map((group) => {
              const GroupIcon = group.icon;
              const active = group.id === activeAtlasGroup.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  aria-label={group.label}
                  title={group.label}
	                  className={`ea-atlas-rail-item flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left transition ${
	                    active
	                      ? "ea-atlas-rail-item--active text-[var(--primary-contrast)] shadow-[0_16px_34px_rgba(var(--atlas-accent-rgb),0.2)]"
	                      : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
	                  }`}
                  onClick={() => onOpenView(group.target)}
                >
	                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${active ? "bg-white/18" : "bg-[var(--surface-subtle)]"}`}>
	                      <GroupIcon size={16} />
	                    </span>
                  <span className="ea-atlas-reveal min-w-0">
                    <span className="block truncate text-sm font-semibold">{group.label}</span>
                    <span className={`block truncate text-[11px] font-medium ${active ? "text-white/72" : "text-[var(--text-soft)]"}`} data-guided-copy="true">
                      {group.helper}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[var(--border)]/70 p-3">
            <button
              type="button"
              aria-label="Workspace settings"
              className={`ea-atlas-rail-item flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left transition ${
                activeView === "admin"
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              }`}
              onClick={() => onOpenView("admin")}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)]">
                <UserRound size={16} />
              </span>
              <span className="ea-atlas-reveal min-w-0">
                <span className="block truncate text-sm font-semibold">Workspace Admin</span>
                <span className="block truncate text-[11px] font-medium text-[var(--text-soft)]">{profileDisplayName}</span>
              </span>
            </button>
          </div>
        </aside>

        <main aria-label="Enterprise AI workspace" className="ea-atlas-main ea-app-viewport flex min-w-0 flex-col overflow-hidden">
          <div
            aria-atomic="true"
            aria-live="polite"
            className="ea-sr-only"
            data-testid="workspace-page-announcement"
          >
            {activeLabel ?? "Workspace"} loaded{activeHelper ? `. ${activeHelper}` : ""}
          </div>

          <header className="ea-atlas-topbar z-20 flex min-h-14 shrink-0 items-center gap-2 px-3 py-1.5 md:gap-3 md:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
              {activeView !== "command" ? (
                <button
                  type="button"
                  aria-label="Back to Home"
                  title="Back to Home"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/80 text-[var(--text-muted)] shadow-[var(--shadow-button)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={onBackHome}
                >
                  <ArrowLeft size={16} />
                </button>
              ) : null}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
	                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/72 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">
	                    {activeAtlasGroup.label}
	                  </span>
                  <span className="hidden max-w-[9rem] truncate text-xs font-semibold text-[var(--text-soft)] sm:inline-block">{organization.name}</span>
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <div className="hidden truncate text-sm font-semibold text-[var(--text-muted)] md:block">{activeLabel}</div>
                </div>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center xl:flex">
              <div className="ea-atlas-search relative w-[min(560px,100%)]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} />
                <input
                  aria-label="Search the workspace"
                  aria-controls={commandOpen ? "command-menu-dialog" : undefined}
                  aria-haspopup="dialog"
                  className="h-10 w-full rounded-full border border-[var(--border)]/75 bg-[var(--surface)]/74 pl-10 pr-16 text-sm font-medium text-[var(--text-muted)] shadow-[var(--shadow-button)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
                  data-dialog-open={commandOpen ? "true" : "false"}
                  data-testid="workspace-search-input"
                  placeholder="Search, jump, ask, or run..."
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
                  className="absolute bottom-1 right-1 top-1 flex min-w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)] px-2.5 text-xs font-bold text-[var(--text-soft)] transition hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
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
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {workspaceMode === "demo" ? (
                <button
                  type="button"
                  onClick={() => onWorkspaceModeChange("production")}
                  title="Exploring sample data — click to switch to a live workspace"
                  data-testid="topbar-exit-demo"
                  className="group flex h-10 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--info)_32%,var(--border))] bg-[var(--info-soft)] px-3 text-xs font-semibold text-[var(--info)] shadow-[var(--shadow-button)] transition hover:brightness-[0.97] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--info)]" aria-hidden="true" />
                  <span className="max-w-[112px] truncate group-hover:hidden">Demo sandbox</span>
                  <span className="hidden max-w-[140px] truncate group-hover:inline">Exit to live →</span>
                </button>
              ) : (
                <div
                  className="hidden h-10 items-center gap-2 rounded-full border border-[var(--border)]/72 bg-[var(--surface)]/72 px-3 text-xs font-semibold text-[var(--text-muted)] shadow-[var(--shadow-button)] lg:flex"
                  title="Only live/imported company records are expected here"
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${workspaceBoundaryDot}`} aria-hidden="true" />
                  <span className="max-w-[112px] truncate">{workspaceBoundaryLabel}</span>
                </div>
              )}
              {atlasLoopStatus}
              <div
                role="status"
                aria-atomic="true"
                aria-live="polite"
                aria-label={`${workspaceSaveState.label}. ${workspaceSaveState.detail}`}
                className={`hidden h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-[var(--shadow-button)] lg:flex ${workspaceSaveState.className}`}
                data-testid="workspace-save-status"
                title={workspaceSaveState.detail}
              >
                <span className={`size-1.5 shrink-0 rounded-full ${workspaceSaveState.dotClassName}`} aria-hidden="true" />
                <span className="max-w-[118px] truncate">{workspaceSaveState.label}</span>
              </div>
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
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-[var(--surface)]">
                    {actionInboxOpenCount > 9 ? "9+" : actionInboxOpenCount}
                  </span>
                ) : null}
              </div>
              <span className="inline-flex">
                <IconButton
                  label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                  aria-pressed={resolvedTheme === "dark"}
                  onClick={toggleTheme}
                >
                  {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </IconButton>
              </span>
              <span className="hidden sm:inline-flex">
                <IconButton
                  label="Help"
                  aria-controls={helpOpen ? "help-walkthrough-dialog" : undefined}
                  aria-expanded={helpOpen}
                  aria-haspopup="dialog"
                  onClick={onOpenHelp}
                >
                  <HelpCircle size={16} />
                </IconButton>
              </span>
              <div className="relative hidden sm:block">
                <button
                  ref={settingsButtonRef}
                  type="button"
                  aria-controls={settingsMenuOpen ? "workspace-settings-menu" : undefined}
                  aria-expanded={settingsMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Workspace settings"
                  title="Workspace settings"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/82 text-[var(--text-muted)] shadow-[var(--shadow-button)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  data-testid="workspace-settings-menu-button"
                  onClick={() => {
                    onCloseProfile();
                    setSettingsMenuOpen((current) => !current);
                  }}
                >
                  <Settings size={16} />
                </button>

                {settingsMenuOpen ? (
                  <div
                    ref={settingsMenuRef}
                    id="workspace-settings-menu"
                    role="menu"
                    aria-label="Workspace settings menu"
                    className="absolute right-0 top-12 z-50 w-84 overflow-hidden rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/96 text-left shadow-[var(--shadow-elevated)] backdrop-blur-xl"
                    data-testid="workspace-settings-menu"
                    onKeyDown={handleSettingsMenuKeyDown}
                  >
                    <div className="border-b border-[var(--border)]/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Interface</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                            Atlas is the new streamlined AI operating shell. Classic keeps the original workspace layout.
                          </div>
                        </div>
                        <Badge tone="purple">Atlas</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {(["atlas", "classic"] as const).map((mode) => {
                        const selected = mode === "atlas";
                        return (
                          <button
                            key={mode}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={`rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                              selected
                                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                            }`}
                            data-testid={`interface-mode-${mode}`}
                            onClick={() => setInterfaceModeFromMenu(mode)}
                          >
                            <span className="block text-sm font-semibold capitalize">{mode}</span>
                            <span className="mt-0.5 block text-xs text-[var(--text-soft)]" data-guided-copy="true">
                              {mode === "atlas" ? "Collapsed rail and mission tabs" : "Original full navigation"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[var(--border)]/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Experience mode</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                            Guided shows coaching. Unguided removes extra explainers.
                          </div>
                        </div>
                        <Badge tone={guidedExperience ? "blue" : "slate"}>{guidedExperience ? "Guided" : "Unguided"}</Badge>
                      </div>
                    </div>
                    <div className="p-2">
                      {(["guided", "unguided"] as const).map((mode) => {
                        const selected = experienceMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                              selected
                                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                            }`}
                            data-testid={`experience-mode-${mode}`}
                            onClick={() => setExperienceModeFromMenu(mode)}
                          >
                            <span className="text-sm font-semibold capitalize">{mode}</span>
                            <span className={`size-2.5 rounded-full ${selected ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} />
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[var(--border)]/80 p-2">
                      <button
                        type="button"
                        role="menuitem"
                        aria-controls={settingsOpen ? "company-setup-dialog" : undefined}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                        onClick={openSettingsFromMenu}
                      >
                        <span>AI and workspace settings</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative hidden sm:block">
                <button
                  ref={profileButtonRef}
                  type="button"
                  aria-controls={profileOpen ? "workspace-profile-menu" : undefined}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-label="Workspace profile"
                  title="Workspace profile"
                  className="relative flex size-10 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--primary-contrast)] ring-1 ring-black/5 transition hover:ring-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={onToggleProfile}
                >
                  {initials(profileDisplayName)}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[var(--surface)] bg-green-500" />
                </button>

                {profileOpen ? (
                  <div
                    ref={profileMenuRef}
                    id="workspace-profile-menu"
                    role="menu"
                    aria-label="Workspace profile menu"
                    className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/96 text-left shadow-[var(--shadow-elevated)] backdrop-blur-xl"
                    data-testid="workspace-profile-menu"
                    onKeyDown={handleProfileMenuKeyDown}
                  >
                    <div className="border-b border-[var(--border)]/80 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)]">
                          {initials(profileDisplayName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">{profileDisplayName}</div>
                          <div className="truncate text-xs text-[var(--text-muted)]">{profileModeLabel}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--surface-muted)]/80 px-3 py-2 ring-1 ring-[var(--border)]/60">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Workspace</span>
                        <span className="max-w-[170px] truncate text-xs font-semibold text-[var(--text)]">{organization.name}</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80"
                        onClick={() => onOpenView("admin")}
                      >
                        <span>Workspace admin</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80"
                        onClick={onOpenLaunchFlow}
                      >
                        <span>{onboardingComplete ? "Launch handoff" : "Guided setup"}</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80"
                        onClick={onOpenSettings}
                      >
                        <span>Company setup</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <section className="shrink-0 border-b border-[var(--border)]/72 bg-[var(--surface)]/88 px-3 py-2 md:hidden" aria-label="Mobile command queue">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                aria-label={`Open current enablement thread: ${missionTitle}`}
                className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-left"
                onClick={() => onOpenView(activeAtlasGroup.target)}
              >
                <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">Thread</span>
                <span className="mt-0.5 block truncate text-xs font-bold text-[var(--text)]">{missionTitle}</span>
              </button>
              <button
                type="button"
                aria-label={`Open review queue: ${reviewQueueLabel}`}
                className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-left"
                onClick={openReviewQueue}
              >
                <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">Review</span>
                <span className="mt-0.5 block truncate text-xs font-bold text-[var(--text)]">{reviewQueueLabel}</span>
              </button>
              <button
                type="button"
                aria-label="Inspect current mission with AI"
                className="min-w-0 rounded-lg bg-[var(--primary)] px-2 py-2 text-left text-[var(--primary-contrast)] shadow-[var(--shadow-button)]"
                onClick={() => {
                  onOpenView("orchestrator");
                  void onGlobalAssistantSubmit(missionPrompt);
                }}
              >
                <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-white/72">AI</span>
                <span className="mt-0.5 block truncate text-xs font-bold">Inspect</span>
              </button>
            </div>
          </section>

          <section
            className="ea-atlas-workbench-strip hidden shrink-0 px-3 py-1 md:block md:px-4"
            aria-label="Atlas operating workbench"
            data-testid="atlas-workbench-strip"
          >
            <div className="ea-atlas-workbench mx-auto max-w-[1720px] rounded-xl border border-[var(--border)]/72 p-1">
              <div className="grid gap-1">
                <div className="flex items-center gap-1">
                <nav
                  aria-label={`${activeAtlasGroup.label} surfaces`}
                  className="ea-atlas-surface-switcher flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg p-1"
                >
                  {atlasGroupItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNavView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        className={`ea-atlas-surface-tab flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-left transition ${
	                          isActive
	                            ? "ea-atlas-surface-tab--active text-white shadow-[0_14px_28px_rgba(var(--atlas-accent-rgb),0.16)]"
	                            : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
	                        }`}
                        onClick={() => onOpenView(item.id)}
                      >
                        <Icon size={15} className="shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{item.label}</span>
                          <span
                            className={`mt-0.5 hidden max-w-[150px] truncate text-[11px] font-medium lg:block ${
                              isActive ? "text-white/68" : "text-[var(--text-soft)]"
                            }`}
                            data-guided-copy="true"
                          >
                            {item.helper}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
                  <button
                    type="button"
                    onClick={toggleWorkbench}
                    aria-expanded={workbenchOpen}
                    aria-label={workbenchOpen ? "Collapse workbench" : "Expand workbench"}
                    title={workbenchOpen ? "Collapse workbench" : "Expand workbench"}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 text-[var(--text-soft)] transition hover:border-[var(--atlas-accent)]/30 hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  >
                    <ChevronDown size={16} className={`transition ${workbenchOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div className={`ea-atlas-operator-summary grid min-w-0 gap-1 rounded-lg p-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.82fr)_minmax(0,0.82fr)_auto] ${workbenchOpen ? "" : "!hidden"}`}>
                  <button
                    type="button"
                    className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 px-3 text-left text-[var(--text-muted)] transition hover:border-[var(--atlas-accent)]/30 hover:bg-[var(--surface)] hover:text-[var(--text)] hover:shadow-[var(--shadow-button)]"
                    onClick={() => onOpenView(activeAtlasGroup.target)}
                  >
                    <Route size={15} className="shrink-0 text-[var(--primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">Enablement thread</span>
                      <span className="block truncate text-sm font-bold text-[var(--text)]">{missionTitle}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 px-3 text-left text-[var(--text-muted)] transition hover:border-[var(--atlas-accent)]/30 hover:bg-[var(--surface)] hover:text-[var(--text)] hover:shadow-[var(--shadow-button)]"
                    onClick={openReviewQueue}
                  >
                    <Gauge size={15} className="shrink-0 text-[var(--primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">Review queue</span>
                      <span className="block truncate text-sm font-bold text-[var(--text)]">{reviewQueueLabel}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/76 px-3 text-left text-[var(--text-muted)] transition hover:border-[var(--atlas-accent)]/30 hover:bg-[var(--surface)] hover:text-[var(--text)] hover:shadow-[var(--shadow-button)]"
                    onClick={() => onOpenView("evidence")}
                  >
                    <FileCheck2 size={15} className="shrink-0 text-[var(--primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">{missionRoleMode} · {missionOwner}</span>
                      <span className="block truncate text-sm font-bold text-[var(--text)]">{missionRiskLabel} · {missionValueLabel}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-sm font-bold text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={() => {
                      onOpenView("orchestrator");
                      void onGlobalAssistantSubmit(missionPrompt);
                    }}
                    aria-label="Inspect current mission with AI Operator"
                    title="Inspect current mission with AI Operator"
                  >
                    <Activity size={16} />
                    <span className="hidden lg:inline">Inspect</span>
                  </button>
	                </div>
	                <div className={`ea-atlas-context-lens mt-1 hidden gap-1 rounded-lg p-1 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.44fr)_auto] 2xl:items-center ${workbenchOpen ? "" : "!hidden"}`}>
	                  <div className="min-w-0 rounded-xl px-3 py-1.5">
	                    <div className="flex min-w-0 items-center gap-2">
	                      <span className="size-2 shrink-0 rounded-full bg-[var(--atlas-accent)] shadow-[0_0_0_4px_rgba(var(--atlas-accent-rgb),0.12)]" aria-hidden="true" />
	                      <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Smart lens</span>
	                    </div>
	                    <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">{activeGuide.plainUse}</p>
	                  </div>
	                  <div className="hidden min-w-0 rounded-xl border border-[var(--border)]/58 bg-[var(--surface)]/50 px-3 py-1.5 2xl:block" data-guided-copy="true">
	                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-soft)]">Watch</div>
	                    <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-muted)]">{activeGuide.watchFor}</p>
	                  </div>
	                  <div className="flex min-w-0 items-center gap-1.5">
	                    <button
	                      type="button"
	                      className="ea-atlas-lens-next inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-bold text-white shadow-[var(--shadow-button)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
	                      onClick={() => onOpenView(activeGuide.nextView)}
	                    >
	                      {atlasNextLabel}
	                      <ChevronRight size={15} />
	                    </button>
	                    <button
	                      type="button"
	                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 px-3 text-sm font-bold text-[var(--text-muted)] transition hover:border-[var(--atlas-accent)]/35 hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
	                      onClick={() => {
	                        onOpenView("orchestrator");
	                        void onGlobalAssistantSubmit(`Use the ${activeLabel ?? activeAtlasGroup.label} smart lens. Explain the current purpose, risks to watch, and the next action for ${organization.name}.`);
	                      }}
	                    >
	                      <Sparkles size={15} />
	                      <span className="hidden xl:inline">Ask</span>
	                    </button>
	                  </div>
	                </div>
                  <div className={`ea-atlas-intelligence-rail hidden flex-wrap items-center gap-1.5 rounded-lg px-3 py-1.5 2xl:flex ${workbenchOpen ? "" : "!hidden"}`} aria-label="Workspace intelligence shortcuts">
                    <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface)]/76 px-2.5 py-1 text-[11px] font-bold text-[var(--text-muted)] ring-1 ring-[var(--border)]/64">
                      <span className={`size-1.5 rounded-full ${launchStatusDotClassName[launchStatus]}`} aria-hidden="true" />
                      {launchStatusLabel}
                    </span>
                    <span className="rounded-full bg-[var(--surface)]/64 px-2.5 py-1 text-[11px] font-bold text-[var(--text-muted)] ring-1 ring-[var(--border)]/56">
                      {workspaceSaveState.label}
                    </span>
                    {assistantSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.prompt}
                        type="button"
                        className="rounded-full border border-transparent px-2.5 py-1 text-[11px] font-bold text-[var(--text-muted)] transition hover:border-[var(--atlas-accent)]/30 hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                        onClick={() => {
                          onOpenView("orchestrator");
                          void onGlobalAssistantSubmit(suggestion.prompt);
                        }}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                    <span className="ml-auto hidden text-[11px] font-semibold text-[var(--text-soft)] 2xl:inline">Press / for AI, ⌘K for commands</span>
                  </div>
	              </div>
	            </div>
	          </section>

          <div
            ref={contentRef}
            id="workspace-main-content"
            role="region"
            aria-label={`${activeLabel ?? "Workspace"} content`}
            tabIndex={-1}
            className={`min-h-0 flex-1 overflow-y-auto focus:outline-none ${
              activeView === "orchestrator" ? "p-0" : "px-2 pb-24 pt-2 md:px-4 md:pb-28"
            }`}
            data-testid="app-content-scroll"
          >
            <div
              key={activeView}
              className={`ea-atlas-content-shell ea-page-enter mx-auto w-full max-w-[1720px] ${
                activeView === "orchestrator" || activeView === "session"
                  ? "ea-atlas-content-shell--console h-full min-h-0"
                  : "ea-atlas-content-shell--standard"
              }`}
            >
              {children}
            </div>
          </div>

          {activeView !== "orchestrator" ? (
            <form
              aria-label="Ask Enterprise AI Assistant from anywhere"
              className={`fixed bottom-4 left-[calc(72px+(100vw-72px)/2)] z-30 hidden -translate-x-1/2 md:block ${
                ambientExpanded
                  ? "w-[min(820px,calc(100vw-112px))]"
                  : "w-[min(520px,calc(100vw-112px))]"
              }`}
              data-testid="global-assistant-pill"
              onSubmit={submitAmbientAssistant}
            >
              <div className={`ea-atlas-assistant-pill overflow-hidden rounded-full transition ${ambientExpanded ? "rounded-2xl" : ""}`}>
                <div className="flex min-h-11 items-center gap-2 px-2">
                  <button
                    type="button"
                    aria-label="Open AI Assistant"
                    title="Open AI Assistant"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={() => onOpenView("orchestrator")}
                  >
                    <Sparkles size={17} />
                  </button>
                  <label htmlFor="global-assistant-input" className="sr-only">
                    Ask Enterprise AI Assistant
                  </label>
                  <input
                    ref={ambientInputRef}
                    id="global-assistant-input"
                    className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
                    placeholder={assistantPlaceholder}
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
                  <span className="hidden max-w-[190px] truncate rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/64 px-2.5 py-1 text-[11px] font-bold text-[var(--text-soft)] lg:inline">
                    {assistantContextLabel}
                  </span>
                  <button
                    type="submit"
                    disabled={assistantBusy}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={ambientPrompt.trim() ? "Send to AI Assistant" : "Open AI Assistant"}
                    title={ambientPrompt.trim() ? "Send to AI Assistant" : "Open AI Assistant"}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                {ambientExpanded ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)]/76 px-3 pb-3 pt-2">
                    {assistantSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.prompt}
                        type="button"
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                        disabled={assistantBusy}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setAmbientPrompt("");
                          setAmbientExpanded(false);
                          onOpenView("orchestrator");
                          void onGlobalAssistantSubmit(suggestion.prompt);
                        }}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </form>
          ) : null}

          <nav
            aria-label="Primary mobile navigation"
            className="mx-3 mb-[calc(3rem+env(safe-area-inset-bottom,0px))] grid shrink-0 grid-cols-5 gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/92 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl md:hidden"
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
                  aria-label={`${shortLabel}: ${item.label}`}
                  title={`${shortLabel}: ${item.label}`}
                  data-mobile-nav-view={item.id}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition ${
                    isActive ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
    );
  }

  return (
    <div
      className="ea-app-viewport overflow-hidden bg-[var(--background)] text-[var(--text)]"
      data-experience-mode={experienceMode}
      data-interface-mode={interfaceMode}
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
      <div className="ea-app-viewport flex min-h-0">
        <aside className="ea-app-rail fixed inset-y-0 left-0 z-20 hidden w-[var(--rail-width)] flex-col border-r border-[var(--border)]/70 md:flex">
          <div className="flex h-[72px] items-center gap-3 border-b border-[var(--border)]/70 px-4">
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
              <div className="truncate text-[15px] font-semibold tracking-tight">{organization.name}</div>
              <div className="truncate text-xs font-medium text-[var(--text-muted)]">{organization.workspaceLabel}</div>
            </div>
          </div>

          <nav
            aria-label="Primary workspace navigation"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-0 pt-3.5"
          >
            {guidedExperience ? (
              <button
                type="button"
                aria-label={onboardingComplete ? "Open launch handoff" : "Open guided setup"}
                className="ea-operating-card flex w-full shrink-0 items-center justify-between rounded-lg px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]/24 hover:bg-[var(--surface)]"
                data-guided-only="true"
                data-testid="guided-setup-nav"
                onClick={onOpenLaunchFlow}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm">
                    <Sparkles size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">
                      {onboardingComplete ? "Next launch steps" : "Start here"}
                    </span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {onboardingComplete ? "Open the rollout plan" : "Set up the first AI path"}
                    </span>
                  </span>
                </span>
                <Badge tone={onboardingComplete ? "green" : "blue"}>{onboardingComplete ? "open" : "start"}</Badge>
              </button>
            ) : null}

            <div className="ea-surface flex min-h-0 flex-1 flex-col rounded-lg p-2.5" data-testid="nav-intent-shortcuts">
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg bg-[var(--surface-muted)]/86 px-3 py-3 text-left text-[var(--text)] ring-1 ring-[var(--border)]/55 transition hover:bg-[var(--surface)] hover:shadow-[var(--shadow-button)]"
                data-guided-only="true"
                onClick={() => onOpenView(activeIntent.target)}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] ring-1 ring-[var(--border)]/80">
                  <ActiveIntentIcon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                    Current focus
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">{activeIntent.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{activeLabel ?? activeIntent.helper}</span>
                </span>
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Operating modes">
                {intentShortcuts.map((intent) => {
                  const IntentIcon = intent.icon;
                  const active = intent.views.includes(activeView);
                  return (
                    <button
                      key={intent.label}
                      type="button"
                      aria-label={intent.label}
                      title={intent.label}
                      className={`flex min-h-[58px] items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                        active
                          ? "bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/16"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                      }`}
                      onClick={() => onOpenView(intent.target)}
                    >
                      <IntentIcon size={16} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{intent.shortLabel}</span>
                        <span
                          className={`mt-0.5 block line-clamp-2 text-[10px] leading-3 ${active ? "text-[var(--primary)]/75" : "text-[var(--text-soft)]"}`}
                          data-guided-copy="true"
                        >
                          {intent.helper}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className="mt-2 flex min-h-0 flex-1 flex-col border-t border-[var(--border)]/80 pt-2"
                data-open={allSectionsOpen}
                data-testid="nav-all-sections"
              >
                <button
                  type="button"
                  aria-controls="primary-nav-scroll"
                  aria-expanded={allSectionsOpen}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => setAllSectionsOpen((current) => !current)}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-[var(--text-muted)]">All sections</span>
                    <span className="block truncate text-[11px] font-medium text-[var(--text-soft)]" data-guided-copy="true">
                      {activeIntent.label} · {activeLabel ?? "Current section"}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className={`shrink-0 text-[var(--text-soft)] transition ${allSectionsOpen ? "rotate-90" : ""}`}
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
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                              hubHasActiveItem
                                ? "bg-[var(--surface-muted)] text-[var(--text)] ring-1 ring-[var(--border)]/80"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                            }`}
                            data-testid={`nav-hub-${hub.id}`}
                            onClick={() => onToggleHub(hub.id)}
                          >
                            <span className="min-w-0">
                              <span className="block text-[11px] font-bold uppercase tracking-[0.14em]">{hub.label}</span>
                              <span className="block truncate text-[11px] font-medium text-[var(--text-soft)]" data-guided-copy="true">{hub.helper}</span>
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
                                    className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${
                                      isActive
                                        ? "bg-[var(--primary-soft)]/72 text-[var(--primary)] ring-1 ring-[var(--primary)]/12 shadow-[inset_3px_0_0_var(--primary)]"
                                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                                    }`}
                                    onClick={() => onOpenView(item.id)}
                                  >
                                    <Icon size={17} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="block truncate" data-nav-label>{item.label}</span>
                                      <span
                                        className={`mt-0.5 block truncate text-[11px] font-medium ${isActive ? "text-[var(--primary)]/75" : "text-[var(--text-soft)]"}`}
                                        data-guided-copy="true"
                                      >
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

          <div className="border-t border-[var(--border)]/80 p-3">
            <button
              type="button"
              aria-label="Workspace Admin"
              className="ea-surface flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]/20 hover:bg-[var(--surface)]"
              onClick={() => onOpenView("admin")}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)]/90 text-[var(--text-muted)]">
                {profileDisplayName ? (
                  <span className="text-xs font-bold text-[var(--text-muted)]">{initials(profileDisplayName)}</span>
                ) : (
                  <UserRound size={18} />
              )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="whitespace-nowrap text-[13px] font-semibold leading-5" data-testid="workspace-admin-label">Workspace Admin</div>
                <div className="truncate text-xs text-[var(--text-muted)]">{organization.name}</div>
              </div>
              <ChevronDown size={15} className="shrink-0 text-[var(--text-soft)]" />
            </button>
          </div>
        </aside>

        <main
          aria-label="Enterprise AI workspace"
          className="ea-main-frame ea-app-viewport flex min-w-0 flex-1 flex-col overflow-hidden md:ml-[var(--rail-width)]"
        >
          <div
            aria-atomic="true"
            aria-live="polite"
            className="ea-sr-only"
            data-testid="workspace-page-announcement"
          >
            {activeLabel ?? "Workspace"} loaded{activeHelper ? `. ${activeHelper}` : ""}
          </div>
          <header className="ea-shell-glass z-10 flex min-h-[72px] shrink-0 items-center justify-between gap-3 px-3 py-2.5 md:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {activeView !== "command" ? (
                <button
                  type="button"
                  aria-label="Back to Home"
                  title="Back to Home"
                  className="flex size-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]/80 bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--primary)]/24 hover:bg-[var(--primary-soft)]/45 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={onBackHome}
                >
                  <ArrowLeft size={16} />
                </button>
              ) : null}
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className="rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]"
                    data-guided-copy="true"
                  >
                    {activeGuide.stage}
                  </span>
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">{organization.name}</span>
                </div>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="min-w-0 truncate text-[19px] font-semibold leading-6 tracking-tight text-[var(--text)]">{activeLabel}</div>
                  <button
                    type="button"
                    aria-label={`Open Launch Plan: ${launchStatusLabel}`}
                    title={`Open Launch Plan: ${launchStatusLabel}`}
                    className={`hidden h-10 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold leading-none shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition hover:border-[var(--primary)]/28 hover:bg-[var(--surface)] hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] sm:inline-flex ${launchStatusChipClassName[launchStatus]}`}
                    onClick={() => onOpenView("launch")}
                  >
                    <span className={`size-1.5 rounded-full ${launchStatusDotClassName[launchStatus]}`} aria-hidden="true" />
                    <span>{launchStatusDisplayLabel}</span>
                  </button>
                </div>
                {activeHelper ? (
                  <div
                    className="mt-1 hidden max-w-[520px] truncate text-xs leading-5 text-[var(--text-muted)] sm:block"
                    data-guided-copy="true"
                  >
                    {activeHelper}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                role="status"
                aria-atomic="true"
                aria-live="polite"
                aria-label={`${workspaceSaveState.label}. ${workspaceSaveState.detail}`}
                className={`hidden h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[var(--shadow-button)] xl:flex ${workspaceSaveState.className}`}
                data-testid="workspace-save-status"
                title={workspaceSaveState.detail}
              >
                <span className={`size-1.5 shrink-0 rounded-full ${workspaceSaveState.dotClassName}`} aria-hidden="true" />
                <span className="max-w-[132px] truncate">{workspaceSaveState.label}</span>
              </div>
              <div className="relative hidden xl:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} />
                <input
                  aria-label="Search the workspace"
                  aria-controls={commandOpen ? "command-menu-dialog" : undefined}
                  aria-haspopup="dialog"
                  className="h-10 w-[420px] rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/82 pl-9 pr-14 text-sm font-medium text-[var(--text-muted)] outline-none shadow-[var(--shadow-button)] transition placeholder:text-[var(--text-soft)] hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--primary-soft)]"
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
                  className="absolute bottom-0 right-0 top-0 flex min-w-12 items-center justify-center rounded-r-lg border-l border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
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
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-[var(--surface)]">
                    {actionInboxOpenCount > 9 ? "9+" : actionInboxOpenCount}
                  </span>
                ) : null}
              </div>
              <IconButton
                label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                aria-pressed={resolvedTheme === "dark"}
                onClick={toggleTheme}
              >
                {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
              <IconButton
                label="Help"
                aria-controls={helpOpen ? "help-walkthrough-dialog" : undefined}
                aria-expanded={helpOpen}
                aria-haspopup="dialog"
                onClick={onOpenHelp}
              >
                <HelpCircle size={16} />
              </IconButton>
              <div className="relative">
                <button
                  ref={settingsButtonRef}
                  type="button"
                  aria-controls={settingsMenuOpen ? "workspace-settings-menu" : undefined}
                  aria-expanded={settingsMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Workspace settings"
                  title="Workspace settings"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/82 text-[var(--text-muted)] shadow-[var(--shadow-button)] transition-[background-color,border-color,color,box-shadow] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  data-testid="workspace-settings-menu-button"
                  onClick={() => {
                    onCloseProfile();
                    setSettingsMenuOpen((current) => !current);
                  }}
                >
                  <Settings size={16} />
                </button>

                {settingsMenuOpen ? (
                  <div
                    ref={settingsMenuRef}
                    id="workspace-settings-menu"
                    role="menu"
                    aria-label="Workspace settings menu"
                    className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/95 text-left shadow-[var(--shadow-elevated)] backdrop-blur-xl"
                    data-testid="workspace-settings-menu"
                    onKeyDown={handleSettingsMenuKeyDown}
                  >
                    <div className="border-b border-[var(--border)]/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Interface</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                            Switch between the new Atlas shell and the original full-sidebar workspace.
                          </div>
                        </div>
                        <Badge tone="slate">Classic</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {(["atlas", "classic"] as const).map((mode) => {
                        const selected = mode === "classic";
                        return (
                          <button
                            key={mode}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={`rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                              selected
                                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80 hover:text-[var(--text)]"
                            }`}
                            data-testid={`interface-mode-${mode}`}
                            onClick={() => setInterfaceModeFromMenu(mode)}
                          >
                            <span className="block text-sm font-semibold capitalize">{mode}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-[var(--text-soft)]" data-guided-copy="true">
                              {mode === "atlas" ? "Icon rail, mission tabs, focused canvas." : "Original full navigation."}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-b border-[var(--border)]/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Experience mode</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                            Guided keeps coaching and explainers visible. Unguided gives expert operators a cleaner workspace.
                          </div>
                        </div>
                        <Badge tone={guidedExperience ? "blue" : "slate"}>{guidedExperience ? "Guided" : "Unguided"}</Badge>
                      </div>
                    </div>
                    <div className="p-2">
                      {(["guided", "unguided"] as const).map((mode) => {
                        const selected = experienceMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                              selected
                                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80 hover:text-[var(--text)]"
                            }`}
                            data-testid={`experience-mode-${mode}`}
                            onClick={() => setExperienceModeFromMenu(mode)}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold capitalize">{mode}</span>
                              <span className="mt-0.5 block text-xs leading-5 text-[var(--text-soft)]" data-guided-copy="true">
                                {mode === "guided"
                                  ? "Show onboarding, page guidance, helper copy, and explainer cards."
                                  : "Hide extra coaching so pages read like an expert control surface."}
                              </span>
                            </span>
                            <span
                              className={`mt-1 size-2.5 shrink-0 rounded-full ${
                                selected ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[var(--border)]/80 p-2">
                      <button
                        type="button"
                        role="menuitem"
                        aria-controls={settingsOpen ? "company-setup-dialog" : undefined}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]/80 hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                        onClick={openSettingsFromMenu}
                      >
                        <span>AI and workspace settings</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <button
                  ref={profileButtonRef}
                  type="button"
                  aria-controls={profileOpen ? "workspace-profile-menu" : undefined}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-label="Workspace profile"
                  title="Workspace profile"
                  className="relative flex size-10 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--primary-contrast)] ring-1 ring-black/5 transition hover:ring-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={onToggleProfile}
                >
                  {initials(profileDisplayName)}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[var(--surface)] bg-green-500" />
                </button>

                {profileOpen ? (
                  <div
                    ref={profileMenuRef}
                    id="workspace-profile-menu"
                    role="menu"
                    aria-label="Workspace profile menu"
                    className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/95 text-left shadow-[var(--shadow-elevated)] backdrop-blur-xl"
                    data-testid="workspace-profile-menu"
                    onKeyDown={handleProfileMenuKeyDown}
                  >
                    <div className="border-b border-[var(--border)]/80 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)]">
                          {initials(profileDisplayName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">{profileDisplayName}</div>
                          <div className="truncate text-xs text-[var(--text-muted)]">{profileModeLabel}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--surface-muted)]/80 px-3 py-2 ring-1 ring-[var(--border)]/60">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Workspace</span>
                        <span className="max-w-[170px] truncate text-xs font-semibold text-[var(--text)]">{organization.name}</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80"
                        onClick={() => onOpenView("admin")}
                      >
                        <span>Workspace admin</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80"
                        onClick={onOpenLaunchFlow}
                      >
                        <span>{onboardingComplete ? "Launch handoff" : "Guided setup"}</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/80"
                        onClick={onOpenSettings}
                      >
                        <span>Company setup</span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                    </div>
                    <div
                      className="border-t border-[var(--border)] bg-[var(--surface-muted)]/80 px-4 py-3 text-xs leading-5 text-[var(--text-muted)]"
                      data-guided-copy="true"
                    >
                      This menu controls the current workspace shell. Tenant branding, mode, imports, exports, and readiness gates live in Admin.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {guidedExperience && activeView !== "command" ? (
            <section
              aria-label="Current section guide"
              className="shrink-0 border-b border-[var(--border)]/72 bg-[var(--surface)]/62 px-4 py-2.5 backdrop-blur-xl md:px-7"
              data-testid="section-wayfinder"
            >
              <div className="mx-auto flex max-w-[1640px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Badge tone={stageTone[activeGuide.stage]}>{activeGuide.stage}</Badge>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--text)]">{activeLabel ?? "Current section"}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--text-muted)] sm:line-clamp-1">
                      {activeHelper ?? activeGuide.plainUse}
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
                  <div className="hidden min-w-0 max-w-[420px] truncate text-xs font-medium text-[var(--text-muted)] xl:block">
                    Watch: {activeGuide.watchFor}
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/88 px-3 text-xs font-semibold text-[var(--text-muted)] shadow-[var(--shadow-button)] transition hover:border-[var(--primary)]/24 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] sm:w-auto"
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
                : // Extra bottom padding so the last row of content clears the
                  // fixed global assistant pill (taller/higher on mobile).
                  "px-4 pt-4 pb-40 md:px-6 md:pt-6 md:pb-28 lg:px-9"
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
              className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 w-[min(680px,calc(100vw-1.5rem))] -translate-x-1/2 md:bottom-5 md:left-[calc(var(--rail-width)+(100vw-var(--rail-width))/2)] md:w-[min(820px,calc(100vw-var(--rail-width)-64px))]"
              data-testid="global-assistant-pill"
              onSubmit={submitAmbientAssistant}
            >
              <div
                className={`ea-command-pill overflow-hidden rounded-full transition ${
                  ambientExpanded ? "rounded-2xl" : ""
                }`}
              >
                <div className="flex min-h-12 items-center gap-2 px-2">
                  <button
                    type="button"
                    aria-label="Open AI Assistant"
                    title="Open AI Assistant"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={() => onOpenView("orchestrator")}
                  >
                    <Command size={17} />
                  </button>
                  <label htmlFor="global-assistant-input" className="sr-only">
                    Ask Enterprise AI Assistant
                  </label>
                  <input
                    ref={ambientInputRef}
                    id="global-assistant-input"
                    className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
                    placeholder="Ask Enablement OS what to do, open, report, or fix..."
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
                  <span className="hidden max-w-[190px] truncate rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/64 px-2.5 py-1 text-[11px] font-bold text-[var(--text-soft)] lg:inline">
                    {assistantContextLabel}
                  </span>
                  <button
                    type="submit"
                    disabled={assistantBusy}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={ambientPrompt.trim() ? "Send to AI Assistant" : "Open AI Assistant"}
                    title={ambientPrompt.trim() ? "Send to AI Assistant" : "Open AI Assistant"}
                  >
                    <Sparkles size={17} />
                  </button>
                </div>

                {ambientExpanded ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)]/76 px-3 pb-3 pt-2">
                    {[
                      "What needs attention?",
                      "Show highest ROI gap",
                      "Create proof packet",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
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
            className="mx-3 mb-[calc(3rem+env(safe-area-inset-bottom,0px))] grid shrink-0 grid-cols-5 gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/92 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl md:hidden"
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
                  aria-label={`${shortLabel}: ${item.label}`}
                  title={`${shortLabel}: ${item.label}`}
                  data-mobile-nav-view={item.id}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
                    isActive ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
