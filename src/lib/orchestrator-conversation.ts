export type OrchestratorConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OrchestratorIntentKind =
  | "accepted_example"
  | "capability_help"
  | "command_complete"
  | "command_system"
  | "company_blueprint"
  | "connector_setup"
  | "evidence_review"
  | "example_request"
  | "feedback"
  | "fill_starter"
  | "governance"
  | "harness"
  | "intelligence"
  | "launch_readiness_review"
  | "launch_status"
  | "navigate"
  | "next_best_action"
  | "operating_timeline"
  | "process_design"
  | "prompt_contract"
  | "report"
  | "response_quality"
  | "role_mode"
  | "settings"
  | "skill_operation"
  | "setup_guide"
  | "status_overview"
  | "strategy"
  | "use_case_intake"
  | "value_metrics"
  | "workflow"
  | "work_intelligence"
  | "work_signal_capture"
  | "unknown";

export type OrchestratorWorkspaceSignals = {
  evidence?: number;
  governanceReviews?: number;
  launchScore?: number;
  pendingToolRequests?: number;
  requestedView?: string;
  runs?: number;
  skills?: number;
  useCases?: number;
  workSignals?: number;
  workflowIssues?: number;
};

export type OrchestratorMessageInterpretation = {
  confidence: number;
  goal: string;
  intent: OrchestratorIntentKind;
  rationale: string;
  signals: string[];
};

export const supportEmailUseCaseExample =
  "Support team handles about 120 customer emails per day. The biggest pain is delayed first responses and inconsistent wording. We use Gmail, Zendesk, and a shared FAQ doc. Anything involving refunds, legal claims, or account changes must stay human-reviewed. I want to automate draft replies for routine questions first.";

export function hasUseCaseDraftIntent(message: string) {
  const lower = message.toLowerCase();
  return (
    /\b(create|draft|add|make|build|structure)\b/.test(lower) &&
      /\b(use case|opportunity|intake|ai idea|automation idea)\b/.test(lower)
  ) || hasUseCaseCandidateIntent(message);
}

export function hasUseCaseCandidateIntent(message: string) {
  const lower = message.toLowerCase();
  return (
    /\b(start with|start by|begin with|focus on|try|use|let'?s say|lets say|let'?s go with|go with)\b/.test(lower) &&
    /\b(email|emails|ticket|tickets|invoice|contract|case|request|requests|lead|leads|customer|support|respond|response|routing|triage|review|approval|handoff|backlog|exception|exceptions)\b/.test(lower)
  ) || looksLikeWorkflowOpportunity(message);
}

