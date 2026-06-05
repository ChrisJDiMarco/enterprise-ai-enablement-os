export type ConnectorReadinessStatus = "ready" | "partial" | "missing" | "broker-managed";

export type EnterpriseConnectorId =
  | "slack"
  | "microsoft_365"
  | "jira"
  | "service_now"
  | "sharepoint"
  | "workday"
  | "google_workspace";

export type EnterpriseConnectorDefinition = {
  id: EnterpriseConnectorId;
  label: string;
  system: string;
  category: "collaboration" | "ticketing" | "knowledge" | "hris" | "identity";
  requiredSecretNames: string[];
  optionalSecretNames?: string[];
  requiredScopes: string[];
  capabilities: string[];
  productionUse: string;
  setupAction: string;
};

export type EnterpriseConnectorReadiness = EnterpriseConnectorDefinition & {
  status: ConnectorReadinessStatus;
  configuredSecrets: string[];
  missingSecrets: string[];
  executionMode: "native-secrets" | "external-broker" | "not-configured";
  activationState: "connected" | "broker-managed" | "partial" | "not-started";
  activationChecklist: {
    id: string;
    label: string;
    status: "complete" | "pending";
    owner: "Customer Admin" | "Security" | "Integrations" | "Governance";
    action: string;
  }[];
  nextActivationAction: string;
};

export type ConnectorReadinessSummary = {
  brokerConfigured: boolean;
  brokerMode: "mcp-broker" | "connector-broker" | "policy-only";
  readyCount: number;
  partialCount: number;
  missingCount: number;
  requiredCount: number;
  productionReady: boolean;
  connectors: EnterpriseConnectorReadiness[];
};

type RuntimeEnv = Record<string, string | undefined>;

export const enterpriseConnectorRegistry: EnterpriseConnectorDefinition[] = [
  {
    id: "slack",
    label: "Slack",
    system: "Slack Enterprise Grid",
    category: "collaboration",
    requiredSecretNames: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
    optionalSecretNames: ["SLACK_APP_TOKEN"],
    requiredScopes: ["channels:read", "chat:write", "users:read", "team:read"],
    capabilities: ["Signal ingestion", "AI office-hour routing", "internal draft replies", "approval notifications"],
    productionUse: "Capture aggregated work signals and deliver human-approved updates into Slack channels.",
    setupAction: "Create a Slack app, install it to the tenant workspace, and store the bot token and signing secret in the tenant vault.",
  },
  {
    id: "microsoft_365",
    label: "Microsoft 365 / Teams",
    system: "Microsoft Graph",
    category: "collaboration",
    requiredSecretNames: ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET"],
    optionalSecretNames: ["MS_GRAPH_WEBHOOK_SECRET"],
    requiredScopes: ["User.Read.All", "Group.Read.All", "TeamsActivity.Send", "Mail.ReadBasic", "Calendars.ReadWrite"],
    capabilities: ["Teams notifications", "calendar follow-ups", "identity metadata", "mail/calendar signals"],
    productionUse: "Use Graph as the primary enterprise identity and collaboration connector for Microsoft tenants.",
    setupAction: "Register an Azure app, approve least-privilege Graph scopes, and store tenant/client credentials server-side.",
  },
  {
    id: "jira",
    label: "Jira",
    system: "Atlassian Jira",
    category: "ticketing",
    requiredSecretNames: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    requiredScopes: ["read:jira-work", "write:jira-work"],
    capabilities: ["Ticket creation", "process bottleneck signals", "delivery status", "workflow handoffs"],
    productionUse: "Convert approved AI actions into traceable Jira work and learn from ticket patterns.",
    setupAction: "Create an Atlassian API token or OAuth app and bind Jira projects to approved functions.",
  },
  {
    id: "service_now",
    label: "ServiceNow",
    system: "ServiceNow",
    category: "ticketing",
    requiredSecretNames: ["SERVICENOW_INSTANCE_URL", "SERVICENOW_CLIENT_ID", "SERVICENOW_CLIENT_SECRET"],
    requiredScopes: ["incident.read", "incident.write", "catalog.read", "knowledge.read"],
    capabilities: ["IT/HR ticket triage", "case routing", "knowledge retrieval", "approval workflows"],
    productionUse: "Route bounded actions through ServiceNow with approval history and audit evidence.",
    setupAction: "Create an OAuth application in ServiceNow and restrict tables/actions to the approved catalog.",
  },
  {
    id: "sharepoint",
    label: "SharePoint",
    system: "SharePoint Online",
    category: "knowledge",
    requiredSecretNames: ["SHAREPOINT_TENANT_ID", "SHAREPOINT_CLIENT_ID", "SHAREPOINT_CLIENT_SECRET"],
    optionalSecretNames: ["SHAREPOINT_SITE_ALLOWLIST"],
    requiredScopes: ["Sites.Selected", "Files.Read.All"],
    capabilities: ["Policy retrieval", "document grounding", "source citations", "permission-aware indexing"],
    productionUse: "Ground Skills in approved documents while preserving Microsoft permission boundaries.",
    setupAction: "Register a SharePoint app with Sites.Selected and grant access only to approved policy/source sites.",
  },
  {
    id: "workday",
    label: "Workday",
    system: "Workday",
    category: "hris",
    requiredSecretNames: ["WORKDAY_TENANT_URL", "WORKDAY_CLIENT_ID", "WORKDAY_CLIENT_SECRET"],
    optionalSecretNames: ["WORKDAY_REPORT_OWNER"],
    requiredScopes: ["Human_Resources:read", "Workers:read", "Business_Process:read"],
    capabilities: ["Employee metadata lookup", "HR process signals", "manager hierarchy", "bounded HR escalations"],
    productionUse: "Support HR copilots and process redesign with read-only HRIS context and strict action gates.",
    setupAction: "Create an integration system user/OAuth client with read-only domains first; require legal/privacy approval for writes.",
  },
  {
    id: "google_workspace",
    label: "Google Workspace",
    system: "Google Workspace",
    category: "collaboration",
    requiredSecretNames: ["GOOGLE_WORKSPACE_CLIENT_ID", "GOOGLE_WORKSPACE_CLIENT_SECRET"],
    optionalSecretNames: ["GOOGLE_WORKSPACE_DELEGATED_ADMIN"],
    requiredScopes: ["drive.metadata.readonly", "drive.readonly", "calendar.events", "gmail.metadata"],
    capabilities: ["Drive source catalog", "calendar follow-ups", "workspace signals", "document grounding"],
    productionUse: "Connect companies that run Google Workspace for knowledge, calendar, and collaboration signals.",
    setupAction: "Create a Google Cloud OAuth app, approve restricted scopes, and use domain-wide delegation only after review.",
  },
];

