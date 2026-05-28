import { NextRequest, NextResponse } from "next/server";
import { contextRetrieveInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { retrieveContext } from "@/lib/context-retrieval";
import type { ContextSource, Skill } from "@/lib/enterprise-ai-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = contextRetrieveInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid context retrieval payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  const result = retrieveContext({
    skill: input.skill as Skill,
    sources: input.sources.map((source) => ({
      ...source,
      classification: source.classification ?? source.dataClassification ?? "internal",
      ownerDepartment: source.ownerDepartment ?? "Other",
      lastIndexedAt: source.lastIndexedAt ?? "",
      documentCount: source.documentCount ?? 0,
      skillsUsing: source.skillsUsing ?? 0,
      health: source.health ?? "healthy",
    })) as ContextSource[],
    query: input.query,
    limit: input.limit,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.context-retrieval.v1",
    organizationId: guard.session.user.organizationId,
    ...result,
  });
}
