import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("docs/architecture");
const outputPath = path.join(outputDir, "enterprise-ai-enablement-os-architecture.drawio");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cellValue(title, subtitle = "") {
  return subtitle
    ? `<b>${escapeXml(title)}</b><br><font style="font-size:11px;color:#64748b">${escapeXml(subtitle)}</font>`
    : `<b>${escapeXml(title)}</b>`;
}

const styles = {
  lane:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#cbd5e1;fontColor=#0f172a;fontStyle=1;verticalAlign=top;align=center;spacingTop=10;arcSize=8;",
  actor:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#eef2ff;strokeColor=#6366f1;fontColor=#111827;spacing=10;arcSize=12;",
  ui:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#60a5fa;fontColor=#0f172a;spacing=10;arcSize=10;",
  api:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#eef2ff;strokeColor=#818cf8;fontColor=#0f172a;spacing=10;arcSize=10;",
  domain:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#faf5ff;strokeColor=#a855f7;fontColor=#0f172a;spacing=10;arcSize=10;",
  data:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#ecfdf5;strokeColor=#10b981;fontColor=#0f172a;spacing=10;arcSize=10;",
  external:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fffbeb;strokeColor=#f59e0b;fontColor=#0f172a;spacing=10;arcSize=10;",
  proof:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff1f2;strokeColor=#fb7185;fontColor=#0f172a;spacing=10;arcSize=10;",
  edge:
    "rounded=0;whiteSpace=wrap;html=1;edgeStyle=orthogonalEdgeStyle;jettySize=auto;orthogonalLoop=1;strokeColor=#64748b;strokeWidth=2;endArrow=block;endFill=1;fontColor=#475569;labelBackgroundColor=#ffffff;",
  proofEdge:
    "rounded=0;whiteSpace=wrap;html=1;edgeStyle=orthogonalEdgeStyle;jettySize=auto;orthogonalLoop=1;strokeColor=#fb7185;strokeWidth=2;dashed=1;endArrow=block;endFill=1;fontColor=#be123c;labelBackgroundColor=#ffffff;",
};

function vertex(id, value, x, y, w, h, style) {
  return { kind: "vertex", id, value, x, y, w, h, style };
}

function edge(id, source, target, value = "", style = styles.edge) {
  return { kind: "edge", id, source, target, value, style };
}

function modelXml(cells, { dx = 2600, dy = 1200, width = 2800, height = 980 } = {}) {
  const cellXml = cells
    .map((cell) => {
      if (cell.kind === "edge") {
        return `      <mxCell id="${escapeXml(cell.id)}" value="${escapeXml(cell.value)}" style="${escapeXml(cell.style)}" edge="1" parent="1" source="${escapeXml(cell.source)}" target="${escapeXml(cell.target)}">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>`;
      }
      return `      <mxCell id="${escapeXml(cell.id)}" value="${escapeXml(cell.value)}" style="${escapeXml(cell.style)}" vertex="1" parent="1">
        <mxGeometry x="${cell.x}" y="${cell.y}" width="${cell.w}" height="${cell.h}" as="geometry" />
      </mxCell>`;
    })
    .join("\n");

  return `<mxGraphModel dx="${dx}" dy="${dy}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
${cellXml}
  </root>
</mxGraphModel>`;
}

