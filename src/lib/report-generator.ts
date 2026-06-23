import type {
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  UseCase,
  WorkSignal,
} from "./enterprise-ai-data.ts";
import { formatCurrency } from "./enterprise-ai-data.ts";
import { deriveAdoptionRate } from "./adoption-model.ts";
import type { ExecutiveBriefMetrics } from "./workspace-commands.ts";
import { sanitizeAuditText } from "./audit-sanitization.ts";

export const reportTemplateIds = [
  "daily_ai_enablement_digest",
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
    id: "daily_ai_enablement_digest",
    title: "Daily AI Enablement Digest",
    audience: "AI enablement operator, program lead, executive sponsor",
    purpose: "Start the day with current rollout movement, risk changes, proof gaps, ROI signals, and the exact decisions to push.",
    expectedSections: ["Today at a Glance", "Movement Since Last Brief", "Metrics Snapshot", "Risks and Proof Gaps", "Decisions Needed", "Recommended Moves"],
  },
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

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

const redacted = "[redacted]";
const omitted = "[omitted]";
const reportEmailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const reportSsnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
const reportPhonePattern = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const reportCreditCardLikePattern = /\b(?:\d[ -]*?){13,19}\b/g;
const reportSensitiveKeyPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|private[_-]?key|session|cookie|payload|raw|body|response|transcript|content|email|phone|ssn)/i;
const reportSensitiveStringPatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/i,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s,;]+/i,
  /https:\/\/hooks\.slack\.com\/services\/[^\s,;]+/i,
  /[?&](?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token)=([^&#\s]+)/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/i,
];

export function sanitizeReportText(value: string, maxLength = 20_000) {
  const piiSafe = sanitizeAuditText(value)
    .replace(reportEmailPattern, redacted)
    .replace(reportSsnPattern, redacted)
    .replace(reportPhonePattern, redacted)
    .replace(reportCreditCardLikePattern, redacted);
  return reportSensitiveStringPatterns
    .reduce((current, pattern) => {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      return current.replace(new RegExp(pattern.source, flags), redacted);
    }, piiSafe)
    .slice(0, maxLength);
}

function sanitizeReportValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null) return null;
  if (typeof value === "string") return sanitizeReportText(value, 1200);
  if (typeof value === "number") return Number.isFinite(value) ? value : omitted;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || typeof value === "undefined") {
    return omitted;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : omitted;
  if (Array.isArray(value)) {
    if (depth >= 4) return omitted;
    return value.slice(0, 12).map((item) => sanitizeReportValue(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (depth >= 4) return omitted;
    if (seen.has(value)) return omitted;
    seen.add(value);
    const sanitized: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 32)) {
      sanitized[key] = reportSensitiveKeyPattern.test(key) ? redacted : sanitizeReportValue(raw, depth + 1, seen);
    }
    seen.delete(value);
    return sanitized;
  }
  return omitted;
}

function sanitizeReportMarkdown(value: string) {
  return sanitizeReportText(value, 80_000).trim();
}

export function buildReportMetrics(params: {
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
}) {
  const { useCases, skills, governanceReviews } = params;
  const annualValue = skills.reduce((sum, skill) => sum + (skill.valueDelivered || 0), 0);
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
    adoptionRate: deriveAdoptionRate(skills, useCases),
    hoursSaved: Math.round(annualValue / 68),
    riskItemsOpen: openRisk,
    annualValue,
  } satisfies ExecutiveBriefMetrics;
}

