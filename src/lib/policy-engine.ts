import type { RiskLevel, Skill, Tool } from "@/lib/enterprise-ai-data";

export type PolicyDecisionStatus = "approved" | "requires_approval" | "blocked";

export type PolicyDecision = {
  status: PolicyDecisionStatus;
  reason: string;
  policyId: string;
  riskLevel: RiskLevel;
};

export type ContextPolicyDecision = PolicyDecision & {
  allowedSourceIds: string[];
};

type OutputPolicyFinding = {
  id: string;
  pattern: RegExp;
  reason: string;
  riskLevel: RiskLevel;
};

const outputPolicyFindings: OutputPolicyFinding[] = [
  {
    id: "prompt_injection",
    pattern: /\b(ignore|disregard|override)\s+(all\s+)?(prior|previous|above|system|developer)\s+instructions?\b/i,
    reason: "Prompt-injection instruction detected.",
    riskLevel: "high",
  },
  {
    id: "system_prompt_exfiltration",
    pattern: /\b(reveal|print|show|dump|expose|repeat)\b.*\b(system prompt|developer message|hidden instruction|policy text)\b/i,
    reason: "System-prompt or hidden-instruction exfiltration detected.",
    riskLevel: "high",
  },
  {
    id: "secret_exfiltration",
    pattern: /\b(api key|secret key|password|credential|token|private key|bearer token)\b/i,
    reason: "Credential or secret exposure detected.",
    riskLevel: "restricted",
  },
  {
    id: "tool_bypass",
    pattern: /\b(send|sent|email|execute|executed|updated|deleted|created|approved)\b.*\b(without approval|bypass|outside the harness|directly in the system)\b/i,
    reason: "Tool or approval bypass claim detected.",
    riskLevel: "high",
  },
  {
    id: "financial_authority",
    pattern: /\b(approve|approved|authorize|authorized|release|released)\b.*\b(payment|wire|invoice|journal entry|financial statement)\b/i,
    reason: "Financial authority claim requires human approval.",
    riskLevel: "restricted",
  },
  {
    id: "employment_authority",
    pattern: /\b(terminate|fire|discipline|promote|demote|hire|reject|approve leave|deny leave|change compensation|change benefits)\b/i,
    reason: "Employment or benefits decision authority requires human review.",
    riskLevel: "restricted",
  },
  {
    id: "legal_authority",
    pattern: /\b(legal advice|final legal conclusion|approve contract|accept liability|make a legal commitment)\b/i,
    reason: "Legal authority claim requires legal review.",
    riskLevel: "restricted",
  },
  {
    id: "surveillance",
    pattern: /\b(rank employees|score employees|monitor private messages|read private messages|surveil|surveillance)\b/i,
    reason: "Employee surveillance or individual scoring pattern detected.",
    riskLevel: "restricted",
  },
];

function higherRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "restricted"];
  return order.indexOf(left) > order.indexOf(right) ? left : right;
}

export function classifyOutputPolicyFindings(output: string) {
  return outputPolicyFindings.filter((finding) => finding.pattern.test(output));
}

export function evaluateToolPolicy(params: {
  skill: Skill;
  tool?: Tool;
  toolId: string;
}): PolicyDecision {
  const { skill, tool, toolId } = params;
  const policyId = `${skill.slug || skill.id}-tool-policy-v${skill.version || "1"}`;

  if (!toolId) {
    return {
      status: "approved",
      reason: "No tool requested for this run.",
      policyId,
      riskLevel: skill.riskLevel,
    };
  }

  if (!tool) {
    return {
      status: "blocked",
      reason: "Requested tool is not registered in the connector catalog.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, "medium"),
    };
  }

  if (!tool.enabled) {
    return {
      status: "blocked",
      reason: "Requested tool is disabled.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
    };
  }

  if (!skill.allowedTools.includes(tool.id)) {
    return {
      status: "blocked",
      reason: "Skill policy does not allow this tool.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
    };
  }

  if (skill.blockedTools.includes(tool.id)) {
    return {
      status: "blocked",
      reason: "Tool appears in the Skill blocked-tools list.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
    };
  }

  if (skill.autonomyTier === "tier_0_draft_only" && tool.actionType !== "read") {
    return {
      status: "blocked",
      reason: "Tier 0 Skills cannot execute tool actions.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
    };
  }

  if (skill.autonomyTier === "tier_1_read_only" && tool.actionType !== "read") {
    return {
      status: "blocked",
      reason: "Tier 1 Skills are read-only.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
    };
  }

  if (
    tool.requiresApprovalByDefault ||
    skill.autonomyTier === "tier_2_prepare_action" ||
    skill.riskLevel === "high" ||
    skill.riskLevel === "restricted" ||
    ["write", "create", "update", "delete", "execute"].includes(tool.actionType)
  ) {
    return {
      status: "requires_approval",
      reason: "Human approval required by tool risk, action type, risk level, or autonomy tier.",
      policyId,
      riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
    };
  }

  return {
    status: "approved",
    reason: "Tool request allowed by Skill policy and autonomy tier.",
    policyId,
    riskLevel: higherRisk(skill.riskLevel, tool.riskLevel),
  };
}

export function evaluateContextPolicy(skill: Skill): ContextPolicyDecision {
  const policyId = `${skill.slug || skill.id}-context-policy-v${skill.version || "1"}`;

  if (skill.riskLevel === "restricted") {
    return {
      status: "requires_approval",
      reason: "Restricted Skills require explicit approval before context is passed to a model.",
      policyId,
      riskLevel: skill.riskLevel,
      allowedSourceIds: skill.contextSources,
    };
  }

  return {
    status: "approved",
    reason: `${skill.contextSources.length} configured context source IDs are allowed for this local run.`,
    policyId,
    riskLevel: skill.riskLevel,
    allowedSourceIds: skill.contextSources,
  };
}

export function evaluateOutputPolicy(params: {
  skill: Skill;
  output: string;
}): PolicyDecision {
  const { output, skill } = params;
  const policyId = `${skill.slug || skill.id}-output-policy-v${skill.version || "1"}`;
  const matchedFinding = classifyOutputPolicyFindings(output)[0];

  if (matchedFinding) {
    return {
      status: "blocked",
      reason: `${matchedFinding.reason} (${matchedFinding.id})`,
      policyId,
      riskLevel: higherRisk(skill.riskLevel, matchedFinding.riskLevel),
    };
  }

  if (skill.riskLevel === "restricted") {
    return {
      status: "requires_approval",
      reason: "Restricted Skill outputs require human review before delivery.",
      policyId,
      riskLevel: skill.riskLevel,
    };
  }

  return {
    status: "approved",
    reason: "Output passed local safety and policy checks.",
    policyId,
    riskLevel: skill.riskLevel,
  };
}
