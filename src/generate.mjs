// Challenge and profile generation with Claude Code (`claude -p`).
// Claude writes files into a staging dir and may only execute code through
// `ginga sandbox run`, so nothing generated ever runs on the host.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync,
  statSync, writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { lockChallenge, writeEditorFiles } from "./challenges.mjs";
import { refreshViews } from "./dashboard.mjs";
import { findDuplicate } from "./dedupe.mjs";
import { GENERAL, domainBrief } from "./domains.mjs";
import { allProfiles, checkProfile, normalizeLang } from "./profiles.mjs";
import { appendEvent, readEvents } from "./progress.mjs";
import { readManifest, validateTree } from "./runner.mjs";
import { ensureImage } from "./sandbox.mjs";
import { PKG_ROOT, UserError, today, writeJson } from "./workspace.mjs";

const TEXT_EXT = /\.(md|json|txt|ya?ml|toml|py|m?[jt]s|c|h|cc|cpp|hpp|rs|go|rb|java|kt|cs|ex|exs|hs|lua|sh|mk|zig|swift|php|scala|clj)$|(^|\/)(Makefile|Cargo\.toml|go\.mod)$/;

function readPrompt(name) {
  return readFileSync(join(PKG_ROOT, "prompts", name), "utf8");
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

/** All text files of a dir as fenced blocks with their relative paths. */
export function dumpDir(dir) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(dir, p).split(sep).join("/");
        if (TEXT_EXT.test(rel)) out.push(`--- ${rel} ---\n${readFileSync(p, "utf8")}`);
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.join("\n\n");
}

