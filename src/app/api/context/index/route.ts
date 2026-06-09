import { NextRequest, NextResponse } from "next/server";
import { contextIndexInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getContextIndexStats, resolveContextIndexDocumentSources, upsertContextIndexDocuments } from "@/lib/context-index";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const stats = await getContextIndexStats(guard.session.user.organizationId);
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.context-index.v1",
    stats,
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = contextIndexInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid context index payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const sourceResolution = resolveContextIndexDocumentSources({
    sources: workspace.contextSources,
    documents: parsed.data.documents,
  });
  if (sourceResolution.issues.length) {
    return NextResponse.json(
      {
        error: "Context index source guardrail violation.",
        details: sourceResolution.issues,
      },
      { status: 400 },
    );
  }

  const documents = await upsertContextIndexDocuments(guard.session.user.organizationId, sourceResolution.documents);
  const stats = await getContextIndexStats(guard.session.user.organizationId);
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.context-index-upsert.v1",
    accepted: documents.length,
    documents,
    stats,
  });
}
