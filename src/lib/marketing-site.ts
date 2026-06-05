export type MarketingPage = {
  href: string;
  label: string;
  description: string;
};

export type CollateralAsset = {
  id: string;
  title: string;
  format: "Markdown" | "JSON";
  description: string;
  cta: string;
};

export const marketingPages: MarketingPage[] = [
  {
    href: "/site",
    label: "Platform",
    description: "The public overview of the Enterprise AI Enablement OS.",
  },
  {
    href: "/site/implementation",
    label: "Implementation",
    description: "How a company connects its stack and launches the first governed AI capability.",
  },
  {
    href: "/site/security",
    label: "Security",
    description: "Trust, governance, SSO, RBAC, audit, and responsible AI posture.",
  },
  {
    href: "/site/collateral",
    label: "Collateral",
    description: "Buyer-ready one-pagers, security briefs, and rollout artifacts.",
  },
];

export const proofLoop = [
  "Strategy",
  "Opportunity",
  "Process redesign",
  "Skill",
  "Harness run",
  "Evidence",
  "Adoption",
  "Measured value",
  "Reusable pattern",
  "Executive report",
];

export const platformPillars = [
  {
    title: "Use Case Factory",
    body: "Turns messy business pain into scored, governable AI opportunities with value, feasibility, risk, reuse, and data readiness.",
  },
  {
    title: "AI Harness",
    body: "Wraps every Skill with identity, context, model routing, policy checks, tool gates, approvals, evals, traces, and cost controls.",
  },
  {
    title: "Evidence Ledger",
    body: "Creates board-ready proof across use cases, Skills, evals, approvals, runs, ROI assumptions, and control frameworks.",
  },
  {
    title: "AI Orchestrator",
    body: "Gives leaders and builders a command interface that explains next moves and routes them into real governed actions.",
  },
];

export const implementationSteps = [
  {
    title: "Connect identity and tenant policy",
    body: "Bring SSO, RBAC groups, department ownership, reviewer roles, and workspace branding into the operating system.",
    evidence: "Tenant profile, SSO readiness, role map",
  },
  {
    title: "Discover the first opportunity portfolio",
    body: "Import tickets, interviews, work signals, spreadsheets, or manual intake to identify where AI should be applied first.",
    evidence: "Scored use cases, value model, risk classification",
  },
  {
    title: "Attach approved systems and knowledge",
    body: "Connect SharePoint, ServiceNow, Jira, Slack or Teams, Workday, finance systems, and governed document repositories.",
    evidence: "Connector policy, context permissions, source catalog",
  },
  {
    title: "Launch a governed Skill package",
    body: "Convert a top use case into a Skill with prompt contract, context, tools, approvals, eval suite, workflow, and rollback plan.",
    evidence: "SkillSpec, Harness trace, eval result, governance review",
  },
  {
    title: "Measure adoption and value",
    body: "Track usage, cycle-time reduction, hours saved, cost avoided, quality lift, risk reduction, and adoption-adjusted ROI.",
    evidence: "ROI model, adoption dashboard, executive report",
  },
];

export const securityControls = [
  "Tenant-isolated workspaces and organization-scoped records",
  "SSO/OIDC-ready authentication and role-based access control",
  "Tenant-scoped encrypted AI provider and connector secrets",
  "Policy-first MCP broker for connector and tool execution",
  "Human approval gates for sensitive actions and external communications",
  "Evidence ledger with trace, eval, governance, audit, and ROI provenance",
  "Control mapping for NIST AI RMF, ISO/IEC 42001, EU AI Act, and OWASP LLM/MCP",
  "Production readiness gate for database, SSO, providers, connectors, workflows, audit, and operations",
];

export const collateralAssets: CollateralAsset[] = [
  {
    id: "one-pager",
    title: "Executive One-Pager",
    format: "Markdown",
    description: "A crisp buyer-facing overview of the problem, product, operating loop, and outcomes.",
    cta: "Download one-pager",
  },
  {
    id: "security-brief",
    title: "Security & Governance Brief",
    format: "Markdown",
    description: "Trust posture, responsible AI controls, approval model, evidence chain, and launch guardrails.",
    cta: "Download security brief",
  },
  {
    id: "implementation-plan",
    title: "90-Day Implementation Plan",
    format: "Markdown",
    description: "A realistic rollout path from tenant setup through first governed Skill and executive reporting.",
    cta: "Download rollout plan",
  },
  {
    id: "pilot-scorecard",
    title: "Pilot Scorecard Schema",
    format: "JSON",
    description: "A structured scorecard customers can use to judge value, risk, adoption, evidence, and scale readiness.",
    cta: "Download scorecard JSON",
  },
];

