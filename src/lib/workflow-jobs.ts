import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool } from "@/lib/database";

export type WorkflowJobStatus = "queued" | "running" | "waiting_for_approval" | "completed" | "failed" | "cancelled";

export type WorkflowJob = {
  id: string;
  organizationId: string;
  workflowId?: string;
  skillId?: string;
  status: WorkflowJobStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const jobsDir = path.join(process.cwd(), ".data", "workflow-jobs");

function jobPath(organizationId: string) {
  return path.join(jobsDir, `${organizationId}.json`);
}

export async function listWorkflowJobs(organizationId: string): Promise<WorkflowJob[]> {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await pool.query<{
      id: string;
      organization_id: string;
      workflow_id: string | null;
      skill_id: string | null;
      status: WorkflowJobStatus;
      input: Record<string, unknown>;
      output: Record<string, unknown> | null;
      error: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      "select id, organization_id, workflow_id, skill_id, status, input, output, error, created_at, updated_at from workflow_jobs where organization_id = $1 order by created_at desc limit 500",
      [organizationId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      workflowId: row.workflow_id ?? undefined,
      skillId: row.skill_id ?? undefined,
      status: row.status,
      input: row.input,
      output: row.output ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  try {
    const raw = await readFile(jobPath(organizationId), "utf8");
    return JSON.parse(raw) as WorkflowJob[];
  } catch {
    return [];
  }
}

async function saveWorkflowJobs(organizationId: string, jobs: WorkflowJob[]) {
  await mkdir(path.dirname(jobPath(organizationId)), { recursive: true });
  await writeFile(jobPath(organizationId), JSON.stringify(jobs, null, 2));
}

export async function enqueueWorkflowJob(params: {
  organizationId: string;
  workflowId?: string;
  skillId?: string;
  input?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const job: WorkflowJob = {
    id: `job-${Date.now()}`,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    skillId: params.skillId,
    status: "queued",
    input: params.input ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    await pool.query(
      `
      insert into workflow_jobs (id, organization_id, workflow_id, skill_id, status, input, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      `,
      [
        job.id,
        job.organizationId,
        job.workflowId ?? null,
        job.skillId ?? null,
        job.status,
        JSON.stringify(job.input),
        new Date(job.createdAt),
        new Date(job.updatedAt),
      ],
    );
    return job;
  }

  const jobs = await listWorkflowJobs(params.organizationId);
  await saveWorkflowJobs(params.organizationId, [job, ...jobs]);
  return job;
}

export async function updateWorkflowJob(params: {
  organizationId: string;
  id: string;
  status: WorkflowJobStatus;
  output?: Record<string, unknown>;
  error?: string;
}) {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await pool.query<{
      id: string;
      organization_id: string;
      workflow_id: string | null;
      skill_id: string | null;
      status: WorkflowJobStatus;
      input: Record<string, unknown>;
      output: Record<string, unknown> | null;
      error: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      update workflow_jobs
      set status = $3, output = coalesce($4::jsonb, output), error = $5, updated_at = now()
      where organization_id = $1 and id = $2
      returning id, organization_id, workflow_id, skill_id, status, input, output, error, created_at, updated_at
      `,
      [
        params.organizationId,
        params.id,
        params.status,
        params.output ? JSON.stringify(params.output) : null,
        params.error ?? null,
      ],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          workflowId: row.workflow_id ?? undefined,
          skillId: row.skill_id ?? undefined,
          status: row.status,
          input: row.input,
          output: row.output ?? undefined,
          error: row.error ?? undefined,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        }
      : null;
  }

  const jobs = await listWorkflowJobs(params.organizationId);
  const updated = jobs.map((job) =>
    job.id === params.id
      ? {
          ...job,
          status: params.status,
          output: params.output ?? job.output,
          error: params.error,
          updatedAt: new Date().toISOString(),
        }
      : job,
  );
  await saveWorkflowJobs(params.organizationId, updated);
  return updated.find((job) => job.id === params.id) ?? null;
}
