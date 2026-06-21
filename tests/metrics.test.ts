import { test } from "node:test";
import assert from "node:assert/strict";

import { __resetMetricsForTests, incCounter, observe, renderMetrics } from "../src/lib/metrics.ts";

test("incCounter aggregates by name + labels and renders Prometheus text", () => {
  __resetMetricsForTests();
  incCounter("orchestrator_requests_total", { budget: "ok" });
  incCounter("orchestrator_requests_total", { budget: "ok" });
  incCounter("orchestrator_requests_total", { budget: "block" });

  const out = renderMetrics();
  assert.match(out, /# TYPE orchestrator_requests_total counter/);
  assert.match(out, /orchestrator_requests_total\{budget="ok"\} 2/);
  assert.match(out, /orchestrator_requests_total\{budget="block"\} 1/);
});

test("observe records histogram buckets, sum, and count", () => {
  __resetMetricsForTests();
  observe("model_generation_latency_ms", 40, { provider: "openai" });
  observe("model_generation_latency_ms", 300, { provider: "openai" });

  const out = renderMetrics();
  assert.match(out, /# TYPE model_generation_latency_ms histogram/);
  assert.match(out, /model_generation_latency_ms_count\{provider="openai"\} 2/);
  assert.match(out, /model_generation_latency_ms_sum\{provider="openai"\} 340/);
  // 40ms falls in le=50; 300ms in le=500. Cumulative bucket le=50 should be 1.
  assert.match(out, /model_generation_latency_ms_bucket\{le="50",provider="openai"\} 1/);
  assert.match(out, /model_generation_latency_ms_bucket\{le="\+Inf",provider="openai"\} 2/);
});

test("label values are escaped to stay valid Prometheus output", () => {
  __resetMetricsForTests();
  incCounter("test_total", { label: 'a"b\\c' });
  const out = renderMetrics();
  assert.match(out, /test_total\{label="a\\"b\\\\c"\} 1/);
});
