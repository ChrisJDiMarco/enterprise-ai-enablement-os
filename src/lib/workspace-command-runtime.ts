import type {
  AuditLog,
  GovernanceReview,
  RiskLevel,
  Skill,
  ToolRequest,
} from "./enterprise-ai-data.ts";
import { defaultAISettings, normalizeAISettings } from "./model-router.ts";
import type { IntakeForm } from "./ui/types.ts";
import {
  buildEvalRun,
  buildExecutiveBrief,
  buildGovernanceReview,
  buildSkillFromUseCase,
  buildUseCaseSubmission,
} from "./workspace-commands.ts";
import { normalizeWorkspace, type EnterpriseWorkspace } from "./workspace-schema.ts";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  triage: "Triage",
  discovery: "Discovery",
  scored: "Scored",
  governance_review: "Governance Review",
  approved_for_pilot: "Approved for Pilot",
  in_pilot: "In Pilot",
  measuring: "Measuring",
  scaled: "Scaled",
  parked: "Parked",
  rejected: "Rejected",
  in_review: "In Review",
  approved: "Approved",
  pilot: "Pilot",
  production: "Production",
  deprecated: "Deprecated",
  archived: "Archived",
  waiting_for_approval: "Waiting for Approval",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  blocked: "Blocked",
  changes_requested: "Changes Requested",
  approved_with_conditions: "Approved with Conditions",
  not_submitted: "Not Submitted",
};

export type WorkspaceCommandType =
  | "create_use_case"
  | "convert_use_case_to_skill"
  | "run_eval_suite"
  | "submit_governance_review"
  | "decide_governance"
  | "decide_tool_request"
  | "publish_workflow"
  | "generate_report";

export type WorkspaceCommand = {
  id?: string;
  type: WorkspaceCommandType;
  payload?: Record<string, unknown>;
};

export type WorkspaceCommandContext = {
  userId: string;
  actor: string;
  now?: string;
};

export type WorkspaceCommandRuntimeResult = {
  ok: boolean;
  commandId: string;
  workspace: EnterpriseWorkspace;
  notification: string;
  auditLog?: AuditLog;
  result?: Record<string, unknown>;
  rollbackToken?: {
    commandId: string;
    beforeUpdatedAt: string;
    afterUpdatedAt: string;
  };
  error?: string;
};

function commandId(command: WorkspaceCommand, now: string) {
  const safeType = command.type.replace(/[^a-z0-9_]+/gi, "-");
  return command.id || `cmd-${safeType}-${Date.parse(now) || Date.now()}`;
}

