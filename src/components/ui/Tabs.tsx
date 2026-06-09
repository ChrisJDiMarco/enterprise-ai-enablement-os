import { useId, type KeyboardEvent } from "react";
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
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className="flex min-w-0 max-w-full flex-wrap gap-1 overflow-x-visible border-b border-slate-200/70 bg-transparent"
    >
      {tabs.map(([id, label], index) => {
        const activeTab = active === id;
        return (
          <button
            id={tabId(tabListId, id)}
            key={id}
            type="button"
            role="tab"
            aria-controls={activeTab ? panelId?.(id) : undefined}
            aria-selected={activeTab}
            tabIndex={activeTab ? 0 : -1}
            data-tab-index={index}
            onClick={() => onChange(id)}
            onKeyDown={handleKeyDown}
            className={`relative min-h-10 whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:bg-[var(--primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 ${
              activeTab
                ? "bg-white/62 text-[var(--primary)] after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[linear-gradient(90deg,var(--primary),var(--accent-teal))]"
                : "text-slate-500 hover:bg-white/56 hover:text-slate-950"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function sanitizeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "tabs";
}

export function tabId(tabListId: string, tab: string) {
  return `${sanitizeDomId(tabListId)}-${sanitizeDomId(tab)}-tab`;
}
