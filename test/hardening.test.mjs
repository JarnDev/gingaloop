import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { byCreation, pickChallenge } from "../src/challenges.mjs";
import { dueReview, insideJail, jailRoot, validTime } from "../src/cli.mjs";
import { shq } from "../src/generate.mjs";
import { readEvents } from "../src/progress.mjs";
import { profileExtraFlags } from "../src/sandbox.mjs";

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-hard-")));
after(() => rmSync(tmp, { recursive: true, force: true }));
const BIN = join(import.meta.dirname, "..", "bin", "ginga.mjs");
const ginga = (args, opts = {}) =>
  spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", timeout: 20000, ...opts, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg"), ...opts.env } });

function workspace(name) {
  const ws = join(tmp, name);
  mkdirSync(join(ws, ".staging", "run1", "tests"), { recursive: true });
  mkdirSync(join(ws, "challenges"), { recursive: true });
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ rotation: ["python"] }));
  return ws;
}

test("jail: root is the staging run dir; paths must stay inside it", () => {
  const ws = workspace("wsjail");
  const run = join(ws, ".staging", "run1");
  assert.deepEqual(jailRoot(join(run, "tests")), { root: run, ws });
  assert.equal(insideJail(run, "tests"), join(run, "tests"));
  assert.throws(() => insideJail(run, ".."), /outside/);
  assert.throws(() => insideJail(run, "/"), /outside/);
  symlinkSync(ws, join(run, "escape"));
  assert.throws(() => insideJail(run, "escape"), /outside/, "symlinks are resolved first");
  assert.throws(() => jailRoot(ws), /staging/);
  assert.throws(() => jailRoot(join(ws, ".staging")), /staging/);
});

test("sandbox run --jail refuses to leave the staging dir (no docker needed to refuse)", () => {
  const ws = workspace("wsjail2");
  const cwd = join(ws, ".staging", "run1");
  const run = (args) => ginga(["sandbox", "run", "--jail", "--lang", "python", ...args, "--", "true"], { cwd });
  assert.match(run(["--dir", "/"]).stderr, /outside the staging/);
  assert.match(run(["--dir", ws]).stderr, /outside the staging/);
  assert.match(ginga(["sandbox", "run", "--jail", "--lang", "python", "--workspace", "/", "--", "true"], { cwd }).stderr, /cannot be combined/);
  assert.match(ginga(["sandbox", "run", "--jail", "--", "true"], { cwd: ws }).stderr, /staging directory/);
});

