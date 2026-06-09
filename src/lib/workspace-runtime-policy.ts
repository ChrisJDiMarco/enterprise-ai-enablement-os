import type { ContextSource, Skill, Tool } from "@/lib/enterprise-ai-data";
import type { EnterpriseWorkspace } from "@/lib/workspace-schema";

export type WorkspaceRuntimePolicyErrorCode =
  | "missing_skill_id"
  | "skill_not_registered"
  | "missing_tool_id"
  | "tool_not_registered";

export type WorkspaceRuntimePolicyError = {
  ok: false;
  code: WorkspaceRuntimePolicyErrorCode;
  status: 400 | 404;
  error: string;
};

export type WorkspaceSkillResolution =
  | { ok: true; skill: Skill }
  | WorkspaceRuntimePolicyError;

export type WorkspaceToolResolution =
  | { ok: true; tool: Tool }
  | WorkspaceRuntimePolicyError;

export type WorkspaceContextSourceResolution = {
  ok: true;
  sources: ContextSource[];
  missingSourceIds: string[];
};

function cleanId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveWorkspaceSkillForRuntime(
  workspace: EnterpriseWorkspace,
  requestedSkillId: unknown,
): WorkspaceSkillResolution {
  const skillId = cleanId(requestedSkillId);
  if (!skillId) {
    return {
      ok: false,
      code: "missing_skill_id",
      status: 400,
      error: "A workspace Skill id is required before runtime execution.",
    };
  }

  const skill = workspace.skills.find((item) => item.id === skillId);
  if (!skill) {
    return {
      ok: false,
      code: "skill_not_registered",
      status: 404,
      error: "Requested Skill is not registered in this tenant workspace.",
    };
  }

  return { ok: true, skill };
}

export function resolveWorkspaceToolForRuntime(
  workspace: EnterpriseWorkspace,
  requestedToolId: unknown,
): WorkspaceToolResolution {
  const toolId = cleanId(requestedToolId);
  if (!toolId) {
    return {
      ok: false,
      code: "missing_tool_id",
      status: 400,
      error: "A workspace Tool id is required before connector execution.",
    };
  }

  const tool = workspace.tools.find((item) => item.id === toolId);
  if (!tool) {
    return {
      ok: false,
      code: "tool_not_registered",
      status: 404,
      error: "Requested Tool is not registered in this tenant workspace.",
    };
  }

  return { ok: true, tool };
}

export function resolveWorkspaceContextSourcesForRuntime(
  workspace: EnterpriseWorkspace,
  skill: Skill,
): WorkspaceContextSourceResolution {
  const allowed = new Set(skill.contextSources.map((source) => source.trim().toLowerCase()).filter(Boolean));
  const sources = workspace.contextSources.filter(
    (source) => source.enabled && (allowed.has(source.id.toLowerCase()) || allowed.has(source.name.toLowerCase())),
  );
  const resolvedKeys = new Set(sources.flatMap((source) => [source.id.toLowerCase(), source.name.toLowerCase()]));
  const missingSourceIds = [...allowed].filter((sourceId) => !resolvedKeys.has(sourceId));

  return {
    ok: true,
    sources,
    missingSourceIds,
  };
}
