import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceReportScheduleAfterRun, reportScheduleDue, selectDueReportSchedules } from "../src/lib/report-schedule.ts";
import type { ReportScheduleRecord } from "../src/lib/runtime-control-plane.ts";

const now = new Date("2026-06-15T12:00:00.000Z");

function schedule(overrides: Partial<ReportScheduleRecord>): ReportScheduleRecord {
  return {
    id: "rs-1",
    title: "Weekly Brief",
    cadence: "weekly",
    audience: "Execs",
    templateId: "weekly_enablement_brief" as ReportScheduleRecord["templateId"],
    deliveryTargets: [],
    status: "active",
    nextRunAt: "2026-06-10T00:00:00.000Z",
    proofIds: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

test("reportScheduleDue is true only for active, time-driven, past-due schedules", () => {
  assert.equal(reportScheduleDue(schedule({}), now), true);
  assert.equal(reportScheduleDue(schedule({ status: "paused" }), now), false);
  assert.equal(reportScheduleDue(schedule({ status: "needs_destination" }), now), false);
  assert.equal(reportScheduleDue(schedule({ cadence: "event_driven" }), now), false);
  assert.equal(reportScheduleDue(schedule({ nextRunAt: "2026-06-20T00:00:00.000Z" }), now), false);
});

test("selectDueReportSchedules returns only the due ones", () => {
  const due = selectDueReportSchedules(
    [schedule({ id: "a" }), schedule({ id: "b", status: "paused" }), schedule({ id: "c", nextRunAt: "2026-07-01T00:00:00.000Z" })],
    now,
  );
  assert.deepEqual(due.map((s) => s.id), ["a"]);
});

test("advanceReportScheduleAfterRun stamps lastRunAt and rolls nextRunAt by cadence", () => {
  const advanced = advanceReportScheduleAfterRun(schedule({ cadence: "weekly" }), now);
  assert.equal(advanced.lastRunAt, now.toISOString());
  assert.equal(advanced.nextRunAt, new Date("2026-06-22T12:00:00.000Z").toISOString());
});