function buildUnsafeDeterministicReport(params: {
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

  if (templateId === "daily_ai_enablement_digest") {
    const activePilotTitles = priorities.filter((item) => ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status));
    const proofGaps = [
      metrics.skills === 0 ? "No governed Skill has been created yet." : "",
      skills.some((skill) => skill.evalPassRate <= 0) ? "At least one Skill is missing eval evidence." : "",
      metrics.annualValue <= 0 ? "No adoption-adjusted value has been attached yet." : "",
      metrics.riskItemsOpen > 0 ? `${metrics.riskItemsOpen} risk item${metrics.riskItemsOpen === 1 ? "" : "s"} need review attention.` : "",
    ].filter(Boolean);

    return `# ${template.title}

## Today at a Glance

The workspace is tracking ${metrics.totalUseCases} use cases, ${metrics.skills} governed Skills, ${metrics.activePilots} active pilots, ${metrics.adoptionRate}% adoption, and ${formatCurrency(metrics.annualValue)} in annualized value. The highest-leverage operating move is to connect proof, value, and owner decisions before expanding usage.

## Movement Since Last Brief

${listOrNone(skillLeaders.slice(0, 3).map((skill, index) => `${index + 1}. ${skill.name} has ${skill.runs.toLocaleString()} runs, ${skill.evalPassRate}% eval pass rate, and ${formatCurrency(skill.valueDelivered || 0)} tracked value.`), "No Skill run or value movement is available yet.")}

## Metrics Snapshot

- Portfolio: ${metrics.totalUseCases} opportunities, ${metrics.activePilots} active pilots.
- Governed assets: ${metrics.skills} Skills with ${metrics.adoptionRate}% aggregate adoption.
- Value: ${formatCurrency(metrics.annualValue)} annualized, ${metrics.hoursSaved.toLocaleString()} estimated hours saved.
- Risk: ${metrics.riskItemsOpen} open risk item${metrics.riskItemsOpen === 1 ? "" : "s"}.

## Risks and Proof Gaps

${listOrNone(proofGaps.map((gap, index) => `${index + 1}. ${gap}`), "No major proof gaps are visible from the current workspace data.")}

## Decisions Needed

${listOrNone(activePilotTitles.slice(0, 3).map((item, index) => `${index + 1}. Confirm whether ${item.title} should keep moving toward pilot scale, pause for governance review, or attach stronger ROI proof.`), "Pick the first use case or work signal that should become the daily operating focus.")}

## Recommended Moves

1. Review the highest-priority command order and attach it to value.
2. Regenerate the Proof Ledger after any Skill, eval, governance, or ROI update.
3. Send the right audience packet: daily digest for operators, weekly brief for executives, governance summary for reviewers, ROI report for Finance.`;
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

export function buildDeterministicReport(params: Parameters<typeof buildUnsafeDeterministicReport>[0]) {
  return sanitizeReportMarkdown(buildUnsafeDeterministicReport(params));
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
      title: sanitizeReportText(item.title, 240),
      department: sanitizeReportText(item.department, 120),
      status: sanitizeReportText(statusLabels[item.status] ?? item.status, 120),
      riskLevel: sanitizeReportText(item.riskLevel, 80),
      priorityScore: item.priorityScore,
      valueScore: item.valueScore,
      feasibilityScore: item.feasibilityScore,
      reuseScore: item.reuseScore,
      dataReadinessScore: item.dataReadinessScore,
    })),
    skills: topSkills(skills, 8).map((skill) => ({
      name: sanitizeReportText(skill.name, 240),
      status: sanitizeReportText(statusLabels[skill.status] ?? skill.status, 120),
      department: sanitizeReportText(skill.department, 120),
      riskLevel: sanitizeReportText(skill.riskLevel, 80),
      autonomyTier: sanitizeReportText(skill.autonomyTier, 120),
      evalPassRate: skill.evalPassRate,
      runs: skill.runs,
      adoptionCount: skill.adoptionCount,
      valueDelivered: skill.valueDelivered,
    })),
    governance: governanceReviews.slice(0, 10).map((review) => ({
      title: sanitizeReportText(review.title, 240),
      status: sanitizeReportText(statusLabels[review.status] ?? review.status, 120),
      riskLevel: sanitizeReportText(review.riskLevel, 80),
      reviewer: sanitizeReportText(review.reviewer, 160),
      blockers: review.blockers.map((blocker) => sanitizeReportText(blocker, 500)),
      dueDate: sanitizeReportText(review.dueDate, 80),
    })),
    workSignals: topSignals(workSignals, 8).map((signal) => ({
      source: sanitizeReportText(signal.source, 120),
      eventType: sanitizeReportText(signal.eventType, 120),
      department: sanitizeReportText(signal.department, 120),
      process: sanitizeReportText(signal.process, 240),
      summary: sanitizeReportText(signal.summary, 700),
      riskLevel: sanitizeReportText(signal.riskLevel, 80),
      metadata: sanitizeReportValue(signal.metadata),
    })),
  };
}

