import type React from "react";
import {
  Bot,
  Boxes,
  BrainCircuit,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileText,
  GitBranch,
  Home as HomeIcon,
  Library,
  Network,
  Radar,
  RefreshCcw,
  Rocket,
  Settings,
  ShieldCheck,
  TestTube2,
  Workflow,
} from "lucide-react";
import type { AutonomyTier } from "@/lib/enterprise-ai-data";
import { defaultOrganizationSettings } from "@/lib/workspace-schema";
import type { View } from "@/lib/ui/types";

export const CURRENT_USER_ID = "current-user";
export const CURRENT_USER_NAME = "Current user";
export const DEFAULT_TENANT_SETTINGS = defaultOrganizationSettings("default");

export const navItems: {
  id: View;
  label: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "command", label: "Home", helper: "What to do next", icon: HomeIcon },
  { id: "orchestrator", label: "AI Assistant", helper: "Ask, route, draft, execute", icon: Bot },
  { id: "estate", label: "AI Inventory", helper: "All AI work and owners", icon: Radar },
  { id: "blueprint", label: "Company Plan", helper: "Rollout model and readiness", icon: Building2 },
  { id: "strategy", label: "AI Roadmap", helper: "Priorities and sequencing", icon: GitBranch },
  { id: "process", label: "Process Redesign", helper: "Human and AI handoffs", icon: RefreshCcw },
  { id: "work", label: "Work Signals", helper: "Where AI can help", icon: Radar },
  { id: "factory", label: "Use Cases", helper: "Score and shape demand", icon: Boxes },
  { id: "harness", label: "AI Harness", helper: "Run tests and traces", icon: BrainCircuit },
  { id: "skills", label: "AI Skills", helper: "Reusable governed agents", icon: Library },
  { id: "workflow", label: "Workflow Builder", helper: "Execution steps and gates", icon: Workflow },
  { id: "connectors", label: "Connect Apps", helper: "Models, tools, data systems", icon: Network },
  { id: "broker", label: "Tool Permissions", helper: "Which tools AI may use", icon: Network },
  { id: "context", label: "Knowledge Sources", helper: "Approved retrieval context", icon: Database },
  { id: "evals", label: "Quality Evals", helper: "Reliability and safety checks", icon: TestTube2 },
  { id: "governance", label: "Risk Review", helper: "Approve or request changes", icon: ShieldCheck },
  { id: "launch", label: "Launch Plan", helper: "Production rollout checklist", icon: Rocket },
  { id: "evidence", label: "Proof Ledger", helper: "Audit-ready evidence", icon: FileCheck2 },
  { id: "roi", label: "Value & ROI", helper: "Adoption and impact", icon: CircleDollarSign },
  { id: "training", label: "Adoption Plan", helper: "Training and champions", icon: ClipboardCheck },
  { id: "reports", label: "Reports", helper: "Executive updates", icon: FileText },
  { id: "admin", label: "Settings", helper: "Workspace configuration", icon: Settings },
];

export const navHubs: {
  id: string;
  label: string;
  helper: string;
  items: View[];
}[] = [
  {
    id: "command",
    label: "Start",
    helper: "Home, assistant, inventory",
    items: ["command", "orchestrator", "estate"],
  },
  {
    id: "discover",
    label: "Find AI Work",
    helper: "Plan, signals, process, use cases",
    items: ["blueprint", "strategy", "work", "factory", "process"],
  },
  {
    id: "build",
    label: "Build Safely",
    helper: "Skills, workflows, tools, evals",
    items: ["skills", "workflow", "harness", "connectors", "broker", "context", "evals"],
  },
  {
    id: "trust",
    label: "Prove Impact",
    helper: "Risk, launch, proof, ROI, reports",
    items: ["governance", "launch", "evidence", "roi", "reports"],
  },
  {
    id: "enable",
    label: "Run the Program",
    helper: "Adoption and settings",
    items: ["training", "admin"],
  },
];

export const statusLabels: Record<string, string> = {
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

export const autonomyLabels: Record<AutonomyTier, string> = {
  tier_0_draft_only: "Tier 0 · Drafts only",
  tier_1_read_only: "Tier 1 · Reads only",
  tier_2_prepare_action: "Tier 2 · Prepares actions for approval",
  tier_3_execute_bounded_action: "Tier 3 · Executes bounded actions",
  tier_4_autonomous_workflow: "Tier 4 · Runs autonomous workflows",
  tier_5_restricted: "Tier 5 · Restricted",
};
