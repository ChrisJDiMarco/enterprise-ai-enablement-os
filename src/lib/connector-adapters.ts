import type { ConnectorExecutionRequest } from "./connector-broker.ts";

export type ConnectorRuntimeSecrets = Record<string, string | undefined>;

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
  return names.every((name) => Boolean(secrets[name]?.trim()));
}

async function postJson<T>(url: string, init: RequestInit, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as JsonRecord;
    if (!response.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : `${response.status} ${response.statusText}`);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function getMicrosoftGraphToken(secrets: ConnectorRuntimeSecrets) {
  const tenantId = secrets.MS_GRAPH_TENANT_ID;
  const clientId = secrets.MS_GRAPH_CLIENT_ID;
  const clientSecret = secrets.MS_GRAPH_CLIENT_SECRET;
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
    const response = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });
    const output = (await response.json().catch(() => ({}))) as JsonRecord;
    return { handled: true, status: response.ok ? "executed" : "blocked", connectorId: "jira", output };
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
  if (!hasSecrets(secrets, ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET"])) {
    return {
      handled: true,
      status: "blocked",
      connectorId: "microsoft_365",
      output: { message: "MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, and MS_GRAPH_CLIENT_SECRET are required for Microsoft Graph execution." },
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
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify((request.payload.body as JsonRecord | undefined) ?? {}),
  });
  const output = (await response.json().catch(() => ({}))) as JsonRecord;
  return { handled: true, status: response.ok ? "executed" : "blocked", connectorId: "microsoft_365", output };
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
