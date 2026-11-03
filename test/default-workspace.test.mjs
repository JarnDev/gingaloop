// A workspace cloned onto another machine never ran `init` there, so nothing made it the default.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CONFIG_VERSION } from "../src/workspace.mjs";

const BIN = fileURLToPath(new URL("../bin/ginga.mjs", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "gingaloop-default-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const xdg = join(tmp, "xdg");
const pointer = join(xdg, "gingaloop", "config.json");
const env = { ...process.env, XDG_CONFIG_HOME: xdg, GINGALOOP_NO_NOTIFY: "1", NO_COLOR: "1" };
delete env.GINGALOOP_WORKSPACE;

function ginga(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, env, encoding: "utf8", timeout: 30_000 });
}

function clone(name) {
  const dir = join(tmp, name);
  mkdirSync(join(dir, "challenges"), { recursive: true });
  writeFileSync(join(dir, "gingaloop.json"), JSON.stringify({ version: CONFIG_VERSION, rotation: ["python"] }, null, 2) + "\n");
  return dir;
}

const savedDefault = () => JSON.parse(readFileSync(pointer, "utf8")).workspace;
const elsewhere = mkdtempSync(join(tmp, "elsewhere-"));

beforeEach(() => rmSync(xdg, { recursive: true, force: true }));

test("outside any workspace, the error names the way to register a clone", () => {
  const r = ginga(elsewhere, "list");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Cloned one\? Run `ginga init <dir>`/);
  assert.match(r.stderr, /--workspace DIR/);
});

test("a command run inside a clone makes it the default, so later commands work from anywhere", () => {
  const ws = clone("clone-a");
  assert.equal(ginga(ws, "list").status, 0);
  assert.equal(savedDefault(), ws);
  const r = ginga(elsewhere, "list");
  assert.equal(r.status, 0, r.stderr);
});

test("a valid default is never replaced by the workspace a command ran in", () => {
  const home = clone("home");
  const other = clone("other");
  ginga(home, "list");
  ginga(other, "list");
  assert.equal(savedDefault(), home);
});

test("a default pointing at a removed workspace is replaced", () => {
  mkdirSync(join(xdg, "gingaloop"), { recursive: true });
  writeFileSync(pointer, JSON.stringify({ workspace: join(tmp, "gone") }));
  const ws = clone("clone-b");
  ginga(ws, "list");
  assert.equal(savedDefault(), ws);
});

test("init on an existing workspace only registers it and leaves its files alone", () => {
  const ws = clone("clone-c");
  const before = readFileSync(join(ws, "gingaloop.json"), "utf8");
  const r = ginga(elsewhere, "init", ws);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /it is now your default/);
  assert.equal(savedDefault(), ws);
  assert.equal(readFileSync(join(ws, "gingaloop.json"), "utf8"), before);
  assert.equal(spawnSync("ls", ["-A", ws], { encoding: "utf8" }).stdout.trim(), "challenges\ngingaloop.json");
});

test("init on an existing workspace keeps another valid default unless --default", () => {
  const home = clone("home-2");
  const ws = clone("clone-d");
  ginga(home, "list");
  const kept = ginga(elsewhere, "init", ws);
  assert.equal(kept.status, 0, kept.stderr);
  assert.match(kept.stdout, /Your default stays/);
  assert.equal(savedDefault(), home);
  assert.equal(ginga(elsewhere, "init", ws, "--default").status, 0);
  assert.equal(savedDefault(), ws);
});
