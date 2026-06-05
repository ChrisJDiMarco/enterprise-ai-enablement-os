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
- Server-backed tenant member roster API for Admin-managed users, reviewer roles, and last-admin protection
- SCIM-compatible tenant user provisioning endpoint for IdP/user lifecycle sync
- Workspace import/export
- Reusable deterministic local Harness runtime
- Task-lane model router
- Server-side provider readiness API
- Encrypted tenant provider-secret vault API
- Self-serve tenant provisioning API gated by environment controls
- API proxy protections for mutation origin checks, payload caps, rate limits, and request IDs
- Server Harness run API with policy checks and provider invocation adapters
- Durable Harness trace store for run, policy, prompt, model-route, and trace evidence
- Connector/MCP broker execution seam with policy-only fallback
- Enterprise connector readiness catalog for Slack, Microsoft 365/Teams, Jira, ServiceNow, SharePoint, Workday, and Google Workspace
- Permission-aware context retrieval API
- Audit append/list API and workflow job ledger
- Deterministic eval runner with durable eval artifact storage and an external runner seam
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
For the product architecture roadmap, see [docs/product-architecture-roadmap.md](docs/product-architecture-roadmap.md).
For deployment setup and launch checks, see [docs/production-runbook.md](docs/production-runbook.md).

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) if the dev server is already running there, or use the port printed by Next.js.

Copy `.env.example` to `.env.local` when you are ready to configure server-side provider readiness for OpenAI, Anthropic, Gemini, Azure OpenAI, Kimi/Moonshot, GLM/Z.AI, DeepSeek, or OpenRouter. The `/api/providers` route reports readiness without returning secret values.

For a hosted production configuration starter:

```bash
npm run setup:production-env -- https://your-domain.example.com
```

This creates `.env.production.local` with generated secrets and placeholders for the infrastructure values you must provision manually.

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

Production blocks file persistence by default. A live customer deployment needs `DATABASE_URL`, `AUTH_REQUIRED=true`, OIDC credentials, `AUTH_SECRET`, `TENANT_SECRET_KEY`, `API_TRUSTED_ORIGINS`, at least one external model provider, backup/restore evidence, schema migration evidence, enterprise connector secrets or an MCP broker, a trace/eval artifact store, and a durable workflow engine configured before customers are invited.

## Verify

For the full code-quality and local product-flow gate:

```bash
npm run verify
```

This runs typecheck, lint, test typecheck, unit tests, production build, API smoke, UI smoke, and flow smoke. It proves the current codebase is internally healthy, but it does not prove a hosted customer environment has SSO, Postgres, provider keys, connector broker, backups, or workflow infrastructure configured.

For individual gates:

```bash
npm run lint
npm run typecheck
npm run typecheck:test
npm test
npm run build
npm run smoke
npm run smoke:api
```

Run the schema migration gate against a real Postgres target:

```bash
DATABASE_URL=postgres://... npm run db:migrate
```

Run the customer-launch preflight against a hosted domain:

```bash
PREFLIGHT_BASE_URL=https://your-domain.example.com npm run preflight:launch
```

For a full hosted launch gate:

```bash
PREFLIGHT_BASE_URL=https://your-domain.example.com npm run verify:launch
```

`verify:launch` should pass before broad customer rollout. In local development it is expected to report degraded until production infrastructure variables are configured.

## Next Engineering Phase

1. Create SkillSpec and WorkflowSpec schemas.
2. Compile the visual workflow builder into WorkflowSpec.
3. Add a LangGraph.js adapter slot server-side.
4. Add an OpenAI Agents SDK adapter slot.
5. Replace policy-only connector fallback with real MCP broker execution adapters.
6. Add hosted Temporal/LangGraph/OpenAI Agents runtime adapters behind the workflow engine seam.
7. Deepen SCIM provisioning with customer-specific group, region, and reviewer-role mapping templates.
