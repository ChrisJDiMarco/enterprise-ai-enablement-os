import type { AuditLog, Skill } from "./enterprise-ai-data.ts";
import type { ServerHarnessResult } from "./server-harness-runtime.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

export type HarnessWorkspacePersistenceResult = {
  workspace: EnterpriseWorkspace;
  auditLog: AuditLog;
  runInserted: boolean;
  toolRequestInserted: boolean;
};

function dateStamp(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function incrementSkillRunCount(skill: Skill, runInserted: boolean, updatedAt: string): Skill {
  if (!runInserted) return { ...skill, updatedAt };
  return {
    ...skill,
    runs: skill.runs + 1,
    updatedAt,
  };
}

export function mergeServerHarnessResultIntoWorkspace(params: {
  workspace: EnterpriseWorkspace;
  result: ServerHarnessResult;
  actor: string;
}): HarnessWorkspacePersistenceResult {
  const { workspace, result, actor } = params;
  const runInserted = !workspace.runs.some((run) => run.id === result.run.id);
  const runUpdatedAt = dateStamp(result.run.startedAt);
  const toolRequestInserted = result.toolRequest
    ? !workspace.toolRequests.some((request) => request.id === result.toolRequest?.id)
    : false;
  const auditLog: AuditLog = {
    id: `audit-harness-${result.run.id}`,
    eventType: result.toolRequest ? "tool_requested" : "workflow_run_started",
    message: result.toolRequest
      ? `${result.run.skillId} requested ${result.toolRequest.toolId} during server Harness run ${result.run.id}.`
      : `${result.run.skillId} server Harness run ${result.run.id} completed with status ${result.run.status}.`,
    actor,
    riskLevel: result.run.riskLevel,
    createdAt: result.run.startedAt,
  };

  return {
    workspace: {
      ...workspace,
      skills: workspace.skills.map((skill) =>
        skill.id === result.run.skillId ? incrementSkillRunCount(skill, runInserted, runUpdatedAt) : skill,
      ),
      runs: [result.run, ...workspace.runs.filter((run) => run.id !== result.run.id)],
      toolRequests: result.toolRequest
        ? [result.toolRequest, ...workspace.toolRequests.filter((request) => request.id !== result.toolRequest?.id)]
        : workspace.toolRequests,
      auditLogs: [auditLog, ...workspace.auditLogs.filter((log) => log.id !== auditLog.id)],
    },
    auditLog,
    runInserted,
    toolRequestInserted,
  };
}
