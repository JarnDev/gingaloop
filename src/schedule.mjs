// systemd user timer for `ginga daily`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { PKG_ROOT, UserError } from "./workspace.mjs";

const UNIT = "gingaloop";

function unitDir() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "systemd", "user");
}

function hasSystemd() {
  return spawnSync("systemctl", ["--user", "--version"], { stdio: "ignore" }).status === 0;
}

function which(bin) {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, bin);
    if (dir && existsSync(p)) return p;
  }
  return null;
}

function systemctl(...args) {
  const r = spawnSync("systemctl", ["--user", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new UserError(`systemctl --user ${args.join(" ")} failed: ${r.stderr.trim()}`);
  return r.stdout;
}

export function manualInstructions(ws, time) {
  const [h, m] = time.split(":");
  return [
    "systemd is not available here. Schedule this command yourself, e.g. with cron:",
    `  ${Number(m)} ${Number(h)} * * *  ${process.execPath} ${join(PKG_ROOT, "bin", "ginga.mjs")} daily --workspace ${ws}`,
  ].join("\n");
}

export function installSchedule({ ws, config }) {
  const time = config.schedule.time;
  if (!/^\d{2}:\d{2}$/.test(time)) throw new UserError(`schedule.time must be HH:MM, got "${time}"`);
  if (!hasSystemd()) return manualInstructions(ws, time);
  const claude = which(config.claude.command) ?? config.claude.command;
  // systemd does not see nvm/shell PATH tweaks, so pin absolute dirs for node and claude.
  const path = [...new Set([dirname(process.execPath), claude.includes("/") ? dirname(claude) : null,
    "/usr/local/bin", "/usr/bin", "/bin"].filter(Boolean))].join(":");
  mkdirSync(unitDir(), { recursive: true });
  writeFileSync(
    join(unitDir(), `${UNIT}.service`),
    `[Unit]
Description=gingaloop: generate today's coding challenge

[Service]
Type=oneshot
ExecStart="${process.execPath}" "${join(PKG_ROOT, "bin", "ginga.mjs")}" daily --workspace "${ws}"
Environment=PATH=${path}
Nice=10
MemoryMax=4G
CPUQuota=400%
TimeoutStartSec=${config.claude.timeoutMinutes * (config.claude.retries + 1) + 15}min
`,
  );
  writeFileSync(
    join(unitDir(), `${UNIT}.timer`),
    `[Unit]
Description=gingaloop daily challenge at ${time}

[Timer]
OnCalendar=*-*-* ${time}:00
Persistent=true

[Install]
WantedBy=timers.target
`,
  );
  systemctl("daemon-reload");
  systemctl("enable", "--now", `${UNIT}.timer`);
  return `Installed ${UNIT}.timer (daily at ${time}). Check it with \`ginga schedule status\`.`;
}

export function removeSchedule() {
  if (!hasSystemd()) return "systemd is not available; nothing to remove.";
  spawnSync("systemctl", ["--user", "disable", "--now", `${UNIT}.timer`], { stdio: "ignore" });
  for (const ext of ["service", "timer"]) rmSync(join(unitDir(), `${UNIT}.${ext}`), { force: true });
  systemctl("daemon-reload");
  return `Removed ${UNIT}.timer and ${UNIT}.service.`;
}

export function scheduleStatus() {
  if (!hasSystemd()) return "systemd is not available.";
  if (!existsSync(join(unitDir(), `${UNIT}.timer`))) return "Not scheduled. Run `ginga schedule install`.";
  const r = spawnSync("systemctl", ["--user", "list-timers", `${UNIT}.timer`, "--all", "--no-pager"], { encoding: "utf8" });
  return r.stdout.trim() + `\n\nLogs: journalctl --user -u ${UNIT}.service`;
}
