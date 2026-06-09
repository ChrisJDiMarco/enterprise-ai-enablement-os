# Enterprise AI Enablement OS - Production Runbook

## Required Launch Configuration

Generate a production env starter locally:

```bash
npm run setup:production-env -- https://your-domain.example.com
```

This writes `.env.production.local` with strong generated values for `AUTH_SECRET`, `TENANT_SECRET_KEY`, and `API_RATE_LIMIT_KEY_SALT`. It intentionally leaves infrastructure-owned values blank so they can be provisioned in the deployment platform or secret manager.

Set these before a real production cutover:

```bash
NODE_ENV=production
DATABASE_URL=postgres://...
DATABASE_SSL=true
DB_SCHEMA_VERSION=2026.05.29
DB_MIGRATIONS_APPLIED=true
MANAGED_DATABASE_BACKUPS=true
DATABASE_BACKUP_URL=...
DATABASE_BACKUP_SCHEDULE=...
DATABASE_RESTORE_DRILL_AT=2026-05-29T00:00:00.000Z
TENANT_SECRET_KEY=<32+ byte random secret>
AUTH_REQUIRED=true
AUTH_SECRET=<32+ byte random secret>
OIDC_ISSUER=https://idp.example.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=https://your-domain.example.com/api/auth/oidc/callback
API_TRUSTED_ORIGINS=https://your-domain.example.com
API_RATE_LIMIT_KEY_SALT=<random deployment salt>
SELF_SERVE_SIGNUP_ENABLED=false
CUSTOMER_ONBOARDING_TERMS_URL=https://your-domain.example.com/legal/onboarding-terms
```

Keep `ALLOW_FILE_DATABASE_IN_PRODUCTION` unset or `false`. Set it to `true` only for an emergency private-beta fallback with documented customer-data risk acceptance.

Keep these unset or `false` for customer production. They exist only for private beta launches where the limitation is explicitly disclosed and accepted:

```bash
ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION=false
ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION=false
ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION=false
```

Enable `SELF_SERVE_SIGNUP_ENABLED=true` only after SSO, database, tenant secret vault, rate limits, and legal/customer onboarding terms are ready. Set `CUSTOMER_ONBOARDING_TERMS_URL`, `ONBOARDING_TERMS_URL`, or `TERMS_OF_SERVICE_URL` before opening production self-serve onboarding.

At least one server-side model provider should be configured:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
KIMI_API_KEY=...
GLM_API_KEY=...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=...
```

Set model-ops guardrails before inviting broad usage:

```bash
TENANT_MONTHLY_BUDGET_USD=2500
MODEL_BUDGET_ENFORCEMENT_ENABLED=true
```

Connector and workflow execution can launch in degraded mode only for an explicitly accepted private beta. Customer production automation requires:

```bash
MCP_BROKER_URL=https://connector-broker.example.com
CONNECTOR_BROKER_TOKEN=...
CONNECTOR_BROKER_TIMEOUT_MS=30000
TEMPORAL_ADDRESS=...
# or
WORKFLOW_ENGINE_URL=https://workflow-engine.example.com
EVAL_RUNNER_URL=https://eval-runner.example.com
EVAL_SCHEDULE_ENABLED=true
EVAL_SCHEDULE_CRON=0 */6 * * *
AUDIT_INTEGRITY_ENABLED=true
```

Production knowledge and context ingestion should use a scheduled sync worker, a vector store, or an explicitly approved manual indexing path for private beta:

```bash
VECTOR_STORE_URL=postgres://...
CONTEXT_INDEX_JOB_URL=https://context-worker.example.com
CONTEXT_SYNC_ENABLED=true
```

Production observability and privacy lifecycle controls should be configured before broad customer rollout:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
SENTRY_DSN=...
LOG_DRAIN_URL=...
DATA_RETENTION_DAYS=365
PRIVACY_EXPORT_ENABLED=true
PRIVACY_REQUEST_WORKFLOW_URL=https://privacy.example.com/requests
```

If the connector broker owns vendor OAuth credentials, the Admin readiness page marks connectors as broker-managed. If the OS owns native credentials, store these in the tenant vault or deployment secret manager:

```bash
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
MS_GRAPH_TENANT_ID=...
MS_GRAPH_CLIENT_ID=...
MS_GRAPH_CLIENT_SECRET=...
JIRA_BASE_URL=...
JIRA_EMAIL=...
JIRA_API_TOKEN=...
SERVICENOW_INSTANCE_URL=...
SERVICENOW_CLIENT_ID=...
SERVICENOW_CLIENT_SECRET=...
SHAREPOINT_TENANT_ID=...
SHAREPOINT_CLIENT_ID=...
SHAREPOINT_CLIENT_SECRET=...
WORKDAY_TENANT_URL=...
WORKDAY_CLIENT_ID=...
WORKDAY_CLIENT_SECRET=...
GOOGLE_WORKSPACE_CLIENT_ID=...
GOOGLE_WORKSPACE_CLIENT_SECRET=...
```

Apply the database schema before setting `DB_MIGRATIONS_APPLIED=true`:

```bash
DATABASE_URL=postgres://... npm run db:migrate
```

## Local Database Smoke

```bash
docker compose up -d postgres
export DATABASE_URL=postgres://enterprise_ai_os:enterprise_ai_os_dev@localhost:54322/enterprise_ai_os
npm run dev
npm run smoke:api
npm run smoke:ui
```

## Container Smoke

The repository includes a basic production container path:

```bash
docker build -t enterprise-ai-enablement-os:local .
docker run --rm -p 3002:3000 \
  --env-file .env.production \
  enterprise-ai-enablement-os:local
```

