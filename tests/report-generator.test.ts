import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import {
  buildDeterministicReport,
  buildReportMetrics,
  buildReportSourcePacket,
  normalizeReportTemplate,
  reportTemplateById,
} from "../src/lib/report-generator.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  triage: "Triage",
  discovery: "Discovery",
  scored: "Scored",
  governance_review: "Governance Review",
  approved_for_pilot: "Approved for Pilot",
  in_pilot: "In Pilot",
  measuring: "Measuring",
  scaled: "Scaled",
  in_review: "In Review",
  approved: "Approved",
  pilot: "Pilot",
  production: "Production",
};

test("report generator keeps empty production reports honest", () => {
  const workspace = emptyWorkspace("test-org");
  const metrics = buildReportMetrics({
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
  });
  const report = buildDeterministicReport({
    templateId: "weekly_ai_enablement_brief",
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
    workSignals: workspace.workSignals,
    metrics,
    statusLabels,
  });

  assert.match(report, /No portfolio records/);
  assert.match(report, /Recommended Startup Actions/);
});

test("report generator normalizes human titles into template ids", () => {
  assert.equal(normalizeReportTemplate("ROI Report"), "roi_report");
  assert.equal(normalizeReportTemplate("Board Summary"), "board_summary");
  assert.equal(reportTemplateById("Governance Summary").title, "Governance Summary");
});

test("report generator creates template-specific governance and ROI narratives", () => {
  const workspace = buildDemoWorkspace("demo");
  const metrics = buildReportMetrics({
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
  });
  const governance = buildDeterministicReport({
    templateId: "governance_summary",
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
    workSignals: workspace.workSignals,
    metrics,
    statusLabels,
  });
  const roi = buildDeterministicReport({
    templateId: "roi_report",
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
    workSignals: workspace.workSignals,
    metrics,
    statusLabels,
  });

  assert.match(governance, /Governance Posture/);
  assert.match(governance, /Evidence Coverage/);
  assert.match(roi, /Value Summary/);
  assert.match(roi, /Finance Decisions Needed/);
});

test("report source packet exposes only grounded report facts", () => {
  const workspace = buildDemoWorkspace("demo");
  const metrics = buildReportMetrics({
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
  });
  const packet = buildReportSourcePacket({
    templateId: "board_summary",
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
    workSignals: workspace.workSignals,
    metrics,
    statusLabels,
  });

  assert.equal(packet.template.title, "Board Summary");
  assert.equal(packet.metrics.totalUseCases > 0, true);
  assert.equal(packet.topUseCases.every((item) => typeof item.priorityScore === "number"), true);
});
