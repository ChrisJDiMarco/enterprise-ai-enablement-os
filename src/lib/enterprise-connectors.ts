import { tenantSecretRuntimeValueIsUsable } from "./tenant-secret-format.ts";

export type ConnectorReadinessStatus = "ready" | "partial" | "missing" | "broker-managed";

export type EnterpriseConnectorId =
  | "slack"
  | "microsoft_365"
  | "jira"
  | "service_now"
  | "sharepoint"
  | "workday"
  | "google_workspace"
  | "confluence"
  | "salesforce"
  | "github"
  | "azure_devops"
  | "zendesk"
  | "snowflake"
  | "databricks"
  | "sap"
  | "netsuite"
  | "hubspot"
  | "gong"
  | "langfuse"
  | "langsmith"
  | "arize_phoenix"
  | "braintrust";

export type EnterpriseConnectorDefinition = {
  id: EnterpriseConnectorId;
  label: string;
  system: string;
  category:
    | "collaboration"
    | "ticketing"
    | "knowledge"
    | "hris"
    | "identity"
    | "crm"
    | "source_control"
    | "support"
    | "data_warehouse"
    | "lakehouse"
    | "erp"
    | "revenue"
    | "observability"
    | "evals";
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
  brokerUrlConfigured: boolean;
  brokerAuthenticated: boolean;
  brokerMissingSecretNames: string[];
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
  {
    id: "confluence",
    label: "Confluence",
    system: "Atlassian Confluence",
    category: "knowledge",
    requiredSecretNames: ["CONFLUENCE_BASE_URL", "CONFLUENCE_EMAIL", "CONFLUENCE_API_TOKEN"],
    optionalSecretNames: ["CONFLUENCE_SPACE_ALLOWLIST"],
    requiredScopes: ["read:confluence-content.summary", "read:confluence-space.summary", "search:confluence"],
    capabilities: ["Decision-page grounding", "project context retrieval", "space-level source catalog", "page citations"],
    productionUse: "Ground agents in project decisions, runbooks, specs, and team knowledge without breaking source ownership.",
    setupAction: "Create an Atlassian API token or OAuth app, restrict access to approved Confluence spaces, and preserve page citations.",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    system: "Salesforce Platform",
    category: "crm",
    requiredSecretNames: ["SALESFORCE_INSTANCE_URL", "SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
    optionalSecretNames: ["SALESFORCE_REFRESH_TOKEN"],
    requiredScopes: ["api", "refresh_token"],
    capabilities: ["Account context", "opportunity signals", "case-to-value evidence", "approval-gated CRM updates"],
    productionUse: "Tie AI work to revenue, customer context, forecast risk, and approved CRM actions.",
    setupAction: "Create a Salesforce connected app, approve least-privilege object access, and gate all writes through Broker policy.",
  },
  {
    id: "github",
    label: "GitHub",
    system: "GitHub Enterprise Cloud",
    category: "source_control",
    requiredSecretNames: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET"],
    optionalSecretNames: ["GITHUB_INSTALLATION_ID"],
    requiredScopes: ["metadata:read", "contents:read", "issues:write", "pull_requests:read"],
    capabilities: ["Codebase context", "issue creation", "pull request evidence", "engineering adoption signals"],
    productionUse: "Connect AI Skills to engineering work while preserving repository permissions, review gates, and traceability.",
    setupAction: "Install a GitHub App on approved organizations/repositories and route write actions through human approval.",
  },
  {
    id: "azure_devops",
    label: "Azure DevOps",
    system: "Azure DevOps",
    category: "source_control",
    requiredSecretNames: ["AZURE_DEVOPS_ORG_URL", "AZURE_DEVOPS_CLIENT_ID", "AZURE_DEVOPS_CLIENT_SECRET"],
    optionalSecretNames: ["AZURE_DEVOPS_PROJECT_ALLOWLIST"],
    requiredScopes: ["vso.code", "vso.work", "vso.project"],
    capabilities: ["Repo context", "work item signals", "delivery status", "release readiness evidence"],
    productionUse: "Support enterprises whose engineering work lives in Azure Boards, Repos, Pipelines, and project portfolios.",
    setupAction: "Register an Azure DevOps OAuth app or service principal and restrict code/work item access to approved projects.",
  },
  {
    id: "zendesk",
    label: "Zendesk",
    system: "Zendesk Support",
    category: "support",
    requiredSecretNames: ["ZENDESK_SUBDOMAIN", "ZENDESK_EMAIL", "ZENDESK_API_TOKEN"],
    optionalSecretNames: ["ZENDESK_BRAND_ALLOWLIST"],
    requiredScopes: ["tickets:read", "tickets:write", "users:read", "help_center:read"],
    capabilities: ["Support demand signals", "ticket triage", "help center grounding", "customer friction evidence"],
    productionUse: "Turn support volume into AI use cases, governed agent actions, and measurable customer-value proof.",
    setupAction: "Create a Zendesk API token or OAuth client, restrict brands/groups, and require approval for external ticket replies.",
  },
  {
    id: "snowflake",
    label: "Snowflake",
    system: "Snowflake Cortex / Data Cloud",
    category: "data_warehouse",
    requiredSecretNames: ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PRIVATE_KEY", "SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_DATABASE"],
    optionalSecretNames: ["SNOWFLAKE_ROLE", "SNOWFLAKE_MCP_SERVER_URL"],
    requiredScopes: ["USAGE", "SELECT", "CORTEX_AGENT_EXECUTE"],
    capabilities: ["Governed analytics", "metric baselines", "Cortex agent tools", "warehouse evidence"],
    productionUse: "Use governed enterprise data for business metrics, ROI evidence, and agent actions through approved data boundaries.",
    setupAction: "Create a dedicated service user/role, grant least-privilege warehouse/database access, and record query/tool evidence.",
  },
  {
    id: "databricks",
    label: "Databricks",
    system: "Databricks Lakehouse",
    category: "lakehouse",
    requiredSecretNames: ["DATABRICKS_WORKSPACE_URL", "DATABRICKS_CLIENT_ID", "DATABRICKS_CLIENT_SECRET"],
    optionalSecretNames: ["DATABRICKS_SQL_WAREHOUSE_ID", "DATABRICKS_CATALOG_ALLOWLIST"],
    requiredScopes: ["sql:read", "unity-catalog:read", "jobs:run", "mlflow:read"],
    capabilities: ["Unity Catalog context", "SQL insight retrieval", "MLflow evidence", "lakehouse workflow actions"],
    productionUse: "Connect governed lakehouse assets, ML/AI traces, and analytics workflows to launch evidence and operating metrics.",
    setupAction: "Create a Databricks service principal, bind workspace/catalog permissions, and preserve SQL/job/run metadata as proof.",
  },
  {
    id: "sap",
    label: "SAP",
    system: "SAP S/4HANA / BTP",
    category: "erp",
    requiredSecretNames: ["SAP_BASE_URL", "SAP_CLIENT_ID", "SAP_CLIENT_SECRET"],
    optionalSecretNames: ["SAP_TENANT_ID", "SAP_SCOPE_ALLOWLIST"],
    requiredScopes: ["business-partner.read", "finance.read", "procurement.read"],
    capabilities: ["Finance context", "procurement signals", "business partner lookup", "ERP approval evidence"],
    productionUse: "Bring enterprise finance, procurement, and operations context into AI planning without bypassing ERP controls.",
    setupAction: "Register a BTP/OAuth client, start with read-only APIs, and require finance/security approval before any write path.",
  },
  {
    id: "netsuite",
    label: "NetSuite",
    system: "Oracle NetSuite",
    category: "erp",
    requiredSecretNames: ["NETSUITE_ACCOUNT_ID", "NETSUITE_CONSUMER_KEY", "NETSUITE_CONSUMER_SECRET", "NETSUITE_TOKEN_ID", "NETSUITE_TOKEN_SECRET"],
    optionalSecretNames: ["NETSUITE_ROLE_ID"],
    requiredScopes: ["transactions.read", "vendors.read", "items.read"],
    capabilities: ["Finance operations context", "vendor signals", "transaction evidence", "approval-ready ERP handoffs"],
    productionUse: "Support finance and operations AI use cases for companies running NetSuite without granting broad ERP automation.",
    setupAction: "Create a token-based integration role with read-first permissions and isolate any transaction writes behind approvals.",
  },
  {
    id: "hubspot",
    label: "HubSpot",
    system: "HubSpot CRM",
    category: "crm",
    requiredSecretNames: ["HUBSPOT_PRIVATE_APP_TOKEN"],
    optionalSecretNames: ["HUBSPOT_PIPELINE_ALLOWLIST"],
    requiredScopes: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read", "tickets"],
    capabilities: ["CRM signals", "marketing handoffs", "deal context", "ticket-to-revenue evidence"],
    productionUse: "Give mid-market teams CRM, marketing, and service context when Salesforce is not the system of record.",
    setupAction: "Create a HubSpot private app with read-first CRM scopes and route any object updates through Broker approval.",
  },
  {
    id: "gong",
    label: "Gong",
    system: "Gong Revenue Intelligence",
    category: "revenue",
    requiredSecretNames: ["GONG_ACCESS_KEY", "GONG_ACCESS_KEY_SECRET"],
    optionalSecretNames: ["GONG_WORKSPACE_ALLOWLIST"],
    requiredScopes: ["calls:read", "users:read", "crm:read"],
    capabilities: ["Call intelligence", "revenue signals", "customer-objection patterns", "enablement feedback loops"],
    productionUse: "Capture sales and customer conversation patterns as safe work signals for enablement and value measurement.",
    setupAction: "Create a Gong API client, restrict call access by workspace/team, and redact customer-sensitive transcript data.",
  },
  {
    id: "langfuse",
    label: "Langfuse",
    system: "Langfuse",
    category: "observability",
    requiredSecretNames: ["LANGFUSE_BASE_URL", "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"],
    optionalSecretNames: ["LANGFUSE_PROJECT_ID"],
    requiredScopes: ["traces:read", "scores:read", "datasets:read", "projects:read"],
    capabilities: ["LLM traces", "prompt versions", "cost telemetry", "quality score evidence"],
    productionUse: "Import AI runtime traces, prompt history, scores, and costs into the Evidence Ledger and launch gates.",
    setupAction: "Create project-scoped API keys and map trace IDs, prompt versions, scores, and cost fields to the evidence schema.",
  },
  {
    id: "langsmith",
    label: "LangSmith",
    system: "LangSmith",
    category: "observability",
    requiredSecretNames: ["LANGSMITH_API_KEY", "LANGSMITH_WORKSPACE_ID"],
    optionalSecretNames: ["LANGSMITH_PROJECT"],
    requiredScopes: ["runs:read", "datasets:read", "feedback:read", "experiments:read"],
    capabilities: ["Agent traces", "dataset-backed evals", "feedback signals", "regression evidence"],
    productionUse: "Bring development and production agent traces into the same readiness, eval, and proof loop.",
    setupAction: "Create a workspace API key, select approved projects/datasets, and map run IDs to Skills and launch packets.",
  },
  {
    id: "arize_phoenix",
    label: "Arize Phoenix",
    system: "Arize Phoenix / OpenInference",
    category: "observability",
    requiredSecretNames: ["PHOENIX_BASE_URL", "PHOENIX_API_KEY"],
    optionalSecretNames: ["PHOENIX_PROJECT_ID"],
    requiredScopes: ["traces:read", "datasets:read", "evals:read"],
    capabilities: ["OpenInference traces", "retrieval quality", "drift signals", "eval evidence"],
    productionUse: "Connect open telemetry and evaluation traces so AI quality issues become visible before rollout expands.",
    setupAction: "Create a Phoenix API key, select approved projects, and map traces/evals to governed Skills and evidence items.",
  },
  {
    id: "braintrust",
    label: "Braintrust",
    system: "Braintrust",
    category: "evals",
    requiredSecretNames: ["BRAINTRUST_API_KEY", "BRAINTRUST_PROJECT_ID"],
    optionalSecretNames: ["BRAINTRUST_ORG_ID"],
    requiredScopes: ["experiments:read", "datasets:read", "logs:read"],
    capabilities: ["Eval experiments", "dataset quality", "release gates", "prompt regression evidence"],
    productionUse: "Connect AI evaluation experiments and release gates to enterprise launch proof and regression monitoring.",
    setupAction: "Create project-scoped API access, bind experiments to Skills, and require passing eval evidence before launch.",
  },
];

const tenantSecretNamePattern = /^[A-Z0-9_]{2,120}$/;

function canonicalSecretName(value: string) {
  const normalized = value.trim().toUpperCase();
  return tenantSecretNamePattern.test(normalized) ? normalized : "";
}

function canonicalSecretNameSet(values: string[]) {
  return new Set(values.map(canonicalSecretName).filter(Boolean));
}

function hasSecret(env: RuntimeEnv, configuredSecretNames: Set<string>, name: string) {
  return tenantSecretRuntimeValueIsUsable(name, env[name]) || configuredSecretNames.has(name);
}

function brokerMode(env: RuntimeEnv, configuredSecretNames: Set<string>): ConnectorReadinessSummary["brokerMode"] {
  if (hasSecret(env, configuredSecretNames, "MCP_BROKER_URL")) return "mcp-broker";
  if (hasSecret(env, configuredSecretNames, "CONNECTOR_BROKER_URL")) return "connector-broker";
  return "policy-only";
}

function brokerSecretNamesForMode(mode: ConnectorReadinessSummary["brokerMode"]) {
  if (mode === "mcp-broker") return ["MCP_BROKER_TOKEN", "CONNECTOR_BROKER_TOKEN"];
  if (mode === "connector-broker") return ["CONNECTOR_BROKER_TOKEN"];
  return [];
}

export function getEnterpriseConnectorReadiness(
  env: RuntimeEnv = process.env,
  configuredSecretNames: string[] = [],
): ConnectorReadinessSummary {
  const secretNames = canonicalSecretNameSet(configuredSecretNames);
  const mode = brokerMode(env, secretNames);
  const brokerUrlConfigured = mode !== "policy-only";
  const brokerSecretNames = brokerSecretNamesForMode(mode);
  const brokerAuthenticated =
    brokerSecretNames.length > 0 &&
    brokerSecretNames.some((name) => hasSecret(env, secretNames, name));
  const brokerMissingSecretNames = brokerUrlConfigured && !brokerAuthenticated ? brokerSecretNames : [];
  const brokerConfigured = brokerUrlConfigured && brokerAuthenticated;

  const connectors = enterpriseConnectorRegistry.map((connector): EnterpriseConnectorReadiness => {
    const allSecretNames = [...connector.requiredSecretNames, ...(connector.optionalSecretNames ?? [])];
    const configuredSecrets = allSecretNames.filter((name) => hasSecret(env, secretNames, name));
    const configuredRequiredSecrets = connector.requiredSecretNames.filter((name) => hasSecret(env, secretNames, name));
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
        status: configuredRequiredSecrets.length || brokerUrlConfigured ? "complete" : "pending",
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
            : brokerUrlConfigured
              ? `Broker URL is configured but authentication is missing. Store ${brokerMissingSecretNames.join(" or ")} before using external connector execution.`
            : `Store required secrets: ${missingSecrets.join(", ")}.`,
      },
      {
        id: "read-test",
        label: "Test approved read path",
        status: readTested ? "complete" : "pending",
        owner: "Integrations",
        action: "Run a safe read-only connector smoke through the native route or broker and preserve the response metadata as evidence.",
      },
      {
        id: "action-gate",
        label: "Test write/action approval gate",
        status: actionGateTested ? "complete" : "pending",
        owner: "Governance",
        action: "Trigger a gated create/update/send request and confirm it pauses for human approval before execution.",
      },
      {
        id: "evidence",
        label: "Capture evidence ledger event",
        status: evidenceTested ? "complete" : "pending",
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
    brokerUrlConfigured,
    brokerAuthenticated,
    brokerMissingSecretNames,
    brokerMode: mode,
    readyCount,
    partialCount,
    missingCount,
    requiredCount: enterpriseConnectorRegistry.length,
    productionReady: brokerConfigured || readyCount >= 2,
    connectors,
  };
}
