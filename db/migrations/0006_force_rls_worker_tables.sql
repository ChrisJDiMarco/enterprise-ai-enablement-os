-- 0006_force_rls_worker_tables.sql
-- Tenant-isolation hardening, FINAL increment of the satellite-table series.
--
-- workflow_jobs and idempotency_records are the last two. Their REQUEST-path
-- access is now wrapped in withTenant() (workflow-jobs.ts enqueue/list/update,
-- idempotency.ts), so RLS can be ENABLED + FORCED.
--
-- The maintenance WORKER reaches these tables cross-tenant (claimQueuedWorkflowJobs,
-- pruneIdempotencyRecords, and tenant discovery via listTenantOrganizationIds on
-- workspace_snapshots). The worker process must therefore connect as a dedicated
-- privileged role that has BYPASSRLS — configured via WORKER_DATABASE_URL (see
-- scripts/worker.mjs and the README). The web/request role MUST remain a plain
-- non-superuser so RLS is enforced for user traffic.
--
-- Idempotent: safe to re-run. With this migration, all 28 tenant-scoped tables
-- are ENABLE + FORCE RLS.
do $$
declare
  worker_table text;
begin
  foreach worker_table in array array[
    'workflow_jobs',
    'idempotency_records'
  ] loop
    if to_regclass(format('public.%I', worker_table)) is null then
      continue;
    end if;
    execute format('alter table %I enable row level security', worker_table);
    execute format('alter table %I force row level security', worker_table);
    execute format('drop policy if exists tenant_isolation on %I', worker_table);
    execute format(
      'create policy tenant_isolation on %I using (organization_id = current_setting(''app.organization_id'', true)) with check (organization_id = current_setting(''app.organization_id'', true))',
      worker_table
    );
  end loop;
end $$;
