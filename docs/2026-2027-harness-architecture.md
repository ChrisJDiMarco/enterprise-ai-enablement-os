# Enterprise AI Enablement OS - 2026-2027 Harness Architecture

## North Star

Enterprise AI Enablement OS must be a tenant-agnostic operating system for any company, not a single-company demo or a generic chatbot shell.

The product should help an enterprise turn business pain into governed AI capabilities, then run those capabilities through a visible, measurable, policy-controlled harness. The harness is the product moat.

## Architecture Decision

Build the app around a framework-independent Harness Runtime contract, with adapters for the best available agent runtimes.

Use LangGraph-class orchestration as the primary production runtime target because it is designed for long-running, stateful graph execution, persistence, checkpoints, human-in-the-loop interruption, memory, and replay. Keep LangChain components available for model/tool integrations, but do not let business objects depend directly on LangChain types.

Use the OpenAI Agents SDK as an optional provider/runtime adapter when the enterprise wants OpenAI-native agents, tools, handoffs, guardrails, traces, and hosted workflow surfaces.

Use MCP as the connector standard, but put every MCP server behind the OS MCP Broker so discovery, approval, tenant policy, data classification, audit, and cost controls remain centralized.

Use OPA/Rego-style policy-as-code for authorization and tool decisions, with a small local policy evaluator first and a pluggable policy decision point later.

Use OpenTelemetry GenAI semantic conventions for trace naming and attributes, with LangSmith-compatible tracing/evaluation as an optional integration. Sensitive prompt/input/output capture must be opt-in by tenant policy.

Use Temporal or an equivalent durable execution service for production workflows that must survive crashes, long waits, approvals, retries, and cross-system side effects. In the local MVP, represent this as a job/run abstraction until the backend exists.

## Model Router Direction

The OS should route by task lane, not by one global default model. This is how the platform avoids wasting expensive frontier tokens on classification, extraction, routine summarization, and background jobs.

Initial task lanes:

| Lane | Purpose | Default model ref |
|---|---|---|
| Default Skill run | General governed Skill execution | `local-enterprise-reasoner` until configured |
| Classification / scoring | Risk classification, triage, priority scoring | `deepseek/deepseek-v4-flash` |
| Summaries / briefs | Executive briefs, status summaries, readouts | `gemini/gemini-2.5-flash` |
| Governance reasoning | Policy interpretation, review notes, approval conditions | `glm/glm-5.1` |
| Workflow / tool planning | Agentic workflow synthesis and tool planning | `kimi/kimi-k2.6` |
| Red-team / evals | Adversarial checks, prompt injection, permission tests | `deepseek/deepseek-v4-pro` |
| Fallback | Failover when a lane is not configured or unavailable | `openrouter/auto` |

Provider config should support:

- Kimi / Moonshot: OpenAI-compatible base URL `https://api.moonshot.ai/v1`.
- DeepSeek: OpenAI-compatible base URL `https://api.deepseek.com`.
- GLM / Z.AI: general API base URL `https://api.z.ai/api/paas/v4`; coding-plan endpoint remains a separate specialized path.
- Gemini / Google: Google GenAI API key, with provider-specific support for thinking budget later.
- OpenRouter or another gateway: optional broad fallback and marketplace route.

Router rules:

- Explicit user-selected model runs should be strict unless the user enabled fallback.
- Automated lanes can fail over by ordered policy.
- Every route decision should write a trace event: requested lane, selected provider/model, fallback used, reason, estimated cost class, and provider latency.
- Provider SDKs and base URLs must stay server-side in production; the current local settings panel is a development control surface only.
- The broker must account for provider quirks. OpenAI-compatible transport does not mean identical tool-calling, streaming usage, reasoning, temperature, or error semantics.

## Runtime Ports

The product should evolve toward these stable interfaces:

```ts
export interface HarnessRuntime {
  runSkill(input: RunSkillInput): Promise<RunSkillResult>;
  resumeRun(input: ResumeRunInput): Promise<RunSkillResult>;
  getRunTrace(runId: string): Promise<RunTrace>;
}

export interface GraphRuntimeAdapter {
  id: "local" | "langgraph" | "openai_agents" | "temporal" | "custom";
  compile(skill: SkillSpec, workflow: WorkflowSpec): Promise<CompiledWorkflow>;
  invoke(input: GraphInvokeInput): Promise<GraphInvokeResult>;
  resume(input: GraphResumeInput): Promise<GraphInvokeResult>;
}

export interface PolicyDecisionPoint {
  evaluateToolRequest(input: ToolPolicyInput): Promise<ToolDecision>;
  evaluateContextAccess(input: ContextAccessInput): Promise<ContextDecision>;
  evaluateOutput(input: OutputPolicyInput): Promise<OutputDecision>;
}

export interface ConnectorBroker {
  listTools(input: ConnectorDiscoveryInput): Promise<ConnectorTool[]>;
  requestTool(input: ToolExecutionRequest): Promise<ToolExecutionDecision>;
  executeApprovedTool(input: ApprovedToolExecution): Promise<ToolExecutionResult>;
}

export interface EvaluationRunner {
  runSuite(input: EvalSuiteRunInput): Promise<EvalSuiteResult>;
  redTeam(input: RedTeamRunInput): Promise<RedTeamResult>;
}
```

