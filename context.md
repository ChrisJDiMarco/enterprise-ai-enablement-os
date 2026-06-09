# Context for AI Agents and New Developers

Read this before touching the code. It captures what's here, why, and the constraints that aren't obvious from the file tree.

> **Important Next.js note:** This project uses Next.js 16.2.6 with React 19. APIs, conventions, and file structure may differ from older training data. When uncertain about Next.js APIs, read `node_modules/next/dist/docs/` rather than guessing. See `AGENTS.md`.

---

## What This Is

**Enterprise AI Enablement OS** — a tenant-agnostic internal control plane and factory for turning enterprise AI opportunities into governed, reusable, measurable **AI Skills**.

It is **not** a chatbot shell. It is the operating system around enterprise AI:

- Use case intake → scoring → SkillSpec
- Workflow design (visual + compiled)
- Policy-gated tool / context access
- Deterministic harness runtime with traces
- Evals (regression, red-team, launch-readiness)
- Audit evidence ledger
- Adoption, ROI, and executive reporting

The app boots **empty in production**. No tenant, users, use cases, Skills, tools, context sources, runs, or governance records are seeded. Real data comes through the UI or import.

---

## Current State

### Stack

- **Next.js 16.2.6** (App Router) + **React 19.2.4** + **TypeScript 5**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **@xyflow/react 12** — visual workflow builder
- **Recharts 3** — dashboards
- **Postgres** via `pg` — production persistence
- **File-backed `.data/`** — local dev fallback
- **jose** — signed sessions, OIDC
- **zod** — runtime validation
- **playwright** (dev) — smoke / E2E

Node ≥20 implied (uses `--experimental-strip-types` for TS in `node --test`).

### What Has Been Built

| Layer | Status |
|---|---|
| Next.js App Router shell, 24 views | ✅ |
| Server-backed workspace persistence (Postgres adapter + file fallback) | ✅ |
| Signed session auth, OIDC SSO start/callback routes | ✅ |
| Role-based API guards (RBAC) | ✅ |
| SCIM-compatible tenant user provisioning endpoint | ✅ |
| Tenant member roster API (Admin + last-admin protection) | ✅ |
| Workspace import/export | ✅ |
| Deterministic local Harness runtime (`HarnessRuntime` contract) | ✅ |
| Task-lane Model Router | ✅ |
| Server-side provider readiness API (`/api/providers`) | ✅ |
| Encrypted tenant provider-secret vault | ✅ |
| API proxy: origin checks, payload caps, rate limits, request IDs | ✅ |
| Server Harness run API with policy checks + provider invocation adapters | ✅ |
| Durable Harness trace store (run, policy, prompt, model-route, trace) | ✅ |
| Connector/MCP broker execution seam (policy-only fallback) | ✅ |
| Enterprise connector readiness catalog (Slack, MS 365/Teams, Jira, ServiceNow, SharePoint, Workday, Google Workspace) | ✅ |
| Permission-aware context retrieval API | ✅ |
| Audit append/list API + workflow job ledger | ✅ |
| Deterministic eval runner + durable artifact storage + external runner seam | ✅ |
| Self-serve tenant provisioning API (env-gated) | ✅ |
| Visual workflow builder compiles to `WorkflowSpec` | Partial — schemas drafted, compilation evolving |
| LangGraph.js / OpenAI Agents / Temporal adapters | Adapter slots reserved; not yet implemented |
| Real MCP broker execution (vs policy-only fallback) | Not yet |

---

## Architecture North Star

The product is built around a **framework-independent Harness Runtime contract** with adapter slots for the best agent runtimes.

Stable interfaces (see `docs/2026-2027-harness-architecture.md`):

```ts
HarnessRuntime { runSkill, resumeRun, getRunTrace }
GraphRuntimeAdapter { id, compile, invoke, resume }     // local | langgraph | openai_agents | temporal | custom
PolicyDecisionPoint { evaluateToolRequest, evaluateContextAccess, evaluateOutput }
ConnectorBroker { listTools, requestTool, executeApprovedTool }
EvaluationRunner { runSuite, redTeam }
```

### Product Rules (load-bearing — do not break)

