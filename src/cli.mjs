// Command implementations for `ginga`.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  isLocked, listChallenges, pickChallenge, readHints, unlockChallenge, writeEditorFiles,
} from "./challenges.mjs";
import { bootstrapProfile, generateChallenge, sandboxPrefix } from "./generate.mjs";
import { resolveLevel, streakState } from "./levels.mjs";
import { gateSummary, langLevel } from "./progression.mjs";
import { notify } from "./notify.mjs";
import { allProfiles, findProfile, requireProfile } from "./profiles.mjs";
import { appendEvent, challengeStatus, eventDate, readEvents } from "./progress.mjs";
import { gradeTarget, materialize, readManifest, validateTree } from "./runner.mjs";
import { TYPE_IDS, choosePortSource, eligibleTypes, pickType, typeInfo } from "./types.mjs";
import { engineAvailable, ensureImage, imagePresent, imageRef, makeTempDir, removeDir, runInSandbox } from "./sandbox.mjs";
import { refreshViews } from "./dashboard.mjs";
import { allAreas, coverageCounts, findArea, pickArea, unlockedAreas } from "./coverage.mjs";
import { STACK_MODES, hasEcosystem, pickStack, profileForStack, stackMode } from "./stacks.mjs";
import { GENERAL, allDomains, configuredDomains, ecosystemShare, pickDomain, requireDomain } from "./domains.mjs";
import { ROTATION_MODES, bagState, nextOrdered, pickDailyLang } from "./rotation.mjs";
import { installSchedule, removeSchedule, scheduleStatus } from "./schedule.mjs";
import { buildCommitMessage, ensureRepo, git, pushWorkspace, stagedFiles, stagedNewEvents } from "./gitops.mjs";
import { VaultKeyError, readBundle } from "./vault.mjs";
import {
  CONFIG_FILE, DEFAULT_CONFIG, PKG_ROOT, UserError, daysBetween, findWorkspace, loadConfig,
  readGlobalConfig, saveConfig, today, writeGlobalConfig,
} from "./workspace.mjs";

const isTTY = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

