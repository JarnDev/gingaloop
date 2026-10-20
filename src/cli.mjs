// Command implementations for `ginga`.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, watch, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { isDeepStrictEqual } from "node:util";
import {
  ORIGINAL_DIR, byCreation, isLocked, listChallenges, pickChallenge, readHints, unlockChallenge, writeEditorFiles,
} from "./challenges.mjs";
import { completionScript } from "./help.mjs";
import { bootstrapProfile, generateChallenge, parseClaudeCost, runClaude, sandboxPrefix } from "./generate.mjs";
import { resolveLevel, streakState } from "./levels.mjs";
import { gateSummary, langLevel, promotionAreas, promotionDue } from "./progression.mjs";
import { notify } from "./notify.mjs";
import { allProfiles, findProfile, requireProfile } from "./profiles.mjs";
import { appendEvent, challengeStatus, eventDate, readEvents, withoutDiscarded } from "./progress.mjs";
import { gradeTarget, materialize, readManifest, validateTree } from "./runner.mjs";
import { TYPE_IDS, choosePortSource, eligibleTypes, pickType, typeInfo } from "./types.mjs";
import { builtImages, engineAvailable, ensureImage, imagePresent, imageRef, makeTempDir, removeDir, removeImages, runInSandbox } from "./sandbox.mjs";
import { refreshViews } from "./dashboard.mjs";
import { allAreas, coverageCounts, findArea, pickArea, unlockedAreas } from "./coverage.mjs";
import { STACK_MODES, hasEcosystem, pickStack, profileForStack, stackMode } from "./stacks.mjs";
import { GENERAL, allDomains, configuredDomains, ecosystemShare, pickDomain, requireDomain } from "./domains.mjs";
import { ROTATION_MODES, bagState, dailySettings, drawLangs, extrasRolled, nextOrdered } from "./rotation.mjs";
import { installSchedule, removeSchedule, scheduleStatus } from "./schedule.mjs";
import { buildCommitMessage, ensureRepo, git, pushWorkspace, stagedFiles, stagedNewEvents } from "./gitops.mjs";
import { VaultKeyError, readBundle } from "./vault.mjs";
import { PACE_DEFAULTS, PACE_FOOTNOTE, isStruggle, paceFor, paceLabel, paceReport, solvePace } from "./pace.mjs";
import { dueReview, openReview, reviewCycles, reviewOpts, reviewSummary, rootOf } from "./reviews.mjs";
import { fillNotes, noteValues } from "./notes.mjs";
import { humanMinutes, timerMinutes, timerState } from "./timer.mjs";
import { bar, displayWidth, heading, mark, paint, plural, table, termWidth, tilde, truncate } from "./view.mjs";
import {
  IMPROVEMENTS_FILE, LESSONS_FILE, addImprovements, addLessons, builtInRules, issueUrl, latestReview, learnPrompt, learnedFrom, parseLearnResult, readLessons,
} from "./lessons.mjs";
import {
  CONFIG_FILE, CONFIG_KEYS, DEFAULT_CONFIG, PKG_ROOT, UserError, daysBetween, findWorkspace, getConfigValue, loadConfig,
  parseConfigValue, readGlobalConfig, saveConfig, today, withConfigValue, writeGlobalConfig,
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
  ensureLines(join(dir, ".gitignore"), [".staging/", ".logs/", "node_modules/"]);
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

/** The card printed for a new challenge: title, facts, folder, next steps. */
function printNew({ dir, manifest: m }, { langName = m.lang, tag = "" } = {}) {
  const facts = [langName, paint.cyan(`L${m.level}`), m.type ?? "implement", `~${m.estMinutes} min`];
  console.log(`\n${mark.ok()} ${paint.bold(m.title)}${tag ? `  ${tag}` : ""}`);
  console.log(`  ${facts.join(paint.dim(" · "))}`);
  console.log(`  ${paint.dim(tilde(dir))}`);
  console.log(`  ${paint.dim("next:")} ginga open → edit starter/ → ginga test → ginga done   ${paint.dim("(stuck? ginga hint)")}`);
}

export async function cmdNew(positionals, opts) {
  const { ws, config } = ctx(opts);
  const lang = positionals[0];
  if (!lang) throw new UserError("Usage: ginga new <language> [--level N]");
  const base = await profileFor(ws, config, lang, opts);
  const events = withoutDiscarded(readEvents(ws));
  const state = langLevel(ws, config, events, base.id);
  const requestedLevel = resolveLevel(opts.level, state, base.id, config.leveling);
  // --stack wins; an ecosystem-only --area implies the ecosystem stack; else the config decides.
  const domain = opts.domain ? requireDomain(opts.domain).id : pickDomain(events, configuredDomains(config));
  let stack = opts.stack;
  if (!stack && opts.area && hasEcosystem(base) && findArea(profileForStack(base, "ecosystem"), opts.area)?.stack === "ecosystem") stack = "ecosystem";
  stack ??= pickStack(base, stackMode(config, base.id), { share: ecosystemShare(domain) });
  const profile = profileForStack(base, stack);
  const promotion = opts.type || opts.level != null ? null : promotionFor(events, base.id, state);
  const { type, sourceLang, level } = promotion
    ? { type: "implement", sourceLang: null, level: state.level }
    : chooseType(ws, config, events, profile, requestedLevel, opts.type, { levelExplicit: opts.level != null });
  if (promotion) console.error(`🥋 Promotion challenge for level ${level + 1} (areas: ${promotion.join(", ")}).`);
  if (level !== requestedLevel) console.error(`Port at level ${level}: your ${sourceLang} level is the limit for reading the source.`);
  let area;
  if (opts.area) {
    area = findArea(profile, opts.area);
    if (!area) throw new UserError(`Unknown area "${opts.area}" for ${profile.id}. See \`ginga coverage ${profile.id}\`.`);
    if ((area.minLevel ?? 1) > level) throw new UserError(`Area "${area.id}" starts at level ${area.minLevel}; this challenge is level ${level}.`);
  } else {
    area = (promotion && findArea(profile, promotion[0])) || pickArea(profile, level, events);
  }
  const result = await generateChallenge({ ws, config, profile, level, area, type, sourceLang, domain, promotion, source: "manual" });
  printNew(result, { langName: profile.name, tag: promotion ? paint.magenta(`🥋 promotion to L${level + 1}`) : "" });
}

export { dueReview } from "./reviews.mjs";
export { isStruggle } from "./pace.mjs";

function openChallengeIds(events) {
  const closed = new Set(events.filter((e) => e.type === "solved" || e.type === "gaveup" || e.type === "discarded").map((e) => e.id));
  return new Set(events.filter((e) => e.type === "generated" && !closed.has(e.id)).map((e) => e.id));
}

/** Promotion areas when this language's next challenge should be a promotion, else null. */
function promotionFor(events, lang, state) {
  if (!promotionDue(state, events, lang, today(), openChallengeIds(events))) return null;
  const areas = promotionAreas(events, lang, state.level);
  return areas.length ? areas : null;
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

/**
 * Today's challenges: each anchor, or one pick from the rotation when there are no anchors; the
 * extras rolled for today; and a review when one is due and no other review is still open (reviews
 * never take a slot, and never pile up). Each slot runs once a day, so a rerun only retries what
 * failed; --force makes one more from the rotation.
 */
export async function cmdDaily(_positionals, opts) {
  const { ws, config } = ctx(opts);
  const date = today();
  const events = withoutDiscarded(readEvents(ws));
  const rotation = rotationIds(ws, config);
  const plan = dailyPlan(events, config, date, { force: opts.force, rotation });
  const slots = dailySlots(events, plan, { pool: dailySettings(config, rotation).pool, rotation, mode: config.rotationMode });
  const failures = [];
  for (const [i, s] of slots.entries()) {
    if (i) console.log("");
    await dailyOne(ws, config, withoutDiscarded(readEvents(ws)), s).catch((e) => failures.push(e));
  }
  if (!slots.length) printToday(ws, events, date);
  if (plan.extrasSkipped.length) {
    const titles = plan.extrasSkipped.map((id) => `"${generatedEvent(events, id)?.title ?? id}"`);
    console.log(`\n${mark.warn()} Today's extra waits: finish or give up ${titles.join(", ")} first (from an earlier day).`);
  }
  if (plan.review) {
    console.log("");
    await dailyOne(ws, config, withoutDiscarded(readEvents(ws)), { review: plan.review }).catch((e) => failures.push(e));
  } else if (plan.waiting) {
    console.log(`\n🔁 A review of "${plan.waiting.title}" is due; it comes once you finish the open one ${paint.dim(`(${plan.openReview.title ?? plan.openReview.id})`)}.`);
  }
  if (failures.length) throw failures[0];
}

/** When everything for today exists: what it is and where each stands. */
function printToday(ws, events, date) {
  const todays = events.filter((e) => e.type === "generated" && e.source === "daily" && eventDate(e) === date);
  console.log(heading("Today's challenges are ready"));
  for (const e of todays) {
    const status = challengeStatus(events, e.id).status;
    const name = findProfile(ws, e.lang)?.name ?? e.lang;
    console.log(`  ${statusMark(status)} ${paint.bold(e.title ?? e.id)}  ${paint.dim(`${name} · L${e.level}${e.reviewOf ? " · 🔁 review" : ""}`)}  ${statusText(status)}`);
  }
  console.log(paint.dim("ginga daily --force makes another one."));
}

const STATUS_STYLE = { solved: ["✔", "green"], open: ["○", "yellow"], gaveup: ["✘", "red"], discarded: ["⬛", "dim"] };
const statusMark = (status) => paint[STATUS_STYLE[status]?.[1] ?? "dim"](STATUS_STYLE[status]?.[0] ?? "·");
const statusText = (status, label = status) => paint[STATUS_STYLE[status]?.[1] ?? "dim"](label);

/** The plan as challenges to make: `{lang, slot}` with slot anchor | pick | extra | forced. */
export function dailySlots(events, plan, { pool, rotation, mode, rand }) {
  const drawn = drawLangs(events, pool, plan.picks + plan.extras, { mode, taken: plan.madeToday, rand });
  const forcePool = pool.length ? pool : rotation;
  // --force: another language when one is left today, else any.
  const forced = plan.forced
    ? [...drawLangs(events, forcePool, 1, { mode, taken: [...plan.madeToday, ...drawn], rand }), ...drawLangs(events, forcePool, 1, { mode, rand })].slice(0, 1)
    : [];
  return [
    ...plan.anchors.map((lang) => ({ lang, slot: "anchor" })),
    ...drawn.map((lang, i) => ({ lang, slot: i < plan.picks ? "pick" : "extra" })),
    ...forced.map((lang) => ({ lang, slot: "forced" })),
  ];
}

/**
 * What `daily` makes today: the anchors not made yet; without anchors, the rotation pick unless it
 * exists; the extras rolled for today that aren't made yet (none while a challenge from an earlier
 * day is open); one more with --force; and the due review unless a review is still open or one was
 * made today.
 */
export function dailyPlan(events, config, date, { force = false, rotation = config.rotation } = {}) {
  const todays = events.filter((e) => e.type === "generated" && e.source === "daily" && eventDate(e) === date);
  const rotations = todays.filter((e) => !e.reviewOf);
  const { anchors, extraChance, extraMax } = dailySettings(config, rotation);
  const made = (slot) => rotations.filter((e) => (e.slot ?? "pick") === slot);
  const earlierOpen = events
    .filter((e) => e.type === "generated" && !e.reviewOf && eventDate(e) < date && challengeStatus(events, e.id).status === "open")
    .map((e) => e.id);
  const extrasDue = Math.max(0, extrasRolled(date, extraChance, extraMax) - made("extra").length);
  const due = dueReview(events, config.reviewAfterDays, date, reviewOpts(config));
  const open = openReview(events);
  const reviewToday = todays.some((e) => e.reviewOf);
  return {
    anchors: anchors.filter((l) => !made("anchor").some((e) => e.lang === l)),
    picks: anchors.length || made("pick").length ? 0 : 1,
    extras: earlierOpen.length ? 0 : extrasDue,
    extrasSkipped: extrasDue ? earlierOpen : [],
    forced: force ? 1 : 0,
    madeToday: rotations.map((e) => e.lang),
    review: due && !open && !reviewToday ? due : null,
    waiting: due && open && !reviewToday ? due : null,
    openReview: open,
  };
}

/** Generate one daily challenge: from the rotation (`lang`, in `slot`) or a review of `review`. */
async function dailyOne(ws, config, events, { lang, slot = null, review = null }) {
  try {
    const base = await profileFor(ws, config, review?.lang ?? lang, { yes: true });
    const reviewed = review && generatedEvent(events, review.id);
    const domain = reviewed?.domain ?? pickDomain(events, configuredDomains(config));
    const profile = profileForStack(base, reviewed?.stack ?? pickStack(base, stackMode(config, base.id), { share: ecosystemShare(domain) }));
    const state = langLevel(ws, config, events, profile.id);
    const earned = review ? Math.min(review.level ?? state.level, state.level) : state.level;
    const promotion = review ? null : promotionFor(events, profile.id, state);
    const { type, sourceLang, level } = review || promotion
      ? { type: "implement", sourceLang: null, level: earned }
      : chooseType(ws, config, events, profile, earned, null);
    const area = (review?.area && findArea(profile, review.area)) || (promotion && findArea(profile, promotion[0])) || pickArea(profile, level, events);
    const result = await generateChallenge({ ws, config, profile, level, area, type, sourceLang, domain, promotion, source: "daily", slot, reviewOf: review });
    const tag = review ? paint.cyan("🔁 review (optional)") : promotion ? paint.magenta(`🥋 promotion to L${level + 1}`)
      : slot === "extra" ? paint.dim("extra") : "";
    printNew(result, { langName: profile.name, tag });
    notify(
      `gingaloop · ${profile.name} · L${level}${review ? " · 🔁 review (optional)" : ""}${promotion ? ` · 🥋 promotion to L${level + 1}` : ""}`,
      `${result.manifest.title} (~${result.manifest.estMinutes} min)\n${result.dir}`,
    );
  } catch (e) {
    notify(`gingaloop: daily ${review ? "review " : ""}generation failed`, e.message.split("\n")[0], { urgent: true });
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
  const once = async () => {
    console.log(paint.dim(`Testing "${c.manifest.title}" in the sandbox …\n`));
    const r = await runStarter(ws, config, c);
    console.log(tail(r.output));
    const warn = readmeKeyWarning(c.dir);
    if (warn) console.log(`\n${mark.warn()} ${warn}`);
    if (r.passed) console.log(`\n${mark.ok()} ${paint.green("All tests pass.")} Record it with \`ginga done\`.`);
    else console.log(`\n${mark.fail()} ${paint.red(`Not passing yet${r.timedOut ? " (timed out)" : ""}.`)}`);
    return r.passed;
  };
  if (!opts.watch) {
    if (!(await once())) process.exitCode = 1;
    return;
  }
  await watchTests(c.dir, once);
}

// Editor temp files that shouldn't trigger a run (vim swap/backup, the 4913 probe, emacs locks).
const EDITOR_NOISE = /(^|\/)(\.#|#.*#$|4913$)|\.sw[a-p]$|~$/;

/** Rerun `run` whenever a file under starter/ or tests/ changes, until Ctrl+C. */
function watchTests(dir, run) {
  const watched = ["starter", "tests"].map((d) => join(dir, d)).filter((d) => existsSync(d));
  let timer = null;
  let running = false;
  let again = false;
  const trigger = async () => {
    if (running) return void (again = true);
    running = true;
    process.stdout.write("\x1bc"); // clear the screen between runs
    await run().catch((e) => console.error(e.message));
    console.log(paint.dim("\n👀 Watching starter/ and tests/ (Ctrl+C to stop) …"));
    running = false;
    if (again) {
      again = false;
      trigger();
    }
  };
  const watchers = watched.map((d) => watch(d, { recursive: true }, (_event, file) => {
    if (file && EDITOR_NOISE.test(String(file))) return;
    clearTimeout(timer);
    timer = setTimeout(trigger, 300);
  }));
  trigger();
  return new Promise((resolvePromise) => {
    process.once("SIGINT", () => {
      for (const w of watchers) w.close();
      clearTimeout(timer);
      console.log("");
      resolvePromise();
    });
  });
}

export async function cmdHint(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const events = readEvents(ws);
  const { status, hints: used } = challengeStatus(events, c.manifest.id);
  const hints = readHints(c.dir);
  const show = (i) => console.log(`${paint.bold(paint.cyan(`💡 Hint ${i + 1}/${hints.length}`))}\n${hints[i].trim()}\n`);
  if (status !== "open") {
    hints.forEach((_, i) => show(i));
    return;
  }
  if (used >= hints.length) {
    console.log(`No more hints (${hints.length}/${hints.length} used). Keep going, or \`ginga giveup\`.`);
    return;
  }
  for (let i = 0; i < used; i++) show(i);
  const hm = config.leveling.hintMultiplier;
  const pct = Math.round(hm[Math.min(used + 1, hm.length - 1)] * 100);
  // Say what the hint costs before it's revealed, not after.
  const costs = [`this solve drops to ${pct}% of its points`];
  if (used + 1 === 2) costs.push("2 hints bring the challenge back as a review and break your clean streak");
  if (c.manifest.promotion && used + 1 === 2) costs.push("a promotion needs at most 1 hint");
  if (!(await confirm(`Reveal hint ${used + 1}/${hints.length}? (${costs.join("; ")})`, opts.yes))) return;
  console.log("");
  show(used);
  appendEvent(ws, { type: "hint", id: c.manifest.id, lang: c.manifest.lang, level: c.manifest.level, hint: used + 1 });
  refreshViews(ws);
  console.log(paint.dim(`${used + 1}/${hints.length} hints used · this solve is now worth ${pct}% of its points`));
}

function tryUnlock(dir) {
  try {
    if (unlockChallenge(dir)) console.log(`🔓 Unlocked: ${paint.dim(tilde(join(dir, "solution", "EXPLANATION.md")))}`);
    return true;
  } catch (e) {
    if (e instanceof VaultKeyError) {
      console.log(`${mark.warn()} ${e.message}\n  Then run the same command again to unlock.`);
      return false;
    }
    throw e;
  }
}

/**
 * Fill the empty fields of the challenge's NOTES.md after a solve or give-up (what you wrote stays).
 * Hint numbers come from the events; the total from the hints in the lock.
 */
function fillChallengeNotes(c, values) {
  const file = join(c.dir, "NOTES.md");
  if (!existsSync(file)) return;
  const { text, filled } = fillNotes(readFileSync(file, "utf8"), values);
  if (filled.length) {
    writeFileSync(file, text);
    console.log(paint.dim(`📝 NOTES.md: filled in ${filled.join(", ").toLowerCase()}.`));
  }
}

function hintFacts(c, events) {
  const used = events.filter((e) => e.type === "hint" && e.id === c.manifest.id).map((e) => e.hint).filter(Number.isFinite);
  let total = null;
  try {
    total = readHints(c.dir).length;
  } catch {}
  return { hintsUsed: [...new Set(used)].sort((a, b) => a - b), hintsTotal: total };
}

export async function cmdDone(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const m = c.manifest;
  const events = readEvents(ws);
  const before = langLevel(ws, config, events, m.lang);
  const { status, hints } = challengeStatus(events, m.id);
  if (status === "solved") {
    console.log(`${mark.ok()} "${m.title}" is already solved.`);
    tryUnlock(c.dir);
    return;
  }
  console.log(paint.dim(`Running the tests for "${m.title}" in the sandbox …`));
  const r = await runStarter(ws, config, c);
  if (!r.passed) {
    console.log(tail(r.output, 30));
    console.log(`\n${mark.fail()} ${paint.red("Tests are not passing")}, so it can't be recorded as solved.`);
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
      console.log(`⏱️  The timer says ${humanMinutes(timer.measured)} of active time; that probably includes breaks you didn't pause for.`);
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
  // Your pace as it was before this solve, stored so this solve's verdict never shifts later.
  const pace = paceFor(events, m.lang, config.pace);
  const solved = appendEvent(ws, {
    type: "solved", id: m.id, lang: m.lang, level: m.level, topics: m.topics,
    minutes, ...(minutesSource ? { minutesSource } : {}), hints, pace: pace.factor, paceCalibrated: pace.calibrated,
    ...(m.promotion ? { promotion: true } : {}),
    ...(status === "gaveup" ? { afterGiveup: true } : {}),
    ...(r.accidental?.length ? { accidental: r.accidental } : {}),
  });
  const after = langLevel(ws, config, readEvents(ws), m.lang);
  const earned = after.points - before.points;
  const why = [];
  if (status === "gaveup") why.push("solved after giving up");
  else {
    if (m.level < before.level) why.push(`level ${m.level} is below your level ${before.level}`);
    if (hints) why.push(`${hints} hint${hints === 1 ? "" : "s"}`);
  }
  const name = findProfile(ws, m.lang)?.name ?? m.lang;
  console.log(`\n${mark.ok()} ${paint.bold(`Solved "${m.title}"`)}  ${paint.green(`+${earned} points`)}${why.length ? paint.dim(` (${why.join(", ")})`) : ""}`);
  const p = solvePace(readEvents(ws), solved, config.pace);
  if (p) console.log(paceReport(p, config.pace));
  if (r.accidental?.length && status !== "gaveup") {
    console.log(`  ${mark.warn()} Item ${r.accidental.join(", ")} of "What to test" was caught only through other items' tests: not a clean solve, and this topic comes back as a review.`);
  } else if (hints >= 2 && status !== "gaveup") console.log(`  ${mark.warn()} 2+ hints: this topic comes back as a review.`);
  else if (minutes == null) console.log(paint.dim("  (no time recorded, so no pace comparison)"));
  if (after.level > before.level) console.log(paint.bold(paint.green(`🎉 Level ${after.level} unlocked for ${name}!`)));
  else if (m.promotion) console.log(`${mark.warn()} Promotion not passed yet (it needs a clean solve: at most 1 hint, nothing caught by accident); another one comes in ${config.leveling.promotionRetryDays ?? 3} days.`);
  else if (after.gates?.promotionPending && !before.gates?.promotionPending) console.log(paint.magenta(`🥋 Gates met: your next ${name} challenge is a promotion to level ${after.level + 1}.`));
  console.log(`  ${paint.bold(name)}  ${levelLine(after, config.leveling)}`);
  tryUnlock(c.dir);
  const all = readEvents(ws);
  fillChallengeNotes(c, noteValues({
    outcome: { kind: "solved", date: solved.date, points: earned, review: status !== "gaveup" && isStruggle(all, solved, config.pace), accidental: r.accidental },
    minutes, minutesSource, timer, pace: p, startedAt: timerState(events, m.id).startedAt, ...hintFacts(c, events),
  }));
  refreshViews(ws);
}

export async function cmdGiveup(positionals, opts) {
  const { ws } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const m = c.manifest;
  const { status } = challengeStatus(readEvents(ws), m.id);
  if (status === "open") {
    if (!(await confirm(`Give up on "${m.title}" and reveal the solution?`, opts.yes))) return;
    // What stopped you: goes to NOTES.md and steers the review challenges of this topic.
    let reason = opts.reason?.trim();
    if (reason == null && !opts.yes && isTTY()) reason = (await ask("What stopped you? (enter to skip):", "")).trim();
    const events = readEvents(ws);
    const timer = timerMinutes(events, m.id);
    const e = appendEvent(ws, {
      type: "gaveup", id: m.id, lang: m.lang, level: m.level, topics: m.topics,
      ...(m.promotion ? { promotion: true } : {}), ...(reason ? { reason } : {}),
    });
    console.log(`${mark.fail()} Gave up on "${m.title}". ${paint.dim("This topic comes back as a review challenge in a few days.")}`);
    tryUnlock(c.dir);
    fillChallengeNotes(c, noteValues({
      outcome: { kind: "gaveup", date: e.date, review: true }, timer, reason, startedAt: timerState(events, m.id).startedAt, ...hintFacts(c, events),
    }));
    return refreshViews(ws);
  }
  tryUnlock(c.dir);
  refreshViews(ws);
}

/**
 * Drop a challenge that shouldn't count: broken, a near-duplicate, or just not wanted. No penalty,
 * no review, no solution reveal; generation forgets it (its area, type and daily slot come back).
 */
export async function cmdDiscard(positionals, opts) {
  const { ws } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  const m = c.manifest;
  const { status } = challengeStatus(readEvents(ws), m.id);
  if (status !== "open") throw new UserError(`"${m.title}" is ${status === "gaveup" ? "given up" : status}; only open challenges can be discarded.`);
  if (!(await confirm(`Discard "${m.title}"? It won't count anywhere (the folder stays).`, opts.yes))) return;
  const reason = opts.reason?.trim();
  appendEvent(ws, { type: "discarded", id: m.id, lang: m.lang, level: m.level, ...(reason ? { reason } : {}) });
  console.log(`⬛ Discarded "${m.title}". ${paint.dim(m.source === "daily" ? "Run `ginga daily` for a replacement." : `Generate another with \`ginga new ${m.lang}\`.`)}`);
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
  return `${paint.cyan(`L${s.level}`)}  ${bar(shown - floor, s.nextAt - floor, 12, paint.green)}  ${s.points} / ${s.nextAt} pts ${paint.dim(`(${toGo}${gates ? `; ${gates}` : ""})`)}`;
}

export async function cmdRank(_positionals, opts) {
  const { ws, config } = ctx(opts);
  const events = readEvents(ws);
  refreshViews(ws); // keep README/INDEX current after config edits
  const langs = [...new Set([...rotationIds(ws, config), ...events.map((e) => e.lang).filter(Boolean)])];
  const st = streak(events);
  if (opts.json) return console.log(JSON.stringify(rankData(ws, config, events, langs, st), null, 2));
  const freezes = st.freezes ? ` · ❄️ ${plural(st.freezes, "freeze")}` : "";
  const next = 7 - (st.days % 7);
  console.log(`${paint.bold(`🔥 Streak ${plural(st.days, "day")}`)}${freezes}  ${paint.dim(`next freeze in ${plural(next, "solve day")} (max 2)`)}`);
  if (st.frozeOn.length) console.log(paint.dim(`   freezes used on ${st.frozeOn.join(", ")}`));
  const reviewLine = reviewSummary(events, config);
  if (reviewLine) console.log(paint.cyan(reviewLine));
  console.log("");

  const rows = langs.map((lang) => {
    const s = langLevel(ws, config, events, lang);
    const solved = events.filter((e) => e.type === "solved" && e.lang === lang);
    const mins = solved.map((e) => e.minutes).filter(Number.isFinite);
    const eco = solved.filter((e) => generatedEvent(events, e.id)?.stack === "ecosystem").length;
    const floor = s.level === 1 ? 0 : config.leveling.thresholds[s.level - 2];
    const atMax = s.level >= s.max;
    return {
      s, atMax, name: findProfile(ws, lang)?.name ?? lang,
      share: atMax ? 1 : (Math.min(s.points, s.nextAt) - floor) / (s.nextAt - floor),
      progress: atMax ? paint.green(`max level · ${s.points} pts`) : `${bar(Math.min(s.points, s.nextAt) - floor, s.nextAt - floor, 12, paint.green)}  ${s.points}/${s.nextAt}`,
      solved: `${solved.length}${eco ? ` (${eco} ⚙)` : ""}`,
      gaveUp: events.filter((e) => e.type === "gaveup" && e.lang === lang).length,
      avg: mins.length ? `${Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)} min` : "–",
      pace: paceLabel(paceFor(events, lang, config.pace)),
    };
  }).sort((a, b) => b.s.level - a.s.level || b.share - a.share);
  console.log(table(
    ["Language", "Level", "Progress", "Solved", "Gave up", "Avg time", "Pace"],
    rows.map((r) => [r.name, paint.cyan(`L${r.s.level}`), r.progress, r.solved, r.gaveUp ? paint.red(r.gaveUp) : r.gaveUp, r.avg, r.pace]),
    ["left", "left", "left", "right", "right", "right", "left"],
  ));
  const needs = rows.filter((r) => !r.atMax);
  if (needs.length) {
    console.log(`\n${heading("Still needed for the next level")}`);
    const w = Math.max(...needs.map((r) => r.name.length));
    for (const r of needs) console.log(`  ${r.name.padEnd(w)}  ${stillNeeded(r.s)}`);
  }
  const weak = {};
  for (const e of events.filter((x) => x.type === "gaveup")) for (const t of e.topics ?? []) weak[t] = (weak[t] ?? 0) + 1;
  const top = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`\n${paint.bold("Weak topics")}  ${top.length ? top.map(([t, n]) => `${t} (${n})`).join(", ") : paint.dim("none yet")}`);
  console.log(`\n${paint.dim(PACE_FOOTNOTE)}`);
  const overall = paceFor(events, null, config.pace);
  if (!overall.calibrated) console.log(paint.dim(`Pace calibrates after ${PACE_DEFAULTS.minSolves} clean timed solves (${overall.solves} so far); until then time alone never triggers a review.`));
  const cost = costSummary(events, today());
  if (cost) console.log(paint.dim(cost));
}

/** "300 pts · areas: a, b, c (+1) · clean streak 1/3", or the promotion state. */
export function stillNeeded(s, maxAreas = 3) {
  const g = s.gates;
  const parts = [s.needed > 0 ? `${s.needed} pts` : "points done"];
  if (g?.promotionPending) parts.push(gateSummary(s));
  else if (g) {
    if (g.areasMissing.length) {
      const more = g.areasMissing.length - maxAreas;
      parts.push(`areas: ${g.areasMissing.slice(0, maxAreas).join(", ")}${more > 0 ? ` (+${more})` : ""}`);
    }
    if (g.streak < g.streakNeeded) parts.push(`clean streak ${g.streak}/${g.streakNeeded}`);
  }
  return parts.join(" · ");
}

/** `ginga rank --json`: the same facts as the text view, for scripts and dashboards. */
function rankData(ws, config, events, langs, st) {
  const weak = {};
  for (const e of events.filter((x) => x.type === "gaveup")) for (const t of e.topics ?? []) weak[t] = (weak[t] ?? 0) + 1;
  const paid = events.filter((e) => e.type === "generated" && Number.isFinite(e.costUsd));
  const sum = (list) => Math.round(list.reduce((a, e) => a + e.costUsd, 0) * 100) / 100;
  return {
    streak: { days: st.days, freezes: st.freezes, frozeOn: st.frozeOn },
    languages: langs.map((lang) => {
      const s = langLevel(ws, config, events, lang);
      const solved = events.filter((e) => e.type === "solved" && e.lang === lang);
      const mins = solved.map((e) => e.minutes).filter(Number.isFinite);
      return {
        lang, level: s.level, points: s.points, nextAt: s.nextAt, gates: s.gates ?? null,
        solved: solved.length, gaveUp: events.filter((e) => e.type === "gaveup" && e.lang === lang).length,
        avgMinutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null,
        pace: paceFor(events, lang, config.pace),
      };
    }),
    weakTopics: Object.fromEntries(Object.entries(weak).sort((a, b) => b[1] - a[1])),
    reviews: reviewCycles(withoutDiscarded(events), config.reviewAfterDays, today(), reviewOpts(config))
      .map((c) => ({ of: c.root, steps: c.steps, done: c.done, due: c.due, nextAtDay: c.next })),
    openReview: openReview(withoutDiscarded(events))?.id ?? null,
    claudeCostUsd: paid.length ? { total: sum(paid), last30Days: sum(paid.filter((e) => daysBetween(eventDate(e), today()) < 30)), generations: paid.length } : null,
  };
}

/**
 * "Claude: $4.12 over 9 generations ($1.37 in the last 30 days)", from the cost recorded on each
 * generated event (discarded ones included: they were paid for). null when nothing was recorded.
 */
export function costSummary(events, date) {
  const paid = events.filter((e) => e.type === "generated" && Number.isFinite(e.costUsd));
  if (!paid.length) return null;
  const sum = (list) => list.reduce((a, e) => a + e.costUsd, 0);
  const recent = paid.filter((e) => daysBetween(eventDate(e), date) < 30);
  return `💸 Claude: $${sum(paid).toFixed(2)} over ${paid.length} generation${paid.length === 1 ? "" : "s"} ` +
    `($${sum(recent).toFixed(2)} in the last 30 days; API list price, on a Pro/Max plan it's usage, not a bill)`;
}

export async function cmdList(_positionals, opts) {
  const { ws } = ctx(opts);
  const events = readEvents(ws);
  const all = byCreation(listChallenges(ws), events);
  const generated = new Map(events.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const origin = (m) => {
    const g = generated.get(m.id);
    const reviewOf = g?.reviewOf ?? m.reviewOf ?? null;
    return { source: g?.source ?? m.source ?? null, reviewOf, root: reviewOf ? rootOf(generated, m.id) : null };
  };
  if (opts.json) {
    return console.log(JSON.stringify(all.map(({ manifest: m, dir }) => {
      const s = challengeStatus(events, m.id);
      const o = origin(m);
      return {
        id: m.id, title: m.title, date: m.date, lang: m.lang, level: m.level, type: m.type, status: s.status, hints: s.hints,
        timer: timerState(events, m.id).state,
        source: o.source, reviewOf: o.reviewOf, dir,
      };
    }), null, 2));
  }
  if (!all.length) return console.log("No challenges yet.");
  const names = new Map();
  const langName = (lang) => {
    if (!names.has(lang)) names.set(lang, findProfile(ws, lang)?.name ?? lang);
    return names.get(lang);
  };
  const counts = {};
  const rows = all.map(({ manifest: m }) => {
    const o = origin(m);
    const status = challengeStatus(events, m.id).status;
    counts[status] = (counts[status] ?? 0) + 1;
    const paused = status === "open" && timerState(events, m.id).state === "paused";
    return [paint.dim(m.date ?? generated.get(m.id)?.date ?? ""), langName(m.lang), paint.cyan(`L${m.level}`), m.type ?? "implement",
      o.reviewOf ? `🔁 ${generated.get(o.root)?.title ?? o.root}` : o.source ?? "–", statusText(status, paused ? "open ⏸" : status), m.id];
  });
  // The review topics share what the terminal has left (the id is what you copy, so it's never cut).
  const others = [0, 1, 2, 3, 5, 6].reduce((sum, i) => sum + Math.max(...rows.map((r) => displayWidth(r[i]))) + 2, 0);
  const fromWidth = Math.max(16, termWidth() - others);
  for (const r of rows) r[4] = r[4].startsWith("🔁") ? paint.cyan(truncate(r[4], fromWidth)) : paint.dim(r[4]);
  console.log(table(["Created", "Language", "Lvl", "Type", "From", "Status", "Id"], rows));
  const summary = ["solved", "open", "gaveup", "discarded"].filter((s) => counts[s]).map((s) => statusText(s, `${counts[s]} ${s === "gaveup" ? "given up" : s}`));
  const legend = rows.some((r) => r[4].includes("🔁")) ? paint.dim(" · 🔁 review of that topic") : "";
  console.log(`\n${paint.dim(`${plural(all.length, "challenge")} ·`)} ${summary.join(paint.dim(" · "))}${legend}`);
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
    console.log(`${paint.bold(t.profile.id)}${t.profile.stack === "ecosystem" ? " (ecosystem)" : ""}  ${paint.dim(tilde(t.dir))}`);
    const r = await validateOne(config, t.profile, t.dir);
    if (r.ok) console.log(`  ${mark.ok()} ${paint.green("valid")}`);
    else {
      failed++;
      console.log(r.problems.map((p) => `  ${mark.fail()} ${p}`).join("\n"));
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
  if (positionals[0] !== "run") throw new UserError("Usage: ginga sandbox run --lang <id>|--profile-file <f> [--dir D] [--cwd C] [--target T] [--impl I --tests S] -- <command>");
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
      env: Object.fromEntries([["TARGET", opts.target], ["IMPL", opts.impl], ["TESTS", opts.tests]].filter(([, v]) => v)),
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
  const events = withoutDiscarded(readEvents(ws));
  const langs = positionals.length ? positionals.map((l) => requireProfile(ws, l).id) : rotationIds(ws, config);
  if (opts.json) {
    const out = langs.map((lang) => {
      const profile = findProfile(ws, lang);
      if (!profile) return { lang, profile: false };
      const { level } = langLevel(ws, config, events, lang);
      const counts = coverageCounts(events, lang);
      const shown = hasEcosystem(profile) ? allAreas(profileForStack(profile, "ecosystem")) : allAreas(profile);
      return {
        lang, level,
        areas: shown.map((a) => ({
          id: a.id, name: a.name, minLevel: a.minLevel ?? 1, specific: a.specific, stack: a.stack ?? "basics",
          unlocked: (a.minLevel ?? 1) <= level, challenges: counts.get(a.id) ?? 0,
        })),
      };
    });
    return console.log(JSON.stringify(out, null, 2));
  }
  for (const lang of langs) {
    const profile = findProfile(ws, lang);
    if (!profile) {
      console.log(`${paint.bold(lang)}  ${paint.dim("no profile yet")}\n`);
      continue;
    }
    printCoverage(profile, langLevel(ws, config, events, lang).level, coverageCounts(events, lang), opts.all);
  }
  const count = (key, fallback) => {
    const out = {};
    for (const e of events) if (e.type === "generated" && langs.includes(e.lang)) out[e[key] ?? fallback] = (out[e[key] ?? fallback] ?? 0) + 1;
    return Object.entries(out).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(paint.dim(" · "));
  };
  const domains = count("domain", GENERAL);
  if (domains) console.log(`${paint.bold("Domains so far")}  ${domains}`);
  const types = count("challengeType", "implement");
  if (types) console.log(`${paint.bold("Types so far")}    ${types}\n`);
  console.log(paint.dim("★ specific to the language · ⚙ ecosystem stack (libraries). Generation targets the least-covered unlocked area;"));
  console.log(paint.dim(`pick one yourself with \`ginga new <lang> --area <id>\`.${opts.all ? "" : " Every area, locked ones too: --all."}`));
}

/** One language's coverage: unlocked areas with their counts; locked ones summed up (all of them with --all). */
function printCoverage(profile, level, counts, all) {
  const open = unlockedAreas(profile, level);
  const covered = open.filter((a) => counts.get(a.id)).length;
  console.log(`${paint.bold(profile.name)}  ${paint.cyan(`L${level}`)}  ${bar(covered, open.length, 12, paint.green)}  ${covered}/${open.length} unlocked areas covered`);
  // Ecosystem areas are listed too (tagged ⚙), so the whole map is visible in one place.
  const shown = (hasEcosystem(profile) ? allAreas(profileForStack(profile, "ecosystem")) : allAreas(profile))
    .sort((x, y) => (x.minLevel ?? 1) - (y.minLevel ?? 1));
  const width = Math.max(...shown.map((a) => a.id.length));
  const symbol = (a) => (a.stack === "ecosystem" ? "⚙" : a.specific ? "★" : " ");
  const tag = (a) => (a.stack === "ecosystem" ? paint.blue : paint.yellow)(symbol(a));
  const locked = [];
  for (const a of shown) {
    const n = counts.get(a.id) ?? 0;
    if ((a.minLevel ?? 1) > level) locked.push(a);
    else console.log(`  ${tag(a)} ${a.id.padEnd(width)}  ${n ? `${paint.green("■".repeat(Math.min(n, 12)))} ${n}` : paint.dim("□ not yet")}`);
  }
  if (all) {
    for (const a of locked) console.log(paint.dim(`  ${symbol(a)} ${a.id.padEnd(width)}  ·  unlocks at L${a.minLevel}`));
  } else if (locked.length) {
    const next = locked.filter((a) => a.minLevel === locked[0].minLevel);
    const label = `  Unlocks at L${locked[0].minLevel} (${next.length}): `;
    console.log(paint.dim(label) + truncate(next.map((a) => a.id).join(", "), Math.max(20, termWidth() - label.length)));
    const rest = locked.length - next.length;
    if (rest) console.log(paint.dim(`  Later levels: ${plural(rest, "more area")} (ginga coverage --all)`));
  }
  console.log("");
}

export async function cmdConfig(positionals, opts) {
  const { ws, config } = ctx(opts);
  const [sub = "show", key, ...rest] = positionals;
  if (sub === "show") return showConfig(config, opts);
  if (!["get", "set", "unset"].includes(sub)) throw new UserError("Usage: ginga config [show] | get <key> | set <key> <value> | unset <key>");
  if (!key) throw new UserError(`Usage: ginga config ${sub} <key>${sub === "set" ? " <value>" : ""}. Keys: ${Object.keys(CONFIG_KEYS).join(", ")}.`);
  if (sub === "get") {
    const v = getConfigValue(config, key);
    if (v === undefined) throw new UserError(`No key "${key}".`);
    console.log(typeof v === "string" ? v : JSON.stringify(v));
    return;
  }
  if (sub === "set" && !rest.length) throw new UserError(`Usage: ginga config set ${key} <value>`);
  if (sub === "unset" && !CONFIG_KEYS[key]) parseConfigValue(key, ""); // throws the right "unknown key" error
  const value = sub === "set" ? parseConfigValue(key, rest.join(" ")) : undefined;
  const next = withConfigValue(config, key, value);
  saveConfig(ws, next);
  const shown = getConfigValue(next, key);
  console.log(`${key} = ${typeof shown === "string" ? shown : JSON.stringify(shown)}${sub === "unset" ? " (default)" : ""}`);
  if (key === "sandbox.engine" && value === "none" && !next.sandbox.allowUnsandboxed) {
    console.log("Note: engine none also needs `ginga config set sandbox.allowUnsandboxed true` (code then runs on your machine).");
  }
}

/**
 * `ginga config show`: the settings that differ from the defaults, one per line; --all every
 * setting (defaults dimmed); --json the effective config as JSON.
 */
function showConfig(config, opts) {
  if (opts.json) return console.log(JSON.stringify(config, null, 2));
  const rows = configLeaves(config).filter(([key]) => key !== "version")
    .map(([key, value]) => ({ key, value, isDefault: isDeepStrictEqual(value, getConfigValue(DEFAULT_CONFIG, key)) }));
  const shown = opts.all ? rows : rows.filter((r) => !r.isDefault);
  const width = Math.max(...shown.map((r) => r.key.length), 0);
  const fmt = (v) => (Array.isArray(v) ? (v.length ? v.join(", ") : "[]") : v === null ? "null" : typeof v === "object" ? "{}" : String(v));
  console.log(heading(opts.all ? "All settings" : `Your settings (${CONFIG_FILE})`));
  if (!shown.length) console.log(paint.dim("  everything is at its default"));
  for (const r of shown) {
    const line = `  ${r.key.padEnd(width)}  ${fmt(r.value)}`;
    console.log(r.isDefault ? paint.dim(`${line}  (default)`) : line);
  }
  console.log(paint.dim(`\n${opts.all ? "" : "Everything else is at its default (--all shows it). "}Change one: ginga config set <key> <value> · --json for scripts`));
}

/** [dotted key, value] for each setting; arrays and empty objects are values, other objects are walked. */
function configLeaves(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length
    ? configLeaves(v, `${prefix}${k}.`)
    : [[`${prefix}${k}`, v]]));
}

export async function cmdCompletion(positionals) {
  const shell = positionals[0] ?? "bash";
  if (!["bash", "zsh"].includes(shell)) throw new UserError("Usage: ginga completion bash|zsh");
  process.stdout.write(completionScript(shell, allProfiles(null).map((p) => p.id)));
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
  const rows = rotationIds(ws, config).map((id) => {
    const p = findProfile(ws, id);
    const mode = p ? stackMode(config, p.id) : "basics";
    const libs = p && hasEcosystem(p) ? p.stacks.ecosystem.libraries.join(", ") : paint.dim("– (basics only)");
    return [p?.name ?? id, mode === "basics" ? mode : paint.cyan(mode), libs];
  });
  console.log(table(["Language", "Stack", "Ecosystem libraries"], rows));
  console.log(paint.dim("\nbasics = standard library only (default) · mixed = some ecosystem challenges · ecosystem = always libraries"));
  console.log(paint.dim("Change: ginga stack <lang> basics|mixed|ecosystem"));
}

export async function cmdDomains(positionals, opts) {
  const [sub = "show", ...rest] = positionals;
  if (sub === "show" || sub === "list") {
    let current = null;
    try {
      current = configuredDomains(ctx(opts).config);
    } catch {}
    // Without a workspace there is nothing selected to show: the catalog instead.
    if (sub === "show" && current) return showDomains(current);
    return listDomains(current ?? [GENERAL]);
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
  showDomains(config.domains);
}

const domainRow = (d, w, selected) => {
  const dot = selected ? paint.green("●") : " ";
  const id = selected ? paint.bold(d.id.padEnd(w.id)) : d.id.padEnd(w.id);
  return `  ${dot} ${id}  ${d.name.padEnd(w.name)}  ${paint.dim(truncate(d.focus, Math.max(20, termWidth() - w.id - w.name - 10)))}`;
};
const domainWidths = (list) => ({ id: Math.max(...list.map((d) => d.id.length)), name: Math.max(...list.map((d) => d.name.length)) });

/** `ginga domains`: the selected domains. */
function showDomains(current) {
  const selected = allDomains().filter((d) => current.includes(d.id));
  console.log(heading(`Your domains (${selected.length})`));
  const w = domainWidths(selected);
  for (const d of selected) console.log(domainRow(d, w, true));
  if (selected.some((d) => d.id !== GENERAL)) console.log(paint.dim("\nChallenges rotate through these without repeats; general still appears ~1 in 4."));
  console.log(paint.dim(`\nAll ${allDomains().length}: ginga domains list · change: ginga domains set|add|remove <id…>`));
}

/** `ginga domains list`: the whole catalog by group, the selected ones marked. */
function listDomains(current) {
  const all = allDomains();
  const w = domainWidths(all);
  let group = "";
  for (const d of all) {
    if (d.group !== group) console.log(`\n${heading((group = d.group))}`);
    console.log(domainRow(d, w, current.includes(d.id)));
  }
  console.log(paint.dim(`\n${paint.green("●")} selected · change: ginga domains set|add|remove <id…>`));
}

export async function cmdRotation(positionals, opts) {
  const { ws, config } = ctx(opts);
  const [sub = "list", ...rest] = positionals;
  const parse = (args) =>
    args.join(",").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      .map((l) => findProfile(ws, l)?.id ?? l);
  let rotation = rotationIds(ws, config);
  const daily = { ...DEFAULT_CONFIG.daily, ...config.daily };
  let anchors = rotation.filter((l) => daily.anchors.includes(l));
  if (sub === "set") rotation = [...new Set(parse(rest))];
  else if (sub === "add") rotation = [...new Set([...rotation, ...parse(rest)])];
  else if (sub === "remove") {
    const drop = new Set(parse(rest));
    rotation = rotation.filter((l) => !drop.has(l));
  } else if (sub === "mode") {
    if (!ROTATION_MODES.includes(rest[0])) throw new UserError(`Usage: ginga rotation mode ${ROTATION_MODES.join("|")}`);
    config.rotationMode = rest[0];
  } else if (sub === "anchor") {
    [anchors, rotation] = anchorChange(anchors, rotation, rest[0], parse(rest.slice(1)));
  } else if (sub === "extra") {
    const [chance, max = String(daily.extraMax)] = rest;
    if (!/^(0(\.\d+)?|1(\.0+)?)$/.test(chance ?? "") || !/^[1-9]\d*$/.test(max)) {
      throw new UserError("Usage: ginga rotation extra <chance 0..1> [max ≥ 1], e.g. `ginga rotation extra 0.3` (0 turns extras off)");
    }
    Object.assign(daily, { extraChance: Number(chance), extraMax: Number(max) });
  } else if (sub !== "list") {
    throw new UserError("Usage: ginga rotation [list] | set <a,b,c> | add <lang…> | remove <lang…> | mode random|ordered | anchor add|remove|set <lang…>|none | extra <chance> [max]");
  }
  if (!rotation.length) throw new UserError("The rotation needs at least one language.");
  if (sub !== "list") {
    config.rotation = rotation;
    config.daily = { ...daily, anchors: anchors.filter((l) => rotation.includes(l)) };
    saveConfig(ws, config);
  }
  showRotation(ws, config, rotation);
  const missing = rotation.filter((l) => !findProfile(ws, l));
  if (missing.length) console.log(`No profile yet for: ${missing.join(", ")} (bootstrapped with Claude on first use).`);
  if (["set", "add", "anchor"].includes(sub)) console.log("Run `ginga doctor --pull` to fetch any new language images.");
}

/** `ginga rotation anchor add|remove|set <langs>|none`: the new anchors, and the rotation (anchors join it). */
function anchorChange(anchors, rotation, action, langs) {
  if (action === "none") return [[], rotation];
  if (!["add", "remove", "set"].includes(action) || !langs.length) {
    throw new UserError("Usage: ginga rotation anchor add|remove|set <lang…> | ginga rotation anchor none");
  }
  const next = action === "remove" ? anchors.filter((l) => !langs.includes(l))
    : [...new Set([...(action === "add" ? anchors : []), ...langs])];
  return [next, [...new Set([...rotation, ...next])]];
}

function showRotation(ws, config, rotation) {
  const { anchors, pool, extraChance, extraMax } = dailySettings(config, rotation);
  const events = withoutDiscarded(readEvents(ws));
  const ordered = config.rotationMode === "ordered";
  const bag = bagState(events, pool);
  const next = pool.length && ordered ? nextOrdered(events, pool) : null;
  const rolled = extrasRolled(today(), extraChance, extraMax);
  const extras = !pool.length || extraChance <= 0 ? "no extras"
    : `extras: ${Math.round(extraChance * 100)}% a day${extraMax > 1 ? `, up to ${extraMax}` : ""} (today: ${rolled ? `${rolled} rolled` : "none"})`;
  console.log(`${heading("Daily")}  ${paint.dim(`${config.rotationMode} order · ${extras}`)}\n`);
  const lastDaily = (lang) => events.filter((e) => e.type === "generated" && e.source === "daily" && e.lang === lang).map(eventDate).sort().at(-1);
  const cycle = (lang) => {
    if (anchors.includes(lang)) return paint.dim("every day");
    if (ordered) return lang === next ? paint.green("next") : "";
    return bag.drawn.includes(lang) ? paint.dim("drawn") : paint.green("in bag");
  };
  // Anchors first, then the bag in rotation order.
  const rows = [...anchors, ...pool].map((lang) => {
    const p = findProfile(ws, lang);
    return [p?.name ?? lang, anchors.includes(lang) ? paint.magenta("anchor") : "bag", cycle(lang),
      p ? paint.cyan(`L${langLevel(ws, config, events, lang).level}`) : paint.dim("–"), paint.dim(lastDaily(lang) ?? "–")];
  });
  console.log(table(["Language", "Role", ordered ? "Order" : "This cycle", "Level", "Last daily"], rows));
  const name = (l) => findProfile(ws, l)?.name ?? l;
  if (!pool.length) console.log("\nEvery rotation language is an anchor, so there are no extras.");
  else if (ordered) console.log(`\nNext draw: ${paint.bold(name(next))}.`);
  else {
    const left = bag.remaining.map(name);
    console.log(`\nNext draw: ${left.length === 1 ? paint.bold(left[0]) : `random from ${left.map((l) => paint.bold(l)).join(", ")}`}`
      + paint.dim(` (${plural(left.length, "language")} left in the bag; then it refills).`));
  }
  console.log(paint.dim("Change: ginga rotation anchor add|remove <lang> · ginga rotation extra <chance> [max] · ginga rotation mode random|ordered"));
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
  startOrResumeTimer(ws, c.manifest);
  console.log(`Opening ${c.manifest.id} in ${editor} …`);
  // Through a shell so editor settings with arguments ("code -w", "nvim -p") work.
  const r = spawnSync(`${editor} ${["README.md", ...starter].map(quote).join(" ")}`, {
    cwd: c.dir, stdio: "inherit", shell: true,
  });
  if (r.status !== 0) process.exitCode = r.status ?? 1;
  console.log(`\nNext: ginga test${positionals[0] ? ` ${positionals[0]}` : ""}`);
}

// ---------------------------------------------------------------- timer

const minutesSince = (ms, now = Date.now()) => Math.max(0, Math.round((now - ms) / 60_000));

/**
 * On `ginga open`: the first open starts the timer that `ginga done` suggests as "minutes spent";
 * opening a paused challenge resumes it. Finished challenges have no timer to touch.
 */
function startOrResumeTimer(ws, m) {
  const events = readEvents(ws);
  if (challengeStatus(events, m.id).status !== "open") return;
  const t = timerState(events, m.id);
  const event = (type) => appendEvent(ws, { type, id: m.id, lang: m.lang, level: m.level });
  if (!events.some((e) => e.type === "opened" && e.id === m.id)) {
    event("opened");
    if (t.state === "paused") event("resumed");
    console.log(`⏱️  Timer started ${paint.dim("(`ginga pause` for breaks; `ginga done` suggests the active time)")}`);
  } else if (t.state === "paused") {
    event("resumed");
    console.log(`${paint.green("▶")}  Timer resumed after ${humanMinutes(minutesSince(t.since))} paused.`);
  }
}

/** "▶ running · 34 min active (1 pause, 15 min)" */
function timerLine(events, id) {
  const t = timerState(events, id);
  const active = humanMinutes(Math.round(t.activeMs / 60_000));
  const pauses = t.pauses ? ` (${t.pauses} pause${t.pauses === 1 ? "" : "s"}, ${humanMinutes(Math.round(t.pausedMs / 60_000))})` : "";
  if (t.state === "none") return `${paint.dim("○  not started")} ${paint.dim("(`ginga open` starts it)")}`;
  if (t.state === "running") return `${paint.green("▶  running")} · ${active} active${paint.dim(pauses)}`;
  if (t.state === "paused") return `${paint.yellow(`⏸  paused for ${humanMinutes(minutesSince(t.since))}`)} · ${active} active${paint.dim(pauses)}`;
  return `${paint.dim("⏹  stopped")} · ${active} active${paint.dim(pauses)}`;
}

function openForTimer(ws, positionals) {
  const c = pickChallenge(ws, positionals[0]);
  const events = readEvents(ws);
  const { status } = challengeStatus(events, c.manifest.id);
  if (status !== "open") throw new UserError(`"${c.manifest.title}" is ${status === "gaveup" ? "given up" : status}; its timer has stopped.`);
  return { c, events, t: timerState(events, c.manifest.id) };
}

export async function cmdPause(positionals, opts) {
  const { ws } = ctx(opts);
  const { c, events, t } = openForTimer(ws, positionals);
  const m = c.manifest;
  if (t.state === "paused") return console.log(`Already paused: ${timerLine(events, m.id)}  ${paint.dim(`· ${m.title}`)}`);
  appendEvent(ws, { type: "paused", id: m.id, lang: m.lang, level: m.level });
  if (t.state === "none") return console.log(`${paint.yellow("⏸")}  "${m.title}": the timer starts paused; \`ginga resume\` (or \`ginga open\`) starts it.`);
  console.log(`${paint.yellow("⏸")}  Paused "${m.title}" at ${humanMinutes(Math.round(t.activeMs / 60_000))} active. ${paint.dim("`ginga resume` when you're back.")}`);
}

export async function cmdResume(positionals, opts) {
  const { ws } = ctx(opts);
  const { c, events, t } = openForTimer(ws, positionals);
  const m = c.manifest;
  if (t.state === "running") return console.log(`Already running: ${timerLine(events, m.id)}  ${paint.dim(`· ${m.title}`)}`);
  if (t.state === "none") throw new UserError(`The timer of "${m.title}" hasn't started; \`ginga open\` starts it.`);
  appendEvent(ws, { type: "resumed", id: m.id, lang: m.lang, level: m.level });
  console.log(`${paint.green("▶")}  Resumed "${m.title}" after ${humanMinutes(minutesSince(t.since))} paused.`);
}

export async function cmdTimer(positionals, opts) {
  const { ws } = ctx(opts);
  const c = pickChallenge(ws, positionals[0]);
  console.log(`${timerLine(readEvents(ws), c.manifest.id)} ${paint.dim("·")} ${paint.bold(c.manifest.title)} ${paint.dim(c.manifest.id)}`);
}

export async function cmdLang(positionals, opts) {
  const sub = positionals[0] ?? "list";
  let ws = null;
  try {
    ws = findWorkspace(opts.workspace);
  } catch {}
  if (sub === "list") {
    let rotation = [];
    try {
      rotation = rotationIds(ws, loadConfig(ws));
    } catch {}
    const rows = allProfiles(ws).map((p) => [
      rotation.includes(p.id) ? paint.green("●") : " ", paint.bold(p.id), p.name, paint.dim(imageRef(p)),
      p.source === "builtin" ? paint.dim(p.source) : paint.cyan(p.source), paint.dim(p.aliases?.join(", ") || "–"),
    ]);
    console.log(table(["", "Id", "Name", "Image", "Source", "Aliases"], rows));
    console.log(paint.dim(`\n${rotation.length ? `${paint.green("●")} in your rotation · ` : ""}libraries: ginga stack · another language: ginga lang add <name>`));
    return;
  }
  if (sub === "add") {
    const name = positionals[1];
    if (!name) throw new UserError("Usage: ginga lang add <language>");
    const { config } = ctx(opts);
    if (findProfile(ws, name) && !opts.force) throw new UserError(`"${name}" already has a profile (use --force to bootstrap anyway).`);
    const { profile } = await bootstrapProfile({ ws, config, name });
    console.log(`${mark.ok()} Added profile ${paint.bold(profile.id)} ${paint.dim(`(${imageRef(profile)}) to ${tilde(join(ws, "profiles"))}`)}`);
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

/**
 * `doctor --prune`: remove gingaloop-built images no current profile uses (older versions left by
 * upgrades); with --all, every gingaloop image (they're rebuilt on the next run that needs them).
 * Official images such as python:3.12-slim are never touched: other projects may use them.
 */
async function pruneImages(ws, config, opts) {
  const inUse = new Set();
  for (const p of allProfiles(ws)) {
    for (const stack of hasEcosystem(p) ? ["basics", "ecosystem"] : ["basics"]) {
      const sp = profileForStack(p, stack);
      if (sp.image?.tag) inUse.add(sp.image.tag);
    }
  }
  const images = builtImages(config.sandbox).filter((i) => opts.all || !inUse.has(i.ref));
  if (!images.length) return console.log(opts.all ? "No gingaloop images to remove." : "No stale gingaloop images (add --all to remove the current ones too).");
  for (const i of images) console.log(`  ${i.ref}  ${i.size}`);
  if (!(await confirm(`Remove ${images.length} image${images.length === 1 ? "" : "s"}?${opts.all ? " They're rebuilt when next needed." : ""}`, opts.yes))) return;
  const failed = removeImages(config.sandbox, images.map((i) => i.ref));
  console.log(`Removed ${images.length - failed.length}.${failed.length ? `\nNot removed:\n  ${failed.join("\n  ")}` : ""}`);
}

export async function cmdDoctor(_positionals, opts) {
  const { ws, config } = ctxOrDefaults(opts);
  if (opts.prune) return pruneImages(ws, config, opts);
  const line = (ok, label, detail = "") =>
    console.log(`${ok ? mark.ok() : mark.fail()} ${paint.bold(label)}${detail ? (ok ? paint.dim(`  ${detail}`) : `  ${paint.red(detail)}`) : ""}`);
  const [major, minor] = process.versions.node.split(".").map(Number);
  line(major > 22 || (major === 22 && minor >= 18), "node", process.versions.node);
  line(hasBin(config.claude.command), "claude", hasBin(config.claude.command) ? "found" : "not found (install Claude Code)");
  line(hasBin("notify-send"), "notify-send", hasBin("notify-send") ? "found" : "missing; notifications go to stdout only");
  const engine = engineAvailable(config.sandbox);
  line(engine.ok, "sandbox", engine.detail);
  if (!ws) return console.log(paint.dim("(no workspace yet)"));
  line(true, "workspace", tilde(ws));
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

/** What a review should look at for each challenge type ("" for implement: the generic prompt fits). */
export function reviewTypeNote(type, hasOriginal) {
  const original = hasOriginal
    ? `${ORIGINAL_DIR}/ is the code the user was handed; compare it with starter/ (diff them). `
    : "The code the user was handed was not kept for this challenge; bugs/ (the planted variants, see bugs/bugs.json) shows what was wrong with it. ";
  return {
    "fix-the-bug": "This is a fix-the-bug challenge: the user was handed buggy code and had to fix it, not write it. " + original +
      "Review the FIX, not the code as if they wrote it: for each bug that was in the handed code, say whether it was fixed and whether " +
      "the fix addresses the cause or only a symptom; whether the change is focused or a rewrite; any bug left in or introduced. " +
      "Style and idioms only for lines the user changed, briefly, at the end. ",
    refactor: "This is a refactor challenge: the user was handed working-but-poor code and a new requirement. " + original +
      "Review the refactor: is the structure clearly better than the handed code, is behavior preserved, does it meet the new requirement for the right reason? ",
    extend: "This is an extend challenge: the user was handed a small working module and added a feature. " + original +
      "Review the extension: does it fit the existing design and naming, did anything that worked before break, is the change in the right place? ",
    "debug-from-symptom": "This is a debug-from-symptom challenge: " + original +
      "Check that the user found and fixed the root cause, not just the symptom, and that nothing else changed by accident. ",
    optimize: "This is an optimize challenge: " + original +
      "Check the complexity of the user's version against the handed one, and any behavior change between them. ",
    "write-the-tests": "This is a write-the-tests challenge: starter/ holds the USER'S TESTS for subject/, and solution/ the reference tests. Review the test suite: missing input classes, weak assertions, unclear names, redundant tests. ",
    trace: "This is a trace challenge: starter/answer.txt is the user's predicted output of program/. Explain each wrong line's misconception. ",
    port: "This is a port challenge from source/ (another language): check idiomatic use of the target language and every semantic difference that could bite. ",
  }[type] ?? "";
}

/**
 * The test runs a reviewer is handed, with every variable the command needs set the way the
 * grader sets them (gingaloop#8: write-the-tests also needs IMPL and TESTS, not just TARGET).
 */
export function reviewRunLines(prefix, type, testCmd) {
  const run = (flags) => `  ${prefix} --cwd tests ${flags} -- '${testCmd}'\n`;
  if (typeInfo(type).grader === "mutation") {
    return run("--target subject --impl subject --tests starter") +
      "That runs the user's tests (starter/) on the correct code (subject/). --tests solution runs the reference tests; " +
      "--target bugs/<name> --impl bugs/<name> runs a suite on a hidden buggy version instead (see bugs/ and challenge.json). ";
  }
  return run("--target starter") + "Use --target solution for the reference. ";
}

export async function cmdReview(positionals, opts) {
  const { ws, config } = ctx(opts);
  const c = pickChallenge(ws, positionals[0], { unlocked: true });
  if (isLocked(c.dir)) throw new UserError("Review needs the reference solution: solve it (`ginga done`) or `ginga giveup` first.");
  const profile = challengeProfile(ws, c.manifest);
  // Work on a staging copy so Claude can run code through the jailed sandbox command.
  const staging = join(ws, ".staging", `review-${c.manifest.id}-${Date.now().toString(36)}`);
  cpSync(c.dir, staging, { recursive: true });
  const prefix = sandboxPrefix({ lang: profile.id, stack: profile.stack });
  const testCmd = c.manifest.test?.command ?? profile.testCommand;
  const typeNote = reviewTypeNote(c.manifest.type, existsSync(join(c.dir, ORIGINAL_DIR)));
  const prompt =
    typeNote +
    "You are reviewing a practice solution. starter/ is the user's solution, solution/ the reference, " +
    "README.md the problem, tests/ the suite. Write a short, direct code review in Markdown. The challenge-type " +
    "note above, when there is one, sets the focus; otherwise cover correctness risks the tests miss, complexity, " +
    "idiomatic improvements for this language, and one thing done well. " +
    "No praise padding. Do not modify any file.\n\n" +
    "VERIFY your claims by running code; do not guess. You can only run code in a sandbox with this exact " +
    "prefix (type it exactly, from this directory, each option once):\n" +
    reviewRunLines(prefix, c.manifest.type, testCmd) +
    "For edge-case probes, write a small script in a new folder " +
    "(e.g. probes/) that loads ../starter and ../solution and prints both results, then run it with " +
    `\`${prefix} --cwd probes -- '<command>'\`. Report the actual outputs you observed. ` +
    "When the tests miss a real bug, end with a section '## Missing tests' listing the test cases to add.";
  console.log(paint.dim("Asking Claude for a review (it can run the tests in the sandbox) …"));
  let out;
  try {
    out = await new Promise((resolvePromise, reject) => {
      const child = spawn(config.claude.command, [
        "-p", prompt, "--permission-mode", "acceptEdits",
        "--allowedTools", "Read", "Glob", "Grep", "Write", `Bash(${prefix}:*)`,
        "--disallowedTools", "WebFetch", "WebSearch", "--output-format", "json",
        ...(config.claude.model ? ["--model", config.claude.model] : []),
        ...(config.claude.maxBudgetUsd != null ? ["--max-budget-usd", String(config.claude.maxBudgetUsd)] : []),
      ], { cwd: staging, stdio: ["ignore", "pipe", "inherit"] });
      let text = "";
      child.stdout.on("data", (d) => (text += d));
      child.on("error", (e) => reject(new UserError(`Could not run "${config.claude.command}": ${e.message}`)));
      child.on("close", (code) => (code === 0 ? resolvePromise(text.trim()) : reject(new UserError(`Claude exited with code ${code}.`))));
    });
  } finally {
    removeDir(staging);
  }
  const cost = parseClaudeCost(out);
  try {
    out = JSON.parse(out.split("\n").at(-1)).result?.trim() ?? out;
  } catch {}
  appendFileSync(join(c.dir, "NOTES.md"), `\n## Review (${today()})\n\n${out}\n`);
  console.log(out);
  console.log(paint.dim(`\n📝 Appended to ${tilde(join(c.dir, "NOTES.md"))}${cost != null ? ` · Claude cost $${cost.toFixed(2)}, API list price` : ""}`));
  console.log(paint.dim(`If it found a problem with the challenge itself, \`ginga learn ${c.manifest.id}\` keeps future challenges from repeating it.`));
}

function reviewOf(c) {
  const notes = join(c.dir, "NOTES.md");
  return existsSync(notes) ? latestReview(readFileSync(notes, "utf8")) : null;
}

/** Turn a review's findings about the challenge itself into rules for the generator. */
export async function cmdLearn(positionals, opts) {
  const { ws, config } = ctx(opts);
  let c;
  if (positionals[0]) {
    c = pickChallenge(ws, positionals[0]);
  } else {
    // Default: the newest reviewed challenge nothing was learned from yet.
    const reviewed = byCreation(listChallenges(ws), readEvents(ws)).filter((x) => reviewOf(x));
    c = reviewed.filter((x) => !learnedFrom(ws, x.manifest.id)).at(-1) ?? reviewed.at(-1);
    if (!c) throw new UserError("No reviewed challenge yet: run `ginga review [id]` on a solved or given-up one first.");
  }
  const m = c.manifest;
  const review = reviewOf(c);
  if (!review) throw new UserError(`"${m.title}" has no review yet: run \`ginga review ${m.id}\` first.`);
  if (learnedFrom(ws, m.id) && !(await confirm(`Lessons from "${m.title}" were already saved. Learn from its review again?`, opts.yes))) return;

  const known = readLessons(ws);
  const improvements = existsSync(join(ws, IMPROVEMENTS_FILE))
    ? readFileSync(join(ws, IMPROVEMENTS_FILE), "utf8").split("\n").filter((l) => l.startsWith("- ")).map((l) => `- (tool) ${l.slice(2)}`)
    : [];
  const existing = [
    ...(known.all ?? []).map((l) => `- (all) ${l}`),
    ...(known[m.lang] ?? []).map((l) => `- (${m.lang}) ${l}`),
    ...improvements,
  ].join("\n");
  const readme = existsSync(join(c.dir, "README.md")) ? readFileSync(join(c.dir, "README.md"), "utf8") : "(missing)";
  const builtIn = builtInRules(readFileSync(join(PKG_ROOT, "prompts", "generate.md"), "utf8"));
  const prompt = learnPrompt({ review: review.text, readme, manifest: m, lang: m.lang, existing, builtIn });

  mkdirSync(join(ws, ".logs"), { recursive: true });
  const logFile = join(ws, ".logs", `learn-${m.id}.log`);
  const cwd = makeTempDir("gingaloop-learn-"); // no files to read: everything is in the prompt
  const usage = { costUsd: null };
  const output = { text: "" };
  console.log(paint.dim(`Asking Claude which findings of the ${review.date} review are about the challenge itself …`));
  let code;
  try {
    code = await runClaude({ config, cwd, prompt, allowedTools: ["Read"], logFile, usage, output });
  } finally {
    removeDir(cwd);
  }
  const costNote = usage.costUsd != null ? ` (Claude cost $${usage.costUsd.toFixed(2)}, API list price)` : "";
  if (code !== 0) throw new UserError(`Claude exited with code ${code ?? "(killed: timeout)"}${costNote}. Log: ${logFile}`);
  const items = parseLearnResult(output.text, m.lang);
  if (!items) throw new UserError(`Could not read Claude's answer as JSON${costNote}. Log: ${logFile}`);
  if (!items.length) {
    console.log(`Nothing to learn: the review found no problem with the challenge itself${costNote}.`);
    return;
  }

  console.log(`\n${heading(`From the review of "${m.title}"`)}${paint.dim(costNote)}\n`);
  items.forEach((it, i) => {
    const where = it.kind === "tool" ? `gingaloop itself → ${IMPROVEMENTS_FILE}` : `${it.scope === "all" ? "all languages" : it.scope} → ${LESSONS_FILE}`;
    console.log(`${paint.bold(`${String(i + 1).padStart(2)}.`)} ${it.rule}\n    ${paint.cyan(`[${where}]`)}${it.evidence ? paint.dim(`\n    why: ${it.evidence}`) : ""}\n`);
  });
  let chosen = items;
  if (!opts.yes) {
    if (!isTTY()) throw new UserError("Re-run with --yes to save them non-interactively.");
    const answer = (await ask("Save which? [a]ll, [n]one, or numbers like 1,3", "a")).toLowerCase();
    if (answer.startsWith("n")) return console.log("Nothing saved.");
    if (!answer.startsWith("a")) {
      const picked = new Set(answer.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= items.length));
      chosen = items.filter((_, i) => picked.has(i + 1));
      if (!chosen.length) return console.log("Nothing saved.");
    }
  }
  const lessons = chosen.filter((i) => i.kind === "lesson");
  const tools = chosen.filter((i) => i.kind === "tool");
  if (lessons.length) addLessons(ws, lessons, m.id);
  if (tools.length) addImprovements(ws, tools, m.id);
  appendEvent(ws, { type: "learned", id: m.id, lang: m.lang, lessons: lessons.length, improvements: tools.length });
  console.log(
    [lessons.length && `${mark.ok()} ${lessons.length} lesson${lessons.length > 1 ? "s" : ""} in ${LESSONS_FILE}: the next ${m.lang} challenges follow ${lessons.length > 1 ? "them" : "it"}`,
      tools.length && `${mark.ok()} ${tools.length} idea${tools.length > 1 ? "s" : ""} for gingaloop in ${IMPROVEMENTS_FILE}`].filter(Boolean).join("\n"),
  );

  // General rules help every user once they're in the tool: offer a pre-filled issue for each.
  const general = chosen.filter((i) => i.kind === "tool" || i.scope === "all");
  if (!general.length) return;
  const report = opts.report || (isTTY() && /^y(es)?$/i.test(await ask(
    `\n${general.length} of them could help every gingaloop user. Open a pre-filled GitHub issue for ${general.length > 1 ? "each" : "it"}? (you review it before submitting) [y/N]`,
  )));
  if (!report) {
    console.log("To share them later: https://github.com/JarnDev/gingaloop/blob/main/CONTRIBUTING.md#lessons-from-your-reviews");
    return;
  }
  const opener = ["xdg-open", "open"].find(hasBin);
  const { version } = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));
  for (const it of general) {
    const url = issueUrl(it, m, version);
    if (opener) spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
    console.log(`${opener ? "Opened" : "Open"}: ${url}`);
  }
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
  console.log(`${mark.ok()} Committed: ${paint.bold(message.split("\n")[0])}`);
  if (opts.push) pushWorkspace(ws);
}

export async function cmdPush(_positionals, opts) {
  const { ws } = ctx(opts);
  pushWorkspace(ws);
  console.log(`${mark.ok()} Pushed.`);
}

