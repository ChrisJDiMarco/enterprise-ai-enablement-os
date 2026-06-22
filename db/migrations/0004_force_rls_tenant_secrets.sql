-- 0004_force_rls_tenant_secrets.sql
-- Tenant-isolation hardening, increment 1 of the satellite-table series.
--
-- tenant_secrets is the per-org encrypted credential vault. Its access in
-- tenant-secret-vault.ts now runs inside withTenant() (set_config
-- app.organization_id, transaction-local), so RLS can be ENABLED + FORCED
-- safely. Without FORCE, the owning app role silently bypasses the policy.
-- (Superusers still bypass RLS by design — the app role must be non-superuser.)
--
-- The other satellite tables (idempotency_records, session_revocations,
-- workflow_jobs, run_traces, eval_artifacts, connector_events,
-- context_index_documents) follow in subsequent migrations as each one's
-- access path is wrapped in tenant context. Idempotent: safe to re-run.
do $$
begin
  if to_regclass('public.tenant_secrets') is null then
    return;
  end if;
  alter table tenant_secrets enable row level security;
  alter table tenant_secrets force row level security;
  drop policy if exists tenant_secrets_tenant_isolation on tenant_secrets;
  create policy tenant_secrets_tenant_isolation on tenant_secrets
    using (organization_id = current_setting('app.organization_id', true))
    with check (organization_id = current_setting('app.organization_id', true));
end $$;
