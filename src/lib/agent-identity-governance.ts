import type { AuditLog, Run, Skill, ToolRequest } from "./enterprise-ai-data.ts";
import { getUserName } from "./enterprise-ai-data.ts";

export type AgentIdentityStatus = "active" | "restricted" | "disabled" | "needs-owner";

export type AgentIdentityRecord = {
  skillId: string;
  name: string;
  subject: string;
  owner: string;
  status: AgentIdentityStatus;
  riskLevel: Skill["riskLevel"];
  autonomy: string;
  scopes: string[];
  policyDecisions: number;
  approvalHistory: number;
  lastRun: string;
  killSwitchEngaged: boolean;
  evidence: string;
  nextAction: string;
};

export type AgentIdentityGovernance = {
  score: number;
  summary: string;
  records: AgentIdentityRecord[];
  activeAgents: number;
  restrictedAgents: number;
  disabledAgents: number;
  missingOwners: number;
};

export type AgentIdentityGovernanceInput = {
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
};

function slugSubject(skill: Skill) {
  const slug = skill.slug || skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `agent:${slug}:v${skill.version}`;
}

function statusForSkill(skill: Skill): AgentIdentityStatus {
  if (skill.status === "archived" || skill.status === "deprecated") return "disabled";
  if (!skill.ownerId) return "needs-owner";
  if (skill.riskLevel === "restricted" || skill.autonomyTier === "tier_5_restricted") return "restricted";
  return "active";
}

function scopesForSkill(skill: Skill) {
  const scopes = ["identity:read", "audit:write", "model:route"];
  if (skill.contextSources.length) scopes.push("context:retrieve");
  if (skill.allowedTools.length) scopes.push("tools:request");
  if (skill.autonomyTier !== "tier_1_read_only" && skill.autonomyTier !== "tier_0_draft_only") scopes.push("approval:checkpoint");
  return scopes;
}

function autonomyLabel(tier: Skill["autonomyTier"]) {
  return tier
    .replace(/^tier_/, "Tier ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nextActionFor(record: Pick<AgentIdentityRecord, "status" | "killSwitchEngaged">) {
  if (record.killSwitchEngaged) return "Review the disablement reason, audit impact, and required approval before reactivation.";
  if (record.status === "needs-owner") return "Assign an accountable owner and reviewer group before the agent can run.";
  if (record.status === "restricted") return "Confirm explicit approval, strict scopes, human oversight, and rollback evidence.";
  return "Keep scopes least-privilege, refresh owner attestations, and review policy decisions after every version change.";
}

export function deriveAgentIdentityGovernance(input: AgentIdentityGovernanceInput): AgentIdentityGovernance {
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const auditLogs = input.auditLogs ?? [];

  const records = skills.map((skill) => {
    const relatedRuns = runs.filter((run) => run.skillId === skill.id);
    const relatedRequests = toolRequests.filter((request) => request.skillId === skill.id);
    const relatedAudit = auditLogs.filter((log) => log.message.toLowerCase().includes(skill.name.toLowerCase()));
    const status = statusForSkill(skill);
    const killSwitchEngaged = status === "disabled";
    const scopes = scopesForSkill(skill);
    const lastRun = relatedRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.startedAt ?? "No runs";
    const evidence = `${relatedRuns.length} run${relatedRuns.length === 1 ? "" : "s"} · ${relatedRequests.length} broker decision${relatedRequests.length === 1 ? "" : "s"} · ${relatedAudit.length} audit event${relatedAudit.length === 1 ? "" : "s"}`;

    return {
      skillId: skill.id,
      name: skill.name,
      subject: slugSubject(skill),
      owner: getUserName(skill.ownerId),
      status,
      riskLevel: skill.riskLevel,
      autonomy: autonomyLabel(skill.autonomyTier),
      scopes,
      policyDecisions: relatedRequests.length,
      approvalHistory: relatedRequests.filter((request) => ["approved", "rejected"].includes(request.status)).length,
      lastRun,
      killSwitchEngaged,
      evidence,
      nextAction: nextActionFor({ status, killSwitchEngaged }),
    };
  });

  const activeAgents = records.filter((record) => record.status === "active").length;
  const restrictedAgents = records.filter((record) => record.status === "restricted").length;
  const disabledAgents = records.filter((record) => record.status === "disabled").length;
  const missingOwners = records.filter((record) => record.status === "needs-owner").length;
  const score = records.length
    ? Math.round(
        ((records.filter((record) => record.owner !== "Unassigned" && record.owner !== "User not configured").length / records.length) * 35) +
          ((records.filter((record) => record.scopes.length <= 6).length / records.length) * 25) +
          ((records.filter((record) => record.policyDecisions || record.status === "disabled").length / records.length) * 20) +
          ((records.filter((record) => record.status !== "needs-owner").length / records.length) * 20),
      )
    : 0;

  return {
    score,
    records,
    activeAgents,
    restrictedAgents,
    disabledAgents,
    missingOwners,
    summary: records.length
      ? `${activeAgents} active, ${restrictedAgents} restricted, ${disabledAgents} disabled, and ${missingOwners} missing owner assignment across ${records.length} agent identities.`
      : "No agent identities exist yet. Creating a Skill creates its governed runtime identity.",
  };
}
