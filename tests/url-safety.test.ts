import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertSafeOutboundUrl,
  assertSafeOutboundUrlSync,
  isPrivateAddress,
  outboundUrlIssue,
  SsrfError,
} from "../src/lib/url-safety.ts";

test("isPrivateAddress flags loopback, private, link-local, and metadata ranges", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("10.1.2.3"), true);
  assert.equal(isPrivateAddress("172.16.5.5"), true);
  assert.equal(isPrivateAddress("192.168.0.10"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true); // cloud metadata
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("fd00::1"), true);
  assert.equal(isPrivateAddress("fe80::1"), true);
  assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);

  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("93.184.216.34"), false);
  assert.equal(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946"), false);
});

test("outboundUrlIssue blocks unsafe URLs and allows public https", () => {
  assert.equal(outboundUrlIssue("https://hooks.example.com/path"), "");
  assert.match(outboundUrlIssue("http://hooks.example.com", { allowHttp: false }), /https/);
  assert.match(outboundUrlIssue("https://169.254.169.254/latest/meta-data"), /private/);
  assert.match(outboundUrlIssue("https://localhost/x"), /internal/);
  assert.match(outboundUrlIssue("https://metadata.google.internal/x"), /internal/);
  assert.match(outboundUrlIssue("https://broker.internal/x"), /internal/);
  assert.match(outboundUrlIssue("https://user:pass@example.com/x"), /credentials/);
  assert.match(outboundUrlIssue("not a url"), /malformed/);
});

test("assertSafeOutboundUrlSync throws SsrfError for blocked hosts", () => {
  assert.throws(() => assertSafeOutboundUrlSync("https://127.0.0.1/x"), SsrfError);
  const url = assertSafeOutboundUrlSync("https://example.com/execute");
  assert.equal(url.hostname, "example.com");
});

test("assertSafeOutboundUrl rejects literal private IPs without DNS", async () => {
  await assert.rejects(() => assertSafeOutboundUrl("https://10.0.0.5/execute"), SsrfError);
  await assert.rejects(() => assertSafeOutboundUrl("https://169.254.169.254/"), SsrfError);
});
