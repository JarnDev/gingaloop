import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { remoteWebUrl } from "../src/gitops.mjs";
import { CONFIG_VERSION } from "../src/workspace.mjs";

const BIN = fileURLToPath(new URL("../bin/ginga.mjs", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "gingaloop-repo-"));
after(() => rmSync(tmp, { recursive: true, force: true }));
const env = { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg"), GIT_CONFIG_GLOBAL: join(tmp, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1", NO_COLOR: "1" };
delete env.GINGALOOP_WORKSPACE;

test("remote → web page: scp-like, ssh, git and http(s), without credentials", () => {
  assert.equal(remoteWebUrl("git@github.com:JarnDev/gingaloop-workspace.git"), "https://github.com/JarnDev/gingaloop-workspace");
  assert.equal(remoteWebUrl("github.com:o/r"), "https://github.com/o/r");
  assert.equal(remoteWebUrl("ssh://git@forge.lan:2222/o/r.git"), "https://forge.lan/o/r", "the ssh port isn't the web port");
  assert.equal(remoteWebUrl("git://host/o/r"), "https://host/o/r");
  assert.equal(remoteWebUrl("https://forge.lan:3000/group/sub/r.git/"), "https://forge.lan:3000/group/sub/r");
  assert.equal(remoteWebUrl("https://user:ghp_secret@github.com/o/r.git"), "https://github.com/o/r");
  assert.doesNotMatch(remoteWebUrl("https://x-access-token:abc@github.com/o/r"), /abc|x-access-token/);
});

test("remote → web page: local paths and file:// have none", () => {
  for (const r of ["/srv/git/r.git", "../r.git", "file:///srv/git/r.git", "C:\\repos\\r", "https://github.com/"]) {
    assert.equal(remoteWebUrl(r), null, r);
  }
});

function workspace(name, { git = true, origin = null } = {}) {
  const ws = join(tmp, name);
  mkdirSync(join(ws, "challenges"), { recursive: true });
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ version: CONFIG_VERSION, rotation: ["python"] }));
  if (git) spawnSync("git", ["init", "-q"], { cwd: ws, env });
  if (origin) spawnSync("git", ["remote", "add", "origin", origin], { cwd: ws, env });
  return ws;
}

const repo = (ws, ...args) => spawnSync(process.execPath, [BIN, "repo", ...args, "-w", ws], { env, encoding: "utf8", timeout: 20_000 });

test("ginga repo --print: prints the web page and opens nothing", () => {
  const r = repo(workspace("ok", { origin: "https://bot:tok123@github.com/me/ws.git" }), "--print");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "https://github.com/me/ws\n");
  assert.doesNotMatch(r.stdout + r.stderr, /tok123/);
});

test("ginga repo: clear errors without git, without origin, and for a local remote", () => {
  assert.match(repo(workspace("nogit", { git: false }), "--print").stderr, /is not a git repository/);
  assert.match(repo(workspace("noorigin"), "--print").stderr, /no `origin` remote/);
  const local = repo(workspace("local", { origin: "/srv/git/ws.git" }), "--print");
  assert.notEqual(local.status, 0);
  assert.match(local.stderr, /not a hosted repo/);
});

test("ginga repo hands the address to the browser opener, and without a display only prints it", { skip: process.platform !== "linux" }, async () => {
  const bin = join(tmp, "bin");
  const seen = join(tmp, "opened.txt");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "xdg-open"), `#!/bin/sh\nprintf '%s' "$1" > "${seen}"\n`);
  chmodSync(join(bin, "xdg-open"), 0o755);
  const ws = workspace("opener", { origin: "git@github.com:me/ws.git" });
  const run = (extra) => spawnSync(process.execPath, [BIN, "repo", "-w", ws],
    { env: { ...env, PATH: `${bin}:${process.env.PATH}`, ...extra }, encoding: "utf8", timeout: 20_000 });

  const shown = run({ DISPLAY: ":99" });
  assert.equal(shown.status, 0, shown.stderr);
  for (let i = 0; i < 50 && !existsSync(seen); i++) await new Promise((r) => setTimeout(r, 50)); // detached child
  assert.equal(readFileSync(seen, "utf8"), "https://github.com/me/ws");

  rmSync(seen);
  const headless = run({ DISPLAY: "", WAYLAND_DISPLAY: "" });
  assert.equal(headless.stdout, "https://github.com/me/ws\n");
  assert.match(headless.stderr, /No browser here/);
  assert.equal(existsSync(seen), false);
});
