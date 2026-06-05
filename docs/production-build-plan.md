# Enterprise AI Enablement OS — Production Build Plan

_Last updated: 2026-05-28_

This is the working roadmap to take the Enablement OS from a strong local prototype to a
production-grade **Enterprise AI Transformation Operating System**. It is the single source of
truth for sequencing, decomposition targets, and the definition of "production ready."

---

## 1. Current State (assessed 2026-05-28)

**Stack.** Next.js 16 (App Router) · React 19 · TypeScript (`strict`) · Tailwind 4 · React Flow
(`@xyflow/react`) · Recharts · `pg` with file fallback · `jose` sessions/OIDC · `zod` validation.
`tsc --noEmit`, ESLint, and the 63-test unit suite all pass clean.

**Backend (`src/lib/`) — genuinely well-architected.** Clean, framework-independent contracts that
match the north-star docs:

- `harness-runtime` / `server-harness-runtime` — deterministic local execution + server run path with policy checks.
- `policy-engine` — `PolicyDecisionPoint` for tool/context/output decisions.
- `connector-broker` + `connector-events` — gated tool execution seam (policy-only fallback today).
- `model-router` + `model-provider` + `provider-registry` — task-lane routing across 8 providers with readiness reporting.
- `orchestrator-runtime` — typed conversational operator actions.
- `workspace-schema` + `database` — per-tenant workspace, Postgres adapter + `.data/` file fallback, import/export.
- `auth` / `oidc` — signed sessions, SSO start/callback, RBAC guards. `api-validation` (zod). `production-readiness`.

**API routes.** `workspace` (GET/PUT), `harness/run`, `orchestrator/chat`, `connectors/execute`,
`context/retrieve`, `work-signals`, `audit`, `workflows/jobs`, `providers`, `readiness`, `ready`, `health`, full `auth/*`.

**Frontend.** All 18 modules exist and render correct empty states. Startup is production-empty by design.

### Top gaps blocking "production ready / best it can be"

1. **The entire UI was one 9,719-line `src/app/page.tsx`** (~50 components, all 17 modules, the whole
   stateful root). This was the dominant risk: it blocks safe build-out, testing, and review.
   _In progress — now 7,342 lines._ Extracted to modules: the full UI primitive library, app shell,
   modals, `lib/ui/*` (types/constants/format/storage/theme), `workflow/legacy`, the use-case-factory
   shared helpers, and views `Broker`, `ContextFabric`, `Evaluations`, `Governance`, `MetricsRoi`,
   `Reports`, `TrainingAdoption`, `Harness`, `WorkIntelligence`. Remaining in `page.tsx`: the larger interactive views
   (CommandCenter, StrategyRoadmap, ProcessRedesignStudio, AIOrchestrator, UseCaseFactory + details,
   SkillsLibrary, WorkflowBuilder, EvidenceLedger, SkillSession, Admin) and the root state.
2. ~~**Tenant branding is half-wired**~~ **Resolved.** `logoUrl` now has an Admin field + live preview and
   renders in the shell; `primaryColor` drives `--primary*` CSS variables via `lib/ui/theme.ts`, themed
   app-wide (Button, nav, primitives switched to `var()` tokens).
