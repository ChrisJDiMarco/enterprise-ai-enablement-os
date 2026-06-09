import type { View } from "@/lib/ui/types";

export type OpenClawTone = "green" | "blue" | "amber" | "red" | "purple" | "slate";

export type OpenClawGateway = {
  id: string;
  name: string;
  url: string;
  version: string;
  channelCount: number;
  status: "connected" | "partial" | "needs_review";
  authMode: "service-token" | "oidc-proxy";
  sandboxMode: "read-only" | "approval-gated" | "restricted";
  lastSeen: string;
  evidenceEvents: number;
};

export type OpenClawAgent = {
  id: string;
  name: string;
  owner: string;
  purpose: string;
  channels: string[];
  tools: string[];
  risk: "low" | "medium" | "high" | "restricted";
  autonomy: string;
  activeSessions: number;
  lastRun: string;
  proof: string;
};

export type OpenClawSkillAsset = {
  id: string;
  name: string;
  source: "ClawHub" | "Workspace" | "Personal" | "Project";
  owner: string;
  allowedAgents: string[];
  status: "approved" | "in_review" | "blocked";
  tests: number;
  passRate: number;
  risks: string[];
  control: string;
};

export type OpenClawSession = {
  id: string;
  agent: string;
  objective: string;
  channel: string;
  status: "running" | "waiting" | "complete" | "blocked";
  age: string;
  lastSignal: string;
  toolsUsed: string[];
  proofId: string;
};

export type OpenClawRiskControl = {
  id: string;
  label: string;
  status: "pass" | "warn" | "block";
  owner: string;
  why: string;
  action: string;
};

export type OpenClawLaunchStep = {
  id: string;
  label: string;
  status: "done" | "next" | "open" | "blocked";
  owner: string;
  evidence: string;
  targetView: View;
};

export type OpenClawUpdateCheck = {
  label: string;
  status: "pass" | "warn" | "block";
  detail: string;
};

export type OpenClawValueMetric = {
  label: string;
  value: string;
  helper: string;
  tone: OpenClawTone;
};

export type OpenClawProofEvent = {
  id: string;
  label: string;
  type: "run" | "approval" | "policy" | "eval" | "update";
  actor: string;
  summary: string;
  evidence: string;
  createdAt: string;
  risk: "low" | "medium" | "high" | "restricted";
};

