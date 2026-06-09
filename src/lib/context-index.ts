import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool } from "./database.ts";
import type { ContextSource, Skill } from "./enterprise-ai-data.ts";
import { retrieveContext, type RetrievalResult } from "./context-retrieval.ts";
import { tenantScopedJsonPath } from "./tenant-file-storage.ts";

export type ContextIngestionMethod = "manual" | "api_import" | "connector_sync" | "sync_worker" | "vector_store";
export type ContextIngestionStatus = "indexed" | "quarantined" | "failed";

export type ContextIndexDocumentInput = {
  id?: string;
  sourceId: string;
  sourceName: string;
  title: string;
  content: string;
  uri?: string;
  classification: ContextSource["classification"];
  ownerDepartment: string;
  ingestionMethod?: ContextIngestionMethod;
  ingestionStatus?: ContextIngestionStatus;
  indexedAt?: string;
  sourceUpdatedAt?: string;
  syncJobId?: string;
  checksum?: string;
  permissionHash?: string;
  metadata?: Record<string, unknown>;
};

export type ContextIndexDocument = Required<Omit<ContextIndexDocumentInput, "metadata" | "uri">> & {
  uri?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ContextIndexDocumentSourceIssue = {
  documentId?: string;
  sourceId: string;
  sourceName: string;
  field: "sourceId" | "sourceName" | "source";
  message: string;
};

export type ContextIndexStats = {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  quarantinedDocuments: number;
  manualDocuments: number;
  automatedDocuments: number;
  sources: {
    sourceId: string;
    sourceName: string;
    documents: number;
    indexedDocuments: number;
    failedDocuments: number;
    quarantinedDocuments: number;
    manualDocuments: number;
    automatedDocuments: number;
    ingestionMethods: ContextIngestionMethod[];
    latestStatus: ContextIngestionStatus;
    classification: string;
    lastUpdatedAt: string;
  }[];
};

export type ContextReadinessSummary = {
  totalDocuments: number;
  indexedSources: number;
  catalogSources: number;
  enabledSources: number;
  healthySources: number;
  attentionSources: number;
  staleSources: number;
  sensitiveSources: number;
  unindexedEnabledSources: number;
  indexedDocuments: number;
  failedDocuments: number;
  quarantinedDocuments: number;
  manualDocuments: number;
  automatedDocuments: number;
  staleAfterDays: number;
  latestIndexedAt?: string;
  oldestIndexedAt?: string;
};

export type ContextReadinessSummaryInput = {
  stats?: ContextIndexStats;
  sources?: ContextSource[];
  now?: Date | string;
  staleAfterDays?: number;
};

export const DEFAULT_CONTEXT_SOURCE_STALE_AFTER_DAYS = 30;

const indexDir = path.join(process.cwd(), ".data", "context-index");
const automatedIngestionMethods = new Set<ContextIngestionMethod>(["connector_sync", "sync_worker", "vector_store"]);

function indexPath(organizationId: string) {
  return tenantScopedJsonPath(indexDir, organizationId);
}

function terms(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
}

function scoreDocument(document: ContextIndexDocument, query: string, allowedSourceIds: Set<string>) {
  const queryTerms = terms(query);
  const text = `${document.title} ${document.content} ${document.sourceName} ${document.ownerDepartment}`.toLowerCase();
  const hits = queryTerms.filter((term) => text.includes(term)).length;
  const titleHits = queryTerms.filter((term) => document.title.toLowerCase().includes(term)).length;
  const sourceBoost = allowedSourceIds.has(document.sourceId.toLowerCase()) || allowedSourceIds.has(document.sourceName.toLowerCase()) ? 0.2 : 0;
  return Math.min(0.99, 0.35 + hits * 0.08 + titleHits * 0.12 + sourceBoost);
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function validTimestamp(value: string | undefined) {
  return Number.isFinite(Date.parse(value ?? "")) ? value : undefined;
}

function ingestionMethod(value: unknown): ContextIngestionMethod {
  return value === "api_import" ||
    value === "connector_sync" ||
    value === "sync_worker" ||
    value === "vector_store" ||
    value === "manual"
    ? value
    : "manual";
}

function ingestionStatus(value: unknown): ContextIngestionStatus {
  return value === "failed" || value === "quarantined" || value === "indexed" ? value : "indexed";
}

function isAutomatedDocument(document: Pick<ContextIndexDocument, "ingestionMethod">) {
  return automatedIngestionMethods.has(document.ingestionMethod);
}

export function contextSourceStaleAfterDaysFromEnv(env: Record<string, string | undefined> = process.env) {
  return positiveInteger(env.CONTEXT_SOURCE_STALE_AFTER_DAYS) ?? DEFAULT_CONTEXT_SOURCE_STALE_AFTER_DAYS;
}

function sourceKey(value: string) {
  return value.trim().toLowerCase();
}

export function resolveContextIndexDocumentSources(params: {
  sources: ContextSource[];
  documents: ContextIndexDocumentInput[];
}): { documents: ContextIndexDocumentInput[]; issues: ContextIndexDocumentSourceIssue[] } {
  const sourcesById = new Map(params.sources.map((source) => [sourceKey(source.id), source]));
  const sourcesByName = new Map(params.sources.map((source) => [sourceKey(source.name), source]));
  const issues: ContextIndexDocumentSourceIssue[] = [];

  const documents = params.documents.map((document) => {
    const requestedSourceId = document.sourceId.trim();
    const requestedSourceName = document.sourceName.trim();
    const sourceById = sourcesById.get(sourceKey(requestedSourceId));
    const sourceByName = sourcesByName.get(sourceKey(requestedSourceName));

    if (sourceById && sourceByName && sourceById.id !== sourceByName.id) {
      issues.push({
        documentId: document.id,
        sourceId: requestedSourceId,
        sourceName: requestedSourceName,
        field: "source",
        message: `Document source id ${requestedSourceId} and source name ${requestedSourceName} refer to different catalog sources.`,
      });
      return document;
    }

    const source = sourceById ?? sourceByName;
    if (!source) {
      issues.push({
        documentId: document.id,
        sourceId: requestedSourceId,
        sourceName: requestedSourceName,
        field: "sourceId",
        message: `No enabled context source matched ${requestedSourceId} or ${requestedSourceName}.`,
      });
      return document;
    }

    if (!source.enabled) {
      issues.push({
        documentId: document.id,
        sourceId: requestedSourceId,
        sourceName: requestedSourceName,
        field: "sourceId",
        message: `Context source ${source.name} is disabled and cannot accept indexed documents.`,
      });
      return document;
    }

    return {
      ...document,
      sourceId: source.id,
      sourceName: source.name,
      classification: source.classification,
      ownerDepartment: source.ownerDepartment,
    };
  });

  return { documents, issues };
}

function sensitiveClassification(classification: string) {
  return classification === "confidential" || classification === "restricted" || classification === "regulated";
}

function sourceIndexed(stats: ContextIndexStats | undefined, source: ContextSource) {
  const indexed = stats?.sources ?? [];
  const id = sourceKey(source.id);
  const name = sourceKey(source.name);
  return indexed.some((item) => sourceKey(item.sourceId) === id || sourceKey(item.sourceName) === name);
}

function staleByDate(value: string, nowMs: number, staleAfterDays: number) {
  const parsed = timestampMs(value);
  if (!Number.isFinite(parsed)) return false;
  return parsed <= nowMs - staleAfterDays * 24 * 60 * 60 * 1000;
}

export function deriveContextReadinessSummary(input: ContextReadinessSummaryInput = {}): ContextReadinessSummary {
  const stats = input.stats;
  const sources = input.sources ?? [];
  const parsedNowMs = input.now instanceof Date ? input.now.getTime() : Date.parse(input.now ?? new Date().toISOString());
  const nowMs = Number.isFinite(parsedNowMs) ? parsedNowMs : Date.now();
  const staleAfterDays = positiveInteger(input.staleAfterDays) ?? contextSourceStaleAfterDaysFromEnv();
  const indexedDates = (stats?.sources ?? []).map((source) => source.lastUpdatedAt).filter((value) => Number.isFinite(timestampMs(value)));
  const enabledSources = sources.filter((source) => source.enabled);
  const staleSources = sources.filter(
    (source) => source.health === "stale" || (source.enabled && staleByDate(source.lastIndexedAt, nowMs, staleAfterDays)),
  );
  const failedDocuments = stats?.failedDocuments ?? stats?.sources.reduce((total, source) => total + (source.failedDocuments ?? 0), 0) ?? 0;
  const quarantinedDocuments =
    stats?.quarantinedDocuments ?? stats?.sources.reduce((total, source) => total + (source.quarantinedDocuments ?? 0), 0) ?? 0;
  const indexedDocuments = stats?.indexedDocuments ?? Math.max(0, (stats?.totalDocuments ?? 0) - failedDocuments - quarantinedDocuments);
  const automatedDocuments =
    stats?.automatedDocuments ?? stats?.sources.reduce((total, source) => total + (source.automatedDocuments ?? 0), 0) ?? 0;
  const manualDocuments =
    stats?.manualDocuments ??
    stats?.sources.reduce((total, source) => total + (source.manualDocuments ?? 0), 0) ??
    Math.max(0, (stats?.totalDocuments ?? 0) - automatedDocuments);

  return {
    totalDocuments: stats?.totalDocuments ?? 0,
    indexedSources: stats?.sources.length ?? 0,
    catalogSources: sources.length,
    enabledSources: enabledSources.length,
    healthySources: sources.filter((source) => source.enabled && source.health === "healthy").length,
    attentionSources: sources.filter((source) => source.enabled && source.health === "attention").length,
    staleSources: staleSources.length,
    sensitiveSources: sources.filter((source) => sensitiveClassification(source.classification)).length,
    unindexedEnabledSources: enabledSources.filter((source) => !sourceIndexed(stats, source)).length,
    indexedDocuments,
    failedDocuments,
    quarantinedDocuments,
    manualDocuments,
    automatedDocuments,
    staleAfterDays,
    latestIndexedAt: indexedDates.reduce<string | undefined>(
      (latest, value) => (timestampMs(value) >= timestampMs(latest) ? value : latest),
      undefined,
    ),
    oldestIndexedAt: indexedDates.reduce<string | undefined>(
      (oldest, value) => (oldest === undefined || timestampMs(value) <= timestampMs(oldest) ? value : oldest),
      undefined,
    ),
  };
}

function normalizeDocument(input: ContextIndexDocumentInput): ContextIndexDocument {
  const now = new Date().toISOString();
  const indexedAt = validTimestamp(input.indexedAt) ?? now;
  return {
    id: input.id?.trim() || `ctxdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceId: input.sourceId.trim(),
    sourceName: input.sourceName.trim(),
    title: input.title.trim(),
    content: input.content.trim(),
    uri: input.uri?.trim() || undefined,
    classification: input.classification,
    ownerDepartment: input.ownerDepartment.trim() || "Other",
    ingestionMethod: ingestionMethod(input.ingestionMethod),
    ingestionStatus: ingestionStatus(input.ingestionStatus),
    indexedAt,
    sourceUpdatedAt: validTimestamp(input.sourceUpdatedAt) ?? indexedAt,
    syncJobId: input.syncJobId?.trim() || "",
    checksum: input.checksum?.trim() || "",
    permissionHash: input.permissionHash?.trim() || "",
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeStoredDocument(input: ContextIndexDocument): ContextIndexDocument {
  const now = new Date().toISOString();
  const indexedAt = validTimestamp(input.indexedAt) ?? validTimestamp(input.updatedAt) ?? now;
  return {
    ...input,
    sourceId: input.sourceId?.trim() || "unknown-source",
    sourceName: input.sourceName?.trim() || "Unknown source",
    title: input.title?.trim() || "Untitled document",
    content: input.content ?? "",
    ownerDepartment: input.ownerDepartment?.trim() || "Other",
    ingestionMethod: ingestionMethod(input.ingestionMethod),
    ingestionStatus: ingestionStatus(input.ingestionStatus),
    indexedAt,
    sourceUpdatedAt: validTimestamp(input.sourceUpdatedAt) ?? indexedAt,
    syncJobId: input.syncJobId?.trim() || "",
    checksum: input.checksum?.trim() || "",
    permissionHash: input.permissionHash?.trim() || "",
    metadata: input.metadata ?? {},
    createdAt: validTimestamp(input.createdAt) ?? indexedAt,
    updatedAt: validTimestamp(input.updatedAt) ?? indexedAt,
  };
}

async function saveFileDocuments(organizationId: string, documents: ContextIndexDocument[]) {
  await mkdir(path.dirname(indexPath(organizationId)), { recursive: true });
  await writeFile(indexPath(organizationId), JSON.stringify(documents, null, 2));
}

export async function listContextIndexDocuments(organizationId: string, limit = 1000): Promise<ContextIndexDocument[]> {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await pool.query<{ payload: ContextIndexDocument }>(
      "select payload from context_index_documents where organization_id = $1 order by updated_at desc limit $2",
      [organizationId, limit],
    );
    return result.rows.map((row) => normalizeStoredDocument(row.payload));
  }

  try {
    const raw = await readFile(indexPath(organizationId), "utf8");
    return (JSON.parse(raw) as ContextIndexDocument[]).map(normalizeStoredDocument).slice(0, limit);
  } catch {
    return [];
  }
}

export async function upsertContextIndexDocuments(organizationId: string, inputs: ContextIndexDocumentInput[]) {
  const documents = inputs.map(normalizeDocument);
  const pool = getDatabasePool();

  if (pool) {
    await ensureDatabaseSchema(pool);
    for (const document of documents) {
      await pool.query(
        `
        insert into context_index_documents
          (id, organization_id, source_id, source_name, title, classification, owner_department, payload, updated_at, created_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        on conflict (id)
        do update set source_id = excluded.source_id,
          source_name = excluded.source_name,
          title = excluded.title,
          classification = excluded.classification,
          owner_department = excluded.owner_department,
          payload = excluded.payload,
          updated_at = excluded.updated_at
        `,
        [
          document.id,
          organizationId,
          document.sourceId,
          document.sourceName,
          document.title,
          document.classification,
          document.ownerDepartment,
          JSON.stringify(document),
          new Date(document.updatedAt),
          new Date(document.createdAt),
        ],
      );
    }
    return documents;
  }

  const existing = await listContextIndexDocuments(organizationId, 100_000);
  const byId = new Map([...existing, ...documents].map((document) => [document.id, document]));
  await saveFileDocuments(organizationId, Array.from(byId.values()).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
  return documents;
}

export async function getContextIndexStats(organizationId: string): Promise<ContextIndexStats> {
  const documents = await listContextIndexDocuments(organizationId, 100_000);
  const sourceMap = new Map<string, ContextIndexStats["sources"][number]>();

  for (const document of documents) {
    const current = sourceMap.get(document.sourceId);
    const methodSet = new Set<ContextIngestionMethod>(current?.ingestionMethods ?? []);
    methodSet.add(document.ingestionMethod);
    const indexedDocument = document.ingestionStatus === "indexed";
    const failedDocument = document.ingestionStatus === "failed";
    const quarantinedDocument = document.ingestionStatus === "quarantined";
    const automatedDocument = isAutomatedDocument(document);
    const manualDocument = document.ingestionMethod === "manual";
    const lastUpdatedAt =
      current && Date.parse(current.lastUpdatedAt) > Date.parse(document.indexedAt)
        ? current.lastUpdatedAt
        : document.indexedAt;
    sourceMap.set(document.sourceId, {
      sourceId: document.sourceId,
      sourceName: document.sourceName,
      documents: (current?.documents ?? 0) + 1,
      indexedDocuments: (current?.indexedDocuments ?? 0) + (indexedDocument ? 1 : 0),
      failedDocuments: (current?.failedDocuments ?? 0) + (failedDocument ? 1 : 0),
      quarantinedDocuments: (current?.quarantinedDocuments ?? 0) + (quarantinedDocument ? 1 : 0),
      manualDocuments: (current?.manualDocuments ?? 0) + (manualDocument ? 1 : 0),
      automatedDocuments: (current?.automatedDocuments ?? 0) + (automatedDocument ? 1 : 0),
      ingestionMethods: Array.from(methodSet).sort(),
      latestStatus: current?.latestStatus === "failed" || failedDocument
        ? "failed"
        : current?.latestStatus === "quarantined" || quarantinedDocument
          ? "quarantined"
          : "indexed",
      classification: document.classification,
      lastUpdatedAt,
    });
  }

  return {
    totalDocuments: documents.length,
    indexedDocuments: documents.filter((document) => document.ingestionStatus === "indexed").length,
    failedDocuments: documents.filter((document) => document.ingestionStatus === "failed").length,
    quarantinedDocuments: documents.filter((document) => document.ingestionStatus === "quarantined").length,
    manualDocuments: documents.filter((document) => document.ingestionMethod === "manual").length,
    automatedDocuments: documents.filter((document) => isAutomatedDocument(document)).length,
    sources: Array.from(sourceMap.values()).sort((left, right) => right.documents - left.documents),
  };
}

export async function retrieveContextWithIndex(params: {
  organizationId: string;
  skill: Skill;
  sources: ContextSource[];
  query: string;
  limit?: number;
}): Promise<{
  decision: ReturnType<typeof retrieveContext>["decision"];
  results: RetrievalResult[];
  indexedResults: RetrievalResult[];
}> {
  const base = retrieveContext(params);
  const allowed = new Set(base.decision.allowedSourceIds.map((source) => source.toLowerCase()));
  const documents = await listContextIndexDocuments(params.organizationId, 5000);
  const indexedResults = documents
    .filter((document) => document.ingestionStatus === "indexed")
    .filter((document) => allowed.has(document.sourceId.toLowerCase()) || allowed.has(document.sourceName.toLowerCase()))
    .map((document): RetrievalResult => ({
      sourceId: document.sourceId,
      sourceName: document.sourceName,
      score: scoreDocument(document, params.query, allowed),
      snippet: `${document.title}: ${document.content.slice(0, 260)}${document.content.length > 260 ? "..." : ""}`,
      permission: "allowed",
    }))
    .filter((result) => result.score >= 0.4)
    .sort((left, right) => right.score - left.score)
    .slice(0, params.limit ?? 5);

  const merged = [...indexedResults, ...base.results]
    .sort((left, right) => right.score - left.score)
    .slice(0, params.limit ?? 5);

  return {
    decision: base.decision,
    results: merged,
    indexedResults,
  };
}
