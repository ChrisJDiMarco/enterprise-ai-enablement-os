import type { Department, EvalResult, GovernanceReview, Run, Skill, UseCase } from "@/lib/enterprise-ai-data";

export type PatternMarketplaceItem = {
  id: string;
  kind: "workspace-pattern" | "starter-template";
  title: string;
  department: Department | "Cross-Functional";
  process: string;
  patternType: "Knowledge Skill" | "Agentic Workflow" | "Document Intelligence" | "Governance Pack" | "Adoption Playbook";
  description: string;
  sourceSkillId?: string;
  sourceUseCaseId?: string;
  readiness: number;
  installConfidence: number;
  evidence: string;
  controls: string[];
  promptStarter: string;
  recommendedFor: string[];
};

export type PatternMarketplace = {
  score: number;
  workspacePatterns: PatternMarketplaceItem[];
  starterTemplates: PatternMarketplaceItem[];
  recommended: PatternMarketplaceItem[];
  summary: string;
};

export type PatternInstallPlan = {
  patternId: string;
  title: string;
  estimatedDays: number;
  launchMode: "reuse" | "starter";
  steps: {
    id: string;
    label: string;
    detail: string;
    evidence: string;
  }[];
  exitCriteria: string[];
};

export type PatternMarketplaceInput = {
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
};

