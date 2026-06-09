# Next Implementation Brief

This file is written to be pasted directly into an AI coding agent as the task prompt.
Read `context.md` first — especially "Honesty Layer & Propose/Dispose (added 2026-06-09)"
and "Product Rules (load-bearing)". Do not regress anything described there.

There are three workstreams. Do them **in this order** — each unlocks the next.
After every workstream: `npm run typecheck && npm run lint && npm test && npm run build`
must pass before moving on.

---

## Workstream 1 — Decompose `src/app/page.tsx` into real routes

**Problem.** `page.tsx` is ~4.6k lines with ~58 `useState` hooks. All 24 views render
inside one client route; navigation is a `view` query param (`src/lib/ui/url-state.ts`).
Everything ships as one bundle and every state change re-renders the world.

**Target shape.**
- One App Router route segment per nav hub (see nav groups in `src/lib/ui/constants.ts`):
  `/start`, `/find`, `/build`, `/prove`, `/run`, with view-level child segments
  (e.g. `/build/harness`, `/build/skills`, `/find/use-cases`).
- A shared layout owning the shell (`src/components/shell/AppShell` already exists).
- Workspace state moves out of component state into a context provider +
  reducer (or zustand if you prefer — keep it one store), hydrated once via the
  existing workspace persistence client (`src/lib/workspace-client.ts`).
- Each view file in `src/components/views/` becomes the page component of its segment.
  Do NOT rewrite view internals in this pass — lift and re-wire only.

**Constraints / gotchas.**
- Old deep links must keep working: add a redirect shim that maps
  `/?view=harness&runId=…` query-param URLs to the new segment URLs.
  `url-state.ts` documents every param (`factoryTab`, `skillMode`, `harnessMode`,
  `workflowMode`, `useCaseId`, `skillId`, `runId`).
- The orchestrator action handlers in page.tsx (`executeOrchestratorAction`,
  ~30 action types from `src/lib/orchestrator-runtime.ts`) mutate cross-view
  state — they must live in the shared store, not in any one route.
- Playwright smoke scripts (`scripts/smoke-ui.mjs`, `smoke-flows.mjs`) navigate by
  the current URL scheme and `data-testid`s — update them in the same PR.
- Keep `SkillSession` as a full-screen modal route (intercepted/parallel route is fine).
- Migrate incrementally: it is acceptable to land hubs one at a time behind the
  redirect shim, but `npm run verify` must be green at every landing point.

**Done when:** page.tsx is < 300 lines (providers + redirect shim only), each hub is its
own route segment with code-split bundles, old URLs redirect correctly, smoke flows pass.

---

## Workstream 2 — Streaming orchestrator responses

**Problem.** `POST /api/orchestrator/chat` returns one JSON blob; the UI waits silently.
With a live provider configured this feels broken for long answers.

**Target shape.**
- Add streaming support to `src/lib/model-provider.ts`: a `streamWithModelProvider`
  that yields text deltas (all four provider adapters there use fetch + JSON today;
  use SSE streaming endpoints where the provider supports it, and fall back to
  non-streaming + single flush where it doesn't).
- New route `POST /api/orchestrator/chat/stream` returning an SSE / ReadableStream
  response: stream the `content` text first, then send one final JSON event with
  `actions`, `autoActions`, `evidence`, and `model` (the plan structure from
  `planOrchestratorChat` in `src/lib/orchestrator-runtime.ts`).
- Client (`AIOrchestrator.tsx` + the send handler currently in page.tsx): render
  deltas as they arrive; attach actions/evidence when the final event lands.
  Keep the existing non-streaming route as the fallback path.

**Constraints / gotchas.**
- The deterministic local planner does not stream — when `route.provider === "local"`
  return the whole plan in one event AND keep `simulated: true` on the message
  (the "Offline guidance" chip in AIOrchestrator.tsx depends on it).
- Do not stream raw model output before `coerceModelPlan` validation has a chance
  to reject it: stream the text, but only surface ACTIONS from the validated final
  plan. Never execute `autoActions` from unvalidated stream content.
- Respect the existing redaction (`redactModelText`) on the request side unchanged.
- API protections in `src/proxy.ts` (origin check, payload caps, rate limit) must
  apply to the new route.

**Done when:** with a provider configured, orchestrator replies render token-by-token;
without one, behavior is unchanged; all existing orchestrator tests still pass.

---

## Workstream 3 — slate→token migration, then dark mode

**Problem.** Views hardcode `text-slate-*`, `bg-white/NN`, `border-slate-*` everywhere,
so the tenant brand theming and the dark token set in `globals.css` can't take effect.

**The dark token set already exists** behind `[data-theme="dark"]` in
`src/app/globals.css`, with named surface elevations `--surface-raised`,
`--surface-overlay`, `--surface-inset`. Do NOT wire `prefers-color-scheme`
until the migration below is complete (documented in globals.css).

**Mapping (apply mechanically, view file by view file):**
- `text-slate-950 / -900` → `text-[var(--text)]`
- `text-slate-500 / -600 / -700` → `text-[var(--text-muted)]`
- `text-slate-400 / -300` → `text-[var(--text-soft)]`
- `bg-white/72-86`, `bg-white/82` → `bg-[var(--surface-raised)]`
- `bg-white/88-97`, solid `bg-white` on panels → `bg-[var(--surface-overlay)]`
- `bg-white/55-64`, `bg-slate-50` wells → `bg-[var(--surface-inset)]`
- `border-slate-100/200 (any alpha)` → `border-[var(--hairline)]`
- `border-slate-300`, hover borders → `border-[var(--border-strong)]`
- Status colors (green/amber/red/sky/indigo) stay as-is for now — they're semantic.
- Recharts inline hexes (`#e2e8f0`, `#64748b`, `#635bff` in CommandCenter etc.):
  read from CSS vars via a small helper (`getComputedStyle`), or pass tokens in.

**Order:** `components/ui/*` primitives first (mostly done), then `shell/*`, then
`modals/*`, then views by size ascending (start with StrategyRoadmap/ProcessRedesignStudio,
finish with UseCaseFactory). One commit per batch so visual regressions bisect cleanly.

**Then activate dark mode:**
- Theme toggle in Admin settings (extend `src/lib/ui/theme.ts`, which already
  manages brand variables) with `light | dark | system`; persist per user;
  set `data-theme` on `<html>` before first paint (inline script in layout.tsx
  to avoid flash).
- Verify the brand-color luminance logic in `theme.ts` still picks readable
  foregrounds on dark surfaces.

**Done when:** toggling `data-theme="dark"` on `<html>` produces a fully dark UI with
no white islands on all 24 views, light mode is pixel-stable (compare screenshots),
and a user-facing toggle exists in Settings.

---

## Ground rules for the agent (all workstreams)

1. Honesty rules from context.md are load-bearing: anything simulated stays labeled
   (`executionMode`, `SimulationBadge`, `simulated` on orchestrator messages).
2. Autonomy proposals must pass through `applyAutonomyPolicyFloor` — never bypass it.
3. No new magic alpha surfaces — use the three `--surface-*` tokens.
4. Never invent numbers in UI (tokens, latency, relevance, eval scores). "Not recorded"
   is the correct display for missing telemetry.
5. `npm run verify` green before any PR; update tests you break, add tests for new seams.
