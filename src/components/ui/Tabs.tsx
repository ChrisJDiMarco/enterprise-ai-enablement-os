"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { nextTabId, type TabNavigationItem } from "@/lib/ui/tab-navigation";

export function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel = "Section navigation",
  idBase,
  panelId,
}: {
  tabs: TabNavigationItem[];
  active: string;
  onChange: (tab: string) => void;
  ariaLabel?: string;
  idBase?: string;
  panelId?: (tab: string) => string;
}) {
  const generatedTabListId = useId().replaceAll(":", "");
  const tabListId = sanitizeDomId(idBase ?? generatedTabListId);
  const tabListRef = useRef<HTMLDivElement>(null);
  const activeLabel = tabs.find(([id]) => id === active)?.[1];

  // Keep the active tab in view when it changes via click or external state,
  // not just keyboard nav (which already scrolls in handleKeyDown).
  useEffect(() => {
    const node = tabListRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = nextTabId(tabs, active, event.key);
    if (!next) return;

    event.preventDefault();
    onChange(next);

    const nextIndex = tabs.findIndex(([id]) => id === next);
    const tabList = event.currentTarget.closest("[role='tablist']");
    window.requestAnimationFrame(() => {
      const nextTab = tabList?.querySelector<HTMLButtonElement>(`[data-tab-index="${nextIndex}"]`);
      nextTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
      nextTab?.focus();
    });
  }

  return (
    <>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className="ea-tabs-shell flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-full border border-[var(--border)]/68 bg-[var(--surface-muted)]/58 p-1 shadow-[var(--shadow-button)]"
      >
        {tabs.map(([id, label], index) => {
          const activeTab = active === id;
          return (
            <button
              id={tabId(tabListId, id)}
              key={id}
              type="button"
              role="tab"
              aria-controls={panelId?.(id)}
              aria-selected={activeTab}
              tabIndex={activeTab ? 0 : -1}
              data-tab-index={index}
              onClick={() => onChange(id)}
              onKeyDown={handleKeyDown}
              className={`relative min-h-10 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:bg-[var(--primary-soft)] focus-visible:ring-4 focus-visible:ring-[var(--primary)]/25 ${
                activeTab
                  ? "bg-[var(--surface)] text-[var(--primary)] shadow-[0_1px_0_rgba(15,23,42,0.05)] ring-1 ring-[var(--border)]/62"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface)]/56 hover:text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <span aria-live="polite" className="ea-sr-only">
        {activeLabel ? `${activeLabel} tab selected` : ""}
      </span>
    </>
  );
}

function sanitizeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "tabs";
}

export function tabId(tabListId: string, tab: string) {
  return `${sanitizeDomId(tabListId)}-${sanitizeDomId(tab)}-tab`;
}
