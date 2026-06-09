import { NextRequest, NextResponse } from "next/server";
import { contextRetrieveInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { retrieveContextWithIndex } from "@/lib/context-index";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  resolveWorkspaceContextSourcesForRuntime,
  resolveWorkspaceSkillForRuntime,
} from "@/lib/workspace-runtime-policy";

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
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const requestedSkillId = input.skillId ?? input.skill?.id;
  const skillResolution = resolveWorkspaceSkillForRuntime(workspace, requestedSkillId);
  if (!skillResolution.ok) {
    return NextResponse.json(
      { error: skillResolution.error, code: skillResolution.code },
      { status: skillResolution.status },
    );
  }
  const sourceResolution = resolveWorkspaceContextSourcesForRuntime(workspace, skillResolution.skill);

  const result = await retrieveContextWithIndex({
    organizationId: guard.session.user.organizationId,
    skill: skillResolution.skill,
    sources: sourceResolution.sources,
    query: input.query,
    limit: input.limit,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.context-retrieval.v1",
    organizationId: guard.session.user.organizationId,
    sourcePolicy: {
      submittedSourceCount: input.sources.length,
      resolvedSourceCount: sourceResolution.sources.length,
      missingSourceIds: sourceResolution.missingSourceIds,
    },
    ...result,
  });
}