function getString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function today(now: string) {
  const parsed = Date.parse(now);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function audit(params: {
  commandId: string;
  eventType: string;
  message: string;
  actor: string;
  riskLevel: RiskLevel;
  now: string;
}): AuditLog {
  return {
    id: `audit-${params.commandId}`,
    eventType: params.eventType,
    message: params.message,
    actor: params.actor,
    riskLevel: params.riskLevel,
    createdAt: params.now,
  };
}

function withWorkspaceUpdate(workspace: EnterpriseWorkspace, now: string) {
  return normalizeWorkspace({ ...workspace, updatedAt: now }, workspace.organizationId);
}

function reject(
  params: {
    command: WorkspaceCommand;
    workspace: EnterpriseWorkspace;
    now: string;
    notification: string;
    error: string;
  },
): WorkspaceCommandRuntimeResult {
  return {
    ok: false,
    commandId: commandId(params.command, params.now),
    workspace: params.workspace,
    notification: params.notification,
    error: params.error,
  };
}

function accept(params: {
  command: WorkspaceCommand;
  workspace: EnterpriseWorkspace;
  previousUpdatedAt: string;
  now: string;
  notification: string;
  auditLog?: AuditLog;
  result?: Record<string, unknown>;
}): WorkspaceCommandRuntimeResult {
  const id = commandId(params.command, params.now);
  return {
    ok: true,
    commandId: id,
    workspace: withWorkspaceUpdate(params.workspace, params.now),
    notification: params.notification,
    auditLog: params.auditLog,
    result: params.result,
    rollbackToken: {
      commandId: id,
      beforeUpdatedAt: params.previousUpdatedAt,
      afterUpdatedAt: params.now,
    },
  };
}

function resolveSkillForCommand(params: {
  command: WorkspaceCommand;
  workspace: EnterpriseWorkspace;
  payload: Record<string, unknown>;
  now: string;
  missingNotification: string;
  missingError: string;
}): { ok: true; skill: Skill } | { ok: false; result: WorkspaceCommandRuntimeResult } {
  const skillId = getString(params.payload, "skillId");
  const skill = skillId
    ? params.workspace.skills.find((item) => item.id === skillId)
    : params.workspace.skills[0];

  if (skill) return { ok: true, skill };

  if (skillId) {
    return {
      ok: false,
      result: reject({
        command: params.command,
        workspace: params.workspace,
        now: params.now,
        notification: "Skill not found",
        error: `No Skill matched ${skillId}.`,
      }),
    };
  }

  return {
    ok: false,
    result: reject({
      command: params.command,
      workspace: params.workspace,
      now: params.now,
      notification: params.missingNotification,
      error: params.missingError,
    }),
  };
}

function portfolioMetrics(workspace: EnterpriseWorkspace) {
  const totalUseCases = workspace.useCases.length;
  const activePilots = workspace.useCases.filter((item) =>
    ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status),
  ).length;
  const annualValue = workspace.skills.reduce((sum, skill) => sum + (skill.valueDelivered || 0), 0);
  const estimatedAnnualHours = workspace.useCases.reduce(
    (sum, item) => sum + Math.round(((item.monthlyVolume || 0) * (item.avgHandlingTimeMinutes || 0) * 12) / 60),
    0,
  );
  const adoptionRate = workspace.skills.length
    ? Math.round(
        workspace.skills.reduce((sum, skill) => sum + Math.min(100, Math.max(0, skill.adoptionCount || 0)), 0) /
          workspace.skills.length,
      )
    : 0;
  const riskItemsOpen =
    workspace.useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).length +
    workspace.governanceReviews.filter((review) => review.blockers.length > 0 || review.status === "changes_requested").length;

  return {
    totalUseCases,
    activePilots,
    skills: workspace.skills.length,
    adoptionRate,
    hoursSaved: estimatedAnnualHours,
    annualValue,
    riskItemsOpen,
  };
}

function decideGovernanceReview(
  review: GovernanceReview,
  status: GovernanceReview["status"],
): GovernanceReview {
  return {
    ...review,
    status,
    blockers:
      status === "approved"
        ? []
        : status === "approved_with_conditions"
          ? ["Pilot group size confirmation required"]
          : status === "changes_requested"
            ? ["Governance documentation must be completed"]
            : review.blockers,
  };
}

function skillStatusForGovernance(status: GovernanceReview["status"], skill: Skill): Skill {
  if (status === "approved") return { ...skill, status: "pilot" };
  if (status === "approved_with_conditions") return { ...skill, status: "approved" };
  if (status === "changes_requested") return { ...skill, status: "in_review" };
  return skill;
}

function applyToolDecisionToRun(run: EnterpriseWorkspace["runs"][number], request: ToolRequest, decision: "approved" | "rejected") {
  if (run.id !== request.runId) return run;
  return {
    ...run,
    status: decision === "approved" ? "completed" as const : "blocked" as const,
    currentStage: decision === "approved" ? "Response Delivered" : "Blocked by Approver",
    trace: [
      ...run.trace,
      {
        label: decision === "approved" ? "Tool approved" : "Tool rejected",
        status: decision === "approved" ? "completed" as const : "blocked" as const,
        detail:
          decision === "approved"
            ? "Approver reviewed the tool action and allowed execution."
            : "Approver rejected the tool request. No external action was taken.",
        latencyMs: 240,
      },
    ],
  };
}

