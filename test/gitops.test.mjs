import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { buildCommitMessage } from "../src/gitops.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const L = DEFAULT_CONFIG.leveling;
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-git-")));
after(() => rmSync(tmp, { recursive: true, force: true }));

const gen = (id, lang, title, extra = {}) => ({ type: "generated", id, lang, level: 1, title, date: "2026-10-04", ts: "2026-10-04T08:00:00Z", ...extra });
const solve = (id, lang, extra = {}) => ({ type: "solved", id, lang, level: 1, hints: 0, minutes: 20, date: "2026-10-04", ts: "2026-10-04T20:00:00Z", ...extra });

test("message: subject summarizes, body lists each fact with points", () => {
  const old = [gen("a", "javascript", "Old one"), ...[1, 2, 3, 4, 5].map((i) => solve(`s${i}`, "javascript"))];
  const fresh = [
    gen("x", "javascript", "Count the enabled feature flags"),
    solve("x", "javascript", { minutes: 22 }),
    gen("y", "python", "URL slugs for blog titles", { area: "strings" }),
    { type: "hint", id: "y", lang: "python", level: 1, hint: 1, date: "2026-10-04", ts: "2026-10-04T21:00:00Z" },
    solve("y", "python", { hints: 1, minutes: 31 }),
  ];
  const msg = buildCommitMessage({
    allEvents: [...old, ...fresh], newEvents: fresh, leveling: L, today: "2026-10-04",
    files: ["progress.jsonl", "README.md", "challenges/y/NOTES.md", "gingaloop.json"],
  });
  const [subject, blank, ...body] = msg.trimEnd().split("\n");
  assert.equal(subject, "practice(2026-10-04): solve 2, new 2 · javascript L2");
  assert.equal(blank, "");
  assert.deepEqual(body, [
    "- new(javascript): Count the enabled feature flags · L1",
    "- solve(javascript): Count the enabled feature flags · L1 · 22 min · 0 hints · +100 pts",
    "- new(python): URL slugs for blog titles · L1 · strings",
    "- hint(python): URL slugs for blog titles · hint 1",
    "- solve(python): URL slugs for blog titles · L1 · 31 min · 1 hint · +85 pts",
    "- level-up(javascript): L1 → L2",
    "- notes(python): URL slugs for blog titles",
    "- files: gingaloop.json",
  ]);
});

test("message: only notes, only config, multi-day spans", () => {
  const all = [gen("y", "python", "Slugs")];
  assert.equal(
    buildCommitMessage({ allEvents: all, newEvents: [], files: ["challenges/y/NOTES.md"], leveling: L, today: "2026-10-05" }),
    "practice(2026-10-05): 1 note\n\n- notes(python): Slugs\n",
  );
  assert.equal(
    buildCommitMessage({ allEvents: all, newEvents: [], files: ["gingaloop.json"], leveling: L, today: "2026-10-05" }),
    "chore(workspace): update gingaloop.json\n\n- files: gingaloop.json\n",
  );
  const span = [gen("p", "c", "P", { date: "2026-10-03" }), gen("q", "c", "Q", { date: "2026-10-05" })];
  assert.match(buildCommitMessage({ allEvents: span, newEvents: span, files: [], leveling: L, today: "2026-10-05" }), /^practice\(2026-10-03\.\.10-05\): new 2\n/);
});

test("ginga commit + push end to end in a throwaway repo", () => {
  // Isolated git config: no signing, no user hooks (this repo is synthetic test data).
  const gitconfig = join(tmp, "gitconfig");
  writeFileSync(gitconfig, "[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: "1", XDG_CONFIG_HOME: join(tmp, "xdg") };
  const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: 20000 });
  const ginga = (args, cwd) => run(process.execPath, [join(import.meta.dirname, "..", "bin", "ginga.mjs"), ...args], cwd);

  const ws = join(tmp, "ws");
  assert.equal(ginga(["init", ws, "--rotation", "python", "--time", "08:00", "--mode", "random"], tmp).status, 0);
  assert.match(ginga(["commit", "--yes"], ws).stderr, /not a git repository/);
  run("git", ["init", "-q"], ws);
  const remote = join(tmp, "remote.git");
  run("git", ["init", "-q", "--bare", remote], tmp);
  run("git", ["remote", "add", "origin", remote], ws);

  mkdirSync(join(ws, "challenges", "2026-10-04-python-x"), { recursive: true });
  writeFileSync(join(ws, "challenges", "2026-10-04-python-x", "challenge.json"), JSON.stringify({ id: "2026-10-04-python-x", lang: "python", level: 1, title: "X marks", date: "2026-10-04", type: "implement" }));
  appendFileSync(join(ws, "progress.jsonl"), JSON.stringify(gen("2026-10-04-python-x", "python", "X marks")) + "\n");
  assert.match(ginga(["commit"], ws).stderr, /--yes/, "non-interactive needs --yes");
  assert.equal(run("git", ["diff", "--cached", "--name-only"], ws).stdout, "", "a refused commit leaves nothing staged");

  const c = ginga(["commit", "--yes", "--push"], ws);
  assert.equal(c.status, 0, c.stderr);
  assert.match(c.stdout, /Committed: practice\(2026-10-04\): new 1/);
  assert.equal(run("git", ["log", "-1", "--format=%s", "origin/main"], ws).stdout.trim(), "practice(2026-10-04): new 1");
  assert.match(ginga(["commit", "--yes"], ws).stdout, /Nothing to commit/);
});
