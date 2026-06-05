import type { View } from "@/lib/ui/types";

export type CurrentPageGuide = {
  stage: "Start" | "Find" | "Build" | "Prove" | "Scale" | "Setup";
  plainUse: string;
  nextLabel: string;
  nextView: View;
  watchFor: string;
};

export function initialHelpActionId(view: View) {
  if (["command", "orchestrator", "estate"].includes(view)) return "next";
  if (["blueprint", "strategy", "work", "factory", "process"].includes(view)) return "find";
  if (["skills", "workflow", "harness", "connectors", "broker", "context", "evals", "session"].includes(view)) return "build";
  if (["governance", "launch", "evidence"].includes(view)) return "trust";
  if (["roi", "training", "reports"].includes(view)) return "scale";
  return "setup";
}

export function getCurrentPageGuide(view: View): CurrentPageGuide {
  const guides: Partial<Record<View, CurrentPageGuide>> = {
    command: {
      stage: "Start",
      plainUse: "This is the operating home. Use it to see the one thing that most needs attention today.",
      nextLabel: "Ask AI Assistant",
      nextView: "orchestrator",
      watchFor: "Do not start in a table if you only need the next move.",
    },
    orchestrator: {
      stage: "Start",
      plainUse: "Use the assistant when you can describe the work in normal language and want routing, drafting, or explanation.",
      nextLabel: "Open Use Cases",
      nextView: "factory",
      watchFor: "Keep the request tied to a business workflow, not a vague chatbot demo.",
    },
    estate: {
      stage: "Start",
      plainUse: "Use inventory to see every AI asset, owner, and readiness state in one place.",
      nextLabel: "Open AI Skills",
      nextView: "skills",
      watchFor: "Unowned AI work should become a use case or be retired.",
    },
    blueprint: {
      stage: "Find",
      plainUse: "Use the company plan to align the rollout model, launch mode, and first operating lane.",
      nextLabel: "Open AI Roadmap",
      nextView: "strategy",
      watchFor: "A plan is not done until it names the next owner and proof path.",
    },
    strategy: {
      stage: "Find",
      plainUse: "Use the roadmap to decide sequence: what happens this week, next, and later.",
      nextLabel: "Open Use Cases",
      nextView: "factory",
      watchFor: "Avoid ranking ideas without connecting them to a real workflow.",
    },
    work: {
      stage: "Find",
      plainUse: "Use work signals to find repeated patterns where AI could remove friction.",
      nextLabel: "Create use case",
      nextView: "factory",
      watchFor: "A signal needs an owner before it becomes useful work.",
    },
    factory: {
      stage: "Find",
      plainUse: "Use cases turn a rough request into a scored, owned, risk-aware AI opportunity.",
      nextLabel: "Build a Skill",
      nextView: "skills",
      watchFor: "Do not build until value, risk, human review, and data sources are clear.",
    },
    process: {
      stage: "Find",
      plainUse: "Use process redesign to map current work and decide which handoffs AI should support.",
      nextLabel: "Open Workflow Builder",
      nextView: "workflow",
      watchFor: "AI should not own steps that need judgment, consent, or policy exception handling.",
    },
    skills: {
      stage: "Build",
      plainUse: "AI Skills are reusable capabilities with prompt, model, knowledge, tools, tests, and ownership.",
      nextLabel: "Run tests",
      nextView: "harness",
      watchFor: "A Skill without evals and evidence is not launch-ready.",
    },
    workflow: {
      stage: "Build",
      plainUse: "Use workflow builder to define the steps, approvals, and handoffs around a Skill.",
      nextLabel: "Run tests",
      nextView: "harness",
      watchFor: "Every action step should have an approval boundary.",
    },
    harness: {
      stage: "Build",
      plainUse: "Run tests to see what the Skill actually did, what it used, and where it waited.",
      nextLabel: "Open Quality Evals",
      nextView: "evals",
      watchFor: "A successful demo is weaker than a trace with evidence.",
    },
    connectors: {
      stage: "Build",
      plainUse: "Connect apps only after identity, model keys, broker policy, and evidence capture are understood.",
      nextLabel: "Open Tool Permissions",
      nextView: "broker",
      watchFor: "Avoid giving AI direct write access before policies and approvals exist.",
    },
    broker: {
      stage: "Build",
      plainUse: "Tool permissions decide what AI can read, prepare, or execute, and when humans must approve.",
      nextLabel: "Run tests",
      nextView: "harness",
      watchFor: "Treat write, delete, send, and external actions as controlled actions.",
    },
    context: {
      stage: "Build",
      plainUse: "Knowledge sources decide what approved context can reach the model.",
      nextLabel: "Open AI Skills",
      nextView: "skills",
      watchFor: "No source should reach a model without owner, sensitivity, and freshness checks.",
    },
    evals: {
      stage: "Build",
      plainUse: "Quality evals prove reliability, grounding, permission safety, and regression readiness.",
      nextLabel: "Open Risk Review",
      nextView: "governance",
      watchFor: "Do not launch with critical eval failures or stale suites.",
    },
    session: {
      stage: "Build",
      plainUse: "A Skill session is the chat workbench for one governed run, with trace and proof nearby.",
      nextLabel: "View tests",
      nextView: "harness",
      watchFor: "Long answers, tool actions, and sources should stay reviewable.",
    },
    governance: {
      stage: "Prove",
      plainUse: "Risk review is where owners approve, condition, reject, or request changes.",
      nextLabel: "Open Proof Ledger",
      nextView: "evidence",
      watchFor: "Approval needs evidence, not confidence language.",
    },
    launch: {
      stage: "Prove",
      plainUse: "Launch plan decides what can go to pilot or customer rollout and what must be fixed.",
      nextLabel: "Open Proof Ledger",
      nextView: "evidence",
      watchFor: "A launch blocker means hold the lane, not explain it away.",
    },
    evidence: {
      stage: "Prove",
      plainUse: "Proof Ledger holds the audit-ready evidence from runs, evals, reviews, approvals, and reports.",
      nextLabel: "Open Value & ROI",
      nextView: "roi",
      watchFor: "Evidence should answer who did what, why, with what control.",
    },
    roi: {
      stage: "Scale",
      plainUse: "Value and ROI connect adoption, saved time, risk, and business impact.",
      nextLabel: "Prepare report",
      nextView: "reports",
      watchFor: "Do not claim value without baseline and proof.",
    },
    training: {
      stage: "Scale",
      plainUse: "Adoption turns approved Skills into weekly behavior for teams, managers, builders, and reviewers.",
      nextLabel: "Prepare report",
      nextView: "reports",
      watchFor: "Awareness is not adoption until repeat use appears.",
    },
    reports: {
      stage: "Scale",
      plainUse: "Reports turn the current evidence into executive-ready updates.",
      nextLabel: "Back to Home",
      nextView: "command",
      watchFor: "A report without evidence should say what proof is missing.",
    },
    admin: {
      stage: "Setup",
      plainUse: "Settings control workspace mode, users, keys, branding, imports, exports, and launch readiness.",
      nextLabel: "Open Launch Plan",
      nextView: "launch",
      watchFor: "Production mode needs real keys, identity, storage, secrets, and readiness checks.",
    },
  };

  return guides[view] ?? {
    stage: "Start",
    plainUse: "Use this workspace to find AI work, build governed Skills, and prove business impact.",
    nextLabel: "Back to Home",
    nextView: "command",
    watchFor: "Keep every AI move tied to owner, risk, evidence, and value.",
  };
}