export type ReportMetricSnapshot = {
  id: string;
  label: string;
  value: string;
  helper: string;
  progress: number;
  tone: "green" | "amber" | "red" | "blue" | "purple" | "slate";
};

export type AutomatedReportPlan = {
  id: string;
  title: string;
  audience: string;
  cadence: string;
  delivery: string;
  templateId: ReportTemplateId;
  readiness: number;
  status: "ready" | "needs_evidence" | "blocked";
  tone: "green" | "amber" | "red" | "blue" | "purple" | "slate";
  signal: string;
  includes: string[];
  blockers: string[];
  nextRunLabel: string;
};

export type ReportingCommandCenter = {
  generatedAt: string;
  readinessScore: number;
  headline: string;
  summary: string;
  dailyBrief: {
    title: string;
    body: string;
    bullets: string[];
    templateId: ReportTemplateId;
  };
  metricSnapshots: ReportMetricSnapshot[];
  evidenceCoverage: ReportMetricSnapshot[];
  automations: AutomatedReportPlan[];
  visuals: {
    id: string;
    title: string;
    helper: string;
    value: string;
    bars: { label: string; value: number; tone: ReportMetricSnapshot["tone"] }[];
  }[];
  stakeholderPackets: {
    role: string;
    packet: string;
    templateId: ReportTemplateId;
    why: string;
  }[];
};

