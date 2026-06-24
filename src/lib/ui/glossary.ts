/**
 * Canonical plain-English definitions for the product's domain jargon. Single
 * source consumed by <GlossaryTerm> (inline first-use definitions) and
 * <GlossaryPanel> (the full reference). Keys are lower-cased for case-insensitive
 * lookup.
 */

export type GlossaryEntry = { term: string; plain: string };

export const GLOSSARY: Record<string, GlossaryEntry> = {
  skill: {
    term: "Skill",
    plain: "A reusable, governed AI agent with a fixed prompt, allowed tools, and an approval and evaluation history.",
  },
  harness: {
    term: "Harness",
    plain: "The test bench where you run a Skill against fixtures and inspect its trace before trusting it in production.",
  },
  broker: {
    term: "Connector Broker",
    plain: "The control point that decides, per request, which external tools and data an AI Skill is allowed to touch.",
  },
  "connector broker": {
    term: "Connector Broker",
    plain: "The control point that decides, per request, which external tools and data an AI Skill is allowed to touch.",
  },
  "proof packet": {
    term: "Proof packet",
    plain: "A bundled, audit-ready record of what an AI run did, what it used, and who approved it.",
  },
  "evidence packet": {
    term: "Evidence packet",
    plain: "A bundled, audit-ready record of what an AI run did, what it used, and who approved it.",
  },
  "autonomy tier": {
    term: "Autonomy tier",
    plain: "How much an AI Skill is allowed to act on its own, from draft-only (Tier 0) up to autonomous workflow (Tier 4).",
  },
  initiative: {
    term: "Initiative",
    plain: "A scoped AI use case being shaped, scored, piloted, and tracked toward production.",
  },
  blocker: {
    term: "Blocker",
    plain: "Something that must be resolved before an AI use case can move to the next stage.",
  },
  "enablement path": {
    term: "Enablement path",
    plain: "The ordered training and adoption steps a team completes to use a Skill safely.",
  },
  "enablement loop": {
    term: "Enablement loop",
    plain: "The repeating cycle of train, use, measure, and improve that grows safe adoption.",
  },
  governance: {
    term: "Governance",
    plain: "The review-and-approve process that decides whether an AI Skill is allowed to ship and on what terms.",
  },
  mcp: {
    term: "MCP",
    plain: "Model Context Protocol — the open standard for connecting AI models to external tools and data sources.",
  },
  a2a: {
    term: "A2A",
    plain: "Agent-to-Agent — the protocol that lets one AI agent call another in a governed way.",
  },
  oidc: {
    term: "OIDC",
    plain: "OpenID Connect — the single sign-on standard used to verify who a user is.",
  },
  scim: {
    term: "SCIM",
    plain: "The standard for automatically provisioning and de-provisioning user accounts from your identity provider.",
  },
  "prompt-contract score": {
    term: "Prompt-contract score",
    plain: "A 0–100 rating of how reliably a Skill obeys its required prompt structure and output rules.",
  },
};

export function glossaryLookup(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term.trim().toLowerCase()];
}
