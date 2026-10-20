import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailyPlan, dailySlots } from "../src/cli.mjs";
import { bagState, dailySettings, drawLangs, extrasRolled, nextOrdered } from "../src/rotation.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const pickDailyLang = (events, rotation, mode, rand) => drawLangs(events, rotation, 1, { mode, rand })[0];

const daily = (lang, extra = {}) => ({ type: "generated", source: "daily", lang, ...extra });
const ROT = ["python", "c", "rust", "go"];

test("random: draws every language once per cycle, then refills", () => {
  let events = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    const seen = [];
    for (let i = 0; i < ROT.length; i++) {
      const lang = pickDailyLang(events, ROT, "random");
      assert.ok(!seen.includes(lang), `no repeat inside a cycle (cycle ${cycle}: ${seen} + ${lang})`);
      seen.push(lang);
      events = [...events, daily(lang)];
    }
    assert.deepEqual([...seen].sort(), [...ROT].sort());
  }
});

test("random: the pick is uniform over what is left in the bag", () => {
  const events = [daily("python"), daily("rust")];
  assert.deepEqual(bagState(events, ROT), { drawn: ["python", "rust"], remaining: ["c", "go"] });
  assert.equal(pickDailyLang(events, ROT, "random", () => 0), "c");
  assert.equal(pickDailyLang(events, ROT, "random", () => 1), "go");
});

test("reviews, manual challenges and removed languages don't draw from the bag", () => {
  const events = [
    daily("python"),
    daily("c", { reviewOf: "x" }),
    { type: "generated", source: "manual", lang: "rust" },
    daily("elixir"),
  ];
  assert.deepEqual(bagState(events, ROT).remaining, ["c", "rust", "go"]);
});

test("a language added mid-cycle joins the current bag", () => {
  const events = [daily("python"), daily("c")];
  assert.deepEqual(bagState(events, [...ROT, "zig"]).remaining, ["rust", "go", "zig"]);
});

test("ordered: continues after the last daily, so missed days don't skip languages", () => {
  assert.equal(nextOrdered([], ROT), "python");
  assert.equal(nextOrdered([daily("c")], ROT), "rust");
  assert.equal(nextOrdered([daily("go")], ROT), "python", "wraps around");
  assert.equal(pickDailyLang([daily("rust")], ROT, "ordered"), "go");
});

// --- anchors and extras ---

const DAY = "2026-10-20";
const on = (date, lang, extra = {}) => daily(lang, { id: `${date}-${lang}`, date, ...extra });
const cfg = (daily) => ({ ...DEFAULT_CONFIG, rotation: ROT, daily: { ...DEFAULT_CONFIG.daily, ...daily } });
// A date whose roll comes out as wanted, for a chance strictly between 0 and 1.
const dateWith = (want, chance = 0.5) => {
  for (let d = 1; d <= 28; d++) {
    const date = `2026-11-${String(d).padStart(2, "0")}`;
    if (extrasRolled(date, chance, 1) === want) return date;
  }
  throw new Error("no such date");
};

test("no daily settings: one pick a day, as before", () => {
  const plan = dailyPlan([], cfg({}), DAY);
  assert.deepEqual([plan.anchors, plan.picks, plan.extras, plan.forced], [[], 1, 0, 0]);
  const made = dailyPlan([on(DAY, "c")], cfg({}), DAY);
  assert.equal(made.picks, 0, "once a day");
  assert.equal(dailyPlan([on(DAY, "c")], cfg({}), DAY, { force: true }).forced, 1);
  assert.equal(dailyPlan([{ ...on(DAY, "c"), slot: undefined }], cfg({}), DAY).picks, 0, "older events without a slot are the pick");
});

test("anchors replace the pick and come every day, each once", () => {
  const c = cfg({ anchors: ["python", "go"] });
  assert.deepEqual(dailySettings(c, ROT), { anchors: ["python", "go"], pool: ["c", "rust"], extraChance: 0, extraMax: 1 });
  const plan = dailyPlan([], c, DAY);
  assert.deepEqual([plan.anchors, plan.picks], [["python", "go"], 0]);
  const retry = dailyPlan([on(DAY, "python", { slot: "anchor" })], c, DAY);
  assert.deepEqual(retry.anchors, ["go"], "a rerun only retries what is missing");
  assert.deepEqual(dailySettings(cfg({ anchors: ["elixir", "c"] }), ROT).anchors, ["c"], "anchors outside the rotation don't count");
});

test("extras: rolled by the date, the same on every run, and only what's missing", () => {
  assert.equal(extrasRolled(DAY, 0, 3), 0);
  assert.equal(extrasRolled(DAY, 1, 2), 2, "chance 1 is a fixed count per day");
  assert.equal(extrasRolled(DAY, 0.5, 4), extrasRolled(DAY, 0.5, 4));
  const yes = dateWith(1), no = dateWith(0);
  assert.equal(dailyPlan([], cfg({ extraChance: 0.5 }), yes).extras, 1);
  assert.equal(dailyPlan([], cfg({ extraChance: 0.5 }), no).extras, 0);
  assert.equal(dailyPlan([on(yes, "c", { slot: "extra" })], cfg({ extraChance: 0.5 }), yes).extras, 0, "made already");
  assert.equal(dailyPlan([on(yes, "c", { slot: "forced" })], cfg({ extraChance: 0.5 }), yes).extras, 1, "--force isn't the extra");
  let n = 0;
  for (let d = 0; d < 1000; d++) n += extrasRolled(`d${d}`, 0.3, 1);
  assert.ok(n > 230 && n < 370, `about 30% of days (${n}/1000)`);
});

