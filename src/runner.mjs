// Generic test runner + validator. Knows no languages: everything comes from
// challenge.json (test.command, successPattern) and the profile (image).
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { UserError } from "./workspace.mjs";
import { makeTempDir, removeDir, runInSandbox } from "./sandbox.mjs";
import { LOCK_FILE, parseHints, writeFiles } from "./vault.mjs";

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

/**
 * write-the-tests: grade a test suite (`suite` = "starter" or "solution") the way mutation testing
 * does. It must pass on the correct subject/ and fail on every bug variant. `bundle` carries the
 * locked bug variants for published challenges (decrypted into the throwaway copy only).
 */
export async function gradeMutation({ config, profile, challengeDir, manifest, suite, bundle }) {
  const run = (impl) =>
    runTarget({ config, profile, challengeDir, manifest, target: impl, bundle, env: { TESTS: suite, IMPL: impl } });
  const subject = await run("subject");
  const variants = [];
  for (const bug of bugList(challengeDir, manifest, bundle)) {
    const r = await run(`bugs/${bug.name}`);
    variants.push({ bug, caught: !r.passed, output: r.output });
  }
  const caught = variants.filter((v) => v.caught).length;
  return {
    passed: subject.passed && caught === variants.length,
    subjectPassed: subject.passed,
    subjectOutput: subject.output,
    caught,
    total: variants.length,
    variants,
  };
}

/** Grade the user's work (or any target) according to the challenge type. */
export async function gradeTarget({ config, profile, challengeDir, manifest, target, bundle }) {
  if (typeInfo(manifest.type).grader === "mutation") {
    const g = await gradeMutation({ config, profile, challengeDir, manifest, suite: target, bundle });
    const lines = [`Your tests on the correct subject: ${g.subjectPassed ? "pass ✔" : "FAIL ✘ (they must pass on correct code)"}`];
    g.variants.forEach((v, i) => lines.push(`Hidden buggy version ${i + 1}: ${v.caught ? "caught ✔" : "missed ✘"}`));
    lines.push(`Caught ${g.caught}/${g.total} buggy versions.`);
    const output = (g.subjectPassed ? "" : `${tail(g.subjectOutput, 40)}\n\n`) + lines.join("\n");
    return { passed: g.passed, output, timedOut: false };
  }
  return runTarget({ config, profile, challengeDir, manifest, target, bundle });
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
    log("starter test suite …");
    const st = await gradeMutation({ config, profile, challengeDir: dir, manifest, suite: "starter" });
    if (st.passed) problems.push("the starter test suite already passes the grading (it must start incomplete)");
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
