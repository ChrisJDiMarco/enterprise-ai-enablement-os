import type {
  GovernanceReview,
  Skill,
  UseCase,
  WorkSignal,
} from "./enterprise-ai-data.ts";
import { formatCurrency } from "./enterprise-ai-data.ts";
import type { ExecutiveBriefMetrics } from "./workspace-commands.ts";

export const reportTemplateIds = [
  "weekly_ai_enablement_brief",
  "monthly_portfolio_review",
  "governance_summary",
  "adoption_report",
  "roi_report",
  "pilot_readout",
  "board_summary",
] as const;

export type ReportTemplateId = (typeof reportTemplateIds)[number];

export type ReportTemplate = {
  id: ReportTemplateId;
  title: string;
  audience: string;
  purpose: string;
  expectedSections: string[];
};

export const reportTemplates: ReportTemplate[] = [
  {
    id: "weekly_ai_enablement_brief",
    title: "Weekly AI Enablement Brief",
    audience: "AI enablement director, executive sponsor, function leaders",
    purpose: "Summarize portfolio progress, wins, risks, and decisions needed this week.",
    expectedSections: ["Executive Summary", "Portfolio Status", "Key Wins", "Risks and Blockers", "Decisions Needed", "Next Priorities"],
  },
  {
    id: "monthly_portfolio_review",
    title: "Monthly Portfolio Review",
    audience: "ELT, transformation office, portfolio council",
    purpose: "Review the full enterprise AI portfolio, stage movement, value, blockers, and resource needs.",
    expectedSections: ["Executive Summary", "Portfolio Movement", "Function-Level View", "Value Outlook", "Dependency Risks", "Next Month Focus"],
  },
  {
    id: "governance_summary",
    title: "Governance Summary",
    audience: "Security, Legal, Privacy, Compliance, AI governance council",
    purpose: "Show review posture, risk findings, evidence coverage, pending decisions, and policy exceptions.",
    expectedSections: ["Governance Posture", "Open Reviews", "Risk Findings", "Evidence Coverage", "Policy Exceptions", "Required Decisions"],
  },
  {
    id: "adoption_report",
    title: "Adoption Report",
    audience: "Enablement, HR, change management, function leaders",
    purpose: "Explain adoption signals, training needs, champions, resistance patterns, and usage quality.",
    expectedSections: ["Adoption Snapshot", "Usage Signals", "Champion Activity", "Training Needs", "Feedback Themes", "Next Interventions"],
  },
  {
    id: "roi_report",
    title: "ROI Report",
    audience: "Finance, CFO staff, transformation leadership",
    purpose: "Ground value claims in assumptions, confidence, adoption adjustment, and evidence requirements.",
    expectedSections: ["Value Summary", "Top Value Drivers", "Assumptions", "Confidence and Evidence", "Risks to Value", "Finance Decisions Needed"],
  },
  {
    id: "pilot_readout",
    title: "Pilot Readout",
    audience: "Pilot sponsor, function owner, governance reviewers",
    purpose: "Summarize readiness, measured pilot value, risks, user feedback, and scale recommendation.",
    expectedSections: ["Pilot Summary", "Readiness", "Observed Impact", "User Feedback", "Risk Review", "Scale Recommendation"],
  },
  {
    id: "board_summary",
    title: "Board Summary",
    audience: "Board, CEO staff, executive committee",
    purpose: "Provide concise strategic AI transformation status, risk posture, proof of value, and asks.",
    expectedSections: ["Strategic Summary", "Progress", "Value", "Risk Posture", "Enterprise Readiness", "Board Decisions"],
  },
];

export function normalizeReportTemplate(value: unknown): ReportTemplateId {
  if (typeof value !== "string") return "weekly_ai_enablement_brief";
  const direct = value.trim() as ReportTemplateId;
  if ((reportTemplateIds as readonly string[]).includes(direct)) return direct;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") as ReportTemplateId;
  return (reportTemplateIds as readonly string[]).includes(slug) ? slug : "weekly_ai_enablement_brief";
}

export function reportTemplateById(value: unknown) {
  const id = normalizeReportTemplate(value);
  return reportTemplates.find((template) => template.id === id) ?? reportTemplates[0];
}

export function reportTemplateIdFromTitle(title: string) {
  return reportTemplateById(title).id;
}

function topUseCases(useCases: UseCase[], count = 5) {
  return [...useCases].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, count);
}

function activeReviews(governanceReviews: GovernanceReview[]) {
  return governanceReviews.filter((review) =>
    ["not_submitted", "in_review", "changes_requested", "approved_with_conditions"].includes(review.status),
  );
}

