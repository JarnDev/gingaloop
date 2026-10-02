// Generic test runner + validator. Knows no languages: everything comes from
// challenge.json (test.command, successPattern) and the profile (image).
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { makeTempDir, removeDir, runInSandbox } from "./sandbox.mjs";
import { LOCK_FILE, parseHints, writeFiles } from "./vault.mjs";

export const CHALLENGE_TYPES = ["implement", "fix-the-bug", "refactor", "extend"];
const SKIP = new Set([LOCK_FILE, "NOTES.md", ".git", "node_modules"]);

export function readManifest(dir) {
  const path = join(dir, "challenge.json");
  if (!existsSync(path)) throw new Error(`${dir} has no challenge.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Throwaway copy of a challenge (plus unlocked bundle files, if any). */
export function materialize(challengeDir, bundle) {
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
  return pattern ? new RegExp(pattern).test(result.output) : true;
}

/** Run the tests against one target dir: "starter", "solution" or "bugs/<name>". */
export async function runTarget({ config, profile, challengeDir, manifest, target, bundle }) {
  const { tmp, work } = materialize(challengeDir, bundle);
  try {
    const result = await runInSandbox({
      sandbox: config.sandbox,
      profile,
      workDir: work,
      cwd: "tests",
      command: manifest.test?.command ?? profile.testCommand,
      env: { TARGET: target },
      timeoutSeconds: manifest.test?.timeoutSeconds,
    });
    return { ...result, passed: passed(result, manifest) };
  } finally {
    removeDir(tmp);
  }
}

function nonEmptyDir(path) {
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length > 0;
}

function hasHeadings(text, headings) {
  return headings.filter((h) => !new RegExp(`^##\\s+${h}`, "im").test(text));
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
  if (!Array.isArray(m.bugs) || m.bugs.length < 2) problems.push("challenge.json: at least 2 bugs[] are required");

  const readme = join(dir, "README.md");
  if (!existsSync(readme)) problems.push("README.md is missing");
  else {
    for (const h of hasHeadings(readFileSync(readme, "utf8"), ["Problem", "Examples?", "Constraints"])) {
      problems.push(`README.md: missing "## ${h.replace("?", "")}" section`);
    }
  }
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
  for (const b of m.bugs ?? []) {
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
  const run = (target) => runTarget({ config, profile, challengeDir: dir, manifest, target });

  log("solution …");
  const sol = await run("solution");
  if (!sol.passed) problems.push(`solution does NOT pass its tests:\n${tail(sol.output)}`);

  log("starter …");
  const st = await run("starter");
  if (st.passed) problems.push("starter PASSES the tests (it must fail before the user solves it)");

  for (const bug of manifest.bugs) {
    log(`bugs/${bug.name} …`);
    const r = await run(`bugs/${bug.name}`);
    if (r.passed) problems.push(`bugs/${bug.name} passes the tests: the tests do not catch this bug`);
    else if (!r.output.toLowerCase().includes(String(bug.expect).toLowerCase())) {
      problems.push(
        `bugs/${bug.name} fails, but not on the expected test ("${bug.expect}" not in output):\n${tail(r.output, 25)}`,
      );
    }
  }
  return { ok: problems.length === 0, problems };
}
