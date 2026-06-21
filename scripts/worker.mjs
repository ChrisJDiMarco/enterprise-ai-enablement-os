// Durable maintenance worker. Run as a separate process alongside the app:
//   npm run worker            (long-running, ticks every WORKER_INTERVAL_MS)
//   WORKER_ONCE=true npm run worker   (one pass then exit — for an external cron)
// Postgres-native: needs only DATABASE_URL, no external queue/scheduler service.
import process from "node:process";

import { runWorkerTick } from "../src/lib/worker-runtime.ts";

const intervalMs = Number(process.env.WORKER_INTERVAL_MS) > 0 ? Number(process.env.WORKER_INTERVAL_MS) : 5 * 60 * 1000;

let running = true;
let timer = null;

async function tick() {
  try {
    const summary = await runWorkerTick();
    console.info(JSON.stringify({ level: "info", name: "worker.tick", ...summary }));
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", name: "worker.tick_failed", error: error instanceof Error ? error.message : String(error) }),
    );
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
