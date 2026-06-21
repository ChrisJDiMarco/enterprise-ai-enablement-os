"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "eaieos:theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to the things that change the resolved theme: explicit writes,
 *  cross-tab storage events, and the OS preference (for `system` mode). */
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const query =
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  query?.addEventListener("change", onChange);
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    query?.removeEventListener("change", onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

function writeMode(mode: ThemeMode): void {
  if (typeof window !== "undefined") window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  notify();
}

/**
 * Theme controller. The resolved theme is read from an external store
 * (localStorage + the OS preference) via useSyncExternalStore, so there is no
 * setState-in-effect; the only effect synchronizes the `data-theme` attribute
 * that activates the dark token set in globals.css. A pre-hydration inline
 * script (layout.tsx) sets the initial attribute to avoid a flash.
 */
export function useTheme() {
  const resolved = useSyncExternalStore<ResolvedTheme>(
    subscribe,
    () => resolveTheme(readMode()),
    () => "light",
  );

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  return {
    resolved,
    setMode: writeMode,
    toggle: () => writeMode(resolved === "dark" ? "light" : "dark"),
  };
}