3. ~~**No loadable demo data and no real test suite**~~ **Resolved.** `lib/demo/demo-workspace.ts` ships a
   rich "Northwind Group" tenant (8 users, 10 tools, 7 context sources, 7 use cases, 5 Skills, runs,
   reviews, evals, governed work signals, executive report) with one-click **Load demo** in Admin; startup stays empty. A
   70-test unit suite (`tests/`, `npm test`) covers policy-engine, prompt contracts, model-router, scoring, theme, work intelligence, work signal privacy policy, and
   schema normalization — zero new dependencies (Node's built-in runner + native TS stripping).

The backend "stubs" (policy-only connector fallback, deterministic harness, env-var provider creds) are
**intentional** per the documented non-goals and are treated as roadmap items, not defects.

---

## 2. Target Architecture

### 2.1 Frontend decomposition (replaces the monolith)

```
src/
  app/
    page.tsx                      # thin composition root only
    layout.tsx, globals.css
    api/...                       # unchanged
  lib/
    ui/
      types.ts                    # View, IntakeForm, CommandItem, Orchestrator*, ProductionReadiness
      constants.ts                # navItems, statusLabels, autonomyLabels, CURRENT_USER_*, DEFAULT_TENANT_SETTINGS
      format.ts                   # nowStamp, todayStamp, chartColors, donutGradient, normalize* helpers, tones
      storage.ts                  # readStoredValue, writeStoredValue, useClientReady
      theme.ts                    # NEW: tenant theme -> CSS variables
    workflow/
      legacy.ts                   # legacy-demo scrubbers + workflow node normalization
      spec.ts                     # block catalog, analyzeWorkflow, compileWorkflowSpec, templates
    demo/
      demo-workspace.ts           # NEW: rich loadable demo tenant fixture
    ...existing lib files
  state/
    useWorkspace.ts               # NEW: extracted root state/persistence hook (from Home())
  components/
    ui/                           # Button, Panel, Badge, IconButton, Field, SectionTitle, MetricCard,
                                  #   MiniMetric, DataTable, EmptyState, Tabs, Stepper, CheckRow,
                                  #   ReadinessTile, ChartSkeleton, ScoreBar, TextBlock, Avatar, icons
    shell/                        # AppShell, Sidebar, PageHeader, BootShell, AuthGate
    modals/                       # CommandMenu, AISettingsModal, ImportWorkspaceModal, SecretField
    views/                        # one file per module (CommandCenter, StrategyRoadmap, ...)
```

**Principle:** view components are already prop-driven (defined at module scope, not closures over
`Home`), so extraction is mechanical and low-risk when done leaves-first with `tsc` + ESLint after each
batch. Root state moves into a `useWorkspace` hook so `page.tsx` becomes a composition root.

### 2.2 Backend north star (unchanged, from `docs/2026-2027-harness-architecture.md`)

`HarnessRuntime` owns execution · `GraphRuntimeAdapter` (local → LangGraph.js → OpenAI Agents SDK →
Temporal) · `ConnectorBroker` gates all MCP/tool access · `PolicyDecisionPoint` (OPA/Rego-style) ·
`EvaluationRunner` · `ModelRouter` task lanes · OTel-shaped traces + evidence ledger.

---

## 3. The Operating Loop (product spine)

Every module is a station on one loop. The OS should make this loop legible end-to-end:

```
Strategy → Work Intelligence → Opportunity → Process Redesign → Use Case → Skill → Workflow
   → Harness Run → Governance Evidence → Adoption → Measured Value
   → Reusable Pattern → Executive Report
```

---

## 4. Phased Roadmap

### Pass 1 — Stabilize & Refactor Core  ← IN PROGRESS
Make everything that follows safe and fast.

1. **Decompose `page.tsx`** into the structure above (Batches A→C), `tsc`/ESLint/build green after each. _In progress — Batches A & B done; Batch C ongoing (9 views extracted, ~9 larger views + root state remain)._
2. ~~**Finish tenant branding**~~ **Done** — logo field + URL, shell render, `primaryColor` → CSS variables app-wide (`lib/ui/theme.ts`).
3. ~~**Rich loadable demo tenant**~~ **Done** — `lib/demo/demo-workspace.ts` + one-click "Load demo" in Admin; startup stays empty.
4. **Automated tests**: ~~unit (policy-engine, model-router, scoring, schema normalization)~~ **done — 70 tests, `npm test`**; Playwright UI smoke now covers shell navigation, strategy/process, Workflow Builder overview → editor palette scroll, Admin branding/readiness, demo loading, Use Case Factory overview → Backlog, Work Intelligence, Skills Library overview, MCP Broker control plane, Context Fabric permission simulation, Evaluations coverage, Governance taxonomy, Metrics ROI economics, Training adoption campaigns, Reports briefing workflow, AI Harness overview → Runs → run detail, Orchestrator, and console cleanliness. API smoke covers governed work-signal ingest/list.
5. **Verification gate**: `tsc`, ESLint, unit tests, `next build`, and Playwright smoke are green locally. Behavior unchanged post-refactor — extractions are verbatim moves.

**Done when:** no single UI file > ~600 lines; branding fully works; demo loads the whole loop; tests pass in CI-style run.

#### Verification commands
```
npm run typecheck        # tsc --noEmit (app)        — green
npm run typecheck:test   # tsc -p tsconfig.test.json — green
npm run lint             # eslint                    — green
npm test                 # 70 unit tests             — green
npm run build && npm run smoke   # run on a dev machine (not the sandbox)
```

### Pass 2 — Deepen Highest-Value Pillars
Turn shallow modules into real workspaces.

- **Use Case Factory cockpit**: main operating surface for the factory, including opportunity funnel health, disciplined stage path, next actions, priority queue, scoring model, discovery/governance/reuse worklists, and explicit conversion from business pain to governed Skill.
- **Skills Library cockpit**: main reusable-asset catalog with Skill inventory, industrialization readiness, function coverage, top reuse candidates, and deliberate drill-in to versioned Skill configuration.
- **Workflow Builder cockpit**: main operating surface for workflow workspaces, including current canvas inventory, starter patterns, runtime readiness, build path, governance contract, and a deliberate transition into the graph editor.
- **Operational module surfaces**: MCP Broker, Context Fabric, Evaluations, Governance, Metrics & ROI, Training & Adoption, and Reports each expose their intended operating panels instead of thin placeholder views.
- **Process Redesign Studio**: current/future-state swimlanes (human/AI/system), bottleneck + cycle-time model, control points, automation-vs-augmentation-vs-redesign recommendation.
- **Work Intelligence Fabric**: privacy-governed signal ledger, `/api/work-signals` ingest/list route, opportunity radar, process mining, adoption intelligence, context quality alerts, Skill learning recommendations, and explicit no-surveillance guardrails.
- **Prompt and Harness Intelligence**: versioned prompt contracts for every Skill, prompt-quality scoring, Harness runtime packets, visible prompt-contract trace evidence, stronger output-policy detection, and Orchestrator guidance for prompt/Harness/intelligence review.
- **Adoption Command Center**: literacy programs, champions by dept/region, training completion, office hours, usage funnel, sentiment, blockers, playbooks.
- **Governance woven through**: governance status surfaced on every Use Case/Skill/Run object; risk taxonomy; control mapping to NIST AI RMF, ISO 42001, EU AI Act, OWASP LLM/MCP; evidence packets.
- **Board/ELT Briefing Studio**: weekly brief, monthly portfolio review, governance summary, pilot readout, ROI report, decision-memo generator (exportable).
- **Command Center cockpit**: today's priorities, portfolio health, active pilots, blocked reviews, value delivered, high-risk items, adoption pulse, decisions needed, Orchestrator suggested actions.

### Pass 3 — Backend Realness
Replace intentional seams with real services, behind flags, local fallback preserved.

- Real provider calls via `model-router` + encrypted tenant secret storage (move creds out of env).
- Persist OTel-shaped trace events; surface run traces from storage.
- Real `EvaluationRunner` (regression, red-team, launch-readiness, quality) with stored results.
- Live MCP `ConnectorBroker` execution adapter replacing policy-only fallback.
- `SkillSpec` / `WorkflowSpec` schemas; compile the visual builder into `WorkflowSpec`.
- Postgres-backed workflow job + connector event repositories; LangGraph.js + OpenAI Agents SDK adapter slots.

### Pass 4 — Enterprise Hardening
Production operability.

- Multi-tenant isolation review; RBAC matrix tests; SSO end-to-end; audit completeness.
- Observability (metrics/logs/traces), rate limiting, error boundaries, accessibility (WCAG AA), performance budget.
- CI pipeline (typecheck, lint, unit, e2e, build), deploy runbook validation, backup/restore drills.

---

## 5. Definition of "Production Ready"

- No broken interactions; every primary action does something useful.
- Decomposed, navigable codebase; no monolith files; shared component library.
- Tenant-configurable branding/theming; production-empty startup; one-click demo for evaluation.
- Typecheck + lint + unit + e2e + build all green in one command; documented deploy path.
- Governance, ROI, and audit evidence are real, inspectable, and exportable for executives.
- Backend seams either real or clearly flagged with safe local fallback.

---

## 6. Risk & Safety

- Git baseline committed before refactor. Each batch is verified green (`tsc` + ESLint + unit tests) before moving on, so the working tree never stays half-wired; commit the accumulated working tree on a dev machine (the sandbox's git is pinned at the baseline commit).
- Leaves-first extraction keeps the build green continuously.
- No behavior change during Pass 1 refactor — extractions are verbatim moves of module-scope components; props and JSX are unchanged.
```
