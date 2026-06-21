/**
 * Minimal, dependency-free metrics registry exposed in Prometheus text format at
 * /api/metrics. Enough for an on-call team to chart request/model throughput,
 * latency percentiles (via histogram buckets), and error/alert rates, and to
 * delegate storage/dashboards/alerting to a managed TSDB (Prometheus/Grafana/Datadog).
 */

type LabelSet = Record<string, string>;

type Histogram = { buckets: Map<number, number>; sum: number; count: number };

// Latency buckets in milliseconds.
const HISTOGRAM_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

const counters = new Map<string, { name: string; labels: LabelSet; value: number }>();
const histograms = new Map<string, { name: string; labels: LabelSet; histogram: Histogram }>();

function sanitizeLabelValue(value: string) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").slice(0, 120);
}

function seriesKey(name: string, labels: LabelSet) {
  const entries = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
  return `${name}{${entries}}`;
}

function renderLabels(labels: LabelSet, extra?: LabelSet) {
  const merged = { ...labels, ...extra };
  const keys = Object.keys(merged).sort();
  if (keys.length === 0) return "";
  return `{${keys.map((k) => `${k}="${sanitizeLabelValue(merged[k])}"`).join(",")}}`;
}

export function incCounter(name: string, labels: LabelSet = {}, value = 1) {
  const key = seriesKey(name, labels);
  const existing = counters.get(key);
  if (existing) existing.value += value;
  else counters.set(key, { name, labels, value });
}

export function observe(name: string, valueMs: number, labels: LabelSet = {}) {
  if (!Number.isFinite(valueMs) || valueMs < 0) return;
  const key = seriesKey(name, labels);
  let entry = histograms.get(key);
  if (!entry) {
    entry = { name, labels, histogram: { buckets: new Map(HISTOGRAM_BUCKETS_MS.map((b) => [b, 0])), sum: 0, count: 0 } };
    histograms.set(key, entry);
  }
  entry.histogram.sum += valueMs;
  entry.histogram.count += 1;
  for (const bound of HISTOGRAM_BUCKETS_MS) {
    if (valueMs <= bound) entry.histogram.buckets.set(bound, (entry.histogram.buckets.get(bound) ?? 0) + 1);
  }
}

export function renderMetrics(): string {
  const lines: string[] = [];
  const counterNames = new Set([...counters.values()].map((c) => c.name));
  for (const name of counterNames) {
    lines.push(`# TYPE ${name} counter`);
    for (const c of counters.values()) {
      if (c.name === name) lines.push(`${name}${renderLabels(c.labels)} ${c.value}`);
    }
  }
  const histoNames = new Set([...histograms.values()].map((h) => h.name));
  for (const name of histoNames) {
    lines.push(`# TYPE ${name} histogram`);
    for (const h of histograms.values()) {
      if (h.name !== name) continue;
      let cumulative = 0;
      for (const bound of HISTOGRAM_BUCKETS_MS) {
        cumulative += h.histogram.buckets.get(bound) ?? 0;
        lines.push(`${name}_bucket${renderLabels(h.labels, { le: String(bound) })} ${cumulative}`);
      }
      lines.push(`${name}_bucket${renderLabels(h.labels, { le: "+Inf" })} ${h.histogram.count}`);
      lines.push(`${name}_sum${renderLabels(h.labels)} ${h.histogram.sum}`);
      lines.push(`${name}_count${renderLabels(h.labels)} ${h.histogram.count}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Test seam. */
export function __resetMetricsForTests() {
  counters.clear();
  histograms.clear();
}
