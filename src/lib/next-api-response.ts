import { NextResponse } from "next/server";

import {
  mergeResponseHeaders,
  privateApiHeaders,
  privateResponseHeaders,
  safeAttachmentFilenameStem,
} from "@/lib/api-response";

export { safeAttachmentFilenameStem };

export function privateApiJson<T>(payload: T, init: ResponseInit = {}) {
  return NextResponse.json(payload, {
    ...init,
    headers: privateResponseHeaders(init.headers),
  });
}

export function privateMarkdownAttachment(markdown: string, attachmentFilename: string, init: ResponseInit = {}) {
  return new NextResponse(markdown, {
    ...init,
    headers: mergeResponseHeaders(
      privateApiHeaders,
      {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${attachmentFilename}"`,
      },
      init.headers,
    ),
  });
}
