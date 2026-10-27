import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { raceTwins } from "../src/cli.mjs";
import { readEvents } from "../src/progress.mjs";
import { today } from "../src/workspace.mjs";

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-sync-")));
after(() => rmSync(tmp, { recursive: true, force: true }));

// Isolated git config: no signing, no user hooks (these repos are synthetic test data).
const gitconfig = join(tmp, "gitconfig");
writeFileSync(gitconfig, "[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n");
const env = { ...process.env, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: "1", XDG_CONFIG_HOME: join(tmp, "xdg"), GINGALOOP_NO_NOTIFY: "1", NO_COLOR: "1" };
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: 30000 });
const ginga = (ws, ...args) => run(process.execPath, [join(import.meta.dirname, "..", "bin", "ginga.mjs"), ...args, "-w", ws], ws);
const gitOut = (ws, ...args) => run("git", args, ws).stdout.trim();

const event = (type, id, ts, extra = {}) => ({ type, id, lang: "python", level: 1, ts, date: ts.slice(0, 10), ...extra });
function addChallenge(ws, id, title, ts, extra = {}) {
  mkdirSync(join(ws, "challenges", id), { recursive: true });
  writeFileSync(join(ws, "challenges", id, "challenge.json"), JSON.stringify({ id, lang: "python", level: 1, title, date: ts.slice(0, 10), type: "implement" }));
  writeFileSync(join(ws, "challenges", id, "NOTES.md"), "# Notes\n");
  log(ws, event("generated", id, ts, { title, ...extra }));
}
const log = (ws, e) => appendFileSync(join(ws, "progress.jsonl"), JSON.stringify(e) + "\n");

/** Machine A with a pushed workspace, and machine B cloned from it. */
function twoMachines(name) {
  const dir = join(tmp, name);
  const remote = join(dir, "remote.git");
  const a = join(dir, "a");
  mkdirSync(dir);
  assert.equal(ginga(dir, "init", a, "--rotation", "python", "--time", "08:00", "--mode", "random").status, 0);
  run("git", ["init", "-q", "--bare", remote], dir);
  run("git", ["init", "-q"], a);
  run("git", ["remote", "add", "origin", remote], a);
  addChallenge(a, "2026-10-01-python-first", "First", "2026-10-01T08:00:00.000Z");
  const c = ginga(a, "commit", "--yes", "--push");
  assert.equal(c.status, 0, c.stderr);
  const b = join(dir, "b");
  run("git", ["clone", "-q", remote, b], dir);
  return { a, b };
}