const architectureCells = [
  vertex("title", "<b>Enterprise AI Enablement OS Architecture</b><br><font style=\"font-size:12px;color:#64748b\">Layered map of UI, command plane, intelligence services, persistence, proof, and external enterprise systems.</font>", 30, 10, 580, 60, "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=none;fontColor=#0f172a;align=left;verticalAlign=middle;"),

  vertex("lane-users", "Actors", 30, 90, 220, 790, styles.lane),
  vertex("lane-ui", "Browser Experience", 280, 90, 390, 790, styles.lane),
  vertex("lane-api", "Next.js API + Command Plane", 700, 90, 420, 790, styles.lane),
  vertex("lane-domain", "Enterprise AI Domain Intelligence", 1150, 90, 500, 790, styles.lane),
  vertex("lane-data", "Persistence + Proof Substrate", 1680, 90, 420, 790, styles.lane),
  vertex("lane-ext", "External Systems", 2130, 90, 430, 790, styles.lane),

  vertex("users", cellValue("Enterprise users", "Admins, builders, reviewers, exec sponsors, operators"), 55, 150, 170, 76, styles.actor),
  vertex("ai-office", cellValue("AI Enablement Office", "Runs intake, governance, launch, reporting, ROI"), 55, 250, 170, 76, styles.actor),
  vertex("auditors", cellValue("Governance + audit", "Legal, privacy, security, compliance, board"), 55, 350, 170, 76, styles.actor),

  vertex("app-shell", cellValue("AppShell", "Global nav, header, command/search, settings, assistant pill"), 305, 140, 330, 70, styles.ui),
  vertex("view-router", cellValue("AppViewRouter", "Routes state and handlers to every OS surface"), 305, 230, 330, 70, styles.ui),
  vertex("views", cellValue("Operating surfaces", "Command Center, Work, Use Cases, Skills, Workflow, Harness, Connect Apps, Broker, Evals, Risk, Launch, Evidence, ROI, Reports, Settings"), 305, 320, 330, 120, styles.ui),
  vertex("assistant-ui", cellValue("AI Assistant hub", "Chat can open surfaces, run actions, explain metrics, draft work"), 305, 465, 330, 80, styles.ui),
  vertex("client-state", cellValue("Client workspace state", "workspaceSnapshot, URL state, guided/unguided mode, localStorage fallback"), 305, 575, 330, 92, styles.ui),
  vertex("offline-sync", cellValue("Offline/local fallback", "Browser cache protects work when API persistence is unavailable"), 305, 700, 330, 70, styles.ui),

  vertex("auth", cellValue("Auth, RBAC, sessions", "/api/auth/*, OIDC, role gates, mutation protection"), 725, 140, 350, 76, styles.api),
  vertex("workspace-api", cellValue("Workspace API", "/api/workspace saves/loads normalized EnterpriseWorkspace"), 725, 240, 350, 76, styles.api),
  vertex("commands-api", cellValue("Workspace Commands API", "/api/workspace/commands applies durable product actions"), 725, 340, 350, 76, styles.api),
  vertex("orchestrator-api", cellValue("Orchestrator Chat API", "/api/orchestrator/chat plans assistant responses and actions"), 725, 440, 350, 76, styles.api),
  vertex("domain-apis", cellValue("Domain APIs", "use cases, reports, evidence, launch packets, evals, harness, context, privacy, traces"), 725, 540, 350, 96, styles.api),
  vertex("connector-apis", cellValue("Connector + provider APIs", "connector execution/readiness, provider secrets, provisioning, health, audit"), 725, 665, 350, 92, styles.api),

  vertex("workspace-command-runtime", cellValue("Workspace command runtime", "create use case, convert to Skill, eval, governance, runtime import, packs, schedules"), 1180, 135, 420, 86, styles.domain),
  vertex("orchestrator-runtime", cellValue("Orchestrator runtime", "Compact workspace context, meta-reasoning planner, action candidates"), 1180, 245, 420, 78, styles.domain),
  vertex("operating-intel", cellValue("Operating intelligence", "Maturity, launch gates, transformation command system, blueprint, action inbox"), 1180, 345, 420, 86, styles.domain),
  vertex("work-intake", cellValue("Work sensing + intake", "Work signals, use-case drafting/scoring, pattern marketplace"), 1180, 455, 420, 78, styles.domain),
  vertex("skill-runtime", cellValue("Skill, workflow, Harness, evals", "Skill specs, workflow graph, policy checks, run traces, eval artifacts"), 1180, 555, 420, 86, styles.domain),
  vertex("governance", cellValue("Governance + policy", "RBAC, policy engine, privacy lifecycle, tool approvals, launch readiness"), 1180, 665, 420, 78, styles.domain),
  vertex("runtime-control", cellValue("Runtime control plane", "Adapter contracts, import jobs, normalized runtime assets, graph drill-down"), 1180, 765, 420, 78, styles.domain),

  vertex("workspace-schema", cellValue("EnterpriseWorkspace schema", "Normalized source of truth: users, tools, sources, use cases, Skills, runs, reviews, evals, proof, adapters, reports"), 1710, 140, 340, 94, styles.data),
  vertex("repo", cellValue("WorkspaceRepository", "Postgres or tenant-scoped file implementation"), 1710, 260, 340, 76, styles.data),
  vertex("postgres", cellValue("Postgres durable store", "workspace_snapshots, audit_events, workflow_jobs, connector_events, tenant_secrets, run_traces, eval_artifacts, context_index_documents"), 1710, 360, 340, 112, styles.data),
  vertex("domain-projection", cellValue("Domain projection", "Query-friendly enterprise AI graph synced from workspace"), 1710, 500, 340, 76, styles.data),
  vertex("proof-ledger", cellValue("Proof + audit integrity", "Tamper-evident audit chain, evidence graph, proof packets, runtime import audits"), 1710, 600, 340, 94, styles.proof),
  vertex("file-fallback", cellValue("Local file fallback", ".data tenant JSON for development or emergency fallback"), 1710, 720, 340, 76, styles.data),

  vertex("llm-providers", cellValue("LLM providers", "OpenAI, Anthropic, Google, Azure, OpenRouter, local fallback, budget/router"), 2160, 140, 350, 86, styles.external),
  vertex("enterprise-apps", cellValue("Enterprise apps", "Slack, Teams, Jira, ServiceNow, M365, Google Workspace, Salesforce, GitHub, Azure DevOps, Snowflake, Databricks, SAP, NetSuite, HubSpot, Gong"), 2160, 260, 350, 112, styles.external),
  vertex("runtime-tools", cellValue("AI runtimes + observability", "Langfuse, LangSmith, Phoenix/OpenInference, OpenTelemetry, MCP brokers, custom runtimes"), 2160, 410, 350, 94, styles.external),
  vertex("identity", cellValue("Identity + directories", "OIDC, SCIM/provisioning, role groups, reviewers, owners"), 2160, 540, 350, 76, styles.external),
  vertex("delivery", cellValue("Delivery targets", "Slack, email, PDF, in-app inbox, board packets, collateral exports"), 2160, 640, 350, 76, styles.external),

  edge("e-users-shell", "users", "app-shell", "use"),
  edge("e-office-views", "ai-office", "views", "operate"),
  edge("e-audit-proof", "auditors", "proof-ledger", "review"),
  edge("e-shell-router", "app-shell", "view-router"),
  edge("e-router-views", "view-router", "views"),
  edge("e-views-state", "views", "client-state", "mutate local state"),
  edge("e-state-workspace", "client-state", "workspace-api", "debounced save"),
  edge("e-views-commands", "views", "commands-api", "actions"),
  edge("e-assistant-api", "assistant-ui", "orchestrator-api", "ask / act"),
  edge("e-api-command-runtime", "commands-api", "workspace-command-runtime"),
  edge("e-orch-runtime", "orchestrator-api", "orchestrator-runtime"),
  edge("e-orch-llm", "orchestrator-runtime", "llm-providers", "route model"),
  edge("e-runtime-domain", "workspace-command-runtime", "work-intake"),
  edge("e-command-skill", "workspace-command-runtime", "skill-runtime"),
  edge("e-command-gov", "workspace-command-runtime", "governance"),
  edge("e-command-runtime-control", "workspace-command-runtime", "runtime-control"),
  edge("e-domain-api-domain", "domain-apis", "operating-intel"),
  edge("e-domain-schema", "operating-intel", "workspace-schema", "derive from"),
  edge("e-work-schema", "work-intake", "workspace-schema"),
  edge("e-skill-schema", "skill-runtime", "workspace-schema"),
  edge("e-gov-proof", "governance", "proof-ledger", "decisions", styles.proofEdge),
  edge("e-runtime-proof", "runtime-control", "proof-ledger", "imports", styles.proofEdge),
  edge("e-schema-repo", "workspace-schema", "repo"),
  edge("e-repo-postgres", "repo", "postgres", "primary"),
  edge("e-repo-file", "repo", "file-fallback", "fallback"),
  edge("e-postgres-projection", "postgres", "domain-projection", "sync"),
  edge("e-connector-apps", "connector-apis", "enterprise-apps", "execute/readiness"),
  edge("e-connectors-proof", "connector-apis", "proof-ledger", "events", styles.proofEdge),
  edge("e-runtime-external", "runtime-control", "runtime-tools", "import telemetry"),
  edge("e-auth-identity", "auth", "identity", "trust"),
  edge("e-domain-delivery", "domain-apis", "delivery", "reports/collateral"),
  edge("e-client-fallback", "client-state", "offline-sync"),
];

