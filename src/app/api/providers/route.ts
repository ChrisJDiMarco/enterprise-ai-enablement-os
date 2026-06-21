import { NextResponse } from "next/server";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getProviderReadiness, providerRegistry } from "@/lib/provider-registry";
import { loadTenantSecretEvidence } from "@/lib/tenant-secret-evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const secretEvidence = await loadTenantSecretEvidence({
    organizationId: guard.session.user.organizationId,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.provider-readiness.v1",
    generatedAt: new Date().toISOString(),
    secretPolicy: "Server-side readiness only. Secret values are never returned to the client.",
    secretEvidence: secretEvidence.evidence,
    providers: getProviderReadiness(process.env, secretEvidence.runtimeSecretNames),
    taskLanes: [
      { lane: "classification", defaultProvider: "deepseek", defaultModelRef: "deepseek/deepseek-v4-flash" },
      { lane: "summarization", defaultProvider: "google", defaultModelRef: "gemini/gemini-2.5-flash" },
      { lane: "governance", defaultProvider: "glm", defaultModelRef: "glm/glm-5.1" },
      { lane: "workflow", defaultProvider: "kimi", defaultModelRef: "kimi/kimi-k2.6" },
      { lane: "red_team", defaultProvider: "deepseek", defaultModelRef: "deepseek/deepseek-v4-pro" },
      { lane: "fallback", defaultProvider: "openrouter", defaultModelRef: "openrouter/auto" },
    ],
    registryVersion: providerRegistry.map((provider) => provider.id).join("."),
  });
}
