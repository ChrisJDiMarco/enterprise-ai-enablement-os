import type { ConnectorExecutionRequest } from "./connector-broker.ts";
import { tenantSecretRuntimeValueIsUsable } from "./tenant-secret-format.ts";

export type ConnectorRuntimeSecrets = Record<string, string | undefined>;

/**
 * Connector ids that have a real, executing native adapter in this module.
 * Readiness MUST NOT report a connector as natively "ready" unless it is in this
 * set — otherwise the UI claims a connector can act when execution would only be
 * simulated. SharePoint shares the Microsoft Graph adapter.
 */
export const NATIVE_ADAPTER_CONNECTOR_IDS: ReadonlySet<string> = new Set([
  "slack",
  "jira",
  "service_now",
  "microsoft_365",
  "sharepoint",
]);

/** Microsoft Graph credentials, accepting SharePoint-prefixed secrets as a fallback. */
function microsoftGraphCredentials(secrets: ConnectorRuntimeSecrets) {
  return {
    tenantId: secrets.MS_GRAPH_TENANT_ID || secrets.SHAREPOINT_TENANT_ID || "",
    clientId: secrets.MS_GRAPH_CLIENT_ID || secrets.SHAREPOINT_CLIENT_ID || "",
    clientSecret: secrets.MS_GRAPH_CLIENT_SECRET || secrets.SHAREPOINT_CLIENT_SECRET || "",
  };
}

export type NativeConnectorResult = {
  handled: boolean;
  status: "executed" | "blocked";
  connectorId?: string;
  output: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

function stringValue(payload: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toolNamespace(toolId: string) {
  return toolId.split(/[.:]/)[0]?.toLowerCase() ?? "";
}

function hasSecrets(secrets: ConnectorRuntimeSecrets, names: string[]) {
  return names.every((name) => tenantSecretRuntimeValueIsUsable(name, secrets[name]));
}

async function requestJson<T>(url: string, init: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as JsonRecord;
    return { response, payload: payload as T };
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson<T>(url: string, init: RequestInit, timeoutMs = 30_000): Promise<T> {
  const { response, payload } = await requestJson<T>(url, init, timeoutMs);
  if (!response.ok) {
    const errorPayload = payload as JsonRecord;
    throw new Error(typeof errorPayload.error === "string" ? errorPayload.error : `${response.status} ${response.statusText}`);
  }
  return payload;
}

async function getMicrosoftGraphToken(secrets: ConnectorRuntimeSecrets) {
  const { tenantId, clientId, clientSecret } = microsoftGraphCredentials(secrets);
  if (!tenantId || !clientId || !clientSecret) return "";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const payload = await postJson<{ access_token?: string }>(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  return payload.access_token ?? "";
}

async function executeSlack(request: ConnectorExecutionRequest, secrets: ConnectorRuntimeSecrets): Promise<NativeConnectorResult> {
  if (!hasSecrets(secrets, ["SLACK_BOT_TOKEN"])) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "slack",
      output: { message: "SLACK_BOT_TOKEN is required for native Slack execution." },
    };
  }

  const channel = stringValue(request.payload, ["channel", "channelId"]);
  const text = stringValue(request.payload, ["text", "message", "body"]);
  if (!channel || !text) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "slack",
      output: { message: "Slack execution requires channel and text payload fields." },
    };
  }

  const output = await postJson<JsonRecord>("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secrets.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });

  return { handled: true, status: output.ok === false ? "blocked" : "executed", connectorId: "slack", output };
}

async function executeJira(request: ConnectorExecutionRequest, secrets: ConnectorRuntimeSecrets): Promise<NativeConnectorResult> {
  if (!hasSecrets(secrets, ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"])) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "jira",
      output: { message: "JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN are required for native Jira execution." },
    };
  }

  const baseUrl = secrets.JIRA_BASE_URL!.replace(/\/$/, "");
  const auth = Buffer.from(`${secrets.JIRA_EMAIL}:${secrets.JIRA_API_TOKEN}`).toString("base64");
  const summary = stringValue(request.payload, ["summary", "title"]);
  const projectKey = stringValue(request.payload, ["projectKey", "project"]);
  const issueType = stringValue(request.payload, ["issueType", "type"]) || "Task";
  const description = stringValue(request.payload, ["description", "body"]) || summary;
  const issueKey = stringValue(request.payload, ["issueKey", "key"]);

  if (request.toolId.includes("read") && issueKey) {
    const { response, payload } = await requestJson<JsonRecord>(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });
    return { handled: true, status: response.ok ? "executed" : "blocked", connectorId: "jira", output: payload };
  }

  if (!summary || !projectKey) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "jira",
      output: { message: "Jira issue creation requires projectKey and summary payload fields." },
    };
  }

  const output = await postJson<JsonRecord>(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        },
      },
    }),
  });
  return { handled: true, status: "executed", connectorId: "jira", output };
}

