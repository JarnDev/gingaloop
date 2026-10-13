import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { buildCommitMessage } from "../src/gitops.mjs";
import {
  addImprovements, addLessons, issueUrl, latestReview, learnedFrom, lessonsFor, parseLearnResult, readLessons,
} from "../src/lessons.mjs";
import { readEvents } from "../src/progress.mjs";
import { DEFAULT_CONFIG, PKG_ROOT } from "../src/workspace.mjs";

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-learn-")));
after(() => rmSync(tmp, { recursive: true, force: true }));
const BIN = join(import.meta.dirname, "..", "bin", "ginga.mjs");
const ginga = (args) =>
  spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", timeout: 20000, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });

test("latestReview returns the last review section, or null", () => {
  assert.equal(latestReview("# Notes\n\n- Time spent:\n"), null);
  const notes = "# Notes\n\n## Review (2026-10-01)\n\nold one\n\n## Review (2026-10-12)\n\n# Review\nnew one\n";
  assert.deepEqual(latestReview(notes), { date: "2026-10-12", text: "# Review\nnew one" });
});

test("lessons: grouped by scope, appended under their heading, user edits kept, capped in the prompt", () => {
  const ws = join(tmp, "ws-lessons");
  mkdirSync(ws, { recursive: true });
  assert.equal(lessonsFor(ws, "python"), "(none yet)");
  addLessons(ws, [{ rule: "Reduce before adding.", scope: "all" }, { rule: "Use exact\nstrings.", scope: "python" }], "c1");
  // A hand edit between sections must survive the next insert.
  writeFileSync(join(ws, "LESSONS.md"), readFileSync(join(ws, "LESSONS.md"), "utf8").replace("## python", "My own note.\n\n## python"));
  addLessons(ws, [{ rule: "Test the extremes.", scope: "all" }, { rule: "Check -0.", scope: "typescript" }], "c2");
  const text = readFileSync(join(ws, "LESSONS.md"), "utf8");
  assert.match(text, /## All languages\n\n- Reduce before adding\. \(from c1\)\n- Test the extremes\. \(from c2\)\n\n+My own note\./);
  assert.ok(text.endsWith("(from c2)\n"), "one trailing newline");
  assert.deepEqual(readLessons(ws), {
    all: ["Reduce before adding. (from c1)", "Test the extremes. (from c2)"],
    python: ["Use exact strings. (from c1)"],
    typescript: ["Check -0. (from c2)"],
  });
  const block = lessonsFor(ws, "python");
  assert.match(block, /For every language:\n- Reduce before adding\. \(from c1\)\n- Test the extremes/);
  assert.match(block, /For this language:\n- Use exact strings/);
  assert.doesNotMatch(block, /Check -0/, "other languages' lessons stay out");
  assert.doesNotMatch(lessonsFor(ws, "python", 1), /Reduce before adding/, "only the newest per scope");
  assert.ok(learnedFrom(ws, "c2"));
  assert.ok(!learnedFrom(ws, "c3"));
  addImprovements(ws, [{ rule: "Validator: run the reference on README's extremes." }], "c3");
  assert.ok(learnedFrom(ws, "c3"));
  assert.match(readFileSync(join(ws, "IMPROVEMENTS.md"), "utf8"), /- Validator: run the reference on README's extremes\. \(from c3\)/);
});

test("parseLearnResult accepts fenced or bare JSON and normalizes each item", () => {
  const items = [
    { rule: "Reduce first.", scope: "all", kind: "lesson", evidence: "lost precision" },
    { rule: "x", scope: "rust", kind: "weird" },
    { rule: "  ", scope: "all" },
    { rule: "Validator check.", scope: "all", kind: "tool" },
  ];
  const expected = [
    { rule: "Reduce first.", scope: "all", kind: "lesson", evidence: "lost precision" },
    { rule: "x", scope: "typescript", kind: "lesson", evidence: "" },
    { rule: "Validator check.", scope: "all", kind: "tool", evidence: "" },
  ];
  assert.deepEqual(parseLearnResult(JSON.stringify({ items }), "typescript"), expected);
  assert.deepEqual(parseLearnResult("Here:\n```json\n" + JSON.stringify({ items }) + "\n```\n", "typescript"), expected);
  assert.deepEqual(parseLearnResult('{"items":[]}', "c"), []);
  assert.equal(parseLearnResult("no json here", "c"), null);
});

test("issueUrl pre-fills the lesson form with the rule and context only", () => {
  const url = new URL(issueUrl(
    { rule: "Reduce before adding.", kind: "lesson", evidence: "The reference lost precision." },
    { lang: "typescript", level: 2, type: "implement", area: "arrays" },
    "0.5.0",
  ));
  assert.equal(url.origin + url.pathname, "https://github.com/JarnDev/gingaloop/issues/new");
  const p = url.searchParams;
  assert.equal(p.get("template"), "lesson.yml");
  assert.equal(p.get("title"), "[lesson] Reduce before adding.");
  assert.equal(p.get("rule"), "Reduce before adding.");
  assert.equal(p.get("context"), "typescript · L2 · implement · arrays");
  assert.equal(p.get("version"), "0.5.0");
  // Every prefilled field exists in the issue form.
  const form = readFileSync(join(PKG_ROOT, ".github", "ISSUE_TEMPLATE", "lesson.yml"), "utf8");
  for (const key of p.keys()) if (!["template", "title"].includes(key)) assert.match(form, new RegExp(`id: ${key}\\n`));
});

test("generation prompt has the lessons slot", () => {
  assert.match(readFileSync(join(PKG_ROOT, "prompts", "generate.md"), "utf8"), /\{\{LESSONS\}\}/);
});

test("ginga learn: saves the chosen findings, records the event, refuses without a review", () => {
  const ws = join(tmp, "ws-cli");
  const id = "2026-10-12-typescript-hop";
  const dir = join(ws, "challenges", id);
  mkdirSync(dir, { recursive: true });
  const answer = {
    items: [
      { rule: "When README allows any integer, test 2**60.", scope: "all", kind: "lesson", evidence: "Reference lost the +1." },
      { rule: "Avoid -0 in returned indexes.", scope: "typescript", kind: "lesson", evidence: "" },
      { rule: "Validator: probe the reference at README's extremes.", scope: "all", kind: "tool", evidence: "No test covered it." },
    ],
  };
  const fake = join(tmp, "fake-claude");
  const argsFile = join(tmp, "args");
  writeFileSync(join(tmp, "answer.json"), JSON.stringify({ type: "result", result: JSON.stringify(answer), total_cost_usd: 0.03 }) + "\n");
  writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsFile}"\ncat "${join(tmp, "answer.json")}"\n`);
  chmodSync(fake, 0o755);
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ version: 2, rotation: ["typescript"], claude: { command: fake } }));
  writeFileSync(join(dir, "challenge.json"), JSON.stringify({ id, title: "Hop", lang: "typescript", level: 2, date: "2026-10-12", type: "implement" }));
  writeFileSync(join(dir, "README.md"), "# Hop\n\njumps are integers of any size\n");
  writeFileSync(join(ws, "progress.jsonl"), JSON.stringify({ type: "generated", id, lang: "typescript", level: 2, title: "Hop", date: "2026-10-12", ts: "2026-10-12T08:00:00Z" }) + "\n");

  writeFileSync(join(dir, "NOTES.md"), "# Notes\n");
  const none = ginga(["learn", "--yes", "-w", ws]);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /No reviewed challenge yet/);

  writeFileSync(join(dir, "NOTES.md"), "# Notes\n\n## Review (2026-10-12)\n\nThe reference is wrong on 2**60.\n");
  const r = ginga(["learn", "--yes", "-w", ws]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 lessons in LESSONS\.md/);
  assert.match(r.stdout, /1 idea for gingaloop in IMPROVEMENTS\.md/);
  assert.match(r.stdout, /\$0\.03/);
  const prompt = readFileSync(argsFile, "utf8");
  assert.match(prompt, /The reference is wrong on 2\*\*60/, "the review goes into the prompt");
  assert.match(prompt, /jumps are integers of any size/, "so does the README (the contract)");
  assert.match(prompt, /# Test design[\s\S]*The whole numeric range[\s\S]*# Quality bar/, "and the built-in rules, to avoid repeats");
  assert.doesNotMatch(prompt, /# Profile conventions/);
  assert.deepEqual(readLessons(ws), {
    all: [`When README allows any integer, test 2**60. (from ${id})`],
    typescript: [`Avoid -0 in returned indexes. (from ${id})`],
  });
  assert.match(readFileSync(join(ws, "IMPROVEMENTS.md"), "utf8"), /probe the reference/);
  const learned = readEvents(ws).at(-1);
  assert.deepEqual([learned.type, learned.id, learned.lessons, learned.improvements], ["learned", id, 2, 1]);
  assert.ok(existsSync(join(ws, ".logs", `learn-${id}.log`)));

  const msg = buildCommitMessage({
    allEvents: readEvents(ws), newEvents: [learned], files: ["progress.jsonl", "LESSONS.md", "IMPROVEMENTS.md"],
    leveling: DEFAULT_CONFIG.leveling, today: "2026-10-13",
  });
  assert.match(msg, /^practice\(\d{4}-\d{2}-\d{2}\): learn 1\n/);
  assert.match(msg, /- learn\(typescript\): Hop · 2 lessons, 1 tool idea/);
  assert.doesNotMatch(msg, /files:/);
});
