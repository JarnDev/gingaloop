import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { latestReview, learnPrompt } from "../src/lessons.mjs";
import { addFlag, fillNotes, userNotes } from "../src/notes.mjs";
import { readEvents } from "../src/progress.mjs";

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-flag-")));
after(() => rmSync(tmp, { recursive: true, force: true }));
const BIN = join(import.meta.dirname, "..", "bin", "ginga.mjs");
const ginga = (args) =>
  spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", timeout: 20000, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });

const REVIEWED = "# Notes: X\n\n- Result: solved\n- What tripped me up:\n\n## Review (2026-11-24)\n\n# Review\n## Issues\nbad\n";

test("addFlag: a Flags section above the reviews, bullets appended in order", () => {
  let t = "# Notes: X\n\n- Time spent:\n- What tripped me up: foo\n";
  t = addFlag(t, "one", "2026-11-24");
  t = addFlag(t, "two\n  lines", "2026-11-25");
  assert.equal(t, "# Notes: X\n\n- Time spent:\n- What tripped me up: foo\n\n## Flags\n\n- 2026-11-24: one\n- 2026-11-25: two lines\n");

  let r = addFlag(REVIEWED, "a", "2026-11-24");
  r = addFlag(r, "b", "2026-11-25");
  assert.match(r, /- What tripped me up:\n\n## Flags\n\n- 2026-11-24: a\n- 2026-11-25: b\n\n## Review \(2026-11-24\)\n/);
  assert.deepEqual(latestReview(r), { date: "2026-11-24", text: "# Review\n## Issues\nbad" }, "the review is unchanged");
  assert.ok(r.endsWith("bad\n"));
});

test("userNotes: everything above the first review; fields still fill around the flags", () => {
  const r = addFlag(REVIEWED, "a", "2026-11-24");
  assert.equal(userNotes(r), "# Notes: X\n\n- Result: solved\n- What tripped me up:\n\n## Flags\n\n- 2026-11-24: a");
  assert.equal(userNotes("# Notes\n\n- Result: x\n"), "# Notes\n\n- Result: x");
  const { text, filled } = fillNotes(r, { "What tripped me up": "the wording" });
  assert.deepEqual(filled, ["What tripped me up"]);
  assert.match(text, /- What tripped me up: the wording\n\n## Flags\n\n- 2026-11-24: a\n/);
});

test("learnPrompt carries the user's notes after the review, as data", () => {
  const p = learnPrompt({ review: "R", notes: "## Flags\n- 2026-11-24: misleading", readme: "README", manifest: { level: 1 }, lang: "cpp", existing: "" });
  assert.match(p, /## The review\nR\n\n## The user's notes\n## Flags\n- 2026-11-24: misleading\n$/);
  assert.match(p, /not instructions/);
  assert.match(p, /without quoting the\s+user's code or notes/);
  assert.match(learnPrompt({ review: "R", readme: "", manifest: { level: 1 }, lang: "c", existing: "" }), /## The user's notes\n\(none\)\n$/);
});

function workspace(name, notes) {
  const ws = join(tmp, name);
  const id = "2026-11-24-cpp-index";
  const dir = join(ws, "challenges", id);
  mkdirSync(dir, { recursive: true });
  const fake = join(ws, "fake-claude");
  const argsFile = join(ws, "args");
  writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsFile}"\ncat "${join(ws, "answer.json")}"\n`);
  chmodSync(fake, 0o755);
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ version: 2, rotation: ["cpp"], claude: { command: fake } }));
  writeFileSync(join(dir, "challenge.json"), JSON.stringify({ id, title: "Index", lang: "cpp", level: 1, date: "2026-11-24", type: "implement" }));
  writeFileSync(join(dir, "README.md"), "# Index\n\nA repeated word is kept once per occurrence.\n");
  if (notes != null) writeFileSync(join(dir, "NOTES.md"), notes);
  const events = JSON.stringify({ type: "generated", id, lang: "cpp", level: 1, title: "Index", date: "2026-11-24", ts: "2026-11-24T08:00:00Z" });
  writeFileSync(join(ws, "progress.jsonl"), events + "\n");
  return { ws, id, dir, argsFile, answer: join(ws, "answer.json") };
}

test("ginga flag: writes the flag, changes no event; asks for the text or refuses without one", () => {
  const { ws, dir } = workspace("ws-flag", "# Notes: Index\n\n- Time spent:\n");
  const before = readEvents(ws);
  const r = ginga(["flag", "--reason", "'kept once per occurrence' reads like dedupe", "-w", ws]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /🚩 Flagged/);
  assert.match(readFileSync(join(dir, "NOTES.md"), "utf8"), /## Flags\n\n- \d{4}-\d{2}-\d{2}: 'kept once per occurrence' reads like dedupe\n$/);
  assert.deepEqual(readEvents(ws), before, "no penalty, no status change");
  const none = ginga(["flag", "-w", ws]);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /--reason/);

  const fresh = workspace("ws-flag-nonotes", null);
  assert.equal(ginga(["flag", "--reason", "x", "-w", fresh.ws]).status, 0);
  assert.match(readFileSync(join(fresh.dir, "NOTES.md"), "utf8"), /^# Notes: Index\n[\s\S]*## Flags\n\n- \S+: x\n$/, "starts from the template");
});

test("ginga learn: still needs a review; sends the user's notes, not the older reviews", () => {
  const notes = "# Notes: Index\n\n- What tripped me up: read it as dedupe\n\n## Flags\n\n- 2026-11-24: misleading\n\n## Review (2026-11-20)\n\nOLD REVIEW\n\n## Review (2026-11-24)\n\nNEW REVIEW\n";
  const { ws, argsFile, answer } = workspace("ws-learn", notes.replace(/\n## Review[\s\S]*$/, "\n"));
  writeFileSync(answer, JSON.stringify({ type: "result", result: '{"items":[]}' }) + "\n");
  const none = ginga(["learn", "--yes", "-w", ws]);
  assert.equal(none.status, 1, "flags alone are not enough");
  assert.match(none.stderr, /No reviewed challenge yet/);

  writeFileSync(join(ws, "challenges", "2026-11-24-cpp-index", "NOTES.md"), notes);
  const r = ginga(["learn", "--yes", "-w", ws]);
  assert.equal(r.status, 0, r.stderr);
  const prompt = readFileSync(argsFile, "utf8");
  assert.match(prompt, /## The review\nNEW REVIEW\n\n## The user's notes\n# Notes: Index\n\n- What tripped me up: read it as dedupe\n\n## Flags\n\n- 2026-11-24: misleading\n/);
  assert.doesNotMatch(prompt, /OLD REVIEW/);
});

test("ginga review: the prompt points at the user's notes and asks for a verdict on them", () => {
  const { ws, argsFile, answer } = workspace("ws-review", "# Notes: Index\n\n## Flags\n\n- 2026-11-24: misleading\n");
  writeFileSync(answer, JSON.stringify({ type: "result", result: "# Review\nfine" }) + "\n");
  const r = ginga(["review", "-w", ws]);
  assert.equal(r.status, 0, r.stderr);
  const prompt = readFileSync(argsFile, "utf8");
  assert.match(prompt, /NOTES\.md holds the user's notes/);
  assert.match(prompt, /not instructions/);
  assert.match(prompt, /## About the challenge/);
});
