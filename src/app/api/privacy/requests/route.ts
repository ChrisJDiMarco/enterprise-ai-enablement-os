import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  createPrivacyRequestReceipt,
  privacyLifecycleConfigFromEnv,
  type PrivacyRequestReceipt,
} from "@/lib/privacy-lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privacyRequestSchema = z
  .object({
    type: z.enum(["export", "delete", "review"]),
    subjectUserId: z.string().trim().max(180).optional(),
    subjectEmail: z.string().trim().email().optional(),
    reason: z.string().trim().min(8).max(1000),
  })
  .refine((value) => value.subjectUserId || value.subjectEmail, "subjectUserId or subjectEmail is required.");

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "privacy_reviewer");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = privacyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid privacy request payload.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "body",
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const config = privacyLifecycleConfigFromEnv();
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const forwarded = Boolean(config.requestWorkflowUrl);
  let externalStatus: Record<string, unknown> = {};
  if (forwarded) {
    externalStatus = await forwardPrivacyRequest(config.requestWorkflowUrl, parsed.data, guard.session.user.organizationId);
  }

  const receipt = createPrivacyRequestReceipt({
    organizationId: guard.session.user.organizationId,
    type: parsed.data.type,
    subjectUserId: parsed.data.subjectUserId,
    subjectEmail: parsed.data.subjectEmail,
    accepted: config.configured || process.env.NODE_ENV !== "production",
    forwarded,
    reason: forwarded
      ? "Privacy request forwarded to the configured workflow."
      : config.exportEnabled || process.env.NODE_ENV !== "production"
        ? "Privacy request accepted for internal review."
        : config.reason,
  });

  await repository.appendAuditLog(guard.session.user.organizationId, {
    id: receipt.id,
    eventType: "privacy_request_received",
    message: `${parsed.data.type} privacy request ${receipt.status}.`,
    actor: guard.session.user.name,
    riskLevel: parsed.data.type === "delete" ? "high" : "medium",
    createdAt: receipt.createdAt,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.privacy-request-receipt.v1",
    lifecycle: config,
    receipt,
    externalStatus,
  });
}

async function forwardPrivacyRequest(
  workflowUrl: string,
  payload: z.infer<typeof privacyRequestSchema>,
  organizationId: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(workflowUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(process.env.PRIVACY_REQUEST_WORKFLOW_TOKEN
          ? { Authorization: `Bearer ${process.env.PRIVACY_REQUEST_WORKFLOW_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        schema: "enterprise-ai-enablement-os.privacy-request.v1",
        organizationId,
        ...payload,
      }),
    });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: body,
    };
  } catch (error) {
    return {
      ok: false,
      status: "unavailable",
      error: error instanceof Error ? error.message : "Unknown privacy workflow error.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export type { PrivacyRequestReceipt };