export function applyWorkspaceCommand(
  workspaceInput: EnterpriseWorkspace,
  command: WorkspaceCommand,
  context: WorkspaceCommandContext,
): WorkspaceCommandRuntimeResult {
  const now = context.now || new Date().toISOString();
  const id = commandId(command, now);
  const payload = command.payload ?? {};
  const previousUpdatedAt = workspaceInput.updatedAt;
  const workspace = normalizeWorkspace(workspaceInput, workspaceInput.organizationId);
  const aiSettings = normalizeAISettings(workspace.aiSettings ?? defaultAISettings);

  if (command.type === "create_use_case") {
    const intake = payload.intake as IntakeForm | undefined;
    if (!intake) {
      return reject({
        command,
        workspace,
        now,
        notification: "Use case intake payload is required",
        error: "Missing payload.intake.",
      });
    }
    const outcome = buildUseCaseSubmission({
      intake,
      currentUserId: context.userId,
      useCaseId: getString(payload, "useCaseId") || `uc-${Date.parse(now) || Date.now()}`,
      createdAt: today(now),
      updatedAt: today(now),
    });
    if (!("data" in outcome)) {
      return reject({
        command,
        workspace,
        now,
        notification: outcome.notification,
        error: `Intake validation failed at step ${outcome.intakeStep}.`,
      });
    }
    const nextWorkspace = {
      ...workspace,
      useCases: [outcome.data.useCase, ...workspace.useCases],
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: outcome.notification,
      auditLog: outcome.audit
        ? audit({ commandId: id, ...outcome.audit, actor: outcome.audit.actor ?? context.actor, now })
        : undefined,
      result: { useCaseId: outcome.data.useCase.id, priorityScore: outcome.data.useCase.priorityScore },
    });
  }

  if (command.type === "convert_use_case_to_skill") {
    const useCaseId = getString(payload, "useCaseId");
    const useCase = workspace.useCases.find((item) => item.id === useCaseId);
    if (!useCase) {
      return reject({ command, workspace, now, notification: "Use case not found", error: `No use case matched ${useCaseId}.` });
    }
    if (useCase.linkedSkillId) {
      const linkedSkill = workspace.skills.find((item) => item.id === useCase.linkedSkillId);
      if (linkedSkill) {
        return accept({
          command,
          workspace,
          previousUpdatedAt,
          now,
          notification: "Existing linked Skill is already available",
          result: { skillId: linkedSkill.id, unchanged: true },
        });
      }
    }
    const existingSkillForUseCase = workspace.skills.find((item) => item.useCaseId === useCase.id);
    if (existingSkillForUseCase) {
      const nextWorkspace = {
        ...workspace,
        useCases: workspace.useCases.map((item) =>
          item.id === useCase.id ? { ...item, linkedSkillId: existingSkillForUseCase.id } : item,
        ),
      };
      return accept({
        command,
        workspace: nextWorkspace,
        previousUpdatedAt,
        now,
        notification: "Use case relinked to existing Skill",
        result: { skillId: existingSkillForUseCase.id, useCaseId: useCase.id, relinked: true },
      });
    }
    const requestedSkillId = getString(payload, "skillId");
    const skillId = useCase.linkedSkillId || requestedSkillId || `skill-${Date.parse(now) || Date.now()}`;
    if (!useCase.linkedSkillId && workspace.skills.some((item) => item.id === skillId)) {
      return reject({
        command,
        workspace,
        now,
        notification: "Skill id already exists",
        error: `A Skill already exists with id ${skillId}.`,
      });
    }
    const outcome = buildSkillFromUseCase({
      useCase,
      currentUserId: context.userId,
      skillId,
      aiSettings,
      tools: workspace.tools,
      updatedAt: today(now),
    });
    const nextWorkspace = {
      ...workspace,
      skills: [outcome.data.skill, ...workspace.skills],
      useCases: workspace.useCases.map((item) => (item.id === useCase.id ? outcome.data.updatedUseCase : item)),
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: outcome.notification,
      auditLog: outcome.audit
        ? audit({ commandId: id, ...outcome.audit, actor: outcome.audit.actor ?? context.actor, now })
        : undefined,
      result: { skillId: outcome.data.skill.id, useCaseId: useCase.id },
    });
  }

  if (command.type === "run_eval_suite") {
    const skillResolution = resolveSkillForCommand({
      command,
      workspace,
      payload,
      now,
      missingNotification: "Create a Skill before running evals",
      missingError: "No Skill available.",
    });
    if (!skillResolution.ok) return skillResolution.result;
    const { skill } = skillResolution;
    const outcome = buildEvalRun(skill, now);
    const nextWorkspace = {
      ...workspace,
      evalResults: [outcome.data.result, ...workspace.evalResults],
      skills: workspace.skills.map((item) => (item.id === skill.id ? outcome.data.updatedSkill : item)),
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: outcome.notification,
      auditLog: outcome.audit
        ? audit({ commandId: id, ...outcome.audit, actor: outcome.audit.actor ?? context.actor, now })
        : undefined,
      result: { evalResultId: outcome.data.result.id, score: outcome.data.result.score, passed: outcome.data.result.passed },
    });
  }

  if (command.type === "submit_governance_review") {
    const skillResolution = resolveSkillForCommand({
      command,
      workspace,
      payload,
      now,
      missingNotification: "Create a Skill before governance review",
      missingError: "No Skill available.",
    });
    if (!skillResolution.ok) return skillResolution.result;
    const { skill } = skillResolution;
    const existing = workspace.governanceReviews.find((review) => review.itemId === skill.id);
    if (existing) {
      return accept({
        command,
        workspace,
        previousUpdatedAt,
        now,
        notification: "Governance review already exists",
        result: { reviewId: existing.id, unchanged: true },
      });
    }
    const outcome = buildGovernanceReview(skill, today(now));
    const nextWorkspace = {
      ...workspace,
      governanceReviews: [outcome.data.review, ...workspace.governanceReviews],
      skills: workspace.skills.map((item) => (item.id === skill.id ? outcome.data.updatedSkill : item)),
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: outcome.notification,
      auditLog: outcome.audit
        ? audit({ commandId: id, ...outcome.audit, actor: outcome.audit.actor ?? context.actor, now })
        : undefined,
      result: { reviewId: outcome.data.review.id, skillId: skill.id },
    });
  }

  if (command.type === "decide_governance") {
    const reviewId = getString(payload, "reviewId");
    const status = getString(payload, "status") as GovernanceReview["status"];
    if (!["approved", "approved_with_conditions", "changes_requested", "rejected"].includes(status)) {
      return reject({ command, workspace, now, notification: "Invalid governance decision", error: "Decision status is not allowed." });
    }
    const review = workspace.governanceReviews.find((item) => item.id === reviewId);
    if (!review) {
      return reject({ command, workspace, now, notification: "Governance review not found", error: `No review matched ${reviewId}.` });
    }
    if (review.itemType === "skill" && !workspace.skills.some((skill) => skill.id === review.itemId)) {
      return reject({
        command,
        workspace,
        now,
        notification: "Reviewed Skill not found",
        error: `No Skill matched governance review item ${review.itemId}.`,
      });
    }
    if (review.itemType === "use_case" && !workspace.useCases.some((useCase) => useCase.id === review.itemId)) {
      return reject({
        command,
        workspace,
        now,
        notification: "Reviewed use case not found",
        error: `No use case matched governance review item ${review.itemId}.`,
      });
    }
    const updatedReview = decideGovernanceReview(review, status);
    const nextWorkspace = {
      ...workspace,
      governanceReviews: workspace.governanceReviews.map((item) => (item.id === review.id ? updatedReview : item)),
      skills:
        review.itemType === "skill"
          ? workspace.skills.map((skill) => (skill.id === review.itemId ? skillStatusForGovernance(status, skill) : skill))
          : workspace.skills,
    };
    const label = statusLabels[status] ?? status;
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification:
        status === "approved"
          ? "Skill approved for pilot"
          : status === "approved_with_conditions"
            ? "Skill approved with conditions"
            : status === "changes_requested"
              ? "Changes requested"
              : "Governance review rejected",
      auditLog: audit({
        commandId: id,
        eventType: status === "approved" ? "human_approval_granted" : "feedback_received",
        message: `${review.title} governance decision: ${label}.`,
        riskLevel: review.riskLevel,
        actor: context.actor,
        now,
      }),
      result: { reviewId: review.id, status },
    });
  }

  if (command.type === "decide_tool_request") {
    const requestId = getString(payload, "requestId");
    const decision = getString(payload, "decision") as "approved" | "rejected";
    if (!["approved", "rejected"].includes(decision)) {
      return reject({ command, workspace, now, notification: "Invalid tool decision", error: "Tool decision must be approved or rejected." });
    }
    const request = workspace.toolRequests.find((item) => item.id === requestId);
    if (!request) {
      return reject({ command, workspace, now, notification: "Tool request not found", error: `No tool request matched ${requestId}.` });
    }
    if (!workspace.skills.some((skill) => skill.id === request.skillId)) {
      return reject({
        command,
        workspace,
        now,
        notification: "Tool request Skill not found",
        error: `No Skill matched tool request ${request.id}.`,
      });
    }
    if (!workspace.runs.some((run) => run.id === request.runId)) {
      return reject({
        command,
        workspace,
        now,
        notification: "Tool request run not found",
        error: `No run matched tool request ${request.id}.`,
      });
    }
    const nextWorkspace = {
      ...workspace,
      toolRequests: workspace.toolRequests.map((item) => (item.id === request.id ? { ...item, status: decision } : item)),
      runs: workspace.runs.map((run) => applyToolDecisionToRun(run, request, decision)),
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: decision === "approved" ? "Approval granted" : "Tool request rejected",
      auditLog: audit({
        commandId: id,
        eventType: decision === "approved" ? "tool_approved" : "human_approval_rejected",
        message: `${request.toolId} ${decision} for run ${request.runId}.`,
        riskLevel: request.riskLevel,
        actor: context.actor,
        now,
      }),
      result: { requestId: request.id, decision, runId: request.runId },
    });
  }

  if (command.type === "publish_workflow") {
    if (!workspace.workflow.nodes.length) {
      return reject({
        command,
        workspace,
        now,
        notification: "Add workflow blocks before publishing",
        error: "Workflow has no blocks.",
      });
    }
    const nextWorkspace = {
      ...workspace,
      workflow: {
        ...workspace.workflow,
        status: "Published" as const,
      },
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: "Workflow published",
      auditLog: audit({
        commandId: id,
        eventType: "workflow_published",
        message: "Workflow published through workspace command runtime.",
        riskLevel: "medium",
        actor: context.actor,
        now,
      }),
      result: { status: "Published", nodes: workspace.workflow.nodes.length, edges: workspace.workflow.edges.length },
    });
  }

  if (command.type === "generate_report") {
    const outcome = buildExecutiveBrief({
      useCases: workspace.useCases,
      skills: workspace.skills,
      governanceReviews: workspace.governanceReviews,
      workSignals: workspace.workSignals,
      metrics: portfolioMetrics(workspace),
      statusLabels,
    });
    const nextWorkspace = {
      ...workspace,
      report: outcome.data.report,
    };
    return accept({
      command,
      workspace: nextWorkspace,
      previousUpdatedAt,
      now,
      notification: outcome.notification,
      auditLog:
        outcome.audit && outcome.data.shouldAudit
          ? audit({ commandId: id, ...outcome.audit, actor: outcome.audit.actor ?? context.actor, now })
          : undefined,
      result: { reportLength: outcome.data.report.length, audited: outcome.data.shouldAudit },
    });
  }

  return reject({
    command,
    workspace,
    now,
    notification: "Unsupported workspace command",
    error: `Unsupported command type: ${command.type}`,
  });
}