export const openClawIntegration = {
  gateway: {
    id: "oc-gateway-prod",
    name: "OpenClaw Gateway",
    url: "https://openclaw-gateway.internal",
    version: "2026.6.1",
    channelCount: 8,
    status: "partial",
    authMode: "service-token",
    sandboxMode: "approval-gated",
    lastSeen: "7 min ago",
    evidenceEvents: 1842,
  } satisfies OpenClawGateway,
  setupWizard: [
    {
      label: "Connect gateway",
      body: "Register the OpenClaw gateway URL, deployment channel, and workspace allowlist.",
      status: "done" as const,
      targetView: "connectors" as View,
    },
    {
      label: "Map identity",
      body: "Bind Claw sessions to SSO users, reviewers, service accounts, and department owners.",
      status: "next" as const,
      targetView: "admin" as View,
    },
    {
      label: "Import agents",
      body: "Pull channels, tools, skills, active sessions, and proof IDs into AI Inventory.",
      status: "open" as const,
      targetView: "estate" as View,
    },
    {
      label: "Compile policy",
      body: "Generate sandbox, tool approval, DM-pairing, and evidence export controls for OpenClaw.",
      status: "open" as const,
      targetView: "broker" as View,
    },
    {
      label: "Launch with proof",
      body: "Run evals, approve risk, capture traces, and attach the packet to Launch Plan.",
      status: "open" as const,
      targetView: "launch" as View,
    },
  ],
  agents: [
    {
      id: "oc-agent-exec-brief",
      name: "Executive Briefing Claw",
      owner: "AI Enablement",
      purpose: "Creates morning operating briefs from approved work systems and evidence packets.",
      channels: ["Slack", "Teams"],
      tools: ["SharePoint", "Reports", "Jira"],
      risk: "medium",
      autonomy: "Drafts only",
      activeSessions: 2,
      lastRun: "12 min ago",
      proof: "proof-oc-1842",
    },
    {
      id: "oc-agent-support-triage",
      name: "Support Triage Claw",
      owner: "Customer Operations",
      purpose: "Classifies escalations, drafts owner handoffs, and opens approval-gated ServiceNow actions.",
      channels: ["Slack", "ServiceNow"],
      tools: ["ServiceNow", "Knowledge Base", "Browser"],
      risk: "high",
      autonomy: "Approval-gated write",
      activeSessions: 4,
      lastRun: "5 min ago",
      proof: "proof-oc-1839",
    },
    {
      id: "oc-agent-code-review",
      name: "Code Review Claw",
      owner: "Engineering Platform",
      purpose: "Summarizes pull requests, flags policy-sensitive changes, and drafts safe fix plans.",
      channels: ["GitHub", "Linear"],
      tools: ["GitHub", "Browser", "CI Logs"],
      risk: "restricted",
      autonomy: "No direct merge",
      activeSessions: 1,
      lastRun: "28 min ago",
      proof: "proof-oc-1834",
    },
    {
      id: "oc-agent-research",
      name: "Research Scout Claw",
      owner: "Strategy",
      purpose: "Collects public-market signals, summarizes sources, and routes citations into workspaces.",
      channels: ["Browser", "Drive"],
      tools: ["Browser", "Drive", "Email"],
      risk: "medium",
      autonomy: "Human-reviewed output",
      activeSessions: 3,
      lastRun: "18 min ago",
      proof: "proof-oc-1836",
    },
  ] satisfies OpenClawAgent[],
  skills: [
    {
      id: "oc-skill-escalation-triage",
      name: "Customer escalation triage",
      source: "ClawHub",
      owner: "Customer Operations",
      allowedAgents: ["Support Triage Claw"],
      status: "approved",
      tests: 42,
      passRate: 96,
      risks: ["PII", "external customer impact"],
      control: "ServiceNow writes require approval and citation-backed summary.",
    },
    {
      id: "oc-skill-morning-brief",
      name: "Morning operating brief",
      source: "Workspace",
      owner: "AI Enablement",
      allowedAgents: ["Executive Briefing Claw", "Research Scout Claw"],
      status: "approved",
      tests: 31,
      passRate: 94,
      risks: ["stale source", "executive misstatement"],
      control: "Uses approved sources only and exports source list to Evidence Ledger.",
    },
    {
      id: "oc-skill-issue-fix-draft",
      name: "GitHub issue-to-fix draft",
      source: "Project",
      owner: "Engineering Platform",
      allowedAgents: ["Code Review Claw"],
      status: "in_review",
      tests: 19,
      passRate: 88,
      risks: ["repo access", "unsafe code suggestion"],
      control: "No write action until CI, owner review, and repository scope pass.",
    },
    {
      id: "oc-skill-contract-scan",
      name: "Contract clause scan",
      source: "Personal",
      owner: "Legal",
      allowedAgents: ["Research Scout Claw"],
      status: "blocked",
      tests: 12,
      passRate: 67,
      risks: ["legal advice", "confidential terms"],
      control: "Blocked until Legal approves prompt scope and retention policy.",
    },
    {
      id: "oc-skill-upgrade-smoke",
      name: "OpenClaw upgrade smoke runner",
      source: "Workspace",
      owner: "Platform",
      allowedAgents: ["Code Review Claw"],
      status: "approved",
      tests: 54,
      passRate: 98,
      risks: ["runtime regression"],
      control: "Runs against staging gateway before production channel is advanced.",
    },
  ] satisfies OpenClawSkillAsset[],
  sessions: [
    {
      id: "oc-run-8421",
      agent: "Support Triage Claw",
      objective: "Classify Sev-2 billing escalation and draft ServiceNow handoff",
      channel: "Slack #support-priority",
      status: "waiting",
      age: "9 min",
      lastSignal: "Paused for write approval",
      toolsUsed: ["Knowledge Base", "ServiceNow"],
      proofId: "proof-oc-1842",
    },
    {
      id: "oc-run-8417",
      agent: "Executive Briefing Claw",
      objective: "Build Monday operating brief from launch, risk, and revenue signals",
      channel: "Teams Exec Ops",
      status: "complete",
      age: "34 min",
      lastSignal: "Brief posted with citations",
      toolsUsed: ["SharePoint", "Reports"],
      proofId: "proof-oc-1838",
    },
    {
      id: "oc-run-8412",
      agent: "Code Review Claw",
      objective: "Review connector policy diff before production rollout",
      channel: "GitHub PR 128",
      status: "running",
      age: "41 min",
      lastSignal: "Scanning CI and policy files",
      toolsUsed: ["GitHub", "CI Logs"],
      proofId: "proof-oc-1834",
    },
    {
      id: "oc-run-8409",
      agent: "Research Scout Claw",
      objective: "Collect buyer-risk language for AI agent governance briefing",
      channel: "Browser",
      status: "blocked",
      age: "56 min",
      lastSignal: "Blocked by untrusted source policy",
      toolsUsed: ["Browser", "Drive"],
      proofId: "proof-oc-1831",
    },
  ] satisfies OpenClawSession[],
  riskControls: [
    {
      id: "gateway-exposure",
      label: "Gateway exposure",
      status: "warn",
      owner: "Platform",
      why: "Gateway is reachable through the integration tier but production should move to OIDC proxy and internal-only exposure.",
      action: "Restrict ingress, bind OIDC proxy, and log denied origins.",
    },
    {
      id: "skill-provenance",
      label: "Skill provenance",
      status: "warn",
      owner: "Security",
      why: "Personal and project skills exist beside ClawHub assets; enterprise rollout needs provenance and review gates.",
      action: "Allowlist approved Skill IDs and block personal Skills from production channels.",
    },
    {
      id: "credential-scope",
      label: "Credential scope",
      status: "warn",
      owner: "Security",
      why: "Service-token mode works for pilots but hides per-user entitlements in some channels.",
      action: "Move production actions to user-scoped OIDC claims with break-glass logging.",
    },
    {
      id: "dm-pairing",
      label: "Public DM pairing",
      status: "pass",
      owner: "Collaboration",
      why: "Direct-message pairing is disabled for customer channels unless a workspace admin approves the pair.",
      action: "Keep pairings visible in audit evidence.",
    },
    {
      id: "sandbox-enforcement",
      label: "Sandbox enforcement",
      status: "pass",
      owner: "AI Platform",
      why: "OpenClaw tool writes are approval-gated and can be replayed in read-only mode for review.",
      action: "Keep the approval queue and rollback owner attached to every production action.",
    },
    {
      id: "update-gate",
      label: "Update gate",
      status: "warn",
      owner: "Platform",
      why: "A newer beta channel exists, but production smoke tests are not complete.",
      action: "Run upgrade smoke runner, capture evidence, then promote the channel.",
    },
  ] satisfies OpenClawRiskControl[],
  launchSteps: [
    {
      id: "connect-gateway",
      label: "Connect OpenClaw gateway",
      status: "done",
      owner: "Platform",
      evidence: "Gateway handshake and channel list imported.",
      targetView: "connectors" as View,
    },
    {
      id: "import-skills",
      label: "Import agents and Skills",
      status: "done",
      owner: "AI Enablement",
      evidence: "4 agents and 5 Skill assets mapped to inventory.",
      targetView: "skills" as View,
    },
    {
      id: "compile-policy",
      label: "Compile production policy",
      status: "next",
      owner: "Security",
      evidence: "Sandbox and approval policy draft ready.",
      targetView: "broker" as View,
    },
    {
      id: "run-evals",
      label: "Run OpenClaw eval suite",
      status: "open",
      owner: "AI Platform",
      evidence: "Smoke runner ready; production promotion paused.",
      targetView: "evals" as View,
    },
    {
      id: "approve-risk",
      label: "Approve OpenClaw risk review",
      status: "open",
      owner: "Governance",
      evidence: "Risk controls need final reviewer sign-off.",
      targetView: "governance" as View,
    },
    {
      id: "attach-proof",
      label: "Attach proof packet",
      status: "open",
      owner: "AI Enablement",
      evidence: "Proof events ready for launch packet.",
      targetView: "evidence" as View,
    },
    {
      id: "baseline-value",
      label: "Baseline value dashboard",
      status: "open",
      owner: "Finance",
      evidence: "Adoption and time-saved metrics staged for ROI review.",
      targetView: "roi" as View,
    },
  ] satisfies OpenClawLaunchStep[],
  updateChecks: [
    {
      label: "Current stable",
      status: "pass",
      detail: "Production gateway is pinned to OpenClaw 2026.6.1.",
    },
    {
      label: "Beta channel",
      status: "warn",
      detail: "OpenClaw 2026.6.5 is available but should stay out of production until smoke evidence passes.",
    },
    {
      label: "Runtime floor",
      status: "pass",
      detail: "Node 22.19 runtime floor is compatible with the current gateway harness.",
    },
    {
      label: "Smoke workflows",
      status: "warn",
      detail: "Support triage and code-review smoke tests must pass before upgrade promotion.",
    },
    {
      label: "Rollback snapshot",
      status: "pass",
      detail: "Last production gateway policy snapshot is available for rollback.",
    },
  ] satisfies OpenClawUpdateCheck[],
  valueMetrics: [
    {
      label: "Active workflows",
      value: "6",
      helper: "OpenClaw-backed work patterns in pilot or production",
      tone: "blue",
    },
    {
      label: "Time reclaimed",
      value: "126 hrs/mo",
      helper: "Estimated from triage, review, and brief workflows",
      tone: "green",
    },
    {
      label: "Evidence events",
      value: "1,842",
      helper: "Gateway, approval, eval, and update records",
      tone: "purple",
    },
    {
      label: "Risk avoided",
      value: "3 blocks",
      helper: "Unsafe actions stopped before external execution",
      tone: "amber",
    },
    {
      label: "Adoption",
      value: "42 users",
      helper: "Users with at least one governed OpenClaw interaction",
      tone: "blue",
    },
    {
      label: "Finance baseline",
      value: "Under review",
      helper: "Value model needs Finance sign-off before executive claim",
      tone: "amber",
    },
  ] satisfies OpenClawValueMetric[],
  proofEvents: [
    {
      id: "proof-oc-1842",
      label: "Support triage approval pause",
      type: "approval",
      actor: "Support Triage Claw",
      summary: "ServiceNow write action paused for human approval with cited escalation context.",
      evidence: "approval_queue.service_now.write",
      createdAt: "2026-06-08 10:21",
      risk: "high",
    },
    {
      id: "proof-oc-1839",
      label: "Escalation Skill eval passed",
      type: "eval",
      actor: "AI Harness",
      summary: "Customer escalation triage passed grounding, privacy, and owner-routing checks.",
      evidence: "eval.openclaw.escalation.v4",
      createdAt: "2026-06-08 09:58",
      risk: "medium",
    },
    {
      id: "proof-oc-1834",
      label: "Connector policy diff reviewed",
      type: "policy",
      actor: "Code Review Claw",
      summary: "Gateway policy patch reviewed against approval, sandbox, and evidence export rules.",
      evidence: "broker.policy.openclaw.generated",
      createdAt: "2026-06-08 09:43",
      risk: "restricted",
    },
    {
      id: "proof-oc-1831",
      label: "Untrusted source blocked",
      type: "run",
      actor: "Research Scout Claw",
      summary: "Browser source failed trust policy and was excluded from executive research output.",
      evidence: "trace.browser.source_trust",
      createdAt: "2026-06-08 09:18",
      risk: "medium",
    },
    {
      id: "proof-oc-1828",
      label: "Stable channel pinned",
      type: "update",
      actor: "Platform",
      summary: "Production gateway held on stable 2026.6.1 until beta smoke tests pass.",
      evidence: "update_gate.openclaw.2026_6_1",
      createdAt: "2026-06-07 17:04",
      risk: "low",
    },
  ] satisfies OpenClawProofEvent[],
};

