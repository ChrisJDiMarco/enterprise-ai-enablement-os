import type { Department } from "./enterprise-ai-data.ts";
import type { IntakeForm } from "./ui/types.ts";

export function titleFromPrompt(message: string) {
  const cleaned = message
    .replace(/^(please\s+)?(create|draft|add|make|build)\s+(a\s+)?(new\s+)?(ai\s+)?(use\s+case|opportunity)(\s+for|\s+about|:)?/i, "")
    .replace(/^(i\s+want\s+to|we\s+need\s+to|help\s+with)\s+/i, "")
    .trim();
  const source = cleaned || "New AI Opportunity";
  const words = source.split(/\s+/).slice(0, 8).join(" ");
  return words
    .replace(/[^\w\s&/-]/g, "")
    .split(/\s+/)
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function inferDepartmentFromPrompt(message: string): Department {
  const text = message.toLowerCase();
  if (/\bhr\b|people|employee|pto|benefits|policy|manager/.test(text)) return "HR";
  if (/finance|close|invoice|payment|forecast|budget|variance/.test(text)) return "Finance";
  if (/legal|contract|clause|matter|counsel|nda/.test(text)) return "Legal";
  if (/procurement|vendor|rfp|supplier|sourcing/.test(text)) return "Procurement";
  if (/\bit\b|ticket|service desk|device|access|jira|incident/.test(text)) return "IT";
  if (/marketing|campaign|brand|content|comms|communication/.test(text)) return "Marketing";
  if (/security|access|identity|threat|risk/.test(text)) return "Security";
  if (/compliance|audit|governance|control|regulator/.test(text)) return "Compliance";
  if (/data|warehouse|analytics|dashboard|reporting/.test(text)) return "Data";
  return "Operations";
}

export type RemoteUseCaseDraftResult = {
  draft: Partial<IntakeForm>;
  provenance: "model" | "heuristic";
  autonomyPreview?: {
    proposedTier: string;
    appliedTier: string;
    clamped: boolean;
    clampReason?: string;
  };
};

/**
 * Client-side draft entry point. Tries the server propose/dispose route
 * (live model + policy floor) and falls back to the local heuristic draft.
 * The result always says which one produced it.
 */
export async function requestUseCaseDraft(message: string): Promise<RemoteUseCaseDraftResult> {
  try {
    const response = await fetch("/api/use-cases/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error(`Draft API returned ${response.status}`);
    const payload = await response.json();
    if (payload?.draft && typeof payload.draft === "object") {
      return {
        draft: payload.draft as Partial<IntakeForm>,
        provenance: payload.provenance === "model" ? "model" : "heuristic",
        autonomyPreview: payload.autonomyPreview,
      };
    }
    throw new Error("Draft API returned an invalid payload");
  } catch {
    return { draft: draftUseCaseFromPrompt(message), provenance: "heuristic" };
  }
}

export function draftUseCaseFromPrompt(message: string): Partial<IntakeForm> {
  const title = titleFromPrompt(message);
  const department = inferDepartmentFromPrompt(message);
  const trimmed = message.trim();

  return {
    title,
    department,
    businessProblem: trimmed || `${department} has a workflow pain point that needs structured discovery.`,
    currentProcess: "Current process to be documented with the business owner during discovery.",
    desiredOutcome: `Create a governed AI capability that improves ${title.toLowerCase()} while preserving approvals, auditability, and measurable value.`,
    aiHelp: "Structure work, retrieve approved context, draft outputs, surface risks, and prepare actions for human review.",
    aiNotDo: "Make restricted decisions, bypass policy, execute high-risk actions, or use unapproved data sources.",
    monthlyVolume: 0,
    avgHandlingTimeMinutes: 0,
    estimatedUsers: 0,
    dataSensitivity: /legal|finance|employee|customer|payment|health|restricted/i.test(message) ? "medium" : "low",
    dataSources: "",
    humanReview: /approve|approval|legal|finance|employee|customer|external|payment/i.test(message),
    externalCommunication: /external|customer|vendor|supplier|client|email/i.test(message),
  };
}
