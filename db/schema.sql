create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists workspace_snapshots (
  organization_id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  organization_id text not null,
  event_type text not null,
  message text not null,
  actor text not null,
  risk_level text not null,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists workflow_jobs (
  id text primary key,
  organization_id text not null,
  workflow_id text,
  skill_id text,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connector_events (
  id text primary key,
  organization_id text not null,
  skill_id text,
  tool_id text not null,
  status text not null,
  decision jsonb not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx
  on audit_events (organization_id, created_at desc);

create index if not exists workflow_jobs_org_created_idx
  on workflow_jobs (organization_id, created_at desc);

create index if not exists connector_events_org_created_idx
  on connector_events (organization_id, created_at desc);