export const starterPatternTemplates: PatternMarketplaceItem[] = [
  {
    id: "starter-policy-copilot",
    kind: "starter-template",
    title: "Policy Self-Service Copilot",
    department: "HR",
    process: "Employee policy questions",
    patternType: "Knowledge Skill",
    description: "Grounded assistant for high-volume internal policy questions with citations, no decision authority, and escalation rules.",
    readiness: 74,
    installConfidence: 86,
    evidence: "Template includes read-only autonomy, citations, prompt-injection handling, and HR escalation boundaries.",
    controls: ["NIST.MAP", "ISO42001.RESOURCE", "EUAI.HUMAN_OVERSIGHT", "OWASP.LLM01"],
    promptStarter:
      "You are an internal policy assistant. Answer only from approved policy sources, cite sources, disclose missing evidence, and escalate employee-impacting or ambiguous decisions.",
    recommendedFor: ["HR", "IT", "Operations"],
  },
  {
    id: "starter-close-briefing",
    kind: "starter-template",
    title: "Finance Close Variance Briefing",
    department: "Finance",
    process: "Close status and variance review",
    patternType: "Agentic Workflow",
    description: "Human-gated workflow for retrieving close evidence, summarizing variance narratives, and routing risky items to finance owners.",
    readiness: 70,
    installConfidence: 82,
    evidence: "Template includes bounded tool access, finance source grounding, approval checkpoint, and variance risk flags.",
    controls: ["NIST.MEASURE", "ISO42001.OPERATION", "EUAI.TECHNICAL_DOCUMENTATION", "OWASP.MCP05"],
    promptStarter:
      "You are a finance close assistant. Separate source facts from interpretation, never fabricate numbers, flag missing evidence, and route high-risk discrepancies for human review.",
    recommendedFor: ["Finance", "Operations"],
  },
  {
    id: "starter-intake-triage",
    kind: "starter-template",
    title: "Legal Intake Triage",
    department: "Legal",
    process: "Matter intake and routing",
    patternType: "Document Intelligence",
    description: "Classifies requests, extracts key facts, prepares routing recommendations, and avoids legal advice or final conclusions.",
    readiness: 72,
    installConfidence: 80,
    evidence: "Template includes no-legal-advice rule, matter routing, source citations, and high-risk escalation.",
    controls: ["NIST.GOVERN", "ISO42001.AI_LIFECYCLE", "EUAI.TRANSPARENCY", "OWASP.LLM02"],
    promptStarter:
      "You are a legal operations intake assistant. Classify and summarize requests, do not provide legal advice, and route urgent or external-facing matters to the legal owner.",
    recommendedFor: ["Legal", "Compliance", "Procurement"],
  },
  {
    id: "starter-runtime-import",
    kind: "starter-template",
    title: "Universal Runtime Import Pack",
    department: "Cross-Functional",
    process: "Agent runtime observability",
    patternType: "Governance Pack",
    description: "Normalizes traces, tool calls, evals, approvals, cost, latency, and proof IDs from Langfuse, LangSmith, Phoenix, OpenTelemetry, or custom agent runtimes.",
    readiness: 76,
    installConfidence: 84,
    evidence: "Template includes an adapter manifest, trace field map, import quality checks, and proof-ledger reconciliation.",
    controls: ["NIST.MEASURE", "ISO42001.OPERATION", "OWASP.LLM10", "OWASP.MCP06"],
    promptStarter:
      "You are importing external agent runtime evidence. Preserve source IDs, never overwrite original events, flag missing owner or risk fields, and map traces to proof records before governance review.",
    recommendedFor: ["IT", "Data", "Security", "Operations"],
  },
  {
    id: "starter-control-plane-pack",
    kind: "starter-template",
    title: "AI Control Plane Starter",
    department: "Cross-Functional",
    process: "Enterprise AI operating layer",
    patternType: "Governance Pack",
    description: "Creates the first enterprise AI registry with owners, systems, runtime sources, risk posture, controls, evidence links, and value status.",
    readiness: 78,
    installConfidence: 88,
    evidence: "Template includes registry schema, ownership workflow, control tags, lifecycle states, and executive-ready metrics.",
    controls: ["NIST.GOVERN", "ISO42001.AI_SYSTEM_INVENTORY", "EUAI.RISK_MANAGEMENT", "OWASP.MCP02"],
    promptStarter:
      "You are maintaining the enterprise AI inventory. Record only verified assets, assign accountable owners, mark unknowns explicitly, and link every risk or value claim to evidence.",
    recommendedFor: ["IT", "Security", "Compliance", "Operations"],
  },
  {
    id: "starter-connector-policy",
    kind: "starter-template",
    title: "Connector Trust and Scope Policy",
    department: "Security",
    process: "MCP and enterprise app access",
    patternType: "Governance Pack",
    description: "Scores connector trust, reviews OAuth scopes, simulates tool policy, gates risky actions, and keeps a revocation path for every AI tool.",
    readiness: 73,
    installConfidence: 82,
    evidence: "Template includes scope diffing, action risk tiers, approval gates, emergency disablement, and audit logging.",
    controls: ["NIST.MANAGE", "ISO42001.ACCESS_CONTROL", "OWASP.MCP01", "OWASP.MCP05"],
    promptStarter:
      "You are a connector policy reviewer. Compare requested scopes to approved purpose, require approval for irreversible actions, and block tools when owner, scope, or audit evidence is missing.",
    recommendedFor: ["Security", "IT", "Compliance"],
  },
  {
    id: "starter-reporting-cadence",
    kind: "starter-template",
    title: "Automated AI Reporting Cadence",
    department: "Cross-Functional",
    process: "Executive and operator reporting",
    patternType: "Adoption Playbook",
    description: "Sets up daily operator digests, weekly executive briefs, governance exception reports, ROI flashes, pilot readouts, and board summaries from live evidence.",
    readiness: 75,
    installConfidence: 86,
    evidence: "Template includes stakeholder audiences, report templates, source evidence requirements, cadence rules, and distribution checks.",
    controls: ["NIST.MEASURE", "ISO42001.PERFORMANCE_EVALUATION", "EUAI.RECORD_KEEPING", "OWASP.LLM09"],
    promptStarter:
      "You are preparing enterprise AI reports. Cite current workspace evidence, separate facts from assumptions, name missing proof, and write for the intended stakeholder without hype.",
    recommendedFor: ["Operations", "Finance", "Compliance", "Other"],
  },
  {
    id: "starter-adoption-rollout",
    kind: "starter-template",
    title: "Role-Based AI Adoption Rollout",
    department: "HR",
    process: "AI rollout enablement",
    patternType: "Adoption Playbook",
    description: "Turns approved pilots into persona-based training, champion networks, office hours, feedback loops, adoption telemetry, and value reinforcement.",
    readiness: 71,
    installConfidence: 80,
    evidence: "Template includes cohort plans, training milestones, feedback collection, adoption health metrics, and manager-ready talking points.",
    controls: ["NIST.GOVERN", "ISO42001.COMPETENCE", "EUAI.LITERACY", "OWASP.LLM09"],
    promptStarter:
      "You are an AI adoption lead. Tailor rollout guidance by role, reinforce approved use only, capture feedback themes, and connect training to measured workflow value.",
    recommendedFor: ["HR", "Operations", "IT", "Other"],
  },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function relatedCount<T extends { skillId?: string }>(items: T[], skillId: string) {
  return items.filter((item) => item.skillId === skillId).length;
}

function patternTypeForSkill(skill: Skill): PatternMarketplaceItem["patternType"] {
  if (skill.allowedTools.length > 1 || skill.autonomyTier.includes("tier_3") || skill.autonomyTier.includes("tier_4")) {
    return "Agentic Workflow";
  }
  if (/contract|document|rfp|summary|brief/i.test(skill.name)) return "Document Intelligence";
  return "Knowledge Skill";
}

function workspacePatternFromSkill(params: {
  skill: Skill;
  useCase?: UseCase;
  runs: Run[];
  evalResults: EvalResult[];
  reviews: GovernanceReview[];
}): PatternMarketplaceItem {
  const { skill, useCase, runs, evalResults, reviews } = params;
  const runCount = runs.filter((run) => run.skillId === skill.id).length;
  const evalCount = relatedCount(evalResults, skill.id);
  const approvedReviews = reviews.filter((review) => review.itemId === skill.id && ["approved", "approved_with_conditions"].includes(review.status)).length;
  const readiness = clamp(
    28 +
      Math.min(20, runCount * 5) +
      Math.min(20, evalCount * 10) +
      (skill.evalPassRate >= 90 ? 14 : skill.evalPassRate > 0 ? 7 : 0) +
      (approvedReviews ? 10 : 0) +
      (skill.valueDelivered > 0 ? 8 : 0),
  );

  return {
    id: `workspace-${skill.id}`,
    kind: "workspace-pattern",
    title: skill.name,
    department: skill.department,
    process: useCase?.currentProcess || useCase?.title || skill.name,
    patternType: patternTypeForSkill(skill),
    description: skill.description,
    sourceSkillId: skill.id,
    sourceUseCaseId: useCase?.id,
    readiness,
    installConfidence: clamp((skill.evalPassRate || 70) * 0.6 + readiness * 0.4),
    evidence: `${runCount} run${runCount === 1 ? "" : "s"} · ${evalCount} eval artifact${evalCount === 1 ? "" : "s"} · ${approvedReviews} approved review${approvedReviews === 1 ? "" : "s"}`,
    controls: ["NIST.AI_RMF.MEASURE", "ISO42001.AI_LIFECYCLE", "EUAI.HUMAN_OVERSIGHT", "OWASP.LLM/MCP"],
    promptStarter: skill.systemPrompt,
    recommendedFor: [String(skill.department), "Cross-functional adaptation"],
  };
}

export function buildPatternInstallPlan(pattern: PatternMarketplaceItem): PatternInstallPlan {
  const workspaceReuse = pattern.kind === "workspace-pattern";
  const launchMode = workspaceReuse ? "reuse" : "starter";
  const baseSteps = [
    {
      id: "scope",
      label: "Confirm fit and owner",
      detail: `Map ${pattern.title} to the receiving function, name the process owner, and confirm the operating boundary.`,
      evidence: "use_case.brief + owner assignment",
    },
    {
      id: "adapt",
      label: "Adapt Skill contract",
      detail: "Update the prompt contract, autonomy tier, success metrics, and escalation language for the receiving team.",
      evidence: "SkillSpec version record",
    },
    {
      id: "controls",
      label: "Attach controls",
      detail: `Bind required controls: ${pattern.controls.slice(0, 4).join(", ")}.`,
      evidence: "control map + policy decision record",
    },
    {
      id: "context-tools",
      label: "Connect context and tools",
      detail: "Attach approved sources and MCP connector policies with least-privilege scopes and approval gates.",
      evidence: "context permission test + broker policy",
    },
    {
      id: "eval-review",
      label: "Run evals and review",
      detail: "Run launch-readiness evals, resolve failures, and package the evidence for governance review.",
      evidence: "eval artifact + governance review",
    },
    {
      id: "pilot",
      label: "Launch measured pilot",
      detail: "Start with a bounded pilot group, monitor traces, measure value, collect feedback, and decide whether to scale.",
      evidence: "Harness traces + ROI baseline",
    },
  ];

  return {
    patternId: pattern.id,
    title: `${workspaceReuse ? "Reuse" : "Install"} ${pattern.title}`,
    estimatedDays: workspaceReuse ? 7 : 14,
    launchMode,
    steps: baseSteps,
    exitCriteria: [
      "Prompt contract reviewed and versioned",
      "Context sources approved by data owner",
      "Tool policy passes Broker simulation",
      "Eval suite passes threshold with no critical failures",
      "Governance review approved or approved with conditions",
      "Pilot value metric and rollback owner are documented",
    ],
  };
}

export function derivePatternMarketplace(input: PatternMarketplaceInput): PatternMarketplace {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const evalResults = input.evalResults ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const workspacePatterns = skills
    .filter((skill) => ["approved", "pilot", "production"].includes(skill.status) || skill.evalPassRate >= 90 || skill.runs > 0)
    .map((skill) =>
      workspacePatternFromSkill({
        skill,
        useCase: useCases.find((useCase) => useCase.id === skill.useCaseId),
        runs,
        evalResults,
        reviews: governanceReviews,
      }),
    )
    .sort((a, b) => b.readiness - a.readiness)
    .slice(0, 8);

  const recommended = [...workspacePatterns, ...starterPatternTemplates]
    .sort((a, b) => b.installConfidence + b.readiness - (a.installConfidence + a.readiness))
    .slice(0, 6);
  const score = clamp(
    (workspacePatterns.length ? 35 : 0) +
      Math.min(30, workspacePatterns.length * 10) +
      (workspacePatterns.some((pattern) => pattern.readiness >= 80) ? 20 : 0) +
      (workspacePatterns.some((pattern) => pattern.sourceUseCaseId) ? 15 : 0),
  );

  return {
    score,
    workspacePatterns,
    starterTemplates: starterPatternTemplates,
    recommended,
    summary: workspacePatterns.length
      ? `${workspacePatterns.length} workspace pattern${workspacePatterns.length === 1 ? "" : "s"} can be reused or adapted; top pattern is ${workspacePatterns[0].title}.`
      : "No proven workspace patterns yet. Starter templates can bootstrap the first governed Skill package without pretending any customer data exists.",
  };
}