- **No tenant-specific seed story.** Tenant fixtures can be imported, never compiled into prod startup.
- **Every screen works for any company, department, AI maturity level.**
- **Every Skill is portable.** Exportable as SkillSpec JSON/YAML, runnable by an adapter.
- **Every tool call goes through broker + policy engine.**
- **Every run produces an evidence trail**, even when blocked.
- **Every AI output distinguishes** source-backed content vs model inference vs human decision.
- **Every approval is resumable, auditable, tied to a policy reason.**
- **Every framework choice sits behind an adapter.** The OS owns the domain model.

### Model Router — Task Lanes

The router routes by **task lane**, not by one global default. This prevents burning frontier tokens on classification, extraction, routine summarization, and background jobs.

| Lane | Default model ref |
|---|---|
| Default Skill run | `local-enterprise-reasoner` until configured |
| Classification / scoring | `deepseek/deepseek-v4-flash` |
| Summaries / briefs | `gemini/gemini-2.5-flash` |
| Governance reasoning | `glm/glm-5.1` |
| Workflow / tool planning | `kimi/kimi-k2.6` |
| Red-team / evals | `deepseek/deepseek-v4-pro` |
| Fallback | `openrouter/auto` |

Provider SDKs and base URLs stay **server-side in production**. The Admin settings panel is a development control surface only.

---

## Repo Layout

```
.
├── src/
│   ├── app/
│   │   ├── api/                  ← All server routes (33+ endpoints)
│   │   │   ├── agent-control-plane/
│   │   │   ├── audit/
│   │   │   ├── auth/{login,oidc/{start,callback},session}/
│   │   │   ├── connectors/execute/
│   │   │   ├── context/{index,retrieve}/
│   │   │   ├── enterprise-control-plane/
│   │   │   ├── evals/run/
│   │   │   ├── evidence/packet/
│   │   │   ├── harness/run/
│   │   │   ├── launch/packet/
│   │   │   ├── observability/
│   │   │   ├── orchestrator/chat/
│   │   │   ├── privacy/{export,requests}/
│   │   │   ├── provider-secrets/
│   │   │   ├── providers/        ← Readiness only — never returns secret values
│   │   │   ├── provisioning/users/  ← SCIM-compatible
│   │   │   ├── readiness/, ready/
│   │   │   ├── reports/generate/
│   │   │   ├── tenants/
│   │   │   ├── use-cases/pilot-brief/
│   │   │   ├── work-signals/
│   │   │   └── workflows/jobs/
│   │   ├── page.tsx              ← Root client shell (large; ~4.6k lines — being refactored)
│   │   ├── error.tsx, global-error.tsx, not-found.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── shell/                ← AppShell, AppOverlays, AppViewRouter, AuthGate, BootShell, PageHeader
│   │   ├── modals/               ← Command menu, onboarding wizard, action inbox, AI settings, etc.
│   │   ├── views/                ← The 24 product surfaces (see "Views" below)
│   │   └── ui/                   ← Primitives: Badge, Button, DataTable, EmptyState, MetricCard, Panel, Stepper, Tabs
│   ├── lib/                      ← All domain logic. 100+ modules. See "Lib organization" below.
│   │   ├── ui/                   ← UI-only helpers (constants, navigation, theme, format, page-guides, url-state)
│   │   ├── workflow/             ← Workflow legacy compatibility
│   │   └── demo/                 ← Optional demo fixtures (never auto-loaded in prod)
│   └── proxy.ts                  ← API middleware: origin, rate limit, body caps, request IDs
├── db/
│   ├── schema.sql                ← Authoritative schema (Postgres)
│   └── migrations/
├── docs/
│   ├── 2026-2027-harness-architecture.md   ← Architectural north star
│   ├── product-architecture-roadmap.md     ← Implementation roadmap
│   ├── production-build-plan.md
│   ├── production-data-foundation.md
│   ├── production-runbook.md               ← Deployment + launch checks
│   └── requirement-document.md
├── scripts/
│   ├── create-production-env.mjs           ← `npm run setup:production-env`
│   ├── db-migrate.mjs                      ← `npm run db:migrate`
│   ├── preflight-launch.mjs                ← `npm run preflight:launch`
│   ├── smoke-{api,ui,flows,marketing}.mjs  ← `npm run smoke*`
├── tests/                                  ← 90 test files, `node --test` runner
├── .data/                                  ← File-backed local dev persistence (gitignored)
├── .env.example                            ← All env vars enumerated
├── docker-compose.yml                      ← Local Postgres
├── Dockerfile
├── next.config.ts
├── package.json
├── README.md
└── context.md                              ← THIS FILE
```

