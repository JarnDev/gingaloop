// Workspace discovery and configuration.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_FILE = "gingaloop.json";

export const CONFIG_VERSION = 2;
export const DEFAULT_CONFIG = Object.freeze({
  version: CONFIG_VERSION,
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
    // Mastery gates: clean solves in a row at your level, then a promotion challenge.
    cleanStreak: 3,
    promotion: true,
    promotionRetryDays: 3,
  },
  // Days after a give-up when the topic comes back as a review challenge.
  reviewAfterDays: [3, 7, 21],
  schedule: { time: "08:00" },
  // maxBudgetUsd: spending cap per Claude call (a generation makes 1 + retries calls); null = none.
  claude: { command: "claude", model: null, timeoutMinutes: 20, retries: 1, maxBudgetUsd: null },
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

// Always written, even when equal to the default: what a reader of gingaloop.json looks for first.
const ALWAYS_WRITTEN = new Set(["version", "rotation", "rotationMode", "stack", "domains", "schedule"]);

/**
 * The config as it should be stored: only what differs from the defaults (per sub-key for the
 * nested sections), plus the always-written keys. A value left at its default then follows the
 * default when a new gingaloop version improves it, instead of being frozen in the file.
 */
export function storedConfig(config) {
  const out = {};
  for (const [k, v] of Object.entries(config)) {
    const d = DEFAULT_CONFIG[k];
    if (ALWAYS_WRITTEN.has(k) || d === undefined) out[k] = v;
    else if (d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" && !Array.isArray(v)) {
      const sub = Object.fromEntries(Object.entries(v).filter(([sk, sv]) => !isDeepStrictEqual(sv, d[sk])));
      if (Object.keys(sub).length) out[k] = sub;
    } else if (!isDeepStrictEqual(v, d)) out[k] = v;
  }
  out.version = CONFIG_VERSION;
  return out;
}

/**
 * Bring a stored config up to CONFIG_VERSION. v1 files were written with every default frozen in;
 * values equal to an old default are dropped so they follow the current one.
 * @returns {{raw: object, changed: boolean}}
 */
export function migrateConfig(raw) {
  const version = raw.version ?? 1;
  if (version >= CONFIG_VERSION) return { raw, changed: false };
  const { thresholds: _legacy, ...rest } = raw; // pre-0.2 solve-count ladder
  if (isDeepStrictEqual(rest.reviewAfterDays, [3, 7])) delete rest.reviewAfterDays; // default until 0.3
  return { raw: storedConfig(rest), changed: true };
}

export function loadConfig(ws) {
  const path = join(ws, CONFIG_FILE);
  const stored = readJson(path);
  if ((stored.version ?? 1) > CONFIG_VERSION) {
    console.error(`ginga: ${path} is from a newer gingaloop (config v${stored.version}); update gingaloop (npm install -g gingaloop).`);
  }
  const { raw, changed } = migrateConfig(stored);
  if (changed) {
    writeJson(path, raw);
    console.error(`ginga: updated ${CONFIG_FILE} to config v${CONFIG_VERSION} (values left at their defaults now follow new releases).`);
  }
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    leveling: { ...DEFAULT_CONFIG.leveling, ...raw.leveling },
    schedule: { ...DEFAULT_CONFIG.schedule, ...raw.schedule },
    claude: { ...DEFAULT_CONFIG.claude, ...raw.claude },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...raw.sandbox },
  };
}

// Keys `ginga config set` accepts, with their type ("?" = may be null). Rotation, stacks, domains and
// the schedule have their own commands, which validate them and keep the timer in sync.
export const CONFIG_KEYS = {
  editor: "string?",
  "leveling.thresholds": "numbers",
  "leveling.basePoints": "number",
  "leveling.belowShare": "numbers",
  "leveling.hintMultiplier": "numbers",
  "leveling.cleanStreak": "integer",
  "leveling.promotion": "boolean",
  "leveling.promotionRetryDays": "integer",
  reviewAfterDays: "numbers",
  "claude.command": "string",
  "claude.model": "string?",
  "claude.timeoutMinutes": "number",
  "claude.retries": "integer",
  "claude.maxBudgetUsd": "number?",
  "sandbox.engine": "docker|podman|none",
  "sandbox.allowUnsandboxed": "boolean",
  "sandbox.memory": "string",
  "sandbox.cpus": "string",
  "sandbox.pidsLimit": "integer",
  "sandbox.timeoutSeconds": "integer",
};
const OWN_COMMAND = { rotation: "ginga rotation", rotationMode: "ginga rotation mode", stack: "ginga stack", domains: "ginga domains", schedule: "ginga schedule install --time HH:MM" };

/** Parse and type-check a value typed on the command line for `key`. */
export function parseConfigValue(key, text) {
  const type = CONFIG_KEYS[key];
  if (!type) {
    const top = key.split(".")[0];
    if (OWN_COMMAND[top]) throw new UserError(`Use \`${OWN_COMMAND[top]}\` to change ${top}.`);
    throw new UserError(`Unknown key "${key}". Keys: ${Object.keys(CONFIG_KEYS).join(", ")}.`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = text; // a bare word: a string
  }
  const nullable = type.endsWith("?");
  const base = type.replace(/\?$/, "");
  if (value === null && nullable) return null;
  const ok = {
    string: () => typeof value === "string" && value.length > 0,
    number: () => typeof value === "number" && value >= 0,
    integer: () => Number.isInteger(value) && value >= 0,
    boolean: () => typeof value === "boolean",
    numbers: () => Array.isArray(value) && value.length > 0 && value.every((n) => typeof n === "number" && n >= 0),
  }[base];
  if (ok ? ok() : base.split("|").includes(value)) {
    // claude.model and friends are typed as words; numbers like "2" for sandbox.cpus stay strings.
    return value;
  }
  if (base === "string" && typeof value === "number") return String(value);
  const want = ok ? { numbers: "a JSON array of numbers, e.g. [3,7,21]", integer: "a whole number", number: "a number" }[base] ?? `a ${base}` : `one of ${base.replaceAll("|", ", ")}`;
  throw new UserError(`${key} must be ${want}${nullable ? " (or null)" : ""}.`);
}

export function getConfigValue(config, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), config);
}

/** A copy of `config` with `key` set to `value` (or back to its default when value is undefined). */
export function withConfigValue(config, key, value) {
  const out = structuredClone(config);
  const parts = key.split(".");
  const last = parts.pop();
  const parent = parts.reduce((o, k) => (o[k] ??= {}), out);
  parent[last] = value === undefined ? structuredClone(getConfigValue(DEFAULT_CONFIG, key)) : value;
  return out;
}

export function saveConfig(ws, config) {
  writeJson(join(ws, CONFIG_FILE), storedConfig(config));
}

/** Local calendar date as YYYY-MM-DD (the user's day, not UTC). */
export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}
