import net from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF protection for outbound requests to operator/tenant-configurable URLs
 * (connector brokers, log drains, webhooks). Without this, a configured URL
 * pointing at 169.254.169.254 (cloud metadata), localhost, or an internal host
 * turns the server into a confused deputy.
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata", "metadata.google.internal"]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function ipv4InCidr(value: number, base: string, bits: number): boolean {
  const baseValue = ipv4ToInt(base);
  if (baseValue === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return (
    ipv4InCidr(value, "0.0.0.0", 8) || // "this" network
    ipv4InCidr(value, "10.0.0.0", 8) || // private
    ipv4InCidr(value, "100.64.0.0", 10) || // carrier-grade NAT
    ipv4InCidr(value, "127.0.0.0", 8) || // loopback
    ipv4InCidr(value, "169.254.0.0", 16) || // link-local (incl. cloud metadata)
    ipv4InCidr(value, "172.16.0.0", 12) || // private
    ipv4InCidr(value, "192.0.0.0", 24) || // IETF protocol assignments
    ipv4InCidr(value, "192.168.0.0", 16) || // private
    ipv4InCidr(value, "198.18.0.0", 15) || // benchmarking
    ipv4InCidr(value, "224.0.0.0", 4) || // multicast
    ipv4InCidr(value, "240.0.0.0", 4) // reserved
  );
}

function isPrivateIpv6(ip: string): boolean {
  const address = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (address === "::1" || address === "::") return true;
  const mapped = address.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (/^f[cd]/.test(address)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(address)) return true; // link-local fe80::/10
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return false;
}

export type OutboundUrlOptions = { allowHttp?: boolean };

/** Returns "" when the URL is safe to fetch, or a human-readable reason when not. */
export function outboundUrlIssue(rawUrl: string, options: OutboundUrlOptions = {}): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "URL is malformed.";
  }

  const allowHttp = options.allowHttp ?? process.env.NODE_ENV !== "production";
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    return "URL must use https.";
  }
  if (url.username || url.password) return "URL must not embed credentials.";

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "URL must include a host.";
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return "URL host is not permitted (internal hostname).";
  }
  if (net.isIP(host) && isPrivateAddress(host)) {
    return "URL host is a private, loopback, or link-local address.";
  }
  return "";
}

/** Synchronous SSRF check (no DNS resolution). Throws {@link SsrfError} when unsafe. */
export function assertSafeOutboundUrlSync(rawUrl: string, options?: OutboundUrlOptions): URL {
  const issue = outboundUrlIssue(rawUrl, options);
  if (issue) throw new SsrfError(issue);
  return new URL(rawUrl);
}

/**
 * Full SSRF check that ALSO resolves DNS and rejects hosts that resolve to a
 * private/loopback/link-local address (defends against a public name pointing
 * inward). Prefer this for low-frequency, high-trust egress like broker calls.
 */
export async function assertSafeOutboundUrl(rawUrl: string, options?: OutboundUrlOptions): Promise<URL> {
  const url = assertSafeOutboundUrlSync(rawUrl, options);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (net.isIP(host)) return url; // literal IP already validated synchronously

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