function topSkills(skills: Skill[], count = 5) {
  return [...skills]
    .sort((a, b) => (b.valueDelivered || 0) - (a.valueDelivered || 0) || (b.runs || 0) - (a.runs || 0))
    .slice(0, count);
}

function topSignals(workSignals: WorkSignal[], count = 5) {
  return [...workSignals]
    .sort((a, b) => (b.metadata.volume ?? b.metadata.count ?? 1) - (a.metadata.volume ?? a.metadata.count ?? 1))
    .slice(0, count);
}

function listOrNone(items: string[], empty: string) {
  return items.length ? items.join("\n") : empty;
}

export function buildReportMetrics(params: {
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
}) {
  const { useCases, skills, governanceReviews } = params;
  const annualValue = skills.reduce((sum, skill) => sum + (skill.valueDelivered || 0), 0);
  const adoptionUsers = skills.reduce((sum, skill) => sum + (skill.adoptionCount || 0), 0);
  const activePilots = useCases.filter((item) =>
    ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status),
  ).length;
  const openRisk =
    useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).length +
    governanceReviews.filter((review) => review.blockers.length || review.status === "changes_requested").length;

  return {
    totalUseCases: useCases.length,
    activePilots,
    skills: skills.length,
    adoptionRate: skills.length ? Math.min(92, Math.round(adoptionUsers / Math.max(1, skills.length * 145) * 100)) : 0,
    hoursSaved: Math.round(annualValue / 68),
    riskItemsOpen: openRisk,
    annualValue,
  } satisfies ExecutiveBriefMetrics;
}

