create table if not exists organization_members (
  organization_id text not null,
  id text not null,
  email text not null,
  name text not null,
  role text not null,
  department text,
  title text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, email)
);

create table if not exists ai_tools (
  organization_id text not null,
  id text not null,
  display_name text not null,
  category text not null,
  action_type text not null,
  risk_level text not null,
  enabled boolean not null,
  requires_approval_by_default boolean not null,
  usage_count integer not null default 0,
  last_used text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists context_sources_domain (
  organization_id text not null,
  id text not null,
  name text not null,
  source_type text not null,
  classification text not null,
  owner_department text not null,
  enabled boolean not null,
  health text not null,
  document_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists use_cases (
  organization_id text not null,
  id text not null,
  title text not null,
  department text not null,
  status text not null,
  risk_level text not null,
  requestor_id text not null,
  owner_id text,
  priority_score integer not null default 0,
  value_score numeric not null default 0,
  feasibility_score numeric not null default 0,
  risk_score numeric not null default 0,
  reuse_score numeric not null default 0,
  urgency_score numeric not null default 0,
  data_readiness_score numeric not null default 0,
  monthly_volume integer not null default 0,
  avg_handling_time_minutes numeric not null default 0,
  estimated_users integer not null default 0,
  capability_type text not null,
  linked_skill_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists use_case_data_sources (
  organization_id text not null,
  use_case_id text not null,
  source_name text not null,
  ordinal integer not null default 0,
  primary key (organization_id, use_case_id, source_name)
);

create table if not exists use_case_risks (
  organization_id text not null,
  use_case_id text not null,
  risk text not null,
  ordinal integer not null default 0,
  primary key (organization_id, use_case_id, risk)
);

create table if not exists skills (
  organization_id text not null,
  id text not null,
  use_case_id text,
  name text not null,
  slug text not null,
  department text not null,
  owner_id text not null,
  status text not null,
  version text not null,
  risk_level text not null,
  autonomy_tier text not null,
  model_provider text not null,
  model text not null,
  eval_pass_rate numeric not null default 0,
  adoption_count integer not null default 0,
  value_delivered numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, slug)
);

create table if not exists skill_versions (
  organization_id text not null,
  id text not null,
  skill_id text not null,
  version text not null,
  status text not null,
  prompt_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, skill_id, version)
);

create table if not exists skill_tool_policies (
  organization_id text not null,
  skill_id text not null,
  tool_id text not null,
  policy_type text not null check (policy_type in ('allowed', 'blocked')),
  requires_approval boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  primary key (organization_id, skill_id, tool_id, policy_type)
);

create table if not exists skill_context_policies (
  organization_id text not null,
  skill_id text not null,
  context_source_id text not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (organization_id, skill_id, context_source_id)
);

create table if not exists runs (
  organization_id text not null,
  id text not null,
  skill_id text,
  use_case_id text,
  triggered_by text not null,
  status text not null,
  risk_level text not null,
  current_stage text not null,
  cost_usd numeric not null default 0,
  latency_ms integer not null default 0,
  output text not null default '',
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists run_steps (
  organization_id text not null,
  run_id text not null,
  step_index integer not null,
  label text not null,
  status text not null,
  detail text not null,
  latency_ms integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  primary key (organization_id, run_id, step_index)
);

create table if not exists tool_requests_domain (
  organization_id text not null,
  id text not null,
  skill_id text,
  run_id text,
  user_label text not null,
  tool_id text not null,
  status text not null,
  risk_level text not null,
  reason text not null,
  requested_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  primary key (organization_id, id)
);

create table if not exists governance_reviews_domain (
  organization_id text not null,
  id text not null,
  item_type text not null,
  item_id text not null,
  title text not null,
  department text not null,
  risk_level text not null,
  reviewer text not null,
  status text not null,
  due_date date,
  blockers jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  primary key (organization_id, id)
);

create table if not exists eval_results_domain (
  organization_id text not null,
  id text not null,
  skill_id text not null,
  suite_name text not null,
  score integer not null,
  passed boolean not null,
  critical_failures integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists work_signals_domain (
  organization_id text not null,
  id text not null,
  source text not null,
  event_type text not null,
  department text not null,
  process text not null,
  risk_level text not null,
  privacy jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  summary text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists command_orders_domain (
  organization_id text not null,
  id text not null,
  title text not null,
  status text not null,
  priority text not null,
  owner text not null,
  target_view text not null,
  linked_entity_type text,
  linked_entity_id text,
  confidence integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists evidence_items (
  organization_id text not null,
  id text not null,
  source_type text not null,
  source_id text not null,
  item_label text not null,
  framework text not null,
  control text not null,
  risk_level text not null,
  confidence text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create index if not exists organization_members_org_idx on organization_members (organization_id);
create index if not exists ai_tools_org_category_idx on ai_tools (organization_id, category);
create index if not exists context_sources_domain_org_classification_idx on context_sources_domain (organization_id, classification);
create index if not exists use_cases_org_status_idx on use_cases (organization_id, status);
create index if not exists use_cases_org_priority_idx on use_cases (organization_id, priority_score desc);
create index if not exists use_cases_org_department_idx on use_cases (organization_id, department);
create index if not exists skills_org_status_idx on skills (organization_id, status);
create index if not exists skills_org_department_idx on skills (organization_id, department);
create index if not exists runs_org_started_idx on runs (organization_id, started_at desc);
create index if not exists runs_org_skill_idx on runs (organization_id, skill_id);
create index if not exists tool_requests_domain_org_status_idx on tool_requests_domain (organization_id, status);
create index if not exists governance_reviews_domain_org_status_idx on governance_reviews_domain (organization_id, status);
create index if not exists eval_results_domain_org_skill_idx on eval_results_domain (organization_id, skill_id);
create index if not exists work_signals_domain_org_created_idx on work_signals_domain (organization_id, created_at desc);
create index if not exists command_orders_domain_org_status_idx on command_orders_domain (organization_id, status, priority);
create index if not exists evidence_items_org_created_idx on evidence_items (organization_id, created_at desc);
create index if not exists evidence_items_org_source_idx on evidence_items (organization_id, source_type, source_id);
create index if not exists evidence_items_org_framework_idx on evidence_items (organization_id, framework, control);

do $$
declare
  domain_table text;
begin
  foreach domain_table in array array[
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
    execute format('alter table %I enable row level security', domain_table);
    execute format('drop policy if exists tenant_isolation on %I', domain_table);
    execute format(
      'create policy tenant_isolation on %I using (organization_id = current_setting(''app.organization_id'', true)) with check (organization_id = current_setting(''app.organization_id'', true))',
      domain_table
    );
  end loop;
end $$;