export function extractUseCaseDraftSubject(message: string) {
  return message
    .replace(/^(please\s+)?(create|draft|add|make|build|structure)\s+(a\s+)?(new\s+)?(ai\s+)?(use\s+case|opportunity|intake|ai idea|automation idea)(\s+for|\s+about|:)?/i, "")
    .replace(/^(ok\s+)?(let'?s|lets)\s+(say\s+)?(start|begin|focus|try|use|go)\s+(with|on|by)?/i, "")
    .trim();
}

export function isThinUseCaseDraftPrompt(message: string) {
  const subject = extractUseCaseDraftSubject(message);
  const detailSignals = [
    /\b(hr|finance|legal|sales|marketing|support|operations|it|engineering|procurement|security|customer|employee|vendor|invoice|contract|ticket|case|request|lead|email|zendesk|gmail)\b/i,
    /\b(current|today|manual|pain|problem|delay|backlog|handoff|error|exception|bottleneck|goal|outcome|reduce|increase|improve|routine|inconsistent)\b/i,
    /\b(volume|monthly|weekly|daily|per day|hours|minutes|users|owner|approver|data|source|system|slack|jira|servicenow|salesforce|sharepoint|zendesk|gmail)\b/i,
  ].filter((pattern) => pattern.test(message)).length;

  return subject.length < 36 || detailSignals < 2;
}

export function isExampleAcceptance(message: string) {
  return /\b(ok|okay|yes|yeah|yep|sure|great|perfect|cool|sounds good|that works|let'?s do it|lets do it|go with that|use that|use the example|that example|let'?s go with that|lets go with that)\b/i.test(message);
}

export function isGetStartedIntent(message: string) {
  return /\b(get started|start here|begin|help me|walk me through|guide me|what now|where do i begin)\b/i.test(message);
}

export function hasLaunchReadinessReviewIntent(message: string) {
  const lower = message.toLowerCase();
  return (
    /\b(launch readiness|readiness review|production readiness|customer readiness|go-live readiness|go live readiness)\b/.test(lower) ||
    (/\b(run|do|perform|show|give me|reason|think|decide|assess|review)\b/.test(lower) &&
      /\b(blocker|blockers|evidence gap|evidence gaps|proof gap|proof gaps|proof is missing|missing proof|next button|readiness|ready)\b/.test(lower) &&
      /\b(launch|production|go live|go-live|customer|executive|executives)\b/.test(lower))
  );
}

export function lastAssistantExample(history: OrchestratorConversationMessage[]) {
  const assistant = [...history].reverse().find((message) => message.role === "assistant" && /\bexample\b/i.test(message.content));
  if (!assistant) return "";

  const curlyQuote = assistant.content.match(/[“"]([^“”"]{40,800})[”"]/);
  if (curlyQuote?.[1]) return curlyQuote[1].trim();

  const afterExample = assistant.content.split(/(?:for\s+)?example:/i)[1]?.trim() ?? "";
  return afterExample.split(/\n\s*Read details|\n\s*Proof used/i)[0]?.trim().replace(/^["“]|["”]$/g, "") ?? "";
}

export function acceptedExamplePayload(message: string, history: OrchestratorConversationMessage[]) {
  if (!isExampleAcceptance(message)) return "";
  const example = lastAssistantExample(history);
  return example || "";
}

export function recentUseCaseCandidate(history: OrchestratorConversationMessage[]) {
  const recentUser = [...history]
    .reverse()
    .find((item) => item.role === "user" && (hasUseCaseCandidateIntent(item.content) || /\b(email|emails|ticket|invoice|contract|case|request|respond|response)\b/i.test(item.content)));
  return recentUser?.content.trim() ?? "";
}

export function topicLabelForUseCase(message: string) {
  const lower = message.toLowerCase();
  if (/\b(email|emails|respond|response|reply|replies|inbox|support|customer|customers|gmail|zendesk)\b/.test(lower)) return "incoming email response";
  if (/\binvoice|ap\b/.test(lower)) return "invoice exception handling";
  if (/\bcontract|legal\b/.test(lower)) return "contract review";
  if (/\bticket|service\s*now|servicenow|jira\b/.test(lower)) return "ticket triage";
  const subject = extractUseCaseDraftSubject(message);
  return subject || "this workflow";
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function clampConfidence(score: number) {
  return Math.max(0.35, Math.min(0.98, Number((score / 8).toFixed(2))));
}

function lastAssistantAskedForIntake(history: OrchestratorConversationMessage[]) {
  const lastAssistant = [...history].reverse().find((item) => item.role === "assistant")?.content ?? "";
  return /Intake form|business process.*pain.*owner/i.test(lastAssistant);
}

function lastAssistantAskedForWorkSignal(history: OrchestratorConversationMessage[]) {
  const lastAssistant = [...history].reverse().find((item) => item.role === "assistant")?.content ?? "";
  return /Work signal form|repeated work pattern.*volume.*source/i.test(lastAssistant);
}

function looksLikeWorkflowOpportunity(message: string) {
  const text = message.toLowerCase();
  const workflowObjectScore = countMatches(text, [
    /\bemail|emails|inbox|reply|replies|respond|response|ticket|tickets|case|cases|request|requests\b/,
    /\binvoice|invoices|contract|contracts|lead|leads|rfp|review|approval|handoff|exception|exceptions\b/,
    /\bsupport|sales|finance|legal|hr|operations|procurement|customer|vendor|employee\b/,
  ]);
  const painScore = countMatches(text, [
    /\bslow|late|delay|delayed|backlog|mess|messy|inconsistent|manual|rework|error|errors|bottleneck|triage|waiting|takes?\s+\d+/,
    /\btoo many|high volume|repeat|repeated|routine|busy|overloaded|friction|pain|problem\b/,
  ]);
  const shapingScore = countMatches(text, [
    /\bhelp|turn|automate|improve|fix|route|draft|handle|triage|classify|summarize|scale|governed|safe\b/,
  ]);

  return workflowObjectScore >= 1 && (painScore + shapingScore >= 2);
}

function pushScore(
  scores: Partial<Record<OrchestratorIntentKind, number>>,
  signals: string[],
  intent: OrchestratorIntentKind,
  points: number,
  signal: string,
) {
  scores[intent] = (scores[intent] ?? 0) + points;
  signals.push(signal);
}

export function interpretOrchestratorMessage({
  history = [],
  message,
  workspace = {},
}: {
  history?: OrchestratorConversationMessage[];
  message: string;
  workspace?: OrchestratorWorkspaceSignals;
}): OrchestratorMessageInterpretation {
  const text = message.trim();
  const lower = text.toLowerCase();
  const scores: Partial<Record<OrchestratorIntentKind, number>> = {};
  const signals: string[] = [];
  const recentCandidate = recentUseCaseCandidate(history);

  if (acceptedExamplePayload(text, history)) pushScore(scores, signals, "accepted_example", 9, "accepted previous example");
  if (lastAssistantAskedForIntake(history) && /\b(fill it in|fill this in|do it for me|you fill|make it up|use defaults|use an example)\b/i.test(text)) {
    pushScore(scores, signals, "fill_starter", 8, "asked assistant to fill intake");
  }
  if (hasLaunchReadinessReviewIntent(text)) pushScore(scores, signals, "launch_readiness_review", 9, "asked for launch readiness blockers or proof gaps");
  if (/\b(give me an example|show me an example|good response|what.*expect|what would you expect|sample answer)\b/i.test(text)) {
    pushScore(scores, signals, "example_request", 7, "asked for an example answer");
  }
  if (/\b(open|show|go to|take me|navigate|switch to)\b/.test(lower) && workspace.requestedView) {
    pushScore(scores, signals, "navigate", 8, `requested ${workspace.requestedView} view`);
  }
  if (lastAssistantAskedForIntake(history) && text.length >= 16 && !hasUseCaseDraftIntent(text)) {
    pushScore(scores, signals, "use_case_intake", 8, "answered intake form");
  }
  if (lastAssistantAskedForWorkSignal(history) && text.length >= 16 && !hasWorkSignalCaptureIntentPhrase(text)) {
    pushScore(scores, signals, "work_signal_capture", 8, "answered work-signal form");
  }
  if (hasUseCaseDraftIntent(text) || looksLikeWorkflowOpportunity(text) || (isGetStartedIntent(text) && (recentCandidate || !workspace.useCases))) {
    pushScore(scores, signals, "use_case_intake", 6, "message describes a workflow opportunity");
  }
  if (hasWorkSignalCaptureIntentPhrase(text)) pushScore(scores, signals, "work_signal_capture", 7, "asked to capture work demand signal");
  if (/\b(help|what can you do|capabilities|commands)\b/.test(lower)) pushScore(scores, signals, "capability_help", 7, "asked for assistant capability");
  if (/\b(command order|command orders|daily command)\b/.test(lower) && /\b(done|complete|completed|close)\b/.test(lower)) {
    pushScore(scores, signals, "command_complete", 8, "asked to complete command order");
  }
  if (/\b(command system|command should|execute today|today's command|daily command|what needs attention|next command)\b/.test(lower)) {
    pushScore(scores, signals, "command_system", 7, "asked for command system guidance");
  }
  if (/\b(timeline|activity|history|what changed|what happened|last action|last thing|operating record|audit trail|activity log)\b/.test(lower)) {
    pushScore(scores, signals, "operating_timeline", 8, "asked for operating timeline or action memory");
  }
  if (
    /\b(next best action|best next action|next best move|best next move|what should we do|where should we start|what is next|what's next|next priority|highest leverage|rational move|most rational|highest leverage|what should i do)\b/.test(lower) ||
    (/\b(reason|think|decide|figure out)\b/.test(lower) && /\b(next|move|priority|do|pilot|launchable)\b/.test(lower))
  ) {
    pushScore(scores, signals, "next_best_action", 7, "asked for a reasoned next move");
  }
  if (/\b(company|organization|organisation|onboard|implementation|blueprint|rollout|90 day|operating model)\b/.test(lower)) {
    pushScore(scores, signals, "company_blueprint", 6, "asked about company rollout model");
  }
  if (
    /\b(set up|setup|empty workspace|new workspace|new company|first 90 days|guided setup|onboarding questions|start from scratch)\b/.test(lower) &&
    !/\b(connector|connectors|connect|integration|integrations|mcp|broker|slack|teams|jira|servicenow|sharepoint|workday)\b/.test(lower)
  ) {
    pushScore(scores, signals, "setup_guide", 7, "asked for guided company setup");
  }
  if (/\b(generate|create|write|draft|prepare|package)\b/.test(lower) && /\b(report|brief|exec|executive|leadership|board)\b/.test(lower)) {
    pushScore(scores, signals, "report", 7, "asked for executive reporting");
  }
  if (/\b(strategy|roadmap|quarter|objective|operating plan|priority|priorities)\b/.test(lower)) pushScore(scores, signals, "strategy", 6, "asked about strategy");
  if (/\b(process|redesign|current state|future state|swimlane|bottleneck|cycle time)\b/.test(lower)) pushScore(scores, signals, "process_design", 6, "asked about process design");
  if (/\b(work intelligence|work signal|work signals|opportunity radar|process mining|task mining|employee actions)\b/.test(lower)) pushScore(scores, signals, "work_intelligence", 5, "asked about work intelligence");
  if (/\b(prompt|prompt engineering|system prompt|guardrail|instruction|contract)\b/.test(lower)) pushScore(scores, signals, "prompt_contract", 6, "asked about prompt controls");
  if (/\b(future[- ]?proof|enterprise ai os|enterprise os|operating system intelligence|protocol readiness|agent protocol|ai operating system)\b/.test(lower)) {
    pushScore(scores, signals, "intelligence", 9, "asked about future-proof enterprise AI operating intelligence");
  }
  if (/\b(intelligence|smart|optimize|recommend|capable|agentic|autonomous|reasoning|meta rational|planner)\b/.test(lower)) pushScore(scores, signals, "intelligence", 5, "asked about assistant intelligence");
  if (/\b(assistant eval|assistant quality|response quality|test the assistant|evaluate the assistant|chat eval|response eval|eval harness)\b/.test(lower)) {
    pushScore(scores, signals, "response_quality", 8, "asked to evaluate assistant response quality");
  }
  if (/\b(executive mode|operator mode|builder mode|reviewer mode|auditor mode|role|persona|lens|for executives|for operators|for builders|for reviewers|for auditors)\b/.test(lower)) {
    pushScore(scores, signals, "role_mode", 7, "asked for role-specific operating lens");
  }
  if (/\b(feedback|critique|review this|what is wrong|what's wrong|missing|lacking|improve|audit this|quality pass|fully vet|better)\b/.test(lower)) {
    pushScore(scores, signals, "feedback", 7, "asked for quality review");
  }
  if (/\b(connector|connectors|connect|integration|integrations|mcp|broker|slack|teams|jira|servicenow|service now|sharepoint|workday|google workspace|office 365|microsoft 365)\b/.test(lower)) {
    pushScore(scores, signals, "connector_setup", 9, "asked about integrations");
  }
  if (/\b(launch|go live|go-live|production ready|primetime|prime time|customer ready|ready for customers|show this to executives|proof is missing)\b/.test(lower)) {
    pushScore(scores, signals, "launch_status", 6, "asked about launch posture");
  }
  if (/\b(convert|industrialize|turn|package|make|create)\b/.test(lower) && /\b(skill|agent|copilot|assistant)\b/.test(lower)) pushScore(scores, signals, "skill_operation", 7, "asked to create or operate a Skill");
  if (/\b(workflow studio|execution blueprint|workflow|builder|graph|canvas|node|validate|publish|test)\b/.test(lower)) pushScore(scores, signals, "workflow", 6, "asked about workflow execution");
  if (/\b(harness|runtime|trace|run|tool request|tool approval|execution)\b/.test(lower)) pushScore(scores, signals, "harness", 6, "asked about runtime or trace");
  if (/\b(governance|risk|review|legal|security|privacy|approval)\b/.test(lower)) pushScore(scores, signals, "governance", 6, "asked about governance or approval");
  if (/\b(evidence|audit|auditor|auditors|ledger|control|nist|iso|eu ai|owasp|proof)\b/.test(lower)) pushScore(scores, signals, "evidence_review", 6, "asked about proof or audit evidence");
  if (/\b(proof|evidence|audit|auditors)\b/.test(lower) && /\b(good enough|ready|sufficient|complete|quality|trust)\b/.test(lower)) {
    pushScore(scores, signals, "evidence_review", 4, "asked whether proof quality is sufficient");
  }
  if (/\b(roi|metric|metrics|value|adoption|hours|money|cost|benefit|benefits)\b/.test(lower)) pushScore(scores, signals, "value_metrics", 6, "asked about value metrics");
  if (/\b(api|key|model|provider|kimi|glm|deepseek|gemini|openai|anthropic|azure|sso|auth|admin|settings)\b/.test(lower)) pushScore(scores, signals, "settings", 6, "asked about settings or providers");
  if (/\b(status|summary|overview|today|attention|where are we)\b/.test(lower)) pushScore(scores, signals, "status_overview", 5, "asked for workspace status");

  if (!workspace.useCases && scores.use_case_intake) pushScore(scores, signals, "use_case_intake", 1, "workspace has no use cases");
  if ((workspace.launchScore ?? 100) < 85 && (scores.launch_status || scores.launch_readiness_review)) {
    pushScore(scores, signals, scores.launch_readiness_review ? "launch_readiness_review" : "launch_status", 1, "launch score is below production threshold");
  }

  const [intent = "unknown", score = 0] =
    (Object.entries(scores) as [OrchestratorIntentKind, number][]).sort((a, b) => b[1] - a[1])[0] ?? [];
  const resolvedIntent = intent || "unknown";

  return {
    confidence: score ? clampConfidence(score) : 0.35,
    goal: goalForIntent(resolvedIntent),
    intent: resolvedIntent,
    rationale: signals.slice(0, 3).join("; ") || "No strong operating intent detected; use safe general routing.",
    signals: [...new Set(signals)].slice(0, 6),
  };
}

function goalForIntent(intent: OrchestratorIntentKind) {
  const labels: Record<OrchestratorIntentKind, string> = {
    accepted_example: "draft from accepted example",
    capability_help: "explain assistant capabilities",
    command_complete: "complete command order",
    command_system: "operate command system",
    company_blueprint: "map company rollout",
    connector_setup: "activate connectors",
    evidence_review: "inspect proof and audit evidence",
    example_request: "provide editable example",
    feedback: "review workspace quality",
    fill_starter: "offer editable starter without fabricating facts",
    governance: "review governance and risk",
    harness: "inspect or run Harness evidence",
    intelligence: "explain reasoning and optimization mode",
    launch_readiness_review: "review launch blockers and proof gaps",
    launch_status: "summarize launch posture",
    navigate: "navigate to requested surface",
    next_best_action: "choose next best operating move",
    operating_timeline: "summarize operating timeline",
    process_design: "redesign process before automation",
    prompt_contract: "review prompt contract and guardrails",
    report: "generate or prepare report",
    response_quality: "evaluate assistant response quality",
    role_mode: "switch or explain role lens",
    settings: "configure admin settings",
    skill_operation: "operate or create Skill",
    setup_guide: "guide company setup",
    status_overview: "summarize workspace status",
    strategy: "plan strategy and roadmap",
    unknown: "route safely",
    use_case_intake: "structure workflow into use case",
    value_metrics: "inspect value and adoption metrics",
    workflow: "build or validate workflow",
    work_intelligence: "inspect work intelligence",
    work_signal_capture: "capture governed work signal",
  };

  return labels[intent];
}

function hasWorkSignalCaptureIntentPhrase(message: string) {
  const lower = message.toLowerCase();
  return /\b(capture|record|add|create|log)\b/.test(lower) && /\b(work signal|signal|work demand|process signal|demand signal)\b/.test(lower);
}
