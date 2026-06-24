#!/usr/bin/env node
/**
 * Design-foundation guard (Phase 0).
 *
 * Locks in the foundation fixes so they can't silently regress:
 *  - the global tracking kill rule never comes back (it zeroed every tracking-* class),
 *  - the core redesign tokens stay defined (incl. --shadow-soft, which was used-but-undefined),
 *  - the resting card surface stays opaque (no backdrop-blur — blur is for the floating rung only),
 *  - the raw Tailwind palette-class debt only ever shrinks (ratchet), so the dark-mode
 *    !important bridge can eventually be deleted and new hardcoded palette utilities
 *    can't sneak back in.
 *
 * Deterministic, dependency-free. Wired into `npm run lint`, so it runs in CI.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = "src/app/globals.css";
const css = readFileSync(join(ROOT, CSS_PATH), "utf8");
const errors = [];

// --- Palette ratchet -------------------------------------------------------
// Raw Tailwind palette utilities (e.g. bg-slate-950, text-green-500) are
// light-mode-biased and only render correctly in dark mode via the globals.css
// !important bridge. They must be migrated to design tokens; until then this
// baseline can only go DOWN. Lower it as files are migrated; never raise it.
const PALETTE_BASELINE = 46;
const PALETTE_RE =
  /\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|accent|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\b/g;

function collectTsx(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsx(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

let paletteCount = 0;
for (const file of collectTsx(join(ROOT, "src/components"))) {
  paletteCount += (readFileSync(file, "utf8").match(PALETTE_RE) ?? []).length;
}
if (paletteCount > PALETTE_BASELINE) {
  errors.push(
    `Raw Tailwind palette classes in src/components rose to ${paletteCount} (baseline ${PALETTE_BASELINE}). ` +
      "Use design tokens (bg-[var(--surface)], text-[var(--text)], --success/--warning/--danger/--info) instead — " +
      "raw palette shades only work in dark mode via the globals.css !important bridge.",
  );
}
if (paletteCount < PALETTE_BASELINE) {
  console.log(
    `note: palette debt is ${paletteCount} (below baseline ${PALETTE_BASELINE}) — lower PALETTE_BASELINE in scripts/check-design-tokens.mjs to lock in the win.`,
  );
}

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
