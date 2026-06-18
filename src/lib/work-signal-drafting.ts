import type { Department, RiskLevel, WorkSignal, WorkSignalEventType, WorkSignalSource } from "./enterprise-ai-data.ts";
import { inferDepartmentFromPrompt } from "./use-case-drafting.ts";

function clean(value: string, fallback: string, maxLength: number) {
  const next = value.replace(/\s+/g, " ").trim();
  return (next || fallback).slice(0, maxLength);
}

function extractNumber(message: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function inferSource(message: string): WorkSignalSource {
  const text = message.toLowerCase();
  if (/service\s*now|servicenow/.test(text)) return "service_now";
  if (/\bjira\b|atlassian/.test(text)) return "jira";
  if (/\bslack\b/.test(text)) return "slack";
  if (/\bteams\b|microsoft teams/.test(text)) return "teams";
  if (/\bemail\b|inbox|outlook|gmail/.test(text)) return "email";
  if (/sharepoint|onedrive|policy|document|knowledge base|kb/.test(text)) return "sharepoint";
  if (/workday|employee record/.test(text)) return "workday";
  if (/invoice|payment|finance|erp|netsuite|quickbooks/.test(text)) return "finance_system";
  if (/procurement|vendor|supplier|coupa|zip/.test(text)) return "procurement_system";
  if (/legal|contract|clm|docusign|ironclad/.test(text)) return "legal_system";
  if (/learning|lms|training/.test(text)) return "learning_platform";
  if (/harness|run|trace|eval/.test(text)) return "harness";
  if (/workflow|handoff|approval/.test(text)) return "workflow";
  if (/survey|interview|office hour|workshop|manual|reported|captured/.test(text)) return "survey";
  return "other";
}

function inferEventType(message: string): WorkSignalEventType {
  const text = message.toLowerCase();
  if (/approval|waiting for sign.?off|waiting for review/.test(text)) return "approval_waiting";
  if (/context|source|knowledge|can't find|cannot find|missing answer|stale/.test(text)) return "context_gap";
  if (/handoff|handover|handover|routing|queue|assignment/.test(text)) return "handoff_delayed";
  if (/rework|redo|correction|mistake|error|duplicate/.test(text)) return "rework_detected";
  if (/delay|blocked|waiting|sla|cycle time|takes|slow/.test(text)) return "workflow_delayed";
  if (/ticket|case|request|incident/.test(text)) return "ticket_created";
  if (/feedback|complaint|negative|positive/.test(text)) return "feedback_given";
  if (/training|enablement|adoption/.test(text)) return "training_completed";
  if (/governance|risk|compliance|policy blocker/.test(text)) return "governance_blocker";
  if (/variant|different process|inconsistent/.test(text)) return "process_variant";
  return "question_asked";
}

function inferRisk(message: string, department: Department): RiskLevel {
  const text = message.toLowerCase();
  if (/restricted|regulated|hipaa|payment card|secret|credential|password|security incident/.test(text)) return "restricted";
  if (/legal|contract|customer|employee|finance|payment|pii|personal data|privacy|external/.test(text)) return "medium";
  if (department === "Legal" || department === "Finance" || department === "HR" || department === "Security" || department === "Compliance") {
    return "medium";
  }
  return "low";
}

function inferProcess(message: string, department: Department) {
  const explicit =
    message.match(/(?:process|workflow|team|queue|for|about)\s*[:\-]\s*([^.;\n]+)/i)?.[1] ??
    message.match(/(?:in|for)\s+([A-Za-z][A-Za-z\s/&-]{2,48}?)(?:\s+(?:takes|has|gets|needs|with|because)|[.;\n]|$)/i)?.[1] ??
    "";
  if (explicit) return clean(explicit, `${department} work signal`, 80);

  const words = message
    .replace(/^(please\s+)?(capture|log|add|create|draft|record|report)\s+(a\s+)?(work\s+)?signal(\s+for|\s+about|:)?/i, "")
    .split(/\s+/)
    .slice(0, 7)
    .join(" ");

  return clean(words, `${department} work signal`, 80);
}

export function hasWorkSignalCaptureIntent(message: string) {
  const text = message.toLowerCase();
  return /\b(capture|log|add|create|draft|record|report)\b/.test(text) && /\b(work signal|signal|work pain|pain point|repeated request|workflow delay|process pain)\b/.test(text);
}

export function workSignalCaptureSubject(message: string) {
  return message
    .replace(/^(please\s+)?(capture|log|add|create|draft|record|report)\s+(a\s+)?(new\s+)?(work\s+)?(signal|pain point|work pain|repeated request|workflow delay)(\s+for|\s+about|:)?/i, "")
    .trim();
}

export function isThinWorkSignalPrompt(message: string) {
  const subject = workSignalCaptureSubject(message);
  const detailSignals = [
    /\b(hr|finance|legal|sales|marketing|support|operations|it|engineering|procurement|security|compliance|data|customer|employee|vendor|invoice|contract|ticket|request|incident)\b/i,
    /\b(repeated|manual|delay|waiting|handoff|rework|question|ticket|approval|context|source|process|workflow|owner|team)\b/i,
    /\b(volume|monthly|weekly|daily|hours|minutes|count|cases|requests|system|slack|jira|servicenow|sharepoint|email|workday|coupa)\b/i,
  ].filter((pattern) => pattern.test(message)).length;

  return subject.length < 34 || detailSignals < 2;
}

export function draftWorkSignalFromPrompt(message: string, now = new Date().toISOString()): WorkSignal {
  const department = inferDepartmentFromPrompt(message);
  const process = inferProcess(message, department);
  const eventType = inferEventType(message);
  const source = inferSource(message);
  const volume = extractNumber(message, [
    /([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*(?:month|mo|monthly)/i,
    /monthly\s+(?:volume|count|requests|tickets|cases)?\D*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:requests|tickets|cases|items|exceptions)/i,
  ]);
  const delayHours = extractNumber(message, [
    /([\d,]+(?:\.\d+)?)\s*(?:hours|hrs|h)\s*(?:delay|wait|waiting|blocked)/i,
    /(?:delay|wait|waiting|blocked).*?([\d,]+(?:\.\d+)?)\s*(?:hours|hrs|h)/i,
  ]);
  const minutes = extractNumber(message, [
    /([\d,]+(?:\.\d+)?)\s*(?:minutes|mins|min)\s*(?:each|per|handling|cycle)?/i,
    /(?:takes|handling|cycle).*?([\d,]+(?:\.\d+)?)\s*(?:minutes|mins|min)/i,
  ]);
  const cycleTimeHours = minutes ? Math.round((minutes / 60) * 10) / 10 : 0;
  const riskLevel = inferRisk(message, department);
  const summary = clean(
    message,
    `${department} reported a repeated ${process} work pattern that should be evaluated as an AI opportunity.`,
    420,
  );

  return {
    id: `ws-ai-${Date.parse(now) || Date.now()}`,
    source,
    eventType,
    department,
    process,
    summary: `${summary} This is an assistant-captured aggregate signal; no raw employee content is stored.`,
    metadata: {
      volume: volume || undefined,
      count: volume || undefined,
      delayHours: delayHours || undefined,
      cycleTimeHours: cycleTimeHours || undefined,
      confidence: isThinWorkSignalPrompt(message) ? 0.58 : 0.72,
      system: source === "other" ? "assistant-manual-capture" : source,
      region: "unspecified",
    },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: source === "survey" || source === "other" ? "explicit_opt_in" : "aggregated",
      retentionDays: 90,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel,
    createdAt: now,
  };
}