Then run:

```bash
PREFLIGHT_BASE_URL=http://localhost:3002 ALLOW_DEGRADED_LAUNCH=true npm run preflight:launch
```

Use a managed Postgres instance for customer environments. Do not mount `.data/` as a production datastore.

## Health Checks

- `/api/health` is the liveness probe.
- `/api/ready` is the readiness probe. It returns `503` when production blockers exist.
- `/api/readiness` returns detailed readiness checks for the Admin UI.
- `/api/audit?verify=true` returns the tamper-evident audit-chain verification status.
- `PUT /api/audit` with `{ "action": "seal_legacy_chain" }` seals pre-integrity tenant records as upgrade evidence and refuses non-legacy tamper gaps.
- `/api/connectors/readiness` reports connector family readiness without exposing secret values.
- `/api/context/index` ingests and reports permission-aware context index documents for a tenant.
- `/api/context/retrieve` retrieves context through policy filtering plus the indexed document store.
- `/api/traces` lists durable Harness trace evidence for the current tenant.
- `/api/evals/run` runs or lists launch-readiness eval artifacts for the current tenant.
- `/api/evidence/packet` exports board-ready governance evidence as JSON or Markdown (`?format=markdown`).
- `/api/tenants` reports whether self-serve tenant creation is enabled.

Run launch preflight against the deployed URL before inviting a customer:

```bash
PREFLIGHT_BASE_URL=https://your-domain.example.com npm run preflight:launch
```

For a controlled private beta with accepted degraded items:

```bash
ALLOW_DEGRADED_LAUNCH=true PREFLIGHT_BASE_URL=https://your-domain.example.com npm run preflight:launch
```

## Orchestrator Runtime

- `/api/orchestrator/chat` is the server-side planning boundary for the AI Orchestrator tab.
- It requires a signed session with at least the `builder` role.
- The browser sends a compact workspace summary, not raw full workspace state.
- The route uses the model router's `workflow` lane, so Kimi/GLM/DeepSeek/Gemini/OpenAI/OpenRouter routing is controlled by server environment variables.
- If no provider is configured, or a provider call fails, the route returns a deterministic local plan with the same typed action schema.
- The server returns typed action recommendations only; browser/domain functions still execute actions so state changes remain visible, auditable, and guarded by existing UI/API controls.

## Security Controls

- API mutations enforce same-origin checks unless `API_TRUSTED_ORIGINS` explicitly allows the caller. In production, missing mutation origins are rejected.
- API requests are rate limited with route-sensitive limits:
  - `API_SENSITIVE_RATE_LIMIT_MAX` for login, tenant creation, and provider-secret writes.
  - `API_AI_RATE_LIMIT_MAX` for Harness, Orchestrator, Context, and connector execution.
  - `API_WORKSPACE_RATE_LIMIT_MAX` for authenticated workspace snapshot autosaves.
  - `API_WRITE_RATE_LIMIT_MAX` for work signals, workflow jobs, audit writes, and workspace command mutations.
  - `API_RATE_LIMIT_MAX` as the general default.
- API payload size is capped by `API_MAX_BODY_BYTES`.
- API responses include `X-Request-Id`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
- Local login is disabled in production unless `LOCAL_LOGIN_ENABLED=true`.
- OIDC `id_token` verification uses provider discovery and JWKS signature validation.
- Tenant-owned provider secrets are encrypted server-side with `TENANT_SECRET_KEY` and are never returned to the browser.
- Security headers and CSP are set in `next.config.ts`.

## Minimum Customer Launch Gate

Before a customer receives a link, require:

1. `/api/ready` returns `200`.
2. `npm run preflight:launch` passes against the hosted domain.
3. At least one external model provider is configured through env vars or the tenant provider vault.
4. MCP/connector broker execution is configured for any workflow that can touch external systems.
5. Temporal or another durable workflow engine is configured for long-running workflow execution.
6. Postgres migration, backup, and restore drill evidence is configured.
7. Context sources have been indexed through `/api/context/index` or an approved external retrieval service.
8. OIDC sign-in has been tested with at least one admin and one viewer.
9. Admin -> Team & Access contains at least one admin, one viewer, and the required governance reviewer roles, and the customer IdP/SCIM job can dry-run against `/api/provisioning/users` with `x-eaieos-tenant`.
10. Rate limit headers are visible on API responses.
11. A tenant can be provisioned or imported without using demo mode.
12. Privacy-safe work-signal ingestion has been reviewed with Legal/Privacy.
13. A rollback path exists: previous deployment image, database backup, and ability to disable `SELF_SERVE_SIGNUP_ENABLED`.
14. Harness traces, eval artifacts, tamper-evident audit logs, and evidence packets are being persisted or exported for audit.
15. Support contact and incident escalation owner are visible in the customer onboarding material.
16. `/api/audit?verify=true` reports a clean audit chain with no legacy or tamper gaps after the first workspace mutation. For upgraded tenants, run Admin -> Customer Launch Infrastructure -> Seal Legacy Chain and preserve the migration evidence record.

## Verification

```bash
npm run lint
npm run typecheck
npm run typecheck:test
npm test
npm run build
npm run smoke
npm run preflight:launch
npm audit
```

`npm run smoke:ui` requires the app to be running at `SMOKE_BASE_URL` or `http://localhost:3002`. It verifies shell navigation, guided setup, launch handoff, Admin branding and member controls, Workflow Studio palette scrolling, Orchestrator viewport behavior, and a clean browser console.

Do not treat a degraded readiness state as launch-ready. Degraded is acceptable for controlled internal testing only when the missing pieces are intentionally out of scope.