export function buildReportingCommandCenter(params: {
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  workSignals: WorkSignal[];
  runs: Run[];
  evalResults: EvalResult[];
  report: string;
  metrics?: ExecutiveBriefMetrics;
  generatedAt?: string;
}) {
  const { useCases, skills, governanceReviews, workSignals, runs, evalResults, report } = params;
  const metrics = params.metrics ?? buildReportMetrics({ useCases, skills, governanceReviews });
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const runtimeCoverage = percent(completedRuns, Math.max(1, skills.length));
  const evalCoverage = percent(evalResults.filter((result) => result.passed).length, Math.max(1, skills.length));
  const avgEvalScore = average(evalResults.map((result) => result.score));
  const proofCoverage = clampPercent(
    (metrics.totalUseCases ? 14 : 0) +
      (metrics.skills ? 18 : 0) +
      Math.min(18, runtimeCoverage * 0.18) +
      Math.min(18, evalCoverage * 0.18) +
      (governanceReviews.length ? 14 : 0) +
      (metrics.annualValue ? 12 : 0) +
      (report.trim() ? 6 : 0),
  );
  const riskPressure = clampPercent(metrics.riskItemsOpen * 18 + governanceReviews.filter((review) => review.status === "changes_requested").length * 14);
  const valueProgress = clampPercent(metrics.annualValue > 0 ? Math.min(100, (metrics.annualValue / 750_000) * 100) : 0);
  const adoptionProgress = clampPercent(metrics.adoptionRate);
  const reportingReadiness = clampPercent(
    proofCoverage * 0.32 +
      valueProgress * 0.16 +
      adoptionProgress * 0.14 +
      evalCoverage * 0.14 +
      runtimeCoverage * 0.1 +
      (workSignals.length ? 8 : 0) +
      (riskPressure > 65 ? -10 : riskPressure > 35 ? -4 : 6),
  );

  const headline =
    reportingReadiness >= 80
      ? "Reporting is ready for executive distribution"
      : reportingReadiness >= 55
        ? "Reporting is usable, but proof gaps should be closed"
        : "Reporting needs more live evidence before executives rely on it";
  const summary =
    `${metrics.totalUseCases} opportunities, ${metrics.skills} Skills, ${metrics.activePilots} active pilots, ${formatCurrency(metrics.annualValue)} tracked value, ${metrics.adoptionRate}% adoption, and ${metrics.riskItemsOpen} open risk item${metrics.riskItemsOpen === 1 ? "" : "s"}.`;

  const metricSnapshots: ReportMetricSnapshot[] = [
    {
      id: "value",
      label: "Value tracked",
      value: formatCurrency(metrics.annualValue),
      helper: `${metrics.hoursSaved.toLocaleString()} estimated hours saved`,
      progress: valueProgress,
      tone: metrics.annualValue > 0 ? "green" : "amber",
    },
    {
      id: "adoption",
      label: "Adoption",
      value: `${metrics.adoptionRate}%`,
      helper: `${skills.reduce((sum, skill) => sum + skill.adoptionCount, 0).toLocaleString()} recorded users or uses`,
      progress: adoptionProgress,
      tone: metrics.adoptionRate >= 35 ? "green" : metrics.adoptionRate > 0 ? "blue" : "amber",
    },
    {
      id: "proof",
      label: "Proof coverage",
      value: `${proofCoverage}%`,
      helper: "use case, Skill, run, eval, review, ROI, and brief evidence",
      progress: proofCoverage,
      tone: proofCoverage >= 70 ? "green" : proofCoverage >= 40 ? "amber" : "red",
    },
    {
      id: "risk",
      label: "Risk pressure",
      value: String(metrics.riskItemsOpen),
      helper: "open high-risk use cases or governance blockers",
      progress: 100 - Math.min(100, riskPressure),
      tone: metrics.riskItemsOpen ? "amber" : "green",
    },
    {
      id: "runtime",
      label: "Runtime confidence",
      value: avgEvalScore ? `${avgEvalScore}%` : `${completedRuns}`,
      helper: avgEvalScore ? `${evalResults.length} eval result${evalResults.length === 1 ? "" : "s"}` : `${completedRuns} completed run${completedRuns === 1 ? "" : "s"}`,
      progress: avgEvalScore || runtimeCoverage,
      tone: avgEvalScore >= 85 || runtimeCoverage >= 70 ? "green" : avgEvalScore || runtimeCoverage ? "blue" : "amber",
    },
  ];

  const evidenceCoverage: ReportMetricSnapshot[] = [
    { id: "use-cases", label: "Use cases", value: String(useCases.length), helper: "portfolio opportunities", progress: useCases.length ? 100 : 0, tone: useCases.length ? "green" : "amber" },
    { id: "skills", label: "Skills", value: String(skills.length), helper: "governed reusable assets", progress: skills.length ? 100 : 0, tone: skills.length ? "green" : "amber" },
    { id: "runs", label: "Runs", value: String(runs.length), helper: "traceable execution records", progress: runs.length ? 100 : 0, tone: runs.length ? "green" : "amber" },
    { id: "evals", label: "Evals", value: String(evalResults.length), helper: "quality and safety checks", progress: evalResults.length ? 100 : 0, tone: evalResults.length ? "green" : "amber" },
    { id: "reviews", label: "Reviews", value: String(governanceReviews.length), helper: "risk decisions", progress: governanceReviews.length ? 100 : 0, tone: governanceReviews.length ? "green" : "amber" },
    { id: "signals", label: "Signals", value: String(workSignals.length), helper: "work demand and friction", progress: workSignals.length ? 100 : 0, tone: workSignals.length ? "green" : "amber" },
  ];

  function planStatus(readiness: number, blockers: string[]): AutomatedReportPlan["status"] {
    if (blockers.length && readiness < 55) return "blocked";
    return readiness >= 70 ? "ready" : "needs_evidence";
  }

  function planTone(status: AutomatedReportPlan["status"]): AutomatedReportPlan["tone"] {
    if (status === "ready") return "green";
    if (status === "blocked") return "red";
    return "amber";
  }

  function makePlan(input: Omit<AutomatedReportPlan, "status" | "tone">): AutomatedReportPlan {
    const status = planStatus(input.readiness, input.blockers);
    return { ...input, status, tone: planTone(status) };
  }

  const missingSkill = skills.length ? "" : "Create at least one governed Skill.";
  const missingValue = metrics.annualValue ? "" : "Attach value or ROI evidence.";
  const missingRuntime = runs.length ? "" : "Run a Skill or workflow test to create trace evidence.";
  const missingGovernance = governanceReviews.length ? "" : "Submit at least one governance review.";

  const automations: AutomatedReportPlan[] = [
    makePlan({
      id: "daily-digest",
      title: "Daily AI Enablement Digest",
      audience: "Program operator and executive sponsor",
      cadence: "Every weekday morning",
      delivery: "In-app digest, Slack or email-ready markdown",
      templateId: "daily_ai_enablement_digest",
      readiness: Math.max(25, Math.min(100, reportingReadiness + 8)),
      signal: summary,
      includes: ["overnight movement", "risk changes", "proof gaps", "recommended moves"],
      blockers: [missingSkill, missingRuntime].filter(Boolean),
      nextRunLabel: "Tomorrow 8:00 AM",
    }),
    makePlan({
      id: "weekly-exec",
      title: "Weekly Executive Brief",
      audience: "ELT, function leaders, enablement sponsor",
      cadence: "Weekly",
      delivery: "Board-style executive markdown and printable packet",
      templateId: "weekly_ai_enablement_brief",
      readiness: reportingReadiness,
      signal: `${metrics.activePilots} active pilots and ${formatCurrency(metrics.annualValue)} tracked value.`,
      includes: ["progress", "wins", "blockers", "decisions needed", "next priorities"],
      blockers: [missingValue, missingGovernance].filter(Boolean),
      nextRunLabel: "Friday 3:00 PM",
    }),
    makePlan({
      id: "governance-exceptions",
      title: "Governance Exception Report",
      audience: "Legal, Security, Privacy, Compliance",
      cadence: "Daily when risk changes",
      delivery: "Reviewer queue and compliance packet",
      templateId: "governance_summary",
      readiness: clampPercent(governanceReviews.length ? 72 + Math.min(20, governanceReviews.length * 4) - metrics.riskItemsOpen * 4 : 34),
      signal: `${governanceReviews.length} reviews, ${metrics.riskItemsOpen} open risk items.`,
      includes: ["open reviews", "risk findings", "policy exceptions", "required decisions"],
      blockers: [missingGovernance].filter(Boolean),
      nextRunLabel: metrics.riskItemsOpen ? "When risk changes" : "Monday 10:00 AM",
    }),
    makePlan({
      id: "roi-flash",
      title: "ROI and Adoption Flash",
      audience: "Finance, transformation office, business owners",
      cadence: "Twice weekly",
      delivery: "Finance-ready value snapshot",
      templateId: "roi_report",
      readiness: clampPercent(valueProgress * 0.48 + adoptionProgress * 0.28 + proofCoverage * 0.24),
      signal: `${formatCurrency(metrics.annualValue)} annualized value and ${metrics.adoptionRate}% adoption.`,
      includes: ["value drivers", "assumptions", "confidence", "finance decisions"],
      blockers: [missingValue].filter(Boolean),
      nextRunLabel: "Tuesday 9:00 AM",
    }),
    makePlan({
      id: "pilot-readout",
      title: "Pilot Readout",
      audience: "Pilot sponsor, function owner, governance reviewers",
      cadence: "At pilot milestone",
      delivery: "Scale/no-scale recommendation",
      templateId: "pilot_readout",
      readiness: clampPercent((metrics.activePilots ? 40 : 10) + proofCoverage * 0.34 + valueProgress * 0.18 + evalCoverage * 0.18),
      signal: `${metrics.activePilots} pilot${metrics.activePilots === 1 ? "" : "s"} currently active or measuring.`,
      includes: ["readiness", "observed impact", "feedback", "risk review", "scale recommendation"],
      blockers: [metrics.activePilots ? "" : "Move a use case into pilot.", missingRuntime].filter(Boolean),
      nextRunLabel: "At next pilot checkpoint",
    }),
    makePlan({
      id: "board-summary",
      title: "Board Summary",
      audience: "Board, CEO staff, executive committee",
      cadence: "Monthly or quarterly",
      delivery: "One-page strategic AI transformation summary",
      templateId: "board_summary",
      readiness: clampPercent(reportingReadiness * 0.74 + valueProgress * 0.18 + (metrics.riskItemsOpen ? 0 : 8)),
      signal: `${metrics.totalUseCases} opportunities, ${metrics.skills} Skills, ${metrics.riskItemsOpen} risk items.`,
      includes: ["strategic progress", "value", "risk posture", "enterprise readiness", "board decisions"],
      blockers: [missingValue, missingGovernance, missingRuntime].filter(Boolean),
      nextRunLabel: "Month-end close",
    }),
  ];

  return {
    generatedAt,
    readinessScore: reportingReadiness,
    headline,
    summary,
    dailyBrief: {
      title: "Today’s AI implementation brief",
      body:
        reportingReadiness >= 70
          ? "The reporting system has enough governed evidence to brief leaders with confidence."
          : "The reporting system can produce useful internal updates, but it should keep proof gaps explicit until more live evidence is attached.",
      bullets: [
        `${metrics.activePilots} pilot${metrics.activePilots === 1 ? "" : "s"} in motion across ${metrics.totalUseCases} tracked opportunities.`,
        `${formatCurrency(metrics.annualValue)} annualized value and ${metrics.adoptionRate}% adoption currently visible.`,
        metrics.riskItemsOpen ? `${metrics.riskItemsOpen} risk item${metrics.riskItemsOpen === 1 ? "" : "s"} should be resolved or explained.` : "No high-pressure risk item is currently visible.",
      ],
      templateId: "daily_ai_enablement_digest" as const,
    },
    metricSnapshots,
    evidenceCoverage,
    automations,
    visuals: [
      {
        id: "rollout-funnel",
        title: "Rollout funnel",
        helper: "Where ideas are becoming governed, measurable AI capability.",
        value: `${metrics.totalUseCases} opportunities`,
        bars: [
          { label: "Intake", value: percent(useCases.filter((item) => ["draft", "submitted", "triage", "discovery", "scored"].includes(item.status)).length, Math.max(1, useCases.length)), tone: "blue" },
          { label: "Pilot", value: percent(metrics.activePilots, Math.max(1, useCases.length)), tone: "purple" },
          { label: "Scaled", value: percent(useCases.filter((item) => item.status === "scaled").length, Math.max(1, useCases.length)), tone: "green" },
        ],
      },
      {
        id: "evidence-grid",
        title: "Evidence grid",
        helper: "How complete the proof story is for leadership and auditors.",
        value: `${proofCoverage}% proof`,
        bars: [
          { label: "Portfolio", value: useCases.length ? 100 : 0, tone: "blue" },
          { label: "Runtime", value: runtimeCoverage, tone: "purple" },
          { label: "Evals", value: evalCoverage, tone: "green" },
          { label: "Value", value: valueProgress, tone: "amber" },
        ],
      },
      {
        id: "risk-value",
        title: "Risk/value posture",
        helper: "Whether leadership can scale confidently or needs governance focus first.",
        value: metrics.riskItemsOpen ? "Review needed" : "Clean posture",
        bars: [
          { label: "Value", value: valueProgress, tone: "green" },
          { label: "Adoption", value: adoptionProgress, tone: "blue" },
          { label: "Risk control", value: 100 - Math.min(100, riskPressure), tone: metrics.riskItemsOpen ? "amber" : "green" },
        ],
      },
    ],
    stakeholderPackets: [
      { role: "Executive sponsor", packet: "Weekly Executive Brief", templateId: "weekly_ai_enablement_brief", why: "Progress, blockers, and decisions without operational noise." },
      { role: "Finance", packet: "ROI Report", templateId: "roi_report", why: "Value assumptions, confidence, adoption, and evidence gaps." },
      { role: "Governance council", packet: "Governance Summary", templateId: "governance_summary", why: "Review status, risk findings, exceptions, and approvals." },
      { role: "Pilot owner", packet: "Pilot Readout", templateId: "pilot_readout", why: "Readiness, observed impact, feedback, and scale recommendation." },
      { role: "Board or CEO staff", packet: "Board Summary", templateId: "board_summary", why: "Strategic AI transformation status and decisions." },
    ],
  } satisfies ReportingCommandCenter;
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
