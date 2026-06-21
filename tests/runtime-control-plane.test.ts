import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeControlIntelligence,
  buildRuntimeGraphDrilldown,
  commitRuntimeImportAction,
  createDefaultReportSchedulesAction,
  installLaunchPackAction,
  launchPackTemplates,
  normalizeReportSchedules,
  normalizeRuntimeAssets,
  normalizeRuntimeImportAudits,
  normalizeRuntimeImportJobs,
  runtimeAdapterManifests,
  testRuntimeAdapterAction,
  toggleReportScheduleAction,
} from "../src/lib/runtime-control-plane.ts";

const fixedNow = new Date("2026-06-19T12:00:00.000Z");

test("runtime adapter manifests define normalized contracts for major AI runtime surfaces", () => {
  const ids = new Set<string>(runtimeAdapterManifests.map((manifest) => manifest.id));

  ["langfuse", "langsmith", "phoenix_openinference", "opentelemetry", "mcp_broker", "custom_runtime"].forEach((id) =>
    assert.equal(ids.has(id), true, `${id} should have an adapter manifest`),
  );

  runtimeAdapterManifests.forEach((manifest) => {
    assert.ok(manifest.requiredFields.length > 0, `${manifest.name} should explain required setup fields`);
    assert.ok(manifest.normalizedMappings.some((mapping) => mapping.required), `${manifest.name} should map required OS fields`);
    assert.ok(manifest.evidenceCreated.length > 0, `${manifest.name} should declare proof events`);
  });
});

test("testing and committing a runtime import persists normalized assets and proof-first audit evidence", () => {
  const tested = testRuntimeAdapterAction({
    manifestId: "langfuse",
    adapters: [],
    importJobs: [],
    importAudits: [],
    now: fixedNow,
  });

  assert.equal(tested.adapters[0]?.status, "tested");
  assert.equal(tested.importJobs[0]?.step, "preview");
  assert.equal(tested.auditLog.eventType, "adapter_tested");
  assert.match(tested.auditLog.message, /Proof:/);

  const committed = commitRuntimeImportAction({
    manifestId: "langfuse",
    adapters: tested.adapters,
    importJobs: tested.importJobs,
    runtimeAssets: [],
    importAudits: tested.importAudits,
    now: fixedNow,
  });

  assert.equal(committed.adapters[0]?.status, "active");
  assert.equal(committed.importJobs[0]?.status, "committed");
  assert.ok(committed.runtimeAssets.length >= 3);
  assert.ok(committed.runtimeAssets.every((asset) => asset.proofIds.length > 0));
  assert.equal(committed.importAudits.length, 2);
  assert.equal(committed.auditLog.eventType, "runtime_import_committed");
});

test("launch pack installs generated work, report cadences, and proof records", () => {
  const template = launchPackTemplates.find((pack) => pack.id === "iso_42001_assurance");
  assert.ok(template);

  const installed = installLaunchPackAction({
    templateId: "iso_42001_assurance",
    installedPacks: [],
    reportSchedules: [],
    importAudits: [],
    now: fixedNow,
  });

  assert.equal(installed.installedPacks[0]?.templateId, "iso_42001_assurance");
  assert.deepEqual(installed.installedPacks[0]?.createdObjects.useCases, template.generatedUseCases);
  assert.equal(installed.reportSchedules.length, template.reportCadences.length);
  assert.ok(installed.reportSchedules.every((schedule) => schedule.proofIds.length > 0));
  assert.equal(installed.auditLog.eventType, "launch_pack_installed");
});

