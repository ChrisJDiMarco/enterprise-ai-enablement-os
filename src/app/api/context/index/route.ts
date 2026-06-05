import { NextRequest, NextResponse } from "next/server";
import { contextIndexInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getContextIndexStats, upsertContextIndexDocuments } from "@/lib/context-index";

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

  const documents = await upsertContextIndexDocuments(guard.session.user.organizationId, parsed.data.documents);
  const stats = await getContextIndexStats(guard.session.user.organizationId);
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.context-index-upsert.v1",
    accepted: documents.length,
    documents,
    stats,
  });
}
