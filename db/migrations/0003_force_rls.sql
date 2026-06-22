-- 0003_force_rls.sql
-- Tenant isolation hardening: FORCE Row-Level Security on every tenant-scoped
-- table whose access ALREADY sets the transaction-local app.organization_id.
--
-- Why FORCE: plain ENABLE leaves RLS bypassable by the table owner and any role
-- with BYPASSRLS. The application role owns these tables, so without FORCE the
-- policy is silently skipped and the app reads across tenants. FORCE closes that.
-- (Superusers still bypass RLS by design — the application role must be a
-- non-superuser; see README "non-superuser role".)
--
-- SCOPE: core snapshot tables + the domain system-of-record projection. The
-- domain projection is written exclusively inside a setTenant() transaction
-- (set_config('app.organization_id', ...)) and is never read outside that
-- context, so FORCE is safe here.
--
-- DEFERRED (NOT in this migration): the satellite tables — tenant_secrets,
-- idempotency_records, session_revocations, workflow_jobs, run_traces,
-- eval_artifacts, connector_events, context_index_documents — are accessed via
-- the raw pool WITHOUT setting app.organization_id. Forcing RLS on them would
-- break the app under a non-superuser role (and a superuser CI role would hide
-- the breakage). They must first have their data-access paths wrapped in tenant
-- context; only then can RLS be safely enforced. Tracked as a follow-up.
--
-- Idempotent: safe to re-run.
do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    -- core snapshot tables (also FORCED at runtime in database.ts)
    'workspace_snapshots',
    'audit_events',
    -- domain system-of-record (context-scoped, write-only projection)
    'organization_members',
    'ai_tools',
    'context_sources_domain',
    'use_cases',
    'use_case_data_sources',
    'use_case_risks',
    'skills',
    'skill_versions',
    'skill_tool_policies',
    'skill_context_policies',
    'runs',
    'run_steps',
    'tool_requests_domain',
    'governance_reviews_domain',
    'eval_results_domain',
    'work_signals_domain',
    'command_orders_domain',
    'evidence_items'
  ] loop
    if to_regclass(format('public.%I', tenant_table)) is null then
      continue;
    end if;
    execute format('alter table %I enable row level security', tenant_table);
    execute format('alter table %I force row level security', tenant_table);
    execute format('drop policy if exists tenant_isolation on %I', tenant_table);
    execute format(
      'create policy tenant_isolation on %I using (organization_id = current_setting(''app.organization_id'', true)) with check (organization_id = current_setting(''app.organization_id'', true))',
      tenant_table
    );
  end loop;
end $$;
