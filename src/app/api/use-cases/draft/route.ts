import { NextRequest, NextResponse } from "next/server";

import { formatZodError, useCaseDraftGenerateInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { generateWithModelProvider } from "@/lib/model-provider";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import {
  buildUseCaseDraftSystemPrompt,
  buildUseCaseDraftUserPrompt,
  disposeUseCaseDraft,
} from "@/lib/use-case-draft-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Propose/dispose use-case drafting.
 * The model proposes a structured intake draft; deterministic policy validates
 * and clamps it (see use-case-draft-generator). When no provider is available
 * the response is the heuristic draft, honestly labeled provenance "heuristic".
 */
export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = useCaseDraftGenerateInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid use case draft payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const settings = await buildServerAISettingsForOrganization(
    guard.session.user.organizationId,
    parsed.data.routingSettings ?? {},
  );

  let modelText: string | undefined;
  let modelAvailable = false;
  let modelRef = "local/heuristic-draft";
  try {
    const generated = await generateWithModelProvider({
      settings,
      lane: "bulk",
      system: buildUseCaseDraftSystemPrompt(),
      user: buildUseCaseDraftUserPrompt(parsed.data.message),
      temperature: 0.2,
      maxTokens: 900,
    });
    modelAvailable = !generated.localFallback;
    modelText = generated.localFallback ? undefined : generated.text;
    if (modelAvailable) {
      modelRef = generated.route.modelRef;
    }
  } catch {
    modelAvailable = false;
  }

  const result = disposeUseCaseDraft({
    message: parsed.data.message,
    modelText,
    modelAvailable,
  });

  return NextResponse.json({
    draft: result.draft,
    provenance: result.provenance,
    autonomyPreview: result.autonomyPreview,
    model: { modelRef, simulated: result.provenance !== "model" },
  });
}