test("report schedule actions create default subscriptions and audit toggles", () => {
  const created = createDefaultReportSchedulesAction({
    reportSchedules: [],
    importAudits: [],
    now: fixedNow,
  });

  assert.equal(created.reportSchedules.length, 4);
  assert.ok(created.reportSchedules.every((schedule) => schedule.proofIds.length > 0));
  assert.equal(created.auditLog.eventType, "report_schedule_created");

  const toggled = toggleReportScheduleAction({
    scheduleId: "schedule-daily-operator-digest",
    reportSchedules: created.reportSchedules,
    importAudits: created.importAudits,
    now: fixedNow,
  });

  assert.ok(toggled);
  assert.equal(toggled.reportSchedules[0]?.id, "schedule-daily-operator-digest");
  assert.equal(toggled.reportSchedules[0]?.status, "needs_destination");
  assert.ok(toggled.reportSchedules[0]?.deliveryTargets.some((target) => target.status === "needs_destination"));
  assert.equal(toggled.auditLog.eventType, "report_schedule_updated");

  const readySchedule = normalizeReportSchedules([
    {
      id: "schedule-ready",
      title: "Ready digest",
      cadence: "daily",
      audience: "AI operators",
      templateId: "daily_ai_enablement_digest",
      deliveryTargets: [
        { type: "in_app", target: "Action Inbox", status: "ready" },
        { type: "slack", target: "#ai-ops", status: "ready" },
        { type: "email", target: "group:ai-steering", status: "ready" },
      ],
      status: "paused",
      nextRunAt: "08:00 local",
      proofIds: ["proof-ready"],
    },
  ]);
  const activated = toggleReportScheduleAction({
    scheduleId: "schedule-ready",
    reportSchedules: readySchedule,
    importAudits: [],
    now: fixedNow,
  });

  assert.ok(activated);
  assert.equal(activated.reportSchedules[0]?.status, "active");
  assert.ok(activated.reportSchedules[0]?.deliveryTargets.every((target) => target.status === "ready"));
});

test("runtime control normalizers sanitize unsafe imported operational records", () => {
  const assets = normalizeRuntimeAssets([
    {
      id: "asset-person@example.com",
      adapterId: "adapter-langfuse",
      manifestId: "langfuse",
      sourceType: "trace",
      sourceId: "trace-person@example.com",
      name: "Trace with api_key=sk-live-sensitive1234567890",
      owner: "Jane 212-555-0101",
      status: "mapped",
      riskLevel: "medium",
      metrics: { traces: -4, evals: 2.6, toolCalls: -1, prompts: 3, monthlyCostUsd: -99 },
      mappedFields: ["prompt=full raw prompt"],
      missingMappings: ["owner jane.employee@example.com"],
      evidenceGaps: ["SSN 123-45-6789 copied into trace"],
      proofIds: ["proof-person@example.com"],
      importedAt: "2026-06-19T12:00:00.000Z",
      unsafeExtra: "should not persist",
    },
  ]);
  const jobs = normalizeRuntimeImportJobs([
    {
      id: "job-person@example.com",
      adapterId: "adapter-langfuse",
      manifestId: "langfuse",
      status: "committed",
      step: "commit",
      discovered: { assets: -10, traces: 2.2, evals: -1, toolCalls: 4, prompts: 1, costs: -2, owners: 1, proofIds: 1 },
      previewAssetIds: ["asset-person@example.com"],
      committedAssetIds: ["asset-person@example.com"],
      message: "Imported runtime payload=Jane employee transcript api_key=sk-live-sensitive1234567890.",
      proofIds: ["proof-job"],
    },
  ]);
  const audits = normalizeRuntimeImportAudits([
    {
      id: "audit-person@example.com",
      action: "runtime_import_committed",
      targetId: "job-person@example.com",
      message: "Runtime import committed with postgres://user:password@db.internal.",
      actor: "reviewer@example.com",
      riskLevel: "medium",
      proofId: "proof-audit",
      createdAt: "2026-06-19T12:00:00.000Z",
    },
  ]);
  const serialized = JSON.stringify({ assets, jobs, audits });

  assert.equal(assets[0]?.metrics.traces, 0);
  assert.equal(assets[0]?.metrics.evals, 3);
  assert.equal(assets[0]?.metrics.monthlyCostUsd, 0);
  assert.equal(jobs[0]?.discovered.assets, 0);
  assert.equal(jobs[0]?.discovered.traces, 2);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.equal(serialized.includes("212-555-0101"), false);
  assert.equal(serialized.includes("123-45-6789"), false);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("unsafeExtra"), false);
});

