export const privateApiHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export function mergeResponseHeaders(...sources: Array<HeadersInit | undefined>) {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

export function privateResponseHeaders(headers?: HeadersInit) {
  return mergeResponseHeaders(privateApiHeaders, headers);
}

export function safeAttachmentFilenameStem(value: string, fallback: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return safe || fallback;
}