function hasSecret(env: RuntimeEnv, configuredSecretNames: Set<string>, name: string) {
  return Boolean(env[name]?.trim()) || configuredSecretNames.has(name);
}

function brokerMode(env: RuntimeEnv): ConnectorReadinessSummary["brokerMode"] {
  if (env.MCP_BROKER_URL?.trim()) return "mcp-broker";
  if (env.CONNECTOR_BROKER_URL?.trim()) return "connector-broker";
  return "policy-only";
}

export function getEnterpriseConnectorReadiness(
  env: RuntimeEnv = process.env,
  configuredSecretNames: string[] = [],
): ConnectorReadinessSummary {
  const secretNames = new Set(configuredSecretNames);
  const mode = brokerMode(env);
  const brokerConfigured = mode !== "policy-only";

  const connectors = enterpriseConnectorRegistry.map((connector): EnterpriseConnectorReadiness => {
    const configuredSecrets = connector.requiredSecretNames.filter((name) => hasSecret(env, secretNames, name));
    const missingSecrets = connector.requiredSecretNames.filter((name) => !hasSecret(env, secretNames, name));
    const nativeReady = missingSecrets.length === 0;
    const status: ConnectorReadinessStatus = nativeReady
      ? "ready"
      : brokerConfigured
        ? "broker-managed"
        : configuredSecrets.length
          ? "partial"
          : "missing";
    const readTested = env[`CONNECTOR_${connector.id.toUpperCase()}_READ_TESTED`] === "true";
    const actionGateTested = env[`CONNECTOR_${connector.id.toUpperCase()}_ACTION_GATE_TESTED`] === "true";
    const evidenceTested = env[`CONNECTOR_${connector.id.toUpperCase()}_EVIDENCE_TESTED`] === "true";
    const activationState =
      status === "ready"
        ? "connected"
        : status === "broker-managed"
          ? "broker-managed"
          : status === "partial"
            ? "partial"
            : "not-started";
    const activationChecklist: EnterpriseConnectorReadiness["activationChecklist"] = [
      {
        id: "integration-app",
        label: "Create least-privilege integration app",
        status: configuredSecrets.length || brokerConfigured ? "complete" : "pending",
        owner: "Customer Admin",
        action: connector.setupAction,
      },
      {
        id: "secret-route",
        label: "Store secrets or broker route",
        status: nativeReady || brokerConfigured ? "complete" : "pending",
        owner: "Security",
        action: nativeReady
          ? "Native connector secrets are present."
          : brokerConfigured
            ? "External broker route is configured; confirm broker-owned secrets in the broker."
            : `Store required secrets: ${missingSecrets.join(", ")}.`,
      },
      {
        id: "read-test",
        label: "Test approved read path",
        status: nativeReady || brokerConfigured || readTested ? "complete" : "pending",
        owner: "Integrations",
        action: "Run a safe read-only connector smoke and preserve the response metadata as evidence.",
      },
      {
        id: "action-gate",
        label: "Test write/action approval gate",
        status: actionGateTested || brokerConfigured ? "complete" : "pending",
        owner: "Governance",
        action: "Trigger a gated create/update/send request and confirm it pauses for human approval before execution.",
      },
      {
        id: "evidence",
        label: "Capture evidence ledger event",
        status: evidenceTested || brokerConfigured ? "complete" : "pending",
        owner: "Governance",
        action: "Confirm policy decision, approval, external response metadata, and redaction state appear in Evidence Ledger.",
      },
    ];
    const nextActivationAction =
      activationChecklist.find((item) => item.status === "pending")?.action ??
      "Connector activation is complete. Keep scopes and evidence under recurring review.";

    return {
      ...connector,
      configuredSecrets,
      missingSecrets,
      status,
      executionMode: nativeReady ? "native-secrets" : brokerConfigured ? "external-broker" : "not-configured",
      activationState,
      activationChecklist,
      nextActivationAction,
    };
  });

  const readyCount = connectors.filter((connector) => connector.status === "ready" || connector.status === "broker-managed").length;
  const partialCount = connectors.filter((connector) => connector.status === "partial").length;
  const missingCount = connectors.filter((connector) => connector.status === "missing").length;

  return {
    brokerConfigured,
    brokerMode: mode,
    readyCount,
    partialCount,
    missingCount,
    requiredCount: enterpriseConnectorRegistry.length,
    productionReady: brokerConfigured || readyCount >= 2,
    connectors,
  };
}
