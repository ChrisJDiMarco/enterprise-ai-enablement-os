#!/usr/bin/env node
/**
 * Design-foundation guard (Phase 0).
 *
 * Locks in the foundation fixes so they can't silently regress:
 *  - the global tracking kill rule never comes back (it zeroed every tracking-* class),
 *  - the core redesign tokens stay defined (incl. --shadow-soft, which was used-but-undefined),
 *  - the resting card surface stays opaque (no backdrop-blur — blur is for the floating rung only).
 *
 * Deterministic, dependency-free. Wired into `npm run lint`, so it runs in CI.
 */
import { readFileSync } from "node:fs";

const CSS_PATH = "src/app/globals.css";
const css = readFileSync(new URL(`../${CSS_PATH}`, import.meta.url), "utf8");
const errors = [];

if (/letter-spacing:\s*0\s*!important/.test(css)) {
  errors.push(
    "The global tracking kill rule (letter-spacing: 0 !important) is back. " +
      "It silently zeroes every tracking-* class (display tightening, uppercase eyebrows). " +
      "Remove it and bake tracking into the type ramp instead.",
  );
}

const REQUIRED_TOKENS = [
  "--shadow-soft",
  "--elev-0",
  "--elev-1",
  "--elev-2",
  "--elev-3",
  "--space-4",
  "--space-6",
  "--dur-base",
  "--ease-standard",
];
for (const token of REQUIRED_TOKENS) {
  if (!new RegExp(`${token}\\s*:`).test(css)) {
    errors.push(`Foundation token ${token} is no longer defined in ${CSS_PATH}.`);
  }
}

const restingSurface = css.match(/\.ea-surface\s*\{([^}]*)\}/);
if (restingSurface && /backdrop-filter/.test(restingSurface[1])) {
  errors.push(
    ".ea-surface (the resting card surface) must stay opaque without backdrop-blur. " +
      "Frosted glass belongs only on the floating rung (menus, modals, sticky topbar).",
  );
}

if (errors.length) {
  console.error("✗ design-foundation guard failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✓ design-foundation guard passed");
