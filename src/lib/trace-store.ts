import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool } from "./database.ts";
import type { Run } from "./enterprise-ai-data.ts";
import type { ServerHarnessResult } from "./server-harness-runtime.ts";
import { tenantScopedJsonPath } from "./tenant-file-storage.ts";

export type HarnessTraceRecord = {
  id: string;
  organizationId: string;
  runId: string;
  skillId?: string;
  status: Run["status"];
  riskLevel: Run["riskLevel"];
  run: Run;
  route: ServerHarnessResult["route"];
  policy: ServerHarnessResult["policy"];
  model: ServerHarnessResult["model"];
  prompt: ServerHarnessResult["prompt"];
  createdAt: string;
};

export type HarnessTraceSummary = {
  total: number;
  completed: number;
  waitingForApproval: number;
  blocked: number;
  failed: number;
  promptQualityAverage: number;
  promptQualityUnsafe: number;
  policyBlocked: number;
  approvalGated: number;
  latestAt?: string;
};

const traceDir = path.join(process.cwd(), ".data", "run-traces");

function tracePath(organizationId: string) {
  return tenantScopedJsonPath(traceDir, organizationId);
}

function toRecord(organizationId: string, result: ServerHarnessResult, createdAt = new Date().toISOString()): HarnessTraceRecord {
  return {
    id: `trace-${result.run.id}`,
    organizationId,
    runId: result.run.id,
    skillId: result.run.skillId,
    status: result.run.status,
    riskLevel: result.run.riskLevel,
    run: result.run,
    route: result.route,
    policy: result.policy,
    model: result.model,
    prompt: result.prompt,
    createdAt,
  };
}

export function summarizeHarnessTraces(traces: HarnessTraceRecord[]): HarnessTraceSummary {
  const promptScores = traces.map((trace) => trace.prompt.quality.score).filter((score) => Number.isFinite(score));
  const promptQualityAverage = promptScores.length
    ? Math.round(promptScores.reduce((sum, score) => sum + score, 0) / promptScores.length)
    : 0;

  return {
    total: traces.length,
    completed: traces.filter((trace) => trace.status === "completed").length,
    waitingForApproval: traces.filter((trace) => trace.status === "waiting_for_approval").length,
    blocked: traces.filter((trace) => trace.status === "blocked").length,
    failed: traces.filter((trace) => trace.status === "failed").length,
    promptQualityAverage,
    promptQualityUnsafe: traces.filter((trace) => trace.prompt.quality.grade === "unsafe").length,
    policyBlocked: traces.filter((trace) =>
      Object.values(trace.policy).some((decision) => decision.status === "blocked"),
    ).length,
    approvalGated: traces.filter((trace) =>
      Object.values(trace.policy).some((decision) => decision.status === "requires_approval"),
    ).length,
    latestAt: traces
      .map((trace) => trace.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1),
  };
}

export async function recordHarnessTrace(organizationId: string, result: ServerHarnessResult) {
  const record = toRecord(organizationId, result);
  const pool = getDatabasePool();

  if (pool) {
    await ensureDatabaseSchema(pool);
    await pool.query(
      `
      insert into run_traces (id, organization_id, run_id, skill_id, status, risk_level, payload, created_at)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      on conflict (id)
      do update set status = excluded.status,
        risk_level = excluded.risk_level,
        payload = excluded.payload,
        created_at = excluded.created_at
      `,
      [
        record.id,
        record.organizationId,
        record.runId,
        record.skillId ?? null,
        record.status,
        record.riskLevel,
        JSON.stringify(record),
        new Date(record.createdAt),
      ],
    );
    return record;
  }

  const traces = await listHarnessTraces(organizationId, 10000);
  await mkdir(path.dirname(tracePath(organizationId)), { recursive: true });
  await writeFile(
    tracePath(organizationId),
    JSON.stringify([record, ...traces.filter((trace) => trace.id !== record.id)], null, 2),
  );
  return record;
}

export async function listHarnessTraces(organizationId: string, limit = 100): Promise<HarnessTraceRecord[]> {
  const pool = getDatabasePool();

  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await pool.query<{ payload: HarnessTraceRecord }>(
      "select payload from run_traces where organization_id = $1 order by created_at desc limit $2",
      [organizationId, limit],
    );
    return result.rows.map((row) => row.payload);
  }

  try {
    const raw = await readFile(tracePath(organizationId), "utf8");
    return (JSON.parse(raw) as HarnessTraceRecord[]).slice(0, limit);
  } catch {
    return [];
  }
}