test("normalizeReportSchedules downgrades unsafe delivery destinations", () => {
  const schedules = normalizeReportSchedules([
    {
      id: "schedule-webhook",
      title: "Daily digest api_key=sk-live-sensitive1234567890",
      cadence: "daily",
      audience: "Operator jane.employee@example.com",
      templateId: "daily_ai_enablement_digest",
      deliveryTargets: [
        {
          type: "slack",
          target: "https://hooks.slack.com/services/T000/B000/SECRET_TOKEN_123456789",
          status: "ready",
        },
        {
          type: "email",
          target: "jane.employee@example.com",
          status: "ready",
        },
        {
          type: "email",
          target: "AI Steering Committee",
          status: "ready",
        },
        {
          type: "email",
          target: "group:ai-steering",
          status: "ready",
        },
        {
          type: "slack",
          target: "#ai-governance",
          status: "ready",
        },
      ],
      status: "active",
      nextRunAt: "08:00 local",
      proofIds: ["proof-schedule-person@example.com"],
    },
  ]);
  const serialized = JSON.stringify(schedules);

  assert.equal(schedules[0]?.status, "needs_destination");
  assert.equal(schedules[0]?.deliveryTargets[0]?.status, "needs_destination");
  assert.equal(schedules[0]?.deliveryTargets[1]?.status, "needs_destination");
  assert.equal(schedules[0]?.deliveryTargets[2]?.status, "needs_destination");
  assert.equal(schedules[0]?.deliveryTargets[3]?.status, "ready");
  assert.equal(schedules[0]?.deliveryTargets[4]?.status, "ready");
  assert.equal(serialized.includes("jane.employee@example.com"), false);
  assert.equal(serialized.includes("hooks.slack.com"), false);
  assert.equal(serialized.includes("SECRET_TOKEN"), false);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
});

test("runtime graph drilldown reports trace sources, coverage, mapping gaps, and evidence gaps", () => {
  const committed = commitRuntimeImportAction({
    manifestId: "langsmith",
    adapters: [],
    importJobs: [],
    runtimeAssets: [],
    importAudits: [],
    now: fixedNow,
  });

  const drilldown = buildRuntimeGraphDrilldown({
    adapters: committed.adapters,
    importJobs: committed.importJobs,
    runtimeAssets: committed.runtimeAssets,
  });

  assert.equal(drilldown.activeAdapters, 1);
  assert.equal(drilldown.importJobs, 1);
  assert.ok(drilldown.traceSources > 0);
  assert.ok(drilldown.evalCoverage > 0);
  assert.ok(drilldown.missingMappings.length > 0);
  assert.ok(drilldown.evidenceGaps.length > 0);
});

test("runtime control intelligence grades coverage, material gaps, and next actions", () => {
  const empty = buildRuntimeControlIntelligence({
    adapters: [],
    importJobs: [],
    runtimeAssets: [],
    importAudits: [],
  });

  assert.equal(empty.grade, "unmapped");
  assert.equal(empty.metrics.activeAdapters, 0);
  assert.ok(empty.gaps.some((gap) => gap.id === "runtime-no-active-adapter"));
  assert.equal(empty.nextActions[0]?.command, "test_adapter");

  const tested = testRuntimeAdapterAction({
    manifestId: "langfuse",
    adapters: [],
    importJobs: [],
    importAudits: [],
    now: fixedNow,
  });
  const committed = commitRuntimeImportAction({
    manifestId: "langfuse",
    adapters: tested.adapters,
    importJobs: tested.importJobs,
    runtimeAssets: [],
    importAudits: tested.importAudits,
    now: fixedNow,
  });
  const intelligence = buildRuntimeControlIntelligence({
    adapters: committed.adapters,
    importJobs: committed.importJobs,
    runtimeAssets: committed.runtimeAssets,
    importAudits: committed.importAudits,
  });

  assert.equal(intelligence.metrics.activeAdapters, 1);
  assert.ok(intelligence.score > empty.score);
  assert.ok(["forming", "controlled", "launch_ready"].includes(intelligence.grade));
  assert.ok(intelligence.metrics.proofCoverage > 0);
  assert.ok(intelligence.gaps.some((gap) => gap.target === "owner" || gap.target === "eval" || gap.target === "asset"));
  assert.ok(intelligence.nextActions.some((action) => action.command === "open_inventory"));
});
