import { spawnSync } from "node:child_process";

/** Desktop notification when possible; always echoes to stdout. */
export function notify(title, body = "", { urgent = false } = {}) {
  console.log(`${title}${body ? ` — ${body}` : ""}`);
  if (process.env.GINGALOOP_NO_NOTIFY) return;
  spawnSync(
    "notify-send",
    ["--app-name=gingaloop", `--urgency=${urgent ? "critical" : "normal"}`, title, body],
    { stdio: "ignore", timeout: 5000 },
  );
}
