import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { CONFIG_VERSION, DEFAULT_CONFIG, loadConfig, migrateConfig, saveConfig, storedConfig } from "../src/workspace.mjs";

const tmp = mkdtempSync(join(tmpdir(), "gingaloop-config-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

test("storedConfig keeps only what differs from the defaults (per nested key)", () => {
  const cfg = { ...structuredClone(DEFAULT_CONFIG), rotation: ["c"], claude: { ...DEFAULT_CONFIG.claude, model: "opus" } };
  assert.deepEqual(storedConfig(cfg), {
    version: CONFIG_VERSION, rotation: ["c"], rotationMode: "random", stack: {}, domains: ["general"],
    schedule: { time: "08:00" }, claude: { model: "opus" },
  });
});

test("v1 configs drop frozen defaults, legacy keys and the old review default", () => {
  const v1 = { version: 1, rotation: ["python"], thresholds: [3, 4], reviewAfterDays: [3, 7], leveling: { ...DEFAULT_CONFIG.leveling },
    sandbox: { ...DEFAULT_CONFIG.sandbox, memory: "2g" } };
  const { raw, changed } = migrateConfig(v1);
  assert.ok(changed);
  assert.equal(raw.version, CONFIG_VERSION);
  assert.equal(raw.thresholds, undefined);
  assert.equal(raw.reviewAfterDays, undefined, "follows the current default (3, 7, 21)");
  assert.equal(raw.leveling, undefined);
  assert.deepEqual(raw.sandbox, { memory: "2g" }, "a real choice is kept");
  assert.equal(migrateConfig(raw).changed, false);
});

test("loadConfig migrates the file once and still returns the full config", () => {
  const ws = mkdtempSync(join(tmp, "ws-"));
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ version: 1, rotation: ["c"], reviewAfterDays: [3, 7] }));
  const cfg = loadConfig(ws);
  assert.deepEqual(cfg.reviewAfterDays, [3, 7, 21]);
  assert.equal(cfg.sandbox.engine, "docker");
  assert.equal(JSON.parse(readFileSync(join(ws, "gingaloop.json"), "utf8")).version, CONFIG_VERSION);
  saveConfig(ws, { ...cfg, rotation: ["c", "python"] });
  const onDisk = JSON.parse(readFileSync(join(ws, "gingaloop.json"), "utf8"));
  assert.deepEqual(onDisk.rotation, ["c", "python"]);
  assert.equal(onDisk.sandbox, undefined);
});

test("ginga config set/get/unset type-checks and stores only non-defaults", async () => {
  const { spawnSync } = await import("node:child_process");
  const BIN = join(import.meta.dirname, "..", "bin", "ginga.mjs");
  const ws = mkdtempSync(join(tmp, "cfg-"));
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ version: CONFIG_VERSION, rotation: ["c"] }));
  const g = (...args) => spawnSync(process.execPath, [BIN, "config", ...args, "-w", ws], { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });
  assert.equal(g("set", "claude.model", "opus").status, 0);
  assert.equal(g("set", "claude.maxBudgetUsd", "2.5").status, 0);
  assert.equal(g("set", "sandbox.cpus", "4").status, 0);
  assert.equal(g("get", "claude.model").stdout.trim(), "opus");
  let disk = JSON.parse(readFileSync(join(ws, "gingaloop.json"), "utf8"));
  assert.deepEqual(disk.claude, { model: "opus", maxBudgetUsd: 2.5 });
  assert.equal(disk.sandbox.cpus, "4", "typed as a number, stored as the string the key expects");
  const bad = g("set", "claude.retries", "lots");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /whole number/);
  assert.match(g("set", "rotation", '["c"]').stderr, /ginga rotation/);
  assert.match(g("set", "nope", "1").stderr, /Unknown key/);
  assert.equal(g("unset", "claude.model").status, 0);
  disk = JSON.parse(readFileSync(join(ws, "gingaloop.json"), "utf8"));
  assert.deepEqual(disk.claude, { maxBudgetUsd: 2.5 });
  assert.equal(g("set", "claude.maxBudgetUsd", "null").status, 0);
  assert.equal(JSON.parse(readFileSync(join(ws, "gingaloop.json"), "utf8")).claude, undefined);
});

test("every command has its own help; unknown commands fail", async () => {
  const { spawnSync } = await import("node:child_process");
  const BIN = join(import.meta.dirname, "..", "bin", "ginga.mjs");
  const { COMMAND_HELP } = await import("../src/help.mjs");
  const src = readFileSync(BIN, "utf8");
  const commands = [...src.matchAll(/(\w+): cli\.cmd/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(COMMAND_HELP).sort(), commands.sort());
  const r = spawnSync(process.execPath, [BIN, "done", "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^ginga done/);
  assert.match(spawnSync(process.execPath, [BIN, "help", "giveup"], { encoding: "utf8" }).stdout, /^ginga giveup/);
  assert.equal(spawnSync(process.execPath, [BIN, "frobnicate"], { encoding: "utf8" }).status, 2);
});