## System Layers

1. Tenant and identity layer
   - Organizations, domains, branding, SSO, SCIM, RBAC, ABAC, departments, data regions.

2. Use Case Factory
   - Intake, structuring, scoring, value estimation, risk classification, pattern recommendation, pilot plan.

3. Skill Registry
   - Versioned SkillSpec records containing prompt, model routing, context policy, tool policy, eval suite, owner, autonomy tier, launch checklist, and rollback data.

4. Harness Runtime
   - Identity check, input classification, context retrieval, prompt assembly, model/tool orchestration, approval gates, output validation, eval hooks, audit logging, feedback, metrics.

5. Graph Orchestration Adapter
   - Local deterministic runtime for MVP.
   - LangGraph.js adapter for stateful graph workflows.
   - OpenAI Agents SDK adapter for provider-native agents and handoffs.
   - Temporal-backed adapter for crash-proof, long-running production workflows.

6. MCP Broker
   - Tool catalog, connector registration, schema validation, tool risk labels, approval queues, execution sandboxes, usage logs.

7. Context Fabric
   - Source catalog, data classification, retrieval tests, permission filtering, citations, freshness, knowledge gaps, vector/index abstraction.

8. Policy Engine
   - Tool allow/deny, context allow/deny, approval requirement, autonomy-tier enforcement, redaction, retention, output checks, escalation.

9. Evaluation and Red Team
   - Regression suites, prompt injection, grounding, hallucination, tool safety, permission tests, cost/latency, launch thresholds.

10. Observability and Evidence Ledger
   - Run traces, OTel-aligned spans, audit logs, policy decisions, eval results, approvals, tool calls, cost, latency, adoption, ROI.

11. Measurement and Portfolio Intelligence
   - Adoption, hours saved, cost avoided, cycle time reduction, risk reduction, user feedback, value confidence, executive reports.

## Product Rules Going Forward

- No tenant-specific seed story should be built into the product. Tenant examples can be imported as separate fixtures, never compiled into production startup.
- Every screen should work for any company, department, and AI maturity level.
- Every Skill must be portable: exportable as SkillSpec JSON/YAML and runnable by an adapter.
- Every tool call must pass through the broker and policy engine.
- Every run must produce an evidence trail, even when it is blocked.
- Every AI output must distinguish source-backed content, model inference, and human decision.
- Every approval should be resumable, auditable, and tied to a policy reason.
- Every framework choice must sit behind an adapter. The OS owns the domain model.

## Research Anchors

- LangGraph: low-level orchestration runtime for long-running, stateful agents with durable execution, human-in-the-loop, persistence, memory, and streaming.
- LangGraph persistence: checkpoints support human review, memory, time travel, and fault tolerance.
- OpenAI Agents SDK: server-owned orchestration, tools, MCP, guardrails, handoffs, state, tracing, and evaluation.
- MCP: official open protocol specification and documentation for model/tool/context integration.
- Open Policy Agent: policy-as-code engine for offloading policy decisions.
- Temporal: durable execution for workflows that should not disappear during failures.
- LangSmith: framework-agnostic tracing, debugging, evaluation, prompt testing, and deployment workflows.
- OpenTelemetry GenAI semantic conventions: common trace attributes for model operations and tool calls; sensitive prompt and output capture should not be on by default.

## Near-Term Build Sequence

1. Continue hardening the extracted local Harness Runtime into the stable `HarnessRuntime.runSkill()` boundary.
2. Create `SkillSpec`, `WorkflowSpec`, `ToolPolicySpec`, `ContextPolicySpec`, and `EvalSuiteSpec` schemas.
3. Make the visual Workflow Builder compile to `WorkflowSpec`.
4. Expand Skill runs beyond the local runtime by adding server-side adapter slots.
5. Add a local deterministic runtime adapter that produces the same traces currently shown in the UI.
6. Add a policy decision point module and route every tool/context/output decision through it.
7. Add an adapter slot for LangGraph.js without forcing it into the client bundle.
8. Add an adapter slot for OpenAI Agents SDK provider-native execution.
9. Add an OTel-shaped trace event schema and map existing audit/run trace events into it.
10. Expand the server-side provider registry from readiness checks into provider health, invocation, latency, and cost telemetry.
11. Expand the new backend seams: Postgres repositories for workflow jobs and connector events, encrypted tenant secrets, object storage, vector index, queue/workers, SCIM, and a real connector service.