### Views (24)

Mapped to `src/components/views/`. Nav groups in `src/lib/ui/constants.ts`.

| Hub | Views |
|---|---|
| **Start** | Home (CommandCenter), AI Assistant (AIOrchestrator), AI Inventory (AIEstate) |
| **Find AI Work** | Company Plan (CompanyBlueprint), AI Roadmap (StrategyRoadmap), Work Signals (WorkIntelligence), Use Cases (UseCaseFactory), Process Redesign (ProcessRedesignStudio) |
| **Build Safely** | AI Skills (SkillsLibrary), Workflow Builder (WorkflowBuilder), AI Harness (Harness), Connect Apps (ConnectorSetup), Tool Permissions (Broker), Knowledge Sources (ContextFabric), Quality Evals (Evaluations) |
| **Prove Impact** | Risk Review (Governance), Launch Plan (LaunchCenter), Proof Ledger (EvidenceLedger), Value & ROI (MetricsRoi), Reports |
| **Run the Program** | Adoption Plan (TrainingAdoption), Settings (Admin) |
| **Modal flow** | Skill Session (full-screen Skill run UI) |

Several view files are large (`Harness.tsx` ~2k, `UseCaseFactory.tsx` ~3k, `WorkflowBuilder.tsx` ~2.2k, `CommandCenter.tsx` ~2.1k, `SkillsLibrary.tsx` ~1.9k, `Admin.tsx` ~1.8k, `EvidenceLedger.tsx` ~1.6k). Refactor-in-progress: extracting `page.tsx` (currently 4.6k lines) into the shell + view router pattern.

### Lib Organization (high level)

`src/lib/` is the domain core. Roughly grouped by responsibility:

- **Auth / identity** — `auth.ts`, `auth-session.ts`, `auth-readiness.ts`, `local-login.ts`, `oidc.ts`, `oidc-session.ts`, `rbac.ts`, `provisioning-auth.ts`
- **API guards / responses** — `api-errors.ts`, `api-protection.ts`, `api-response.ts`, `api-validation.ts`, `next-api-response.ts`, `readiness-response.ts`, `ready-response.ts`, `tenant-provisioning-response.ts`
- **Persistence** — `database.ts`, `database-ops.ts`, `domain-repository.ts`, `tenant-file-storage.ts`, `workspace-schema.ts`, `workspace-client.ts`
- **Tenant + secrets** — `tenant-secret-vault.ts`, `tenant-readiness-context.ts`, `tenant-provisioning-readiness.ts`, `provider-secrets-payload.ts`, `server-ai-settings.ts`
- **Harness Runtime** — `harness-runtime.ts`, `server-harness-runtime.ts`, `harness-workspace-persistence.ts`, `prompt-contracts.ts`, `runtime-readiness-policy.ts`, `workspace-runtime-policy.ts`, `workspace-command-runtime.ts`
- **Model routing + providers** — `model-router.ts`, `model-provider.ts`, `model-budget.ts`, `provider-registry.ts`
- **Policy + governance** — `policy-engine.ts`, `agent-identity-governance.ts`, `audit-integrity.ts`, `privacy-lifecycle.ts`
- **Connectors / MCP** — `connector-broker.ts`, `connector-adapters.ts`, `connector-events.ts`, `connector-execution-envelope.ts`, `connector-payload-safety.ts`, `enterprise-connectors.ts`, `openclaw-integration.ts`
- **Context fabric** — `context-index.ts`, `context-retrieval.ts`
- **Evals** — `continuous-evals.ts`, `evaluation-runner.ts`, `eval-scheduler.ts`
- **Use cases / Skills factory** — `use-case-intelligence.ts`, `use-case-drafting.ts`, `pilot-brief-generator.ts`, `pattern-marketplace.ts`, `prompt-contracts.ts`
- **Workflows / orchestration** — `workflow-jobs.ts`, `workspace-commands.ts`, `command-orders.ts`, `orchestrator-runtime.ts`, `orchestrator-actions.ts`, `orchestrator-workspace-context.ts`, `agent-control-plane.ts`, `agent-ops-blueprint.ts`, `transformation-command-system.ts`
- **Reports + evidence** — `report-generator.ts`, `evidence-graph.ts`, `evidence-packet.ts`, `roi-model.ts`, `launch-handoff.ts`, `launch-manifest.ts`, `customer-launch-contract.ts`, `customer-launch-packet.ts`, `primetime-launch-gate.ts`, `production-launch-sequence.ts`, `production-readiness.ts`, `production-ops-readiness.ts`
- **Work intelligence** — `work-intelligence.ts`, `work-signal-policy.ts`, `market-intelligence.ts`, `enterprise-maturity.ts`, `compound-learning-loop.ts`
- **Observability + traces** — `observability.ts`, `trace-store.ts`
- **UI helpers** — `src/lib/ui/*` (constants, format, theme, navigation, page-guides, url-state, etc.)