export function buildDeterministicReport(params: {
  templateId: ReportTemplateId;
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  workSignals: WorkSignal[];
  metrics: ExecutiveBriefMetrics;
  statusLabels: Record<string, string>;
}) {
  const { templateId, useCases, skills, governanceReviews, workSignals, metrics, statusLabels } = params;
  const template = reportTemplateById(templateId);
  const priorities = topUseCases(useCases, 5);
  const skillLeaders = topSkills(skills, 5);
  const reviews = activeReviews(governanceReviews);
  const signals = topSignals(workSignals, 5);

  if (!useCases.length && !skills.length && !governanceReviews.length && !workSignals.length) {
    return `# ${template.title}

## Executive Summary

No portfolio records have been imported or created in this workspace yet. The reporting studio is ready, but executive reporting will remain empty until real opportunities, Skills, governed work signals, governance decisions, Harness runs, and ROI evidence are added.

## Recommended Startup Actions

1. Configure tenant identity, SSO, model routing, and provider credentials.
2. Import existing AI initiatives or create the first use case through the Use Case Factory.
3. Register context sources and connector intents before launching pilots.
4. Convert approved opportunities into governed Skills with approvals, evals, and metrics.

## Decisions Needed

1. Confirm the source of truth for AI portfolio records.
2. Assign Security, Legal, Privacy, and business reviewers.
3. Decide which systems can be connected for the first pilot.`;
  }

  if (templateId === "governance_summary") {
    return `# ${template.title}

## Governance Posture

The workspace currently tracks ${governanceReviews.length} governance review records and ${metrics.riskItemsOpen} open risk items across ${metrics.totalUseCases} use cases and ${metrics.skills} governed Skills.

## Open Reviews

${listOrNone(reviews.slice(0, 5).map((review, index) => `${index + 1}. ${review.title} - ${statusLabels[review.status] ?? review.status}; blocker: ${review.blockers[0] ?? "none recorded"}.`), "No active governance reviews are currently blocking launch.")}

## Risk Findings

${listOrNone(useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).slice(0, 5).map((item, index) => `${index + 1}. ${item.title} is classified ${item.riskLevel}; autonomy and connector scope should remain bounded.`), "No high or restricted use cases are currently recorded.")}

## Evidence Coverage

- Skills with eval evidence: ${skills.filter((skill) => skill.evalPassRate > 0).length}
- Skills with runtime runs: ${skills.filter((skill) => skill.runs > 0).length}
- Governance records: ${governanceReviews.length}

## Required Decisions

1. Resolve outstanding review blockers before pilot expansion.
2. Confirm policy owner approval for external communication and write-capable tools.
3. Re-run evals after any prompt, context, model, or connector change.`;
  }

  if (templateId === "roi_report") {
    return `# ${template.title}

## Value Summary

Tracked annualized value is ${formatCurrency(metrics.annualValue)} with an estimated ${metrics.hoursSaved.toLocaleString()} hours saved. Treat this as an operating estimate until Finance validates assumptions and adoption-adjusted baselines.

## Top Value Drivers

${listOrNone(skillLeaders.map((skill, index) => `${index + 1}. ${skill.name} - ${formatCurrency(skill.valueDelivered || 0)} tracked value, ${skill.runs.toLocaleString()} runs, ${skill.evalPassRate}% eval score.`), "No Skill value records are available yet.")}

## Assumptions

- Value should be traced to monthly volume, minutes saved, adoption, and loaded labor cost.
- Each major claim needs an owner, confidence level, and expiration date.
- Production reporting should separate projected, pilot-observed, and Finance-approved value.

## Confidence and Evidence

${listOrNone(priorities.map((item, index) => `${index + 1}. ${item.title} - priority ${item.priorityScore}/100; data readiness ${item.dataReadinessScore}/5; status ${statusLabels[item.status] ?? item.status}.`), "No scored use cases are available yet.")}

## Finance Decisions Needed

1. Confirm loaded hourly cost assumptions.
2. Decide which pilots require baseline measurement before launch.
3. Approve the ROI evidence standard for executive reporting.`;
  }

  if (templateId === "adoption_report") {
    return `# ${template.title}

## Adoption Snapshot

The Skills Library contains ${metrics.skills} governed Skills with ${metrics.adoptionRate}% aggregate adoption rate from saved usage records.

## Usage Signals

${listOrNone(skillLeaders.map((skill, index) => `${index + 1}. ${skill.name} - ${skill.adoptionCount.toLocaleString()} adoption count, ${skill.runs.toLocaleString()} runs, status ${statusLabels[skill.status] ?? skill.status}.`), "No Skill usage records are available yet.")}

## Work Intelligence Themes

${listOrNone(signals.map((signal, index) => `${index + 1}. ${signal.department} - ${signal.process}: ${signal.summary}`), "No privacy-safe work signals are connected yet.")}

## Next Interventions

1. Identify champions in the departments with highest-value Skills.
2. Pair training with live workflow redesign, not generic prompt education.
3. Capture feedback in-product and through Slack or Teams after pilot usage.`;
  }

  if (templateId === "pilot_readout") {
    const pilot = priorities.find((item) => ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status)) ?? priorities[0];
    return `# ${template.title}

## Pilot Summary

${pilot ? `${pilot.title} is the current leading pilot candidate at priority ${pilot.priorityScore}/100 with ${pilot.riskLevel} risk.` : "No pilot candidate is available yet."}

## Readiness

- Active pilots: ${metrics.activePilots}
- Governed Skills: ${metrics.skills}
- Open risk items: ${metrics.riskItemsOpen}

## Observed Impact

${listOrNone(skillLeaders.slice(0, 3).map((skill, index) => `${index + 1}. ${skill.name} - ${skill.runs.toLocaleString()} runs, ${formatCurrency(skill.valueDelivered || 0)} tracked value.`), "No pilot runtime impact is available yet.")}

## Scale Recommendation

1. Confirm pilot users and success metrics.
2. Resolve governance blockers and rerun evals.
3. Expand only after adoption, quality, and evidence thresholds are met.`;
  }

  if (templateId === "board_summary") {
    return `# ${template.title}

## Strategic Summary

Enterprise AI enablement is progressing through ${metrics.totalUseCases} tracked opportunities, ${metrics.skills} governed Skills, and ${metrics.activePilots} active pilots. The current value estimate is ${formatCurrency(metrics.annualValue)} with ${metrics.riskItemsOpen} open high-priority risk items.

## Progress

${listOrNone(skillLeaders.slice(0, 3).map((skill, index) => `${index + 1}. ${skill.name} - ${statusLabels[skill.status] ?? skill.status}, ${skill.evalPassRate}% eval score.`), "No governed Skills have reached executive reporting yet.")}

## Value

- Annualized value tracked: ${formatCurrency(metrics.annualValue)}
- Estimated hours saved: ${metrics.hoursSaved.toLocaleString()}
- Adoption rate: ${metrics.adoptionRate}%

## Risk Posture

${metrics.riskItemsOpen ? `${metrics.riskItemsOpen} risk items require executive or governance attention before broader scale.` : "No high-priority risk items are currently recorded."}

## Board Decisions

1. Confirm the enterprise AI transformation operating model.
2. Approve investment in connectors, evaluation, and adoption programs.
3. Set the evidence threshold for scaling pilots globally.`;
  }

  return `# ${template.title}

## Executive Summary

The AI Enablement portfolio contains ${metrics.totalUseCases} use cases, ${metrics.activePilots} active pilots, and ${metrics.skills} governed Skills. Estimated annualized value tracked in the platform is ${formatCurrency(metrics.annualValue)}.

## Portfolio Status

- Total use cases: ${metrics.totalUseCases}
- Active pilots: ${metrics.activePilots}
- Skills in library: ${metrics.skills}
- Adoption rate: ${metrics.adoptionRate}%
- Estimated hours saved: ${metrics.hoursSaved.toLocaleString()}
- Open risk items: ${metrics.riskItemsOpen}
- Governed work signals: ${workSignals.length}

## Key Wins

${listOrNone(skillLeaders.slice(0, 3).map((skill, index) => `${index + 1}. ${skill.name} is ${statusLabels[skill.status] ?? skill.status} with ${skill.evalPassRate}% eval score and ${skill.runs.toLocaleString()} runs.`), "No governed Skills have been launched yet.")}

## Top Priorities

${listOrNone(priorities.slice(0, 3).map((item, index) => `${index + 1}. ${item.title} - priority ${item.priorityScore}/100, ${item.department}, ${statusLabels[item.status] ?? item.status}.`), "No use case priorities have been scored yet.")}

## Work Intelligence

${listOrNone(signals.slice(0, 3).map((signal, index) => `${index + 1}. ${signal.department} - ${signal.process}: ${signal.summary}`), "No governed work signals are connected yet.")}

## Risks and Blockers

${listOrNone(governanceReviews.slice(0, 3).map((review, index) => `${index + 1}. ${review.title}: ${review.blockers[0] ?? "No active blocker"} (${statusLabels[review.status] ?? review.status}).`), "No governance blockers are currently recorded.")}

## Decisions Needed

1. Confirm next portfolio intake batch.
2. Assign owners and reviewers for unowned records.
3. Review connector enablement and approval policy before pilot expansion.`;
}

