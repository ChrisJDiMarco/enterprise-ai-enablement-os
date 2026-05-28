import { NextResponse } from "next/server";
import { getProviderReadiness, providerRegistry } from "@/lib/provider-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.provider-readiness.v1",
    generatedAt: new Date().toISOString(),
    secretPolicy: "Server-side readiness only. Secret values are never returned to the client.",
    providers: getProviderReadiness(),
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