export function collateralFilename(asset: CollateralAsset) {
  const extension = asset.format === "JSON" ? "json" : "md";
  return `enablement-os-${asset.id}.${extension}`;
}

export function collateralPayload(assetId: string) {
  if (assetId === "pilot-scorecard") {
    return {
      schema: "enterprise-ai-enablement-os.pilot-scorecard.v1",
      scoring: {
        value: ["hours_saved", "cycle_time_reduction", "cost_avoidance", "quality_lift"],
        risk: ["data_sensitivity", "autonomy_tier", "external_communication", "governance_blockers"],
        adoption: ["active_users", "repeat_usage", "training_completion", "stakeholder_sentiment"],
        evidence: ["harness_traces", "eval_results", "approval_records", "roi_assumptions"],
      },
      launchCriteria: [
        "Owner assigned",
        "Use case linked",
        "SkillSpec versioned",
        "Context approved",
        "Tool policy configured",
        "Eval threshold passed",
        "Governance approved or approved with conditions",
        "Rollback owner documented",
      ],
    };
  }

  const markdown: Record<string, string> = {
    "one-pager": `# Enterprise AI Enablement OS

Enterprise AI Enablement OS is the command system for turning scattered AI ambition into governed, reusable, measurable enterprise capability.

## The Problem

Most companies do not fail at AI because they lack models. They fail because use cases are scattered, pilots are unmeasured, tools are ungoverned, and value is hard to prove.

## The Product

The platform connects strategy, opportunity discovery, process redesign, Skill industrialization, AI Harness execution, evidence, adoption, ROI, reusable patterns, and executive reporting.

## Why It Wins

- A repeatable factory for AI use cases
- A governed Harness around every AI Skill
- Board-ready evidence for every claim
- Reusable patterns that compound across functions
- A command cockpit for AI enablement leaders

## First Customer Outcome

Within 90 days, a company should have a configured workspace, connected identity, a scored opportunity portfolio, one governed Skill package, a Harness trace, eval evidence, governance review, ROI model, and executive launch packet.`,
    "security-brief": `# Security & Governance Brief

Enterprise AI Enablement OS is designed around the premise that the model is not the system. The system is the Harness around the model.

## Core Controls

- SSO/OIDC-ready authentication
- Role-based access control
- Tenant-scoped provider and connector secrets
- Policy-first MCP broker for tool execution
- Context permission filtering
- Human approval gates
- Eval and red-team requirements
- Audit trail and evidence ledger
- Launch readiness checks

## Responsible AI Posture

The platform maps operating evidence to NIST AI RMF, ISO/IEC 42001, EU AI Act oversight concepts, and OWASP LLM/MCP risks. Every governed Skill should expose owner, risk level, autonomy tier, context sources, allowed tools, approvals, evals, traces, and value evidence.`,
    "implementation-plan": `# 90-Day Implementation Plan

## Days 1-14: Foundation

Configure tenant identity, SSO, workspace branding, admin roles, reviewer roles, and production readiness gates.

## Days 15-30: Discovery

Run function discovery across HR, Finance, Legal, Procurement, IT, Marketing, and Operations. Score opportunities by value, feasibility, risk, reuse, urgency, and data readiness.

## Days 31-60: First Governed Skill

Convert the top use case into a SkillSpec with prompt contract, context sources, tool policy, approval gates, eval suite, workflow, and launch checklist.

## Days 61-75: Pilot

Launch a bounded pilot with defined users, success metrics, Harness traces, feedback capture, and governance monitoring.

## Days 76-90: Scale Decision

Generate an executive readout showing adoption, ROI, risk posture, evidence packet, blockers, and recommended reusable patterns.`,
  };

  return markdown[assetId] ?? null;
}