export const openClawLaunchReadiness = Math.round(
  (openClawIntegration.launchSteps.filter((step) => step.status === "done").length /
    openClawIntegration.launchSteps.length) *
    100,
);

export const openClawRiskScore = Math.round(
  (openClawIntegration.riskControls.filter((control) => control.status === "pass").length /
    openClawIntegration.riskControls.length) *
    100,
);

export const openClawPolicyPatch = `gateway:
  exposure: internal-only
  auth: oidc-proxy
  version_floor: "2026.6.1"
runtime:
  sandbox: approval-gated
  public_dm_pairing: disabled
skills:
  allowlist:
    - customer-escalation-triage
    - morning-operating-brief
    - github-issue-to-fix-draft
tools:
  service_now.write: human_approval
  github.write: human_approval
  browser.untrusted_source: block
evidence:
  export_events: true
  destination: enablement_os.proof_ledger`;

export function openClawStatusTone(status: string): OpenClawTone {
  if (["connected", "done", "pass", "approved", "complete"].includes(status)) return "green";
  if (["partial", "next", "warn", "in_review", "waiting", "running"].includes(status)) return "amber";
  if (["needs_review", "blocked", "block"].includes(status)) return "red";
  if (["open", "read-only"].includes(status)) return "blue";
  return "slate";
}
