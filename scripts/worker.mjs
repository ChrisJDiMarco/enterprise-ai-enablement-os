// Durable maintenance worker. Run as a separate process alongside the app:
//   npm run worker            (long-running, ticks every WORKER_INTERVAL_MS)
//   WORKER_ONCE=true npm run worker   (one pass then exit — for an external cron)
// Postgres-native: needs only DATABASE_URL, no external queue/scheduler service.
import process from "node:process";

// The worker reaches cross-tenant tables (workflow_jobs, idempotency_records, and
// tenant discovery on workspace_snapshots) that are FORCE-RLS. It must therefore
// connect as a dedicated PRIVILEGED maintenance role with BYPASSRLS, supplied via
// WORKER_DATABASE_URL — distinct from the non-superuser request-path role. Apply
// it before the DB pool is created (dynamic import below). The web app must NOT
// set WORKER_DATABASE_URL; if it is unset, the worker falls back to DATABASE_URL.
if (process.env.WORKER_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
}

const { runWorkerTick } = await import("../src/lib/worker-runtime.ts");
const { fireAlertOnce } = await import("../src/lib/alerts.ts");

async function alertWorkerFailure(key, title, detail) {
  try {
    await fireAlertOnce({ key, organizationId: "platform", severity: "critical", title, detail });
  } catch {
    // Alerting is best-effort.
  }
}

process.on("unhandledRejection", (reason) => {
  const detail = reason instanceof Error ? reason.message : String(reason);
  console.error(JSON.stringify({ level: "error", name: "worker.unhandled_rejection", error: detail }));
  void alertWorkerFailure("worker.unhandled_rejection", "Maintenance worker unhandled rejection", detail);
});
process.on("uncaughtException", (error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", name: "worker.uncaught_exception", error: detail }));
  void alertWorkerFailure("worker.uncaught_exception", "Maintenance worker uncaught exception", detail);
});

const intervalMs = Number(process.env.WORKER_INTERVAL_MS) > 0 ? Number(process.env.WORKER_INTERVAL_MS) : 5 * 60 * 1000;

let running = true;
let timer = null;

async function tick() {
  try {
    const summary = await runWorkerTick();
    console.info(JSON.stringify({ level: "info", name: "worker.tick", ...summary }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", name: "worker.tick_failed", error: detail }));
    await alertWorkerFailure("worker.tick_failed", "Maintenance worker tick failed", detail);
  }
}

function shutdown(signal) {
  console.info(JSON.stringify({ level: "info", name: "worker.shutdown", signal }));
  running = false;
  if (timer) clearTimeout(timer);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (process.env.WORKER_ONCE === "true") {
  await tick();
  process.exit(0);
}

while (running) {
  await tick();
  if (!running) break;
  await new Promise((resolve) => {
    timer = setTimeout(resolve, intervalMs);
  });
}