test("sync: two machines' progress merges line by line, in time order, views rebuilt", () => {
  const { a, b } = twoMachines("merge");
  // While apart: A solves the shared challenge late, B (the laptop) makes and solves its own earlier.
  log(a, event("solved", "2026-10-01-python-first", "2026-10-02T21:00:00.000Z", { hints: 0, minutes: 20 }));
  addChallenge(b, "2026-10-02-python-laptop", "Laptop", "2026-10-02T08:00:00.000Z");
  log(b, event("solved", "2026-10-02-python-laptop", "2026-10-02T09:00:00.000Z", { hints: 0, minutes: 15 }));

  const sa = ginga(a, "sync");
  assert.equal(sa.status, 0, sa.stderr);
  const sb = ginga(b, "sync");
  assert.equal(sb.status, 0, sb.stderr);
  assert.match(sb.stdout, /In sync \(pulled the other machines' work\)/);
  assert.equal(ginga(a, "sync").status, 0);

  for (const ws of [a, b]) {
    assert.equal(gitOut(ws, "status", "--porcelain"), "", "clean after sync");
    const ids = readEvents(ws).map((e) => `${e.type}:${e.id}`);
    assert.deepEqual(ids, [
      "generated:2026-10-01-python-first",
      "generated:2026-10-02-python-laptop",
      "solved:2026-10-02-python-laptop",
      "solved:2026-10-01-python-first",
    ], "both sides' events, read back in time order");
    assert.match(readFileSync(join(ws, "INDEX.md"), "utf8"), /Laptop/);
    assert.doesNotMatch(readFileSync(join(ws, "README.md"), "utf8"), /^[<>=]{7}/m, "no conflict markers in the dashboard");
  }
  assert.equal(gitOut(a, "rev-parse", "HEAD"), gitOut(b, "rev-parse", "HEAD"));
  assert.equal(gitOut(b, "log", "-1", "--format=%s"), "chore(workspace): rebuild the dashboard after sync", "the both-sides dashboard was rebuilt, not merged");
  assert.match(readFileSync(join(a, ".gitattributes"), "utf8"), /^\/progress\.jsonl merge=union$/m);
  assert.match(readFileSync(join(b, ".git", "info", "attributes"), "utf8"), /^\/progress\.jsonl merge=union$/m);
});

test("sync: a real conflict merges nothing and says which file", () => {
  const { a, b } = twoMachines("conflict");
  writeFileSync(join(a, "challenges", "2026-10-01-python-first", "NOTES.md"), "# Notes\nfrom the desktop\n");
  writeFileSync(join(b, "challenges", "2026-10-01-python-first", "NOTES.md"), "# Notes\nfrom the laptop\n");
  assert.equal(ginga(a, "sync").status, 0);
  const r = ginga(b, "sync");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Both machines changed challenges\/2026-10-01-python-first\/NOTES\.md: nothing was merged/);
  assert.ok(!existsSync(join(b, ".git", "rebase-merge")), "no rebase left half done");
  assert.equal(readFileSync(join(b, "challenges", "2026-10-01-python-first", "NOTES.md"), "utf8"), "# Notes\nfrom the laptop\n", "the laptop's notes are intact");
  assert.equal(gitOut(b, "status", "--porcelain"), "", "its work is committed locally, ready for a manual merge");
});

test("daily with sync.auto: what another machine made today is pulled, not made again", () => {
  const { a, b } = twoMachines("daily");
  const ts = new Date().toISOString();
  addChallenge(a, `${today()}-python-desk`, "Made on the desktop", ts, { source: "daily", slot: "pick", date: today() });
  assert.equal(ginga(a, "sync").status, 0);
  // B can't generate anything (claude is /bin/false): the daily must find today's already made.
  for (const [k, v] of [["sync.auto", "true"], ["claude.command", "/bin/false"]]) assert.equal(ginga(b, "config", "set", k, v).status, 0);
  const r = ginga(b, "daily");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Today's challenges are ready/);
  assert.match(r.stdout, /Made on the desktop/);
  assert.equal(gitOut(b, "status", "--porcelain"), "");
  assert.equal(gitOut(b, "rev-parse", "HEAD"), gitOut(b, "rev-parse", "@{u}"), "B's config change went up too");
});

test("daily with sync.auto: the draw uses the settings the pull brought in", () => {
  const { a, b } = twoMachines("settings");
  assert.equal(ginga(a, "config", "set", "sync.auto", "true").status, 0);
  assert.equal(ginga(a, "sync").status, 0);
  assert.equal(ginga(b, "sync").status, 0);
  // The laptop adds an extra every day; the desktop's daily must see it the same morning.
  assert.equal(ginga(b, "rotation", "extra", "1").status, 0);
  assert.equal(ginga(b, "sync").status, 0);
  assert.equal(ginga(a, "config", "set", "claude.command", "/bin/false").status, 0);
  const r = ginga(a, "daily");
  assert.match(r.stdout + r.stderr, /extra/i, "today's plan includes the extra set on the other machine");
});

test("daily with sync.auto: a sync that fails warns and carries on", () => {
  const { b } = twoMachines("offline");
  run("git", ["remote", "set-url", "origin", join(tmp, "offline", "gone.git")], b);
  addChallenge(b, `${today()}-python-here`, "Already here", new Date().toISOString(), { source: "daily", slot: "pick", date: today() });
  assert.equal(ginga(b, "config", "set", "sync.auto", "true").status, 0);
  const r = ginga(b, "daily");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /Sync before the daily failed, couldn't pull first/);
  assert.match(r.stdout, /Already here/);
});

test("raceTwins: two picks or one anchor twice in a day", () => {
  const g = (id, lang, slot, extra = {}) => ({ type: "generated", id, lang, slot, source: "daily", date: "2026-10-26", ts: "2026-10-26T08:00:00Z", ...extra });
  assert.deepEqual(raceTwins([g("p1", "python", "pick"), g("c1", "c", "pick")], "2026-10-26"), [["p1", "c1"]], "the two machines drew different languages");
  assert.deepEqual(raceTwins([g("t1", "typescript", "anchor"), g("t2", "typescript", "anchor"), g("p", "python", "pick")], "2026-10-26"), [["t1", "t2"]]);
  assert.deepEqual(raceTwins([g("a", "python", "pick"), g("b", "c", "extra"), g("f", "rust", "forced"), g("x", "go", "pick", { reviewOf: "old" })], "2026-10-26"), []);
  assert.deepEqual(raceTwins([g("a", "python", "pick"), g("b", "c", "pick", { date: "2026-10-25" })], "2026-10-26"), []);
  assert.deepEqual(raceTwins([g("a", "python", "pick"), g("b", "c", "pick"), { type: "discarded", id: "b", ts: "2026-10-26T09:00:00Z" }], "2026-10-26"), [], "a discarded twin is settled");
});
