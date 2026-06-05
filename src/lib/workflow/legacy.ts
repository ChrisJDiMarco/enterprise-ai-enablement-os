import type { Edge, Node } from "@xyflow/react";

export function normalizeWorkflowNodes(nodes: Node[]) {
  return nodes.map((node) => {
    const label = String(node.data.label ?? "")
      .replace("gpt-5.4", "local-enterprise-reasoner")
      .replace("New block", "Unconfigured");

    return {
      ...node,
      data: {
        ...node.data,
        label,
      },
    };
  });
}

export const legacyDemoPhrases = [
  "foundever",
  "john dimarco",
  "john.dimarco",
  "sarah miller",
  "michael ross",
  "jane doe",
  "priya shah",
  "tom wilson",
  "alex brown",
  "hr policy copilot",
  "finance close assistant",
  "legal contract intake",
  "procurement rfp",
  "vendor risk summarizer",
  "internal comms",
  "meeting-to-actions",
  "northwind group",
  "northwind.example",
  "hr policy helpdesk",
  "invoice exception triage",
  "nda & contract first-pass",
  "contract first-pass review",
  "purchase order copilot",
  "it incident auto-triage",
  "compliance change monitor",
  "operations knowledge freshness",
];

export const legacyDemoIds = new Set([
  "uc-hr-policy",
  "uc-finance-close",
  "uc-legal-contract",
  "uc-procurement-rfp",
  "uc-it-ticket",
  "uc-vendor-risk",
  "uc-internal-comms",
  "uc-meeting-actions",
  "skill-hr-policy",
  "skill-finance-close",
  "skill-legal-contract",
  "skill-procurement-rfp",
  "skill-it-ticket",
  "skill-meeting-actions",
  "run-1048",
  "run-1049",
  "tr-1",
  "tr-2",
  "audit-1",
  "audit-2",
  "audit-3",
  "gov-1",
  "gov-2",
  "gov-3",
  "eval-1",
  "eval-2",
  "eval-3",
  "u-amara",
  "u-david",
  "u-sofia",
  "u-raj",
  "u-lena",
  "u-marcus",
  "u-yuki",
  "u-priya",
  "t-workday-read",
  "t-servicenow-create",
  "t-sap-invoice-read",
  "t-coupa-po",
  "t-docusign-send",
  "t-slack-post",
  "t-confluence-read",
  "t-jira-update",
  "t-snowflake-query",
  "t-email-send",
  "cs-hr-policies",
  "cs-finance-sop",
  "cs-legal-contracts",
  "cs-procurement-catalog",
  "cs-it-runbooks",
  "cs-compliance-reg",
  "cs-product-kb",
  "uc-hr-helpdesk",
  "uc-invoice-triage",
  "uc-contract-review",
  "uc-po-assist",
  "uc-it-incident",
  "uc-compliance-monitor",
  "uc-ops-kb",
  "sk-hr-helpdesk",
  "sk-invoice-triage",
  "sk-contract-review",
  "sk-it-incident",
  "sk-ops-kb",
  "run-1001",
  "run-1002",
  "run-1003",
  "run-1004",
  "run-1005",
  "tr-3",
  "tr-4",
  "al-1",
  "al-2",
  "al-3",
  "al-4",
  "al-5",
  "al-6",
  "al-7",
  "al-8",
  "ws-hr-pto-questions",
  "ws-hr-positive-feedback",
  "ws-finance-approval-delay",
  "ws-finance-rework",
  "ws-legal-context-gap",
  "ws-legal-blocker",
  "ws-procurement-intake-variant",
  "ws-it-routing",
  "ws-it-skill-used",
  "ws-compliance-stale-source",
  "ws-ops-kb-questions",
  "ws-ops-training",
]);

export function isLegacyDemoRecord(record: unknown) {
  if (!record || typeof record !== "object") return false;
  const maybeId = "id" in record ? String((record as { id?: unknown }).id ?? "") : "";
  if (legacyDemoIds.has(maybeId)) return true;

  const serialized = JSON.stringify(record).toLowerCase();
  return legacyDemoPhrases.some((phrase) => serialized.includes(phrase));
}

export function scrubLegacyDemoRecords<T>(records: T[]) {
  return records.filter((record) => !isLegacyDemoRecord(record));
}

export function scrubLegacyWorkflowNodes(nodes: Node[]) {
  return nodes.some((node) => isLegacyDemoRecord(node)) ? [] : normalizeWorkflowNodes(nodes);
}

export function scrubLegacyWorkflowEdges(nodes: Node[], edges: Edge[]) {
  if (!nodes.length) return [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  return edges.filter((edgeItem) => nodeIds.has(edgeItem.source) && nodeIds.has(edgeItem.target));
}