test("an option given twice is rejected (no 'last one wins' widening)", () => {
  const r = ginga(["sandbox", "run", "--jail", "--lang", "python", "--dir", ".", "--dir", "/", "--", "true"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--dir was given more than once/);
});

test("only built-in profiles may add docker flags, and only safe ones", () => {
  const evil = { id: "x", sandbox: { extraFlags: ["--privileged", "-v", "/:/host"] } };
  assert.deepEqual(profileExtraFlags({ ...evil, source: "workspace" }), []);
  assert.deepEqual(profileExtraFlags({ ...evil, source: "draft" }), []);
  assert.throws(() => profileExtraFlags({ ...evil, source: "builtin" }), /not allowed/);
  assert.deepEqual(profileExtraFlags({ id: "c", source: "builtin", sandbox: { extraFlags: ["--ulimit=stack=67108864"] } }), ["--ulimit=stack=67108864"]);
});

test("init never overwrites existing files and doesn't steal the default workspace", () => {
  const first = join(tmp, "first");
  assert.equal(ginga(["init", first, "--rotation", "python", "--time", "08:00", "--mode", "random"], { input: "" }).status, 0);
  assert.equal(readFileSync(join(first, ".gitignore"), "utf8"), ".staging/\n.logs/\nnode_modules/\n");
  const repo = join(tmp, "my-repo");
  mkdirSync(repo);
  writeFileSync(join(repo, "README.md"), "# My project\n\nPrecious text.\n");
  writeFileSync(join(repo, ".gitignore"), "node_modules/\n");
  const r = ginga(["init", repo, "--rotation", "c", "--time", "07:30", "--mode", "ordered"], { input: "" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(readFileSync(join(repo, "README.md"), "utf8").includes("Precious text."));
  assert.equal(readFileSync(join(repo, ".gitignore"), "utf8"), "node_modules/\n.staging/\n.logs/\n");
  assert.match(r.stdout, /default workspace stays/);
  assert.equal(JSON.parse(readFileSync(join(tmp, "xdg", "gingaloop", "config.json"), "utf8")).workspace, first);
  ginga(["init", join(tmp, "third"), "--rotation", "c", "--time", "07:30", "--mode", "ordered", "--default"], { input: "" });
  assert.equal(JSON.parse(readFileSync(join(tmp, "xdg", "gingaloop", "config.json"), "utf8")).workspace, join(tmp, "third"));
});

test("times must be real HH:MM", () => {
  assert.equal(validTime("07:05"), "07:05");
  for (const bad of ["99:99", "24:00", "7:05", "", undefined]) assert.throws(() => validTime(bad), /HH:MM/);
});

test("a missed review day only delays the review, it never skips it", () => {
  const gave = { type: "gaveup", id: "x", lang: "c", level: 1, date: "2026-10-01", ts: "2026-10-01T12:00:00Z" };
  assert.ok(dueReview([gave], [3, 7], "2026-10-05"), "day 4: the day-3 review is still due");
  const r1 = { type: "generated", id: "r1", reviewOf: "x", date: "2026-10-05", ts: "2026-10-05T08:00:00Z" };
  assert.equal(dueReview([gave, r1], [3, 7], "2026-10-06"), null, "one review done, the next is at day 7");
  assert.ok(dueReview([gave, r1], [3, 7], "2026-10-12"), "day 11: the day-7 review is due");
  const r2 = { ...r1, id: "r2", date: "2026-10-12" };
  assert.equal(dueReview([gave, r1, r2], [3, 7], "2026-10-20"), null, "both reviews done");
});

test("a corrupt progress line is skipped, not fatal", () => {
  const ws = workspace("wsprog");
  writeFileSync(join(ws, "progress.jsonl"), '{"type":"solved","id":"a"}\n{"type":"sol\n{"type":"hint","id":"a"}\n');
  assert.deepEqual(readEvents(ws).map((e) => e.type), ["solved", "hint"]);
});

test("picking: exact id beats prefix; default is the most recently created open challenge", () => {
  const ws = workspace("wspick");
  for (const id of ["2026-10-02-c-foo", "2026-10-02-c-foo-2", "2026-10-02-python-bar"]) {
    mkdirSync(join(ws, "challenges", id));
    writeFileSync(join(ws, "challenges", id, "challenge.json"), JSON.stringify({ id }));
  }
  const gen = (id) => JSON.stringify({ type: "generated", id });
  // python-bar was created first, c-foo-2 last: alphabetical order would pick python-bar.
  writeFileSync(join(ws, "progress.jsonl"), [gen("2026-10-02-python-bar"), gen("2026-10-02-c-foo"), gen("2026-10-02-c-foo-2")].join("\n") + "\n");
  assert.equal(pickChallenge(ws, "2026-10-02-c-foo").manifest.id, "2026-10-02-c-foo");
  assert.throws(() => pickChallenge(ws, "2026-10-02-c-fo"), /ambiguous/);
  assert.equal(pickChallenge(ws).manifest.id, "2026-10-02-c-foo-2");
  assert.equal(byCreation([], []).length, 0);
});

test("shell quoting keeps plain paths as-is and quotes the rest", () => {
  assert.equal(shq("/usr/bin/node"), "/usr/bin/node");
  assert.equal(shq("/home/Ana Silva/bin"), "'/home/Ana Silva/bin'");
  assert.equal(shq("it's"), "'it'\\''s'");
});

test("editor files: C/C++ profiles bring compile_flags.txt; existing files are kept; names are plain", async () => {
  const { writeEditorFiles } = await import("../src/challenges.mjs");
  const { findProfile } = await import("../src/profiles.mjs");
  const dir = join(tmp, "editorfiles");
  mkdirSync(dir, { recursive: true });
  const cpp = findProfile(null, "cpp");
  assert.deepEqual(writeEditorFiles(dir, cpp), ["compile_flags.txt"]);
  const flags = readFileSync(join(dir, "compile_flags.txt"), "utf8").split("\n");
  assert.ok(flags.includes("-std=c++20") && flags.includes("-Istarter") && flags.includes("-DGINGA_SCRATCH"));
  assert.ok(readFileSync(join(import.meta.dirname, "..", "examples", "cpp", "tests", "Makefile"), "utf8").includes("-std=c++20"),
    "editor flags mirror the sandbox standard");
  writeFileSync(join(dir, "compile_flags.txt"), "-std=c++23\n");
  assert.deepEqual(writeEditorFiles(dir, cpp), [], "a user's customized file is kept");
  assert.equal(readFileSync(join(dir, "compile_flags.txt"), "utf8"), "-std=c++23\n");
  assert.ok(readFileSync(join(import.meta.dirname, "..", "profiles", "c.json"), "utf8").includes("-std=c17"));
  assert.deepEqual(writeEditorFiles(dir, findProfile(null, "python")), [], "profiles without editor files write nothing");
  for (const bad of ["../x", "a/b", "..", "."]) {
    assert.throws(() => writeEditorFiles(dir, { id: "evil", editorFiles: { [bad]: "x" } }), /plain file name/);
  }
});
