// Generic test runner + validator. Knows no languages: everything comes from
// challenge.json (test.command, successPattern) and the profile (image).
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { UserError } from "./workspace.mjs";
import { makeTempDir, removeDir, runInSandbox } from "./sandbox.mjs";
import { LOCK_FILE, collectFiles, parseHints, writeFiles } from "./vault.mjs";

import { CODE_TYPES, TYPE_IDS, typeInfo } from "./types.mjs";

export const CHALLENGE_TYPES = TYPE_IDS;
const SKIP = new Set([LOCK_FILE, "NOTES.md", ".git", "node_modules"]);

/** Where a locked challenge keeps its bug list (inside the encrypted bugs/ dir). */
export const BUGS_FILE = "bugs/bugs.json";

/** Bug variants: from challenge.json (staging/examples) or bugs/bugs.json (published). */
export function bugList(dir, manifest, bundle) {
  if (Array.isArray(manifest.bugs)) return manifest.bugs;
  if (bundle?.[BUGS_FILE]) return JSON.parse(bundle[BUGS_FILE].toString("utf8"));
  const p = join(dir, BUGS_FILE);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
}

export function readManifest(dir) {
  const path = join(dir, "challenge.json");
  if (!existsSync(path)) throw new Error(`${dir} has no challenge.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Throwaway copy of a challenge (plus unlocked bundle files, if any). */
export function materialize(challengeDir, bundle) {
  const src = resolve(challengeDir);
  if (resolve(tmpdir()).startsWith(src + sep) || resolve(tmpdir()) === src) {
    throw new UserError(`Refusing to copy ${src}: it contains the temp directory. Point --dir at the challenge folder.`);
  }
  const tmp = makeTempDir();
  const work = join(tmp, "work");
  cpSync(challengeDir, work, {
    recursive: true,
    filter: (src) => !SKIP.has(src.split(/[\\/]/).pop()),
  });
  if (bundle) writeFiles(work, bundle);
  return { tmp, work };
}

export function passed(result, manifest) {
  if (result.timedOut || result.code !== 0) return false;
  const pattern = manifest.test?.successPattern;
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(result.output);
  } catch {
    return false; // an invalid pattern can never confirm success
  }
}

/** Run the tests against one target dir: "starter", "solution" or "bugs/<name>". */
export async function runTarget({ config, profile, challengeDir, manifest, target, bundle, env = {}, command, cwd = "tests" }) {
  const { tmp, work } = materialize(challengeDir, bundle);
  try {
    const started = Date.now();
    const result = await runInSandbox({
      sandbox: config.sandbox,
      profile,
      workDir: work,
      cwd,
      command: command ?? manifest.test?.command ?? profile.testCommand,
      env: { TARGET: target, ...env },
      timeoutSeconds: manifest.test?.timeoutSeconds,
    });
    return { ...result, seconds: (Date.now() - started) / 1000, passed: passed(result, manifest) };
  } finally {
    removeDir(tmp);
  }
}

const breaksOf = (bug) => [bug.breaks].flat().filter((n) => Number.isInteger(n));

/**
 * write-the-tests: grade a test suite (`suite` = "starter" or "solution") the way mutation testing
 * does. It must pass on the correct subject/ and fail on every bug variant. `bundle` carries the
 * locked bug variants for published challenges (decrypted into the throwaway copy only).
 *
 * `perItem` (gingaloop#12): when the suite has files tagged item<N> and the bugs name the items they
 * break, each bug is first run against the suite's files for its own items only. A bug those miss
 * but the whole suite catches was caught by accident, through another promise (`by: "other"`): its
 * item has no test that works. Costs one extra run per bug the own files miss.
 */
export async function gradeMutation({ config, profile, challengeDir, manifest, suite, bundle, perItem = false }) {
  const run = (impl, tests = suite, overlay = {}) =>
    runTarget({ config, profile, challengeDir, manifest, target: impl, bundle: { ...bundle, ...overlay }, env: { TESTS: tests, IMPL: impl } });
  const subject = await run("subject");
  const bugs = bugList(challengeDir, manifest, bundle);
  const byItem = perItem ? itemFiles(challengeDir, suite, bugs) : null;
  const variants = [];
  for (const bug of bugs) {
    const own = byItem && ownFiles(byItem, bug);
    if (own) {
      const r = await run(`bugs/${bug.name}`, "isolate", own);
      if (!r.passed) {
        variants.push({ bug, caught: true, by: "own", output: r.output });
        continue;
      }
    }
    const r = await run(`bugs/${bug.name}`);
    variants.push({ bug, caught: !r.passed, ...(byItem && !r.passed ? { by: "other" } : {}), output: r.output });
  }
  const caught = variants.filter((v) => v.caught).length;
  return {
    passed: subject.passed && caught === variants.length,
    subjectPassed: subject.passed,
    subjectOutput: subject.output,
    caught,
    total: variants.length,
    variants,
    perItem: Boolean(byItem),
  };
}

/** The suite's files by item tag, or null when the per-item check can't apply. */
function itemFiles(challengeDir, suite, bugs) {
  if (!bugs.length || !bugs.every((b) => breaksOf(b).length)) return null;
  const files = collectFiles(challengeDir, [suite]);
  const byItem = new Map();
  for (const [rel, buf] of Object.entries(files)) {
    const n = itemTag(rel);
    if (n == null) continue;
    if (!byItem.has(n)) byItem.set(n, {});
    byItem.get(n)[`isolate/${rel.slice(suite.length + 1)}`] = buf;
  }
  return byItem.size ? byItem : null;
}

/** The files for a bug's own items as an `isolate/` overlay, or null when the suite has none. */
function ownFiles(byItem, bug) {
  const own = Object.assign({}, ...breaksOf(bug).map((n) => byItem.get(n) ?? {}));
  return Object.keys(own).length ? own : null;
}

/** "Items caught only by accident" from a per-item grading: the items of bugs caught by other tests. */
export function accidentalItems(g) {
  return [...new Set(g.variants.filter((v) => v.by === "other").flatMap((v) => breaksOf(v.bug)))].sort((a, b) => a - b);
}

/** Grade the user's work (or any target) according to the challenge type. */
export async function gradeTarget({ config, profile, challengeDir, manifest, target, bundle }) {
  if (typeInfo(manifest.type).grader === "mutation") {
    const g = await gradeMutation({ config, profile, challengeDir, manifest, suite: target, bundle, perItem: manifest.type === "write-the-tests" });
    return { passed: g.passed, output: mutationReport(g), timedOut: false, accidental: accidentalItems(g) };
  }
  return runTarget({ config, profile, challengeDir, manifest, target, bundle });
}

/** What `ginga test` / `done` print for a mutation grading. */
export function mutationReport(g) {
  const lines = [`Your tests on the correct subject: ${g.subjectPassed ? "pass ✔" : "FAIL ✘ (they must pass on correct code)"}`];
  g.variants.forEach((v, i) => {
    const items = breaksOf(v.bug);
    const about = g.perItem && items.length ? ` (item ${items.join(", ")})` : "";
    const verdict = !v.caught ? "missed ✘"
      : v.by === "other" ? `caught ⚠ only by tests for other items: item ${items.join(", ")} has no test that catches it`
      : "caught ✔";
    lines.push(`Hidden buggy version ${i + 1}${about}: ${verdict}`);
  });
  const accidental = g.variants.filter((v) => v.by === "other").length;
  lines.push(`Caught ${g.caught}/${g.total} buggy versions${accidental ? `, ${accidental} only by accident` : ""}.`);
  if (accidental) {
    lines.push("A version caught only through another item's tests is luck: that item's own file must catch it. It still counts " +
      "as caught, but the solve won't be clean and the topic comes back as a review.");
  }
  return (g.subjectPassed ? "" : `${tail(g.subjectOutput, 40)}\n\n`) + lines.join("\n");
}

function nonEmptyDir(path) {
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length > 0;
}

function hasHeadings(text, headings) {
  return headings.filter((h) => !new RegExp(`^##\\s+${h}`, "im").test(text));
}

/** Type-specific static requirements (extra dirs and challenge.json fields). */
function typeProblems(dir, m) {
  const out = [];
  if (m.type === "write-the-tests" && !nonEmptyDir(join(dir, "subject"))) out.push("subject/ (the correct implementation under test) is missing or empty");
  if (m.type === "trace" && !nonEmptyDir(join(dir, "program"))) out.push("program/ (the code to trace) is missing or empty");
  if (m.type === "port") {
    if (!nonEmptyDir(join(dir, "source"))) out.push("source/ (the solution in the source language) is missing or empty");
    if (!m.sourceLang || m.sourceLang === m.lang) out.push("challenge.json: sourceLang must name the source language (different from the target)");
  }
  if (m.type === "debug-from-symptom" && !m.symptom?.command) out.push("challenge.json: symptom.command is required (it must reproduce the README symptom on the starter)");
  if (m.type === "optimize" && !(m.budget?.expect && Number(m.budget?.seconds) > 0)) {
    out.push("challenge.json: budget { seconds, expect } is required (expect = the budget test's name)");
  }
  return out;
}

/** Non-empty lines of the first fenced block under "## Symptom" in a README. */
export function symptomLines(readmeText) {
  const section = readmeText.split(/^##\s+Symptom[^\n]*\n/im)[1] ?? "";
  const block = /```[^\n]*\n([\s\S]*?)```/.exec(section.split(/^##\s/m)[0]);
  return block ? block[1].split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

/** The items of the "## What to test" list in a README (bullets or numbered), in order. */
export function whatToTestItems(readmeText) {
  const section = (readmeText.split(/^##\s+What to test[^\n]*\n/im)[1] ?? "").split(/^##\s/m)[0];
  const items = [];
  for (const line of section.split("\n")) {
    const item = /^(?:[-*]|\d+[.)])\s+(.*\S)/.exec(line);
    if (item) items.push(item[1]);
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

/** The "What to test" item a reference test file belongs to ("test_item2_order.py" → 2), or null. */
export function itemTag(fileName) {
  const m = /(?:^|[^a-z0-9])item(\d+)(?![0-9])/i.exec(fileName.split("/").pop());
  return m ? Number(m[1]) : null;
}

/**
 * write-the-tests: each hidden bug must break ONLY its promise (gingaloop#3), or a suite that never
 * tests that promise still catches it by luck through another one. Runs the reference suite without
 * the test files of the bug's item(s) against the bug: it must pass. One sandbox run per bug.
 */
async function isolationProblems({ config, profile, dir, manifest, bugs, log }) {
  const out = [];
  const suite = collectFiles(dir, ["solution"]);
  for (const bug of bugs) {
    const own = new Set([bug.breaks].flat().filter((n) => n != null));
    if (!own.size) continue;
    const rest = {};
    for (const [rel, buf] of Object.entries(suite)) {
      if (!own.has(itemTag(rel))) rest[`isolate/${rel.slice("solution/".length)}`] = buf;
    }
    log(`bugs/${bug.name} breaks only item ${[...own].join(", ")} …`);
    const r = await runTarget({
      config, profile, challengeDir: dir, manifest, target: `bugs/${bug.name}`, bundle: rest,
      env: { TESTS: "isolate", IMPL: `bugs/${bug.name}` },
    });
    if (!r.passed) {
      out.push(`bugs/${bug.name} is also caught by reference tests outside "What to test" item ${[...own].join(", ")}: ` +
        `make it break only that promise (or list every item it breaks in "breaks"):\n${tail(r.output, 25)}`);
    }
  }
  return out;
}

/**
 * write-the-tests: the starter's example tests (the README's "## Examples", see exampleProblems) show
 * the harness API and must not catch a hidden bug, or copying them catches it without the user
 * thinking about that rule (gingaloop#9). Uses the starter grading run: no extra sandbox runs.
 */
export function starterExampleProblems(st) {
  if (!st.subjectPassed) return [`the starter tests FAIL on the correct subject/ (the example tests must pass on it):\n${tail(st.subjectOutput, 25)}`];
  const caught = st.variants.filter((v) => v.caught).map((v) => `bugs/${v.bug.name}`);
  return caught.length
    ? [`the starter's example tests already catch ${caught.join(", ")}: copied from the README, they would catch it for free. ` +
      "Show the harness with inputs no hidden bug breaks (the README's \"## Examples\" are exactly these tests)"]
    : [];
}

/**
 * write-the-tests: the user's suite is graded per item (gingaloop#12), so the starter gives them one
 * file per "What to test" item, tagged item<N> like the reference.
 */
export function starterItemProblems(readmeText, starterFiles) {
  const items = whatToTestItems(readmeText).length;
  const tagged = new Set(starterFiles.map(itemTag).filter((n) => n != null));
  const missing = Array.from({ length: items }, (_, i) => i + 1).filter((n) => !tagged.has(n));
  return missing.length
    ? [`starter/: no file for "What to test" item ${missing.join(", ")} (one file per item, "item<N>" in its name, so the grading can tell which item's tests catch a bug)`]
    : [];
}

/** Non-empty lines of every fenced block under "## Examples" in a README. */
export function exampleLines(readmeText) {
  const section = (readmeText.split(/^##\s+Examples?[^\n]*\n/im)[1] ?? "").split(/^##\s/m)[0];
  return [...section.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
    .flatMap((b) => b[1].split("\n")).map((l) => l.trim()).filter(Boolean);
}

/**
 * write-the-tests: the README's examples are the starter's example tests, so the check that the
 * starter catches no bug covers what the README shows (gingaloop#9).
 */
export function exampleProblems(readmeText, starterText) {
  const have = new Set(starterText.split("\n").map((l) => l.trim()));
  const missing = exampleLines(readmeText).filter((l) => !have.has(l));
  return missing.length
    ? [`README.md: "## Examples" must show the example tests that are in starter/ (copied as they are there); not in starter/:\n${missing.slice(0, 5).join("\n")}`]
    : [];
}

/**
 * write-the-tests: every promise in "## What to test" must be broken by some hidden bug, or a suite
 * that never tests it still catches every bug and passes (gingaloop#2). Each bug names the item(s)
 * it breaks in `breaks` (1-based).
 */
function promiseProblems(readmeText, bugs, solutionFiles = []) {
  const items = whatToTestItems(readmeText);
  if (!items.length) return ['README.md: "## What to test" must be a list, one item per behavior the tests must pin down'];
  const out = [];
  const tagged = new Set();
  for (const f of solutionFiles) {
    const n = itemTag(f);
    if (n == null) continue;
    if (n >= 1 && n <= items.length) tagged.add(n);
    else out.push(`solution/${f}: item${n} is not an item of "What to test" (1-${items.length})`);
  }
  items.forEach((_, i) => {
    if (!tagged.has(i + 1)) out.push(`solution/: no reference test file for "What to test" item ${i + 1} (one file per item, "item${i + 1}" in its name)`);
  });
  const covered = new Set();
  for (const b of bugs) {
    const breaks = [b.breaks].flat().filter((n) => n != null);
    if (!breaks.length) out.push(`bugs[] ${b.name}: "breaks" must name the "What to test" item(s) it breaks (1-${items.length})`);
    for (const n of breaks) {
      if (Number.isInteger(n) && n >= 1 && n <= items.length) covered.add(n);
      else out.push(`bugs[] ${b.name}: breaks ${JSON.stringify(n)} is not an item of "What to test" (1-${items.length})`);
    }
  }
  items.forEach((text, i) => {
    if (!covered.has(i + 1)) out.push(`"What to test" item ${i + 1} has no hidden bug that breaks it, so a suite that never tests it still passes: add one, or drop the item ("${text.slice(0, 80)}")`);
  });
  return out;
}

/** Static checks on a plaintext challenge tree (staging, example, or materialized). */
export function staticProblems(dir) {
  const problems = [];
  let m;
  try {
    m = readManifest(dir);
  } catch (e) {
    return [e.message];
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug ?? "")) problems.push("challenge.json: slug must be kebab-case");
  if (!m.title) problems.push("challenge.json: title is required");
  if (!Number.isInteger(m.level) || m.level < 1 || m.level > 20) problems.push("challenge.json: level must be an integer");
  if (!CHALLENGE_TYPES.includes(m.type)) problems.push(`challenge.json: type must be one of ${CHALLENGE_TYPES.join(", ")}`);
  if (!Array.isArray(m.topics) || m.topics.length === 0) problems.push("challenge.json: topics[] is required");
  if (!Number.isInteger(m.estMinutes)) problems.push("challenge.json: estMinutes must be an integer");
  if (!m.test?.command) problems.push("challenge.json: test.command is required");
  const bugs = bugList(dir, m);
  if (bugs.length < 3) problems.push("challenge.json: at least 3 bugs[] are required");
  else if (CODE_TYPES.has(m.type) && !bugs.some((b) => b.kind === "alternative")) {
    problems.push('challenge.json: at least one bug must be kind "alternative" (a plausible different approach that is subtly wrong)');
  }
  if (m.test?.successPattern) {
    try {
      new RegExp(m.test.successPattern);
    } catch {
      problems.push("challenge.json: test.successPattern is not a valid regular expression");
    }
  }

  const readme = join(dir, "README.md");
  if (!existsSync(readme)) problems.push("README.md is missing");
  else {
    const required = ["Problem", "Examples?", "Constraints", ...typeInfo(m.type).readme];
    for (const h of hasHeadings(readFileSync(readme, "utf8"), required)) {
      problems.push(`README.md: missing "## ${h.replace("?", "")}" section`);
    }
  }
  problems.push(...typeProblems(dir, m));
  const expl = join(dir, "solution", "EXPLANATION.md");
  if (!existsSync(expl)) problems.push("solution/EXPLANATION.md is missing");
  else {
    const missing = hasHeadings(readFileSync(expl, "utf8"), [
      "Approach", "Complexity", "Alternatives", "Common bugs", "Level up",
    ]);
    for (const h of missing) problems.push(`EXPLANATION.md: missing "## ${h}" section`);
  }
  const hintsPath = join(dir, "hints.md");
  if (!existsSync(hintsPath)) problems.push("hints.md is missing");
  else if (parseHints(readFileSync(hintsPath, "utf8")).length < 3) {
    problems.push('hints.md: needs 3 hints as "## Hint 1", "## Hint 2", "## Hint 3"');
  }
  for (const d of ["starter", "tests", "solution"]) {
    if (!nonEmptyDir(join(dir, d))) problems.push(`${d}/ is missing or empty`);
  }
  for (const b of bugs) {
    if (!b.name || !b.expect) problems.push("bugs[]: each entry needs name and expect");
    else if (!nonEmptyDir(join(dir, "bugs", b.name))) problems.push(`bugs/${b.name}/ is missing or empty`);
  }
  if (m.type === "write-the-tests" && existsSync(readme)) {
    const solution = join(dir, "solution");
    const files = existsSync(solution) ? readdirSync(solution, { recursive: true }).map(String) : [];
    const readmeText = readFileSync(readme, "utf8");
    problems.push(...promiseProblems(readmeText, bugs, files));
    const starterFiles = collectFiles(dir, ["starter"]);
    problems.push(...exampleProblems(readmeText, Object.values(starterFiles).map((b) => b.toString("utf8")).join("\n")));
    problems.push(...starterItemProblems(readmeText, Object.keys(starterFiles)));
  }
  return problems;
}

function tail(text, lines = 40) {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

/**
 * Full validation of a plaintext challenge tree: static checks, then in the sandbox
 * solution must pass, starter must fail, each bug must fail on the expected test.
 * Runs sequentially to keep machine load low.
 */
export async function validateTree({ config, profile, dir, log = () => {} }) {
  const problems = staticProblems(dir);
  if (problems.length) return { ok: false, problems };
  const manifest = readManifest(dir);
  const bugs = bugList(dir, manifest);
  const run = (target, extra = {}) => runTarget({ config, profile, challengeDir: dir, manifest, target, ...extra });
  const expectIn = (bug, output) => output.toLowerCase().includes(String(bug.expect).toLowerCase());

  if (typeInfo(manifest.type).grader === "mutation") {
    log("reference test suite …");
    const ref = await gradeMutation({ config, profile, challengeDir: dir, manifest, suite: "solution" });
    if (!ref.subjectPassed) problems.push(`the reference tests FAIL on the correct subject/:\n${tail(ref.subjectOutput)}`);
    for (const v of ref.variants) {
      if (!v.caught) problems.push(`the reference tests do not catch bugs/${v.bug.name}`);
      else if (!expectIn(v.bug, v.output)) problems.push(`bugs/${v.bug.name} is caught, but not by the expected test ("${v.bug.expect}" not in output):\n${tail(v.output, 25)}`);
    }
    if (manifest.type === "write-the-tests" && !problems.length) {
      problems.push(...await isolationProblems({ config, profile, dir, manifest, bugs, log }));
    }
    log("starter test suite …");
    const st = await gradeMutation({ config, profile, challengeDir: dir, manifest, suite: "starter" });
    if (st.passed) problems.push("the starter test suite already passes the grading (it must start incomplete)");
    if (manifest.type === "write-the-tests") problems.push(...starterExampleProblems(st));
    return { ok: problems.length === 0, problems };
  }

  log("solution …");
  const sol = await run("solution");
  if (!sol.passed) problems.push(`solution does NOT pass its tests:\n${tail(sol.output)}`);

  log("starter …");
  const st = await run("starter");
  if (st.passed) problems.push("starter PASSES the tests (it must fail before the user solves it)");

  for (const bug of bugs) {
    log(`bugs/${bug.name} …`);
    const r = await run(`bugs/${bug.name}`);
    if (r.passed) problems.push(`bugs/${bug.name} passes the tests: the tests do not catch this bug`);
    else if (!expectIn(bug, r.output)) {
      problems.push(`bugs/${bug.name} fails, but not on the expected test ("${bug.expect}" not in output):\n${tail(r.output, 25)}`);
    }
  }

  if (manifest.type === "debug-from-symptom") {
    log("symptom …");
    const want = symptomLines(readFileSync(join(dir, "README.md"), "utf8"));
    const r = await run("starter", { command: manifest.symptom.command, cwd: manifest.symptom.cwd ?? "tests" });
    const got = r.output.split("\n").map((l) => l.trim());
    const missing = want.filter((line) => !got.some((g) => g.includes(line)));
    if (!want.length) problems.push('README.md: "## Symptom" needs a fenced block with the observed output');
    else if (missing.length) problems.push(`symptom.command on the starter does not reproduce the README symptom; missing:\n${missing.join("\n")}\n--- got:\n${tail(r.output, 20)}`);
  }

  if (manifest.type === "optimize") {
    log("starter without the budget tests …");
    const correctness = await run("starter", { env: { GINGA_PERF: "0" } });
    if (!correctness.passed) problems.push(`with GINGA_PERF=0 the starter must pass (it is correct, only slow):\n${tail(correctness.output, 25)}`);
    if (!st.passed && !expectIn({ expect: manifest.budget.expect }, st.output) && !st.timedOut) {
      problems.push(`the starter fails, but not on the budget test ("${manifest.budget.expect}" not in output)`);
    }
    const limit = (manifest.test?.timeoutSeconds ?? config.sandbox.timeoutSeconds) * 0.5;
    if (sol.passed && sol.seconds > limit) {
      problems.push(`the reference took ${sol.seconds.toFixed(1)} s, over half the ${limit * 2} s timeout: not enough margin against a loaded machine`);
    }
  }
  return { ok: problems.length === 0, problems };
}
