# Enterprise AI Enablement OS

![Enterprise AI Enablement OS hero](public/marketing/enterprise-ai-os-readme-hero.png)

**Enterprise AI Enablement OS is a full-stack operating system for taking AI from scattered experiments to governed, measurable, enterprise-wide capability.**

Most companies do not need another chatbot. They need a way to decide where AI belongs, connect it to the systems people already use, prove that it is safe, and show leadership where adoption and value are actually happening.

Enterprise AI Enablement OS is built around that job. It combines AI portfolio intake, governed Skill creation, workflow design, tool and connector controls, evaluation harnesses, proof ledgers, adoption programs, ROI tracking, and executive reporting into one control plane.

## Open Source

Enterprise AI Enablement OS is open source under the [Apache License 2.0](LICENSE). The public core is meant to be useful on its own for practitioners, developers, consultants, and AI transformation teams.

The intended commercial model is open core: keep the operating system transparent and extensible, then offer a hosted enterprise version for managed cloud operations, SSO/SCIM, managed connectors, advanced policy packs, support, implementation services, and scheduled executive reporting. See [docs/open-core.md](docs/open-core.md).

## Why A Company Would Use It

Enterprise AI usually breaks down in the space between strategy and production:

- Teams find dozens of promising use cases, but no repeatable way to score, prioritize, and govern them.
- Developers build agents and automations, but leadership cannot see ownership, risk, evidence, or value.
- Security, legal, privacy, and compliance teams need structured proof before rollout.
- Business users need AI inside real workflows, not generic prompt training.
- Executives need a board-ready view of what AI exists, what it touches, what it costs, and what it returns.

This app is designed to become the system of record and command center for that whole operating model.

## What It Does

| Capability | What it gives the business |
| --- | --- |
| **Company Plan** | A practical rollout model for standing up AI across functions, teams, risk lanes, and adoption waves. |
| **Work Intelligence** | A privacy-safe way to capture repeated work signals, friction, process gaps, and demand patterns. |
| **Use Case Factory** | Structured intake, scoring, prioritization, and conversion from opportunity to governed AI Skill. |
| **AI Skills** | Reusable AI capabilities with owners, prompts, context, tool permissions, autonomy level, evals, and value tracking. |
| **Workflow Builder** | A visual operating blueprint for how humans, AI, tools, approvals, and systems work together. |
| **AI Harness** | Runtime testing, traces, tool calls, model routing, policy decisions, and execution evidence. |
| **Risk Review** | Governance packets for security, legal, privacy, compliance, approval, exceptions, and launch readiness. |
| **Proof Ledger** | Audit-ready evidence across use cases, Skills, traces, evals, reviews, controls, and ROI. |
| **Reports** | Executive briefs, governance summaries, ROI updates, board packets, and daily operating digests. |
| **AI Assistant** | A command hub that can answer questions, explain metrics, route work, and produce visible action buttons. |

## The Operating Model

The product is organized around a simple enterprise loop:

```mermaid
flowchart LR
  A["Discover Work"] --> B["Score Use Cases"]
  B --> C["Build Governed Skills"]
  C --> D["Design Workflows"]
  D --> E["Run Harness + Evals"]
  E --> F["Review Risk"]
  F --> G["Launch Safely"]
  G --> H["Measure Adoption + ROI"]
  H --> I["Report to Leadership"]
  I --> A
```

Every loop should produce proof: who owns the AI, what workflow it supports, what systems it can touch, what controls apply, what tests passed, what humans approved, and what business value was created.

## Executive View

For a CEO, CIO, Chief AI Officer, or transformation leader, the app answers five questions:

1. **What AI is being built or used across the company?**
2. **Which initiatives are worth funding, pausing, or scaling?**
3. **Which AI systems touch sensitive data, tools, decisions, or customers?**
4. **What evidence proves they are safe, useful, and improving?**
5. **Where is AI creating measurable value?**

The goal is not to make AI activity look busy. The goal is to make enterprise AI accountable.

## Product Surfaces

