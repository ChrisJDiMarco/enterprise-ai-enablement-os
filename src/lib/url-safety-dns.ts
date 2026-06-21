import { lookup } from "node:dns/promises";

import {
  assertSafeOutboundUrlSync,
  isIpLiteral,
  isPrivateAddress,
  SsrfError,
  type OutboundUrlOptions,
} from "./url-safety.ts";

/**
 * Full SSRF check that ALSO resolves DNS and rejects hosts that resolve to a
 * private/loopback/link-local address (defends against a public name pointing
 * inward). Node-only (imports node:dns) — kept out of ./url-safety so that module
 * stays edge-safe. Use for low-frequency, high-trust egress.
 */
export async function assertSafeOutboundUrl(rawUrl: string, options?: OutboundUrlOptions): Promise<URL> {
  const url = assertSafeOutboundUrlSync(rawUrl, options);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIpLiteral(host)) return url; // literal IP already validated synchronously

  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new SsrfError("URL host could not be resolved.");
  }
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new SsrfError("URL host resolves to a private, loopback, or link-local address.");
    }
  }
  return url;
}
