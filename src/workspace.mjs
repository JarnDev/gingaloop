// Workspace discovery and configuration.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_FILE = "gingaloop.json";

export const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  rotation: ["python"],
  // "random": shuffle bag, each language once per cycle; "ordered": the list in order.
  rotationMode: "random",
  // Per-language stack: basics (stdlib only, default) | mixed | ecosystem (pinned libraries).
  stack: {},
  // Industry domains that frame challenges; "general" = no framing.
  domains: ["general"],
  // Command for `ginga open`; null → $VISUAL, $EDITOR, then vi.
  editor: null,
  leveling: {
    // Cumulative points needed to REACH level 2, 3, ... (length + 1 = max level).
    thresholds: [600, 1500, 3000, 5500, 9500, 16000, 26000, 42000, 68000],
    basePoints: 100,
    // Share of basePoints for solving 1, then 2+, levels below your current level.
    belowShare: [0.3, 0.05],
    // Multiplier by number of hints used: 0, 1, 2, 3+.
    hintMultiplier: [1, 0.85, 0.7, 0.5],
  },
  // Days after a give-up when the topic comes back as a review challenge.
  reviewAfterDays: [3, 7, 21],
  schedule: { time: "08:00" },
  claude: { command: "claude", model: null, timeoutMinutes: 20, retries: 1 },
  sandbox: {
    engine: "docker", // docker | podman | none
    allowUnsandboxed: false, // must be true for engine "none"
    memory: "1g",
    cpus: "2",
    pidsLimit: 256,
    timeoutSeconds: 120,
  },
});

export class UserError extends Error {}

export function globalConfigDir() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "gingaloop");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function readGlobalConfig() {
  const path = join(globalConfigDir(), "config.json");
  return existsSync(path) ? readJson(path) : {};
}

export function writeGlobalConfig(value) {
  writeJson(join(globalConfigDir(), "config.json"), value);
}

/** Resolution order: --workspace, $GINGALOOP_WORKSPACE, nearest gingaloop.json upwards, global default. */
export function findWorkspace(explicit) {
  const candidates = [];
  if (explicit) candidates.push(resolve(explicit));
  if (process.env.GINGALOOP_WORKSPACE) candidates.push(resolve(process.env.GINGALOOP_WORKSPACE));
  for (const c of candidates) {
    if (existsSync(join(c, CONFIG_FILE))) return c;
    throw new UserError(`No ${CONFIG_FILE} in ${c}. Run \`ginga init ${c}\` first.`);
  }
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = readGlobalConfig().workspace;
  if (fallback && existsSync(join(fallback, CONFIG_FILE))) return fallback;
  throw new UserError("No gingaloop workspace found. Run `ginga init <dir>` to create one.");
}

export function loadConfig(ws) {
  const { thresholds: _legacy, ...raw } = readJson(join(ws, CONFIG_FILE)); // pre-0.2 solve-count ladder
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    leveling: { ...DEFAULT_CONFIG.leveling, ...raw.leveling },
    schedule: { ...DEFAULT_CONFIG.schedule, ...raw.schedule },
    claude: { ...DEFAULT_CONFIG.claude, ...raw.claude },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...raw.sandbox },
  };
}

export function saveConfig(ws, config) {
  writeJson(join(ws, CONFIG_FILE), config);
}

/** Local calendar date as YYYY-MM-DD (the user's day, not UTC). */
export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}
