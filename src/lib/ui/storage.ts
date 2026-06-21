import { useEffect, useState } from "react";

export function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Persist a single value to localStorage whenever it changes, once the workspace
 * has hydrated. Collapses the many identical `useEffect(() => { if (!hasHydrated)
 * return; writeStoredValue(key, value); }, [hasHydrated, value])` blocks into one
 * reusable hook. `key` is expected to be a stable string literal.
 */
export function usePersistedValue<T>(hasHydrated: boolean, key: string, value: T) {
  useEffect(() => {
    if (!hasHydrated) return;
    writeStoredValue(key, value);
  }, [hasHydrated, key, value]);
}

export function useClientReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return ready;
}