async function ask(question, fallback = "") {
  if (!isTTY()) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(fallback ? `${question} [${fallback}] ` : `${question} `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

async function confirm(question, yes) {
  if (yes) return true;
  if (!isTTY()) throw new UserError(`${question} Re-run with --yes to confirm non-interactively.`);
  return /^y(es)?$/i.test(await ask(`${question} [y/N]`));
}

function ctx(opts) {
  const ws = findWorkspace(opts.workspace);
  return { ws, config: loadConfig(ws) };
}

function tail(text, lines = 60) {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

function bar(done, total, width = 12) {
  if (total <= 0) return "█".repeat(width);
  const filled = Math.round((done / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** Profile for a language; bootstraps one with Claude if missing (asks first when interactive). */
async function profileFor(ws, config, lang, { yes = false } = {}) {
  const found = findProfile(ws, lang);
  if (found) return found;
  if (isTTY() && !yes) {
    const ok = await confirm(`No profile for "${lang}". Bootstrap one with Claude now?`, false);
    if (!ok) throw new UserError(`No profile for "${lang}".`);
  }
  const { profile } = await bootstrapProfile({ ws, config, name: lang });
  return requireProfile(ws, profile.id);
}

// ---------------------------------------------------------------- init

export function validTime(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(time ?? "");
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new UserError(`Time must be HH:MM (00:00–23:59), got "${time}".`);
  return time;
}

/** Append the lines a file is missing (creating it if needed); never rewrites what is there. */
function ensureLines(path, lines) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const have = new Set(current.split(/\r?\n/).map((l) => l.trim()));
  const missing = lines.filter((l) => !have.has(l));
  if (!missing.length) return;
  const sepNl = current && !current.endsWith("\n") ? "\n" : "";
  writeFileSync(path, current + sepNl + missing.join("\n") + "\n");
}

export async function cmdInit(positionals, opts) {
  const builtins = allProfiles(null).map((p) => p.id);
  const dir = resolve(positionals[0] ?? (await ask("Workspace directory:", join(homedir(), "gingaloop"))));
  if (existsSync(join(dir, CONFIG_FILE))) {
    throw new UserError(`${dir} is already a workspace. Edit ${CONFIG_FILE} to change it.`);
  }
  console.log(`Built-in languages: ${builtins.join(", ")}. Any other language is bootstrapped with Claude on first use.`);
  const rotationRaw = opts.rotation ?? (await ask("Languages for the daily (comma-separated):", "python,javascript,c"));
  const rotation = rotationRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!rotation.length) throw new UserError("Rotation needs at least one language.");
  const time = opts.time ?? (await ask("Daily generation time (HH:MM):", DEFAULT_CONFIG.schedule.time));
  validTime(time);

  const rotationMode = opts.mode ?? (await ask("Daily order: random (each language once per cycle, shuffled) or ordered?", "random"));
  if (!ROTATION_MODES.includes(rotationMode)) throw new UserError(`Order must be one of: ${ROTATION_MODES.join(", ")}.`);
  const withEco = rotation.filter((l) => hasEcosystem(findProfile(null, l) ?? {}));
  let stackChoice = opts.stack ?? "basics";
  if (!opts.stack && withEco.length) {
    stackChoice = await ask(
      `Libraries for ${withEco.join(", ")}: basics (standard library only), mixed, or ecosystem (pandas, vitest…)?`, "basics");
  }
  if (!STACK_MODES.includes(stackChoice)) throw new UserError(`Stack must be one of: ${STACK_MODES.join(", ")}.`);
  const stack = Object.fromEntries(withEco.map((l) => [findProfile(null, l).id, stackChoice]));
  const domainsRaw = opts.domains ?? (await ask("Industry domains (comma-separated; `ginga domains list` shows all 40):", GENERAL));
  const domains = configuredDomains({ domains: domainsRaw.split(",").map((d) => d.trim()).filter(Boolean) });
  const config = structuredClone({ ...DEFAULT_CONFIG, rotation, rotationMode, stack, domains, schedule: { time } });
  if (opts.engine) config.sandbox.engine = opts.engine;
  mkdirSync(join(dir, "challenges"), { recursive: true });
  saveConfig(dir, config);
  // Existing files are never overwritten: missing lines are appended instead.
  ensureLines(join(dir, ".gitignore"), [".staging/", ".logs/"]);
  // The README is the decryption key: never let git rewrite its line endings.
  ensureLines(join(dir, ".gitattributes"), ["challenges/**/README.md -text"]);
  if (!existsSync(join(dir, "README.md"))) {
    writeFileSync(
      join(dir, "README.md"),
      "My daily coding practice with [gingaloop](https://github.com/JarnDev/gingaloop). " +
        "The dashboard above updates itself; write anything you like below it.\n",
    );
  }
  refreshViews(dir);
  console.log(`\nCreated workspace ${dir}.`);
  // Only take over the default workspace when asked, or when there is no valid one yet.
  const current = readGlobalConfig().workspace;
  const hasDefault = current && current !== dir && existsSync(join(current, CONFIG_FILE));
  if (!hasDefault || opts.default || (isTTY() && (await confirm(`Make it your default workspace instead of ${current}?`, false)))) {
    writeGlobalConfig({ ...readGlobalConfig(), workspace: dir });
    console.log("It is now your default workspace.");
  } else {
    console.log(`Your default workspace stays ${current} (re-run init with --default, or use --workspace).`);
  }
  const unknown = rotation.filter((l) => !findProfile(dir, l));
  if (unknown.length) console.log(`No profile yet for: ${unknown.join(", ")}; run \`ginga lang add <name>\` or let the first challenge bootstrap it.`);
  await cmdDoctor([], { workspace: dir });
  if (await confirm("Install the daily schedule now?", opts.yes).catch(() => false)) {
    console.log(installSchedule({ ws: dir, config }));
  } else {
    console.log("Later: `ginga schedule install`. Generate one now: `ginga new <lang>`.");
  }
}

// ---------------------------------------------------------------- new / daily

function printNew({ dir, manifest }) {
  console.log(`\n✔ ${manifest.title}  (${manifest.lang}, level ${manifest.level}, ~${manifest.estMinutes} min, ${manifest.type})`);
  console.log(`  ${dir}`);
  console.log(`  ginga open  →  edit starter/  →  ginga test  →  ginga done   (stuck? ginga hint)`);
}

export async function cmdNew(positionals, opts) {
  const { ws, config } = ctx(opts);
  const lang = positionals[0];
  if (!lang) throw new UserError("Usage: ginga new <language> [--level N]");
  const base = await profileFor(ws, config, lang, opts);
  const state = langLevel(ws, config, readEvents(ws), base.id);
  const requestedLevel = resolveLevel(opts.level, state, base.id, config.leveling);
  // --stack wins; an ecosystem-only --area implies the ecosystem stack; else the config decides.
  const domain = opts.domain ? requireDomain(opts.domain).id : pickDomain(readEvents(ws), configuredDomains(config));
  let stack = opts.stack;
  if (!stack && opts.area && hasEcosystem(base) && findArea(profileForStack(base, "ecosystem"), opts.area)?.stack === "ecosystem") stack = "ecosystem";
  stack ??= pickStack(base, stackMode(config, base.id), { share: ecosystemShare(domain) });
  const profile = profileForStack(base, stack);
  const { type, sourceLang, level } = chooseType(ws, config, readEvents(ws), profile, requestedLevel, opts.type, {
    levelExplicit: opts.level != null,
  });
  if (level !== requestedLevel) console.error(`Port at level ${level}: your ${sourceLang} level is the limit for reading the source.`);
  let area;
  if (opts.area) {
    area = findArea(profile, opts.area);
    if (!area) throw new UserError(`Unknown area "${opts.area}" for ${profile.id}. See \`ginga coverage ${profile.id}\`.`);
    if ((area.minLevel ?? 1) > level) throw new UserError(`Area "${area.id}" starts at level ${area.minLevel}; this challenge is level ${level}.`);
  } else {
    area = pickArea(profile, level, readEvents(ws));
  }
  const result = await generateChallenge({ ws, config, profile, level, area, type, sourceLang, domain, source: "manual" });
  printNew(result);
}

/** A solve that should come back for review: 2+ hints, or more than twice the estimated time. */
export function isStruggle(e, generated) {
  if (e.type !== "solved" || e.afterGiveup) return false;
  const est = generated?.estMinutes;
  return (e.hints ?? 0) >= 2 || (Number.isFinite(e.minutes) && Number.isFinite(est) && e.minutes > 2 * est);
}

/**
 * The oldest challenge with a review due. Give-ups and struggled solves come back once per
 * `reviewAfterDays` entry their age has reached (3, 7, 21 days by default), so a day the machine
 * was off only delays a review, never skips it.
 */
export function dueReview(events, reviewAfterDays, date) {
  const generated = new Map(events.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const reviews = new Map();
  for (const e of events) if (e.type === "generated" && e.reviewOf) reviews.set(e.reviewOf, (reviews.get(e.reviewOf) ?? 0) + 1);
  // First trigger per challenge: its give-up, or a struggled solve.
  const triggers = new Map();
  for (const e of events) {
    if (triggers.has(e.id)) continue;
    if (e.type === "gaveup" || isStruggle(e, generated.get(e.id))) triggers.set(e.id, e);
  }
  for (const e of triggers.values()) {
    const age = daysBetween(eventDate(e), date);
    const due = reviewAfterDays.filter((n) => age >= n).length;
    if ((reviews.get(e.id) ?? 0) >= due) continue;
    const g = generated.get(e.id);
    return { id: e.id, lang: e.lang, level: e.level, title: g?.title ?? e.id, topics: g?.topics ?? e.topics ?? [], ...(g?.area ? { area: g.area } : {}) };
  }
  return null;
}

function generatedEvent(events, id) {
  return events.find((e) => e.type === "generated" && e.id === id);
}

/** The profile a challenge runs with: its language, in the stack it was generated for. */
function challengeProfile(ws, manifest) {
  return profileForStack(requireProfile(ws, manifest.lang), manifest.stack ?? "basics");
}

/** Rotation with aliases resolved to profile ids (events record profile ids). */
function rotationIds(ws, config) {
  return [...new Set(config.rotation.map((l) => findProfile(ws, l)?.id ?? l))];
}

export async function cmdDaily(_positionals, opts) {
  const { ws, config } = ctx(opts);
  const date = today();
  const events = readEvents(ws);
  if (!opts.force && events.some((e) => e.type === "generated" && e.source === "daily" && eventDate(e) === date)) {
    console.log("Today's challenge already exists (use --force to make another).");
    return;
  }
  const review = dueReview(events, config.reviewAfterDays, date);
  const lang = review?.lang ?? pickDailyLang(events, rotationIds(ws, config), config.rotationMode);
  try {
    const base = await profileFor(ws, config, lang, { yes: true });
    const reviewed = review && generatedEvent(events, review.id);
    const domain = reviewed?.domain ?? pickDomain(events, configuredDomains(config));
    const profile = profileForStack(base, reviewed?.stack ?? pickStack(base, stackMode(config, base.id), { share: ecosystemShare(domain) }));
    const state = langLevel(ws, config, events, profile.id);
    const earned = review ? Math.min(review.level ?? state.level, state.level) : state.level;
    const { type, sourceLang, level } = review
      ? { type: "implement", sourceLang: null, level: earned }
      : chooseType(ws, config, events, profile, earned, null);
    const area = (review?.area && findArea(profile, review.area)) || pickArea(profile, level, events);
    const result = await generateChallenge({ ws, config, profile, level, area, type, sourceLang, domain, source: "daily", reviewOf: review });
    notify(
      `gingaloop · ${profile.name} · L${level}${review ? " · review" : ""}`,
      `${result.manifest.title} (~${result.manifest.estMinutes} min)\n${result.dir}`,
    );
  } catch (e) {
    notify("gingaloop: daily generation failed", e.message.split("\n")[0], { urgent: true });
    throw e;
  }
}

// ---------------------------------------------------------------- solve loop

function readmeKeyWarning(dir) {
  if (!isLocked(dir)) return null;
  try {
    readBundle(dir);
    return null;
  } catch (e) {
    return e instanceof VaultKeyError ? e.message : null;
  }
}

async function runStarter(ws, config, c) {
  const profile = challengeProfile(ws, c.manifest);
  // write-the-tests grades your tests against the hidden buggy versions: decrypt only bugs/ into
  // the throwaway sandbox copy (never into the workspace).
  let bundle = null;
  if (typeInfo(c.manifest.type).grader === "mutation" && isLocked(c.dir)) {
    bundle = Object.fromEntries(Object.entries(readBundle(c.dir)).filter(([k]) => k.startsWith("bugs/")));
  }
  return gradeTarget({ config, profile, challengeDir: c.dir, manifest: c.manifest, target: "starter", bundle });
}

/**
 * Port plan into `targetId` at `level`: a source you can read at that difficulty (see
 * choosePortSource). When none qualifies and the level wasn't requested explicitly, the port drops
 * one level (never more, never below port's minimum). Returns { sourceLang, level } or null.
 */
function portPlan(ws, config, events, targetId, level, { allowLower }) {
  const candidates = rotationIds(ws, config).filter((l) => findProfile(ws, l))
    .map((id) => ({ id, level: langLevel(ws, config, events, id).level }));
  for (const at of allowLower ? [level, level - 1] : [level]) {
    const sourceLang = choosePortSource(targetId, candidates, at);
    if (sourceLang) return { sourceLang, level: at };
  }
  return null;
}

/**
 * Type for a new challenge: --type (checked against level and rotation) or the weighted mix.
 * Returns { type, sourceLang, level }, where level may be one lower for a port.
 */
export function chooseType(ws, config, events, profile, level, requested, { levelExplicit = false } = {}) {
  const plan = portPlan(ws, config, events, profile.id, level, { allowLower: !levelExplicit });
  if (requested) {
    if (!TYPE_IDS.includes(requested)) throw new UserError(`Unknown type "${requested}". Types: ${TYPE_IDS.join(", ")}.`);
    if (!eligibleTypes(level, { canPort: Boolean(plan) }).includes(requested)) {
      const info = typeInfo(requested);
      throw new UserError(info.needsSecondLanguage && !plan
        ? `"port" at level ${level} needs another rotation language (not SQL/React) at level ` +
          `${Math.max(info.minLevel, level - 1)}+ to read the source.`
        : `"${requested}" starts at level ${info.minLevel}; this challenge is level ${level}.`);
    }
    return requested === "port" ? { type: "port", ...plan } : { type: requested, sourceLang: null, level };
  }
  const type = pickType(events, profile.id, level, { canPort: Boolean(plan) });
  return type === "port" ? { type, ...plan } : { type, sourceLang: null, level };
}

export async function cmdTest(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  console.log(`Testing ${c.manifest.id} (sandboxed) …\n`);
  const r = await runStarter(ws, config, c);
  console.log(tail(r.output));
  const warn = readmeKeyWarning(c.dir);
  if (warn) console.log(`\n⚠ ${warn}`);
  if (r.passed) console.log("\n✔ All tests pass. Record it with `ginga done`.");
  else {
    console.log(`\n✘ Not passing yet${r.timedOut ? " (timed out)" : ""}.`);
    process.exitCode = 1;
  }
}

export async function cmdHint(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const events = readEvents(ws);
  const { status, hints: used } = challengeStatus(events, c.manifest.id);
  const hints = readHints(c.dir);
  if (status !== "open") {
    hints.forEach((h, i) => console.log(`## Hint ${i + 1}\n${h}\n`));
    return;
  }
  if (used >= hints.length) {
    console.log(`No more hints (${hints.length}/${hints.length} used). Keep going, or \`ginga giveup\`.`);
    return;
  }
  for (let i = 0; i < used; i++) console.log(`## Hint ${i + 1}\n${hints[i]}\n`);
  console.log(`## Hint ${used + 1}\n${hints[used]}\n`);
  appendEvent(ws, { type: "hint", id: c.manifest.id, lang: c.manifest.lang, level: c.manifest.level, hint: used + 1 });
  refreshViews(ws);
  const hm = config.leveling.hintMultiplier;
  const pct = Math.round(hm[Math.min(used + 1, hm.length - 1)] * 100);
  console.log(`(${used + 1}/${hints.length} hints used · this solve is now worth ${pct}% of its points)`);
}

function tryUnlock(dir) {
  try {
    if (unlockChallenge(dir)) console.log(`🔓 Unlocked: ${join(dir, "solution", "EXPLANATION.md")}`);
    return true;
  } catch (e) {
    if (e instanceof VaultKeyError) {
      console.log(`⚠ ${e.message}\n  Then run the same command again to unlock.`);
      return false;
    }
    throw e;
  }
}

/** Longest wall-clock time still trusted as a default; beyond it, breaks are likely included. */
export const TIMER_CAP_MINUTES = 240;

/**
 * Minutes since the first `ginga open` of a challenge. `suggest` is null when there was no open,
 * or when the time is over the cap (opened in the morning, solved at night).
 */
export function timerMinutes(events, id, now = Date.now(), cap = TIMER_CAP_MINUTES) {
  const first = events.find((e) => e.type === "opened" && e.id === id);
  if (!first) return { measured: null, suggest: null };
  const measured = Math.max(1, Math.round((now - Date.parse(first.ts)) / 60_000));
  return { measured, suggest: measured <= cap ? measured : null };
}

function humanMinutes(m) {
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export async function cmdDone(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const m = c.manifest;
  const events = readEvents(ws);
  const before = langLevel(ws, config, events, m.lang);
  const { status, hints } = challengeStatus(events, m.id);
  if (status === "solved") {
    console.log(`${m.id} is already solved.`);
    tryUnlock(c.dir);
    return;
  }
  console.log(`Running the tests for ${m.id} (sandboxed) …`);
  const r = await runStarter(ws, config, c);
  if (!r.passed) {
    console.log(tail(r.output, 30));
    console.log("\n✘ Tests are not passing, so it can't be recorded as solved.");
    process.exitCode = 1;
    return;
  }
  const timer = timerMinutes(events, m.id);
  let minutes = null;
  let minutesSource = null;
  if (opts.minutes != null) {
    minutes = Number(opts.minutes);
    minutesSource = "flag";
  } else if (isTTY()) {
    if (timer.measured != null && timer.suggest == null) {
      console.log(`⏱️  The timer says ${humanMinutes(timer.measured)} since you opened it; that probably includes breaks.`);
    }
    const a = await ask(timer.suggest != null ? "Minutes spent (enter to accept, or type yours):" : "Minutes spent (enter to skip):",
      timer.suggest != null ? String(timer.suggest) : "");
    if (a) {
      minutes = Number(a);
      minutesSource = timer.suggest != null && Number(a) === timer.suggest ? "timer" : "typed";
    }
  } else if (timer.suggest != null) {
    minutes = timer.suggest; // no one to ask: trust the timer only when it's plausible
    minutesSource = "timer";
  }
  if (!Number.isFinite(minutes) || minutes < 0) {
    minutes = null;
    minutesSource = null;
  }
  appendEvent(ws, {
    type: "solved", id: m.id, lang: m.lang, level: m.level, topics: m.topics,
    minutes, ...(minutesSource ? { minutesSource } : {}), hints,
    ...(status === "gaveup" ? { afterGiveup: true } : {}),
  });
  const after = langLevel(ws, config, readEvents(ws), m.lang);
  const earned = after.points - before.points;
  const why = [];
  if (status === "gaveup") why.push("solved after giving up");
  else {
    if (m.level < before.level) why.push(`level ${m.level} is below your level ${before.level}`);
    if (hints) why.push(`${hints} hint${hints === 1 ? "" : "s"}`);
  }
  console.log(`\n✔ Solved ${m.title}.  +${earned} points${why.length ? ` (${why.join(", ")})` : ""}`);
  if (after.level > before.level) console.log(`🎉 Level ${after.level} unlocked for ${m.lang}!`);
  console.log(`  ${m.lang}: ${levelLine(after, config.leveling)}`);
  tryUnlock(c.dir);
  refreshViews(ws);
}

export async function cmdGiveup(positionals, opts) {
  const { ws } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const m = c.manifest;
  const { status } = challengeStatus(readEvents(ws), m.id);
  if (status === "open") {
    if (!(await confirm(`Give up on "${m.title}" and reveal the solution?`, opts.yes))) return;
    appendEvent(ws, { type: "gaveup", id: m.id, lang: m.lang, level: m.level, topics: m.topics });
    console.log("Recorded. This topic comes back as a review challenge in a few days.");
  }
  tryUnlock(c.dir);
  refreshViews(ws);
}

// ---------------------------------------------------------------- progress views

export function streak(events, date = today()) {
  return streakState(events.filter((e) => e.type === "solved").map(eventDate), date);
}

/** "L2  ███░░░░░░░░░  820 / 1500 pts (680 to L3)" */
export function levelLine(s, leveling) {
  if (s.level >= s.max) return `L${s.level}  max level · ${s.points} pts`;
  const floor = s.level === 1 ? 0 : leveling.thresholds[s.level - 2];
  const shown = Math.min(s.points, s.nextAt);
  const toGo = s.needed > 0 ? `${s.needed} pts to L${s.level + 1}` : `points done for L${s.level + 1}`;
  const gates = gateSummary(s);
  return `L${s.level}  ${bar(shown - floor, s.nextAt - floor)}  ${s.points} / ${s.nextAt} pts (${toGo}${gates ? `; ${gates}` : ""})`;
}

export async function cmdRank(_positionals, opts) {
  const { ws, config } = ctx(opts);
  const events = readEvents(ws);
  refreshViews(ws); // keep README/INDEX current after config edits
  const langs = [...new Set([...rotationIds(ws, config), ...events.map((e) => e.lang).filter(Boolean)])];
  const st = streak(events);
  const freezes = st.freezes ? `  ·  ❄️ ${st.freezes} freeze${st.freezes === 1 ? "" : "s"}` : "";
  const next = 7 - (st.days % 7);
  console.log(`🔥 Streak: ${st.days} day${st.days === 1 ? "" : "s"}${freezes}  (next freeze in ${next} solve day${next === 1 ? "" : "s"}, max 2)`);
  if (st.frozeOn.length) console.log(`   freezes used on ${st.frozeOn.join(", ")}`);
  console.log("");
  for (const lang of langs) {
    const s = langLevel(ws, config, events, lang);
    const solved = events.filter((e) => e.type === "solved" && e.lang === lang);
    const gaveup = events.filter((e) => e.type === "gaveup" && e.lang === lang);
    const mins = solved.map((e) => e.minutes).filter((x) => Number.isFinite(x));
    const avg = mins.length ? `${Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)} min avg` : "";
    const ecoSolved = solved.filter((e) => generatedEvent(events, e.id)?.stack === "ecosystem").length;
    const split = ecoSolved ? ` (${solved.length - ecoSolved} basics · ${ecoSolved} ecosystem)` : "";
    console.log(`${lang.padEnd(12)} ${levelLine(s, config.leveling).padEnd(52)} ${solved.length} solved${split}, ${gaveup.length} gave up  ${avg}`);
  }
  const weak = {};
  for (const e of events.filter((x) => x.type === "gaveup")) for (const t of e.topics ?? []) weak[t] = (weak[t] ?? 0) + 1;
  const top = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) console.log(`\nWeak topics: ${top.map(([t, n]) => `${t} (${n})`).join(", ")}`);
}

export async function cmdList(_positionals, opts) {
  const { ws } = ctx(opts);
  const events = readEvents(ws);
  const all = listChallenges(ws);
  if (!all.length) return console.log("No challenges yet.");
  for (const { manifest: m } of all) {
    const s = challengeStatus(events, m.id);
    console.log(`${s.status.padEnd(7)} ${m.id.padEnd(48)} L${m.level} ${m.type}`);
  }
}

// ---------------------------------------------------------------- validate / sandbox / lang

async function validateOne(config, profile, dir) {
  const locked = isLocked(dir);
  let tree = dir;
  let tmp = null;
  if (locked) {
    ({ tmp, work: tree } = materialize(dir, readBundle(dir)));
  }
  try {
    return await validateTree({ config, profile, dir: tree, log: (m) => console.log(`  ${m}`) });
  } finally {
    if (tmp) removeDir(tmp);
  }
}

export async function cmdValidate(positionals, opts) {
  const { ws, config } = ctxOrDefaults(opts);
  const targets = [];
  if (opts.examples) {
    // Type examples (examples/types/<type>/) declare their own language and stack.
    const typesDir = join(PKG_ROOT, "examples", "types");
    for (const t of existsSync(typesDir) ? readdirSync(typesDir).sort() : []) {
      const dir = join(typesDir, t);
      const m = readManifest(dir);
      targets.push({ profile: profileForStack(requireProfile(ws, m.lang), m.stack ?? "basics"), dir });
    }
    for (const p of allProfiles(ws)) {
      for (const stack of hasEcosystem(p) ? ["basics", "ecosystem"] : ["basics"]) {
        const sp = profileForStack(p, stack);
        if (existsSync(sp.exampleDir)) targets.push({ profile: sp, dir: sp.exampleDir });
      }
    }
  } else {
    const dir = resolve(positionals[0] ?? ".");
    const m = readManifest(dir);
    targets.push({ profile: profileForStack(requireProfile(ws, opts.lang ?? m.lang), opts.stack ?? m.stack ?? "basics"), dir });
  }
  let failed = 0;
  for (const t of targets) {
    console.log(`${t.profile.id}${t.profile.stack === "ecosystem" ? " (ecosystem)" : ""}: ${t.dir}`);
    const r = await validateOne(config, t.profile, t.dir);
    if (r.ok) console.log("  ✔ valid");
    else {
      failed++;
      console.log(r.problems.map((p) => `  ✘ ${p}`).join("\n"));
    }
  }
  if (failed) process.exitCode = 1;
}

/**
 * Jail for `sandbox run --jail` (what Claude gets during generation): the nearest
 * `<workspace>/.staging/<run>` dir containing the current directory. Everything the run may
 * touch must resolve (after symlinks) inside it.
 */
export function jailRoot(cwd) {
  const parts = realpathSync(cwd).split(sep);
  const i = parts.lastIndexOf(".staging");
  if (i < 1 || i === parts.length - 1) {
    throw new UserError("--jail only works from inside a generation staging directory (<workspace>/.staging/<run>).");
  }
  const ws = parts.slice(0, i).join(sep) || sep;
  if (!existsSync(join(ws, CONFIG_FILE))) throw new UserError(`--jail: ${ws} is not a gingaloop workspace.`);
  return { root: parts.slice(0, i + 2).join(sep), ws };
}

export function insideJail(root, path) {
  const abs = resolve(root, path);
  if (!existsSync(abs)) throw new UserError(`${path} does not exist.`);
  const real = realpathSync(abs);
  if (real !== root && !real.startsWith(root + sep)) throw new UserError(`${path} is outside the staging directory.`);
  return real;
}

/** Workspace + config, or the defaults when there is no workspace at all (config errors still surface). */
function ctxOrDefaults(opts) {
  let ws;
  try {
    ws = findWorkspace(opts.workspace);
  } catch (e) {
    if (e instanceof UserError && !opts.workspace) return { ws: null, config: structuredClone(DEFAULT_CONFIG) };
    throw e;
  }
  return { ws, config: loadConfig(ws) };
}

export async function cmdSandbox(positionals, opts) {
  if (positionals[0] !== "run") throw new UserError("Usage: ginga sandbox run --lang <id>|--profile-file <f> [--dir D] [--cwd C] [--target T] -- <command>");
  const command = positionals.slice(1).join(" ");
  if (!command) throw new UserError("Nothing to run. Put the command after `--`.");
  if (opts.lang && opts["profile-file"]) throw new UserError("Use either --lang or --profile-file, not both.");
  let ws;
  let config;
  let dir;
  let profileFile = opts["profile-file"] ? resolve(opts["profile-file"]) : null;
  if (opts.jail) {
    if (opts.workspace) throw new UserError("--workspace cannot be combined with --jail.");
    const jail = jailRoot(process.cwd());
    ws = jail.ws;
    config = loadConfig(ws);
    dir = insideJail(jail.root, opts.dir ?? ".");
    if (opts["profile-file"]) profileFile = insideJail(jail.root, opts["profile-file"]);
  } else {
    ({ ws, config } = ctxOrDefaults(opts));
    dir = resolve(opts.dir ?? ".");
  }
  let profile;
  if (profileFile) {
    // A draft profile (written by Claude): official images only, never extra docker flags.
    profile = { ...JSON.parse(readFileSync(profileFile, "utf8")), source: "draft" };
    if (profile.image?.dockerfile || String(profile.image?.pull ?? "").includes("/")) {
      throw new UserError('Draft profiles may only use Docker Official Images via "pull" (no "/" and no dockerfile).');
    }
  } else {
    profile = profileForStack(requireProfile(ws, opts.lang ?? ""), opts.stack ?? "basics");
  }
  const { tmp, work } = materialize(dir, null);
  try {
    const r = await runInSandbox({
      sandbox: config.sandbox, profile, workDir: work, cwd: opts.cwd ?? ".", command,
      env: opts.target ? { TARGET: opts.target } : {},
    });
    process.stdout.write(r.output);
    process.stdout.write(`\n[exit ${r.timedOut ? "timeout" : r.code}]\n`);
    process.exitCode = r.code === 0 ? 0 : 1;
  } finally {
    removeDir(tmp);
  }
}

export async function cmdCoverage(positionals, opts) {
  const { ws, config } = ctx(opts);
  const events = readEvents(ws);
  const langs = positionals.length ? positionals.map((l) => requireProfile(ws, l).id) : rotationIds(ws, config);
  for (const lang of langs) {
    const profile = findProfile(ws, lang);
    if (!profile) {
      console.log(`${lang}: no profile yet\n`);
      continue;
    }
    const { level } = langLevel(ws, config, events, lang);
    const counts = coverageCounts(events, lang);
    const open = unlockedAreas(profile, level);
    const covered = open.filter((a) => counts.get(a.id)).length;
    console.log(`${profile.name} (L${level}): ${covered}/${open.length} unlocked areas covered`);
    // Ecosystem areas are listed too (tagged ⚙), so the whole map is visible in one place.
    const shown = hasEcosystem(profile) ? allAreas(profileForStack(profile, "ecosystem")) : allAreas(profile);
    const width = Math.max(...shown.map((a) => a.id.length));
    for (const a of shown.sort((x, y) => (x.minLevel ?? 1) - (y.minLevel ?? 1))) {
      const n = counts.get(a.id) ?? 0;
      const tag = a.stack === "ecosystem" ? "⚙" : a.specific ? "★" : " ";
      if ((a.minLevel ?? 1) > level) console.log(`  ${tag} ${a.id.padEnd(width)}  ·  unlocks at L${a.minLevel}`);
      else console.log(`  ${tag} ${a.id.padEnd(width)}  ${n ? "■".repeat(Math.min(n, 12)) + ` ${n}` : "□ not yet"}`);
    }
    console.log("");
  }
  const typeCounts = {};
  for (const e of events) if (e.type === "generated" && langs.includes(e.lang)) typeCounts[e.challengeType ?? "implement"] = (typeCounts[e.challengeType ?? "implement"] ?? 0) + 1;
  const domainCounts = {};
  for (const e of events) if (e.type === "generated" && langs.includes(e.lang)) domainCounts[e.domain ?? GENERAL] = (domainCounts[e.domain ?? GENERAL] ?? 0) + 1;
  if (Object.keys(domainCounts).length) {
    console.log(`Domains so far: ${Object.entries(domainCounts).map(([d, n]) => `${d} ${n}`).join(" · ")}`);
  }
  if (Object.keys(typeCounts).length) {
    console.log(`Challenge types so far: ${Object.entries(typeCounts).map(([t, n]) => `${t} ${n}`).join(" · ")}\n`);
  }
  console.log("★ = specific to the language · ⚙ = ecosystem stack (libraries). Generation targets the least-covered unlocked area;");
  console.log("pick one yourself with `ginga new <lang> --area <id>`.");
}

export async function cmdStack(positionals, opts) {
  const { ws, config } = ctx(opts);
  const [lang, mode] = positionals;
  if (lang && mode) {
    const p = requireProfile(ws, lang);
    if (!STACK_MODES.includes(mode)) throw new UserError(`Stack mode must be one of: ${STACK_MODES.join(", ")}.`);
    if (mode !== "basics" && !hasEcosystem(p)) throw new UserError(`${p.id} has no ecosystem stack yet (only basics).`);
    config.stack = { ...(config.stack ?? {}), [p.id]: mode };
    saveConfig(ws, config);
    console.log(`${p.id}: ${mode}.${mode !== "basics" ? " Run `ginga doctor --pull` to build its ecosystem image." : ""}`);
    return;
  }
  if (lang) throw new UserError(`Usage: ginga stack [<lang> ${STACK_MODES.join("|")}]`);
  for (const id of rotationIds(ws, config)) {
    const p = findProfile(ws, id);
    const eco = p && hasEcosystem(p) ? `ecosystem: ${p.stacks.ecosystem.libraries.join(", ")}` : "basics only";
    console.log(`${id.padEnd(12)} ${(p ? stackMode(config, p.id) : "basics").padEnd(10)} (${eco})`);
  }
  console.log("\nbasics = standard library only (default) · mixed = some ecosystem challenges · ecosystem = always libraries");
}

export async function cmdDomains(positionals, opts) {
  const [sub = "list", ...rest] = positionals;
  if (sub === "list") {
    let current = [GENERAL];
    try {
      current = configuredDomains(ctx(opts).config);
    } catch {}
    let group = "";
    for (const d of allDomains()) {
      if (d.group !== group) console.log(`\n${(group = d.group)}`);
      console.log(`  ${current.includes(d.id) ? "●" : " "} ${d.id.padEnd(15)} ${d.name.padEnd(36)} ${d.focus}`);
    }
    console.log("\n● = selected. Change with: ginga domains set|add|remove <id…>");
    return;
  }
  const { ws, config } = ctx(opts);
  const ids = rest.join(",").split(",").map((x) => x.trim()).filter(Boolean).map((id) => requireDomain(id).id);
  let domains = configuredDomains(config);
  if (sub === "set") domains = ids;
  else if (sub === "add") domains = [...domains.filter((d) => d !== GENERAL || ids.includes(GENERAL)), ...ids];
  else if (sub === "remove") domains = domains.filter((d) => !ids.includes(d));
  else throw new UserError("Usage: ginga domains [list] | set <ids…> | add <ids…> | remove <ids…>");
  config.domains = [...new Set(domains)].length ? [...new Set(domains)] : [GENERAL];
  saveConfig(ws, config);
  const specific = config.domains.filter((d) => d !== GENERAL);
  console.log(`Domains: ${config.domains.join(", ")}`);
  if (specific.length) console.log("Challenges rotate through these without repeats; general still appears ~1 in 4.");
}

export async function cmdRotation(positionals, opts) {
  const { ws, config } = ctx(opts);
  const [sub = "list", ...rest] = positionals;
  const parse = (args) =>
    args.join(",").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      .map((l) => findProfile(ws, l)?.id ?? l);
  let rotation = rotationIds(ws, config);
  if (sub === "set") rotation = [...new Set(parse(rest))];
  else if (sub === "add") rotation = [...new Set([...rotation, ...parse(rest)])];
  else if (sub === "remove") {
    const drop = new Set(parse(rest));
    rotation = rotation.filter((l) => !drop.has(l));
  } else if (sub === "mode") {
    if (!ROTATION_MODES.includes(rest[0])) throw new UserError(`Usage: ginga rotation mode ${ROTATION_MODES.join("|")}`);
    config.rotationMode = rest[0];
  } else if (sub !== "list") {
    throw new UserError("Usage: ginga rotation [list] | set <a,b,c> | add <lang…> | remove <lang…> | mode random|ordered");
  }
  if (!rotation.length) throw new UserError("The rotation needs at least one language.");
  if (sub !== "list") {
    config.rotation = rotation;
    saveConfig(ws, config);
  }
  const events = readEvents(ws);
  if (config.rotationMode === "ordered") {
    const next = nextOrdered(events, rotation);
    console.log(`Rotation (ordered, ${rotation.length}): ${rotation.map((l) => (l === next ? `[${l}]` : l)).join(" → ")}`);
    console.log(`Next daily language: ${next}.`);
  } else {
    const { drawn, remaining } = bagState(events, rotation);
    console.log(`Rotation (random, ${rotation.length}): ${rotation.join(", ")}`);
    console.log(`This cycle: drawn ${drawn.length ? drawn.join(", ") : "nothing yet"} · left in the bag: ${remaining.join(", ")}`);
    console.log(`The next daily is drawn at random from what's left; when the bag is empty it refills.`);
  }
  const missing = rotation.filter((l) => !findProfile(ws, l));
  if (missing.length) console.log(`No profile yet for: ${missing.join(", ")} (bootstrapped with Claude on first use).`);
  if (sub !== "list" && sub !== "mode") console.log("Run `ginga doctor --pull` to fetch any new language images.");
}

/** Open the challenge (README + starter files) in $VISUAL / $EDITOR, from inside its folder. */
export async function cmdOpen(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  // Older challenges predate editor files (compile_flags.txt…): add any that are missing.
  const added = writeEditorFiles(c.dir, requireProfile(ws, c.manifest.lang));
  if (added.length) console.log(`Added ${added.join(", ")} for your editor/debugger.`);
  const editor = config.editor || process.env.VISUAL || process.env.EDITOR || "vi";
  const starter = []; // files to open after README: type-specific dirs (subject/, program/, source/), then starter/
  const walk = (rel) => {
    for (const name of readdirSync(join(c.dir, rel)).sort()) {
      const r = `${rel}/${name}`;
      if (statSync(join(c.dir, r)).isDirectory()) walk(r);
      else starter.push(r);
    }
  };
  for (const extra of typeInfo(c.manifest.type).open) if (existsSync(join(c.dir, extra))) walk(extra);
  if (existsSync(join(c.dir, "starter"))) walk("starter");
  const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  // The first open starts the timer that `ginga done` suggests as "minutes spent".
  const events = readEvents(ws);
  if (!events.some((e) => e.type === "opened" && e.id === c.manifest.id)) {
    appendEvent(ws, { type: "opened", id: c.manifest.id, lang: c.manifest.lang, level: c.manifest.level });
    console.log("⏱️  Timer started; `ginga done` will suggest the time since now.");
  }
  console.log(`Opening ${c.manifest.id} in ${editor} …`);
  // Through a shell so editor settings with arguments ("code -w", "nvim -p") work.
  const r = spawnSync(`${editor} ${["README.md", ...starter].map(quote).join(" ")}`, {
    cwd: c.dir, stdio: "inherit", shell: true,
  });
  if (r.status !== 0) process.exitCode = r.status ?? 1;
  console.log(`\nNext: ginga test${positionals[0] ? ` ${positionals[0]}` : ""}`);
}

export async function cmdLang(positionals, opts) {
  const sub = positionals[0] ?? "list";
  let ws = null;
  try {
    ws = findWorkspace(opts.workspace);
  } catch {}
  if (sub === "list") {
    for (const p of allProfiles(ws)) {
      const eco = hasEcosystem(p) ? `  + ecosystem: ${(p.stacks.ecosystem.libraries ?? []).join(", ")}` : "";
      console.log(`${p.id.padEnd(12)} ${p.name.padEnd(14)} ${imageRef(p).padEnd(28)} ${p.source}${p.aliases?.length ? `  (aliases: ${p.aliases.join(", ")})` : ""}${eco}`);
    }
    return;
  }
  if (sub === "add") {
    const name = positionals[1];
    if (!name) throw new UserError("Usage: ginga lang add <language>");
    const { config } = ctx(opts);
    if (findProfile(ws, name) && !opts.force) throw new UserError(`"${name}" already has a profile (use --force to bootstrap anyway).`);
    const { profile } = await bootstrapProfile({ ws, config, name });
    console.log(`✔ Added profile "${profile.id}" (${imageRef(profile)}) to ${join(ws, "profiles")}`);
    return;
  }
  throw new UserError("Usage: ginga lang list | ginga lang add <language>");
}

// ---------------------------------------------------------------- schedule / doctor / review

export async function cmdSchedule(positionals, opts) {
  const sub = positionals[0] ?? "status";
  if (sub === "status") return console.log(scheduleStatus());
  if (sub === "remove") return console.log(removeSchedule());
  if (sub === "install") {
    const { ws, config } = ctx(opts);
    if (opts.time) {
      config.schedule.time = validTime(opts.time);
      saveConfig(ws, config);
    }
    return console.log(installSchedule({ ws, config }));
  }
  throw new UserError("Usage: ginga schedule install [--time HH:MM] | remove | status");
}

function hasBin(bin) {
  if (isAbsolute(bin)) return existsSync(bin);
  return (process.env.PATH ?? "").split(delimiter).some((d) => d && existsSync(join(d, bin)));
}

export async function cmdDoctor(_positionals, opts) {
  const { ws, config } = ctxOrDefaults(opts);
  const line = (ok, label, detail = "") => console.log(`${ok ? "✔" : "✘"} ${label}${detail ? `: ${detail}` : ""}`);
  const [major, minor] = process.versions.node.split(".").map(Number);
  line(major > 22 || (major === 22 && minor >= 18), "node", process.versions.node);
  line(hasBin(config.claude.command), "claude", hasBin(config.claude.command) ? "found" : "not found (install Claude Code)");
  line(hasBin("notify-send"), "notify-send", hasBin("notify-send") ? "found" : "missing; notifications go to stdout only");
  const engine = engineAvailable(config.sandbox);
  line(engine.ok, "sandbox", engine.detail);
  if (!ws) return console.log("(no workspace yet)");
  line(true, "workspace", ws);
  for (const lang of config.rotation) {
    const p = findProfile(ws, lang);
    if (!p) {
      line(false, lang, "no profile yet (bootstrapped with Claude on first use, or `ginga lang add`)");
      continue;
    }
    const mode = stackMode(config, p.id);
    const stacks = mode === "basics" || !hasEcosystem(p) ? ["basics"] : mode === "ecosystem" ? ["ecosystem"] : ["basics", "ecosystem"];
    for (const stack of stacks) {
      const sp = profileForStack(p, stack);
      if (opts.pull && engine.ok) ensureImage(config.sandbox, sp);
      const present = engine.ok && imagePresent(config.sandbox, sp);
      const label = stack === "ecosystem" ? `${lang} (ecosystem)` : lang;
      line(present, label, `${imageRef(sp)} ${present ? "ready" : "not built/pulled yet (`ginga doctor --pull`)"}`);
    }
  }
}

export async function cmdReview(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  if (isLocked(c.dir)) throw new UserError("Review needs the reference solution: solve it (`ginga done`) or `ginga giveup` first.");
  const profile = challengeProfile(ws, c.manifest);
  // Work on a staging copy so Claude can run code through the jailed sandbox command.
  const staging = join(ws, ".staging", `review-${c.manifest.id}-${Date.now().toString(36)}`);
  cpSync(c.dir, staging, { recursive: true });
  const prefix = sandboxPrefix({ lang: profile.id, stack: profile.stack });
  const testCmd = c.manifest.test?.command ?? profile.testCommand;
  const typeNote = {
    "write-the-tests": "This is a write-the-tests challenge: starter/ holds the USER'S TESTS for subject/, and solution/ the reference tests. Review the test suite: missing input classes, weak assertions, unclear names, redundant tests. ",
    trace: "This is a trace challenge: starter/answer.txt is the user's predicted output of program/. Explain each wrong line's misconception. ",
    port: "This is a port challenge from source/ (another language): check idiomatic use of the target language and every semantic difference that could bite. ",
    optimize: "This is an optimize challenge: check the complexity of the user's version, and any behavior change against the original. ",
    "debug-from-symptom": "This is a debug-from-symptom challenge: check that the user fixed the root cause, not just the symptom. ",
  }[c.manifest.type] ?? "";
  const prompt =
    typeNote +
    "You are reviewing a practice solution. starter/ is the user's solution, solution/ the reference, " +
    "README.md the problem, tests/ the suite. Write a short, direct code review in Markdown: correctness " +
    "risks the tests miss, complexity, idiomatic improvements for this language, and one thing done well. " +
    "No praise padding. Do not modify any file.\n\n" +
    "VERIFY your claims by running code; do not guess. You can only run code in a sandbox with this exact " +
    "prefix (type it exactly, from this directory, each option once):\n" +
    `  ${prefix} --cwd tests --target starter -- '${testCmd}'\n` +
    "Use --target solution for the reference. For edge-case probes, write a small script in a new folder " +
    "(e.g. probes/) that loads ../starter and ../solution and prints both results, then run it with " +
    `\`${prefix} --cwd probes -- '<command>'\`. Report the actual outputs you observed. ` +
    "When the tests miss a real bug, end with a section '## Missing tests' listing the test cases to add.";
  console.log("Asking Claude for a review (it can run the tests in the sandbox) …");
  let out;
  try {
    out = await new Promise((resolvePromise, reject) => {
      const child = spawn(config.claude.command, [
        "-p", prompt, "--permission-mode", "acceptEdits",
        "--allowedTools", "Read", "Glob", "Grep", "Write", `Bash(${prefix}:*)`,
        "--disallowedTools", "WebFetch", "WebSearch",
        ...(config.claude.model ? ["--model", config.claude.model] : []),
      ], { cwd: staging, stdio: ["ignore", "pipe", "inherit"] });
      let text = "";
      child.stdout.on("data", (d) => (text += d));
      child.on("error", (e) => reject(new UserError(`Could not run "${config.claude.command}": ${e.message}`)));
      child.on("close", (code) => (code === 0 ? resolvePromise(text.trim()) : reject(new UserError(`Claude exited with code ${code}.`))));
    });
  } finally {
    removeDir(staging);
  }
  appendFileSync(join(c.dir, "NOTES.md"), `\n## Review (${today()})\n\n${out}\n`);
  console.log(out);
  console.log(`\n(appended to ${join(c.dir, "NOTES.md")})`);
}

// ---------------------------------------------------------------- workspace git

export async function cmdCommit(_positionals, opts) {
  const { ws, config } = ctx(opts);
  ensureRepo(ws);
  refreshViews(ws); // commit an up-to-date dashboard
  if (git(ws, ["add", "-A"]).status !== 0) throw new UserError("git add failed.");
  const files = stagedFiles(ws);
  if (!files.length) {
    console.log("Nothing to commit: the workspace is clean.");
    return;
  }
  let message = buildCommitMessage({
    allEvents: readEvents(ws), newEvents: stagedNewEvents(ws), files, leveling: config.leveling, today: today(),
    levelOf: (history, lang) => langLevel(ws, config, history, lang).level,
  });
  const msgFile = join(makeTempDir("gingaloop-commit-"), "COMMIT_MSG");
  writeFileSync(msgFile, message);
  if (!opts.yes) {
    if (!isTTY()) {
      git(ws, ["reset", "-q"]);
      throw new UserError("Re-run with --yes to commit non-interactively.");
    }
    console.log(`\n${message.replace(/^/gm, "  ")}`);
    const answer = (await ask("Commit with this message? [Y]es / [e]dit / [n]o", "y")).toLowerCase();
    if (answer.startsWith("e")) {
      const editor = config.editor || process.env.VISUAL || process.env.EDITOR || "vi";
      spawnSync(`${editor} '${msgFile.replace(/'/g, `'\\''`)}'`, { stdio: "inherit", shell: true });
      message = readFileSync(msgFile, "utf8");
      if (!message.replace(/^#.*$/gm, "").trim()) {
        git(ws, ["reset", "-q"]);
        console.log("Empty message: nothing committed (changes unstaged).");
        return;
      }
    } else if (!answer.startsWith("y")) {
      git(ws, ["reset", "-q"]);
      console.log("Nothing committed (changes unstaged).");
      return;
    }
  }
  // Inherit stdio so GPG signing and hooks can talk to the user.
  const r = git(ws, ["commit", "-q", "-F", msgFile], { inherit: true });
  if (r.status !== 0) {
    throw new UserError("git commit failed (see above). Your changes are still staged; fix it and run `ginga commit` again.");
  }
  console.log(`✔ Committed: ${message.split("\n")[0]}`);
  if (opts.push) pushWorkspace(ws);
}

export async function cmdPush(_positionals, opts) {
  const { ws } = ctx(opts);
  pushWorkspace(ws);
  console.log("✔ Pushed.");
}