export function levelRubric(level) {
  const text = readPrompt("levels.md");
  const m = text.match(new RegExp(`^## Level ${level}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## Level |$(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : "";
}

/** Authoring rules + validated example for the non-classic challenge types. */
function typeGuide(type, { sourceLang, ws }) {
  const file = join(PKG_ROOT, "prompts", "types", `${type}.md`);
  if (!existsSync(file)) return "(classic type: follow the layout below)";
  let guide = readFileSync(file, "utf8");
  if (sourceLang) {
    const src = allProfiles(ws).find((p) => p.id === sourceLang);
    guide = guide.replaceAll("{{SOURCE_LANG}}", src ? `${src.name} (profile id \`${src.id}\`)` : sourceLang);
  }
  const example = join(PKG_ROOT, "examples", "types", type);
  return existsSync(example) ? `${guide}\n\n## Reference example of this type (match its layout, not its topic)\n\n${dumpDir(example)}` : guide;
}

/** Quote a word for sh only when needed, so the permission rule stays exactly what Claude types. */
export function shq(word) {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/**
 * Shell prefix Claude must use to run code. `--jail` confines the run to the staging dir Claude
 * is working in (see cmdSandbox), and options can't be given twice, so Claude cannot widen it.
 * No workspace paths are in it: only the absolute node and ginga paths.
 */
export function sandboxPrefix({ lang, stack, profileFile, dir } = {}) {
  const parts = [shq(process.execPath), shq(join(PKG_ROOT, "bin", "ginga.mjs")), "sandbox", "run", "--jail"];
  if (lang) parts.push("--lang", shq(lang));
  if (stack && stack !== "basics") parts.push("--stack", shq(stack));
  if (profileFile) parts.push("--profile-file", shq(profileFile));
  if (dir) parts.push("--dir", shq(dir));
  return parts.join(" ");
}

function lastLines(file, n = 8) {
  try {
    return readFileSync(file, "utf8").trimEnd().split("\n").slice(-n).join("\n");
  } catch {
    return "";
  }
}

/** Run `claude -p` in `cwd`; output goes to `logFile`. Kills the whole process group on timeout. */
export function runClaude({ config, cwd, prompt, allowedTools, logFile, cont = false }) {
  // Tools as separate arguments: a path with a comma or space must not split a rule.
  const args = ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", ...allowedTools,
    "--disallowedTools", "WebFetch", "WebSearch"];
  if (cont) args.push("--continue");
  if (config.claude.model) args.push("--model", config.claude.model);
  const log = createWriteStream(logFile, { flags: "a" });
  log.write(`\n===== claude ${cont ? "(continue) " : ""}${new Date().toISOString()} =====\n`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(config.claude.command, args, { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const killGroup = () => {
      try {
        process.kill(-child.pid, "SIGTERM");
        setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 5000).unref();
      } catch {}
    };
    const timer = setTimeout(() => {
      log.write(`\n[gingaloop] claude timed out after ${config.claude.timeoutMinutes} min\n`);
      killGroup();
    }, config.claude.timeoutMinutes * 60_000);
    const onSignal = () => { killGroup(); process.exit(130); };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    const done = () => {
      clearTimeout(timer);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };
    child.on("error", (err) => {
      done();
      reject(new UserError(`Could not run "${config.claude.command}": ${err.message}. Is Claude Code installed?`));
    });
    child.on("close", (code) => {
      done();
      log.end();
      resolvePromise(code);
    });
  });
}

function newStaging(ws, label) {
  const dir = join(ws, ".staging", `${today()}-${label}-${randomBytes(3).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function moveToFailed(ws, staging) {
  const failed = join(ws, ".staging", "_failed");
  mkdirSync(failed, { recursive: true });
  const dest = join(failed, staging.split(sep).pop());
  renameSync(staging, dest);
  return dest;
}

function formatProblems(problems) {
  return problems.map((p) => `- ${p}`).join("\n");
}

/**
 * Generate, validate (with retries), lock and publish one challenge.
 * @returns {Promise<{id:string, dir:string, manifest:object}>}
 */
export async function generateChallenge({ ws, config, profile, level, area, type = "implement", sourceLang = null, domain = GENERAL, source = "manual", reviewOf = null, log = console.error }) {
  const events = readEvents(ws);
  // Full history in this language (capped only to keep the prompt bounded).
  const history = events.filter((e) => e.type === "generated" && e.lang === profile.id);
  const weak = events.filter((e) => e.type === "gaveup" && e.lang === profile.id).slice(-10);
  const staging = newStaging(ws, profile.id);
  const logFile = join(ws, ".logs", `${staging.split(sep).pop()}.log`);
  mkdirSync(join(ws, ".logs"), { recursive: true });

  const prompt = fill(readPrompt("generate.md"), {
    LANG: profile.name,
    LANG_ID: profile.id,
    LEVEL: level,
    LEVEL_RUBRIC: levelRubric(level),
    LEVEL_NOTES: profile.levelNotes?.[String(level)] ?? "(none)",
    TYPE: type,
    DOMAIN: domainBrief(domain),
    TYPE_GUIDE: typeGuide(type, { sourceLang, ws }),
    CONVENTIONS: profile.conventions,
    TEST_COMMAND: profile.testCommand,
    SUCCESS_PATTERN: profile.successPattern ?? "(none: exit code 0 means pass)",
    EXAMPLE: dumpDir(profile.exampleDir),
    AVOID: history.slice(-400).map((e) => `- ${e.title} [${(e.topics ?? []).join(", ")}]`).join("\n") || "(none yet)",
    WEAK: weak.map((e) => `- ${(e.topics ?? []).join(", ")}`).join("\n") || "(none)",
    AREA: area ? `${area.name} (area id \`${area.id}\`)` : "any",
    REVIEW: reviewOf
      ? `This is a REVIEW challenge: the user gave up on "${reviewOf.title}" (topics: ${(reviewOf.topics ?? []).join(", ")}). ` +
        "Write a NEW problem that exercises the same core idea from a different angle. Do not reuse its statement."
      : "Not a review challenge.",
    STACK: profile.stack === "ecosystem"
      ? `ecosystem: these pinned libraries are installed and SHOULD be used the way a professional would: ${(profile.libraries ?? []).join(", ")}`
      : "basics: standard library only (no third-party packages exist in this environment)",
    SANDBOX: sandboxPrefix({ lang: profile.id, stack: profile.stack }),
  });
  const allowedTools = ["Read", "Write", "Edit", "Glob", "Grep", `Bash(${sandboxPrefix({ lang: profile.id, stack: profile.stack })}:*)`];

  const stackLabel = profile.stack === "ecosystem" ? " (ecosystem)" : "";
  log(`Generating a level-${level} ${profile.name}${stackLabel} challenge${area ? ` on ${area.name}` : ""} with Claude (log: ${logFile}) …`);
  ensureImage(config.sandbox, profile);
  const failFast = (code) => {
    if (code === 0) return;
    const dest = moveToFailed(ws, staging);
    throw new UserError(
      `Claude exited with code ${code ?? "(killed: timeout)"}; is it installed and logged in? ` +
        `Attempt kept in ${dest}. Last lines of ${logFile}:\n${lastLines(logFile)}`,
    );
  };
  failFast(await runClaude({ config, cwd: staging, prompt, allowedTools, logFile }));

  let result = { ok: false, problems: ["no output"] };
  for (let attempt = 0; attempt <= config.claude.retries; attempt++) {
    if (attempt > 0) {
      log(`Validation failed; asking Claude to fix (retry ${attempt}/${config.claude.retries}) …`);
      failFast(await runClaude({
        config, cwd: staging, logFile, allowedTools, cont: true,
        prompt: `The gingaloop validator rejected the challenge. Fix the files in place (same directory) so every check passes. Problems:\n${formatProblems(result.problems)}`,
      }));
    }
    log("Validating in the sandbox …");
    result = await validateTree({ config, profile, dir: staging, log: (m) => log(`  ${m}`) });
    if (result.ok && !reviewOf) {
      const m = readManifest(staging);
      // The same idea framed for another industry is a different challenge.
      const sameDomain = history.filter((e) => (e.domain ?? GENERAL) === domain);
      const dup = findDuplicate({ slug: m.slug, title: m.title }, sameDomain);
      if (dup) {
        result = {
          ok: false,
          problems: [
            `"${m.title}" repeats an earlier ${profile.name} challenge, "${dup.title}" (${dup.id}). ` +
              "Replace it with a DIFFERENT problem (new slug, title, README, tests, solution, bugs, hints); " +
              "do not just rename it.",
          ],
        };
      }
    }
    if (result.ok) break;
  }
  if (!result.ok) {
    const dest = moveToFailed(ws, staging);
    writeFileSync(join(dest, "VALIDATION.txt"), formatProblems(result.problems) + "\n");
    throw new UserError(`Generation failed validation; kept in ${dest}\n${formatProblems(result.problems)}`);
  }

  // Publish: stamp the manifest, move, lock, record.
  const manifest = readManifest(staging);
  const date = today();
  let id = `${date}-${profile.id}-${manifest.slug}`;
  let dir = join(ws, "challenges", id);
  for (let n = 2; existsSync(dir); n++) {
    id = `${date}-${profile.id}-${manifest.slug}-${n}`;
    dir = join(ws, "challenges", id);
  }
  Object.assign(manifest, {
    id, date, lang: profile.id, level, source, stack: profile.stack ?? "basics", type, domain,
    ...(sourceLang ? { sourceLang } : {}),
    ...(area ? { area: area.id } : {}),
    ...(reviewOf ? { reviewOf: reviewOf.id } : {}),
  });
  writeJson(join(staging, "challenge.json"), manifest);
  mkdirSync(join(ws, "challenges"), { recursive: true });
  renameSync(staging, dir);
  lockChallenge(dir);
  writeEditorFiles(dir, profile);
  writeFileSync(
    join(dir, "NOTES.md"),
    `# Notes: ${manifest.title}\n\n- Time spent:\n- Hints used:\n- What tripped me up:\n- What I'd do differently:\n`,
  );
  appendEvent(ws, {
    type: "generated", id, lang: profile.id, level, title: manifest.title, topics: manifest.topics, source,
    stack: profile.stack ?? "basics", challengeType: type, domain,
    ...(area ? { area: area.id } : {}),
    ...(reviewOf ? { reviewOf: reviewOf.id } : {}),
  });
  refreshViews(ws);
  return { id, dir, manifest };
}

/** Bootstrap a profile + validated reference example for a language with no profile yet. */
export async function bootstrapProfile({ ws, config, name, log = console.error }) {
  const id = normalizeLang(name).replace(/\s+/g, "-");
  const staging = newStaging(ws, `profile-${id}`);
  const logFile = join(ws, ".logs", `${staging.split(sep).pop()}.log`);
  mkdirSync(join(ws, ".logs"), { recursive: true });
  const reference = allProfiles(null).find((p) => p.id === "python") ?? allProfiles(null)[0];
  const profileFile = join(staging, "profile.json");
  const prompt = fill(readPrompt("profile.md"), {
    NAME: name,
    ID: id,
    REFERENCE_PROFILE: JSON.stringify({ ...reference, source: undefined, exampleDir: undefined }, null, 2),
    REFERENCE_EXAMPLE: dumpDir(reference.exampleDir),
    LEVEL_RUBRIC: Array.from({ length: 10 }, (_, i) => i + 1).map((l) => `### Level ${l}\n${levelRubric(l)}`).join("\n\n"),
    SANDBOX: sandboxPrefix({ profileFile: "profile.json", dir: "example" }),
  });
  const allowedTools = ["Read", "Write", "Edit", "Glob", "Grep", `Bash(${sandboxPrefix({ profileFile: "profile.json", dir: "example" })}:*)`];
  log(`Bootstrapping a "${name}" profile with Claude (log: ${logFile}) …`);
  const failFast = (code) => {
    if (code === 0) return;
    const dest = moveToFailed(ws, staging);
    throw new UserError(`Claude exited with code ${code ?? "(killed: timeout)"}; attempt kept in ${dest}.\n${lastLines(logFile)}`);
  };
  failFast(await runClaude({ config, cwd: staging, prompt, allowedTools, logFile }));

  let problems = ["no output"];
  for (let attempt = 0; attempt <= config.claude.retries; attempt++) {
    if (attempt > 0) {
      log(`Profile check failed; asking Claude to fix (retry ${attempt}/${config.claude.retries}) …`);
      failFast(await runClaude({
        config, cwd: staging, logFile, allowedTools, cont: true,
        prompt: `The gingaloop validator rejected the profile or example. Fix the files in place. Problems:\n${formatProblems(problems)}`,
      }));
    }
    problems = [];
    let profile = null;
    try {
      profile = JSON.parse(readFileSync(profileFile, "utf8"));
    } catch (e) {
      problems.push(`profile.json unreadable: ${e.message}`);
    }
    if (profile) {
      problems.push(...checkProfile(profile));
      if (profile.image?.dockerfile) problems.push('bootstrapped profiles must use an official image via "pull", not a dockerfile');
      if (profile.image?.pull && profile.image.pull.includes("/")) {
        problems.push(`image "${profile.image.pull}" is not a Docker Official Image (no "/" allowed)`);
      }
    }
    if (!problems.length) {
      log("Validating the reference example in the sandbox …");
      try {
        ensureImage(config.sandbox, profile);
        const r = await validateTree({ config, profile, dir: join(staging, "example"), log: (m) => log(`  ${m}`) });
        problems.push(...r.problems);
      } catch (e) {
        problems.push(e.message);
      }
    }
    if (!problems.length) {
      const profile = JSON.parse(readFileSync(profileFile, "utf8"));
      mkdirSync(join(ws, "profiles"), { recursive: true });
      writeJson(join(ws, "profiles", `${profile.id}.json`), profile);
      cpSync(join(staging, "example"), join(ws, "profiles", `${profile.id}.example`), { recursive: true });
      rmSync(staging, { recursive: true, force: true });
      return { profile };
    }
  }
  const dest = moveToFailed(ws, staging);
  throw new UserError(`Profile bootstrap failed; kept in ${dest}\n${formatProblems(problems)}`);
}

