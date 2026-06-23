import { fireAlertOnce } from "./alerts.ts";

let installed = false;

/**
 * Installs Node-process safety nets for the web server. Kept in its own module
 * (NOT inlined in instrumentation.ts) so the Edge bundle never statically sees
 * `process.on` — it is only dynamically imported under the NEXT_RUNTIME==="nodejs"
 * guard. Stray background promise rejections are otherwise silent; request errors
 * are handled separately by instrumentation's onRequestError.
 */
export function installServerProcessHandlers() {
  if (installed) return;
  installed = true;

  process.on("unhandledRejection", (reason) => {
    const detail = reason instanceof Error ? reason.message : String(reason);
    console.error(JSON.stringify({ level: "error", name: "server.unhandled_rejection", error: detail }));
    // Log + page on-call, but don't exit — one bad promise shouldn't take the
    // whole server down.
    void fireAlertOnce({
      key: "server.unhandled_rejection",
      organizationId: "platform",
      severity: "critical",
      title: "Server unhandled promise rejection",
      detail,
    }).catch(() => undefined);
  });
}