When in doubt, **read the module rather than guess its shape** — most modules export a small focused contract.

---

## Environment + Production Readiness

`.env.example` enumerates every var the app understands. Key categories:

- **Persistence** — `DATABASE_URL` (required for prod), `ALLOW_FILE_DATABASE_IN_PRODUCTION` (must stay `false`), backup vars
- **Auth** — `AUTH_SECRET` (32 byte random), `AUTH_REQUIRED=true` in prod, OIDC creds
- **Tenant secret vault** — `TENANT_SECRET_KEY` (32 byte random)
- **API security** — `API_TRUSTED_ORIGINS`, rate limit windows + caps, `API_MAX_BODY_BYTES`
- **Provisioning** — `PROVISIONING_API_TOKEN`, `SCIM_BEARER_TOKEN`
- **Connector broker** — `MCP_BROKER_URL`, `CONNECTOR_BROKER_URL`, per-tool secrets
- **Workflow engine** — `TEMPORAL_ADDRESS`, `WORKFLOW_ENGINE_URL`
- **Observability** — `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, `LOG_DRAIN_URL`
- **Model providers** — OpenAI, Anthropic, Gemini, Azure OpenAI, Kimi/Moonshot, GLM/Z.AI, DeepSeek, OpenRouter (all server-side only)

### Production blocks file persistence by default

A live customer deployment needs all of:

- `DATABASE_URL`
- `AUTH_REQUIRED=true`
- OIDC credentials
- `AUTH_SECRET`
- `TENANT_SECRET_KEY`
- `API_TRUSTED_ORIGINS`
- At least one external model provider
- Backup/restore evidence
- Schema migration evidence
- Enterprise connector secrets OR an MCP broker
- A trace/eval artifact store
- A durable workflow engine

Several `ALLOW_*_IN_PRODUCTION` env vars exist as private-beta escape hatches. **Keep them `false`** for customer prod.

---

## How To Verify Changes

```bash
npm run dev                # Next.js dev server (defaults to whatever port Next picks)
npm run verify             # Full code-quality + local product-flow gate
npm run verify:launch      # verify + hosted preflight (PREFLIGHT_BASE_URL=...)
```

`verify` runs, in order:

1. `typecheck` (tsc --noEmit)
2. `lint` (eslint)
3. `typecheck:test` (tsc -p tsconfig.test.json)
4. `test` (node --test on `tests/**/*.test.ts`)
5. `build` (next build)
6. `smoke:api` → `smoke:ui` → `smoke:flows` → `smoke:marketing`

Individual gates:

```bash
npm run lint
npm run typecheck
npm run typecheck:test
npm test
npm run build
npm run smoke
DATABASE_URL=postgres://... npm run db:migrate
PREFLIGHT_BASE_URL=https://your-domain.example.com npm run preflight:launch
```

`verify:launch` is expected to report **degraded** in local dev until production infrastructure vars are configured. That is correct, not broken.

---

## Notable Patterns & Constraints (read before changing)

1. **No tenant-specific seed.** Production startup must be empty. If you find yourself wiring a default user, default Skill, or "demo" entry into a prod code path, stop. Demo fixtures live in `src/lib/demo/` and must be opt-in.

2. **Server-side provider secrets.** Never send provider keys to the browser. `/api/providers` reports **readiness only**. The encrypted tenant secret vault is the durable store; `TENANT_SECRET_KEY` envelopes it.

3. **Every mutation goes through the API proxy** (`src/proxy.ts`). It enforces origin, rate limits, payload caps, and request IDs. Don't bypass it.

4. **Adapters, not direct dependencies.** Business code talks to `HarnessRuntime`, `GraphRuntimeAdapter`, `ConnectorBroker`, `PolicyDecisionPoint`, `EvaluationRunner`. Don't import LangChain/LangGraph/OpenAI Agents types into domain modules.

5. **Connector calls must always pass through the broker** even if the broker only does policy gating in this build (real execution adapters are a planned next phase).

6. **Tracing + evidence is non-optional.** Every Skill run — even a blocked one — must produce a trace and an evidence record. The trace store is durable; don't add code paths that skip it.

7. **Postgres adapter ≠ file-backed adapter feature-parity.** File backing is dev-only. If you add a persistence method, implement both adapters or guard the file adapter with a "not supported in prod" assertion.

8. **Permission-aware retrieval is enforced before prompt assembly.** Retrieval filters by user, Skill, source, and data classification. Don't pull text into the prompt before the filter runs.

9. **API routes use Zod for input validation + structured error responses.** Use `api-response.ts` / `api-errors.ts` / `next-api-response.ts` helpers — don't hand-roll JSON or status codes.

10. **Last-admin protection.** Tenant member roster API will refuse to demote/delete the last admin. Don't bypass.

11. **Audit-integrity flag.** `AUDIT_INTEGRITY_ENABLED=true` (default) enforces append-only audit semantics. Don't add code paths that mutate audit rows.

12. **Refactor in progress.** `src/app/page.tsx` is being decomposed into `src/components/shell/*` + `src/components/views/*` + router. Many newly extracted files are uncommitted in the current state. When adding to `page.tsx`, prefer extracting the relevant view/section instead of growing it further.

---

## Open Work / Next Engineering Phase

From the README's "Next Engineering Phase":

1. Finalize `SkillSpec` and `WorkflowSpec` schemas.
2. Compile the visual workflow builder fully into `WorkflowSpec`.
3. Add a **LangGraph.js** server-side adapter slot.
4. Add an **OpenAI Agents SDK** adapter slot.
5. Replace policy-only connector fallback with **real MCP broker execution** adapters.
6. Add **Temporal / LangGraph / OpenAI Agents** hosted runtime adapters behind the workflow engine seam.
7. Deepen SCIM provisioning with customer-specific group, region, and reviewer-role mapping templates.

Architecture roadmap depth: `docs/product-architecture-roadmap.md` and `docs/2026-2027-harness-architecture.md`.

---

## When Working on This Codebase

**Before editing:**

- Read the relevant module — don't guess shape or signature
- Match existing style (file conventions, naming, error shapes)
- Check if the change belongs in a *view*, a *shell* component, or *lib* (domain) — they have different ownership

**Before claiming done:**

- `npm run verify` passes locally
- New routes have Zod validation + structured errors
- New persistence methods cover both Postgres and file adapter (or guard explicitly)
- New Skill / tool / connector code emits trace + evidence on success AND failure
- No new tenant-specific seed data in prod code paths
- No provider secrets in browser-accessible code

**If you find yourself wanting to:**

- Add a default user / Skill / use case to prod startup → don't (use `src/lib/demo/`)
- Bypass the policy engine for "just this one" tool call → don't
- Read provider secrets in client code → don't (`/api/providers` is readiness only)
- Skip audit/trace writing for an error path → don't (errors must produce evidence too)
- Couple a domain module to LangChain / LangGraph / OpenAI Agents types → don't (use the adapter contract)

---

## Pointers

- **Architecture north star** → `docs/2026-2027-harness-architecture.md`
- **Implementation roadmap** → `docs/product-architecture-roadmap.md`
- **Deployment runbook** → `docs/production-runbook.md`
- **Schema** → `db/schema.sql`
- **All env vars** → `.env.example`
- **Nav + view map** → `src/lib/ui/constants.ts`
- **Domain entrypoints** → `src/lib/enterprise-ai-data.ts`, `src/lib/harness-runtime.ts`, `src/lib/policy-engine.ts`, `src/lib/connector-broker.ts`, `src/lib/model-router.ts`
