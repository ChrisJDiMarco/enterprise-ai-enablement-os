# Enterprise AI Enablement OS - Requirement Document

## Objective

Build a premium internal enterprise web app that turns business AI opportunities into governed, reusable, measurable AI Skills that run inside an AI Harness.

## First Build Scope

The first build is an interactive deployment with server-backed workspace persistence, production-empty startup, import/export support, auth/RBAC API guards, and a deterministic AI Harness runtime. It should let a user complete the core lifecycle:

1. Understand the AI portfolio in Command Center.
2. Submit and score a new use case.
3. Convert a use case into a governed Skill.
4. Configure prompt, model, tools, context, and approvals.
5. Run a governed local Skill test.
6. Inspect harness trace, tool approvals, audit logs, evals, governance, ROI, workflow, and reports.

## Product Principles

- Enterprise AI is a governed operating system, not scattered prompts.
- Skills are reusable assets with owners, policies, evals, logs, and value metrics.
- The Harness is visible: identity, context, policy, tools, approvals, output validation, audit, and ROI.
- Every major button should perform a useful local interaction.
- The design should feel bright, calm, precise, and executive-grade.
- The platform must work for any company or tenant. Tenant examples belong in imports/fixtures, never in production startup.
- The OS owns the domain model. Agent frameworks are runtime adapters, not the product architecture.

## Technical Direction

- Next.js App Router, React, TypeScript, Tailwind CSS.
- Production-empty workspace with server repository persistence, Postgres support, local file fallback, browser cache fallback, and import/export.
- Signed session auth with local development mode, OIDC SSO start/callback routes, and role-based guards for viewer/builder/admin surfaces.
- Recharts for portfolio charts.
- React Flow for visual workflow.
- Model/provider, broker, eval, and trace abstractions represented in code so real services can be attached later.
- Extracted local Harness Runtime contract with pluggable graph/runtime adapter direction.
- Extracted ModelRouter and server-side provider registry/readiness API.
- Server Harness API that runs policy checks, calls provider adapters when server credentials exist, and falls back to deterministic local mode when they do not.
- Workspace, audit, context retrieval, connector execution, workflow job, provider readiness, session, login/logout, and production readiness APIs.
- Primary production runtime target: LangGraph.js-style stateful graph orchestration for durable execution, checkpoints, human-in-the-loop, memory, and replay.
- Optional provider-native runtime: OpenAI Agents SDK adapter for tools, handoffs, guardrails, traces, and evaluation.
- Connector standard: MCP behind the OS MCP Broker, never direct ungoverned tool access.
- Policy direction: OPA/Rego-style policy-as-code for tool, context, output, autonomy, retention, and approval decisions.
- Observability direction: OpenTelemetry GenAI-shaped traces, with LangSmith-compatible tracing/evaluation as an optional integration.
- Long-running workflow direction: Temporal or equivalent durable execution service once the backend worker layer exists.
- Model routing direction: task-lane routing across local, OpenAI, Anthropic, Azure OpenAI, Gemini, Kimi/Moonshot, GLM/Z.AI, DeepSeek, OpenRouter, and future providers. Routine classification and summarization should default to lower-cost models; governance, red-team, and tool-planning lanes should use stronger models only when required.

## 2026-2027 Harness Target

The architecture north star is captured in `docs/2026-2027-harness-architecture.md`.

The next serious engineering phase should continue extracting the local app into stable runtime and backend contracts:

1. `HarnessRuntime`
2. `GraphRuntimeAdapter`
3. `PolicyDecisionPoint`
4. `ConnectorBroker`
5. `EvaluationRunner`
6. `SkillSpec` and `WorkflowSpec` schemas
7. `ModelRouter` and provider registry

This keeps the product ready for LangGraph, OpenAI Agents SDK, Temporal, MCP, OTel, and policy-as-code without coupling the UI to one framework.

## Remaining Non-Goals For This Build

- Full SCIM provisioning and enterprise IdP admin UI.
- Encrypted tenant secret vault beyond server environment variables.
- Production MCP execution without a configured external broker.
- Production LangGraph/Temporal workers.
- Production compliance certification.

## Success Criteria

The app opens locally, feels polished, starts without preloaded records, and supports the complete enterprise AI lifecycle once real opportunities, Skills, traces, approvals, evals, and reporting data are created or imported.
