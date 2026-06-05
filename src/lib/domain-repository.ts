import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  Tool,
  ToolRequest,
  UseCase,
  User,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { CommandOrderRecord } from "@/lib/command-orders";
import type { EnterpriseWorkspace } from "@/lib/workspace-schema";

type DbExecutor = Pick<Pool | PoolClient, "query">;

export type DomainEvidenceItem = {
  id: string;
  organizationId: string;
  sourceType:
    | "audit_log"
    | "harness_run"
    | "eval_result"
    | "governance_review"
    | "roi_assumption"
    | "work_signal";
  sourceId: string;
  itemLabel: string;
  framework: "NIST AI RMF" | "ISO/IEC 42001" | "EU AI Act" | "OWASP LLM/MCP";
  control: string;
  riskLevel: "low" | "medium" | "high" | "restricted";
  confidence: "low" | "moderate" | "high";
  summary: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type DomainProjection = {
  organizationId: string;
  users: User[];
  tools: Tool[];
  contextSources: ContextSource[];
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  auditLogs: AuditLog[];
  workSignals: WorkSignal[];
  commandOrders: CommandOrderRecord[];
  evidenceItems: DomainEvidenceItem[];
};

export type DomainProjectionCounts = {
  users: number;
  tools: number;
  contextSources: number;
  useCases: number;
  skills: number;
  runs: number;
  toolRequests: number;
  governanceReviews: number;
  evalResults: number;
  auditLogs: number;
  workSignals: number;
  commandOrders: number;
  evidenceItems: number;
};

export type DomainProjectionSyncResult = {
  organizationId: string;
  syncedAt: string;
  counts: DomainProjectionCounts;
};

export const domainSchemaSql = `
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
`;

export async function ensureDomainSchema(executor: DbExecutor): Promise<void> {
  await executor.query(domainSchemaSql);
}

export function buildDomainProjection(workspace: EnterpriseWorkspace): DomainProjection {
  const organizationId = workspace.organizationId;
  return {
    organizationId,
    users: workspace.users,
    tools: workspace.tools,
    contextSources: workspace.contextSources,
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    auditLogs: workspace.auditLogs,
    workSignals: workspace.workSignals,
    commandOrders: workspace.commandOrders,
    evidenceItems: buildEvidenceItems(workspace),
  };
}

export function domainProjectionCounts(projection: DomainProjection): DomainProjectionCounts {
  return {
    users: projection.users.length,
    tools: projection.tools.length,
    contextSources: projection.contextSources.length,
    useCases: projection.useCases.length,
    skills: projection.skills.length,
    runs: projection.runs.length,
    toolRequests: projection.toolRequests.length,
    governanceReviews: projection.governanceReviews.length,
    evalResults: projection.evalResults.length,
    auditLogs: projection.auditLogs.length,
    workSignals: projection.workSignals.length,
    commandOrders: projection.commandOrders.length,
    evidenceItems: projection.evidenceItems.length,
  };
}

export async function syncWorkspaceDomainProjection(
  pool: Pool,
  workspace: EnterpriseWorkspace,
): Promise<DomainProjectionSyncResult> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await syncWorkspaceDomainProjectionClient(client, workspace);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function syncWorkspaceDomainProjectionClient(
  client: PoolClient,
  workspace: EnterpriseWorkspace,
): Promise<DomainProjectionSyncResult> {
  const projection = buildDomainProjection(workspace);
  await client.query("select set_config('app.organization_id', $1, true)", [workspace.organizationId]);
  await ensureDomainSchema(client);
  await deleteDomainProjection(client, workspace.organizationId);
  await upsertOrganization(client, workspace);
  await insertProjection(client, projection);
  return {
    organizationId: workspace.organizationId,
    syncedAt: new Date().toISOString(),
    counts: domainProjectionCounts(projection),
  };
}

function buildEvidenceItems(workspace: EnterpriseWorkspace): DomainEvidenceItem[] {
  const organizationId = workspace.organizationId;
  const fromAudit = workspace.auditLogs.map((log) =>
    evidenceItem({
      organizationId,
      sourceType: "audit_log",
      sourceId: log.id,
      itemLabel: eventTitle(log.eventType),
      framework: frameworkForAuditEvent(log.eventType),
      control: controlForAuditEvent(log.eventType),
      riskLevel: log.riskLevel,
      confidence: "moderate",
      summary: log.message,
      createdAt: log.createdAt,
      payload: { eventType: log.eventType, actor: log.actor, integrity: log.integrity },
    }),
  );
  const fromRuns = workspace.runs.map((run) =>
    evidenceItem({
      organizationId,
      sourceType: "harness_run",
      sourceId: run.id,
      itemLabel: `Harness run ${run.id}`,
      framework: "OWASP LLM/MCP",
      control: "OWASP.LLM09",
      riskLevel: run.riskLevel,
      confidence: run.status === "completed" ? "high" : "moderate",
      summary: `${run.status} run with ${run.trace.length} trace steps.`,
      createdAt: run.startedAt,
      payload: {
        skillId: run.skillId,
        useCaseId: run.useCaseId,
        status: run.status,
        latencyMs: run.latencyMs,
        costUsd: run.costUsd,
      },
    }),
  );
  const fromEvals = workspace.evalResults.map((result) =>
    evidenceItem({
      organizationId,
      sourceType: "eval_result",
      sourceId: result.id,
      itemLabel: `${result.suiteName} eval`,
      framework: "NIST AI RMF",
      control: "NIST.MEASURE",
      riskLevel: result.criticalFailures > 0 ? "high" : "low",
      confidence: result.passed ? "high" : "moderate",
      summary: `${result.score}% eval score with ${result.criticalFailures} critical failures.`,
      createdAt: result.createdAt,
      payload: result,
    }),
  );
  const fromReviews = workspace.governanceReviews.map((review) =>
    evidenceItem({
      organizationId,
      sourceType: "governance_review",
      sourceId: review.id,
      itemLabel: review.title,
      framework: "ISO/IEC 42001",
      control: "ISO42001.AI_LIFECYCLE",
      riskLevel: review.riskLevel,
      confidence: review.status.includes("approved") ? "high" : "moderate",
      summary: `${review.status} review assigned to ${review.reviewer}.`,
      createdAt: review.dueDate,
      payload: review,
    }),
  );
  const fromUseCases = workspace.useCases.map((useCase) =>
    evidenceItem({
      organizationId,
      sourceType: "roi_assumption",
      sourceId: useCase.id,
      itemLabel: `${useCase.title} value case`,
      framework: "ISO/IEC 42001",
      control: "ISO42001.RESOURCE",
      riskLevel: useCase.riskLevel,
      confidence: useCase.expectedBenefits.length > 0 ? "moderate" : "low",
      summary: `${useCase.department} opportunity scored ${useCase.priorityScore}/100 with ${useCase.expectedBenefits.length} benefit assumptions.`,
      createdAt: useCase.updatedAt,
      payload: {
        valueScore: useCase.valueScore,
        feasibilityScore: useCase.feasibilityScore,
        reuseScore: useCase.reuseScore,
        priorityScore: useCase.priorityScore,
        expectedBenefits: useCase.expectedBenefits,
      },
    }),
  );
  const fromSignals = workspace.workSignals.map((signal) =>
    evidenceItem({
      organizationId,
      sourceType: "work_signal",
      sourceId: signal.id,
      itemLabel: `${signal.process} signal`,
      framework: "EU AI Act",
      control: "EUAI.TRACEABILITY",
      riskLevel: signal.riskLevel,
      confidence: "moderate",
      summary: signal.summary,
      createdAt: signal.createdAt,
      payload: { privacy: signal.privacy, metadata: signal.metadata },
    }),
  );
  return [...fromAudit, ...fromRuns, ...fromEvals, ...fromReviews, ...fromUseCases, ...fromSignals];
}

function evidenceItem(input: Omit<DomainEvidenceItem, "id">): DomainEvidenceItem {
  return {
    ...input,
    id: stableId([
      input.organizationId,
      input.sourceType,
      input.sourceId,
      input.framework,
      input.control,
    ]),
  };
}

async function deleteDomainProjection(client: PoolClient, organizationId: string): Promise<void> {
  const tables = [
    "evidence_items",
    "command_orders_domain",
    "work_signals_domain",
    "eval_results_domain",
    "governance_reviews_domain",
    "tool_requests_domain",
    "run_steps",
    "runs",
    "skill_context_policies",
    "skill_tool_policies",
    "skill_versions",
    "skills",
    "use_case_risks",
    "use_case_data_sources",
    "use_cases",
    "context_sources_domain",
    "ai_tools",
    "organization_members",
  ];
  for (const table of tables) {
    await client.query(`delete from ${table} where organization_id = $1`, [organizationId]);
  }
}

async function upsertOrganization(client: PoolClient, workspace: EnterpriseWorkspace): Promise<void> {
  await client.query(
    `insert into organizations (id, name, slug, created_at, updated_at)
     values ($1, $2, $3, now(), now())
     on conflict (id)
     do update set name = excluded.name, slug = excluded.slug, updated_at = now()`,
    [workspace.organization.id, workspace.organization.name, workspace.organization.slug],
  );
}

async function insertProjection(client: PoolClient, projection: DomainProjection): Promise<void> {
  const orgId = projection.organizationId;

  for (const user of projection.users) {
    await client.query(
      `insert into organization_members
       (organization_id, id, email, name, role, department, title, payload, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        orgId,
        user.id,
        user.email,
        user.name,
        user.role,
        user.department,
        user.title,
        json(user),
        new Date(),
        new Date(),
      ],
    );
  }

  for (const tool of projection.tools) {
    await client.query(
      `insert into ai_tools
       (organization_id, id, display_name, category, action_type, risk_level, enabled,
        requires_approval_by_default, usage_count, last_used, payload, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())`,
      [
        orgId,
        tool.id,
        tool.displayName,
        tool.category,
        tool.actionType,
        tool.riskLevel,
        tool.enabled,
        tool.requiresApprovalByDefault,
        tool.usage ?? 0,
        tool.lastUsed ?? null,
        json(tool),
      ],
    );
  }

  for (const source of projection.contextSources) {
    await client.query(
      `insert into context_sources_domain
       (organization_id, id, name, source_type, classification, owner_department, enabled,
        health, document_count, payload, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())`,
      [
        orgId,
        source.id,
        source.name,
        source.type,
        source.classification,
        source.ownerDepartment,
        source.enabled,
        source.health ?? "healthy",
        source.documentCount ?? 0,
        json(source),
      ],
    );
  }

  for (const useCase of projection.useCases) {
    await insertUseCase(client, orgId, useCase);
  }

  for (const skill of projection.skills) {
    await insertSkill(client, orgId, skill);
  }

  for (const run of projection.runs) {
    await insertRun(client, orgId, run);
  }

  for (const request of projection.toolRequests) {
    await client.query(
      `insert into tool_requests_domain
       (organization_id, id, skill_id, run_id, user_label, tool_id, status, risk_level, reason, requested_at, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        orgId,
        request.id,
        request.skillId ?? null,
        request.runId ?? null,
        request.user,
        request.toolId,
        request.status,
        request.riskLevel,
        request.reason,
        date(request.requestedAt),
        json(request),
      ],
    );
  }

  for (const review of projection.governanceReviews) {
    await client.query(
      `insert into governance_reviews_domain
       (organization_id, id, item_type, item_id, title, department, risk_level, reviewer, status, due_date, blockers, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
      [
        orgId,
        review.id,
        review.itemType,
        review.itemId,
        review.title,
        review.department,
        review.riskLevel,
        review.reviewer,
        review.status,
        review.dueDate || null,
        json(review.blockers ?? []),
        json(review),
      ],
    );
  }

  for (const result of projection.evalResults) {
    await client.query(
      `insert into eval_results_domain
       (organization_id, id, skill_id, suite_name, score, passed, critical_failures, payload, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
      [
        orgId,
        result.id,
        result.skillId,
        result.suiteName,
        result.score,
        result.passed,
        result.criticalFailures,
        json(result),
        date(result.createdAt),
      ],
    );
  }

  for (const signal of projection.workSignals) {
    await client.query(
      `insert into work_signals_domain
       (organization_id, id, source, event_type, department, process, risk_level, privacy, metadata, summary, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
      [
        orgId,
        signal.id,
        signal.source,
        signal.eventType,
        signal.department,
        signal.process,
        signal.riskLevel,
        json(signal.privacy),
        json(signal.metadata),
        signal.summary,
        date(signal.createdAt),
      ],
    );
  }

  for (const order of projection.commandOrders) {
    await client.query(
      `insert into command_orders_domain
       (organization_id, id, title, status, priority, owner, target_view, linked_entity_type,
        linked_entity_id, confidence, payload, due_date, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)`,
      [
        orgId,
        order.id,
        order.title,
        order.status,
        order.priority,
        order.owner,
        order.targetView,
        order.linkedEntityType ?? null,
        order.linkedEntityId ?? null,
        order.confidence ?? 0,
        json(order),
        order.dueDate || null,
        date(order.createdAt),
        date(order.updatedAt),
      ],
    );
  }

  for (const item of projection.evidenceItems) {
    await client.query(
      `insert into evidence_items
       (organization_id, id, source_type, source_id, item_label, framework, control, risk_level,
        confidence, summary, payload, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)`,
      [
        orgId,
        item.id,
        item.sourceType,
        item.sourceId,
        item.itemLabel,
        item.framework,
        item.control,
        item.riskLevel,
        item.confidence,
        item.summary,
        json(item.payload),
        date(item.createdAt),
      ],
    );
  }
}

async function insertUseCase(client: PoolClient, orgId: string, useCase: UseCase): Promise<void> {
  await client.query(
    `insert into use_cases
     (organization_id, id, title, department, status, risk_level, requestor_id, owner_id,
      priority_score, value_score, feasibility_score, risk_score, reuse_score, urgency_score,
      data_readiness_score, monthly_volume, avg_handling_time_minutes, estimated_users,
      capability_type, linked_skill_id, payload, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21::jsonb, $22, $23)`,
    [
      orgId,
      useCase.id,
      useCase.title,
      useCase.department,
      useCase.status,
      useCase.riskLevel,
      useCase.requestorId,
      useCase.ownerId ?? null,
      useCase.priorityScore ?? 0,
      useCase.valueScore ?? 0,
      useCase.feasibilityScore ?? 0,
      useCase.riskScore ?? 0,
      useCase.reuseScore ?? 0,
      useCase.urgencyScore ?? 0,
      useCase.dataReadinessScore ?? 0,
      useCase.monthlyVolume ?? 0,
      useCase.avgHandlingTimeMinutes ?? 0,
      useCase.estimatedUsers ?? 0,
      useCase.capabilityType,
      useCase.linkedSkillId ?? null,
      json(useCase),
      date(useCase.createdAt),
      date(useCase.updatedAt),
    ],
  );

  for (const [index, source] of useCase.dataSources.entries()) {
    await client.query(
      `insert into use_case_data_sources (organization_id, use_case_id, source_name, ordinal)
       values ($1, $2, $3, $4)`,
      [orgId, useCase.id, source, index],
    );
  }

  for (const [index, risk] of useCase.risks.entries()) {
    await client.query(
      `insert into use_case_risks (organization_id, use_case_id, risk, ordinal)
       values ($1, $2, $3, $4)`,
      [orgId, useCase.id, risk, index],
    );
  }
}

async function insertSkill(client: PoolClient, orgId: string, skill: Skill): Promise<void> {
  await client.query(
    `insert into skills
     (organization_id, id, use_case_id, name, slug, department, owner_id, status, version,
      risk_level, autonomy_tier, model_provider, model, eval_pass_rate, adoption_count,
      value_delivered, payload, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17::jsonb, $18)`,
    [
      orgId,
      skill.id,
      skill.useCaseId ?? null,
      skill.name,
      skill.slug,
      skill.department,
      skill.ownerId,
      skill.status,
      skill.version,
      skill.riskLevel,
      skill.autonomyTier,
      skill.modelProvider,
      skill.model,
      skill.evalPassRate ?? 0,
      skill.adoptionCount ?? 0,
      skill.valueDelivered ?? 0,
      json(skill),
      date(skill.updatedAt),
    ],
  );

  await client.query(
    `insert into skill_versions
     (organization_id, id, skill_id, version, status, prompt_hash, payload, created_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      orgId,
      `${skill.id}:${skill.version}`,
      skill.id,
      skill.version,
      skill.status,
      hash(skill.systemPrompt),
      json({ version: skill.version, status: skill.status, systemPrompt: skill.systemPrompt }),
      date(skill.updatedAt),
    ],
  );

  for (const toolId of skill.allowedTools) {
    await client.query(
      `insert into skill_tool_policies
       (organization_id, skill_id, tool_id, policy_type, requires_approval, payload)
       values ($1, $2, $3, 'allowed', $4, $5::jsonb)`,
      [orgId, skill.id, toolId, false, json({ toolId, allowed: true })],
    );
  }

  for (const toolId of skill.blockedTools) {
    await client.query(
      `insert into skill_tool_policies
       (organization_id, skill_id, tool_id, policy_type, requires_approval, payload)
       values ($1, $2, $3, 'blocked', false, $4::jsonb)`,
      [orgId, skill.id, toolId, json({ toolId, allowed: false })],
    );
  }

  for (const sourceId of skill.contextSources) {
    await client.query(
      `insert into skill_context_policies
       (organization_id, skill_id, context_source_id, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [orgId, skill.id, sourceId, json({ sourceId })],
    );
  }
}

async function insertRun(client: PoolClient, orgId: string, run: Run): Promise<void> {
  await client.query(
    `insert into runs
     (organization_id, id, skill_id, use_case_id, triggered_by, status, risk_level, current_stage,
      cost_usd, latency_ms, output, payload, started_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
    [
      orgId,
      run.id,
      run.skillId ?? null,
      run.useCaseId ?? null,
      run.triggeredBy,
      run.status,
      run.riskLevel,
      run.currentStage,
      run.costUsd ?? 0,
      run.latencyMs ?? 0,
      run.output ?? "",
      json(run),
      date(run.startedAt),
    ],
  );

  for (const [index, step] of run.trace.entries()) {
    await client.query(
      `insert into run_steps
       (organization_id, run_id, step_index, label, status, detail, latency_ms, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        orgId,
        run.id,
        index,
        step.label,
        step.status,
        step.detail,
        step.latencyMs ?? 0,
        json(step),
      ],
    );
  }
}

function frameworkForAuditEvent(eventType: string): DomainEvidenceItem["framework"] {
  if (eventType.includes("eval")) return "NIST AI RMF";
  if (eventType.includes("tool") || eventType.includes("policy")) return "OWASP LLM/MCP";
  if (eventType.includes("approval") || eventType.includes("review")) return "ISO/IEC 42001";
  return "NIST AI RMF";
}

function controlForAuditEvent(eventType: string): string {
  if (eventType.includes("eval")) return "NIST.MEASURE";
  if (eventType.includes("tool")) return "OWASP.LLM09";
  if (eventType.includes("approval") || eventType.includes("review")) return "ISO42001.AI_LIFECYCLE";
  if (eventType.includes("provider")) return "ISO42001.RESOURCE";
  return "NIST.MAP";
}

function eventTitle(eventType: string): string {
  return eventType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stableId(parts: string[]): string {
  return `evidence-${hash(parts.join("|")).slice(0, 20)}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function date(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
