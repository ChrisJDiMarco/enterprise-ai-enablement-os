import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool } from "@/lib/database";
import type { ConnectorExecutionResult } from "@/lib/connector-broker";

export type ConnectorEvent = {
  id: string;
  organizationId: string;
  skillId?: string;
  toolId: string;
  status: ConnectorExecutionResult["status"];
  decision: ConnectorExecutionResult["decision"];
  payload: Record<string, unknown>;
  createdAt: string;
};

const connectorDir = path.join(process.cwd(), ".data", "connector-events");

function connectorPath(organizationId: string) {
  return path.join(connectorDir, `${organizationId}.json`);
}

export async function recordConnectorEvent(event: ConnectorEvent) {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    await pool.query(
      `
      insert into connector_events (id, organization_id, skill_id, tool_id, status, decision, payload, created_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
      on conflict (id) do nothing
      `,
      [
        event.id,
        event.organizationId,
        event.skillId ?? null,
        event.toolId,
        event.status,
        JSON.stringify(event.decision),
        JSON.stringify(event.payload),
        new Date(event.createdAt),
      ],
    );
    return;
  }

  const events = await listConnectorEvents(event.organizationId, 10000);
  await mkdir(path.dirname(connectorPath(event.organizationId)), { recursive: true });
  await writeFile(
    connectorPath(event.organizationId),
    JSON.stringify([event, ...events.filter((item) => item.id !== event.id)], null, 2),
  );
}

export async function listConnectorEvents(organizationId: string, limit = 100): Promise<ConnectorEvent[]> {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await pool.query<{
      id: string;
      organization_id: string;
      skill_id: string | null;
      tool_id: string;
      status: ConnectorExecutionResult["status"];
      decision: ConnectorExecutionResult["decision"];
      payload: Record<string, unknown>;
      created_at: Date;
    }>(
      "select id, organization_id, skill_id, tool_id, status, decision, payload, created_at from connector_events where organization_id = $1 order by created_at desc limit $2",
      [organizationId, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      skillId: row.skill_id ?? undefined,
      toolId: row.tool_id,
      status: row.status,
      decision: row.decision,
      payload: row.payload,
      createdAt: row.created_at.toISOString(),
    }));
  }

  try {
    const raw = await readFile(connectorPath(organizationId), "utf8");
    return (JSON.parse(raw) as ConnectorEvent[]).slice(0, limit);
  } catch {
    return [];
  }
}
