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
