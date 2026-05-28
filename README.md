# Enterprise AI Enablement OS

Enterprise AI Enablement OS is a tenant-agnostic internal platform for turning AI opportunities into governed, reusable, measurable AI Skills.

The product is not a chatbot shell. It is a control plane and factory for enterprise AI enablement: use case intake, scoring, Skill creation, workflow design, policy-gated tools, context governance, evaluations, audit evidence, adoption, ROI, and executive reporting.

## Current State

This repository currently contains a production-empty local workspace build:

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- React Flow workflow builder
- Recharts dashboards
- Server-backed workspace persistence with a Postgres adapter and a file-backed local fallback
- Signed session auth, OIDC SSO start/callback routes, and role-based API guards
- Workspace import/export
- Reusable deterministic local Harness runtime
- Task-lane model router
- Server-side provider readiness API
- Server Harness run API with policy checks and provider invocation adapters
- Connector/MCP broker execution seam with policy-only fallback
- Permission-aware context retrieval API
- Audit append/list API and workflow job ledger
- AI provider settings surface for future credentials

The app starts with no seeded tenant, users, use cases, Skills, tools, context sources, runs, or governance records. Real data should be created through the UI or imported.

## Architecture North Star

The 2026-2027 target is a framework-independent enterprise AI harness:

- `HarnessRuntime` owns execution semantics.
- `GraphRuntimeAdapter` supports local, LangGraph.js, OpenAI Agents SDK, Temporal, and custom runtimes.
- `ConnectorBroker` gates all MCP/tool access.
- `PolicyDecisionPoint` evaluates tool, context, output, autonomy, approval, and retention decisions.
- `EvaluationRunner` handles regression, red-team, launch-readiness, and quality suites.
- `ModelRouter` chooses the right provider/model per task lane so routine work does not burn premium tokens.
- OTel-shaped traces and evidence records make every run inspectable.

See [docs/2026-2027-harness-architecture.md](docs/2026-2027-harness-architecture.md).
For deployment setup and launch checks, see [docs/production-runbook.md](docs/production-runbook.md).

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) if the dev server is already running there, or use the port printed by Next.js.

Copy `.env.example` to `.env.local` when you are ready to configure server-side provider readiness for OpenAI, Anthropic, Gemini, Azure OpenAI, Kimi/Moonshot, GLM/Z.AI, DeepSeek, or OpenRouter. The `/api/providers` route reports readiness without returning secret values.

For durable local database testing:

```bash
docker compose up -d postgres
```

Then set:

```bash
DATABASE_URL=postgres://enterprise_ai_os:enterprise_ai_os_dev@localhost:54322/enterprise_ai_os
AUTH_SECRET=<random-32-byte-secret>
AUTH_REQUIRED=true
```

If `DATABASE_URL` is absent, the app uses `.data/` file persistence for local development and reports that mode through `/api/readiness`.

## Verify

```bash
npm run lint
npm run build
npm run smoke:api
```

## Next Engineering Phase

1. Create SkillSpec and WorkflowSpec schemas.
2. Compile the visual workflow builder into WorkflowSpec.
3. Add Postgres-backed workflow job and connector event repositories.
4. Add a LangGraph.js adapter slot server-side.
5. Add an OpenAI Agents SDK adapter slot.
6. Move provider credentials from env vars into encrypted tenant secret storage.
7. Add OTel-shaped trace event persistence.
8. Replace policy-only connector fallback with real MCP broker execution adapters.