const flowCells = [
  vertex("flow-title", "<b>Enterprise AI Enablement OS Runtime + Proof Flows</b><br><font style=\"font-size:12px;color:#64748b\">How demand, assistant actions, connectors, runtime telemetry, evidence, and reports move through the system.</font>", 30, 10, 720, 60, "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=none;fontColor=#0f172a;align=left;verticalAlign=middle;"),

  vertex("f1-start", cellValue("1. Demand signal", "Work pain, stakeholder note, ticket pattern, assistant prompt"), 60, 120, 230, 70, styles.actor),
  vertex("f1-intake", cellValue("Use Case Factory", "Draft, score, assign owner, capture risks and value"), 340, 120, 240, 70, styles.ui),
  vertex("f1-skill", cellValue("Governed Skill", "Prompt contract, tools, context, autonomy tier, budget"), 630, 120, 240, 70, styles.domain),
  vertex("f1-harness", cellValue("Harness + evals", "Run traces, tool requests, test results, failure evidence"), 920, 120, 240, 70, styles.domain),
  vertex("f1-gov", cellValue("Risk review + launch", "Human decision, launch gate, rollout checklist"), 1210, 120, 240, 70, styles.domain),
  vertex("f1-proof", cellValue("Proof Ledger", "Audit-ready evidence, packets, launch proof"), 1500, 120, 240, 70, styles.proof),
  edge("f1-e1", "f1-start", "f1-intake"),
  edge("f1-e2", "f1-intake", "f1-skill"),
  edge("f1-e3", "f1-skill", "f1-harness"),
  edge("f1-e4", "f1-harness", "f1-gov"),
  edge("f1-e5", "f1-gov", "f1-proof", "proof", styles.proofEdge),

  vertex("f2-assistant", cellValue("2. Assistant request", "Ask questions, get metrics, open views, run product actions"), 60, 270, 230, 80, styles.actor),
  vertex("f2-orch", cellValue("Orchestrator planner", "Workspace context, meta-reasoning, action candidates"), 340, 270, 240, 80, styles.api),
  vertex("f2-command", cellValue("Workspace command runtime", "Durable actions with rollback token and audit log"), 630, 270, 240, 80, styles.domain),
  vertex("f2-state", cellValue("Workspace state", "Normalized EnterpriseWorkspace snapshot"), 920, 270, 240, 80, styles.data),
  vertex("f2-ui", cellValue("Updated UI + next action", "Toast, route, rows, cards, assistant transcript"), 1210, 270, 240, 80, styles.ui),
  edge("f2-e1", "f2-assistant", "f2-orch"),
  edge("f2-e2", "f2-orch", "f2-command"),
  edge("f2-e3", "f2-command", "f2-state"),
  edge("f2-e4", "f2-state", "f2-ui"),
  edge("f2-e5", "f2-command", "f1-proof", "audit/proof", styles.proofEdge),

  vertex("f3-connect", cellValue("3. Connect runtime", "Langfuse, LangSmith, Phoenix, OTel, MCP Broker, custom"), 60, 430, 230, 80, styles.external),
  vertex("f3-contract", cellValue("Adapter manifest", "Required fields, mappings, imports, evidence created"), 340, 430, 240, 80, styles.domain),
  vertex("f3-test", cellValue("Test + preview import", "Connection proof, discovered assets, preview IDs"), 630, 430, 240, 80, styles.api),
  vertex("f3-assets", cellValue("Normalized runtime assets", "Traces, evals, tool calls, prompts, costs, owners"), 920, 430, 240, 80, styles.data),
  vertex("f3-estate", cellValue("AI Estate drill-down", "Coverage, gaps, owners, evidence, packs, schedules"), 1210, 430, 240, 80, styles.ui),
  edge("f3-e1", "f3-connect", "f3-contract"),
  edge("f3-e2", "f3-contract", "f3-test"),
  edge("f3-e3", "f3-test", "f3-assets"),
  edge("f3-e4", "f3-assets", "f3-estate"),
  edge("f3-e5", "f3-test", "f1-proof", "proof-first import", styles.proofEdge),

  vertex("f4-run", cellValue("4. Connector action", "Skill run or assistant command needs an external system"), 60, 590, 230, 80, styles.domain),
  vertex("f4-policy", cellValue("Policy + broker", "Risk, approval, payload safety, connector envelope"), 340, 590, 240, 80, styles.api),
  vertex("f4-ext", cellValue("Enterprise app", "Slack, Jira, ServiceNow, M365, Salesforce, GitHub, data platforms"), 630, 590, 240, 80, styles.external),
  vertex("f4-events", cellValue("Connector events", "Decision, payload summary, envelope, status"), 920, 590, 240, 80, styles.data),
  vertex("f4-audit", cellValue("Audit trail", "Tool requested, approved/rejected, executed, redacted evidence"), 1210, 590, 240, 80, styles.proof),
  edge("f4-e1", "f4-run", "f4-policy"),
  edge("f4-e2", "f4-policy", "f4-ext"),
  edge("f4-e3", "f4-ext", "f4-events"),
  edge("f4-e4", "f4-events", "f4-audit", "proof", styles.proofEdge),

  vertex("f5-schedule", cellValue("5. Scheduled reporting", "Daily digest, weekly exec brief, governance alerts, board summary"), 60, 750, 230, 80, styles.domain),
  vertex("f5-report", cellValue("Report generator", "Metrics, proof gaps, source packet, model route or deterministic fallback"), 340, 750, 240, 80, styles.api),
  vertex("f5-evidence", cellValue("Evidence packet", "Use cases, Skills, traces, evals, approvals, ROI, risks"), 630, 750, 240, 80, styles.proof),
  vertex("f5-delivery", cellValue("Delivery", "In-app inbox, Slack, email, PDF, board packet"), 920, 750, 240, 80, styles.external),
  vertex("f5-loop", cellValue("Operating loop", "New decisions become command orders and proof obligations"), 1210, 750, 240, 80, styles.domain),
  edge("f5-e1", "f5-schedule", "f5-report"),
  edge("f5-e2", "f5-report", "f5-evidence"),
  edge("f5-e3", "f5-evidence", "f5-delivery"),
  edge("f5-e4", "f5-delivery", "f5-loop"),
  edge("f5-e5", "f5-loop", "f1-start", "next work"),
];

const modified = new Date().toISOString();
const drawio = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${modified}" agent="Codex" version="24.7.17" type="device">
  <diagram id="enterprise-os-system" name="System Architecture">
${modelXml(architectureCells, { dx: 2600, dy: 1200, width: 2600, height: 920 })}
  </diagram>
  <diagram id="enterprise-os-flows" name="Runtime + Proof Flows">
${modelXml(flowCells, { dx: 1900, dy: 1050, width: 1800, height: 900 })}
  </diagram>
</mxfile>
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, drawio, "utf8");
console.log(outputPath);
