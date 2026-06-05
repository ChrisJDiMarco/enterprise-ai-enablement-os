import type {
  ContextSource,
  Department,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  Tool,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { EnterpriseMaturity } from "@/lib/enterprise-maturity";
import type { IntegrationBlueprint } from "@/lib/integration-blueprint";
import type { View } from "@/lib/ui/types";
import type { OrganizationSettings } from "@/lib/workspace-schema";

export type CompanyBlueprintReadiness = "missing" | "partial" | "ready";
export type CompanyBlueprintStage = "unconfigured" | "foundation" | "pilot" | "scale" | "enterprise";
export type CompanyBlueprintFunctionStatus = "start_now" | "next" | "scale" | "monitor";

export type CompanyBlueprintStep = {
  id: string;
  title: string;
  detail: string;
  targetView: View;
  evidence: string;
  readiness: CompanyBlueprintReadiness;
};

export type CompanyBlueprintPhase = {
  id: "days-0-30" | "days-31-60" | "days-61-90";
  label: string;
  title: string;
  outcome: string;
  steps: CompanyBlueprintStep[];
};

export type CompanyBlueprintFunction = {
  department: Department;
  status: CompanyBlueprintFunctionStatus;
  score: number;
  opportunityCount: number;
  skillCount: number;
  signalCount: number;
  riskCount: number;
  recommendedPattern: string;
  nextAction: string;
  targetView: View;
};

export type CompanyBlueprintConnection = {
  id: string;
  name: string;
  purpose: string;
  readiness: CompanyBlueprintReadiness;
  score: number;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type CompanyBlueprintRole = {
  id: string;
  role: string;
  owns: string;
  readiness: CompanyBlueprintReadiness;
  evidence: string;
  nextAction: string;
  targetView: View;
};

export type CompanyBlueprintMode = {
  id: "fast-pilot" | "enterprise-rollout" | "board-demo";
  name: string;
  recommended: boolean;
  score: number;
  bestFor: string;
  operatingThesis: string;
  requiredProof: string[];
  targetView: View;
};

export type CompanyBlueprintDecision = {
  id: string;
  title: string;
  decision: string;
  whyItMatters: string;
  readiness: CompanyBlueprintReadiness;
  targetView: View;
};

export type CompanyBlueprint = {
  organizationName: string;
  stage: CompanyBlueprintStage;
  score: number;
  archetype: string;
  summary: string;
  firstMove: CompanyBlueprintStep;
  recommendedMode: CompanyBlueprintMode;
  activationModes: CompanyBlueprintMode[];
  launchDecisions: CompanyBlueprintDecision[];
  functionRollout: CompanyBlueprintFunction[];
  connections: CompanyBlueprintConnection[];
  operatingModel: CompanyBlueprintRole[];
  phases: CompanyBlueprintPhase[];
  buyerNarrative: string;
  proofPoints: { label: string; value: string; helper: string }[];
};

export type CompanyBlueprintInput = {
  organization: OrganizationSettings;
  useCases: UseCase[];
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  workSignals: WorkSignal[];
  tools: Tool[];
  contextSources: ContextSource[];
  metrics: {
    totalUseCases: number;
    activePilots: number;
    skills: number;
    adoptionRate: number;
    hoursSaved: number;
    riskItemsOpen: number;
    annualValue: number;
  };
  workflow: {
    nodeCount: number;
    status: "Saved" | "Testing" | "Published";
    valid: boolean;
  };
  enterpriseMaturity: EnterpriseMaturity;
  integrationBlueprint: IntegrationBlueprint;
};

const rolloutDepartments: Department[] = [
  "HR",
  "Finance",
  "Legal",
  "Procurement",
  "IT",
  "Marketing",
  "Operations",
  "Compliance",
];

const patternByDepartment: Record<Department, string> = {
  HR: "Policy self-service, HR case triage, manager enablement",
  Finance: "Close variance briefing, controls evidence, follow-up automation",
  Legal: "Matter intake, contract triage, playbook-grounded drafting",
  Procurement: "RFP comparison, supplier intelligence, risk summarization",
  IT: "Ticket triage, knowledge retrieval, resolution recommendation",
  Marketing: "Brief generation, content review, campaign operations",
  Operations: "Exception radar, SOP assistant, handoff automation",
  Security: "Security review copilot, evidence collection, risk routing",
  Compliance: "Control mapping, policy evidence, audit packet generation",
  Data: "Data catalog assistant, lineage review, access justification",
  Other: "Discovery sprint, process redesign, governed Skill candidate",
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readinessFromScore(score: number): CompanyBlueprintReadiness {
  if (score >= 72) return "ready";
  if (score >= 30) return "partial";
  return "missing";
}

function stageFromScore(score: number, evidenceCount: number): CompanyBlueprintStage {
  if (evidenceCount === 0) return "unconfigured";
  if (score >= 84) return "enterprise";
  if (score >= 64) return "scale";
  if (score >= 38) return "pilot";
  return "foundation";
}

function archetypeFromStage(stage: CompanyBlueprintStage) {
  switch (stage) {
    case "enterprise":
      return "Enterprise AI operating model";
    case "scale":
      return "Pilot-to-scale transformation system";
    case "pilot":
      return "Governed pilot factory";
    case "foundation":
      return "AI foundation build";
    case "unconfigured":
      return "Unconfigured enterprise workspace";
  }
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function departmentScore(params: {
  opportunityCount: number;
  skillCount: number;
  signalCount: number;
  riskCount: number;
}) {
  return clamp(
    params.opportunityCount * 18 +
      params.skillCount * 24 +
      Math.min(24, params.signalCount * 8) +
      (params.riskCount ? 8 : 0),
  );
}

function functionStatus(score: number, opportunityCount: number, skillCount: number): CompanyBlueprintFunctionStatus {
  if (skillCount > 0 && score >= 58) return "scale";
  if (opportunityCount > 0) return "start_now";
  if (score > 0) return "next";
  return "monitor";
}

function statusNextAction(status: CompanyBlueprintFunctionStatus, department: Department) {
  if (status === "scale") return `Package the best ${department} Skill as a reusable pattern and expand to a second workflow.`;
  if (status === "start_now") return `Run discovery and convert the highest-priority ${department} opportunity into a governed Skill.`;
  if (status === "next") return `Validate the ${department} signal with a function owner and capture a scored opportunity.`;
  return `Interview the ${department} leader and identify one high-volume workflow pain point.`;
}

function connection(params: Omit<CompanyBlueprintConnection, "readiness">): CompanyBlueprintConnection {
  return {
    ...params,
    score: clamp(params.score),
    readiness: readinessFromScore(params.score),
  };
}

function step(params: CompanyBlueprintStep): CompanyBlueprintStep {
  return params;
}

function decision(params: CompanyBlueprintDecision): CompanyBlueprintDecision {
  return params;
}

function mode(params: CompanyBlueprintMode): CompanyBlueprintMode {
  return {
    ...params,
    score: clamp(params.score),
  };
}

export function deriveCompanyBlueprint(input: CompanyBlueprintInput): CompanyBlueprint {
  const useCases = input.useCases ?? [];
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const governanceReviews = input.governanceReviews ?? [];
  const evalResults = input.evalResults ?? [];
  const workSignals = input.workSignals ?? [];
  const tools = input.tools ?? [];
  const contextSources = input.contextSources ?? [];

  const scoredUseCases = useCases.filter((item) => item.priorityScore > 0);
  const governedSkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const traceableRuns = runs.filter((run) => run.trace.length >= 6);
  const activeReviews = governanceReviews.filter((review) => ["in_review", "changes_requested"].includes(review.status));
  const passingEvals = evalResults.filter((result) => result.passed && result.score >= 85);
  const enabledTools = tools.filter((tool) => tool.enabled);
  const healthySources = contextSources.filter((source) => source.enabled && source.health !== "stale");
  const sensitiveSources = contextSources.filter((source) => ["confidential", "restricted", "regulated"].includes(source.classification));
  const evidenceCount =
    scoredUseCases.length +
    governedSkills.length +
    traceableRuns.length +
    governanceReviews.length +
    passingEvals.length +
    toolRequests.length +
    workSignals.length;

  const score = clamp(
    (input.organization.name && input.organization.name !== "Enterprise AI" ? 8 : 0) +
      (scoredUseCases.length ? 14 : 0) +
      (useCases.length >= 3 ? 7 : 0) +
      (healthySources.length ? 10 : 0) +
      (enabledTools.length ? 9 : 0) +
      (governedSkills.length ? 15 : 0) +
      (input.workflow.nodeCount && input.workflow.valid ? 9 : 0) +
      (traceableRuns.length ? 12 : 0) +
      (governanceReviews.length ? 8 : 0) +
      (passingEvals.length ? 5 : 0) +
      (input.metrics.annualValue > 0 || input.metrics.hoursSaved > 0 ? 3 : 0),
  );
  const stage = stageFromScore(score, evidenceCount);

  const functionRollout = rolloutDepartments.map((department) => {
    const departmentUseCases = useCases.filter((item) => item.department === department);
    const departmentSkills = skills.filter((skill) => skill.department === department || skill.department === "Cross-Functional");
    const departmentSignals = workSignals.filter((signal) => signal.department === department);
    const riskCount = departmentUseCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).length;
    const fnScore = departmentScore({
      opportunityCount: departmentUseCases.length,
      skillCount: departmentSkills.length,
      signalCount: departmentSignals.length,
      riskCount,
    });
    const status = functionStatus(fnScore, departmentUseCases.length, departmentSkills.length);
    const targetView: View = status === "scale" ? "skills" : status === "start_now" ? "factory" : "work";

    return {
      department,
      status,
      score: fnScore,
      opportunityCount: departmentUseCases.length,
      skillCount: departmentSkills.length,
      signalCount: departmentSignals.length,
      riskCount,
      recommendedPattern: patternByDepartment[department],
      nextAction: statusNextAction(status, department),
      targetView,
    };
  });

  const connections: CompanyBlueprintConnection[] = [
    connection({
      id: "identity",
      name: "Identity and access",
      purpose: "SSO, groups, roles, Skill permissions, and user-bound tool authorization.",
      score: input.integrationBlueprint.zones.find((zone) => zone.id === "identity")?.score ?? 0,
      evidence: input.integrationBlueprint.zones.find((zone) => zone.id === "identity")?.evidence ?? "No identity evidence recorded.",
      nextAction: "Connect SSO, map departments and reviewer groups, and bind every run to a real user identity.",
      targetView: "admin",
    }),
    connection({
      id: "knowledge",
      name: "Knowledge and context",
      purpose: "Approved source catalog, permission-aware retrieval, citations, and data-owner approval.",
      score: contextSources.length ? clamp((healthySources.length / Math.max(contextSources.length, 1)) * 70 + (sensitiveSources.length ? 15 : 0)) : 0,
      evidence: `${healthySources.length}/${Math.max(contextSources.length, 1)} source(s) are healthy; ${plural(sensitiveSources.length, "sensitive source")} classified.`,
      nextAction: "Connect SharePoint, Drive, Confluence, contracts, SOPs, and policy repositories with source owners.",
      targetView: "context",
    }),
    connection({
      id: "work-systems",
      name: "Systems of work",
      purpose: "Ticketing, HRIS, finance, legal, procurement, CRM, email, calendar, and workflow systems.",
      score: input.integrationBlueprint.zones.find((zone) => zone.id === "work-systems")?.score ?? 0,
      evidence: `${plural(enabledTools.length, "enabled connector")} and ${plural(toolRequests.length, "broker request")} recorded.`,
      nextAction: "Connect the first high-value system through the MCP Broker with read scopes before write scopes.",
      targetView: "broker",
    }),
    connection({
      id: "automation",
      name: "Automation runners",
      purpose: "Harness-native runs, durable workflows, enterprise automation, RPA, and human approval queues.",
      score: input.integrationBlueprint.zones.find((zone) => zone.id === "automation-runners")?.score ?? 0,
      evidence: `${plural(traceableRuns.length, "traceable Harness run")} and workflow status is ${input.workflow.status}.`,
      nextAction: "Publish one workflow blueprint with policy, approvals, retries, evals, and rollback notes.",
      targetView: "workflow",
    }),
    connection({
      id: "trust",
      name: "Governance and evidence",
      purpose: "Responsible AI reviews, risk taxonomy, evals, approval history, control mapping, and board proof.",
      score: clamp((governanceReviews.length ? 35 : 0) + (passingEvals.length ? 25 : 0) + (traceableRuns.length ? 20 : 0) + (toolRequests.length ? 20 : 0)),
      evidence: `${plural(governanceReviews.length, "review")} and ${plural(passingEvals.length, "passing eval artifact")} available.`,
      nextAction: "Create an evidence packet for the first pilot and map it to NIST AI RMF, ISO 42001, EU AI Act, and OWASP LLM/MCP controls.",
      targetView: "evidence",
    }),
    connection({
      id: "value",
      name: "Adoption and value proof",
      purpose: "Training, champions, usage, satisfaction, cycle-time improvement, ROI, and executive reporting.",
      score: clamp((input.metrics.adoptionRate ? 25 : 0) + (input.metrics.hoursSaved ? 25 : 0) + (input.metrics.annualValue ? 25 : 0) + (input.metrics.skills ? 25 : 0)),
      evidence: `${input.metrics.adoptionRate}% adoption, ${input.metrics.hoursSaved.toLocaleString()} hours saved, ${plural(input.metrics.skills, "Skill")}.`,
      nextAction: "Define baseline measurements and adoption cohorts before the pilot expands.",
      targetView: "roi",
    }),
  ];

  const operatingModel: CompanyBlueprintRole[] = [
    {
      id: "exec-sponsor",
      role: "Executive sponsor",
      owns: "Business outcomes, enterprise priorities, funding, and decision escalation.",
      readiness: input.metrics.annualValue > 0 || input.enterpriseMaturity.score >= 50 ? "partial" : "missing",
      evidence: input.metrics.annualValue ? `${plural(useCases.length, "opportunity", "opportunities")} sized with value proof.` : "No executive value proof is recorded yet.",
      nextAction: "Confirm a sponsor, decision cadence, and portfolio-level success metrics.",
      targetView: "strategy",
    },
    {
      id: "enablement-director",
      role: "AI enablement director",
      owns: "The operating loop from strategy to opportunity to Skill to adoption and value proof.",
      readiness: score >= 38 ? "ready" : "partial",
      evidence: `${archetypeFromStage(stage)} at ${score}/100.`,
      nextAction: "Use the Command Center and Orchestrator as the daily operating cockpit.",
      targetView: "command",
    },
    {
      id: "function-owners",
      role: "Function product owners",
      owns: "Department workflows, pilot scope, adoption, feedback, and process redesign decisions.",
      readiness: useCases.some((item) => item.ownerId) ? "ready" : useCases.length ? "partial" : "missing",
      evidence: `${plural(useCases.filter((item) => item.ownerId).length, "owned opportunity", "owned opportunities")} recorded.`,
      nextAction: "Assign each high-priority opportunity to a business owner and builder.",
      targetView: "factory",
    },
    {
      id: "governance-council",
      role: "Governance council",
      owns: "Privacy, security, legal, compliance, data usage, autonomy tiers, and exception decisions.",
      readiness: activeReviews.length ? "partial" : governanceReviews.length ? "ready" : "missing",
      evidence: `${plural(governanceReviews.length, "review")} with ${plural(activeReviews.length, "active blocker")} or active review.`,
      nextAction: "Define approval matrix by risk, department, data classification, and autonomy tier.",
      targetView: "governance",
    },
    {
      id: "builders",
      role: "AI builders and automation owners",
      owns: "Skill specs, workflow graphs, prompt contracts, tool policies, tests, and releases.",
      readiness: skills.length && input.workflow.nodeCount ? "ready" : skills.length || input.workflow.nodeCount ? "partial" : "missing",
      evidence: `${plural(skills.length, "Skill")} and ${plural(input.workflow.nodeCount, "workflow block")} recorded.`,
      nextAction: "Create a signed Skill package and compile the visual workflow into a launch-ready spec.",
      targetView: "workflow",
    },
    {
      id: "champions",
      role: "Champions and enablement network",
      owns: "Training, office hours, change management, prompt literacy, and feedback loops.",
      readiness: input.metrics.adoptionRate >= 20 ? "partial" : "missing",
      evidence: `${input.metrics.adoptionRate}% adoption from current records.`,
      nextAction: "Nominate champions by function and launch the first training path around the pilot workflow.",
      targetView: "training",
    },
  ];

  const firstMove =
    score < 12
      ? step({
          id: "guided-setup",
          title: "Run guided setup",
          detail: "Create the tenant identity, choose pilot scope, approve safe permissions, and generate the first operating plan.",
          targetView: "admin",
          evidence: "Workspace needs a configured operating baseline.",
          readiness: "missing",
        })
      : !scoredUseCases.length
        ? step({
            id: "capture-opportunity",
            title: "Capture the first AI opportunity",
            detail: "Use the factory to turn one messy pain point into a scored, governed business case.",
            targetView: "factory",
            evidence: `${plural(useCases.length, "opportunity", "opportunities")} recorded; ${plural(scoredUseCases.length, "scored opportunity", "scored opportunities")}.`,
            readiness: "partial",
          })
        : !governedSkills.length
          ? step({
              id: "industrialize-skill",
              title: "Convert the top opportunity into a Skill",
              detail: "Add prompt, context, tool policy, autonomy tier, evals, owner, and launch checklist.",
              targetView: "skills",
              evidence: `${plural(scoredUseCases.length, "scored opportunity", "scored opportunities")} ready for conversion.`,
              readiness: "partial",
            })
          : !traceableRuns.length
            ? step({
                id: "run-harness",
                title: "Run the Harness",
                detail: "Create a trace with identity, retrieval, model, policy, tool, approval, validation, cost, and logs.",
                targetView: "harness",
                evidence: `${plural(governedSkills.length, "governed Skill")} exists; no full runtime trace yet.`,
                readiness: "partial",
              })
            : !governanceReviews.length || !passingEvals.length
              ? step({
                  id: "package-trust",
                  title: "Package trust evidence",
                  detail: "Run evals, submit governance review, and export the evidence packet for pilot approval.",
                  targetView: "evidence",
                  evidence: `${plural(traceableRuns.length, "traceable run")} ready to attach to governance proof.`,
                  readiness: "partial",
                })
              : step({
                  id: "scale-pattern",
                  title: "Scale the reusable pattern",
                  detail: "Promote the proven Skill, workflow, controls, and measurements into a reusable department template.",
                  targetView: "reports",
                  evidence: `${plural(governanceReviews.length, "review")} and ${plural(passingEvals.length, "passing eval")} support scale.`,
                  readiness: "ready",
                });

  const activationModes: CompanyBlueprintMode[] = [
    mode({
      id: "fast-pilot",
      name: "Fast pilot",
      recommended: score < 72,
      score: clamp(45 + scoredUseCases.length * 12 + governedSkills.length * 16 + traceableRuns.length * 12 + passingEvals.length * 8),
      bestFor: "A company that wants a credible first launch in one or two functions without waiting for every enterprise connector.",
      operatingThesis: "Start with low-to-medium risk, read-first Skills, prove adoption and value, then expand write actions only behind policy and approval.",
      requiredProof: ["Scored opportunity", "Approved context source", "Governed Skill package", "Harness trace", "Pilot value baseline"],
      targetView: "factory",
    }),
    mode({
      id: "enterprise-rollout",
      name: "Enterprise rollout",
      recommended: score >= 72,
      score: clamp(20 + input.enterpriseMaturity.score * 0.4 + input.integrationBlueprint.score * 0.35 + (governanceReviews.length ? 12 : 0) + (passingEvals.length ? 10 : 0)),
      bestFor: "A company that needs SSO, real connector boundaries, governance council approval, and repeatable launch patterns across functions.",
      operatingThesis: "Create a standard operating model first, then promote Skills through dev, pilot, governance, production, and reusable pattern stages.",
      requiredProof: ["SSO and RBAC", "Connector policy", "Eval suite", "Governance approval", "Evidence packet", "Adoption dashboard"],
      targetView: "admin",
    }),
    mode({
      id: "board-demo",
      name: "Board demo",
      recommended: false,
      score: clamp(35 + (input.metrics.annualValue ? 20 : 0) + (governanceReviews.length ? 15 : 0) + (traceableRuns.length ? 15 : 0) + (input.metrics.adoptionRate ? 15 : 0)),
      bestFor: "A leadership readout where the goal is to show the transformation system, decisions needed, risk posture, and measurable value.",
      operatingThesis: "Tell the story through proof: strategy, opportunities, governed Skills, Harness traces, evidence, adoption, ROI, and next-quarter decisions.",
      requiredProof: ["Executive brief", "Trace screenshot", "Risk posture", "ROI assumptions", "Decisions needed"],
      targetView: "reports",
    }),
  ];
  const recommendedMode =
    activationModes.find((item) => item.recommended) ??
    [...activationModes].sort((a, b) => b.score - a.score)[0];

  const launchDecisions: CompanyBlueprintDecision[] = [
    decision({
      id: "pilot-scope",
      title: "Approve first pilot scope",
      decision: scoredUseCases.length
        ? "Choose the highest-priority scored opportunity and define the pilot cohort, success metrics, and launch date."
        : "Authorize discovery sessions and intake for the first three function-level opportunities.",
      whyItMatters: "Without a bounded scope, AI work becomes scattered experimentation instead of a measurable operating motion.",
      readiness: scoredUseCases.length ? "partial" : "missing",
      targetView: "factory",
    }),
    decision({
      id: "connector-boundary",
      title: "Authorize connector boundaries",
      decision: enabledTools.length
        ? "Approve read/write scopes by tool category and require human approval for higher-risk actions."
        : "Select the first systems to connect: identity, knowledge, ticketing/workflow, and one function system of record.",
      whyItMatters: "The safest AI programs define what agents may read, prepare, execute, and never touch before deployment.",
      readiness: enabledTools.length && toolRequests.length ? "ready" : enabledTools.length ? "partial" : "missing",
      targetView: "broker",
    }),
    decision({
      id: "review-council",
      title: "Name the review council",
      decision: governanceReviews.length
        ? "Confirm security, privacy, legal, compliance, and data reviewers for pilot promotion decisions."
        : "Assign accountable reviewers and escalation rules for medium, high, and restricted-risk Skills.",
      whyItMatters: "Responsible AI review has to be a predictable operating lane, not a late-stage scramble.",
      readiness: governanceReviews.length ? "partial" : "missing",
      targetView: "governance",
    }),
    decision({
      id: "value-baseline",
      title: "Lock value baselines",
      decision: input.metrics.annualValue
        ? "Review adoption-adjusted value assumptions and agree which value claims are executive-reportable."
        : "Capture monthly volume, handling time, cycle time, error rate, loaded cost, and adoption assumptions.",
      whyItMatters: "Executives will trust the OS when every value claim ties back to a baseline, confidence level, and evidence trail.",
      readiness: input.metrics.annualValue ? "partial" : "missing",
      targetView: "roi",
    }),
  ];

  const phases: CompanyBlueprintPhase[] = [
    {
      id: "days-0-30",
      label: "Days 0-30",
      title: "Establish the AI operating baseline",
      outcome: "A company can see priorities, owners, connectors, risks, and the first pilot path.",
      steps: [
        step({
          id: "tenant-identity",
          title: "Configure tenant identity and launch mode",
          detail: "Set company branding, workspace mode, SSO posture, and executive operating cadence.",
          targetView: "admin",
          evidence: input.organization.name && input.organization.name !== "Enterprise AI" ? input.organization.name : "Tenant identity not customized.",
          readiness: input.organization.name && input.organization.name !== "Enterprise AI" ? "ready" : "missing",
        }),
        step({
          id: "opportunity-portfolio",
          title: "Build the first opportunity portfolio",
          detail: "Run discovery across HR, Finance, Legal, Procurement, IT, Marketing, and Operations.",
          targetView: "factory",
          evidence: `${plural(scoredUseCases.length, "scored opportunity", "scored opportunities")} in the factory.`,
          readiness: scoredUseCases.length ? "ready" : useCases.length ? "partial" : "missing",
        }),
        step({
          id: "connect-sources",
          title: "Approve knowledge sources",
          detail: "Catalog sources, owners, classifications, indexing health, and retrieval tests.",
          targetView: "context",
          evidence: `${plural(healthySources.length, "healthy source")} available.`,
          readiness: healthySources.length ? "ready" : contextSources.length ? "partial" : "missing",
        }),
      ],
    },
    {
      id: "days-31-60",
      label: "Days 31-60",
      title: "Industrialize the first governed Skills",
      outcome: "The company moves from ideas to versioned AI assets running inside the Harness.",
      steps: [
        step({
          id: "skill-package",
          title: "Create the first governed Skill package",
          detail: "Attach owner, prompt contract, context, tool policy, model route, eval suite, and rollback notes.",
          targetView: "skills",
          evidence: `${plural(governedSkills.length, "governed Skill")} ready.`,
          readiness: governedSkills.length ? "ready" : skills.length ? "partial" : "missing",
        }),
        step({
          id: "workflow-blueprint",
          title: "Publish a workflow blueprint",
          detail: "Map trigger, retrieval, model step, decision boundary, approval gate, tool call, eval, and audit log.",
          targetView: "workflow",
          evidence: `${plural(input.workflow.nodeCount, "workflow block")} and workflow status ${input.workflow.status}.`,
          readiness: input.workflow.nodeCount && input.workflow.valid ? "ready" : input.workflow.nodeCount ? "partial" : "missing",
        }),
        step({
          id: "harness-trace",
          title: "Capture a complete Harness trace",
          detail: "Record identity, retrieval, model, policy, approval, output validation, cost, latency, and feedback.",
          targetView: "harness",
          evidence: `${plural(traceableRuns.length, "traceable run")} recorded.`,
          readiness: traceableRuns.length ? "ready" : runs.length ? "partial" : "missing",
        }),
      ],
    },
    {
      id: "days-61-90",
      label: "Days 61-90",
      title: "Prove value and scale the pattern",
      outcome: "Executives see adoption, ROI, risk posture, and a repeatable path to the next functions.",
      steps: [
        step({
          id: "governance-evidence",
          title: "Complete governance and eval evidence",
          detail: "Submit review, run red-team tests, map controls, and document conditions.",
          targetView: "governance",
          evidence: `${plural(governanceReviews.length, "review")} and ${plural(passingEvals.length, "passing eval")} recorded.`,
          readiness: governanceReviews.length && passingEvals.length ? "ready" : governanceReviews.length || passingEvals.length ? "partial" : "missing",
        }),
        step({
          id: "adoption-value",
          title: "Measure adoption-adjusted value",
          detail: "Tie usage to cohorts, hours saved, cycle time, quality, stakeholder sentiment, and risk reduction.",
          targetView: "roi",
          evidence: `${input.metrics.adoptionRate}% adoption and ${input.metrics.hoursSaved.toLocaleString()} hours saved.`,
          readiness: input.metrics.adoptionRate || input.metrics.hoursSaved ? "partial" : "missing",
        }),
        step({
          id: "executive-brief",
          title: "Generate the executive briefing packet",
          detail: "Produce the weekly brief, pilot readout, decisions needed, blockers, and scale recommendations.",
          targetView: "reports",
          evidence: input.metrics.annualValue ? `Annualized value: ${input.metrics.annualValue.toLocaleString()}.` : "No value narrative generated yet.",
          readiness: input.metrics.annualValue || input.metrics.skills ? "partial" : "missing",
        }),
      ],
    },
  ];

  return {
    organizationName: input.organization.name,
    stage,
    score,
    archetype: archetypeFromStage(stage),
    summary:
      stage === "unconfigured"
        ? "Start by configuring the company baseline, then let the OS create the first opportunity portfolio, Skill package, workflow blueprint, and launch evidence."
        : `${input.organization.name} is at the ${archetypeFromStage(stage).toLowerCase()} stage. The next unlock is to connect operating evidence, governance proof, and adoption-adjusted value into one repeatable loop.`,
    firstMove,
    recommendedMode,
    activationModes,
    launchDecisions,
    functionRollout,
    connections,
    operatingModel,
    phases,
    buyerNarrative:
      "The OS should feel useful on day one: connect identity and knowledge first, capture the highest-friction workflows, convert only approved opportunities into governed Skills, run every Skill through the Harness, then prove adoption and value before scaling.",
    proofPoints: [
      { label: "Blueprint score", value: `${score}/100`, helper: archetypeFromStage(stage) },
      { label: "Functions mapped", value: String(functionRollout.filter((item) => item.score > 0).length), helper: "from opportunities, Skills, and signals" },
      { label: "Connections ready", value: String(connections.filter((item) => item.readiness === "ready").length), helper: "identity, knowledge, tools, trust, value" },
      { label: "Evidence records", value: String(evidenceCount), helper: "runs, reviews, evals, signals, broker requests" },
    ],
  };
}

export function formatCompanyBlueprintBrief(blueprint: CompanyBlueprint) {
  const lines = [
    `# ${blueprint.organizationName} AI Enablement Blueprint`,
    "",
    `## Executive Summary`,
    "",
    `${blueprint.summary}`,
    "",
    `- Blueprint score: ${blueprint.score}/100`,
    `- Stage: ${blueprint.archetype}`,
    `- Recommended launch mode: ${blueprint.recommendedMode.name}`,
    `- First move: ${blueprint.firstMove.title}`,
    "",
    "## Recommended Launch Mode",
    "",
    `**${blueprint.recommendedMode.name}.** ${blueprint.recommendedMode.operatingThesis}`,
    "",
    "Required proof:",
    ...blueprint.recommendedMode.requiredProof.map((item) => `- ${item}`),
    "",
    "## Executive Decisions Needed",
    "",
    ...blueprint.launchDecisions.flatMap((item, index) => [
      `${index + 1}. **${item.title}**`,
      `   - Decision: ${item.decision}`,
      `   - Why it matters: ${item.whyItMatters}`,
      `   - Readiness: ${item.readiness}`,
    ]),
    "",
    "## Function Rollout",
    "",
    ...blueprint.functionRollout.map(
      (item) =>
        `- **${item.department}** (${item.score}/100, ${item.status.replace("_", " ")}): ${item.recommendedPattern}. Next: ${item.nextAction}`,
    ),
    "",
    "## Connection Plan",
    "",
    ...blueprint.connections.map(
      (item) =>
        `- **${item.name}** (${item.score}/100, ${item.readiness}): ${item.nextAction}`,
    ),
    "",
    "## 90-Day Path",
    "",
    ...blueprint.phases.flatMap((phase) => [
      `### ${phase.label}: ${phase.title}`,
      phase.outcome,
      ...phase.steps.map((item) => `- ${item.title}: ${item.detail} (${item.readiness})`),
      "",
    ]),
  ];

  return lines.join("\n");
}
