# Enterprise AI Enablement OS - Production Runbook

## Required Launch Configuration

Set these before a real production cutover:

```bash
NODE_ENV=production
DATABASE_URL=postgres://...
DATABASE_SSL=true
AUTH_REQUIRED=true
AUTH_SECRET=<32+ byte random secret>
OIDC_ISSUER=https://idp.example.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=https://your-domain.example.com/api/auth/oidc/callback
API_TRUSTED_ORIGINS=https://your-domain.example.com
```

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

Connector and workflow execution can launch in degraded mode, but production automation requires:

```bash
MCP_BROKER_URL=https://connector-broker.example.com
CONNECTOR_BROKER_TOKEN=...
TEMPORAL_ADDRESS=...
# or
WORKFLOW_ENGINE_URL=https://workflow-engine.example.com
```

## Local Database Smoke

```bash
docker compose up -d postgres
export DATABASE_URL=postgres://enterprise_ai_os:enterprise_ai_os_dev@localhost:54322/enterprise_ai_os
npm run dev
npm run smoke:api
npm run smoke:ui
```

## Health Checks

- `/api/health` is the liveness probe.
- `/api/ready` is the readiness probe. It returns `503` when production blockers exist.
- `/api/readiness` returns detailed readiness checks for the Admin UI.

## Orchestrator Runtime

- `/api/orchestrator/chat` is the server-side planning boundary for the AI Orchestrator tab.
- It requires a signed session with at least the `builder` role.
- The browser sends a compact workspace summary, not raw full workspace state.
- The route uses the model router's `workflow` lane, so Kimi/GLM/DeepSeek/Gemini/OpenAI/OpenRouter routing is controlled by server environment variables.
- If no provider is configured, or a provider call fails, the route returns a deterministic local plan with the same typed action schema.
- The server returns typed action recommendations only; browser/domain functions still execute actions so state changes remain visible, auditable, and guarded by existing UI/API controls.

## Security Controls

- API mutations enforce same-origin checks unless `API_TRUSTED_ORIGINS` explicitly allows the caller.
- API requests are rate limited with `API_RATE_LIMIT_WINDOW_MS` and `API_RATE_LIMIT_MAX`.
- API payload size is capped by `API_MAX_BODY_BYTES`.
- Local login is disabled in production unless `LOCAL_LOGIN_ENABLED=true`.
- OIDC `id_token` verification uses provider discovery and JWKS signature validation.
- Security headers and CSP are set in `next.config.ts`.

## Verification

```bash
npm run lint
npm run build
npm run smoke
npm audit
```

`npm run smoke:ui` requires the app to be running at `SMOKE_BASE_URL` or `http://localhost:3002`. It verifies shell navigation, Workflow Builder palette scrolling, Admin branding controls, Orchestrator visibility, and a clean browser console.

Do not treat a degraded readiness state as launch-ready. Degraded is acceptable for controlled internal testing only when the missing pieces are intentionally out of scope.
