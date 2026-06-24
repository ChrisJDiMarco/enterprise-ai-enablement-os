import { useEffect, useState } from "react";

/**
 * useState backed by sessionStorage so the value survives in-app navigation
 * (the value is read once on mount, then mirrored back on every change).
 *
 * Generic and self-contained: works for any JSON-serialisable value.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = window.sessionStorage.getItem(key);
      return stored === null ? initial : (JSON.parse(stored) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage write failures (quota, private mode, disabled storage).
    }
  }, [key, value]);

  return [value, setValue] as const;
}
