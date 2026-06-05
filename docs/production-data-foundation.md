# Production Data Foundation

Enablement OS persists data in two layers:

1. **Workspace snapshot**: `workspace_snapshots.data` stores the full versioned workspace document. This is the compatibility layer for the current app and import/export flow.
2. **Canonical domain projection**: production Postgres also receives queryable tables for members, tools, context sources, use cases, Skills, runs, tool requests, governance reviews, evals, work signals, command orders, and evidence items.

The snapshot remains the source of truth for app state. The domain projection is rebuilt whenever the workspace is saved, so analytics, launch checks, evidence export, and admin operations can query normalized tables without reverse-engineering the JSON payload.

## Migration Flow

Run:

```bash
npm run db:migrate
```

The migration runner:

- creates `schema_migrations`
- runs sorted SQL files in `db/migrations`
- stores a SHA-256 checksum per migration
- refuses to continue if a previously applied migration changed

## Tenant Isolation

Domain tables use composite tenant keys and enable row-level security with:

```sql
organization_id = current_setting('app.organization_id', true)
```

Application code sets that tenant context inside the domain projection transaction. Production database clients used for direct BI or admin queries should also set `app.organization_id` before reading tenant-scoped domain tables.

## Runtime Contract

`src/lib/database.ts` saves the workspace snapshot and the canonical domain projection in one Postgres transaction. If projection sync fails, the snapshot update rolls back too. That is intentional: production should not create split-brain state between the user-facing workspace and the operational system-of-record tables.

## API Inspection

`GET /api/domain/projection` returns the current tenant projection counts and evidence items. It requires a signed session with at least `viewer` access and is intended for launch QA, admin tooling, and customer success validation.
