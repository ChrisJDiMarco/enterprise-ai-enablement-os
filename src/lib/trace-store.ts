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

export type HarnessTraceFreshness = {
  fresh: boolean;
  maxAgeDays: number;
  ageDays?: number;
  latestAt?: string;
  reason: string;
};

export type HarnessTraceViewerRecord = {
  id: string;
  runId: string;
  skillId?: string;
  status: Run["status"];
  riskLevel: Run["riskLevel"];
  createdAt: string;
  run: {
    currentStage: string;
    executionMode: Run["executionMode"];
    startedAt: string;
    latencyMs: number;
    costUsd: number;
    traceStepCount: number;
    trace: {
      label: string;
      status: Run["trace"][number]["status"];
      latencyMs: number;
    }[];
    outputRedacted: true;
  };
  route: {
    provider: string;
    modelRef: string;
    fallbackUsed: boolean;
  };
  policy: Record<"context" | "tool" | "output", {
    status: ServerHarnessResult["policy"]["context"]["status"];
    policyId: string;
    riskLevel: Run["riskLevel"];
  }>;
  model: HarnessTraceRecord["model"];
  prompt: {
    contractId: string;
    contractVersion: string;
    quality: {
      score: number;
      grade: HarnessTraceRecord["prompt"]["quality"]["grade"];
      passedChecks: number;
      totalChecks: number;
      missingCritical: string[];
    };
  };
};

const traceDir = path.join(process.cwd(), ".data", "run-traces");

function tracePath(organizationId: string) {
  return tenantScopedJsonPath(traceDir, organizationId);
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function harnessTraceFreshness(
  summary?: HarnessTraceSummary,
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): HarnessTraceFreshness {
  const maxAgeDays = positiveInteger(env.HARNESS_TRACE_MAX_AGE_DAYS, 30);
  if (!summary?.latestAt) {
    return {
      fresh: false,
      maxAgeDays,
      reason: "No Harness trace timestamp is available.",
    };
  }

  const latestMs = Date.parse(summary.latestAt);
  if (!Number.isFinite(latestMs)) {
    return {
      fresh: false,
      maxAgeDays,
      latestAt: summary.latestAt,
      reason: "Latest Harness trace timestamp is invalid.",
    };
  }

  const ageMs = Math.max(0, now.getTime() - latestMs);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const fresh = ageMs <= maxAgeMs;

  return {
    fresh,
    maxAgeDays,
    ageDays,
    latestAt: summary.latestAt,
    reason: fresh
      ? `Latest Harness trace evidence is ${ageDays.toLocaleString("en-US")} day(s) old within the ${maxAgeDays.toLocaleString("en-US")}-day freshness window.`
      : `Latest Harness trace evidence is ${ageDays.toLocaleString("en-US")} day(s) old, outside the ${maxAgeDays.toLocaleString("en-US")}-day freshness window.`,
  };
}

function safePolicyDecision(decision: HarnessTraceRecord["policy"][keyof HarnessTraceRecord["policy"]]) {
  return {
    status: decision.status,
    policyId: decision.policyId,
    riskLevel: decision.riskLevel,
  };
}

export function sanitizeHarnessTraceForViewer(trace: HarnessTraceRecord): HarnessTraceViewerRecord {
  return {
    id: trace.id,
    runId: trace.runId,
    skillId: trace.skillId,
    status: trace.status,
    riskLevel: trace.riskLevel,
    createdAt: trace.createdAt,
    run: {
      currentStage: trace.run.currentStage,
      executionMode: trace.run.executionMode,
      startedAt: trace.run.startedAt,
      latencyMs: trace.run.latencyMs,
      costUsd: trace.run.costUsd,
      traceStepCount: trace.run.trace.length,
      trace: trace.run.trace.map((step) => ({
        label: step.label,
        status: step.status,
        latencyMs: step.latencyMs,
      })),
      outputRedacted: true,
    },
    route: {
      provider: trace.route.provider,
      modelRef: trace.route.modelRef,
      fallbackUsed: trace.route.fallbackUsed,
    },
    policy: {
      context: safePolicyDecision(trace.policy.context),
      tool: safePolicyDecision(trace.policy.tool),
      output: safePolicyDecision(trace.policy.output),
    },
    model: trace.model,
    prompt: {
      contractId: trace.prompt.contractId,
      contractVersion: trace.prompt.contractVersion,
      quality: {
        score: trace.prompt.quality.score,
        grade: trace.prompt.quality.grade,
        passedChecks: trace.prompt.quality.passedChecks,
        totalChecks: trace.prompt.quality.totalChecks,
        missingCritical: trace.prompt.quality.missingCritical,
      },
    },
  };
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
