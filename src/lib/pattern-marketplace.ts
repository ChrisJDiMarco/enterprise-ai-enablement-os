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