test("extras wait while a challenge from an earlier day is open; anchors don't", () => {
  const c = cfg({ anchors: ["python"], extraChance: 1 });
  const old = on("2026-10-18", "rust");
  const plan = dailyPlan([old], c, DAY);
  assert.deepEqual([plan.anchors, plan.extras, plan.extrasSkipped], [["python"], 0, [old.id]]);
  const done = [old, { type: "solved", id: old.id }];
  assert.deepEqual([dailyPlan(done, c, DAY).extras, dailyPlan(done, c, DAY).extrasSkipped], [1, []]);
  const review = on("2026-10-18", "c", { reviewOf: "x" });
  assert.equal(dailyPlan([review], c, DAY).extras, 1, "an open review doesn't hold extras back");
  assert.deepEqual(dailyPlan([on(DAY, "rust")], c, DAY).extrasSkipped, [], "today's challenges don't count");
});

test("draws: pick and extras share the bag, never repeat a day's language, and anchors stay out", () => {
  const pool = dailySettings(cfg({ anchors: ["python"] }), ROT).pool;
  for (let k = 0; k < 20; k++) {
    const two = drawLangs([], pool, 2);
    assert.equal(new Set(two).size, 2);
    assert.ok(two.every((l) => pool.includes(l)));
  }
  // c and rust drawn this cycle: go is the last one in the bag, then it refills (without go).
  const events = [daily("c"), daily("rust"), daily("python", { slot: "anchor" })];
  assert.deepEqual(bagState(events, pool).remaining, ["go"], "anchor days aren't bag draws");
  const [first, second] = drawLangs(events, pool, 2, { rand: () => 0 });
  assert.deepEqual([first, second], ["go", "c"]);
  assert.deepEqual(drawLangs([], pool, 2, { taken: ["c", "rust"] }), ["go"], "fewer when the pool runs out");
  assert.deepEqual(drawLangs([], [], 1), [], "everything is an anchor: no extras");
  assert.deepEqual(drawLangs([daily("c")], pool, 2, { mode: "ordered", taken: ["rust"] }), ["go", "c"], "ordered skips today's languages (rust)");
  assert.deepEqual(drawLangs([daily("go")], pool, 2, { mode: "ordered" }), ["c", "rust"]);
});

test("slots: anchors, then the pick or extras from the bag, then --force", () => {
  const slots = (c, events = [], opts = {}) =>
    dailySlots(events, dailyPlan(events, c, DAY, opts), { pool: dailySettings(c, ROT).pool, rotation: ROT, mode: "random" });
  assert.deepEqual(slots(cfg({ anchors: ["python", "go"], extraChance: 1 })).map((s) => s.slot), ["anchor", "anchor", "extra"]);
  const plain = slots(cfg({ extraChance: 1, extraMax: 2 }));
  assert.deepEqual(plain.map((s) => s.slot), ["pick", "extra", "extra"]);
  assert.equal(new Set(plain.map((s) => s.lang)).size, 3, "three different languages");
  const all = cfg({ anchors: ROT, extraChance: 1 });
  assert.deepEqual(slots(all).map((s) => s.slot), ["anchor", "anchor", "anchor", "anchor"], "no pool, no extras");
  const madeAll = ROT.map((l) => on(DAY, l, { slot: "anchor" }));
  assert.deepEqual(slots(all, madeAll), [], "all made: nothing to do");
  assert.deepEqual(slots(all, madeAll, { force: true }).map((s) => s.slot), ["forced"], "--force still makes one, from the whole rotation");
  const forced = slots(cfg({}), [on(DAY, "c")], { force: true });
  assert.equal(forced.length, 1);
  assert.notEqual(forced[0].lang, "c", "--force picks another language when one is left");
});

test("ginga rotation anchor / extra keep the config consistent", () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-anchor-")));
  try {
    writeFileSync(join(tmp, "gingaloop.json"), JSON.stringify({ version: 2, rotation: ["python", "c"] }));
    const run = (...a) => spawnSync(process.execPath, [join(import.meta.dirname, "..", "bin", "ginga.mjs"), "rotation", "-w", tmp, ...a],
      { encoding: "utf8", timeout: 20000, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });
    const stored = () => JSON.parse(readFileSync(join(tmp, "gingaloop.json"), "utf8"));
    let r = run("anchor", "add", "javascript");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual([stored().rotation, stored().daily.anchors], [["python", "c", "javascript"], ["javascript"]], "an anchor joins the rotation");
    assert.match(r.stdout, /Anchors \(every day\): javascript/);
    r = run("extra", "0.3");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(stored().daily, { anchors: ["javascript"], extraChance: 0.3 }, "only what differs from the defaults");
    assert.match(r.stdout, /Extras: each day, one at 30% each/);
    assert.notEqual(run("extra", "1.5").status, 0);
    assert.notEqual(run("extra", "0.3", "0").status, 0);
    run("remove", "javascript");
    assert.deepEqual(stored().daily.anchors ?? [], [], "removing a language drops its anchor");
    run("anchor", "set", "python", "c");
    assert.match(run().stdout, /no extras/);
    run("anchor", "none");
    assert.deepEqual(stored().daily.anchors ?? [], []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