async function executeServiceNow(request: ConnectorExecutionRequest, secrets: ConnectorRuntimeSecrets): Promise<NativeConnectorResult> {
  if (!hasSecrets(secrets, ["SERVICENOW_INSTANCE_URL", "SERVICENOW_CLIENT_ID", "SERVICENOW_CLIENT_SECRET"])) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "service_now",
      output: {
        message: "SERVICENOW_INSTANCE_URL, SERVICENOW_CLIENT_ID, and SERVICENOW_CLIENT_SECRET are required for native ServiceNow execution.",
      },
    };
  }

  const instanceUrl = secrets.SERVICENOW_INSTANCE_URL!.replace(/\/$/, "");
  const table = stringValue(request.payload, ["table"]) || "incident";
  const shortDescription = stringValue(request.payload, ["short_description", "summary", "title"]);
  if (!shortDescription) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "service_now",
      output: { message: "ServiceNow create requires short_description, summary, or title." },
    };
  }

  const tokenPayload = await postJson<{ access_token?: string }>(`${instanceUrl}/oauth_token.do`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: secrets.SERVICENOW_CLIENT_ID!,
      client_secret: secrets.SERVICENOW_CLIENT_SECRET!,
    }),
  });
  if (!tokenPayload.access_token) {
    return { handled: true, status: "blocked", connectorId: "service_now", output: { message: "ServiceNow token request failed." } };
  }

  const output = await postJson<JsonRecord>(`${instanceUrl}/api/now/table/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      short_description: shortDescription,
      description: stringValue(request.payload, ["description", "body"]) || shortDescription,
      urgency: stringValue(request.payload, ["urgency"]) || "3",
      impact: stringValue(request.payload, ["impact"]) || "3",
    }),
  });
  return { handled: true, status: "executed", connectorId: "service_now", output };
}

async function executeMicrosoftGraph(request: ConnectorExecutionRequest, secrets: ConnectorRuntimeSecrets): Promise<NativeConnectorResult> {
  const credentials = microsoftGraphCredentials(secrets);
  if (!credentials.tenantId || !credentials.clientId || !credentials.clientSecret) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "microsoft_365",
      output: {
        message:
          "Microsoft Graph execution requires tenant id, client id, and client secret (MS_GRAPH_* or SHAREPOINT_* secrets).",
      },
    };
  }

  const token = await getMicrosoftGraphToken(secrets);
  if (!token) {
    return { handled: true, status: "blocked", connectorId: "microsoft_365", output: { message: "Microsoft Graph token request failed." } };
  }

  const endpoint = stringValue(request.payload, ["graphEndpoint", "endpoint"]);
  if (!endpoint || !endpoint.startsWith("/")) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "microsoft_365",
      output: { message: "Microsoft Graph execution requires a relative graphEndpoint payload such as /users?$top=1." },
    };
  }

  const method = (stringValue(request.payload, ["method"]) || "GET").toUpperCase();
  const { response, payload } = await requestJson<JsonRecord>(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify((request.payload.body as JsonRecord | undefined) ?? {}),
  });
  return { handled: true, status: response.ok ? "executed" : "blocked", connectorId: "microsoft_365", output: payload };
}

export async function executeNativeConnector(params: {
  request: ConnectorExecutionRequest;
  secrets?: ConnectorRuntimeSecrets;
}): Promise<NativeConnectorResult> {
  const namespace = toolNamespace(params.request.toolId);
  const secrets = params.secrets ?? {};

  if (namespace === "slack") return executeSlack(params.request, secrets);
  if (namespace === "jira") return executeJira(params.request, secrets);
  if (namespace === "service_now" || namespace === "servicenow") return executeServiceNow(params.request, secrets);
  if (namespace === "microsoft" || namespace === "msgraph" || namespace === "teams" || namespace === "sharepoint") {
    return executeMicrosoftGraph(params.request, secrets);
  }

  return {
    handled: false,
    status: "blocked",
    output: { message: "No native connector adapter matched this tool request." },
  };
}
