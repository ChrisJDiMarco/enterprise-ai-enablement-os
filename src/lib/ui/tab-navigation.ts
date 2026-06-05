export type TabNavigationItem = [string, string];

export function nextTabId(tabs: TabNavigationItem[], active: string, key: string) {
  if (!tabs.length) return null;
  const currentIndex = Math.max(0, tabs.findIndex(([id]) => id === active));
  const lastIndex = tabs.length - 1;

  if (key === "Home") return tabs[0][0];
  if (key === "End") return tabs[lastIndex][0];
  if (key === "ArrowRight" || key === "ArrowDown") return tabs[currentIndex === lastIndex ? 0 : currentIndex + 1][0];
  if (key === "ArrowLeft" || key === "ArrowUp") return tabs[currentIndex === 0 ? lastIndex : currentIndex - 1][0];

  return null;
}
