export type ExportCopyStatus = "copied" | "downloaded" | "empty" | "failed";

export type ExportCopyResult = {
  status: ExportCopyStatus;
  message: string;
};

export function safeExportFilename(input: string, fallback = "enterprise-ai-export") {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return slug || fallback;
}

export function timestampedExportFilename(base: string, extension: string, date = new Date()) {
  const safeExtension = extension.replace(/^\./, "") || "txt";
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return `${safeExportFilename(base)}-${stamp}.${safeExtension}`;
}

function unquoteHeaderValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  return trimmed;
}

function filenameExtension(filename: string) {
  const match = filename.match(/\.([a-z0-9]{1,12})$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function decodeHeaderFilename(value: string) {
  try {
    return decodeURIComponent(value.replace(/^UTF-8''/i, ""));
  } catch {
    return "";
  }
}

export function filenameFromContentDisposition(
  contentDisposition: string | null | undefined,
  fallback: string,
) {
  if (!contentDisposition) return fallback;

  const filenameStar = contentDisposition.match(/(?:^|;)\s*filename\*\s*=\s*([^;]+)/i)?.[1];
  const filename = contentDisposition.match(/(?:^|;)\s*filename\s*=\s*([^;]+)/i)?.[1];
  const rawValue = filenameStar ?? filename;
  if (!rawValue) return fallback;

  const unquoted = unquoteHeaderValue(rawValue);
  const decoded = filenameStar ? decodeHeaderFilename(unquoted) : unquoted;
  if (!decoded.trim()) return fallback;

  const extension = filenameExtension(decoded);
  const stem = extension ? decoded.slice(0, -(extension.length + 1)) : decoded;
  const safeStem = safeExportFilename(stem, fallback.replace(/\.[^.]+$/, ""));

  return extension ? `${safeStem}.${extension}` : safeStem;
}

export function downloadTextFile(params: {
  contents: string;
  filename: string;
  mimeType?: string;
}) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return false;
  }

  const blob = new Blob([params.contents], { type: params.mimeType ?? "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = params.filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function downloadJsonFile(filename: string, payload: unknown) {
  return downloadTextFile({
    contents: JSON.stringify(payload, null, 2),
    filename,
    mimeType: "application/json;charset=utf-8",
  });
}

export async function copyTextOrDownload(params: {
  contents: string;
  copiedMessage: string;
  fallbackFilename: string;
  fallbackMimeType?: string;
  emptyMessage?: string;
  downloadedMessage?: string;
  failedMessage?: string;
}): Promise<ExportCopyResult> {
  if (!params.contents.trim()) {
    return {
      status: "empty",
      message: params.emptyMessage ?? "Nothing is available to copy or export yet.",
    };
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(params.contents);
      return { status: "copied", message: params.copiedMessage };
    } catch {
      // Fall through to file download. Some enterprise browser policies block clipboard writes.
    }
  }

  const downloaded = downloadTextFile({
    contents: params.contents,
    filename: params.fallbackFilename,
    mimeType: params.fallbackMimeType,
  });

  if (downloaded) {
    return {
      status: "downloaded",
      message: params.downloadedMessage ?? "Clipboard access was blocked, so the export was downloaded instead.",
    };
  }

  return {
    status: "failed",
    message: params.failedMessage ?? "Export failed because this browser session cannot access clipboard or downloads.",
  };
}
