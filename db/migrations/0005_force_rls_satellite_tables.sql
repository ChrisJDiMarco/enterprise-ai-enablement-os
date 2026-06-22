-- 0005_force_rls_satellite_tables.sql
-- Tenant-isolation hardening, increment 2 of the satellite-table series.
--
-- These single-tenant satellite tables now have their access wrapped in
-- withTenant() (set_config app.organization_id), so RLS can be ENABLED + FORCED
-- safely:
--   run_traces (trace-store.ts), eval_artifacts (evaluation-runner.ts),
--   connector_events (connector-events.ts), context_index_documents
--   (context-index.ts), session_revocations (session-revocation.ts).
--
-- Still DEFERRED: the cross-tenant worker tables workflow_jobs and
-- idempotency_records — the maintenance worker scans/prunes them across all
-- tenants and needs a dedicated privileged (BYPASSRLS) role before RLS can be
-- forced. (tenant_secrets was forced in 0004.)
--
-- Idempotent: safe to re-run.
do $$
declare
  satellite_table text;
begin
  foreach satellite_table in array array[
    'run_traces',
    'eval_artifacts',
    'connector_events',
    'context_index_documents',
    'session_revocations'
  ] loop
    if to_regclass(format('public.%I', satellite_table)) is null then
      continue;
    end if;
    execute format('alter table %I enable row level security', satellite_table);
    execute format('alter table %I force row level security', satellite_table);
    execute format('drop policy if exists tenant_isolation on %I', satellite_table);
    execute format(
      'create policy tenant_isolation on %I using (organization_id = current_setting(''app.organization_id'', true)) with check (organization_id = current_setting(''app.organization_id'', true))',
      satellite_table
    );
  end loop;
end $$;