export function buildReportSourcePacket(params: {
  templateId: ReportTemplateId;
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  workSignals: WorkSignal[];
  metrics: ExecutiveBriefMetrics;
  statusLabels: Record<string, string>;
}) {
  const { templateId, useCases, skills, governanceReviews, workSignals, metrics, statusLabels } = params;
  return {
    template: reportTemplateById(templateId),
    metrics,
    topUseCases: topUseCases(useCases, 8).map((item) => ({
      title: item.title,
      department: item.department,
      status: statusLabels[item.status] ?? item.status,
      riskLevel: item.riskLevel,
      priorityScore: item.priorityScore,
      valueScore: item.valueScore,
      feasibilityScore: item.feasibilityScore,
      reuseScore: item.reuseScore,
      dataReadinessScore: item.dataReadinessScore,
    })),
    skills: topSkills(skills, 8).map((skill) => ({
      name: skill.name,
      status: statusLabels[skill.status] ?? skill.status,
      department: skill.department,
      riskLevel: skill.riskLevel,
      autonomyTier: skill.autonomyTier,
      evalPassRate: skill.evalPassRate,
      runs: skill.runs,
      adoptionCount: skill.adoptionCount,
      valueDelivered: skill.valueDelivered,
    })),
    governance: governanceReviews.slice(0, 10).map((review) => ({
      title: review.title,
      status: statusLabels[review.status] ?? review.status,
      riskLevel: review.riskLevel,
      reviewer: review.reviewer,
      blockers: review.blockers,
      dueDate: review.dueDate,
    })),
    workSignals: topSignals(workSignals, 8).map((signal) => ({
      source: signal.source,
      eventType: signal.eventType,
      department: signal.department,
      process: signal.process,
      summary: signal.summary,
      riskLevel: signal.riskLevel,
      metadata: signal.metadata,
    })),
  };
}

export function buildReportSystemPrompt() {
  return [
    "You are an executive reporting assistant inside Enterprise AI Enablement OS.",
    "Write board-ready enterprise AI enablement reports using only the provided workspace source packet and deterministic baseline report.",
    "Do not invent metrics, owners, approvals, risks, vendors, launch dates, or ROI.",
    "If data is missing, say exactly what evidence is missing and what decision is needed.",
    "Keep the output in clean Markdown with H1/H2 headings, concise paragraphs, and numbered or bulleted lists.",
    "Make the narrative polished, direct, and executive-safe. No hype, no generic filler, no fake certainty.",
  ].join("\n");
}

export function buildReportUserPrompt(params: {
  sourcePacket: ReturnType<typeof buildReportSourcePacket>;
  deterministicReport: string;
}) {
  return [
    "Create the selected executive report.",
    "",
    "Selected report template:",
    JSON.stringify(params.sourcePacket.template, null, 2),
    "",
    "Workspace source packet:",
    JSON.stringify(params.sourcePacket, null, 2),
    "",
    "Deterministic baseline report to improve without changing facts:",
    params.deterministicReport,
  ].join("\n");
}
