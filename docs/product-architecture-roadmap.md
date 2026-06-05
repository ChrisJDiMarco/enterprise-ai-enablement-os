# Enterprise AI Enablement OS - Product Architecture Roadmap

This is the implementation map for turning the current control plane into a true enterprise AI transformation operating system.

## 1. Identity First

- Configure OIDC SSO for every customer tenant.
- Use the SCIM-compatible provisioning endpoint for tenant users, then add customer-specific group, department, region, and reviewer-role mapping templates.
- Extend RBAC into ABAC: user role, department, geography, data classification, source ownership, Skill risk, autonomy tier, and tool action type.
- Make every Skill a first-class agent identity with owner, scopes, approvals, kill switch, and version history.

## 2. Connector Plane

- Keep every external system behind the MCP Broker or native connector adapter layer.
- Supported connector families:
  - Slack
  - Microsoft 365 / Teams / Graph
  - Jira
  - ServiceNow
  - SharePoint
  - Workday
  - Google Workspace
- Every connector action must emit:
  - policy decision
  - actor identity
  - Skill identity
  - approval status
  - payload redaction status
  - external system response metadata
  - evidence packet record

## 3. Context Fabric

- Ingest approved documents and metadata from SharePoint, Drive, Confluence, Notion, ServiceNow KB, contract repositories, and databases.
- Preserve source ownership, classification, permission model, freshness, and citation URI.
- Use vector retrieval in production, but keep lexical/file fallback for development and deterministic tests.
- Retrieval must always filter by user, Skill, source, and data classification before prompt assembly.

## 4. Work Intelligence

- Capture privacy-safe aggregate signals from Slack/Teams/Jira/ServiceNow/email/workflow systems.
- Never store raw employee message content by default.
- Never score individual employees.
- Convert repeated pain, delays, rework, queue volume, context gaps, and handoff problems into use case candidates.

## 5. Use Case To Skill Factory

- Turn a messy opportunity into:
  - use case brief
  - value model
  - process redesign map
  - risk classification
  - recommended AI pattern
  - pilot plan
  - SkillSpec draft
  - eval suite
  - governance packet

## 6. Harness Runtime

- Run every Skill through a deterministic state machine:
  - identity
  - access
  - context retrieval
  - prompt contract
  - model routing
  - tool policy
  - human approval
  - output validation
  - trace persistence
  - feedback capture
- Add Temporal/LangGraph/OpenAI Agents adapters behind the same runtime contract.

## 7. Continuous Evals

- Run launch, regression, red-team, tool-safety, permission, cost, latency, and drift evals.
- Store eval artifacts durably.
- Block launch or expansion when critical evals fail.
- Schedule re-evals when prompts, sources, tools, models, policies, or connector scopes change.

## 8. Evidence And Reporting

- Build board-ready evidence packets from use cases, Skills, traces, evals, governance reviews, connector events, audit logs, and ROI assumptions.
- Export JSON and Markdown now; add PDF later.
- Every executive claim should link back to evidence.

## 9. Customer Launch Path

- Production readiness must pass:
  - OIDC SSO
  - Postgres
  - migrations
  - backup/restore evidence
  - tenant secret vault
  - external provider key
  - connector broker or native connector secrets
  - durable workflow engine
  - trace and eval artifact storage
- Demo mode remains available, but production startup must be empty and honest.