- **Home**: command center for the next move, launch warnings, enterprise OS score, lifecycle bottlenecks, and priority actions.
- **AI Assistant**: minimal GPT-style interface that can operate the app through auditable action buttons.
- **AI Inventory**: system of record for AI assets, owners, providers, connectors, risks, proof, and readiness.
- **Company Plan**: implementation model for introducing AI into an organization responsibly.
- **AI Roadmap**: sequencing for use cases, dependencies, risk, adoption, and executive decisions.
- **Workflow Builder**: human + AI execution graph with gates, handoffs, and policy-aware steps.
- **AI Harness**: test bench for prompts, model routing, tool calls, approvals, traces, and evals.
- **Connect Apps**: readiness layer for Slack, Microsoft 365, Jira, ServiceNow, SharePoint, Workday, Google Workspace, and broker-managed tools.
- **Risk Review**: governance layer for NIST AI RMF, ISO/IEC 42001, EU AI Act readiness, OWASP LLM risks, and board/audit packets.
- **Proof Ledger**: reviewer-ready evidence packets for launch, controls, records, and business proof.
- **Value & ROI**: adoption, time saved, annualized value, and finance-facing impact story.
- **Reports**: automated stakeholder packets for executives, reviewers, operators, and adoption leaders.

## Technical Foundation

This is a Next.js, React, TypeScript, and Tailwind application with a server-backed workspace model and production-oriented seams for enterprise deployment.

Current foundations include:

- Signed session auth, OIDC start/callback routes, role-based API guards, and tenant user management.
- Server-side workspace persistence with Postgres support and local file fallback.
- SCIM-compatible tenant user provisioning.
- Tenant provider-secret vault API and provider readiness checks.
- Policy-gated Harness runtime with traces, eval artifacts, tool requests, and audit evidence.
- Connector/MCP broker execution seam with policy-only fallback.
- Context indexing and permission-aware retrieval APIs.
- Workflow job ledger, audit chain integrity, privacy lifecycle controls, and customer launch preflight checks.
- Model routing by task lane for cost-aware provider selection.

The architecture is intentionally adapter-friendly. The runtime is designed to support local execution, LangGraph.js, OpenAI Agents SDK, Temporal, custom graph runtimes, and broker-managed enterprise tool access.

## Architecture North Star

- `HarnessRuntime` owns execution semantics.
- `GraphRuntimeAdapter` supports local, LangGraph.js, OpenAI Agents SDK, Temporal, and custom runtimes.
- `ConnectorBroker` gates MCP/tool access.
- `PolicyDecisionPoint` evaluates tool, context, output, autonomy, approval, and retention decisions.
- `EvaluationRunner` handles regression, red-team, launch-readiness, and quality suites.
- `ModelRouter` chooses the right provider/model per task lane.
- OTel-shaped traces and durable evidence records make every run inspectable.

More detail:

- [2026-2027 Harness Architecture](docs/2026-2027-harness-architecture.md)
- [Product Architecture Roadmap](docs/product-architecture-roadmap.md)
- [Production Runbook](docs/production-runbook.md)

## Run Locally

```bash
npm install
npm run dev
```

Open the port printed by Next.js. In this workspace we often run the app on:

```text
http://localhost:3007
```

For provider readiness, copy `.env.example` to `.env.local` and configure the providers or infrastructure you want to test.

For durable local database testing:

```bash
docker compose up -d postgres
```

Then set:

```bash
DATABASE_URL=postgres://enterprise_ai_os:enterprise_ai_os_dev@localhost:54322/enterprise_ai_os
AUTH_SECRET=<random-32-byte-secret>
AUTH_REQUIRED=true
```

If `DATABASE_URL` is absent, the app uses `.data/` file persistence for local development.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For the broader local product-flow gate:

```bash
npm run verify
```

For hosted launch checks:

```bash
PREFLIGHT_BASE_URL=https://your-domain.example.com npm run verify:launch
```

## Deployment Readiness

A real customer deployment should configure:

- `DATABASE_URL`
- `AUTH_REQUIRED=true`
- OIDC credentials
- `AUTH_SECRET`
- `TENANT_SECRET_KEY`
- `API_TRUSTED_ORIGINS`
- at least one external model provider
- backup and restore evidence
- schema migration evidence
- enterprise connector secrets or an MCP broker
- durable trace/eval artifact storage
- durable workflow runtime

Local development can run without all of this. Broad customer rollout should not.

## Status

This repository is an active open-source product build of an enterprise AI enablement platform. The current app is designed to demonstrate the full operating model locally while keeping production seams explicit for customer deployment.

## Community

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.
- Use `.env.example` as the template and keep real secrets in ignored local env files.
