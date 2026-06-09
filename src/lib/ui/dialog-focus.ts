"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let documentScrollLockCount = 0;
let previousBodyOverflow = "";
const backgroundIsolationState = new Map<HTMLElement, {
  ariaHidden: string | null;
  count: number;
  hadInert: boolean;
}>();

function visibleFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    return isVisibleElement(element);
  });
}

function isVisibleElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function lockDocumentScroll() {
  if (documentScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  documentScrollLockCount += 1;

  return () => {
    documentScrollLockCount = Math.max(0, documentScrollLockCount - 1);
    if (documentScrollLockCount === 0) {
      document.body.style.overflow = previousBodyOverflow;
      previousBodyOverflow = "";
    }
  };
}

function restoreElementIsolation(element: HTMLElement) {
  const state = backgroundIsolationState.get(element);
  if (!state) return;

  state.count -= 1;
  if (state.count > 0) return;

  backgroundIsolationState.delete(element);
  if (state.ariaHidden === null) {
    element.removeAttribute("aria-hidden");
  } else {
    element.setAttribute("aria-hidden", state.ariaHidden);
  }

  if (state.hadInert) {
    element.setAttribute("inert", "");
  } else {
    element.removeAttribute("inert");
  }
}

function isolateElement(element: HTMLElement) {
  const existing = backgroundIsolationState.get(element);
  if (existing) {
    existing.count += 1;
    return;
  }

  backgroundIsolationState.set(element, {
    ariaHidden: element.getAttribute("aria-hidden"),
    count: 1,
    hadInert: element.hasAttribute("inert"),
  });
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("inert", "");
}

function dialogIsolationRoot(dialog: HTMLElement) {
  let root = dialog.parentElement ?? dialog;

  while (
    root.parentElement &&
    root.parentElement !== document.body &&
    root.parentElement.children.length <= 1
  ) {
    root = root.parentElement;
  }

  return root;
}

function isolateDialogBackground(dialog: HTMLElement) {
  const root = dialogIsolationRoot(dialog);
  const parent = root.parentElement;
  if (!parent) return () => {};

  const isolated = Array.from(parent.children).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (element === root || element.contains(root)) return false;
    if (["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) return false;
    return true;
  });

  isolated.forEach(isolateElement);

  return () => {
    isolated.forEach(restoreElementIsolation);
  };
}

export function useDialogFocus<TDialog extends HTMLElement, TInitialFocus extends HTMLElement>({
  restoreFocusSelector,
}: {
  restoreFocusSelector?: string;
} = {}) {
  const dialogRef = useRef<TDialog | null>(null);
  const initialFocusRef = useRef<TInitialFocus | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusOnCloseRef = useRef(true);

  useLayoutEffect(() => {
    let restoreBackgroundIsolation = () => {};
    const activeElement =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    previousFocusRef.current =
      activeElement ?? (restoreFocusSelector ? document.querySelector<HTMLElement>(restoreFocusSelector) : null);
    const unlockDocumentScroll = lockDocumentScroll();

    const dialog = dialogRef.current;
    const requestedFocus = initialFocusRef.current;
    const focusTarget =
      requestedFocus && isVisibleElement(requestedFocus)
        ? requestedFocus
        : (dialog ? visibleFocusableElements(dialog)[0] : null) ?? dialog;
    focusTarget?.focus({ preventScroll: true });

    if (dialog) {
      restoreBackgroundIsolation = isolateDialogBackground(dialog);
    }

    return () => {
      restoreBackgroundIsolation();
      unlockDocumentScroll();
      const previousFocus = previousFocusRef.current;
      if (!restoreFocusOnCloseRef.current || !previousFocus || !document.contains(previousFocus)) return;

      previousFocus.focus({ preventScroll: true });
    };
  }, [restoreFocusSelector]);

  function enableFocusRestore() {
    restoreFocusOnCloseRef.current = true;
  }

  function disableFocusRestore() {
    restoreFocusOnCloseRef.current = false;
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return false;

    const dialog = dialogRef.current;
    if (!dialog) return false;

    const focusable = visibleFocusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return true;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return true;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return true;
    }

    if (!focusable.some((element) => element === activeElement)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return true;
    }

    return false;
  }

  return {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  };
}
