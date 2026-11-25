import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { builtInRules } from "../src/lessons.mjs";
import { MAX_SENTENCE_WORDS, longSentences, staticProblems } from "../src/runner.mjs";
import { typeInfo } from "../src/types.mjs";
import { PKG_ROOT } from "../src/workspace.mjs";

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-writing-")));
after(() => rmSync(tmp, { recursive: true, force: true }));
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test("longSentences: only the named sections; code is skipped or one word; lists and rows split", () => {
  const readme = [
    "# T", "", "## Problem", "",
    `${words(31)}.`, `Short one. ${words(20)} \`a b c d e f g h i j k l m\` end.`, "",
    "- item one", `- ${words(32)}`, "", "| a | b |", "|---|---|", `| ${words(16)} | ${words(16)} |`, "",
    "```", words(50), "```", "",
    "## Examples", "", `${words(40)}.`, "",
    "## Constraints", "", `Fine. ${words(30)}`, "",
  ].join("\n");
  const found = longSentences(readme, ["Problem", "Constraints"]);
  assert.deepEqual(found.map((f) => [f.section, f.words]), [["Problem", 31], ["Problem", 32], ["Problem", 32]]);
  assert.match(found[1].sentence, /^w0 /, "the list marker is not a word");
  assert.match(found[2].sentence, /^\| w0 /, "a table row is one unit");
  assert.equal(longSentences(readme, ["Problem"], 40).length, 0);
  assert.equal(MAX_SENTENCE_WORDS, 30);
});

test("the validator rejects a long contract sentence and names it", () => {
  const dir = join(tmp, "c");
  cpSync(join(PKG_ROOT, "examples", "python"), dir, { recursive: true });
  assert.deepEqual(staticProblems(dir).filter((p) => /a sentence of/.test(p)), []);
  const readme = join(dir, "README.md");
  writeFileSync(readme, readFileSync(readme, "utf8").replace("## Constraints\n", `## Constraints\n\n- ${words(31)}.\n`));
  const problems = staticProblems(dir).filter((p) => /a sentence of/.test(p));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /README\.md, "## Constraints": a sentence of 31 words \(at most 30; aim for 20–25\): split it \("w0 w1/);
});

test("every built-in example follows the length rule at the prompt's own 25 words", () => {
  const root = join(PKG_ROOT, "examples");
  const dirs = readdirSync(root).flatMap((d) => (d === "types" ? readdirSync(join(root, d)).map((t) => join(d, t)) : [d]));
  assert.ok(dirs.length >= 18);
  for (const ex of dirs) {
    const dir = join(root, ex);
    const m = JSON.parse(readFileSync(join(dir, "challenge.json"), "utf8"));
    const sections = ["Problem", "Constraints", ...typeInfo(m.type).readme];
    assert.deepEqual(longSentences(readFileSync(join(dir, "README.md"), "utf8"), sections, 25), [], ex);
  }
});

test("the writing rules are in the generation prompt, inside what learn treats as built-in", () => {
  const prompt = readFileSync(join(PKG_ROOT, "prompts", "generate.md"), "utf8");
  const rules = builtInRules(prompt);
  assert.match(rules, /# Writing \(rules based on ASD-STE100/);
  assert.match(rules, /One word, one meaning/);
  assert.match(rules, /kept once per occurrence/, "the counter-example that started this");
  assert.match(rules, /more than 30 words/, "the prompt states the validator's limit");
});
