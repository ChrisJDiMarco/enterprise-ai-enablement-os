import { useId, type KeyboardEvent } from "react";
import { nextTabId, type TabNavigationItem } from "@/lib/ui/tab-navigation";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabNavigationItem[];
  active: string;
  onChange: (tab: string) => void;
}) {
  const tabListId = useId().replaceAll(":", "");

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = nextTabId(tabs, active, event.key);
    if (!next) return;

    event.preventDefault();
    onChange(next);

    const nextIndex = tabs.findIndex(([id]) => id === next);
    const tabList = event.currentTarget.closest("[role='tablist']");
    window.requestAnimationFrame(() => {
      const nextTab = tabList?.querySelector<HTMLButtonElement>(`[data-tab-index="${nextIndex}"]`);
      nextTab?.focus();
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Section navigation"
      className="flex gap-1 overflow-x-auto border-b border-slate-200/60 bg-transparent"
    >
      {tabs.map(([id, label], index) => (
        <button
          id={`${tabListId}-${id}-tab`}
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          tabIndex={active === id ? 0 : -1}
          data-tab-index={index}
          onClick={() => onChange(id)}
          onKeyDown={handleKeyDown}
          className={`relative min-h-10 whitespace-nowrap px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:bg-[var(--primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 ${
            active === id
              ? "text-[var(--primary)] after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[var(--primary)]"
              : "text-slate-500 hover:text-slate-950"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
