import type { ReportScheduleRecord } from "./runtime-control-plane.ts";

const CADENCE_DAYS: Record<ReportScheduleRecord["cadence"], number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  event_driven: 0,
};

/** A schedule is due when it's active, time-driven, and its next run is at/before now. */
export function reportScheduleDue(schedule: ReportScheduleRecord, now: Date): boolean {
  if (schedule.status !== "active") return false;
  if (schedule.cadence === "event_driven") return false;
  const nextRunMs = Date.parse(schedule.nextRunAt);
  if (!Number.isFinite(nextRunMs)) return false;
  return nextRunMs <= now.getTime();
}

export function selectDueReportSchedules(schedules: ReportScheduleRecord[], now: Date): ReportScheduleRecord[] {
  return schedules.filter((schedule) => reportScheduleDue(schedule, now));
}

/** Stamp lastRunAt = now and roll nextRunAt forward by the cadence interval. */
export function advanceReportScheduleAfterRun(schedule: ReportScheduleRecord, now: Date): ReportScheduleRecord {
  const nowIso = now.toISOString();
  const days = CADENCE_DAYS[schedule.cadence] || 1;
  const nextRunAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  return { ...schedule, lastRunAt: nowIso, nextRunAt, updatedAt: nowIso };
}
